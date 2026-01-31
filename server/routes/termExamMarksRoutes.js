const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../middlewares/authMiddleware');
const { authorizeRoles } = require('../middlewares/roleMiddleware');
const termExamMarksController = require('../controllers/termExamMarksController');

// Save/update term exam marks (Teacher/Admin only)
router.post('/', authenticateUser, authorizeRoles('teacher', 'admin'), termExamMarksController.saveTermExamMarks);

// Get marks for specific student in a course (Teacher/Student)
router.get('/:studentId/:courseId', authenticateUser, termExamMarksController.getTermExamMarks);

// Get all marks for a course (Teacher/Admin)
router.get('/course/:courseId', authenticateUser, authorizeRoles('teacher', 'admin'), termExamMarksController.getCourseTermExamMarks);

// Delete marks (Teacher/Admin)
router.delete('/:studentId/:courseId', authenticateUser, authorizeRoles('teacher', 'admin'), termExamMarksController.deleteTermExamMarks);

module.exports = router;

