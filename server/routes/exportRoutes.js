const express = require('express');
const router = express.Router();
const exportController = require('../controllers/exportController');
const { authenticateUser } = require('../middlewares/authMiddleware');
const { authorizeRoles } = require('../middlewares/roleMiddleware');

/**
 * @route   GET /api/export/course/:courseId/marks
 * @desc    Export all marks (CT, Attendance, Assignment, Grades) as Excel
 * @access  Private (Teacher, Admin)
 * @query   section, academicYear
 */
router.get(
  '/course/:courseId/marks',
  authenticateUser,
  authorizeRoles('teacher', 'admin'),
  exportController.exportCourseMarks
);

/**
 * @route   GET /api/export/course/:courseId/:component
 * @desc    Export individual component (ct, attendance, assignment, grades)
 * @access  Private (Teacher, Admin)
 * @query   section, academicYear
 */
router.get(
  '/course/:courseId/:component',
  authenticateUser,
  authorizeRoles('teacher', 'admin'),
  exportController.exportComponent
);

module.exports = router;
