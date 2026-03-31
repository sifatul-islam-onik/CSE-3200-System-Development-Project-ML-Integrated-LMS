const express = require('express');
const router = express.Router();
const courseProfileController = require('../controllers/courseProfileController');
const { authenticateUser } = require('../middlewares/authMiddleware');
const { authorizeRoles } = require('../middlewares/roleMiddleware');

router.use(authenticateUser);

router.get('/', courseProfileController.getCourseProfile);

router.put(
  '/update',
  authorizeRoles('teacher', 'admin'),
  courseProfileController.updateCLO
);

module.exports = router;
