const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../middlewares/authMiddleware');
const { authorizeRoles } = require('../middlewares/roleMiddleware');
const copoAttainmentController = require('../controllers/copoAttainmentController');

// Get CO attainment for a course
router.get('/co-attainment/course/:courseId', authenticateUser, authorizeRoles('teacher', 'admin'), copoAttainmentController.getCOAttainment);

// Get PO attainment for a course
router.get('/po-attainment/course/:courseId', authenticateUser, authorizeRoles('teacher', 'admin'), copoAttainmentController.getPOAttainment);

module.exports = router;
