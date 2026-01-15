const Assignment = require('../models/Assignment');
const Course = require('../models/Course');
const User = require('../models/User');

// @desc    Create a new assignment
// @route   POST /api/assignments
// @access  Teacher/Admin
exports.createAssignment = async (req, res) => {
  try {
    const { courseId, section, academicYear, title, description, assignmentNumber, totalMarks, dueDate, courseOutcomes } = req.body;

    // Validate required fields
    if (!courseId || !academicYear || !title || !assignmentNumber || !totalMarks) {
      return res.status(400).json({
        success: false,
        message: 'Course ID, Academic Year, Title, Assignment Number, and Total Marks are required'
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
          message: 'Access denied. You are not assigned to this course/section.'
        });
      }
    }

    // Check if assignment number already exists for this course/section/year
    const existingAssignment = await Assignment.findOne({
      course: courseId,
      section: section || null,
      academicYear,
      assignmentNumber
    });

    if (existingAssignment) {
      return res.status(400).json({
        success: false,
        message: `Assignment ${assignmentNumber} already exists for this course/section/year`
      });
    }

    // Create assignment
    const assignment = await Assignment.create({
      course: courseId,
      section: section || null,
      academicYear,
      title,
      description,
      assignmentNumber,
      totalMarks,
      dueDate,
      courseOutcomes: courseOutcomes || [],
      submissions: [],
      createdBy: req.user._id
    });

    const populatedAssignment = await Assignment.findById(assignment._id)
      .populate('course', 'courseCode courseTitle')
      .populate('courseOutcomes', 'co_code description')
      .populate('createdBy', 'name email');

    res.status(201).json({
      success: true,
      message: 'Assignment created successfully',
      data: populatedAssignment
    });

  } catch (error) {
    console.error('Create assignment error:', error);

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: Object.values(error.errors).map(e => e.message)
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error creating assignment'
    });
  }
};

// @desc    Update assignment details
// @route   PUT /api/assignments/:id
// @access  Teacher/Admin
exports.updateAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, totalMarks, dueDate, courseOutcomes } = req.body;

    // Find assignment
    const assignment = await Assignment.findById(id).populate('course');
    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Assignment not found'
      });
    }

    // For teachers, verify they are assigned to this course
    if (req.user.role === 'teacher') {
      const course = assignment.course;
      const isAssigned = course.assignedTeachers.some(assignmentTeacher => {
        const teacherId = assignmentTeacher.teacher?._id || assignmentTeacher.teacher;
        const matches = teacherId.toString() === req.user._id.toString();
        if (assignment.section && matches) {
          return assignmentTeacher.section === assignment.section;
        }
        return matches;
      });

      if (!isAssigned) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You are not assigned to this course/section.'
        });
      }
    }

    // Check Finalization Lock
    const FinalGrade = require('../models/FinalGrade');
    const isLocked = await FinalGrade.exists({ 
      course: assignment.course._id || assignment.course, 
      isFinalized: true,
      ...(assignment.section && { section: assignment.section }),
      academicYear: assignment.academicYear
    });

    if (isLocked) {
      return res.status(403).json({
        success: false,
        message: 'Action Blocked: Grades are finalized. Contact Admin to unlock.'
      });
    }

    // Update fields if provided
    if (title !== undefined) assignment.title = title;
    if (description !== undefined) assignment.description = description;
    if (totalMarks !== undefined) assignment.totalMarks = totalMarks;
    if (dueDate !== undefined) assignment.dueDate = dueDate;
    if (courseOutcomes !== undefined) assignment.courseOutcomes = courseOutcomes;

    await assignment.save();

    const updatedAssignment = await Assignment.findById(id)
      .populate('course', 'courseCode courseTitle')
      .populate('courseOutcomes', 'co_code description')
      .populate('createdBy', 'name email');

    res.status(200).json({
      success: true,
      message: 'Assignment updated successfully',
      data: updatedAssignment
    });

  } catch (error) {
    console.error('Update assignment error:', error);

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: Object.values(error.errors).map(e => e.message)
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error updating assignment'
    });
  }
};

// @desc    Delete assignment
// @route   DELETE /api/assignments/:id
// @access  Teacher/Admin
exports.deleteAssignment = async (req, res) => {
  try {
    const { id } = req.params;

    const assignment = await Assignment.findById(id).populate('course');
    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Assignment not found'
      });
    }

    // For teachers, verify they are assigned to this course
    if (req.user.role === 'teacher') {
      const course = assignment.course;
      const isAssigned = course.assignedTeachers.some(assignmentTeacher => {
        const teacherId = assignmentTeacher.teacher?._id || assignmentTeacher.teacher;
        const matches = teacherId.toString() === req.user._id.toString();
        if (assignment.section && matches) {
          return assignmentTeacher.section === assignment.section;
        }
        return matches;
      });

      if (!isAssigned) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You are not assigned to this course/section.'
        });
      }
    }

    // Check Finalization Lock
    const FinalGrade = require('../models/FinalGrade');
    const isLocked = await FinalGrade.exists({ 
      course: assignment.course._id || assignment.course, 
      isFinalized: true,
      ...(assignment.section && { section: assignment.section }),
      academicYear: assignment.academicYear
    });

    if (isLocked) {
      return res.status(403).json({
        success: false,
        message: 'Action Blocked: Grades are finalized. Contact Admin to unlock.'
      });
    }

    await Assignment.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Assignment deleted successfully'
    });

  } catch (error) {
    console.error('Delete assignment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting assignment'
    });
  }
};

// @desc    Submit/grade assignment marks for a student
// @route   POST /api/assignments/:id/submit
// @access  Teacher/Admin
exports.submitAssignmentMarks = async (req, res) => {
  try {
    const { id } = req.params;
    const { studentId, marksObtained, feedback } = req.body;

    // Validate required fields
    if (!studentId || marksObtained === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Student ID and marks obtained are required'
      });
    }

    // Find assignment
    const assignment = await Assignment.findById(id).populate('course');
    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Assignment not found'
      });
    }

    // Validate marks
    if (marksObtained < 0 || marksObtained > assignment.totalMarks) {
      return res.status(400).json({
        success: false,
        message: `Marks must be between 0 and ${assignment.totalMarks}`
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
      const course = assignment.course;
      const isAssigned = course.assignedTeachers.some(assignmentTeacher => {
        const teacherId = assignmentTeacher.teacher?._id || assignmentTeacher.teacher;
        const matches = teacherId.toString() === req.user._id.toString();
        if (assignment.section && matches) {
          return assignmentTeacher.section === assignment.section;
        }
        return matches;
      });

      if (!isAssigned) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You are not assigned to this course/section.'
        });
      }
    }

    // Check Finalization Lock
    const FinalGrade = require('../models/FinalGrade');
    const isLocked = await FinalGrade.exists({ 
      course: assignment.course._id || assignment.course, 
      isFinalized: true,
      ...(assignment.section && { section: assignment.section }),
      academicYear: assignment.academicYear
    });

    if (isLocked) {
      return res.status(403).json({
        success: false,
        message: 'Action Blocked: Grades are finalized. Contact Admin to unlock.'
      });
    }

    // Check if submission already exists
    const existingSubmissionIndex = assignment.submissions.findIndex(
      sub => sub.student.toString() === studentId
    );

    if (existingSubmissionIndex !== -1) {
      // Update existing submission
      assignment.submissions[existingSubmissionIndex].marksObtained = marksObtained;
      assignment.submissions[existingSubmissionIndex].feedback = feedback;
      assignment.submissions[existingSubmissionIndex].gradedBy = req.user._id;
      assignment.submissions[existingSubmissionIndex].gradedAt = Date.now();
    } else {
      // Add new submission
      assignment.submissions.push({
        student: studentId,
        marksObtained,
        submittedAt: Date.now(),
        feedback,
        gradedBy: req.user._id,
        gradedAt: Date.now()
      });
    }

    await assignment.save();

    const updatedAssignment = await Assignment.findById(id)
      .populate('course', 'courseCode courseTitle')
      .populate('submissions.student', 'name roll email')
      .populate('submissions.gradedBy', 'name email');

    res.status(200).json({
      success: true,
      message: 'Assignment marks submitted successfully',
      data: updatedAssignment
    });

  } catch (error) {
    console.error('Submit assignment marks error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error submitting assignment marks'
    });
  }
};

// @desc    Bulk grade assignments for multiple students
// @route   POST /api/assignments/:id/bulk-grade
// @access  Teacher/Admin
exports.bulkGradeAssignments = async (req, res) => {
  try {
    const { id } = req.params;
    const { submissions } = req.body;

    // Validate submissions array
    if (!submissions || !Array.isArray(submissions) || submissions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Submissions array is required and must not be empty'
      });
    }

    // Find assignment
    const assignment = await Assignment.findById(id).populate('course');
    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Assignment not found'
      });
    }

    // Check Finalization Lock
    const FinalGrade = require('../models/FinalGrade');
    const isLocked = await FinalGrade.exists({ 
      course: assignment.course._id || assignment.course, 
      isFinalized: true,
      ...(assignment.section && { section: assignment.section }),
      academicYear: assignment.academicYear
    });

    if (isLocked) {
      return res.status(403).json({
        success: false,
        message: 'Action Blocked: Grades are finalized. Contact Admin to unlock.'
      });
    }

    // For teachers, verify they are assigned to this course
    if (req.user.role === 'teacher') {
      const course = assignment.course;
      const isAssigned = course.assignedTeachers.some(assignmentTeacher => {
        const teacherId = assignmentTeacher.teacher?._id || assignmentTeacher.teacher;
        const matches = teacherId.toString() === req.user._id.toString();
        if (assignment.section && matches) {
          return assignmentTeacher.section === assignment.section;
        }
        return matches;
      });

      if (!isAssigned) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You are not assigned to this course/section.'
        });
      }
    }

    const results = {
      successful: [],
      failed: []
    };

    let gradedCount = 0;

    // Process each submission
    for (const sub of submissions) {
      try {
        const { studentId, marksObtained, feedback } = sub;

        // Skip if no marks provided
        if (marksObtained === undefined || marksObtained === null || marksObtained === '') {
          continue;
        }

        // Validate marks
        const marks = parseFloat(marksObtained);
        if (isNaN(marks) || marks < 0 || marks > assignment.totalMarks) {
          results.failed.push({
            studentId,
            reason: `Invalid marks value (must be 0-${assignment.totalMarks})`
          });
          continue;
        }

        // Check if submission already exists
        const existingSubmissionIndex = assignment.submissions.findIndex(
          s => s.student.toString() === studentId
        );

        if (existingSubmissionIndex !== -1) {
          // Update existing submission
          assignment.submissions[existingSubmissionIndex].marksObtained = marks;
          assignment.submissions[existingSubmissionIndex].feedback = feedback;
          assignment.submissions[existingSubmissionIndex].gradedBy = req.user._id;
          assignment.submissions[existingSubmissionIndex].gradedAt = Date.now();
        } else {
          // Add new submission
          assignment.submissions.push({
            student: studentId,
            marksObtained: marks,
            submittedAt: Date.now(),
            feedback,
            gradedBy: req.user._id,
            gradedAt: Date.now()
          });
        }

        results.successful.push({ studentId });
        gradedCount++;

      } catch (error) {
        results.failed.push({
          studentId: sub.studentId,
          reason: error.message
        });
      }
    }

    await assignment.save();

    res.status(200).json({
      success: true,
      message: `Bulk grading completed. ${results.successful.length} successful, ${results.failed.length} failed.`,
      gradedCount,
      data: results
    });

  } catch (error) {
    console.error('Bulk grade assignments error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during bulk grading'
    });
  }
};

// @desc    Get all assignments for a course
// @route   GET /api/assignments/course/:courseId
// @access  Teacher/Admin/Student
exports.getCourseAssignments = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { section, academicYear } = req.query;

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
          message: 'Access denied. You are not assigned to this course/section.'
        });
      }
    }

    const query = {
      course: courseId
    };

    if (section) {
      query.section = section;
    }

    if (academicYear) {
      query.academicYear = academicYear;
    }

    const assignments = await Assignment.find(query)
      .populate('course', 'courseCode courseTitle')
      .populate('courseOutcomes', 'co_code description')
      .populate('submissions.student', 'name roll email')
      .populate('submissions.gradedBy', 'name email')
      .populate('createdBy', 'name email')
      .sort({ assignmentNumber: 1 });

    res.status(200).json({
      success: true,
      count: assignments.length,
      data: assignments
    });

  } catch (error) {
    console.error('Get course assignments error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching assignments'
    });
  }
};

// @desc    Get assignments for a specific student
// @route   GET /api/assignments/student/:studentId
// @access  Teacher/Student/Admin
exports.getStudentAssignments = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { courseId, section, academicYear } = req.query;

    // Students can only view their own assignments
    if (req.user.role === 'student' && req.user._id.toString() !== studentId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view your own assignments.'
      });
    }

    const query = {};

    if (courseId) {
      query.course = courseId;

      // For teachers, verify they are assigned to the course
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
            message: 'Access denied. You are not assigned to this course/section.'
          });
        }
      }
    }

    if (section) {
      query.section = section;
    }

    if (academicYear) {
      query.academicYear = academicYear;
    }

    // Find all assignments matching the query
    const assignments = await Assignment.find(query)
      .populate('course', 'courseCode courseTitle')
      .populate('courseOutcomes', 'co_code description')
      .populate('createdBy', 'name email')
      .sort({ assignmentNumber: 1 });

    // Filter to only include student's submissions
    const studentAssignments = assignments.map(assignment => {
      const submission = assignment.submissions.find(
        sub => sub.student.toString() === studentId
      );

      return {
        _id: assignment._id,
        course: assignment.course,
        section: assignment.section,
        academicYear: assignment.academicYear,
        title: assignment.title,
        description: assignment.description,
        assignmentNumber: assignment.assignmentNumber,
        totalMarks: assignment.totalMarks,
        dueDate: assignment.dueDate,
        courseOutcomes: assignment.courseOutcomes,
        submission: submission || null,
        createdAt: assignment.createdAt,
        updatedAt: assignment.updatedAt
      };
    });

    res.status(200).json({
      success: true,
      count: studentAssignments.length,
      data: studentAssignments
    });

  } catch (error) {
    console.error('Get student assignments error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching student assignments'
    });
  }
};
