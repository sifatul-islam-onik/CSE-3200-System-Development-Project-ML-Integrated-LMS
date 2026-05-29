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

router.use(authenticateUser);

router.get('/sheets',
  cacheMiddleware(CACHE_DURATION.MEDIUM, (req) => `sheets_${req.user._id}`),
  attainmentController.getSheets
);

router.post(
  '/ct/:courseId/parse-upload',
  authorizeRoles('teacher', 'admin'),
  ctUpload.single('file'),
  attainmentController.parseCTUpload
);

router.post(
  '/ct/:courseId',
  authorizeRoles('teacher', 'admin'),
  invalidateCacheMiddleware((req) => `ct_${req.params.courseId}`),
  attainmentController.saveCTData
);

router.get(
  '/ct/:courseId',
  cacheMiddleware(CACHE_DURATION.SHORT, (req) => `ct_${req.params.courseId}`),
  attainmentController.getCTData
);

router.post(
  '/assignment/:courseId/parse-upload',
  authorizeRoles('teacher', 'admin'),
  ctUpload.single('file'),
  attainmentController.parseAssignUpload
);

router.post(
  '/assignment/:courseId',
  authorizeRoles('teacher', 'admin'),
  invalidateCacheMiddleware((req) => `assignment_${req.params.courseId}`),
  attainmentController.saveAssignmentData
);

router.get(
  '/assignment/:courseId',
  cacheMiddleware(CACHE_DURATION.SHORT, (req) => `assignment_${req.params.courseId}`),
  attainmentController.getAssignmentData
);

router.post(
  '/labactivity/:courseId/parse-upload',
  authorizeRoles('teacher', 'admin'),
  ctUpload.single('file'),
  attainmentController.parseLabUpload
);

router.post(
  '/labactivity/:courseId',
  authorizeRoles('teacher', 'admin'),
  invalidateCacheMiddleware((req) => `labactivity_${req.params.courseId}`),
  attainmentController.saveLabActivityData
);

router.get(
  '/labactivity/:courseId',
  cacheMiddleware(CACHE_DURATION.SHORT, (req) => `labactivity_${req.params.courseId}`),
  attainmentController.getLabActivityData
);

router.post(
  '/section-a/:courseId',
  authorizeRoles('teacher', 'admin'),
  invalidateCacheMiddleware((req) => `section-a_${req.params.courseId}`),
  attainmentController.saveSectionAData
);

router.get(
  '/section-a/:courseId',
  cacheMiddleware(CACHE_DURATION.SHORT, (req) => `section-a_${req.params.courseId}`),
  attainmentController.getSectionAData
);

router.get(
  '/term/:courseId',
  cacheMiddleware(CACHE_DURATION.SHORT, (req) => `term_${req.params.courseId}_${req.query.section || 'all'}`),
  attainmentController.getTermExamMarks
);

router.get(
  '/co-calcs/:courseId',
  authorizeRoles('teacher', 'admin'),
  attainmentController.getCoAttainmentCalcs
);

router.delete(
  '/reset/:courseId',
  authorizeRoles('teacher', 'admin'),
  invalidateCacheMiddleware((req) => `ct_${req.params.courseId}`),
  invalidateCacheMiddleware((req) => `assignment_${req.params.courseId}`),
  invalidateCacheMiddleware((req) => `labactivity_${req.params.courseId}`),
  attainmentController.resetAttainmentData
);

router.get('/:sheetName?', attainmentController.getAttainmentData);

module.exports = router;
