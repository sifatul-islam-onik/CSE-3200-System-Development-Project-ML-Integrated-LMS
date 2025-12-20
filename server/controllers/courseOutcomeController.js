const CourseOutcome = require('../models/CourseOutcome');
const Course = require('../models/Course');
const { validationResult } = require('express-validator');

// @desc    Create course outcomes for a course
// @route   POST /api/courses/:courseId/outcomes
// @access  Admin only
exports.createCourseOutcomes = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }

    const { courseId } = req.params;
    const { outcomes } = req.body; // Array of {co_code, description}

    // Verify course exists
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Validate outcomes array
    if (!Array.isArray(outcomes) || outcomes.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Outcomes must be a non-empty array'
      });
    }

    // Create course outcomes
    const createdOutcomes = [];
    for (const outcome of outcomes) {
      const { co_code, description } = outcome;
      
      if (!co_code || !description) {
        return res.status(400).json({
          success: false,
          message: 'Each outcome must have co_code and description'
        });
      }

      // Check for duplicate CO code within the same course
      const existing = await CourseOutcome.findOne({ 
        course: courseId, 
        co_code: co_code.toUpperCase() 
      });

      if (existing) {
        return res.status(400).json({
          success: false,
          message: `Duplicate CO code: ${co_code}`
        });
      }

      const courseOutcome = await CourseOutcome.create({
        course: courseId,
        co_code,
        description
      });

      createdOutcomes.push(courseOutcome);
    }

    res.status(201).json({
      success: true,
      message: 'Course outcomes created successfully',
      data: createdOutcomes
    });
  } catch (error) {
    console.error('Create course outcomes error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating course outcomes',
      error: error.message
    });
  }
};

// @desc    Get all course outcomes for a course
// @route   GET /api/courses/:courseId/outcomes
// @access  Public
exports.getCourseOutcomes = async (req, res) => {
  try {
    const { courseId } = req.params;

    // Verify course exists
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    const outcomes = await CourseOutcome.find({ course: courseId })
      .sort({ co_code: 1 });

    res.status(200).json({
      success: true,
      data: outcomes
    });
  } catch (error) {
    console.error('Get course outcomes error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching course outcomes',
      error: error.message
    });
  }
};

// @desc    Update a course outcome
// @route   PUT /api/courses/:courseId/outcomes/:outcomeId
// @access  Admin only
exports.updateCourseOutcome = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const { courseId, outcomeId } = req.params;
    const { co_code, description } = req.body;

    const outcome = await CourseOutcome.findOne({
      _id: outcomeId,
      course: courseId
    });

    if (!outcome) {
      return res.status(404).json({
        success: false,
        message: 'Course outcome not found'
      });
    }

    // Check for duplicate CO code if co_code is being updated
    if (co_code && co_code.toUpperCase() !== outcome.co_code) {
      const existing = await CourseOutcome.findOne({
        course: courseId,
        co_code: co_code.toUpperCase(),
        _id: { $ne: outcomeId }
      });

      if (existing) {
        return res.status(400).json({
          success: false,
          message: `CO code ${co_code} already exists for this course`
        });
      }
    }

    if (co_code) outcome.co_code = co_code;
    if (description) outcome.description = description;

    await outcome.save();

    res.status(200).json({
      success: true,
      message: 'Course outcome updated successfully',
      data: outcome
    });
  } catch (error) {
    console.error('Update course outcome error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating course outcome',
      error: error.message
    });
  }
};

// @desc    Delete a course outcome
// @route   DELETE /api/courses/:courseId/outcomes/:outcomeId
// @access  Admin only
exports.deleteCourseOutcome = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const { courseId, outcomeId } = req.params;

    const outcome = await CourseOutcome.findOneAndDelete({
      _id: outcomeId,
      course: courseId
    });

    if (!outcome) {
      return res.status(404).json({
        success: false,
        message: 'Course outcome not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Course outcome deleted successfully'
    });
  } catch (error) {
    console.error('Delete course outcome error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting course outcome',
      error: error.message
    });
  }
};

// @desc    Delete all course outcomes for a course
// @route   DELETE /api/courses/:courseId/outcomes
// @access  Admin only
exports.deleteAllCourseOutcomes = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const { courseId } = req.params;

    // Verify course exists
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    const result = await CourseOutcome.deleteMany({ course: courseId });

    res.status(200).json({
      success: true,
      message: `Deleted ${result.deletedCount} course outcome(s)`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Delete all course outcomes error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting course outcomes',
      error: error.message
    });
  }
};
