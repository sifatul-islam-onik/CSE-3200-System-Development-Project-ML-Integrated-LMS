const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../middlewares/authMiddleware');
const { authorizeAdmin, authorizeRoles } = require('../middlewares/roleMiddleware');
const {
  computeResults,
  publishResults,
  unpublishResults,
  getBatchResults,
  getStudentResults,
  getStudentResultsByAdmin,
} = require('../controllers/resultController');

// Admin: compute draft results for a batch+term
router.post('/compute', authenticateUser, authorizeAdmin, computeResults);

// Admin: publish computed results
router.post('/publish', authenticateUser, authorizeAdmin, publishResults);

// Admin: unpublish results
router.post('/unpublish', authenticateUser, authorizeAdmin, unpublishResults);

// Admin: get all results for a batch+term (includes drafts)
router.get('/batch', authenticateUser, authorizeAdmin, getBatchResults);

// Student: get own published results
router.get('/student', authenticateUser, authorizeRoles('student', 'admin'), getStudentResults);

// Admin: get any student's results (includes unpublished)
router.get('/student/:studentId', authenticateUser, authorizeAdmin, getStudentResultsByAdmin);

module.exports = router;
