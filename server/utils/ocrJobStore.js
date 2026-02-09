// In-memory store for OCR jobs (no database persistence)
// Jobs are stored temporarily and will be lost on server restart

class OCRJobStore {
  constructor() {
    this.jobs = new Map(); // jobId -> job data
    this.userJobs = new Map(); // userId -> Set of jobIds
    this.cleanupInterval = null; // For periodic cleanup
  }

  // Create a new job
  createJob(jobData) {
    const job = {
      jobId: jobData.jobId,
      userId: jobData.userId,
      studentId: jobData.studentId,
      student: jobData.student || null, // Store student info (name, roll) for UI display
      courseId: jobData.courseId,
      section: jobData.section || null,
      imageUrl: jobData.imageUrl,
      status: 'pending',
      progress: 0,
      marks: null,
      confidence: null,
      rawTable: null,
      error: null,
      createdAt: new Date(),
      startedAt: null,
      completedAt: null,
      queuedAt: null, // Track when added to Bull queue
      sequence: null // Track sequence number for FIFO verification
    };

    this.jobs.set(job.jobId, job);

    // Track user's jobs
    if (!this.userJobs.has(job.userId)) {
      this.userJobs.set(job.userId, new Set());
    }
    this.userJobs.get(job.userId).add(job.jobId);

    console.log(`📝 Created job ${job.jobId} in store`);
    return job;
  }

  // Get job by ID
  getJob(jobId) {
    return this.jobs.get(jobId);
  }

  // Get all jobs for a user
  getUserJobs(userId, filters = {}) {
    const userJobIds = this.userJobs.get(userId);
    if (!userJobIds) return [];

    let jobs = Array.from(userJobIds)
      .map(jobId => this.jobs.get(jobId))
      .filter(job => job); // Filter out any undefined entries

    // Apply filters
    if (filters.courseId) {
      jobs = jobs.filter(job => job.courseId === filters.courseId);
    }
    if (filters.studentId) {
      jobs = jobs.filter(job => job.studentId === filters.studentId);
    }
    if (filters.status) {
      jobs = jobs.filter(job => job.status === filters.status);
    }

    // Sort by creation date (newest first)
    jobs.sort((a, b) => b.createdAt - a.createdAt);

    // Limit to 100 most recent
    return jobs.slice(0, 100);
  }

  // Update job
  updateJob(jobId, updates) {
    const job = this.jobs.get(jobId);
    if (!job) return null;

    Object.assign(job, updates);
    this.jobs.set(jobId, job);
    return job;
  }

  // Delete job
  deleteJob(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    // Remove from user's job set
    const userJobIds = this.userJobs.get(job.userId);
    if (userJobIds) {
      userJobIds.delete(jobId);
      if (userJobIds.size === 0) {
        this.userJobs.delete(job.userId);
      }
    }

    // Remove job
    this.jobs.delete(jobId);
    return true;
  }

  // Get all jobs (for debugging/admin)
  getAllJobs() {
    return Array.from(this.jobs.values());
  }

  // Clear all jobs (for testing)
  clearAll() {
    this.jobs.clear();
    this.userJobs.clear();
  }

  // Get statistics
  getStats() {
    const statuses = { pending: 0, processing: 0, completed: 0, failed: 0 };
    for (const job of this.jobs.values()) {
      statuses[job.status] = (statuses[job.status] || 0) + 1;
    }
    return {
      total: this.jobs.size,
      totalUsers: this.userJobs.size,
      statuses
    };
  }

  // Clean up old completed/failed jobs (prevent memory leak)
  cleanupOldJobs(maxAge = 24 * 60 * 60 * 1000) { // Default 24 hours
    const now = Date.now();
    let cleaned = 0;

    for (const [jobId, job] of this.jobs.entries()) {
      // Only clean up completed or failed jobs
      if (job.status === 'completed' || job.status === 'failed') {
        const jobAge = now - new Date(job.completedAt || job.createdAt).getTime();
        
        if (jobAge > maxAge) {
          this.deleteJob(jobId);
          cleaned++;
        }
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 Cleaned up ${cleaned} old jobs from memory`);
    }

    return cleaned;
  }

  // Start periodic cleanup
  startPeriodicCleanup(intervalMs = 60 * 60 * 1000) { // Default 1 hour
    if (this.cleanupInterval) {
      console.log('⚠️  Cleanup already running');
      return;
    }

    console.log(`🕐 Starting periodic job cleanup (every ${intervalMs / 1000 / 60} minutes)`);
    
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldJobs();
    }, intervalMs);

    // Run initial cleanup
    this.cleanupOldJobs();
  }

  // Stop periodic cleanup
  stopPeriodicCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      console.log('🛑 Stopped periodic job cleanup');
    }
  }

  // Check for stuck pending jobs that haven't been processed
  checkStuckJobs(maxWaitTimeMs = 5 * 60 * 1000) { // Default 5 minutes
    const now = Date.now();
    const stuckJobs = [];

    for (const [jobId, job] of this.jobs.entries()) {
      // Check if job is pending and has been waiting too long
      if (job.status === 'pending' && job.queuedAt) {
        const waitTime = now - new Date(job.queuedAt).getTime();
        
        if (waitTime > maxWaitTimeMs) {
          stuckJobs.push({
            jobId,
            waitTime: Math.floor(waitTime / 1000), // seconds
            sequence: job.sequence,
            createdAt: job.createdAt
          });
        }
      }
    }

    if (stuckJobs.length > 0) {
      console.warn(`⚠️  Found ${stuckJobs.length} stuck pending jobs:`);
      stuckJobs.forEach(job => {
        console.warn(`   - Job ${job.jobId} (seq: ${job.sequence}) waiting ${job.waitTime}s`);
      });
    }

    return stuckJobs;
  }

  // Get pending jobs count
  getPendingCount() {
    let count = 0;
    for (const job of this.jobs.values()) {
      if (job.status === 'pending') count++;
    }
    return count;
  }

  // Get processing jobs count
  getProcessingCount() {
    let count = 0;
    for (const job of this.jobs.values()) {
      if (job.status === 'processing') count++;
    }
    return count;
  }
}

// Create singleton instance
const ocrJobStore = new OCRJobStore();

module.exports = ocrJobStore;
