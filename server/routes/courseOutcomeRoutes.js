const express = require('express');
const router = express.Router();
const { 
  createCourseOutcomes,
  getCourseOutcomes,
  updateCourseOutcome,
  deleteCourseOutcome,
  deleteAllCourseOutcomes,
  getCourseProfileData
} = require('../controllers/courseOutcomeController');
const { authenticateUser } = require('../middlewares/authMiddleware');
const { authorizeAdmin } = require('../middlewares/roleMiddleware');

// Course profile route (must be before /:courseId routes)
router.get('/profile/:courseCode', getCourseProfileData);

// Course outcome routes
router.post('/:courseId/outcomes', authenticateUser, authorizeAdmin, createCourseOutcomes);
router.get('/:courseId/outcomes', getCourseOutcomes);
router.put('/:courseId/outcomes/:outcomeId', authenticateUser, updateCourseOutcome);
router.delete('/:courseId/outcomes/:outcomeId', authenticateUser, authorizeAdmin, deleteCourseOutcome);
router.delete('/:courseId/outcomes', authenticateUser, authorizeAdmin, deleteAllCourseOutcomes);

module.exports = router;
