const TermExamMarks = require('../models/TermExamMarks');
const Course = require('../models/Course');
const User = require('../models/User');

// @desc    Save or update term exam marks for a student
// @route   POST /api/term-exam-marks
// @access  Teacher
exports.saveTermExamMarks = async (req, res) => {
  try {
    const { studentId, courseId, section, marks, totalMarks, marksObtained, imageUrl, academicYear } = req.body;

    console.log('=== SAVE TERM EXAM MARKS ===');
    console.log('studentId:', studentId);
    console.log('courseId:', courseId);
    console.log('section:', section);
    console.log('academicYear:', academicYear);
    console.log('marksObtained:', marksObtained);
    console.log('totalMarks (max):', totalMarks);
    console.log('section type:', typeof section);
    console.log('section || null:', section || null);

    // Validate required fields
    if (!studentId || !courseId || !marks) {
      return res.status(400).json({
        success: false,
        message: 'Student ID, Course ID, and marks are required'
      });
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

    // For teachers, verify assignment and restrict to their section
    if (req.user.role === 'teacher') {
      const assignment = course.assignedTeachers.find(a => {
        const teacherId = a.teacher?._id || a.teacher;
        return teacherId.toString() === req.user._id.toString();
      });

      if (!assignment) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You are not assigned to this course.'
        });
      }

      // If assigned to a specific section, force that section check
      if (assignment.section) {
        if (section && section !== assignment.section) {
          return res.status(403).json({
            success: false,
            message: `Access denied. You are only assigned to Section ${assignment.section}.`
          });
        }
      }
    }

    // Upsert (update if exists, create if doesn't)
    const termExamMarks = await TermExamMarks.findOneAndUpdate(
      { 
        student: studentId, 
        course: courseId,
        section: section || null,
        academicYear: academicYear || null
      },
      {
        marks,
        totalMarks: totalMarks || 0,
        marksObtained: marksObtained !== undefined ? marksObtained : (totalMarks || 0), // Use marksObtained if provided, else fallback to totalMarks
        imageUrl: imageUrl || null,
        academicYear: academicYear || null,
        enteredBy: req.user._id,
        lastModified: Date.now()
      },
      {
        new: true,
        upsert: true,
        runValidators: true
      }
    );

    console.log('Saved with query:', { student: studentId, course: courseId, section: section || null });
    console.log('Saved result:', {
      _id: termExamMarks._id,
      section: termExamMarks.section,
      hasMarks: !!termExamMarks.marks
    });

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

    console.log('=== GET TERM EXAM MARKS ===');
    console.log('studentId:', studentId);
    console.log('courseId:', courseId);
    console.log('section (query):', section);
    console.log('section type:', typeof section);
    console.log('section || null:', section || null);

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

      const assignment = course.assignedTeachers.find(a => {
        const teacherId = a.teacher?._id || a.teacher;
        return teacherId.toString() === req.user._id.toString();
      });

      if (!assignment) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You are not assigned to this course.'
        });
      }

      // If teacher is assigned to a specific section, enforce it
      if (assignment.section && section && assignment.section !== section) {
        return res.status(403).json({
          success: false,
          message: `Access denied. You are only assigned to Section ${assignment.section}.`
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

    console.log('Query:', { student: studentId, course: courseId, section: section || null });
    console.log('Found marks:', marks ? 'YES' : 'NO');
    if (marks) {
      console.log('Marks data:', {
        _id: marks._id,
        section: marks.section,
        hasMarks: !!marks.marks
      });
    }

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
    const { section, academicYear } = req.query;

    console.log('[getCourseTermExamMarks] Request:', { courseId, section, academicYear, userId: req.user?._id });

    // Verify course exists
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    const query = { course: courseId };
    if (academicYear) query.academicYear = academicYear;

    // For teachers, verify assignment and restrict to their section
    if (req.user.role === 'teacher') {
      const isAssigned = course.assignedTeachers.some(assign => {
        const teacherId = assign.teacher?._id || assign.teacher;
        const matches = teacherId.toString() === req.user._id.toString();
        // If section is provided in query, and teacher is assigned to a SPECIFIC section, they must match.
        // If teacher is assigned generic (null section), they can access any provided section.
        if (section && matches && assign.section) {
            return assign.section === section;
        }
        return matches;
      });

      if (!isAssigned) {
        console.log('[getCourseTermExamMarks] Teacher not assigned');
        return res.status(403).json({
          success: false,
          message: 'Access denied. You are not assigned to this course/section.'
        });
      }

      // Filter query based on assignment
      // Find the specific assignment for this teacher to determine restrictions
      const assignment = course.assignedTeachers.find(assign => 
        (assign.teacher?._id || assign.teacher).toString() === req.user._id.toString()
      );

      if (assignment?.section) {
        query.section = assignment.section;
      } else if (section) {
        query.section = section;
      }
    } else {
      // Admin/others
      if (section) query.section = section;
    }

    console.log('[getCourseTermExamMarks] Query:', query);

    let allMarks = [];
    try {
      allMarks = await TermExamMarks.find(query)
        .populate('student', 'name roll email')
        .populate('enteredBy', 'name email')
        .sort({ 'student.roll': 1 });
    } catch (populateError) {
      console.error('[getCourseTermExamMarks] Populate error:', populateError);
      // Try without populate if it fails
      allMarks = await TermExamMarks.find(query).sort({ createdAt: -1 });
    }

    console.log('[getCourseTermExamMarks] Found:', allMarks.length, 'records');

    res.status(200).json({
      success: true,
      count: allMarks.length,
      data: allMarks
    });

  } catch (error) {
    console.error('Get course term exam marks error:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Server error fetching marks',
      error: error.message
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
