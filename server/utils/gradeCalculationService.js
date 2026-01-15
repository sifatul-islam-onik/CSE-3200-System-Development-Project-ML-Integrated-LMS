const CTMarks = require('../models/CTMarks');
const Attendance = require('../models/Attendance');
const Assignment = require('../models/Assignment');
const TermExamMarks = require('../models/TermExamMarks');

/**
 * Calculate final grade for a student in a course
 * @param {String} studentId - Student ID
 * @param {String} courseId - Course ID
 * @param {String} section - Section (A/B/null)
 * @param {String} academicYear - Academic year
 * @param {Object} coursePolicy - Course grading policy
 * @returns {Object} Grade breakdown and final grade
 */
exports.calculateStudentGrade = async (studentId, courseId, section, academicYear, coursePolicy = {}) => {
  try {
    // Default policy if not provided
    const policy = {
      ctWeightage: coursePolicy.ctWeightage || 40,
      attendanceWeightage: coursePolicy.attendanceWeightage || 10,
      assignmentWeightage: coursePolicy.assignmentWeightage || 10,
      termExamWeightage: coursePolicy.termExamWeightage || 40,
      ctPolicy: coursePolicy.ctPolicy || 'best-n-minus-1', // 'best-n-minus-1' or 'all'
      totalMarks: coursePolicy.totalMarks || 100
    };

    const breakdown = {
      ctMarks: [],
      bestCTsTotal: 0,
      ctWeightedMarks: 0,
      attendance: null,
      assignments: [],
      assignmentTotal: 0,
      termExam: null
    };

    // 1. Fetch CT Marks
    const ctMarks = await CTMarks.find({
      student: studentId,
      course: courseId,
      section: section || null,
      academicYear
    }).sort({ ctNumber: 1 });

    breakdown.ctMarks = ctMarks.map(ct => ({
      ctNumber: ct.ctNumber,
      marks: ct.marksObtained,
      totalMarks: ct.totalMarks
    }));

    // Apply best N-1 policy for CT marks
    if (ctMarks.length > 0) {
      if (policy.ctPolicy === 'best-n-minus-1' && ctMarks.length > 1) {
        // Calculate percentage for each CT
        const ctPercentages = ctMarks.map(ct => ({
          ctNumber: ct.ctNumber,
          marks: ct.marksObtained,
          totalMarks: ct.totalMarks,
          percentage: (ct.marksObtained / ct.totalMarks) * 100
        }));

        // Sort by percentage descending
        ctPercentages.sort((a, b) => b.percentage - a.percentage);

        // Keep best N-1 (drop lowest)
        const bestCTs = ctPercentages.slice(0, ctPercentages.length - 1);

        // Calculate total marks from best CTs
        breakdown.bestCTsTotal = bestCTs.reduce((sum, ct) => sum + ct.marks, 0);
        const bestCTsTotalPossible = bestCTs.reduce((sum, ct) => sum + ct.totalMarks, 0);

        // Calculate weighted marks
        if (bestCTsTotalPossible > 0) {
          breakdown.ctWeightedMarks = (breakdown.bestCTsTotal / bestCTsTotalPossible) * policy.ctWeightage;
        }
      } else {
        // Use all CT marks
        breakdown.bestCTsTotal = ctMarks.reduce((sum, ct) => sum + ct.marksObtained, 0);
        const totalCTPossible = ctMarks.reduce((sum, ct) => sum + ct.totalMarks, 0);

        if (totalCTPossible > 0) {
          breakdown.ctWeightedMarks = (breakdown.bestCTsTotal / totalCTPossible) * policy.ctWeightage;
        }
      }
    }

    // 2. Fetch Attendance
    const attendance = await Attendance.findOne({
      student: studentId,
      course: courseId,
      section: section || null,
      academicYear
    });

    if (attendance) {
      breakdown.attendance = {
        classes: attendance.totalClasses,
        attended: attendance.attendedClasses,
        percentage: attendance.percentage,
        marks: attendance.marksAwarded
      };
    }

    // 3. Fetch Assignments
    // Priority: Use Attendance.assignments (primary storage for assignment marks)
    // Fallback to Assignment Collection for legacy data

    // Source A: Primary - Assignments in Attendance Model
    const simpleAssignmentMarks = [];
    if (attendance && attendance.assignments && attendance.assignments.length > 0) {
      attendance.assignments.forEach((assign, index) => {
        simpleAssignmentMarks.push({
          assignmentNumber: index + 1,
          marks: assign.marksObtained || 0,
          totalMarks: assign.totalMarks || 0
        });
      });
    }

    // Source B: Legacy - Formal Assignments (LMS) - for backward compatibility
    const formalAssignmentsDocs = await Assignment.find({
      course: courseId,
      section: section || null,
      academicYear
    }).sort({ assignmentNumber: 1 });

    const formalAssignmentMarks = [];
    formalAssignmentsDocs.forEach(assignment => {
      const submission = assignment.submissions.find(
        sub => sub.student.toString() === studentId
      );

      if (submission && submission.marksObtained !== undefined) {
        formalAssignmentMarks.push({
          assignmentNumber: assignment.assignmentNumber,
          marks: submission.marksObtained,
          totalMarks: assignment.totalMarks
        });
      }
    });

    // Decision: Prioritize Attendance.assignments (primary system)
    if (simpleAssignmentMarks.length > 0) {
      // Use primary assignment storage from Attendance model
      breakdown.assignments = simpleAssignmentMarks;
    } else if (formalAssignmentMarks.length > 0) {
      // Fallback to legacy Assignment collection if Attendance has no assignments
      console.warn(`[GradeCalc] Fallback: Using Assignment collection for student ${studentId} in course ${courseId}`);
      breakdown.assignments = formalAssignmentMarks;
    } else {
      breakdown.assignments = [];
    }

    // Calculate Total Marks from Normalized Data
    breakdown.assignmentTotal = breakdown.assignments.reduce((sum, a) => sum + a.marks, 0);

    // Calculate weighted assignment marks
    let assignmentWeightedMarks = 0;
    if (breakdown.assignments.length > 0) {
      const totalAssignmentMarks = breakdown.assignments.reduce((sum, a) => sum + a.marks, 0);
      const totalAssignmentPossible = breakdown.assignments.reduce((sum, a) => sum + a.totalMarks, 0);

      if (totalAssignmentPossible > 0) {
        assignmentWeightedMarks = (totalAssignmentMarks / totalAssignmentPossible) * policy.assignmentWeightage;
      }
    }

    // 4. Fetch Term Exam Marks
    const termExam = await TermExamMarks.findOne({
      student: studentId,
      course: courseId,
      section: section || null,
      academicYear
    });

    let termExamWeightedMarks = 0;
    if (termExam) {
      breakdown.termExam = {
        marks: termExam.marksObtained,
        totalMarks: termExam.totalMarks,
        weightedMarks: 0
      };

      if (termExam.totalMarks > 0) {
        termExamWeightedMarks = (termExam.marksObtained / termExam.totalMarks) * policy.termExamWeightage;
        breakdown.termExam.weightedMarks = termExamWeightedMarks;
      }
    }

    // 5. Calculate Total Marks
    const totalMarks = 
      breakdown.ctWeightedMarks + 
      (breakdown.attendance?.marks || 0) + 
      assignmentWeightedMarks + 
      termExamWeightedMarks;

    // 6. Calculate Percentage
    const percentage = (totalMarks / policy.totalMarks) * 100;

    // 7. Convert to Letter Grade and GPA
    const { letterGrade, gradePoint } = this.calculateLetterGrade(percentage);

    return {
      breakdown,
      totalMarks: parseFloat(totalMarks.toFixed(2)),
      percentage: parseFloat(percentage.toFixed(2)),
      letterGrade,
      gradePoint
    };

  } catch (error) {
    console.error('Grade calculation error for student:', studentId, 'course:', courseId);
    console.error('Error details:', error);
    console.error('Error stack:', error.stack);
    throw error;
  }
};

/**
 * Calculate letter grade and grade point from percentage
 * @param {Number} percentage - Percentage marks
 * @returns {Object} Letter grade and grade point
 */
exports.calculateLetterGrade = (percentage) => {
  if (percentage >= 80) {
    return { letterGrade: 'A+', gradePoint: 4.0 };
  } else if (percentage >= 75) {
    return { letterGrade: 'A', gradePoint: 3.75 };
  } else if (percentage >= 70) {
    return { letterGrade: 'A-', gradePoint: 3.5 };
  } else if (percentage >= 65) {
    return { letterGrade: 'B+', gradePoint: 3.25 };
  } else if (percentage >= 60) {
    return { letterGrade: 'B', gradePoint: 3.0 };
  } else if (percentage >= 55) {
    return { letterGrade: 'B-', gradePoint: 2.75 };
  } else if (percentage >= 50) {
    return { letterGrade: 'C+', gradePoint: 2.5 };
  } else if (percentage >= 45) {
    return { letterGrade: 'C', gradePoint: 2.25 };
  } else if (percentage >= 40) {
    return { letterGrade: 'C-', gradePoint: 2.0 };
  } else if (percentage >= 35) {
    return { letterGrade: 'D', gradePoint: 1.0 };
  } else {
    return { letterGrade: 'F', gradePoint: 0.0 };
  }
};

/**
 * Calculate best N CTs from a list of CT marks
 * @param {Array} ctMarks - Array of CT marks objects
 * @param {Number} keepCount - Number of best CTs to keep
 * @returns {Object} Best CTs and dropped CTs
 */
exports.calculateBestCTs = (ctMarks, keepCount) => {
  if (!ctMarks || ctMarks.length === 0) {
    return { bestCTs: [], droppedCTs: [], totalMarks: 0 };
  }

  // Calculate percentage for each CT
  const ctWithPercentage = ctMarks.map(ct => ({
    ...ct,
    percentage: ct.totalMarks > 0 ? (ct.marksObtained / ct.totalMarks) * 100 : 0
  }));

  // Sort by percentage descending
  ctWithPercentage.sort((a, b) => b.percentage - a.percentage);

  // Split into best and dropped
  const bestCTs = ctWithPercentage.slice(0, keepCount);
  const droppedCTs = ctWithPercentage.slice(keepCount);

  // Calculate total marks from best CTs
  const totalMarks = bestCTs.reduce((sum, ct) => sum + ct.marksObtained, 0);

  return {
    bestCTs,
    droppedCTs,
    totalMarks
  };
};

/**
 * Validate if all required marks are present for grade calculation
 * @param {String} studentId - Student ID
 * @param {String} courseId - Course ID
 * @param {String} section - Section
 * @param {String} academicYear - Academic year
 * @returns {Object} Validation result with missing components
 */
exports.validateMarksForGrading = async (studentId, courseId, section, academicYear) => {
  const missing = [];
  const warnings = [];

  console.log(`[validateMarksForGrading] Checking for student: ${studentId}, course: ${courseId}, section: ${section}, year: ${academicYear}`);

  // Check CT Marks (Required)
  const ctMarks = await CTMarks.find({
    student: studentId,
    course: courseId,
    section: section || null,
    academicYear
  });

  console.log(`[validateMarksForGrading] CT marks found: ${ctMarks.length}`);

  if (ctMarks.length === 0) {
    missing.push('CT Marks');
  }

  // Check Attendance (Required)
  const attendance = await Attendance.findOne({
    student: studentId,
    course: courseId,
    section: section || null,
    academicYear
  });

  console.log(`[validateMarksForGrading] Attendance found:`, attendance ? 'Yes' : 'No');

  if (!attendance) {
    missing.push('Attendance');
  }

  // Check Term Exam (Optional - can calculate without it)
  const termExam = await TermExamMarks.findOne({
    student: studentId,
    course: courseId,
    section: section || null,
    academicYear
  });

  console.log(`[validateMarksForGrading] Term exam found:`, termExam ? 'Yes' : 'No');

  if (!termExam) {
    warnings.push('Term Exam Marks not available - will use 0 for this component');
  }

  return {
    isValid: missing.length === 0, // Only CT and Attendance are required
    missing,
    warnings
  };
};
