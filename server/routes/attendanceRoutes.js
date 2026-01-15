const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../middlewares/authMiddleware');
const { authorizeRoles } = require('../middlewares/roleMiddleware');
const { checkIfFinalized } = require('../middlewares/gradeMiddleware');
const attendanceController = require('../controllers/attendanceController');

// Create or update attendance for a student (Teacher/Admin only)
router.post('/', authenticateUser, authorizeRoles('teacher', 'admin'), checkIfFinalized, attendanceController.createOrUpdateAttendance);

// Bulk save attendance for multiple students (Teacher/Admin only)
router.post('/bulk', authenticateUser, authorizeRoles('teacher', 'admin'), checkIfFinalized, attendanceController.bulkSaveAttendance);

// Get all attendance records for a course (Teacher/Admin only)
router.get('/course/:courseId', authenticateUser, authorizeRoles('teacher', 'admin'), attendanceController.getCourseAttendance);

// Get attendance for a student in a course (Teacher/Student/Admin)
router.get('/:studentId/:courseId', authenticateUser, attendanceController.getStudentAttendance);

// Update attendance record (Teacher/Admin only)
router.put('/:id', authenticateUser, authorizeRoles('teacher', 'admin'), checkIfFinalized, attendanceController.updateAttendance);

// Delete attendance record (Teacher/Admin only)
router.delete('/:id', authenticateUser, authorizeRoles('teacher', 'admin'), checkIfFinalized, attendanceController.deleteAttendance);

module.exports = router;
