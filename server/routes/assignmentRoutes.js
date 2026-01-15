const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../middlewares/authMiddleware');
const { authorizeRoles } = require('../middlewares/roleMiddleware');
const { checkIfFinalized } = require('../middlewares/gradeMiddleware');
const assignmentController = require('../controllers/assignmentController');

// Create new assignment (Teacher/Admin only)
router.post('/', authenticateUser, authorizeRoles('teacher', 'admin'), checkIfFinalized, assignmentController.createAssignment);

// Submit/grade assignment for a student (Teacher/Admin only)
router.post('/:id/submit', authenticateUser, authorizeRoles('teacher', 'admin'), assignmentController.submitAssignmentMarks);

// Bulk grade assignments for multiple students (Teacher/Admin only)
router.post('/:id/bulk-grade', authenticateUser, authorizeRoles('teacher', 'admin'), assignmentController.bulkGradeAssignments);

// Get all assignments for a course (Teacher/Admin/Student)
router.get('/course/:courseId', authenticateUser, assignmentController.getCourseAssignments);

// Get all assignments for a student (Teacher/Student/Admin)
router.get('/student/:studentId', authenticateUser, assignmentController.getStudentAssignments);

// Update assignment details (Teacher/Admin only)
router.put('/:id', authenticateUser, authorizeRoles('teacher', 'admin'), assignmentController.updateAssignment);

// Delete assignment (Teacher/Admin only)
router.delete('/:id', authenticateUser, authorizeRoles('teacher', 'admin'), assignmentController.deleteAssignment);

module.exports = router;
