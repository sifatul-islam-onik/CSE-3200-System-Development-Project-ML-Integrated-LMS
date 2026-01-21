const express = require('express');
const router = express.Router();
const courseProfileController = require('../controllers/courseProfileController');
const { authenticateUser } = require('../middlewares/authMiddleware');
const { authorizeRoles } = require('../middlewares/roleMiddleware');

// Protect all routes with authentication
router.use(authenticateUser);

// Get course profile CLO data
router.get('/', courseProfileController.getCourseProfile);

// Update CLO field (teacher and admin only)
router.put(
  '/update',
  authorizeRoles('teacher', 'admin'),
  courseProfileController.updateCLO
);

module.exports = router;
