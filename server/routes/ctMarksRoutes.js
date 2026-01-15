const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../middlewares/authMiddleware');
const { authorizeRoles } = require('../middlewares/roleMiddleware');
const { checkIfFinalized } = require('../middlewares/gradeMiddleware');
const ctMarksController = require('../controllers/ctMarksController');

// Create or update CT marks for a student (Teacher/Admin only)
router.post('/', authenticateUser, authorizeRoles('teacher', 'admin'), checkIfFinalized, ctMarksController.createOrUpdateCTMarks);

// Bulk save CT marks for multiple students (Teacher/Admin only)
router.post('/bulk', authenticateUser, authorizeRoles('teacher', 'admin'), checkIfFinalized, ctMarksController.bulkSaveCTMarks);

// Calculate best N-1 CT marks for a student (Teacher/Admin only)
router.post('/calculate-best', authenticateUser, authorizeRoles('teacher', 'admin'), checkIfFinalized, ctMarksController.calculateBestCTs);

// Get CT marks summary/statistics for a course (Teacher/Admin only)
router.get('/course/:courseId/summary', authenticateUser, authorizeRoles('teacher', 'admin'), ctMarksController.getCTMarksSummary);

// Get all CT marks for a course (Teacher/Admin only)
router.get('/course/:courseId', authenticateUser, authorizeRoles('teacher', 'admin'), ctMarksController.getCourseCTMarks);

// Get all CT marks for a student in a course (Teacher/Student/Admin)
router.get('/:studentId/:courseId', authenticateUser, ctMarksController.getStudentCTMarks);

// Delete CT marks (Teacher/Admin only)
router.delete('/:id', authenticateUser, authorizeRoles('teacher', 'admin'), ctMarksController.deleteCTMarks);

module.exports = router;
