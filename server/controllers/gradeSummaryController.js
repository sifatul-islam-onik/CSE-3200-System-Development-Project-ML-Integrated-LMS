const Course = require('../models/Course');
const User = require('../models/User');
const gradeCalculationService = require('../utils/gradeCalculationService');

// @desc    Get detailed grade summary for direct viewing (Combines all sheets)
// @route   GET /api/courses/:courseId/grade-summary
// @access  Teacher/Admin
exports.getCourseResultSummary = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { section, academicYear } = req.query;

    console.log('[GradeSummary] Generating report for:', { courseId, section, academicYear });

    // 1. Verify Access & Course
    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });

    // Validate Teacher Access
    if (req.user.role === 'teacher') {
      const isAssigned = course.assignedTeachers.some(assign => {
        const teacherId = assign.teacher?._id || assign.teacher;
        const matches = teacherId.toString() === req.user._id.toString();
        // If section is provided, check section match only if it's strictly enforced.
        // For general summary, a teacher might want to see all if they are assigned to any,
        // but typically a teacher is assigned to a specific section.
        if (section && matches) return assign.section === section;
        return matches;
      });
      if (!isAssigned) return res.status(403).json({ success: false, message: 'Access Denied: Not assigned to this course/section' });
    }

    // 2. Identify Students (Logic adapted from courseController.getCourseStudents)
    const assignedBatches = course.assignedBatches || [];
    let enrolledStudents = [];

    if (assignedBatches.length > 0) {
      // Find students whose roll numbers match the assigned batches
      const students = await User.find({
        role: 'student',
        isActive: true,
        isEmailVerified: true,
        isApprovedByAdmin: true
      }).select('name roll email department');

      // Filter students based on roll number format (BBDDRRR)
      enrolledStudents = students.filter(student => {
        if (!student.roll || student.roll.length < 4) return false;
        
        const batch = student.roll.substring(0, 2);
        const deptCode = student.roll.substring(2, 4);
        
        return assignedBatches.some(assignment => 
          assignment.batch === batch && assignment.deptCode === deptCode
        );
      });
      
      // If section is provided, we might want to filter, but Roll numbers don't always indicate section.
      // Assuming for now simple batch enrollment is sufficient.
      // If section filtering is critical and unavailable via DB, this might need refinement later.
    }

    if (!enrolledStudents.length) {
      return res.status(200).json({ success: true, count: 0, data: [] });
    }

    console.log(`[GradeSummary] Found ${enrolledStudents.length} enrolled students. Calculation starting...`);

    // 3. Aggregate Data via Service
    const summaryData = [];

    // Standard Policy Defaults
    const standardPolicy = {
      ctWeightage: 40,
      attendanceWeightage: 10,
      assignmentWeightage: 10,
      termExamWeightage: 40,
      ctPolicy: 'best-n-minus-1',
      totalMarks: 100
    };

    // Parallel processing for performance
    const promises = enrolledStudents.map(async (student) => {
      try {
        const studentId = student._id;

        // CRITICAL: Using the EXACT SAME Calculation Service logic
        const calcResult = await gradeCalculationService.calculateStudentGrade(
          studentId,
          courseId,
          section || null,
          academicYear || new Date().getFullYear().toString(),
          standardPolicy
        );

        // Helper to format safe numbers
        const safeNum = (val) => (typeof val === 'number' && !isNaN(val)) ? val : 0;
        
        // Extract breakdown data safely
        const bd = calcResult.breakdown || {};
        
        return {
          id: student._id,
          rollNo: student.roll,
          name: student.name,
          
          ctTotal: safeNum(bd.bestCTsTotal),
          ctWeighted: safeNum(bd.ctWeightedMarks),
          
          attendanceMarks: safeNum(bd.attendance?.marks),
          attendanceWeighted: safeNum(bd.attendance?.weightedMarks),
          
          assignmentMarks: safeNum(bd.assignmentTotal),
          assignmentWeighted: safeNum(bd.assignmentWeightedMarks),
            
          termExam: safeNum(bd.termExam?.marks),
          termWeighted: safeNum(bd.termExam?.weightedMarks),
          
          totalMarks: safeNum(calcResult.totalMarks),
          letterGrade: calcResult.letterGrade || 'X',
          gradePoint: safeNum(calcResult.gradePoint),
          isPassed: safeNum(calcResult.totalMarks) >= 40
        };
      } catch (err) {
        console.warn(`[GradeSummary] Failed for student ${student.roll}:`, err.message);
        return {
          id: student._id,
          rollNo: student.roll,
          name: student.name,
          error: 'Calculation Failed',
          details: err.message, 
          ctTotal: 0, ctWeighted: 0, attendanceMarks: 0, attendanceWeighted: 0,
          assignmentMarks: 0, assignmentWeighted: 0, termExam: 0, termWeighted: 0,
          totalMarks: 0, letterGrade: 'X', gradePoint: 0, isPassed: false
        };
      }
    });

    const results = await Promise.all(promises);

    // Sort by Roll Number
    results.sort((a, b) => {
        const valA = a.rollNo || '';
        const valB = b.rollNo || '';
        return valA.localeCompare(valB);
    });

    res.status(200).json({
      success: true,
      count: results.length,
      data: results
    });

  } catch (error) {
    console.error('Grade Summary API Error:', error);
    res.status(500).json({ success: false, message: 'Server error generating summary' });
  }
};
