const CTMarks = require('../models/CTMarks');
const Attendance = require('../models/Attendance');
const Assignment = require('../models/Assignment');
const TermExamMarks = require('../models/TermExamMarks');
const CourseOutcome = require('../models/CourseOutcome');

/**
 * Calculate CO attainment for a course
 * @param {String} courseId - Course ID
 * @param {String} section - Section (A/B/null)
 * @param {String} academicYear - Academic year
 * @returns {Object} CO attainment results
 */
exports.calculateCOAttainment = async (courseId, section, academicYear) => {
  try {
    // Initialize CO attainment map
    const coAttainmentMap = new Map();

    // 1. Aggregate from CT Marks
    const ctMarks = await CTMarks.find({
      course: courseId,
      section: section || null,
      academicYear
    }).populate('questionCOMapping.courseOutcome', 'co_code description');

    for (const ct of ctMarks) {
      if (ct.questionCOMapping && ct.questionCOMapping.length > 0) {
        for (const question of ct.questionCOMapping) {
          if (!question.courseOutcome) continue;

          const coId = question.courseOutcome._id.toString();
          if (!coAttainmentMap.has(coId)) {
            coAttainmentMap.set(coId, {
              courseOutcome: question.courseOutcome,
              totalMarksObtained: 0,
              totalMarksPossible: 0,
              assessments: {
                ct: { obtained: 0, possible: 0, count: 0 },
                assignment: { obtained: 0, possible: 0, count: 0 },
                termExam: { obtained: 0, possible: 0, count: 0 }
              }
            });
          }

          const coData = coAttainmentMap.get(coId);
          coData.totalMarksObtained += question.marksObtained || 0;
          coData.totalMarksPossible += question.totalMarks || 0;
          coData.assessments.ct.obtained += question.marksObtained || 0;
          coData.assessments.ct.possible += question.totalMarks || 0;
          coData.assessments.ct.count++;
        }
      }
    }

    // 2. Aggregate from Assignments
    const assignments = await Assignment.find({
      course: courseId,
      section: section || null,
      academicYear
    }).populate('courseOutcomes', 'co_code description');

    for (const assignment of assignments) {
      for (const submission of assignment.submissions) {
        if (submission.questionCOMapping && submission.questionCOMapping.length > 0) {
          // Use question-level CO mapping
          for (const question of submission.questionCOMapping) {
            if (!question.courseOutcome) continue;

            const coId = question.courseOutcome.toString();
            if (!coAttainmentMap.has(coId)) {
              // Fetch CO details if not already in map
              const co = await CourseOutcome.findById(coId);
              if (!co) continue;

              coAttainmentMap.set(coId, {
                courseOutcome: co,
                totalMarksObtained: 0,
                totalMarksPossible: 0,
                assessments: {
                  ct: { obtained: 0, possible: 0, count: 0 },
                  assignment: { obtained: 0, possible: 0, count: 0 },
                  termExam: { obtained: 0, possible: 0, count: 0 }
                }
              });
            }

            const coData = coAttainmentMap.get(coId);
            coData.totalMarksObtained += question.marksObtained || 0;
            coData.totalMarksPossible += question.totalMarks || 0;
            coData.assessments.assignment.obtained += question.marksObtained || 0;
            coData.assessments.assignment.possible += question.totalMarks || 0;
            coData.assessments.assignment.count++;
          }
        } else if (assignment.courseOutcomes && assignment.courseOutcomes.length > 0) {
          // Fall back to assignment-level CO mapping (equal distribution)
          const marksPerCO = (submission.marksObtained || 0) / assignment.courseOutcomes.length;
          const totalPerCO = assignment.totalMarks / assignment.courseOutcomes.length;

          for (const co of assignment.courseOutcomes) {
            const coId = co._id.toString();
            if (!coAttainmentMap.has(coId)) {
              coAttainmentMap.set(coId, {
                courseOutcome: co,
                totalMarksObtained: 0,
                totalMarksPossible: 0,
                assessments: {
                  ct: { obtained: 0, possible: 0, count: 0 },
                  assignment: { obtained: 0, possible: 0, count: 0 },
                  termExam: { obtained: 0, possible: 0, count: 0 }
                }
              });
            }

            const coData = coAttainmentMap.get(coId);
            coData.totalMarksObtained += marksPerCO;
            coData.totalMarksPossible += totalPerCO;
            coData.assessments.assignment.obtained += marksPerCO;
            coData.assessments.assignment.possible += totalPerCO;
            coData.assessments.assignment.count++;
          }
        }
      }
    }

    // 3. Aggregate from Term Exam Marks
    const termExamMarks = await TermExamMarks.find({
      course: courseId,
      section: section || null,
      academicYear
    }).populate('questionCOMapping.courseOutcome', 'co_code description');

    for (const termExam of termExamMarks) {
      if (termExam.questionCOMapping && termExam.questionCOMapping.length > 0) {
        for (const question of termExam.questionCOMapping) {
          if (!question.courseOutcome) continue;

          const coId = question.courseOutcome._id.toString();
          if (!coAttainmentMap.has(coId)) {
            coAttainmentMap.set(coId, {
              courseOutcome: question.courseOutcome,
              totalMarksObtained: 0,
              totalMarksPossible: 0,
              assessments: {
                ct: { obtained: 0, possible: 0, count: 0 },
                assignment: { obtained: 0, possible: 0, count: 0 },
                termExam: { obtained: 0, possible: 0, count: 0 }
              }
            });
          }

          const coData = coAttainmentMap.get(coId);
          coData.totalMarksObtained += question.marksObtained || 0;
          coData.totalMarksPossible += question.totalMarks || 0;
          coData.assessments.termExam.obtained += question.marksObtained || 0;
          coData.assessments.termExam.possible += question.totalMarks || 0;
          coData.assessments.termExam.count++;
        }
      }
    }

    // 4. Calculate attainment levels for each CO
    const coAttainmentResults = [];

    for (const [coId, coData] of coAttainmentMap) {
      const attainmentPercentage = coData.totalMarksPossible > 0
        ? (coData.totalMarksObtained / coData.totalMarksPossible) * 100
        : 0;

      const attainmentLevel = this.determineAttainmentLevel(attainmentPercentage);

      coAttainmentResults.push({
        courseOutcome: {
          _id: coData.courseOutcome._id,
          co_code: coData.courseOutcome.co_code,
          description: coData.courseOutcome.description
        },
        totalMarksObtained: parseFloat(coData.totalMarksObtained.toFixed(2)),
        totalMarksPossible: parseFloat(coData.totalMarksPossible.toFixed(2)),
        attainmentPercentage: parseFloat(attainmentPercentage.toFixed(2)),
        attainmentLevel,
        assessmentBreakdown: {
          ct: {
            obtained: parseFloat(coData.assessments.ct.obtained.toFixed(2)),
            possible: parseFloat(coData.assessments.ct.possible.toFixed(2)),
            percentage: coData.assessments.ct.possible > 0
              ? parseFloat(((coData.assessments.ct.obtained / coData.assessments.ct.possible) * 100).toFixed(2))
              : 0,
            count: coData.assessments.ct.count
          },
          assignment: {
            obtained: parseFloat(coData.assessments.assignment.obtained.toFixed(2)),
            possible: parseFloat(coData.assessments.assignment.possible.toFixed(2)),
            percentage: coData.assessments.assignment.possible > 0
              ? parseFloat(((coData.assessments.assignment.obtained / coData.assessments.assignment.possible) * 100).toFixed(2))
              : 0,
            count: coData.assessments.assignment.count
          },
          termExam: {
            obtained: parseFloat(coData.assessments.termExam.obtained.toFixed(2)),
            possible: parseFloat(coData.assessments.termExam.possible.toFixed(2)),
            percentage: coData.assessments.termExam.possible > 0
              ? parseFloat(((coData.assessments.termExam.obtained / coData.assessments.termExam.possible) * 100).toFixed(2))
              : 0,
            count: coData.assessments.termExam.count
          }
        }
      });
    }

    // Sort by CO code
    coAttainmentResults.sort((a, b) => {
      const codeA = a.courseOutcome.co_code || '';
      const codeB = b.courseOutcome.co_code || '';
      return codeA.localeCompare(codeB);
    });

    return {
      courseId,
      section,
      academicYear,
      coAttainment: coAttainmentResults,
      summary: {
        totalCOs: coAttainmentResults.length,
        averageAttainment: coAttainmentResults.length > 0
          ? parseFloat((coAttainmentResults.reduce((sum, co) => sum + co.attainmentPercentage, 0) / coAttainmentResults.length).toFixed(2))
          : 0,
        attainmentDistribution: this.calculateAttainmentDistribution(coAttainmentResults)
      }
    };

  } catch (error) {
    console.error('CO attainment calculation error:', error);
    throw error;
  }
};

/**
 * Determine attainment level based on percentage
 * @param {Number} percentage - Attainment percentage
 * @returns {Number} Attainment level (0-3)
 */
exports.determineAttainmentLevel = (percentage) => {
  // Attainment levels based on common OBE standards
  if (percentage >= 70) {
    return 3; // High attainment
  } else if (percentage >= 60) {
    return 2; // Medium attainment
  } else if (percentage >= 40) {
    return 1; // Low attainment
  } else {
    return 0; // Not attained
  }
};

/**
 * Calculate attainment distribution
 * @param {Array} coAttainmentResults - CO attainment results
 * @returns {Object} Distribution of attainment levels
 */
exports.calculateAttainmentDistribution = (coAttainmentResults) => {
  const distribution = {
    level0: 0,
    level1: 0,
    level2: 0,
    level3: 0
  };

  for (const result of coAttainmentResults) {
    switch (result.attainmentLevel) {
      case 0:
        distribution.level0++;
        break;
      case 1:
        distribution.level1++;
        break;
      case 2:
        distribution.level2++;
        break;
      case 3:
        distribution.level3++;
        break;
    }
  }

  return distribution;
};

/**
 * Calculate student-level CO attainment for a specific student
 * @param {String} studentId - Student ID
 * @param {String} courseId - Course ID
 * @param {String} section - Section
 * @param {String} academicYear - Academic year
 * @returns {Object} Student CO attainment
 */
exports.calculateStudentCOAttainment = async (studentId, courseId, section, academicYear) => {
  try {
    const coAttainmentMap = new Map();

    // Aggregate CT Marks
    const ctMarks = await CTMarks.find({
      student: studentId,
      course: courseId,
      section: section || null,
      academicYear
    }).populate('questionCOMapping.courseOutcome', 'co_code description');

    for (const ct of ctMarks) {
      if (ct.questionCOMapping && ct.questionCOMapping.length > 0) {
        for (const question of ct.questionCOMapping) {
          if (!question.courseOutcome) continue;

          const coId = question.courseOutcome._id.toString();
          if (!coAttainmentMap.has(coId)) {
            coAttainmentMap.set(coId, {
              courseOutcome: question.courseOutcome,
              totalMarksObtained: 0,
              totalMarksPossible: 0
            });
          }

          const coData = coAttainmentMap.get(coId);
          coData.totalMarksObtained += question.marksObtained || 0;
          coData.totalMarksPossible += question.totalMarks || 0;
        }
      }
    }

    // Aggregate Assignments
    const assignments = await Assignment.find({
      course: courseId,
      section: section || null,
      academicYear
    }).populate('courseOutcomes', 'co_code description');

    for (const assignment of assignments) {
      const submission = assignment.submissions.find(
        sub => sub.student.toString() === studentId
      );

      if (submission) {
        if (submission.questionCOMapping && submission.questionCOMapping.length > 0) {
          for (const question of submission.questionCOMapping) {
            if (!question.courseOutcome) continue;

            const coId = question.courseOutcome.toString();
            if (!coAttainmentMap.has(coId)) {
              const co = await CourseOutcome.findById(coId);
              if (!co) continue;

              coAttainmentMap.set(coId, {
                courseOutcome: co,
                totalMarksObtained: 0,
                totalMarksPossible: 0
              });
            }

            const coData = coAttainmentMap.get(coId);
            coData.totalMarksObtained += question.marksObtained || 0;
            coData.totalMarksPossible += question.totalMarks || 0;
          }
        } else if (assignment.courseOutcomes && assignment.courseOutcomes.length > 0) {
          const marksPerCO = (submission.marksObtained || 0) / assignment.courseOutcomes.length;
          const totalPerCO = assignment.totalMarks / assignment.courseOutcomes.length;

          for (const co of assignment.courseOutcomes) {
            const coId = co._id.toString();
            if (!coAttainmentMap.has(coId)) {
              coAttainmentMap.set(coId, {
                courseOutcome: co,
                totalMarksObtained: 0,
                totalMarksPossible: 0
              });
            }

            const coData = coAttainmentMap.get(coId);
            coData.totalMarksObtained += marksPerCO;
            coData.totalMarksPossible += totalPerCO;
          }
        }
      }
    }

    // Aggregate Term Exam
    const termExam = await TermExamMarks.findOne({
      student: studentId,
      course: courseId,
      section: section || null,
      academicYear
    }).populate('questionCOMapping.courseOutcome', 'co_code description');

    if (termExam && termExam.questionCOMapping && termExam.questionCOMapping.length > 0) {
      for (const question of termExam.questionCOMapping) {
        if (!question.courseOutcome) continue;

        const coId = question.courseOutcome._id.toString();
        if (!coAttainmentMap.has(coId)) {
          coAttainmentMap.set(coId, {
            courseOutcome: question.courseOutcome,
            totalMarksObtained: 0,
            totalMarksPossible: 0
          });
        }

        const coData = coAttainmentMap.get(coId);
        coData.totalMarksObtained += question.marksObtained || 0;
        coData.totalMarksPossible += question.totalMarks || 0;
      }
    }

    // Calculate attainment for each CO
    const studentCOAttainment = [];

    for (const [coId, coData] of coAttainmentMap) {
      const attainmentPercentage = coData.totalMarksPossible > 0
        ? (coData.totalMarksObtained / coData.totalMarksPossible) * 100
        : 0;

      const attainmentLevel = this.determineAttainmentLevel(attainmentPercentage);

      studentCOAttainment.push({
        courseOutcome: {
          _id: coData.courseOutcome._id,
          co_code: coData.courseOutcome.co_code,
          description: coData.courseOutcome.description
        },
        marksObtained: parseFloat(coData.totalMarksObtained.toFixed(2)),
        totalMarks: parseFloat(coData.totalMarksPossible.toFixed(2)),
        attainmentPercentage: parseFloat(attainmentPercentage.toFixed(2)),
        attainmentLevel
      });
    }

    // Sort by CO code
    studentCOAttainment.sort((a, b) => {
      const codeA = a.courseOutcome.co_code || '';
      const codeB = b.courseOutcome.co_code || '';
      return codeA.localeCompare(codeB);
    });

    return studentCOAttainment;

  } catch (error) {
    console.error('Student CO attainment calculation error:', error);
    throw error;
  }
};
