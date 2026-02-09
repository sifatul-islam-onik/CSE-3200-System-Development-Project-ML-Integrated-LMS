const Bull = require('bull');

// Redis configuration
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

// Create OCR processing queue
const ocrQueue = new Bull('ocr-processing', REDIS_URL, {
  defaultJobOptions: {
    attempts: 3, // 3 attempts - health check conflicts resolved
    backoff: {
      type: 'exponential',
      delay: 3000 // 3 second delay between retries
    },
    removeOnComplete: {
      count: 100, // Keep last 100 completed jobs
      age: 24 * 3600 // Keep completed jobs for 24 hours
    },
    removeOnFail: false // Keep failed jobs for debugging
  }
});

// Queue event listeners
ocrQueue.on('error', (error) => {
  console.error('OCR Queue Error:', error);
});

ocrQueue.on('waiting', (jobId) => {
  console.log(`Job ${jobId} is waiting`);
});

ocrQueue.on('active', (job) => {
  console.log(`Job ${job.id} (${job.data.jobId}) started processing`);
});

ocrQueue.on('completed', (job, result) => {
  console.log(`Job ${job.id} (${job.data.jobId}) completed`);
});

ocrQueue.on('failed', (job, err) => {
  console.error(`Job ${job.id} (${job.data.jobId}) failed:`, err.message);
});

ocrQueue.on('stalled', (job) => {
  console.warn(`Job ${job.id} (${job.data.jobId}) stalled`);
});

module.exports = ocrQueue;
