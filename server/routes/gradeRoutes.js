const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../middlewares/authMiddleware');
const { authorizeRoles } = require('../middlewares/roleMiddleware');
const gradeController = require('../controllers/gradeController');

// Calculate grades for all students in a course (Teacher/Admin only)
// IMPORTANT: This must come BEFORE the single student route to avoid route collision
router.post('/calculate/course/:courseId', authenticateUser, authorizeRoles('teacher', 'admin'), gradeController.calculateCourseGrades);

// Calculate and save grade for a single student (Teacher/Admin only)
router.post('/calculate/:studentId/:courseId', authenticateUser, authorizeRoles('teacher', 'admin'), gradeController.calculateStudentGrade);

// Finalize all grades for a course (Teacher/Admin only)
router.post('/finalize/:courseId', authenticateUser, authorizeRoles('teacher', 'admin'), gradeController.finalizeGrades);

// Unfinalize a specific grade (Admin only)
router.post('/unfinalize/:gradeId', authenticateUser, authorizeRoles('admin'), gradeController.unfinalizeGrade);

// Get all grades for a course (Teacher/Admin only)
router.get('/course/:courseId', authenticateUser, authorizeRoles('teacher', 'admin'), gradeController.getCourseGrades);

// Check lock status (Teacher/Admin only)
router.get('/status/:courseId', authenticateUser, authorizeRoles('teacher', 'admin'), gradeController.getGradeStatus);

// Get grade for a specific student (Teacher/Student/Admin)
router.get('/:studentId/:courseId', authenticateUser, gradeController.getStudentGrade);

module.exports = router;
