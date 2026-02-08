const ocrQueue = require('../config/queue');
const ocrJobStore = require('../utils/ocrJobStore');
const axios = require('axios');

const ML_SERVER_URL = process.env.ML_SERVER_URL || 'http://localhost:8000';

// Process OCR jobs from the queue
ocrQueue.process(1, async (job, done) => {
  const { jobId, imageUrl } = job.data;
  
  console.log(`Worker: Processing OCR job ${jobId}`);
  
  try {
    // Update status to processing
    ocrJobStore.updateJob(jobId, {
      status: 'processing',
      startedAt: new Date(),
      progress: 10
    });
    
    // Update job progress (10%)
    job.progress(10);

    // Convert image URL to blob/buffer
    let imageBlob;
    if (imageUrl.startsWith('data:')) {
      // Data URL
      const base64Data = imageUrl.split(',')[1];
      if (!base64Data) {
        throw new Error('Invalid base64 data - missing data after comma');
      }
      imageBlob = Buffer.from(base64Data, 'base64');
    } else if (imageUrl.startsWith('http')) {
      // HTTP URL
      const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      imageBlob = Buffer.from(response.data);
    } else {
      throw new Error(`Invalid image URL format. Starts with: ${imageUrl.substring(0, 20)}`);
    }

    // Update progress
    ocrJobStore.updateJob(jobId, { progress: 30 });
    job.progress(30);

    // Send to ML server
    const FormData = require('form-data');
    const formData = new FormData();
    formData.append('image', imageBlob, { filename: 'answer-sheet.jpg' });

    ocrJobStore.updateJob(jobId, { progress: 50 });
    job.progress(50);

    const mlResponse = await axios.post(`${ML_SERVER_URL}/api/extract-marks`, formData, {
      headers: {
        ...formData.getHeaders(),
        'ngrok-skip-browser-warning': 'true'  // Skip ngrok warning page
      },
      timeout: 120000 // 2 minutes timeout
    });

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
        completedAt: new Date()
      });
      job.progress(100);
      console.log(`✓ OCR job ${jobId} completed successfully`);
      
      done(null, { success: true, jobId });
    } else {
      throw new Error(mlResponse.data.message || 'OCR extraction failed - no marks in response');
    }

  } catch (error) {
    console.error(`✗ OCR job ${jobId} failed: ${error.message}`);
    
    if (error.response) {
      console.error(`  ML Server response status: ${error.response.status}`);
      console.error(`  ML Server response:`, error.response.data);
    }
    
    ocrJobStore.updateJob(jobId, {
      status: 'failed',
      error: error.message,
      progress: 0,
      completedAt: new Date()
    });
    
    done(new Error(error.message));
  }
});

console.log('OCR Worker started and listening for jobs...');

module.exports = ocrQueue;
