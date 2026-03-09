const ocrJobStore = require('../utils/ocrJobStore');
const ocrQueue = require('../config/queue');
const workerRegistry = require('../utils/workerRegistry');
const { v4: uuidv4 } = require('uuid');

// @desc    Submit OCR job
// @route   POST /api/ocr/submit
// @access  Private (Teacher)
exports.submitOCRJob = async (req, res) => {
  try {
    const { studentId, courseId, section, imageUrl, student } = req.body;

    if (!studentId || !courseId || !imageUrl) {
      return res.status(400).json({
        success: false,
        message: 'Student ID, Course ID, and image URL are required'
      });
    }

    // VULN-04: Only accept base64 data-URIs to prevent SSRF via external URLs
    if (!imageUrl.startsWith('data:image/')) {
      return res.status(400).json({
        success: false,
        message: 'imageUrl must be a base64 data URI (data:image/...)'
      });
    }
    // Enforce a 20 MB cap on the base64 payload (~15 MB decoded)
    if (imageUrl.length > 20 * 1024 * 1024) {
      return res.status(400).json({
        success: false,
        message: 'Image data exceeds the 20 MB limit'
      });
    }

    // Generate unique job ID
    const jobId = uuidv4();

    // Create OCR job in memory store
    const ocrJob = ocrJobStore.createJob({
      jobId,
      userId: req.user._id.toString(),
      studentId,
      student: student || null, // Store student info for UI display
      courseId,
      section: section || null,
      imageUrl
    });

    // Add job to Bull queue FIRST with strict FIFO ordering
    // CRITICAL: Let Bull auto-generate job IDs to prevent conflicts/replacements
    // Use sequence number for tracking only
    const sequence = ocrQueue.getNextSequence();
    let bullJob; // Declare outside try-catch for access in response
    
    try {
      bullJob = await ocrQueue.add(
        {
          jobId: ocrJob.jobId, // Our internal job ID (in data payload)
          imageUrl,
          submittedAt: Date.now(),
          sequence: sequence // For tracking and verification
        }
        // DO NOT specify jobId in options - let Bull auto-generate
        // DO NOT use named jobs - use default unnamed queue
        // This ensures true FIFO behavior
      );
      // IMMEDIATELY update job store BEFORE job can be picked up by worker
      // This prevents race condition where worker tries to access incomplete job data
      ocrJobStore.updateJob(ocrJob.jobId, {
        queuedAt: new Date(),
        sequence: sequence,
        bullJobId: bullJob.id // Store Bull's auto-generated ID for later reference
      });
      
      // Log after store update to ensure consistency
      console.log(`📥 Job ${ocrJob.jobId} queued (seq: ${sequence}, bullId: ${bullJob.id})`);
      
    } catch (queueError) {
      // If queue add fails, mark job as failed and throw error
      console.error(`❌ Failed to add job ${ocrJob.jobId} to queue:`, queueError);
      ocrJobStore.updateJob(ocrJob.jobId, {
        status: 'failed',
        error: `Failed to add to queue: ${queueError.message}`
      });
      throw new Error(`Failed to add job to queue: ${queueError.message}`);
    }

    // Return job ID to client after successful queue addition
    res.status(202).json({
      success: true,
      message: 'OCR job submitted successfully and queued',
      jobId: ocrJob.jobId,
      data: {
        jobId: ocrJob.jobId,
        status: ocrJob.status,
        progress: ocrJob.progress,
        createdAt: ocrJob.createdAt,
        sequence: sequence, // Include sequence for client-side tracking
        bullJobId: bullJob.id // Include Bull ID for debugging
      }
    });

  } catch (error) {
    console.error('Submit OCR job error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error submitting OCR job'
    });
  }
};

// @desc    Get all OCR jobs for logged-in user
// @route   GET /api/ocr/jobs
// @access  Private
exports.getUserOCRJobs = async (req, res) => {
  try {
    const { courseId, studentId, status } = req.query;

    const filters = {};
    if (courseId) filters.courseId = courseId;
    if (studentId) filters.studentId = studentId;
    if (status) filters.status = status;

    const jobs = ocrJobStore.getUserJobs(req.user._id.toString(), filters);

    res.status(200).json({
      success: true,
      count: jobs.length,
      data: jobs
    });

  } catch (error) {
    console.error('Get OCR jobs error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching OCR jobs'
    });
  }
};

// @desc    Get specific OCR job status
// @route   GET /api/ocr/status/:jobId
// @access  Private
exports.getOCRJobStatus = async (req, res) => {
  try {
    const { jobId } = req.params;

    const job = ocrJobStore.getJob(jobId);

    if (!job || job.userId !== req.user._id.toString()) {
      return res.status(404).json({
        success: false,
        message: 'OCR job not found'
      });
    }

    res.status(200).json({
      success: true,
      data: job
    });

  } catch (error) {
    console.error('Get OCR job status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching OCR job status'
    });
  }
};

// @desc    Delete OCR job
// @route   DELETE /api/ocr/jobs/:jobId
// @access  Private
exports.deleteOCRJob = async (req, res) => {
  try {
    const { jobId } = req.params;

    const job = ocrJobStore.getJob(jobId);

    if (!job || job.userId !== req.user._id.toString()) {
      return res.status(404).json({
        success: false,
        message: 'OCR job not found'
      });
    }

    // Remove from memory store first
    const bullJobId = job.bullJobId; // Get Bull's auto-generated ID
    ocrJobStore.deleteJob(jobId);

    // Remove from Bull queue if it's there (using Bull's ID)
    if (bullJobId) {
      try {
        const bullJob = await ocrQueue.getJob(bullJobId);
        if (bullJob) {
          await bullJob.remove();
          console.log(`🗑️  Removed job ${jobId} (Bull ID: ${bullJobId}) from queue`);
        }
      } catch (error) {
        console.warn(`Could not remove job ${jobId} from queue:`, error.message);
      }
    }

    res.status(200).json({
      success: true,
      message: 'OCR job deleted successfully'
    });

  } catch (error) {
    console.error('Delete OCR job error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting OCR job'
    });
  }
};

// @desc    Get OCR server status (free/busy based on worker availability and queue)
// @route   GET /api/ocr/queue-status
// @access  Private
exports.getQueueStatus = async (req, res) => {
  try {
    const healthyWorkers = workerRegistry.getHealthyWorkers();
    
    // Get queue counts for detailed status
    const waitingCount = await ocrQueue.getWaitingCount();
    const activeCount = await ocrQueue.getActiveCount();
    const completedCount = await ocrQueue.getCompletedCount();
    const failedCount = await ocrQueue.getFailedCount();
    const delayedCount = await ocrQueue.getDelayedCount();
    
    // Status logic: 
    // - busy: if there are waiting jobs (workers are at capacity)
    // - free: if no waiting jobs (workers are ready)
    const status = waitingCount > 0 ? 'busy' : 'free';
    
    res.status(200).json({
      success: true,
      data: {
        status,
        healthyWorkers: healthyWorkers.length,
        totalWorkers: workerRegistry.getWorkers(true).length,
        queue: {
          waiting: waitingCount,
          active: activeCount,
          completed: completedCount,
          failed: failedCount,
          delayed: delayedCount,
          orderingType: 'FIFO' // First In First Out
        }
      }
    });
  } catch (error) {
    console.error('Get queue status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching queue status'
    });
  }
};