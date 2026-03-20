const Course = require('../models/Course');
const CourseOutcome = require('../models/CourseOutcome');
const CTAttainment = require('../models/CTAttainment');
const AssignmentAttainment = require('../models/AssignmentAttainment');
const TermExamAttainment = require('../models/TermExamAttainment');
const TermExamMarks = require('../models/TermExamMarks');
const LabActivityAttainment = require('../models/LabActivityAttainment');
const TermResult = require('../models/TermResult');
const CourseCOAttainment = require('../models/CourseCOAttainment');
const User = require('../models/User');
const { calculateCourseCOAttainment } = require('../utils/coAttainmentCalc');
const {
  computeStudentTotal,
  getLetterGrade,
  getGradePoint,
  getLetterGradeForLab,
  computeLabStudentTotal,
  computeTermGPA,
  computeCGPA,
} = require('../utils/gradeUtils');

// ---------------------------------------------------------------------------
// Helper: safely read a value from a nested Mongoose Map (or plain object)
// Mirrors the getSectionAData getMark logic exactly.
// ---------------------------------------------------------------------------
const getMark = (marksObj, row, question) => {
  try {
    let marks = marksObj;
    if (marks instanceof Map) {
      const tmp = {};
      for (const [k, v] of marks.entries()) {
        tmp[k] = v instanceof Map ? Object.fromEntries(v) : v;
      }
      marks = tmp;
    }
    if (!marks || !marks[row]) return 0;
    let rowData = marks[row];
    if (rowData instanceof Map) rowData = Object.fromEntries(rowData);
    if (!rowData || typeof rowData !== 'object') return 0;
    const value = rowData[question] !== undefined ? rowData[question] : rowData[String(question)];
    if (value === '' || value === null || value === undefined) return 0;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
  } catch {
    return 0;
  }
};

// Build sectionAObtainedRow from a TermExamMarks doc (section='A', questions 1-4)
const buildSectionARow = (examMark) => ({
  rollNumber: examMark.student?.roll || '',
  name: examMark.student?.name || '',
  Q1a: getMark(examMark.marks, 'a', '1'), Q1b: getMark(examMark.marks, 'b', '1'),
  Q1c: getMark(examMark.marks, 'c', '1'), Q1d: getMark(examMark.marks, 'd', '1'),
  Q2a: getMark(examMark.marks, 'a', '2'), Q2b: getMark(examMark.marks, 'b', '2'),
  Q2c: getMark(examMark.marks, 'c', '2'), Q2d: getMark(examMark.marks, 'd', '2'),
  Q3a: getMark(examMark.marks, 'a', '3'), Q3b: getMark(examMark.marks, 'b', '3'),
  Q3c: getMark(examMark.marks, 'c', '3'), Q3d: getMark(examMark.marks, 'd', '3'),
  Q4a: getMark(examMark.marks, 'a', '4'), Q4b: getMark(examMark.marks, 'b', '4'),
  Q4c: getMark(examMark.marks, 'c', '4'), Q4d: getMark(examMark.marks, 'd', '4'),
});

// Build sectionBObtainedRow from a TermExamMarks doc (section='B', questions 5-8 → UI Q1-Q4)
const buildSectionBRow = (examMark) => ({
  rollNumber: examMark.student?.roll || '',
  name: examMark.student?.name || '',
  Q1a: getMark(examMark.marks, 'a', '5'), Q1b: getMark(examMark.marks, 'b', '5'),
  Q1c: getMark(examMark.marks, 'c', '5'), Q1d: getMark(examMark.marks, 'd', '5'),
  Q2a: getMark(examMark.marks, 'a', '6'), Q2b: getMark(examMark.marks, 'b', '6'),
  Q2c: getMark(examMark.marks, 'c', '6'), Q2d: getMark(examMark.marks, 'd', '6'),
  Q3a: getMark(examMark.marks, 'a', '7'), Q3b: getMark(examMark.marks, 'b', '7'),
  Q3c: getMark(examMark.marks, 'c', '7'), Q3d: getMark(examMark.marks, 'd', '7'),
  Q4a: getMark(examMark.marks, 'a', '8'), Q4b: getMark(examMark.marks, 'b', '8'),
  Q4c: getMark(examMark.marks, 'c', '8'), Q4d: getMark(examMark.marks, 'd', '8'),
});

// ---------------------------------------------------------------------------
// Helper: extract CO numbers for a course
// ---------------------------------------------------------------------------
const extractCONumbers = (sectionARows, courseOutcomes) => {
  if (courseOutcomes && courseOutcomes.length > 0) {
    return courseOutcomes
      .filter(co => !co.is_deleted)
      .map(co => {
        const code = String(co.co_code || '');
        const match = code.match(/CO(\d+)$|CLO(\d+)$/i);
        if (match) return `CO${match[1] || match[2]}`;
        return code;
      });
  }
  return (sectionARows || []).map(r => {
    return String(r.coNumber || '').replace('CLO', 'CO');
  });
};

// ---------------------------------------------------------------------------
// Helper: pre-fetch all attainment data for a course (called once per course)
// ---------------------------------------------------------------------------
const loadCourseAttainmentData = async (courseId) => {
  const [termExamDoc, ctDoc, assignDoc, courseOutcomes, termMarksA, termMarksB] = await Promise.all([
    TermExamAttainment.findOne({ course: courseId }).lean(),
    CTAttainment.findOne({ course: courseId }).lean(),
    AssignmentAttainment.findOne({ course: courseId }).lean(),
    CourseOutcome.find({ course: courseId, is_deleted: false }).lean(),
    TermExamMarks.find({ course: courseId, section: 'A' }).populate('student', 'roll name').lean(),
    TermExamMarks.find({ course: courseId, section: 'B' }).populate('student', 'roll name').lean(),
  ]);

  // Dynamically build obtained rows from TermExamMarks (same as getSectionAData endpoint)
  const sectionAObtainedRows = (termMarksA || []).map(buildSectionARow);
  const sectionBObtainedRows = (termMarksB || []).map(buildSectionBRow);

  const sectionARows = termExamDoc ? termExamDoc.sectionARows : [];
  const sectionBRows = termExamDoc ? termExamDoc.sectionBRows : [];

  const unwrapMap = (m) => {
    if (!m) return {};
    if (m instanceof Map) return Object.fromEntries(m);
    if (typeof m === 'object' && m.constructor?.name === 'Object') return m;
    return {};
  };

  return {
    sectionAData: { sectionARows, sectionAObtainedRows },
    sectionBData: { sectionBRows, sectionBObtainedRows },
    ctData: {
      ctRows: ctDoc ? ctDoc.ctRows : [],
      ctObtainedRows: ctDoc ? ctDoc.ctObtainedRows : [],
      ctManualWts: ctDoc ? unwrapMap(ctDoc.ctManualWts) : {},
      ctSummary: ctDoc ? ctDoc.ctSummary : {},
    },
    assignData: {
      assignmentRows: assignDoc ? assignDoc.assignmentRows : [],
      attnAssignObtainedRows: assignDoc ? assignDoc.attnAssignObtainedRows : [],
      assignmentManualWts: assignDoc ? unwrapMap(assignDoc.assignmentManualWts) : {},
      assignmentSummary: assignDoc ? assignDoc.assignmentSummary : {},
    },
    coNumbers: extractCONumbers(sectionARows, courseOutcomes),
  };
};

// ---------------------------------------------------------------------------
// Helper: pre-fetch lab attainment data for a SESSIONAL course
// ---------------------------------------------------------------------------
const loadLabCourseAttainmentData = async (courseId) => {
  const labDoc = await LabActivityAttainment.findOne({ course: courseId }).lean();
  if (!labDoc) return null;

  const unwrapMap = (m) => {
    if (!m) return {};
    if (m instanceof Map) return Object.fromEntries(m);
    if (typeof m === 'object' && m.constructor?.name === 'Object') return m;
    return {};
  };

    const labActivityRows = labDoc.labActivityRows || [];
    const coNumbers = labActivityRows.map(row => String(row.coNumber || '').replace('CLO', 'CO')).filter(Boolean);

    return {
      coNumbers: [...new Set(coNumbers)], // Deduplicate
      labActivityRows,
      labActivityScores: unwrapMap(labDoc.labActivityScores)
        , labActivityObtainedRows: labDoc.labActivityObtainedRows || []
        , labAttendanceMarks: labDoc.labAttendanceMarks || 0
        , labQuizMarks: labDoc.labQuizMarks || 0
        , labVivaMarks: labDoc.labVivaMarks || 0
        , activityTaken: labDoc.activityTaken || 5
        , useEqWtActivity: labDoc.useEqWtActivity || 0
        , coMappedActivityMarks: labDoc.coMappedActivityMarks || 0
        , labActivityManualWts: unwrapMap(labDoc.labActivityManualWts)
        , otherActivityRemaining: labDoc.otherActivityRemaining || 0
        , otherActivityMeasured: labDoc.otherActivityMeasured || 0
    };
};

// ---------------------------------------------------------------------------
// Helper: find all courses for a specific batch+dept+yearLevel+term
// ---------------------------------------------------------------------------
const findCoursesForBatchTerm = async (batch, deptCode, yearLevel, term) => {
  return Course.find({
    yearLevel: Number(yearLevel),
    term: Number(term),
    status: 'ACTIVE',
    'assignedBatches.batch': batch,
    'assignedBatches.deptCode': deptCode,
  }).lean();
};

// ---------------------------------------------------------------------------
// Helper: find students for a batch+deptCode
// Roll number convention: first 2 chars = batch year, chars 3-4 = deptCode
// e.g. "2107016" → batch "21", deptCode "07"
// ---------------------------------------------------------------------------
const findStudentsForBatch = async (batch, deptCode) => {
  // Students whose roll starts with batch+deptCode (e.g. "2107")
  const rollPrefix = `${batch}${deptCode}`;
  return User.find({
    role: 'student',
    roll: { $regex: `^${rollPrefix}` },
    isActive: true,
  }).lean();
};

// ============================================================================
// Controller: POST /api/results/compute
// Compute (or recompute) draft TermResults for a batch+term combination.
// Body: { batch, deptCode, yearLevel, term, academicYear? }
// ============================================================================
exports.computeResults = async (req, res) => {
  try {
    const { batch, deptCode, yearLevel, term } = req.body;
    if (!batch || !deptCode || !yearLevel || !term) {
      return res.status(400).json({ message: 'batch, deptCode, yearLevel, and term are required.' });
    }

    const courses = await findCoursesForBatchTerm(batch, deptCode, yearLevel, term);
    if (!courses.length) {
      return res.status(404).json({ message: 'No active courses found for the given batch/dept/yearLevel/term.' });
    }

    const students = await findStudentsForBatch(batch, deptCode);
    if (!students.length) {
      return res.status(404).json({ message: 'No students found for the given batch and department.' });
    }

    const semester = (Number(yearLevel) - 1) * 2 + Number(term);

    // Pre-load attainment data for each course once
    const courseAttainmentMap = new Map();
    await Promise.all(
      courses.map(async (course) => {
        const isLab = course.course_type === 'SESSIONAL' || course.course_type === 'PROJECT/THESIS';
        const data = isLab
          ? await loadLabCourseAttainmentData(course._id)
          : await loadCourseAttainmentData(course._id);
        courseAttainmentMap.set(String(course._id), { data, isLab });
      })
    );

    // PRE-FETCH PRIOR RESULTS FOR ALL STUDENTS
    const studentIds = students.map(s => s._id);
    const allPriorResults = await TermResult.find({
      student: { $in: studentIds },
      isPublished: true,
      $nor: [{ yearLevel: Number(yearLevel), term: Number(term) }],
    }).lean();

    const priorResultsByStudent = new Map();
    for (const pr of allPriorResults) {
      const sId = String(pr.student);
      if (!priorResultsByStudent.has(sId)) {
        priorResultsByStudent.set(sId, []);
      }
      priorResultsByStudent.get(sId).push(pr);
    }

    const bulkOps = [];

    for (const student of students) {
      const courseResults = [];

      for (const course of courses) {
        const { data: attainment, isLab } = courseAttainmentMap.get(String(course._id));
        let totalMarks, letterGrade;
        if (isLab) {
          totalMarks = attainment ? computeLabStudentTotal(student.roll, attainment) : 0;
          letterGrade = getLetterGradeForLab(totalMarks);
        } else {
          totalMarks = attainment ? computeStudentTotal(
            student.roll,
            attainment.coNumbers,
            attainment.sectionAData,
            attainment.sectionBData,
            attainment.ctData,
            attainment.assignData
          ) : 0;
          letterGrade = getLetterGrade(totalMarks);
        }
        const gradePoint = getGradePoint(letterGrade);
        courseResults.push({
          course: course._id,
          courseCode: course.courseCode,
          courseTitle: course.courseTitle,
          credit: course.credit,
          course_type: course.course_type,
          totalMarks: Math.round(totalMarks * 100) / 100,
          letterGrade,
          gradePoint,
        });
      }

      const creditTaken = courseResults.reduce((s, cr) => s + (cr.credit || 0), 0);
      const creditCompleted = courseResults
        .filter(cr => cr.letterGrade !== 'F')
        .reduce((s, cr) => s + (cr.credit || 0), 0);
      const termGPA = computeTermGPA(courseResults);

      // Fetch pre-grouped prior results
      const priorResults = priorResultsByStudent.get(String(student._id)) || [];

      // Compute totalCreditCompleted across all prior published terms + this term
      const priorCreditCompleted = priorResults.reduce((s, tr) => s + (tr.creditCompleted || 0), 0);
      const totalCreditCompleted = priorCreditCompleted + creditCompleted;

      // Build a synthetic array for CGPA that includes current term results
      const allTermResultsForCGPA = [
        ...priorResults,
        { courses: courseResults },
      ];
      const cgpa = computeCGPA(allTermResultsForCGPA);

      bulkOps.push({
        updateOne: {
          filter: { student: student._id, yearLevel: Number(yearLevel), term: Number(term) },
          update: {
            $set: {
              studentRoll: student.roll,
              studentName: student.name,
              batch,
              deptCode,
              semester,
              courses: courseResults,
              creditTaken,
              creditCompleted,
              totalCreditCompleted,
              termGPA,
              cgpa,
              isPublished: false,
              publishedAt: null,
              publishedBy: null,
            }
          },
          upsert: true
        }
      });
    }

    if (bulkOps.length > 0) {
      await TermResult.bulkWrite(bulkOps);
    }

    // Compute and save CO Attainments per course blindly during the batch result generation
    const coAttainmentBulkOps = [];
    for (const course of courses) {
      const { data: attainment, isLab } = courseAttainmentMap.get(String(course._id)) || {};
      
      if (!attainment || !attainment.coNumbers) {
        continue;
      }

      const coStats = calculateCourseCOAttainment(course.course_type, students, attainment.coNumbers, attainment);

      coAttainmentBulkOps.push({
        updateOne: {
          filter: { course: course._id, batch, yearLevel: Number(yearLevel), term: Number(term) },
          update: {
            $set: {
              deptCode,
              coData: coStats,
              isPublished: false,
              publishedAt: null,
              publishedBy: null,
            }
          },
          upsert: true
        }
      });
    }

    if (coAttainmentBulkOps.length > 0) {
      await CourseCOAttainment.bulkWrite(coAttainmentBulkOps);
    }

    // Retrieve the saved documents to return
    const savedResults = await TermResult.find({
      student: { $in: studentIds },
      yearLevel: Number(yearLevel),
      term: Number(term)
    }).lean();

    return res.status(200).json({
      message: `Computed results for ${savedResults.length} students across ${courses.length} courses.`,
      count: savedResults.length,
      results: savedResults,
    });
  } catch (err) {
    console.error('[resultController.computeResults]', err);
    return res.status(500).json({ message: 'Failed to compute results.', error: err.message });
  }
};

// ============================================================================
// Controller: POST /api/results/publish
// Publish all computed (draft) TermResults for a batch+term.
// Body: { batch, deptCode, yearLevel, term }
// ============================================================================
exports.publishResults = async (req, res) => {
  try {
    const { batch, deptCode, yearLevel, term } = req.body;
    if (!batch || !deptCode || !yearLevel || !term) {
      return res.status(400).json({ message: 'batch, deptCode, yearLevel, and term are required.' });
    }

    const result = await TermResult.updateMany(
      {
        batch,
        deptCode,
        yearLevel: Number(yearLevel),
        term: Number(term),
        isPublished: false,
      },
      {
        $set: {
          isPublished: true,
          publishedAt: new Date(),
          publishedBy: req.user._id,
        },
      }
    );

    // Also publish the aggregated CO Attainments
    await CourseCOAttainment.updateMany(
      {
        batch,
        deptCode,
        yearLevel: Number(yearLevel),
        term: Number(term),
        isPublished: false,
      },
      {
        $set: {
          isPublished: true,
          publishedAt: new Date(),
          publishedBy: req.user._id,
        },
      }
    );

    return res.status(200).json({
      message: `Published ${result.modifiedCount} result(s).`,
      modifiedCount: result.modifiedCount,
    });
  } catch (err) {
    console.error('[resultController.publishResults]', err);
    return res.status(500).json({ message: 'Failed to publish results.', error: err.message });
  }
};

// ============================================================================
// Controller: POST /api/results/unpublish
// Revert published results back to draft for a batch+term.
// Body: { batch, deptCode, yearLevel, term }
// ============================================================================
exports.unpublishResults = async (req, res) => {
  try {
    const { batch, deptCode, yearLevel, term } = req.body;
    if (!batch || !deptCode || !yearLevel || !term) {
      return res.status(400).json({ message: 'batch, deptCode, yearLevel, and term are required.' });
    }

    const result = await TermResult.updateMany(
      {
        batch,
        deptCode,
        yearLevel: Number(yearLevel),
        term: Number(term),
        isPublished: true,
      },
      {
        $set: {
          isPublished: false,
          publishedAt: null,
          publishedBy: null,
        },
      }
    );

    // Also unpublish the aggregated CO Attainments
    await CourseCOAttainment.updateMany(
      {
        batch,
        deptCode,
        yearLevel: Number(yearLevel),
        term: Number(term),
        isPublished: true,
      },
      {
        $set: {
          isPublished: false,
          publishedAt: null,
          publishedBy: null,
        },
      }
    );

    return res.status(200).json({
      message: `Unpublished ${result.modifiedCount} result(s).`,
      modifiedCount: result.modifiedCount,
    });
  } catch (err) {
    console.error('[resultController.unpublishResults]', err);
    return res.status(500).json({ message: 'Failed to unpublish results.', error: err.message });
  }
};

// ============================================================================
// Controller: GET /api/results/batch
// Get all TermResults for a batch+term (admin use).
// Query: ?batch=21&deptCode=07&yearLevel=1&term=1&publishedOnly=false
// ============================================================================
exports.getBatchResults = async (req, res) => {
  try {
    const { batch, deptCode, yearLevel, term, publishedOnly } = req.query;
    if (!batch || !deptCode || !yearLevel || !term) {
      return res.status(400).json({ message: 'batch, deptCode, yearLevel, and term are required.' });
    }

    const filter = {
      batch,
      deptCode,
      yearLevel: Number(yearLevel),
      term: Number(term),
    };
    if (publishedOnly === 'true') filter.isPublished = true;

    const results = await TermResult.find(filter)
      .sort({ studentRoll: 1 })
      .lean();

    return res.status(200).json({ results });
  } catch (err) {
    console.error('[resultController.getBatchResults]', err);
    return res.status(500).json({ message: 'Failed to fetch batch results.', error: err.message });
  }
};

// ============================================================================
// Get computed CO attainments for a specific batch+term
// Admin/Teacher: get all CO stats for the batch (includes drafts)
// ============================================================================
exports.getBatchCOAttainments = async (req, res) => {
  try {
    const { batch, deptCode, yearLevel, term, publishedOnly } = req.query;
    if (!batch || !deptCode || !yearLevel || !term) {
      return res.status(400).json({ message: 'batch, deptCode, yearLevel, and term are required.' });
    }

    const filter = {
      batch,
      deptCode,
      yearLevel: Number(yearLevel),
      term: Number(term),
    };
    if (publishedOnly === 'true') filter.isPublished = true;

    const coAttainments = await CourseCOAttainment.find(filter)
        .populate('course', 'courseCode courseTitle course_type')

    return res.status(200).json({ coAttainments });
  } catch (err) {
    console.error('[resultController.getBatchCOAttainments]', err);
    return res.status(500).json({ message: 'Failed to fetch batch CO attainments.', error: err.message });
  }
};

// ============================================================================
// Controller: GET /api/results/student
// Get all published TermResults for the authenticated student.
// ============================================================================
exports.getStudentResults = async (req, res) => {
  try {
    const studentId = req.user._id;

    const results = await TermResult.find({
      student: studentId,
      isPublished: true,
    })
      .sort({ yearLevel: 1, term: 1 })
      .lean();

    return res.status(200).json({ results });
  } catch (err) {
    console.error('[resultController.getStudentResults]', err);
    return res.status(500).json({ message: 'Failed to fetch results.', error: err.message });
  }
};

// ============================================================================
// Controller: GET /api/results/student/:studentId
// Get all TermResults for a specific student (admin use — includes unpublished).
// ============================================================================
exports.getStudentResultsByAdmin = async (req, res) => {
  try {
    const { studentId } = req.params;

    const results = await TermResult.find({ student: studentId })
      .sort({ yearLevel: 1, term: 1 })
      .lean();

    return res.status(200).json({ results });
  } catch (err) {
    console.error('[resultController.getStudentResultsByAdmin]', err);
    return res.status(500).json({ message: 'Failed to fetch student results.', error: err.message });
  }
};
