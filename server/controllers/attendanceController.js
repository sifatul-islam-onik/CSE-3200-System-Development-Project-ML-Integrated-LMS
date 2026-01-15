const Attendance = require('../models/Attendance');
const Course = require('../models/Course');
const User = require('../models/User');

// @desc    Create or update attendance for a student
// @route   POST /api/attendance
// @access  Teacher/Admin
exports.createOrUpdateAttendance = async (req, res) => {
  try {
    const { studentId, courseId, section, academicYear, totalClasses, attendedClasses, marksAwarded, totalMarks } = req.body;

    // Validate required fields
    if (!studentId || !courseId || !academicYear || totalClasses === undefined || attendedClasses === undefined || marksAwarded === undefined || !totalMarks) {
      return res.status(400).json({
        success: false,
        message: 'Student ID, Course ID, Academic Year, Total Classes, Attended Classes, Marks Awarded, and Total Marks are required'
      });
    }

    // Validate values
    if (totalClasses < 0 || attendedClasses < 0 || marksAwarded < 0 || totalMarks < 0) {
      return res.status(400).json({
        success: false,
        message: 'Values cannot be negative'
      });
    }

    if (attendedClasses > totalClasses) {
      return res.status(400).json({
        success: false,
        message: 'Attended classes cannot exceed total classes'
      });
    }

    if (marksAwarded > totalMarks) {
      return res.status(400).json({
        success: false,
        message: 'Marks awarded cannot exceed total marks'
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
          message: 'Access denied. You are not assigned to this course/section.'
        });
      }
    }

    // Upsert (update if exists, create if doesn't)
    const attendance = await Attendance.findOneAndUpdate(
      { 
        student: studentId, 
        course: courseId,
        section: section || null,
        academicYear: academicYear
      },
      {
        totalClasses,
        attendedClasses,
        marksAwarded,
        totalMarks,
        enteredBy: req.user._id,
        lastModified: Date.now()
      },
      {
        new: true,
        upsert: true,
        runValidators: true
      }
    )
    .populate('student', 'name roll email')
    .populate('course', 'courseCode courseTitle')
    .populate('enteredBy', 'name email');

    res.status(200).json({
      success: true,
      message: 'Attendance saved successfully',
      data: attendance
    });

  } catch (error) {
    console.error('Create/Update attendance error:', error);
    
    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Attendance record already exists for this student, course, section, and academic year'
      });
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: Object.values(error.errors).map(e => e.message)
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error saving attendance'
    });
  }
};

// @desc    Bulk save attendance for multiple students
// @route   POST /api/attendance/bulk
// @access  Teacher/Admin
exports.bulkSaveAttendance = async (req, res) => {
  try {
    const { marks } = req.body;

    console.log('\n=== BULK SAVE ATTENDANCE ===');
    console.log('User:', req.user._id, 'Role:', req.user.role);
    console.log('Number of records:', marks?.length);
    console.log('Sample record:', marks?.[0]);

    // Validate marks array
    if (!marks || !Array.isArray(marks) || marks.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Marks array is required and must not be empty'
      });
    }

    const results = {
      successful: [],
      failed: []
    };

    let savedCount = 0;

    // Process each student's attendance
    for (const attendanceMark of marks) {
      try {
        const { student, course, section, academicYear, totalClasses, attendedClasses, marksAwarded, totalMarks, assignments } = attendanceMark;

        // Validate required fields
        if (!student || !course || !academicYear || totalClasses === undefined || attendedClasses === undefined || marksAwarded === undefined || !totalMarks) {
          results.failed.push({
            student,
            reason: 'Missing required fields'
          });
          continue;
        }

        // Verify course exists (check once per course to optimize)
        const courseDoc = await Course.findById(course);
        if (!courseDoc) {
          results.failed.push({
            student,
            reason: 'Course not found'
          });
          continue;
        }

        // For theory courses, section is required
        if (courseDoc.course_type === 'THEORY' && !section) {
          results.failed.push({
            student,
            reason: 'Section required for theory course'
          });
          continue;
        }

        // For teachers, verify they are assigned to this course
        if (req.user.role === 'teacher') {
          const isAssigned = courseDoc.assignedTeachers.some(assignment => {
            const teacherId = assignment.teacher?._id || assignment.teacher;
            const matches = teacherId.toString() === req.user._id.toString();
            if (section && matches) {
              return assignment.section === section;
            }
            return matches;
          });

          if (!isAssigned) {
            results.failed.push({
              student,
              reason: 'Teacher not assigned to course/section'
            });
            continue;
          }
        }

        // Validate values
        if (attendedClasses > totalClasses) {
          results.failed.push({
            student,
            reason: 'Attended classes exceeds total classes'
          });
          continue;
        }

        if (marksAwarded > totalMarks) {
          results.failed.push({
            student,
            reason: 'Marks awarded exceeds total marks'
          });
          continue;
        }

        // Upsert attendance
        const updateData = {
          totalClasses,
          attendedClasses,
          marksAwarded,
          totalMarks,
          enteredBy: req.user._id,
          lastModified: Date.now()
        };
        
        // Include assignments if provided
        if (assignments && Array.isArray(assignments)) {
          updateData.assignments = assignments;
        }
        
        const attendance = await Attendance.findOneAndUpdate(
          { 
            student, 
            course,
            section: section || null,
            academicYear
          },
          updateData,
          {
            new: true,
            upsert: true,
            runValidators: true
          }
        );

        results.successful.push({
          student,
          attendanceId: attendance._id
        });
        savedCount++;

      } catch (error) {
        results.failed.push({
          student: attendanceMark.student,
          reason: error.message
        });
      }
    }

    console.log('Bulk save results:');
    console.log('Successful:', results.successful.length);
    console.log('Failed:', results.failed.length);
    if (results.failed.length > 0) {
      console.log('Failed records:', results.failed);
    }
    console.log('=== END BULK SAVE ATTENDANCE ===\n');

    res.status(200).json({
      success: true,
      message: `Bulk save completed. ${results.successful.length} successful, ${results.failed.length} failed.`,
      savedCount,
      data: results
    });

  } catch (error) {
    console.error('Bulk save attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during bulk save'
    });
  }
};

// @desc    Get attendance for a student in a course
// @route   GET /api/attendance/:studentId/:courseId
// @access  Teacher/Student/Admin
exports.getStudentAttendance = async (req, res) => {
  try {
    const { studentId, courseId } = req.params;
    const { section, academicYear } = req.query;

    // Students can only view their own attendance
    if (req.user.role === 'student' && req.user._id.toString() !== studentId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view your own attendance.'
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
          message: 'Access denied. You are not assigned to this course/section.'
        });
      }
    }

    const query = {
      student: studentId,
      course: courseId
    };

    if (section) {
      query.section = section;
    }

    if (academicYear) {
      query.academicYear = academicYear;
    }

    const attendance = await Attendance.findOne(query)
      .populate('student', 'name roll email')
      .populate('course', 'courseCode courseTitle')
      .populate('enteredBy', 'name email');

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: 'Attendance record not found'
      });
    }

    res.status(200).json({
      success: true,
      data: attendance
    });

  } catch (error) {
    console.error('Get student attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching attendance'
    });
  }
};

// @desc    Get all attendance records for a course
// @route   GET /api/attendance/course/:courseId
// @access  Teacher/Admin
exports.getCourseAttendance = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { section, academicYear } = req.query;

    console.log('\n=== GET COURSE ATTENDANCE ===');
    console.log('Course ID:', courseId);
    console.log('Section filter:', section);
    console.log('Academic Year filter:', academicYear);
    console.log('User:', req.user._id, 'Role:', req.user.role);

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

    const attendanceRecords = await Attendance.find(query)
      .populate('student', 'name roll email')
      .populate('course', 'courseCode courseTitle')
      .populate('enteredBy', 'name email')
      .sort({ 'student.roll': 1 });

    console.log('Query:', JSON.stringify(query));
    console.log('Found records:', attendanceRecords.length);
    if (attendanceRecords.length > 0) {
      console.log('Sample record:', {
        student: attendanceRecords[0].student?.roll,
        section: attendanceRecords[0].section,
        academicYear: attendanceRecords[0].academicYear,
        marksAwarded: attendanceRecords[0].marksAwarded,
        totalMarks: attendanceRecords[0].totalMarks
      });
    }
    console.log('=== END GET COURSE ATTENDANCE ===\n');

    res.status(200).json({
      success: true,
      count: attendanceRecords.length,
      data: attendanceRecords
    });

  } catch (error) {
    console.error('Get course attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching attendance'
    });
  }
};

// @desc    Update attendance record
// @route   PUT /api/attendance/:id
// @access  Teacher/Admin
exports.updateAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const { totalClasses, attendedClasses, marksAwarded, totalMarks } = req.body;

    // Find existing attendance record
    const attendance = await Attendance.findById(id).populate('course');
    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: 'Attendance record not found'
      });
    }

    // For teachers, verify they are assigned to this course
    if (req.user.role === 'teacher') {
      const course = attendance.course;
      const isAssigned = course.assignedTeachers.some(assignment => {
        const teacherId = assignment.teacher?._id || assignment.teacher;
        const matches = teacherId.toString() === req.user._id.toString();
        if (attendance.section && matches) {
          return assignment.section === attendance.section;
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

    // Update fields if provided
    if (totalClasses !== undefined) attendance.totalClasses = totalClasses;
    if (attendedClasses !== undefined) attendance.attendedClasses = attendedClasses;
    if (marksAwarded !== undefined) attendance.marksAwarded = marksAwarded;
    if (totalMarks !== undefined) attendance.totalMarks = totalMarks;
    
    attendance.enteredBy = req.user._id;
    attendance.lastModified = Date.now();

    await attendance.save();

    const updatedAttendance = await Attendance.findById(id)
      .populate('student', 'name roll email')
      .populate('course', 'courseCode courseTitle')
      .populate('enteredBy', 'name email');

    res.status(200).json({
      success: true,
      message: 'Attendance updated successfully',
      data: updatedAttendance
    });

  } catch (error) {
    console.error('Update attendance error:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: Object.values(error.errors).map(e => e.message)
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error updating attendance'
    });
  }
};

// @desc    Delete attendance record
// @route   DELETE /api/attendance/:id
// @access  Teacher/Admin
exports.deleteAttendance = async (req, res) => {
  try {
    const { id } = req.params;

    const attendance = await Attendance.findById(id).populate('course');
    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: 'Attendance record not found'
      });
    }

    // For teachers, verify they are assigned to this course
    if (req.user.role === 'teacher') {
      const course = attendance.course;
      const isAssigned = course.assignedTeachers.some(assignment => {
        const teacherId = assignment.teacher?._id || assignment.teacher;
        const matches = teacherId.toString() === req.user._id.toString();
        if (attendance.section && matches) {
          return assignment.section === attendance.section;
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

    await Attendance.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Attendance record deleted successfully'
    });

  } catch (error) {
    console.error('Delete attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting attendance'
    });
  }
};
