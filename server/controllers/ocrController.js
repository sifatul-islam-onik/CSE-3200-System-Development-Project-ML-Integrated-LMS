const ocrJobStore = require('../utils/ocrJobStore');
const ocrQueue = require('../config/queue');
const workerRegistry = require('../utils/workerRegistry');
const { v4: uuidv4 } = require('uuid');

exports.submitOCRJob = async (req, res) => {
  try {
    const { studentId, courseId, section, imageUrl, student } = req.body;

    if (!studentId || !courseId || !imageUrl) {
      return res.status(400).json({
        success: false,
        message: 'Student ID, Course ID, and image URL are required'
      });
    }

    if (!imageUrl.startsWith('data:image/')) {
      return res.status(400).json({
        success: false,
        message: 'imageUrl must be a base64 data URI (data:image/...)'
      });
    }
    if (imageUrl.length > 20 * 1024 * 1024) {
      return res.status(400).json({
        success: false,
        message: 'Image data exceeds the 20 MB limit'
      });
    }

    const jobId = uuidv4();

    const ocrJob = await ocrJobStore.createJob({
      jobId,
      userId: req.user._id.toString(),
      studentId,
      student: student || null, // Store student info for UI display
      courseId,
      section: section || null,
      imageUrl
    });

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
      );
      await ocrJobStore.updateJob(ocrJob.jobId, {
        queuedAt: new Date(),
        sequence: sequence,
        bullJobId: bullJob.id // Store Bull's auto-generated ID for later reference
      });
      
      console.log(`📥 Job ${ocrJob.jobId} queued (seq: ${sequence}, bullId: ${bullJob.id})`);
      
    } catch (queueError) {
      console.error(`❌ Failed to add job ${ocrJob.jobId} to queue:`, queueError);
      await ocrJobStore.updateJob(ocrJob.jobId, {
        status: 'failed',
        error: `Failed to add to queue: ${queueError.message}`
      });
      throw new Error(`Failed to add job to queue: ${queueError.message}`);
    }

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

exports.getUserOCRJobs = async (req, res) => {
  try {
    const { courseId, studentId, status } = req.query;

    const filters = {};
    if (courseId) filters.courseId = courseId;
    if (studentId) filters.studentId = studentId;
    if (status) filters.status = status;

    const jobs = await ocrJobStore.getUserJobs(req.user._id.toString(), filters);

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

exports.getOCRJobStatus = async (req, res) => {
  try {
    const { jobId } = req.params;

    const job = await ocrJobStore.getJob(jobId);

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

exports.deleteOCRJob = async (req, res) => {
  try {
    const { jobId } = req.params;

    const job = await ocrJobStore.getJob(jobId);

    if (!job || job.userId !== req.user._id.toString()) {
      return res.status(404).json({
        success: false,
        message: 'OCR job not found'
      });
    }

    const bullJobId = job.bullJobId; // Get Bull's auto-generated ID
    await ocrJobStore.deleteJob(jobId);

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

exports.getQueueStatus = async (req, res) => {
  try {
    const healthyWorkers = workerRegistry.getHealthyWorkers();
    
    const waitingCount = await ocrQueue.getWaitingCount();
    const activeCount = await ocrQueue.getActiveCount();
    const completedCount = await ocrQueue.getCompletedCount();
    const failedCount = await ocrQueue.getFailedCount();
    const delayedCount = await ocrQueue.getDelayedCount();
    
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
