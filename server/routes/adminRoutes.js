const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticateUser } = require('../middlewares/authMiddleware');
const { authorizeAdmin } = require('../middlewares/roleMiddleware');
const adminController = require('../controllers/adminController');

const upload = multer({ storage: multer.memoryStorage() });

router.use(authenticateUser);
router.use(authorizeAdmin);

router.get('/users/metadata', adminController.getUsersMetadata);
router.get('/users', adminController.getAllUsers);
router.put('/users/:userId/toggle-status', adminController.toggleUserStatus);
router.put('/users/:userId/status', adminController.setUserStatus);
router.put('/users/:userId/designation', adminController.setUserDesignation);
router.put('/users/:userId/department-head', adminController.setDepartmentHead);
router.delete('/users/:userId/department-head', adminController.removeDepartmentHead);
router.delete('/users/:userId', adminController.deleteUser);
router.put('/users/:userId/profile', adminController.updateUserProfile);
router.post('/users/import', upload.single('file'), adminController.importStudentsFromExcel);
router.post('/users/export-credentials', adminController.exportStudentCredentials);
router.post('/teachers/import', upload.single('file'), adminController.importTeachersFromExcel);
router.post('/teachers/export-credentials', adminController.exportTeacherCredentials);
router.get('/students/batches', adminController.getStudentBatches);

router.post('/courses/:courseId/assign-teacher', adminController.assignTeacherToCourse);
router.delete('/courses/:courseId/unassign-teacher/:teacherId', adminController.unassignTeacherFromCourse);
router.get('/courses/:courseId/assigned-teachers', adminController.getAssignedTeachers);

router.post('/courses/:courseId/assign-batch', adminController.assignBatchToCourse);
router.delete('/courses/:courseId/unassign-batch', adminController.unassignBatchFromCourse);
router.get('/courses/:courseId/assigned-batches', adminController.getAssignedBatches);
router.get('/courses/:courseId/students', adminController.getStudentsForCourse);
router.post('/courses/normalize-batches', adminController.normalizeBatchAssignments);

module.exports = router;
