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
  body('course_type')
    .notEmpty()
    .withMessage('Course type is required')
    .isIn(['THEORY', 'SESSIONAL', 'PROJECT/THESIS'])
    .withMessage('Course type must be THEORY, SESSIONAL, or PROJECT/THESIS'),
  body('credit')
    .notEmpty()
    .withMessage('Credit is required')
    .isNumeric()
    .withMessage('Credit must be a number')
    .custom((value) => value >= 0)
    .withMessage('Credit cannot be negative'),
  body('course_offered_to')
    .trim()
    .notEmpty()
    .withMessage('Course offered to department is required')
    .toUpperCase()
    .isIn(['CSE', 'EEE', 'ME', 'CE', 'ECE', 'IEM', 'ESE', 'BME', 'URP', 'LE', 'TE', 'BECM', 'ARCH', 'MSE', 'CHE', 'MTE'])
    .withMessage('Invalid department code'),
  body('category')
    .notEmpty()
    .withMessage('Category is required')
    .toUpperCase()
    .isIn(['COMPULSORY', 'OPTIONAL'])
    .withMessage('Category must be COMPULSORY or OPTIONAL'),
  body('academicYear')
    .optional()
    .isInt({ min: 1967 })
    .withMessage('Academic year must be a number with minimum value 1967'),
  body('semester')
    .optional()
    .isInt({ min: 1, max: 8 })
    .withMessage('Semester must be an integer between 1 and 8'),
  body('lecture_plan')
    .notEmpty()
    .withMessage('Lecture plan is required')
    .isArray({ min: 1, max: 13 })
    .withMessage('Lecture plan must be an array with 1-13 entries'),
  body('lecture_plan.*.week')
    .isInt({ min: 1, max: 13 })
    .withMessage('Week must be an integer between 1 and 13'),
  body('lecture_plan.*.plan')
    .trim()
    .notEmpty()
    .withMessage('Plan description is required'),
  body('references')
    .notEmpty()
    .withMessage('At least one reference is required')
    .isArray({ min: 1 })
    .withMessage('References must be an array with at least 1 item'),
  body('references.*')
    .trim()
    .notEmpty()
    .withMessage('Reference must not be empty')
];

// All routes require authentication
router.use(authenticateUser);

// Course CRUD routes
router.post('/', authorizeAdmin, courseValidation, courseController.createCourse);
router.get('/', courseController.getAllCourses); // Available to all authenticated users
router.get('/:id', courseController.getCourse); // Available to all authenticated users
router.put('/:id', authorizeAdmin, courseValidation, courseController.updateCourse);
router.delete('/:id', authorizeAdmin, courseController.deleteCourse);

// OBE-specific routes (available to all authenticated users)
router.get('/:id/validate-obe', courseController.validateCourseOBE);
router.get('/curriculum/semester/:semester', courseController.getCurriculumBySemester);

module.exports = router;
