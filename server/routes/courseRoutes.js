const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { authenticateUser } = require('../middlewares/authMiddleware');
const { authorizeAdmin } = require('../middlewares/roleMiddleware');
const courseController = require('../controllers/courseController');

// Validation middleware for course creation/update
const courseValidation = [
  body('courseCode')
    .trim()
    .notEmpty()
    .withMessage('Course code is required')
    .isLength({ min: 2, max: 20 })
    .withMessage('Course code must be between 2 and 20 characters'),
  body('courseTitle')
    .trim()
    .notEmpty()
    .withMessage('Course title is required')
    .isLength({ min: 3 })
    .withMessage('Course title must be at least 3 characters'),
  body('courseType')
    .notEmpty()
    .withMessage('Course type is required')
    .isIn(['Core', 'Optional', 'Lab'])
    .withMessage('Course type must be Core, Optional, or Lab'),
  body('credit')
    .notEmpty()
    .withMessage('Credit is required')
    .isNumeric()
    .withMessage('Credit must be a number')
    .custom((value) => value >= 0)
    .withMessage('Credit cannot be negative'),
  body('department')
    .trim()
    .notEmpty()
    .withMessage('Department is required')
];

// All routes require authentication and admin role
router.use(authenticateUser);
router.use(authorizeAdmin);

// Course CRUD routes
router.post('/', courseValidation, courseController.createCourse);
router.get('/', courseController.getAllCourses);
router.get('/:id', courseController.getCourse);
router.put('/:id', courseValidation, courseController.updateCourse);
router.delete('/:id', courseController.deleteCourse);
router.put('/:id/toggle-publish', courseController.togglePublishStatus);

module.exports = router;
