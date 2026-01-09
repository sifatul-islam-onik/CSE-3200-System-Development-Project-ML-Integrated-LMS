const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticateUser } = require('../middlewares/authMiddleware');
const { authorizeAdmin } = require('../middlewares/roleMiddleware');
const adminController = require('../controllers/adminController');

const upload = multer({ storage: multer.memoryStorage() });

// All routes require authentication and admin role
router.use(authenticateUser);
router.use(authorizeAdmin);

// Admin routes
router.get('/pending-users', adminController.getPendingUsers);
router.put('/approve-user/:userId', adminController.approveUser);
router.put('/reject-user/:userId', adminController.rejectUser);
router.get('/users', adminController.getAllUsers);
router.put('/users/:userId/toggle-status', adminController.toggleUserStatus);
router.put('/users/:userId/status', adminController.setUserStatus);
router.put('/users/:userId/designation', adminController.setUserDesignation);
router.delete('/users/:userId', adminController.deleteUser);
router.post('/users/import', upload.single('file'), adminController.importStudentsFromExcel);
router.post('/users/export-credentials', adminController.exportStudentCredentials);
router.post('/teachers/import', upload.single('file'), adminController.importTeachersFromExcel);
router.post('/teachers/export-credentials', adminController.exportTeacherCredentials);

module.exports = router;
