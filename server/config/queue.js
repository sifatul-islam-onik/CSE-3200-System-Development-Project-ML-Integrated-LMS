const Bull = require('bull');

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

let jobSequence = 0;

const ocrQueue = new Bull('ocr-processing', REDIS_URL, {
  defaultJobOptions: {
    attempts: 3, // 3 attempts max
    backoff: {
      type: 'exponential',
      delay: 3000 // 3 second delay between retries
    },
    removeOnComplete: true, // Auto-remove completed jobs to prevent buildup
    removeOnFail: false, // Keep failed jobs for debugging
    timeout: 180000 // 3 minutes timeout
  },
  settings: {
    lockDuration: 180000, // 3 minutes lock
    lockRenewTime: 60000, // Renew lock every 60s
    stalledInterval: 60000, // Check for stalled jobs every 60s
    maxStalledCount: 2 // Max stalls before permanent failure
  }
});

function getNextSequence() {
  return ++jobSequence;
}

ocrQueue.on('ready', () => {
  console.log('✅ OCR Queue connected to Redis and ready');
});

ocrQueue.on('disconnected', () => {
  console.warn('⚠️  OCR Queue disconnected from Redis');
});

ocrQueue.on('reconnected', () => {
  console.log('🔄 OCR Queue reconnected to Redis');
});

ocrQueue.on('error', (error) => {
  console.error('❌ OCR Queue Error:', error);
});

ocrQueue.on('waiting', (jobId) => {
  console.log(`⏳ Job ${jobId} waiting in queue (FIFO order)`);
});

ocrQueue.on('active', (job) => {
  console.log(`▶️  Job ${job.id} (${job.data.jobId}) started processing`);
});

ocrQueue.on('completed', (job, result) => {
  console.log(`✅ Job ${job.id} (${job.data.jobId}) completed successfully`);
});

ocrQueue.on('failed', (job, err) => {
  console.error(`❌ Job ${job.id} (${job.data.jobId}) failed:`, err.message);
});

ocrQueue.on('stalled', (job) => {
  console.warn(`⚠️  Job ${job.id} (${job.data.jobId}) stalled - will be retried`);
});

ocrQueue.on('cleaned', (jobs, type) => {
  console.log(`🧹 Cleaned ${jobs.length} ${type} jobs from queue`);
});

console.log('📋 OCR Queue initialized with STRICT FIFO ordering');

module.exports = ocrQueue;
module.exports.getNextSequence = getNextSequence;
