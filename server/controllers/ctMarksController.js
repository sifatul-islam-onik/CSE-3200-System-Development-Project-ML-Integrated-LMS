const CTMarks = require('../models/CTMarks');
const Course = require('../models/Course');
const User = require('../models/User');

// @desc    Create or update CT marks for a student
// @route   POST /api/ct-marks
// @access  Teacher/Admin
exports.createOrUpdateCTMarks = async (req, res) => {
  try {
    const { studentId, courseId, section, academicYear, ctNumber, marksObtained, totalMarks, questionCOMapping } = req.body;

    // Validate required fields
    if (!studentId || !courseId || !academicYear || !ctNumber || marksObtained === undefined || !totalMarks) {
      return res.status(400).json({
        success: false,
        message: 'Student ID, Course ID, Academic Year, CT Number, Marks Obtained, and Total Marks are required'
      });
    }

    // Validate marks
    if (marksObtained < 0 || totalMarks < 0) {
      return res.status(400).json({
        success: false,
        message: 'Marks cannot be negative'
      });
    }

    if (marksObtained > totalMarks) {
      return res.status(400).json({
        success: false,
        message: 'Marks obtained cannot exceed total marks'
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
      const assignment = course.assignedTeachers.find(a => {
        const teacherId = a.teacher?._id || a.teacher;
        return teacherId.toString() === req.user._id.toString();
      });

      if (!assignment) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You are not assigned to this course/section.'
        });
      }

      // If teacher is assigned to a specific section, ensure they are modifying that section
      if (assignment.section && assignment.section !== section) {
        return res.status(403).json({
          success: false,
          message: `Access denied. You are only assigned to Section ${assignment.section}.`
        });
      }
    }

    // Upsert (update if exists, create if doesn't)
    const ctMarks = await CTMarks.findOneAndUpdate(
      { 
        student: studentId, 
        course: courseId,
        section: section || null,
        ctNumber: ctNumber,
        academicYear: academicYear
      },
      {
        marksObtained,
        totalMarks,
        questionCOMapping: questionCOMapping || [],
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
    .populate('enteredBy', 'name email')
    .populate('questionCOMapping.courseOutcome', 'co_code description');

    res.status(200).json({
      success: true,
      message: 'CT marks saved successfully',
      data: ctMarks
    });

  } catch (error) {
    console.error('Create/Update CT marks error:', error);
    
    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'CT marks already exist for this student, course, section, CT number, and academic year'
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
      message: 'Server error saving CT marks'
    });
  }
};

// @desc    Bulk save CT marks for multiple students
// @route   POST /api/ct-marks/bulk
// @access  Teacher/Admin
exports.bulkSaveCTMarks = async (req, res) => {
  try {
    const { courseId, section, academicYear, ctNumber, totalMarks, studentsMarks } = req.body;

    // Validate required fields
    if (!courseId || !academicYear || !ctNumber || !totalMarks || !studentsMarks || !Array.isArray(studentsMarks)) {
      return res.status(400).json({
        success: false,
        message: 'Course ID, Academic Year, CT Number, Total Marks, and Students Marks array are required'
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

    const results = {
      successful: [],
      failed: []
    };

    console.log('[bulkSaveCTMarks] Starting save for:', {
      courseId,
      section,
      academicYear,
      ctNumber,
      totalMarks,
      studentCount: studentsMarks.length
    });

    // Process each student's marks
    for (const studentMark of studentsMarks) {
      try {
        const { studentId, marksObtained, questionCOMapping } = studentMark;

        // Skip if no marks provided
        if (marksObtained === undefined || marksObtained === null || marksObtained === '') {
          continue;
        }

        // Validate marks
        const marks = parseFloat(marksObtained);
        if (isNaN(marks) || marks < 0 || marks > totalMarks) {
          results.failed.push({
            studentId,
            reason: 'Invalid marks value'
          });
          continue;
        }

        // Upsert CT marks
        const ctMarks = await CTMarks.findOneAndUpdate(
          { 
            student: studentId, 
            course: courseId,
            section: section || null,
            ctNumber: ctNumber,
            academicYear: academicYear
          },
          {
            marksObtained: marks,
            totalMarks,
            questionCOMapping: questionCOMapping || [],
            enteredBy: req.user._id,
            lastModified: Date.now()
          },
          {
            new: true,
            upsert: true,
            runValidators: true
          }
        );

        results.successful.push({
          studentId,
          ctMarksId: ctMarks._id
        });
        
        console.log('[bulkSaveCTMarks] Saved mark:', {
          studentId,
          courseId,
          section: ctMarks.section,
          academicYear: ctMarks.academicYear,
          ctNumber: ctMarks.ctNumber,
          marks: marks
        });

      } catch (error) {
        results.failed.push({
          studentId: studentMark.studentId,
          reason: error.message
        });
      }
    }

    res.status(200).json({
      success: true,
      message: `Bulk save completed. ${results.successful.length} successful, ${results.failed.length} failed.`,
      data: results
    });

  } catch (error) {
    console.error('Bulk save CT marks error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during bulk save'
    });
  }
};

// @desc    Get all CT marks for a student in a course
// @route   GET /api/ct-marks/:studentId/:courseId
// @access  Teacher/Student/Admin
exports.getStudentCTMarks = async (req, res) => {
  try {
    const { studentId, courseId } = req.params;
    const { section, academicYear } = req.query;

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

    const ctMarks = await CTMarks.find(query)
      .populate('student', 'name roll email')
      .populate('course', 'courseCode courseTitle')
      .populate('enteredBy', 'name email')
      .populate('questionCOMapping.courseOutcome', 'co_code description')
      .sort({ ctNumber: 1 });

    res.status(200).json({
      success: true,
      count: ctMarks.length,
      data: ctMarks
    });

  } catch (error) {
    console.error('Get student CT marks error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching CT marks'
    });
  }
};

// @desc    Get all CT marks for a course
// @route   GET /api/ct-marks/course/:courseId
// @access  Teacher/Admin
exports.getCourseCTMarks = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { section, academicYear, ctNumber } = req.query;

    console.log('[getCourseCTMarks] Request:', {
      courseId,
      section,
      academicYear,
      ctNumber,
      userRole: req.user.role,
      userId: req.user._id
    });

    // Verify course exists
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    const query = { course: courseId };
    
    // For teachers, verify assignment and restrict to their section
    if (req.user.role === 'teacher') {
      const assignment = course.assignedTeachers.find(a => {
        const teacherId = a.teacher?._id || a.teacher;
        return teacherId.toString() === req.user._id.toString();
      });

      console.log('[getCourseCTMarks] Teacher assignment:', assignment);

      if (!assignment) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You are not assigned to this course.'
        });
      }

      // If assigned to a specific section, force that section
      if (assignment.section) {
        if (section && section !== assignment.section) {
          return res.status(403).json({
            success: false,
            message: `Access denied. You are only assigned to Section ${assignment.section}.`
          });
        }
        query.section = assignment.section;
      } else {
        // Teacher assigned to whole course (null section)
        if (section) query.section = section;
      }
    } else {
      // Admin/others
      if (section) query.section = section;
    }

    if (academicYear) {
      query.academicYear = academicYear;
    }

    if (ctNumber) {
      query.ctNumber = parseInt(ctNumber);
    }

    console.log('[getCourseCTMarks] Final query:', query);

    const ctMarks = await CTMarks.find(query)
      .populate('student', 'name roll email')
      .populate('enteredBy', 'name email')
      .populate('questionCOMapping.courseOutcome', 'co_code description')
      .sort({ ctNumber: 1, 'student.roll': 1 });

    console.log('[getCourseCTMarks] Found marks:', ctMarks.length);
    if (ctMarks.length > 0) {
      console.log('[getCourseCTMarks] Sample mark:', {
        student: ctMarks[0].student?.roll,
        section: ctMarks[0].section,
        academicYear: ctMarks[0].academicYear,
        ctNumber: ctMarks[0].ctNumber
      });
    }

    res.status(200).json({
      success: true,
      count: ctMarks.length,
      data: ctMarks
    });

  } catch (error) {
    console.error('Get course CT marks error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching CT marks'
    });
  }
};

// @desc    Calculate best N-1 CT marks for a student
// @route   POST /api/ct-marks/calculate-best
// @access  Teacher/Admin
exports.calculateBestCTs = async (req, res) => {
  try {
    const { studentId, courseId, section, academicYear, numToKeep } = req.body;

    // Validate required fields
    if (!studentId || !courseId || !academicYear) {
      return res.status(400).json({
        success: false,
        message: 'Student ID, Course ID, and Academic Year are required'
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
      student: studentId,
      course: courseId,
      academicYear: academicYear
    };

    if (section) {
      query.section = section;
    }

    // Get all CT marks for the student
    const allCTs = await CTMarks.find(query)
      .populate('student', 'name roll email')
      .populate('course', 'courseCode courseTitle')
      .sort({ ctNumber: 1 });

    if (allCTs.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No CT marks found for this student'
      });
    }

    // Calculate percentage for each CT
    const ctsWithPercentage = allCTs.map(ct => ({
      ...ct.toObject(),
      percentage: ct.totalMarks > 0 ? (ct.marksObtained / ct.totalMarks) * 100 : 0
    }));

    // Sort by percentage (descending) to identify best CTs
    const sortedByPercentage = [...ctsWithPercentage].sort((a, b) => b.percentage - a.percentage);

    // Determine how many to keep (default: all except 1, i.e., best N-1)
    const keepCount = numToKeep || Math.max(1, allCTs.length - 1);
    const actualKeepCount = Math.min(keepCount, allCTs.length);

    // Get the best N CTs
    const bestCTs = sortedByPercentage.slice(0, actualKeepCount);
    const droppedCTs = sortedByPercentage.slice(actualKeepCount);

    // Calculate totals
    const bestCTsTotal = bestCTs.reduce((sum, ct) => sum + ct.marksObtained, 0);
    const bestCTsMaxTotal = bestCTs.reduce((sum, ct) => sum + ct.totalMarks, 0);
    const bestCTsPercentage = bestCTsMaxTotal > 0 ? (bestCTsTotal / bestCTsMaxTotal) * 100 : 0;

    res.status(200).json({
      success: true,
      data: {
        student: allCTs[0].student,
        course: allCTs[0].course,
        section: section || null,
        academicYear: academicYear,
        totalCTs: allCTs.length,
        keptCTs: actualKeepCount,
        droppedCTs: droppedCTs.length,
        bestCTs: bestCTs.map(ct => ({
          ctNumber: ct.ctNumber,
          marksObtained: ct.marksObtained,
          totalMarks: ct.totalMarks,
          percentage: ct.percentage.toFixed(2)
        })),
        droppedCTs: droppedCTs.map(ct => ({
          ctNumber: ct.ctNumber,
          marksObtained: ct.marksObtained,
          totalMarks: ct.totalMarks,
          percentage: ct.percentage.toFixed(2)
        })),
        summary: {
          totalMarksObtained: bestCTsTotal,
          totalMaxMarks: bestCTsMaxTotal,
          percentage: bestCTsPercentage.toFixed(2)
        }
      }
    });

  } catch (error) {
    console.error('Calculate best CTs error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error calculating best CTs'
    });
  }
};

// @desc    Delete CT marks
// @route   DELETE /api/ct-marks/:id
// @access  Teacher/Admin
exports.deleteCTMarks = async (req, res) => {
  try {
    const { id } = req.params;

    // Find the CT marks
    const ctMarks = await CTMarks.findById(id).populate('course');
    
    if (!ctMarks) {
      return res.status(404).json({
        success: false,
        message: 'CT marks not found'
      });
    }

    // For teachers, verify they are assigned to this course
    if (req.user.role === 'teacher') {
      const course = ctMarks.course;
      const isAssigned = course.assignedTeachers.some(assignment => {
        const teacherId = assignment.teacher?._id || assignment.teacher;
        const matches = teacherId.toString() === req.user._id.toString();
        if (ctMarks.section && matches) {
          return assignment.section === ctMarks.section;
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

    // Delete the CT marks
    await CTMarks.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'CT marks deleted successfully'
    });

  } catch (error) {
    console.error('Delete CT marks error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting CT marks'
    });
  }
};

// @desc    Get CT marks summary/statistics for a course
// @route   GET /api/ct-marks/course/:courseId/summary
// @access  Teacher/Admin
exports.getCTMarksSummary = async (req, res) => {
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

    const query = { course: courseId };

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

      // If assigned to a specific section, force that section
      if (assignment.section) {
        if (section && section !== assignment.section) {
          return res.status(403).json({
            success: false,
            message: `Access denied. You are only assigned to Section ${assignment.section}.`
          });
        }
        query.section = assignment.section;
      } else {
        // Teacher assigned to whole course (allows both sections)
        if (section) query.section = section;
      }
    } else {
      // Admin/others
      if (section) query.section = section;
    }

    if (academicYear) {
      query.academicYear = academicYear;
    }

    const allCTMarks = await CTMarks.find(query);

    // Group by CT number
    const ctGroups = {};
    
    allCTMarks.forEach(ct => {
      if (!ctGroups[ct.ctNumber]) {
        ctGroups[ct.ctNumber] = {
          ctNumber: ct.ctNumber,
          totalMarks: ct.totalMarks,
          submissions: [],
          count: 0,
          sum: 0,
          average: 0,
          highest: 0,
          lowest: ct.totalMarks,
          passCount: 0
        };
      }
      
      const group = ctGroups[ct.ctNumber];
      group.submissions.push(ct.marksObtained);
      group.count++;
      group.sum += ct.marksObtained;
      group.highest = Math.max(group.highest, ct.marksObtained);
      group.lowest = Math.min(group.lowest, ct.marksObtained);
      
      // Count as pass if scored >= 40% (configurable threshold)
      const percentage = (ct.marksObtained / ct.totalMarks) * 100;
      if (percentage >= 40) {
        group.passCount++;
      }
    });

    // Calculate statistics
    const summary = Object.values(ctGroups).map(group => {
      group.average = group.count > 0 ? (group.sum / group.count).toFixed(2) : 0;
      group.passPercentage = group.count > 0 ? ((group.passCount / group.count) * 100).toFixed(2) : 0;
      
      // Remove submissions array from response
      delete group.submissions;
      
      return group;
    });

    // Sort by CT number
    summary.sort((a, b) => a.ctNumber - b.ctNumber);

    res.status(200).json({
      success: true,
      data: {
        course: {
          _id: course._id,
          courseCode: course.courseCode,
          courseTitle: course.courseTitle
        },
        section: section || null,
        academicYear: academicYear || null,
        totalCTs: summary.length,
        summary: summary
      }
    });

  } catch (error) {
    console.error('Get CT marks summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching CT marks summary'
    });
  }
};
