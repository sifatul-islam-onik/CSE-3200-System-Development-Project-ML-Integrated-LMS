const OCRJob = require('../models/OCRJob');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const ML_SERVER_URL = process.env.ML_SERVER_URL || 'http://localhost:8000';

// @desc    Submit OCR job
// @route   POST /api/ocr/submit
// @access  Private (Teacher)
exports.submitOCRJob = async (req, res) => {
  try {
    const { studentId, courseId, section, imageUrl } = req.body;
    
    console.log('\n========== NEW OCR JOB SUBMISSION ==========');
    console.log('User ID:', req.user._id);
    console.log('Student ID:', studentId);
    console.log('Course ID:', courseId);
    console.log('Section:', section);
    console.log('Image URL length:', imageUrl?.length || 0);
    console.log('Image URL prefix:', imageUrl?.substring(0, 50) || 'N/A');

    if (!studentId || !courseId || !imageUrl) {
      console.log('✗ Validation failed - missing required fields');
      return res.status(400).json({
        success: false,
        message: 'Student ID, Course ID, and image URL are required'
      });
    }

    // Generate unique job ID
    const jobId = uuidv4();
    console.log('Generated Job ID:', jobId);

    // Create OCR job in database
    console.log('Creating OCR job in database...');
    const ocrJob = await OCRJob.create({
      jobId,
      user: req.user._id,
      student: studentId,
      course: courseId,
      section: section || null,
      imageUrl,
      status: 'pending',
      progress: 0
    });
    console.log('✓ OCR job created in database:', ocrJob._id);

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
    console.log('✓ 202 response sent to client');

    // Process OCR in background (non-blocking)
    console.log('Starting background processing...');
    processOCRJobInBackground(ocrJob.jobId, imageUrl);

  } catch (error) {
    console.error('✗ Submit OCR job error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Server error submitting OCR job'
    });
  }
};

// Background OCR processing
async function processOCRJobInBackground(jobId, imageUrl) {
  console.log(`\n========== OCR JOB ${jobId} STARTED ==========`);
  console.log(`[${jobId}] Image URL type:`, imageUrl.substring(0, 50) + '...');
  
  try {
    // Update status to processing
    console.log(`[${jobId}] Step 1: Updating status to processing...`);
    await OCRJob.findOneAndUpdate(
      { jobId },
      { status: 'processing', startedAt: new Date(), progress: 10 }
    );
    console.log(`[${jobId}] ✓ Status updated to processing`);

    // Convert image URL to blob/buffer
    console.log(`[${jobId}] Step 2: Converting image to buffer...`);
    let imageBlob;
    if (imageUrl.startsWith('data:')) {
      // Data URL
      console.log(`[${jobId}] - Image is base64 data URL`);
      const base64Data = imageUrl.split(',')[1];
      if (!base64Data) {
        throw new Error('Invalid base64 data - missing data after comma');
      }
      imageBlob = Buffer.from(base64Data, 'base64');
      console.log(`[${jobId}] - Buffer size: ${imageBlob.length} bytes`);
    } else if (imageUrl.startsWith('http')) {
      // HTTP URL
      console.log(`[${jobId}] - Image is HTTP URL: ${imageUrl}`);
      const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      imageBlob = Buffer.from(response.data);
      console.log(`[${jobId}] - Downloaded ${imageBlob.length} bytes`);
    } else {
      throw new Error(`Invalid image URL format. Starts with: ${imageUrl.substring(0, 20)}`);
    }
    console.log(`[${jobId}] ✓ Image converted to buffer successfully`);

    // Update progress
    await OCRJob.findOneAndUpdate({ jobId }, { progress: 30 });
    console.log(`[${jobId}] Progress: 30%`);

    // Send to ML server
    console.log(`[${jobId}] Step 3: Preparing to send to ML server...`);
    console.log(`[${jobId}] ML Server URL: ${ML_SERVER_URL}/api/extract-marks`);
    
    const FormData = require('form-data');
    const formData = new FormData();
    formData.append('image', imageBlob, { filename: 'answer-sheet.jpg' });
    console.log(`[${jobId}] - FormData created with image`);

    await OCRJob.findOneAndUpdate({ jobId }, { progress: 50 });
    console.log(`[${jobId}] Progress: 50%`);

    console.log(`[${jobId}] Step 4: Sending POST request to ML server...`);
    const mlResponse = await axios.post(`${ML_SERVER_URL}/api/extract-marks`, formData, {
      headers: formData.getHeaders(),
      timeout: 120000 // 2 minutes timeout
    });
    console.log(`[${jobId}] ✓ ML server responded with status: ${mlResponse.status}`);
    console.log(`[${jobId}] ML Response data:`, JSON.stringify(mlResponse.data, null, 2));

    await OCRJob.findOneAndUpdate({ jobId }, { progress: 90 });
    console.log(`[${jobId}] Progress: 90%`);

    if (mlResponse.data.success && mlResponse.data.marks) {
      console.log(`[${jobId}] Step 5: Processing successful response...`);
      // Update job with results
      await OCRJob.findOneAndUpdate(
        { jobId },
        {
          status: 'completed',
          marks: mlResponse.data.marks,
          confidence: mlResponse.data.confidence,
          rawTable: mlResponse.data.raw_table,
          progress: 100,
          completedAt: new Date()
        }
      );
      console.log(`[${jobId}] ✓✓✓ OCR job COMPLETED successfully ✓✓✓`);
      console.log(`========== OCR JOB ${jobId} FINISHED ==========\n`);
    } else {
      throw new Error(mlResponse.data.message || 'OCR extraction failed - no marks in response');
    }

  } catch (error) {
    console.error(`\n[${jobId}] ✗✗✗ OCR job FAILED ✗✗✗`);
    console.error(`[${jobId}] Error name: ${error.name}`);
    console.error(`[${jobId}] Error message: ${error.message}`);
    console.error(`[${jobId}] Error stack:`, error.stack);
    
    if (error.response) {
      console.error(`[${jobId}] ML Server response status: ${error.response.status}`);
      console.error(`[${jobId}] ML Server response data:`, error.response.data);
    }
    
    if (error.code) {
      console.error(`[${jobId}] Error code: ${error.code}`);
    }
    
    await OCRJob.findOneAndUpdate(
      { jobId },
      {
        status: 'failed',
        error: error.message,
        progress: 0,
        completedAt: new Date()
      }
    );
    console.error(`========== OCR JOB ${jobId} FAILED ==========\n`);
  }
}

// @desc    Get all OCR jobs for logged-in user
// @route   GET /api/ocr/jobs
// @access  Private
exports.getUserOCRJobs = async (req, res) => {
  try {
    const { courseId, studentId, status } = req.query;

    const query = { user: req.user._id };
    
    if (courseId) query.course = courseId;
    if (studentId) query.student = studentId;
    if (status) query.status = status;

    const jobs = await OCRJob.find(query)
      .populate('student', 'name roll')
      .populate('course', 'courseCode courseTitle')
      .sort({ createdAt: -1 })
      .limit(100);

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

    const job = await OCRJob.findOne({ jobId, user: req.user._id })
      .populate('student', 'name roll')
      .populate('course', 'courseCode courseTitle');

    if (!job) {
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

    const job = await OCRJob.findOneAndDelete({ jobId, user: req.user._id });

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'OCR job not found'
      });
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
