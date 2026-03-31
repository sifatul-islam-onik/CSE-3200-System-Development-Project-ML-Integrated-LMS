const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../middlewares/authMiddleware');
const { authorizeRoles } = require('../middlewares/roleMiddleware');
const termExamMarksController = require('../controllers/termExamMarksController');

router.post('/', authenticateUser, authorizeRoles('teacher', 'admin'), termExamMarksController.saveTermExamMarks);

router.get('/:studentId/:courseId', authenticateUser, termExamMarksController.getTermExamMarks);

router.get('/course/:courseId', authenticateUser, authorizeRoles('teacher', 'admin'), termExamMarksController.getCourseTermExamMarks);

router.delete('/:studentId/:courseId', authenticateUser, authorizeRoles('teacher', 'admin'), termExamMarksController.deleteTermExamMarks);

module.exports = router;

