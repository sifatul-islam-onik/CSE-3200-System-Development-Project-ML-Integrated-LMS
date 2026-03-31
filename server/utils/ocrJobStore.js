const redisClient = require('../config/redisClient');


class OCRJobStore {
  constructor() {
    this.JOB_PREFIX = 'ocr_job:';
    this.USER_PREFIX = 'ocr_user:';
    this.CLEANUP_AGE = 24 * 60 * 60; // 24 hours in seconds
  }

  async createJob(jobData) {
    const job = {
      jobId: jobData.jobId,
      userId: jobData.userId,
      studentId: jobData.studentId,
      student: jobData.student ? JSON.stringify(jobData.student) : null,
      courseId: jobData.courseId,
      section: jobData.section || null,
      imageUrl: jobData.imageUrl,
      status: 'pending',
      progress: 0,
      marks: null,
      confidence: null,
      rawTable: null,
      error: null,
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      queuedAt: null,
      sequence: null
    };

    const jobKey = `${this.JOB_PREFIX}${job.jobId}`;
    await redisClient.hset(jobKey, job);
    
    await redisClient.expire(jobKey, this.CLEANUP_AGE);

    const userKey = `${this.USER_PREFIX}${job.userId}:jobs`;
    await redisClient.zadd(userKey, Date.now(), job.jobId);
    await redisClient.expire(userKey, this.CLEANUP_AGE); // reset expiry for the user index

    console.log(`Created job ${job.jobId} in Redis store`);
    
    return this._parseJob(job);
  }

  async getJob(jobId) {
    const jobKey = `${this.JOB_PREFIX}${jobId}`;
    const job = await redisClient.hgetall(jobKey);
    if (!job || Object.keys(job).length === 0) return null;
    return this._parseJob(job);
  }

  async getUserJobs(userId, filters = {}) {
    const userKey = `${this.USER_PREFIX}${userId}:jobs`;
    const jobIds = await redisClient.zrevrange(userKey, 0, 99);
    if (!jobIds || jobIds.length === 0) return [];

    const pipeline = redisClient.pipeline();
    jobIds.forEach(jobId => {
       pipeline.hgetall(`${this.JOB_PREFIX}${jobId}`);
    });
    
    const results = await pipeline.exec();
    
    let jobs = results
      .filter(([err, job]) => !err && job && Object.keys(job).length > 0)
      .map(([err, job]) => this._parseJob(job));

    if (filters.courseId) {
      jobs = jobs.filter(job => job.courseId === filters.courseId);
    }
    if (filters.studentId) {
      jobs = jobs.filter(job => job.studentId === filters.studentId);
    }
    if (filters.status) {
      jobs = jobs.filter(job => job.status === filters.status);
    }

    return jobs;
  }

  async updateJob(jobId, updates) {
    const jobKey = `${this.JOB_PREFIX}${jobId}`;
    const exists = await redisClient.exists(jobKey);
    if (!exists) return null;

    const formattedUpdates = { ...updates };
    if (formattedUpdates.student && typeof formattedUpdates.student === 'object') {
       formattedUpdates.student = JSON.stringify(formattedUpdates.student);
    }
    if (formattedUpdates.marks && typeof formattedUpdates.marks === 'object') {
       formattedUpdates.marks = JSON.stringify(formattedUpdates.marks);
    }
    if (formattedUpdates.rawTable && typeof formattedUpdates.rawTable === 'object') {
       formattedUpdates.rawTable = JSON.stringify(formattedUpdates.rawTable);
    }
    if (formattedUpdates.completedAt instanceof Date) {
       formattedUpdates.completedAt = formattedUpdates.completedAt.toISOString();
    }
    if (formattedUpdates.startedAt instanceof Date) {
       formattedUpdates.startedAt = formattedUpdates.startedAt.toISOString();
    }

    await redisClient.hset(jobKey, formattedUpdates);
    
    return this.getJob(jobId);
  }

  async deleteJob(jobId) {
    const jobData = await this.getJob(jobId);
    if (!jobData) return false;

    const jobKey = `${this.JOB_PREFIX}${jobId}`;
    const userKey = `${this.USER_PREFIX}${jobData.userId}:jobs`;

    await redisClient.del(jobKey);
    await redisClient.zrem(userKey, jobId);
    
    return true;
  }

  _parseJob(rawJob) {
    const parsed = { ...rawJob };
    try { if (parsed.student && typeof parsed.student === 'string') parsed.student = JSON.parse(parsed.student); } catch(e){}
    try { if (parsed.marks && typeof parsed.marks === 'string') parsed.marks = JSON.parse(parsed.marks); } catch(e){}
    try { if (parsed.rawTable && typeof parsed.rawTable === 'string') parsed.rawTable = JSON.parse(parsed.rawTable); } catch(e){}
    
    if (parsed.progress !== undefined) parsed.progress = Number(parsed.progress);
    if (parsed.sequence !== undefined && parsed.sequence !== null && parsed.sequence !== 'null') parsed.sequence = Number(parsed.sequence);
    if (parsed.confidence !== undefined && parsed.confidence !== null && parsed.confidence !== 'null') parsed.confidence = Number(parsed.confidence);
    if (parsed.attemptNumber !== undefined && parsed.attemptNumber !== null && parsed.attemptNumber !== 'null') parsed.attemptNumber = Number(parsed.attemptNumber);
    if (parsed.maxAttempts !== undefined && parsed.maxAttempts !== null && parsed.maxAttempts !== 'null') parsed.maxAttempts = Number(parsed.maxAttempts);
    
    if (parsed.isRetry !== undefined) parsed.isRetry = parsed.isRetry === 'true';
    
    if (parsed.courseId === 'null') parsed.courseId = null;
    if (parsed.section === 'null') parsed.section = null;
    if (parsed.error === 'null') parsed.error = null;
    if (parsed.marks === 'null') parsed.marks = null;
    if (parsed.rawTable === 'null') parsed.rawTable = null;

    if (parsed.createdAt) parsed.createdAt = new Date(parsed.createdAt);
    if (parsed.startedAt && parsed.startedAt !== 'null') parsed.startedAt = new Date(parsed.startedAt);
    if (parsed.completedAt && parsed.completedAt !== 'null') parsed.completedAt = new Date(parsed.completedAt);
    if (parsed.queuedAt && parsed.queuedAt !== 'null') parsed.queuedAt = new Date(parsed.queuedAt);

    return parsed;
  }

  clearAll() {
  }

  async getStats() {
    return { 
      total: 0, 
      totalUsers: 0, 
      statuses: { pending: 0, processing: 0, completed: 0, failed: 0 } 
    };
  }
  
  getPendingCount() { return 0; }
  getProcessingCount() { return 0; }
  checkStuckJobs() { return []; }
  
  startPeriodicCleanup() { /* handled by redis ttl */ }
  stopPeriodicCleanup() { /* handled by redis ttl */ }
}

const ocrJobStore = new OCRJobStore();
module.exports = ocrJobStore;
