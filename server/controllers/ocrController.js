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

    // Immediately return job ID to client
    res.status(202).json({
      success: true,
      message: 'OCR job submitted successfully',
      jobId: ocrJob.jobId,
      data: {
        jobId: ocrJob.jobId,
        status: ocrJob.status,
        progress: ocrJob.progress,
        createdAt: ocrJob.createdAt
      }
    });

    // Add job to Bull queue
    await ocrQueue.add({
      jobId: ocrJob.jobId,
      imageUrl
    }, {
      jobId: ocrJob.jobId, // Use our jobId as Bull's job ID for easy tracking
      priority: 1
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

    // Remove from memory store
    ocrJobStore.deleteJob(jobId);

    // Remove from Bull queue if it's there
    try {
      const bullJob = await ocrQueue.getJob(jobId);
      if (bullJob) {
        await bullJob.remove();
      }
    } catch (error) {
      console.warn(`Could not remove job ${jobId} from queue:`, error.message);
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
    
    // Get queue counts
    const waitingCount = await ocrQueue.getWaitingCount();
    
    // Status logic: 
    // - busy: if there are waiting jobs (workers are at capacity)
    // - free: if no waiting jobs (workers are ready)
    const status = waitingCount > 0 ? 'busy' : 'free';
    
    res.status(200).json({
      success: true,
      data: {
        status,
        healthyWorkers: healthyWorkers.length,
        totalWorkers: workerRegistry.getWorkers(true).length
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