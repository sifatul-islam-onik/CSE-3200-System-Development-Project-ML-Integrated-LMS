const express = require('express');
const router = express.Router();
const attainmentController = require('../controllers/attainmentController');
const { authenticateUser } = require('../middlewares/authMiddleware');
const { authorizeRoles } = require('../middlewares/roleMiddleware');
const { cacheMiddleware, invalidateCacheMiddleware, CACHE_DURATION } = require('../middlewares/cacheMiddleware');

// Protect all routes with authentication
router.use(authenticateUser);

// Get list of all sheet names (must come before /:sheetName? route)
router.get('/sheets', 
  cacheMiddleware(CACHE_DURATION.MEDIUM, (req) => `sheets_${req.user._id}`),
  attainmentController.getSheets
);

// Update single student PO value (teacher only)
router.put(
  '/update',
  authorizeRoles('teacher', 'admin'),
  attainmentController.updateStudentPoValue
);

// Batch update student PO values (teacher only)
router.put(
  '/batch-update',
  authorizeRoles('teacher', 'admin'),
  attainmentController.batchUpdateStudentPoValues
);

// Save CT attainment data (teacher only)
router.post(
  '/ct/:courseId',
  authorizeRoles('teacher', 'admin'),
  invalidateCacheMiddleware((req) => `ct_${req.params.courseId}`),
  attainmentController.saveCTData
);

// Get CT attainment data
router.get(
  '/ct/:courseId',
  cacheMiddleware(CACHE_DURATION.SHORT, (req) => `ct_${req.params.courseId}`),
  attainmentController.getCTData
);

// Get term exam marks for attainment
router.get(
  '/term/:courseId',
  cacheMiddleware(CACHE_DURATION.SHORT, (req) => `term_${req.params.courseId}_${req.query.section || 'all'}`),
  attainmentController.getTermExamMarks
);

// Get attainment data (default sheet or specific sheet) - must come last
router.get('/:sheetName?', attainmentController.getAttainmentData);

module.exports = router;
