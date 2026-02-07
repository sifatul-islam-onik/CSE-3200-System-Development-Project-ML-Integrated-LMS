const express = require('express');
const router = express.Router();
const {
  submitOCRJob,
  getUserOCRJobs,
  getOCRJobStatus,
  deleteOCRJob,
  getQueueStatus
} = require('../controllers/ocrController');
const { authenticateUser } = require('../middlewares/authMiddleware');
const { authorizeRoles } = require('../middlewares/roleMiddleware');

// All routes require authentication
router.use(authenticateUser);

// Submit OCR job (teachers only)
router.post('/submit', authorizeRoles('teacher', 'admin'), submitOCRJob);

// Get all user's OCR jobs
router.get('/jobs', getUserOCRJobs);

// Get specific job status
router.get('/status/:jobId', getOCRJobStatus);

// Get queue status
router.get('/queue-status', getQueueStatus);

// Delete job
router.delete('/jobs/:jobId', deleteOCRJob);

module.exports = router;
