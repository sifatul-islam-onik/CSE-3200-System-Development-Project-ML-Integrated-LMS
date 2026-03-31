const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../middlewares/authMiddleware');
const { authorizeAdmin, authorizeRoles } = require('../middlewares/roleMiddleware');
const {
  computeResults,
  publishResults,
  unpublishResults,
  getBatchResults,
  getBatchCOAttainments,
  getStudentResults,
  getStudentResultsByAdmin,
} = require('../controllers/resultController');

router.post('/compute', authenticateUser, authorizeAdmin, computeResults);

router.post('/publish', authenticateUser, authorizeAdmin, publishResults);

router.post('/unpublish', authenticateUser, authorizeAdmin, unpublishResults);

router.get('/batch', authenticateUser, authorizeAdmin, getBatchResults);

router.get('/batch-co-attainments', authenticateUser, authorizeRoles('admin', 'teacher'), getBatchCOAttainments);

router.get('/student', authenticateUser, authorizeRoles('student', 'admin'), getStudentResults);

router.get('/student/:studentId', authenticateUser, authorizeAdmin, getStudentResultsByAdmin);

module.exports = router;
