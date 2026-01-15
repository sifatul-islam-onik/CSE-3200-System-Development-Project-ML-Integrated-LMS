const FinalGrade = require('../models/FinalGrade');
const Course = require('../models/Course');
const User = require('../models/User');
const CTMarks = require('../models/CTMarks');
const Attendance = require('../models/Attendance');
const TermExamMarks = require('../models/TermExamMarks');
const gradeCalculationService = require('../utils/gradeCalculationService');

// @desc    Calculate and save final grade for a student
// @route   POST /api/grades/calculate/:studentId/:courseId
// @access  Teacher/Admin
exports.calculateStudentGrade = async (req, res) => {
  try {
    const { studentId, courseId } = req.params;
    const { section, academicYear, coursePolicy } = req.body;

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

    // Validate if all required marks are present
    const validation = await gradeCalculationService.validateMarksForGrading(
      studentId,
      courseId,
      section || null,
      academicYear
    );

    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Cannot calculate grade. Missing marks components.',
        missing: validation.missing
      });
    }

    // Calculate grade
    const gradeResult = await gradeCalculationService.calculateStudentGrade(
      studentId,
      courseId,
      section || null,
      academicYear,
      coursePolicy
    );

    // Check if grade already exists (finalized grades cannot be overwritten)
    const existingGrade = await FinalGrade.findOne({
      student: studentId,
      course: courseId,
      section: section || null,
      academicYear
    });

    if (existingGrade && existingGrade.isFinalized) {
      return res.status(400).json({
        success: false,
        message: 'Grade is already finalized. Unfinalize it before recalculating.'
      });
    }

    // Upsert final grade
    const finalGrade = await FinalGrade.findOneAndUpdate(
      {
        student: studentId,
        course: courseId,
        section: section || null,
        academicYear
      },
      {
        breakdown: gradeResult.breakdown,
        totalMarks: gradeResult.totalMarks,
        percentage: gradeResult.percentage,
        letterGrade: gradeResult.letterGrade,
        gradePoint: gradeResult.gradePoint,
        calculatedBy: req.user._id,
        lastCalculated: Date.now()
      },
      {
        new: true,
        upsert: true,
        runValidators: true
      }
    )
    .populate('student', 'name roll email')
    .populate('course', 'courseCode courseTitle')
    .populate('calculatedBy', 'name email');

    res.status(200).json({
      success: true,
      message: 'Grade calculated successfully',
      data: finalGrade
    });

  } catch (error) {
    console.error('Calculate student grade error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error message:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error calculating grade',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Calculate grades for all students in a course
// @route   POST /api/grades/calculate/course/:courseId
// @access  Teacher/Admin
exports.calculateCourseGrades = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { section, academicYear, coursePolicy } = req.body;

    // Verify course exists
    const course = await Course.findById(courseId).populate('assignedTeachers.teacher', 'name');
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

    // Get all students enrolled in this course by finding students who have any marks
    const ctMarks = await CTMarks.find({ course: courseId }).select('student').lean();
    const attendanceRecords = await Attendance.find({ course: courseId }).select('student').lean();
    const termExamMarks = await TermExamMarks.find({ course: courseId }).select('student section academicYear').lean();
    
    console.log('[calculateCourseGrades] CT marks count:', ctMarks.length);
    console.log('[calculateCourseGrades] Sample CT mark:', ctMarks[0]);
    console.log('[calculateCourseGrades] Attendance records count:', attendanceRecords.length);
    console.log('[calculateCourseGrades] Sample attendance:', attendanceRecords[0]);
    console.log('[calculateCourseGrades] Term exam marks count:', termExamMarks.length);
    console.log('[calculateCourseGrades] Term exam marks students:', termExamMarks.map(t => ({ id: t.student.toString(), objectId: t.student, section: t.section, year: t.academicYear })));
    
    // Combine all student IDs and remove duplicates
    const studentIdsSet = new Set();
    ctMarks.forEach(ct => studentIdsSet.add(ct.student.toString()));
    attendanceRecords.forEach(att => studentIdsSet.add(att.student.toString()));
    termExamMarks.forEach(term => studentIdsSet.add(term.student.toString()));
    
    const enrolledStudents = Array.from(studentIdsSet);
    
    console.log('[calculateCourseGrades] Enrolled students:', enrolledStudents);
    console.log('[calculateCourseGrades] First student ID:', enrolledStudents[0]);
    console.log('[calculateCourseGrades] First student ID type:', typeof enrolledStudents[0]);
    
    if (enrolledStudents.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No students enrolled in this course'
      });
    }

    const results = {
      successful: [],
      failed: [],
      skipped: []
    };

    let calculatedCount = 0;

    // Calculate grade for each student
    for (const studentId of enrolledStudents) {
      try {
        console.log(`[calculateCourseGrades] Processing student: ${studentId}`);
        
        // Check if grade is already finalized
        const existingGrade = await FinalGrade.findOne({
          student: studentId,
          course: courseId,
          section: section || null,
          academicYear
        });

        if (existingGrade && existingGrade.isFinalized) {
          console.log(`[calculateCourseGrades] Student ${studentId} grade already finalized`);
          results.skipped.push({
            studentId,
            reason: 'Grade already finalized'
          });
          continue;
        }

        // Validate marks availability
        console.log(`[calculateCourseGrades] Validating marks for student ${studentId}`);
        const validation = await gradeCalculationService.validateMarksForGrading(
          studentId,
          courseId,
          section || null,
          academicYear
        );

        console.log(`[calculateCourseGrades] Validation result:`, validation);

        if (!validation.isValid) {
          console.log(`[calculateCourseGrades] Student ${studentId} missing marks: ${validation.missing.join(', ')}`);
          results.failed.push({
            studentId,
            reason: `Missing: ${validation.missing.join(', ')}`
          });
          continue;
        }

        // Calculate grade
        console.log(`[calculateCourseGrades] Calculating grade for student ${studentId}`);
        const gradeResult = await gradeCalculationService.calculateStudentGrade(
          studentId,
          courseId,
          section || null,
          academicYear,
          coursePolicy
        );

        console.log(`[calculateCourseGrades] Grade result for ${studentId}:`, gradeResult);

        // Save final grade
        const savedGrade = await FinalGrade.findOneAndUpdate(
          {
            student: studentId,
            course: courseId,
            section: section || null,
            academicYear
          },
          {
            breakdown: gradeResult.breakdown,
            totalMarks: gradeResult.totalMarks,
            percentage: gradeResult.percentage,
            letterGrade: gradeResult.letterGrade,
            gradePoint: gradeResult.gradePoint,
            calculatedBy: req.user._id,
            lastCalculated: Date.now()
          },
          {
            new: true,
            upsert: true,
            runValidators: true
          }
        );

        console.log(`[calculateCourseGrades] Saved grade for ${studentId}:`, savedGrade._id);

        results.successful.push({ studentId });
        calculatedCount++;

      } catch (error) {
        console.error(`[calculateCourseGrades] Error for student ${studentId}:`, error.message);
        console.error(`[calculateCourseGrades] Error stack:`, error.stack);
        results.failed.push({
          studentId,
          reason: error.message
        });
      }
    }

    console.log(`[calculateCourseGrades] Final results:`, results);
    console.log(`[calculateCourseGrades] Calculated count:`, calculatedCount);

    res.status(200).json({
      success: true,
      message: `Calculated ${calculatedCount} grades. ${results.failed.length} failed, ${results.skipped.length} skipped.`,
      calculatedCount,
      data: results
    });

  } catch (error) {
    console.error('Calculate course grades error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error message:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error calculating course grades',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Finalize grades for a course (lock from editing)
// @route   POST /api/grades/finalize/:courseId
// @access  Teacher/Admin
exports.finalizeGrades = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { section, academicYear } = req.body;

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

    // Find all grades for this course/section/year
    const query = {
      course: courseId,
      section: section || null,
      academicYear,
      isFinalized: false
    };

    const result = await FinalGrade.updateMany(
      query,
      {
        isFinalized: true,
        finalizedBy: req.user._id,
        finalizedAt: Date.now()
      }
    );

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} grades finalized successfully`,
      finalizedCount: result.modifiedCount
    });

  } catch (error) {
    console.error('Finalize grades error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error finalizing grades'
    });
  }
};

// @desc    Unfinalize a grade (unlock for editing)
// @route   POST /api/grades/unfinalize/:gradeId
// @access  Admin only
exports.unfinalizeGrade = async (req, res) => {
  try {
    const { gradeId } = req.params;

    const grade = await FinalGrade.findById(gradeId);
    if (!grade) {
      return res.status(404).json({
        success: false,
        message: 'Grade not found'
      });
    }

    if (!grade.isFinalized) {
      return res.status(400).json({
        success: false,
        message: 'Grade is not finalized'
      });
    }

    grade.isFinalized = false;
    grade.finalizedBy = null;
    grade.finalizedAt = null;
    await grade.save();

    const updatedGrade = await FinalGrade.findById(gradeId)
      .populate('student', 'name roll email')
      .populate('course', 'courseCode courseTitle')
      .populate('calculatedBy', 'name email');

    res.status(200).json({
      success: true,
      message: 'Grade unfinalized successfully',
      data: updatedGrade
    });

  } catch (error) {
    console.error('Unfinalize grade error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error unfinalizing grade'
    });
  }
};

// @desc    Get final grade for a student in a course
// @route   GET /api/grades/:studentId/:courseId
// @access  Teacher/Student/Admin
exports.getStudentGrade = async (req, res) => {
  try {
    const { studentId, courseId } = req.params;
    const { section, academicYear } = req.query;

    // Students can only view their own grades
    if (req.user.role === 'student' && req.user._id.toString() !== studentId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view your own grades.'
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

    const grade = await FinalGrade.findOne(query)
      .populate('student', 'name roll email')
      .populate('course', 'courseCode courseTitle')
      .populate('calculatedBy', 'name email')
      .populate('finalizedBy', 'name email');

    if (!grade) {
      return res.status(404).json({
        success: false,
        message: 'Grade not found'
      });
    }

    res.status(200).json({
      success: true,
      data: grade
    });

  } catch (error) {
    console.error('Get student grade error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching grade'
    });
  }
};

// @desc    Get all grades for a course
// @route   GET /api/grades/course/:courseId
// @access  Teacher/Admin
exports.getCourseGrades = async (req, res) => {
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

    const grades = await FinalGrade.find(query)
      .populate('student', 'name roll email')
      .populate('course', 'courseCode courseTitle')
      .populate('calculatedBy', 'name email')
      .populate('finalizedBy', 'name email')
      .sort({ 'student.roll': 1 });

    res.status(200).json({
      success: true,
      count: grades.length,
      data: grades
    });

  } catch (error) {
    console.error('Get course grades error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching grades'
    });
  }
};

// @desc    Check if grades are finalized for a course
// @route   GET /api/grades/status/:courseId
// @access  Teacher/Admin
exports.getGradeStatus = async (req, res) => {
  try {
    const { courseId } = req.params;
    const FinalGrade = require('../models/FinalGrade');
    
    // Check if any finalized grade exists for this course
    const isLocked = await FinalGrade.exists({ 
      course: courseId, 
      isFinalized: true 
    });

    res.status(200).json({
      success: true,
      isLocked: !!isLocked
    });
  } catch (error) {
    console.error('Get grade status error:', error);
    res.status(500).json({ success: false, message: 'Server error check status' });
  }
};
