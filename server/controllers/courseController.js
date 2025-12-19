const Course = require('../models/Course');
const { validationResult } = require('express-validator');

// @desc    Create a new course
// @route   POST /api/courses
// @access  Admin only
exports.createCourse = async (req, res) => {
  try {
    // Security check - verify admin role
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

    const { courseCode, courseTitle, courseType, credit, department, isPublished } = req.body;

    // Check if course code already exists
    const existingCourse = await Course.findOne({ courseCode: courseCode.toUpperCase() });
    if (existingCourse) {
      return res.status(400).json({
        success: false,
        message: 'Course with this course code already exists'
      });
    }

    // Create course with admin user as creator
    const course = await Course.create({
      courseCode,
      courseTitle,
      courseType,
      credit,
      department,
      createdBy: req.user._id,
      isPublished: isPublished || false
    });

    // Populate creator details
    await course.populate('createdBy', 'name email');

    res.status(201).json({
      success: true,
      message: 'Course created successfully',
      data: course
    });

  } catch (error) {
    console.error('Create course error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error creating course'
    });
  }
};

// @desc    Get all courses
// @route   GET /api/courses
// @access  Admin only
exports.getAllCourses = async (req, res) => {
  try {
    const { department, courseType, isPublished } = req.query;

    // Build filter
    const filter = {};
    if (department) filter.department = department;
    if (courseType) filter.courseType = courseType;
    if (isPublished !== undefined) filter.isPublished = isPublished === 'true';

    const courses = await Course.find(filter)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: courses.length,
      data: courses
    });

  } catch (error) {
    console.error('Get courses error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching courses'
    });
  }
};

// @desc    Get single course
// @route   GET /api/courses/:id
// @access  Admin only
exports.getCourse = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id)
      .populate('createdBy', 'name email');

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    res.status(200).json({
      success: true,
      data: course
    });

  } catch (error) {
    console.error('Get course error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching course'
    });
  }
};

// @desc    Update course
// @route   PUT /api/courses/:id
// @access  Admin only
exports.updateCourse = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }

    const { courseCode, courseTitle, courseType, credit, department, isPublished } = req.body;

    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Check if new course code conflicts with existing course
    if (courseCode && courseCode.toUpperCase() !== course.courseCode) {
      const existingCourse = await Course.findOne({ courseCode: courseCode.toUpperCase() });
      if (existingCourse) {
        return res.status(400).json({
          success: false,
          message: 'Course code already in use'
        });
      }
      course.courseCode = courseCode;
    }

    // Update fields
    if (courseTitle) course.courseTitle = courseTitle;
    if (courseType) course.courseType = courseType;
    if (credit !== undefined) course.credit = credit;
    if (department) course.department = department;
    if (isPublished !== undefined) course.isPublished = isPublished;

    await course.save();
    await course.populate('createdBy', 'name email');

    res.status(200).json({
      success: true,
      message: 'Course updated successfully',
      data: course
    });

  } catch (error) {
    console.error('Update course error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating course'
    });
  }
};

// @desc    Delete course
// @route   DELETE /api/courses/:id
// @access  Admin only
exports.deleteCourse = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    await Course.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Course deleted successfully'
    });

  } catch (error) {
    console.error('Delete course error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting course'
    });
  }
};

// @desc    Toggle course publish status
// @route   PUT /api/courses/:id/toggle-publish
// @access  Admin only
exports.togglePublishStatus = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    course.isPublished = !course.isPublished;
    await course.save();

    res.status(200).json({
      success: true,
      message: `Course ${course.isPublished ? 'published' : 'unpublished'} successfully`,
      data: course
    });

  } catch (error) {
    console.error('Toggle publish error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error toggling publish status'
    });
  }
};
