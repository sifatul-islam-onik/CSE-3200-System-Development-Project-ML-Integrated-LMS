const TermExamMarks = require('../models/TermExamMarks');
const Course = require('../models/Course');
const User = require('../models/User');

// @desc    Save or update term exam marks for a student
// @route   POST /api/term-exam-marks
// @access  Teacher
exports.saveTermExamMarks = async (req, res) => {
  try {
    const { studentId, courseId, section, marks, totalMarks, imageUrl } = req.body;

    // Validate required fields
    if (!studentId || !courseId || !marks) {
      return res.status(400).json({
        success: false,
        message: 'Student ID, Course ID, and marks are required'
      });
    }

    // VULN-17: Validate imageUrl to prevent SSRF — only accept base64 data-URIs
    if (imageUrl != null) {
      if (!String(imageUrl).startsWith('data:image/')) {
        return res.status(400).json({
          success: false,
          message: 'imageUrl must be a base64 data URI (data:image/...)'
        });
      }
      if (imageUrl.length > 20 * 1024 * 1024) {
        return res.status(400).json({
          success: false,
          message: 'Image data exceeds the 20 MB limit'
        });
      }
    }

    // Verify course exists
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // For theory courses, section is required
    if (course.course_type === 'THEORY' && !section) {
      return res.status(400).json({
        success: false,
        message: 'Section (A or B) is required for theory courses'
      });
    }

    // Validate section value if provided
    if (section && !['A', 'B'].includes(section)) {
      return res.status(400).json({
        success: false,
        message: 'Section must be A or B'
      });
    }

    // Verify student exists
    const student = await User.findById(studentId);
    if (!student || student.role !== 'student') {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // For teachers, verify they are assigned to this course
    if (req.user.role === 'teacher') {
      const isAssigned = course.assignedTeachers.some(assignment => {
        const teacherId = assignment.teacher?._id || assignment.teacher;
        const matches = teacherId.toString() === req.user._id.toString();
        // If section is provided, also check section match
        if (section && matches) {
          return assignment.section === section;
        }
        return matches;
      });

      if (!isAssigned) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You are not assigned to this course.'
        });
      }
    }

    // Upsert (update if exists, create if doesn't)
    const termExamMarks = await TermExamMarks.findOneAndUpdate(
      { 
        student: studentId, 
        course: courseId,
        section: section || null
      },
      {
        marks,
        totalMarks: totalMarks || 0,
        imageUrl: imageUrl || null,
        enteredBy: req.user._id,
        lastModified: Date.now()
      },
      {
        new: true,
        upsert: true,
        runValidators: true
      }
    );

    res.status(200).json({
      success: true,
      message: 'Marks saved successfully',
      data: termExamMarks
    });

  } catch (error) {
    console.error('Save term exam marks error:', error);
    
    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Marks already exist for this student and course'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error saving marks'
    });
  }
};

// @desc    Get term exam marks for a student in a course
// @route   GET /api/term-exam-marks/:studentId/:courseId
// @access  Teacher/Student
exports.getTermExamMarks = async (req, res) => {
  try {
    const { studentId, courseId } = req.params;
    const { section } = req.query;

    // Students can only view their own marks
    if (req.user.role === 'student' && req.user._id.toString() !== studentId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view your own marks.'
      });
    }

    // For teachers, verify they are assigned to this course
    if (req.user.role === 'teacher') {
      const course = await Course.findById(courseId);
      if (!course) {
        return res.status(404).json({
          success: false,
          message: 'Course not found'
        });
      }

      const isAssigned = course.assignedTeachers.some(assignment => {
        const teacherId = assignment.teacher?._id || assignment.teacher;
        const matches = teacherId.toString() === req.user._id.toString();
        if (section && matches) {
          return assignment.section === section;
        }
        return matches;
      });

      if (!isAssigned) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You are not assigned to this course.'
        });
      }
    }

    const marks = await TermExamMarks.findOne({
      student: studentId,
      course: courseId,
      section: section || null
    })
    .populate('student', 'name roll email')
    .populate('course', 'courseCode courseTitle')
    .populate('enteredBy', 'name email');

    if (!marks) {
      return res.status(404).json({
        success: false,
        message: 'No marks found for this student in this course'
      });
    }

    res.status(200).json({
      success: true,
      data: marks
    });

  } catch (error) {
    console.error('Get term exam marks error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching marks'
    });
  }
};

// @desc    Get all term exam marks for a course
// @route   GET /api/term-exam-marks/course/:courseId
// @access  Teacher
exports.getCourseTermExamMarks = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { section } = req.query;

    // Verify course exists
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // For teachers, verify they are assigned to this course
    if (req.user.role === 'teacher') {
      const isAssigned = course.assignedTeachers.some(assignment => {
        const teacherId = assignment.teacher?._id || assignment.teacher;
        const matches = teacherId.toString() === req.user._id.toString();
        if (section && matches) {
          return assignment.section === section;
        }
        return matches;
      });

      if (!isAssigned) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You are not assigned to this course.'
        });
      }
    }

    const query = { course: courseId };
    if (section) {
      query.section = section;
    }

    const allMarks = await TermExamMarks.find(query)
      .populate('student', 'name roll email')
      .populate('enteredBy', 'name email')
      .sort({ 'student.roll': 1 });

    res.status(200).json({
      success: true,
      count: allMarks.length,
      data: allMarks
    });

  } catch (error) {
    console.error('Get course term exam marks error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching marks'
    });
  }
};

// @desc    Delete term exam marks for a student
// @route   DELETE /api/term-exam-marks/:studentId/:courseId
// @access  Teacher/Admin
exports.deleteTermExamMarks = async (req, res) => {
  try {
    const { studentId, courseId } = req.params;
    const { section } = req.query;

    // Verify course exists
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // For teachers, verify they are assigned to this course
    if (req.user.role === 'teacher') {
      const isAssigned = course.assignedTeachers.some(assignment => {
        const teacherId = assignment.teacher?._id || assignment.teacher;
        const matches = teacherId.toString() === req.user._id.toString();
        if (section && matches) {
          return assignment.section === section;
        }
        return matches;
      });

      if (!isAssigned) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You are not assigned to this course.'
        });
      }
    }

    const marks = await TermExamMarks.findOneAndDelete({
      student: studentId,
      course: courseId,
      section: section || null
    });

    if (!marks) {
      return res.status(404).json({
        success: false,
        message: 'No marks found to delete'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Marks deleted successfully'
    });

  } catch (error) {
    console.error('Delete term exam marks error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting marks'
    });
  }
};
