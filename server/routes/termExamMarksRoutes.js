const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../middlewares/authMiddleware');
const { authorizeRoles } = require('../middlewares/roleMiddleware');
const { checkIfFinalized } = require('../middlewares/gradeMiddleware');
const termExamMarksController = require('../controllers/termExamMarksController');

// Save/update term exam marks (Teacher/Admin only)
router.post('/', authenticateUser, authorizeRoles('teacher', 'admin'), checkIfFinalized, termExamMarksController.saveTermExamMarks);

// Get all marks for a course (Teacher/Admin) - MUST BE BEFORE /:studentId/:courseId
router.get('/course/:courseId', authenticateUser, authorizeRoles('teacher', 'admin'), termExamMarksController.getCourseTermExamMarks);

// Get marks for specific student in a course (Teacher/Student)
router.get('/:studentId/:courseId', authenticateUser, termExamMarksController.getTermExamMarks);

// Delete marks (Teacher/Admin)
router.delete('/:studentId/:courseId', authenticateUser, authorizeRoles('teacher', 'admin'), checkIfFinalized, termExamMarksController.deleteTermExamMarks);

module.exports = router;

