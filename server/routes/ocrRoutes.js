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

router.use(authenticateUser);

router.post('/submit', authorizeRoles('teacher', 'admin'), submitOCRJob);

router.get('/jobs', getUserOCRJobs);

router.get('/status/:jobId', getOCRJobStatus);

router.get('/queue-status', getQueueStatus);

router.delete('/jobs/:jobId', deleteOCRJob);

module.exports = router;
