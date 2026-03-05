const express = require('express');
const router = express.Router();
const multer = require('multer');
const attainmentController = require('../controllers/attainmentController');
const { authenticateUser } = require('../middlewares/authMiddleware');
const { authorizeRoles } = require('../middlewares/roleMiddleware');
const { cacheMiddleware, invalidateCacheMiddleware, CACHE_DURATION } = require('../middlewares/cacheMiddleware');

const ctUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = file.originalname.toLowerCase();
    const allowedMimes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
      'application/csv',
    ];
    if (allowedMimes.includes(file.mimetype) || ext.endsWith('.xlsx') || ext.endsWith('.xls') || ext.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only Excel and CSV files are allowed.'));
    }
  }
});

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

// Parse CT Excel/CSV upload and return structured data (teacher only)
router.post(
  '/ct/:courseId/parse-upload',
  authorizeRoles('teacher', 'admin'),
  ctUpload.single('file'),
  attainmentController.parseCTUpload
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

// Parse Assignment Excel/CSV upload (teacher only)
router.post(
  '/assignment/:courseId/parse-upload',
  authorizeRoles('teacher', 'admin'),
  ctUpload.single('file'),
  attainmentController.parseAssignUpload
);

// Save Assignment/Attendance attainment data (teacher only)
router.post(
  '/assignment/:courseId',
  authorizeRoles('teacher', 'admin'),
  invalidateCacheMiddleware((req) => `assignment_${req.params.courseId}`),
  attainmentController.saveAssignmentData
);

// Get Assignment/Attendance attainment data
router.get(
  '/assignment/:courseId',
  cacheMiddleware(CACHE_DURATION.SHORT, (req) => `assignment_${req.params.courseId}`),
  attainmentController.getAssignmentData
);

// Parse Lab Activity Excel/CSV upload (teacher only)
router.post(
  '/labactivity/:courseId/parse-upload',
  authorizeRoles('teacher', 'admin'),
  ctUpload.single('file'),
  attainmentController.parseLabUpload
);

// Save Lab Activity attainment data (teacher only)
router.post(
  '/labactivity/:courseId',
  authorizeRoles('teacher', 'admin'),
  invalidateCacheMiddleware((req) => `labactivity_${req.params.courseId}`),
  attainmentController.saveLabActivityData
);

// Get Lab Activity attainment data
router.get(
  '/labactivity/:courseId',
  cacheMiddleware(CACHE_DURATION.SHORT, (req) => `labactivity_${req.params.courseId}`),
  attainmentController.getLabActivityData
);

// Save Section A attainment data (teacher only)
router.post(
  '/section-a/:courseId',
  authorizeRoles('teacher', 'admin'),
  invalidateCacheMiddleware((req) => `section-a_${req.params.courseId}`),
  attainmentController.saveSectionAData
);

// Get Section A attainment data
router.get(
  '/section-a/:courseId',
  cacheMiddleware(CACHE_DURATION.SHORT, (req) => `section-a_${req.params.courseId}`),
  attainmentController.getSectionAData
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
