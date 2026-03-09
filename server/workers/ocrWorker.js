const ocrQueue = require('../config/queue');
const ocrJobStore = require('../utils/ocrJobStore');
const workerRegistry = require('../utils/workerRegistry');
const axios = require('axios');

/**
 * Pull-based OCR Worker Architecture
 * - Single processor pulls jobs from queue with high concurrency
 * - Dynamic worker selection at job start (least-loaded worker)
 * - Workers process jobs based on availability (tracked via activeRequests)
 */

// Configure concurrency - allow multiple jobs to process in parallel
// Set to match number of workers to avoid overloading ML servers
const CONCURRENCY = parseInt(process.env.OCR_CONCURRENCY || '4', 10);

console.log(`OCR Worker configured with concurrency: ${CONCURRENCY}`);

// Single processor that routes jobs to available workers (STRICT FIFO order)
// Process unnamed jobs in natural FIFO order from Bull queue
ocrQueue.process(CONCURRENCY, async (job, done) => {
  const { jobId, imageUrl, submittedAt, sequence } = job.data;
  
  const attemptNumber = job.attemptsMade + 1;
  const maxAttempts = job.opts.attempts || 3;
  const isRetry = attemptNumber > 1;
  
  let workerId = null;
  let workerUrl = null;

  try {
    // Verify job exists in store (prevent processing lost jobs)
    const jobInStore = ocrJobStore.getJob(jobId);
    if (!jobInStore) {
      console.error(`❌ Job ${jobId} not found in store - creating entry`);
      // Recreate job entry if somehow lost
      throw new Error('Job not found in store - may have been deleted');
    }

    // Get an available healthy worker (one with lowest activeRequests)
    const healthyWorkers = workerRegistry.getHealthyWorkers();
    
    if (healthyWorkers.length === 0) {
      // No workers available - this will trigger a retry
      throw new Error('No healthy OCR workers available. Please check worker status.');
    }

    // Select worker with least active requests for better load distribution
    const selectedWorker = healthyWorkers.reduce((prev, current) => 
      (prev.activeRequests < current.activeRequests) ? prev : current
    );

    workerId = selectedWorker.id;
    workerUrl = selectedWorker.url;

    const waitTime = Date.now() - (submittedAt || Date.now());
    if (waitTime > 5000) {
      console.log(`  ⏱️  Job ${jobId} waited ${(waitTime/1000).toFixed(1)}s in queue`);
    }

    if (selectedWorker.activeRequests > 0) {
      console.log(`  ⚠️  Worker ${workerId} has ${selectedWorker.activeRequests} active request(s)`);
    }

    console.log(`🔄 Worker ${workerId}: Processing job ${jobId} [SEQ:${sequence}]${isRetry ? ` (Retry ${attemptNumber}/${maxAttempts})` : ''} [FIFO]`);

    // Mark request start for metrics
    workerRegistry.requestStart(workerId);

    // Update status to processing
    ocrJobStore.updateJob(jobId, {
      status: 'processing',
      startedAt: new Date(),
      progress: 10,
      assignedWorker: workerId,
      attemptNumber: attemptNumber,
      isRetry: isRetry,
      error: null
    });
    
    job.progress(10);

    // Convert image URL to blob/buffer
    let imageBlob;
    if (imageUrl.startsWith('data:')) {
      const base64Data = imageUrl.split(',')[1];
      if (!base64Data) {
        throw new Error('Invalid base64 data - missing data after comma');
      }
      imageBlob = Buffer.from(base64Data, 'base64');
    } else {  // VULN-04: HTTP fetch branch removed — only data-URIs are accepted
      throw new Error(`Invalid image URL format. Starts with: ${imageUrl.substring(0, 20)}`);
    }

    ocrJobStore.updateJob(jobId, { progress: 30 });
    job.progress(30);

    // Send to ML server
    const FormData = require('form-data');
    const formData = new FormData();
    formData.append('image', imageBlob, { filename: 'answer-sheet.jpg' });

    ocrJobStore.updateJob(jobId, { progress: 50 });
    job.progress(50);

    console.log(`  → Sending request to ML server ${workerId}...`);
    const mlStartTime = Date.now();

    const mlResponse = await axios.post(`${workerUrl}/api/extract-marks`, formData, {
      headers: {
        ...formData.getHeaders(),
        'ngrok-skip-browser-warning': 'true',
        'X-API-Key': process.env.ML_API_KEY || '' // VULN-11: ML server authentication
      },
      timeout: 180000 // 3 minutes timeout (increased from 2 minutes for cold starts)
    });

    const mlDuration = ((Date.now() - mlStartTime) / 1000).toFixed(2);
    console.log(`  → ML server ${workerId} responded in ${mlDuration}s`);

    ocrJobStore.updateJob(jobId, { progress: 90 });
    job.progress(90);

    if (mlResponse.data.success && mlResponse.data.marks) {
      // Update job with results
      ocrJobStore.updateJob(jobId, {
        status: 'completed',
        marks: mlResponse.data.marks,
        confidence: mlResponse.data.confidence,
        rawTable: mlResponse.data.raw_table,
        progress: 100,
        completedAt: new Date(),
        processedBy: workerId,
        attemptNumber: attemptNumber,
        succeededAfterRetry: isRetry,
        error: null
      });
      job.progress(100);
      console.log(`✅ Worker ${workerId}: Job ${jobId} completed${isRetry ? ' (after retry)' : ''}`);
      
      // Mark worker request as complete BEFORE calling done()
      workerRegistry.requestComplete(workerId, true);
      
      // Signal successful completion to Bull queue
      done(null, { 
        success: true, 
        jobId, 
        workerId,
        completedAt: new Date().toISOString()
      });
    } else {
      throw new Error(mlResponse.data.message || 'OCR extraction failed - no marks in response');
    }

  } catch (error) {
    console.error(`❌ Worker ${workerId || 'unknown'}: Job ${jobId} failed: ${error.message}`);
    
    if (error.response) {
      console.error(`  ML Server response status: ${error.response.status}`);
    }
    
    // Check if this job will be retried
    const willRetry = attemptNumber < maxAttempts;
    
    if (willRetry) {
      console.log(`  🔄 Will retry (attempt ${attemptNumber}/${maxAttempts})`);
      ocrJobStore.updateJob(jobId, {
        status: 'retrying',
        error: error.message,
        progress: 0,
        attemptNumber: attemptNumber,
        maxAttempts: maxAttempts,
        failedWorker: workerId,
        lastFailedAt: new Date()
      });
    } else {
      console.log(`  ❌ Final failure (all ${maxAttempts} attempts exhausted)`);
      ocrJobStore.updateJob(jobId, {
        status: 'failed',
        error: error.message,
        progress: 0,
        completedAt: new Date(),
        attemptNumber: attemptNumber,
        maxAttempts: maxAttempts,
        failedWorker: workerId
      });
    }

    // Always release worker from active request tracking
    if (workerId) {
      workerRegistry.requestComplete(workerId, false);
    }
    
    // Signal failure to Bull queue (will trigger retry if attempts remain)
    done(new Error(error.message));
  }
});

console.log('OCR Worker system started with dynamic worker selection');

module.exports = ocrQueue;
