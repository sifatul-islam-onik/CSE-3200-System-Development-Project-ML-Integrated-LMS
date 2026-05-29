const Course = require('../models/Course');
const User = require('../models/User');
const CTAttainment = require('../models/CTAttainment');
const AssignmentAttainment = require('../models/AssignmentAttainment');
const LabActivityAttainment = require('../models/LabActivityAttainment');
const TermExamMarks = require('../models/TermExamMarks');
const TermExamAttainment = require('../models/TermExamAttainment');
const CourseOutcome = require('../models/CourseOutcome');
const {
  calculateTheoryCoAttainmentByStudent,
  calculateLabCoAttainmentByStudent,
  calculateCombinedCoAttainmentByStudent,
  calculateUnnormedCoAttainmentByStudent,
  calculateEqualWtCoAttainmentByStudent,
} = require('../utils/coAttainmentCalc');

const getTeacherCourses = async (teacherId) => {
  const courses = await Course.find({
    'assignedTeachers.teacher': teacherId
  }).select('courseCode courseTitle assignedTeachers assignedBatches yearLevel semester').lean();
  
  return courses.map(course => {
    const assignment = course.assignedTeachers.find(
      a => (a.teacher._id || a.teacher).toString() === teacherId.toString()
    );
    return {
      _id: course._id,  // Include the course ID
      courseCode: course.courseCode,
      courseTitle: course.courseTitle,
      section: assignment?.section || null,
      assignedBatches: Array.isArray(course.assignedBatches) ? course.assignedBatches : [],
      yearLevel: course.yearLevel,
      semester: course.semester
    };
  });
};

const getCourseByCode = async (courseCode) => {
  if (!courseCode) return null;
  return Course.findOne({ courseCode: { $regex: new RegExp(`^${courseCode}$`, 'i') } }).lean();
};

const normalizeCoNumber = (code) => {
  const raw = String(code || '').trim();
  const match = raw.match(/(CO|CLO)\d+/i);
  if (match) return match[0].toUpperCase().replace('CLO', 'CO');
  return raw.toUpperCase();
};

const buildCombinedCourseOutcomes = async (course) => {
  if (!course?.courseCode) return { coNumbers: [], sourceTypeMap: {} };

  const courseCode = course.courseCode.toUpperCase();
  const codeMatch = courseCode.match(/^([A-Z]+)\s*(\d+)$/i);
  const isLab = codeMatch ? parseInt(codeMatch[2], 10) % 2 === 0 : false;
  const currentType = isLab ? 'lab' : 'theory';

  let courseOutcomes = await CourseOutcome.find({ course: course._id, is_deleted: false })
    .sort({ co_code: 1 }).lean();

  let relatedOutcomes = [];
  if (codeMatch) {
    const prefix = codeMatch[1];
    const number = parseInt(codeMatch[2], 10);
    const relatedCourseCode = isLab ? `${prefix} ${number - 1}` : `${prefix} ${number + 1}`;
    const relatedCourse = await getCourseByCode(relatedCourseCode);
    if (relatedCourse) {
      relatedOutcomes = await CourseOutcome.find({ course: relatedCourse._id, is_deleted: false })
        .sort({ co_code: 1 }).lean();
    }
  }

  const ownCoCodes = new Set(courseOutcomes.map(co => String(co.co_code || '').toUpperCase()));
  const relatedCoCodes = new Set(relatedOutcomes.map(co => String(co.co_code || '').toUpperCase()));
  const coMap = new Map();

  [...courseOutcomes, ...relatedOutcomes].forEach(co => {
    const coCode = String(co.co_code || '').toUpperCase();
    if (!coMap.has(coCode)) {
      coMap.set(coCode, { coCode, sourceType: currentType });
    }
  });

  coMap.forEach((val, coCode) => {
    const inOwn = ownCoCodes.has(coCode);
    const inRelated = relatedCoCodes.has(coCode);
    if (inOwn && inRelated) {
      val.sourceType = 'both';
    } else if (inOwn) {
      val.sourceType = currentType;
    } else {
      val.sourceType = currentType === 'lab' ? 'theory' : 'lab';
    }
  });

  const coNumbers = Array.from(coMap.values())
    .sort((a, b) => a.coCode.localeCompare(b.coCode))
    .map(co => normalizeCoNumber(co.coCode));

  const sourceTypeMap = {};
  Array.from(coMap.values()).forEach(co => {
    sourceTypeMap[normalizeCoNumber(co.coCode)] = co.sourceType;
  });

  return { coNumbers, sourceTypeMap };
};

const getEnrolledStudentsForCourse = async (course) => {
  if (!course) return [];
  const assignedBatches = course.assignedBatches || [];
  if (assignedBatches.length === 0) return [];

  const students = await User.find({
    role: 'student',
    isActive: true,
    isEmailVerified: true,
    isApprovedByAdmin: true,
  }).select('name roll email').lean();

  const matched = students.filter(student => {
    let roll = student.roll;
    if (!roll && student.email) {
      const match = student.email.match(/^(\d+)/);
      if (match) roll = match[1];
    }
    if (!roll || roll.length < 4) return false;
    const batch = roll.substring(0, 2);
    const deptCode = roll.substring(2, 4);
    return assignedBatches.some(assignment => assignment.batch === batch && assignment.deptCode === deptCode);
  }).map(s => ({
    rollNumber: (s.roll || '').trim(),
    name: s.name || ''
  }));

  return matched.sort((a, b) => String(a.rollNumber).localeCompare(String(b.rollNumber), undefined, { numeric: true }));
};

const buildRollFallback = (rows) => {
  const seen = new Set();
  const list = [];
  (rows || []).forEach(r => {
    const roll = String(r?.rollNumber || '').trim();
    if (!roll || roll.toLowerCase() === 'roll') return;
    const key = roll.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    list.push({ rollNumber: roll, name: r?.name || '' });
  });
  return list;
};

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

const extractCONumbers = (sectionARows, courseOutcomes) => {
  if (courseOutcomes && courseOutcomes.length > 0) {
    return courseOutcomes
      .filter(co => !co.is_deleted)
      .map(co => normalizeCoNumber(co.co_code));
  }
  return (sectionARows || []).map(r => normalizeCoNumber(r.coNumber));
};

const loadCourseAttainmentData = async (courseId) => {
  const [termExamDoc, ctDoc, assignDoc, courseOutcomes, termMarksA, termMarksB] = await Promise.all([
    TermExamAttainment.findOne({ course: courseId }).lean(),
    CTAttainment.findOne({ course: courseId }).lean(),
    AssignmentAttainment.findOne({ course: courseId }).lean(),
    CourseOutcome.find({ course: courseId, is_deleted: false }).lean(),
    TermExamMarks.find({ course: courseId, section: 'A' }).populate('student', 'roll name').lean(),
    TermExamMarks.find({ course: courseId, section: 'B' }).populate('student', 'roll name').lean(),
  ]);

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
  const coNumbers = labActivityRows
    .map(row => normalizeCoNumber(row.coNumber))
    .filter(Boolean);

  return {
    coNumbers: [...new Set(coNumbers)],
    labActivityRows,
    labActivityScores: unwrapMap(labDoc.labActivityScores),
    labActivityObtainedRows: labDoc.labActivityObtainedRows || [],
    labAttendanceMarks: labDoc.labAttendanceMarks || 0,
    labQuizMarks: labDoc.labQuizMarks || 0,
    labVivaMarks: labDoc.labVivaMarks || 0,
    activityTaken: labDoc.activityTaken || 5,
    useEqWtActivity: labDoc.useEqWtActivity || 0,
    coMappedActivityMarks: labDoc.coMappedActivityMarks || 0,
    labActivityManualWts: unwrapMap(labDoc.labActivityManualWts),
    otherActivityRemaining: labDoc.otherActivityRemaining || 0,
    otherActivityMeasured: labDoc.otherActivityMeasured || 0,
  };
};

exports.getAttainmentData = async (req, res) => {
  try {
    const { sheetName } = req.params;
    
    res.json({
      success: true,
      data: {
        sheetName: sheetName || 'CT',
        metadata: {},
        coPoMatrix: {
          coLabels: ['CO1', 'CO2', 'CO3', 'CO4', 'CO5', 'CO6'],
          poLabels: ['PO1', 'PO2', 'PO3', 'PO4', 'PO5', 'PO6', 'PO7', 'PO8', 'PO9', 'PO10', 'PO11', 'PO12'],
          values: []
        },
        students: [], // Empty since data comes from MongoDB now
        summary: {}
      }
    });
  } catch (error) {
    console.error('Error reading attainment data:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

exports.getSheets = async (req, res) => {
  try {
    const allSheets = [
      'CourseProfile', 'CT', 'Attn_Assign', 'SectionA', 
      'SectionB', 'LabActivity', 'COAttainment', 'COCalc', 
      'COCalc_LabUnnorm', 'COPOMap', 'POCalcMax', 'Charts', 
      'POCalc', 'CheckPO'
    ];

    if (req.user.role === 'teacher') {
      const teacherCourses = await getTeacherCourses(req.user._id);
      
      res.json({
        success: true,
        sheets: allSheets,
        courses: teacherCourses
      });
    } else {
      res.json({
        success: true,
        sheets: allSheets
      });
    }
  } catch (error) {
    console.error('Error reading sheet names:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

exports.getCoAttainmentCalcs = async (req, res) => {
  try {
    const { courseId } = req.params;
    const course = await Course.findById(courseId).lean();
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    if (req.user.role === 'teacher') {
      const isAssigned = (course.assignedTeachers || []).some(assignment => {
        const teacherId = assignment.teacher?._id || assignment.teacher;
        return teacherId.toString() === req.user._id.toString();
      });
      if (!isAssigned) {
        return res.status(403).json({ success: false, message: 'Access denied. You are not assigned to this course.' });
      }
    }

    const courseCode = course.courseCode || '';
    const codeMatch = courseCode.match(/^([A-Z]+)\s*(\d+)$/i);
    const isLab = codeMatch ? parseInt(codeMatch[2], 10) % 2 === 0 : false;

    const theoryCode = codeMatch
      ? (isLab ? `${codeMatch[1]} ${parseInt(codeMatch[2], 10) - 1}` : `${codeMatch[1]} ${parseInt(codeMatch[2], 10)}`)
      : courseCode;
    const labCode = codeMatch
      ? (isLab ? `${codeMatch[1]} ${parseInt(codeMatch[2], 10)}` : `${codeMatch[1]} ${parseInt(codeMatch[2], 10) + 1}`)
      : '';

    const theoryCourse = await getCourseByCode(theoryCode);
    const labCourse = labCode ? await getCourseByCode(labCode) : null;

    const [theoryData, labData] = await Promise.all([
      theoryCourse ? loadCourseAttainmentData(theoryCourse._id) : Promise.resolve(null),
      labCourse ? loadLabCourseAttainmentData(labCourse._id) : Promise.resolve(null),
    ]);

    const { coNumbers: combinedCoNumbers, sourceTypeMap } = await buildCombinedCourseOutcomes(course);
    const coNumbers = combinedCoNumbers.length > 0
      ? combinedCoNumbers
      : (theoryData?.coNumbers?.length ? theoryData.coNumbers : (labData?.coNumbers || []));

    const theoryStudents = theoryCourse ? await getEnrolledStudentsForCourse(theoryCourse) : [];
    const labStudents = labCourse ? await getEnrolledStudentsForCourse(labCourse) : [];

    const theoryFallback = buildRollFallback([
      ...(theoryData?.sectionAData?.sectionAObtainedRows || []),
      ...(theoryData?.sectionBData?.sectionBObtainedRows || []),
      ...(theoryData?.ctData?.ctObtainedRows || []),
      ...(theoryData?.assignData?.attnAssignObtainedRows || []),
    ]);

    const labFallback = buildRollFallback([
      ...(labData?.labActivityObtainedRows || [])
    ]);

    const finalTheoryStudents = theoryStudents.length > 0 ? theoryStudents : theoryFallback;
    const finalLabStudents = labStudents.length > 0 ? labStudents : labFallback;

    const combinedBaseStudents = finalTheoryStudents.length > 0
      ? finalTheoryStudents
      : finalLabStudents;

    const theoryCoAttainmentData = theoryData && coNumbers.length > 0
      ? calculateTheoryCoAttainmentByStudent(finalTheoryStudents, coNumbers, theoryData)
      : [];

    const labCoAttainmentData = labData && coNumbers.length > 0
      ? calculateLabCoAttainmentByStudent(finalLabStudents, coNumbers, labData)
      : [];

    const combinedCoAttainmentData = (combinedBaseStudents.length > 0 && coNumbers.length > 0)
      ? calculateCombinedCoAttainmentByStudent(combinedBaseStudents, coNumbers, theoryData || {}, labData || {})
      : [];

    const unnormedCoAttainmentData = (combinedBaseStudents.length > 0 && coNumbers.length > 0)
      ? calculateUnnormedCoAttainmentByStudent(combinedBaseStudents, coNumbers, theoryData || {}, labData || {})
      : [];

    const equalWtCoAttainmentData = coNumbers.length > 0
      ? calculateEqualWtCoAttainmentByStudent(theoryCoAttainmentData, labCoAttainmentData, coNumbers, sourceTypeMap)
      : [];

    return res.json({
      success: true,
      data: {
        theoryCoAttainmentData,
        labCoAttainmentData,
        combinedCoAttainmentData,
        unnormedCoAttainmentData,
        equalWtCoAttainmentData,
      }
    });
  } catch (error) {
    console.error('Error calculating CO attainment:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

exports.saveCTData = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { ctRows, ctFactors, ctManualWts, ctEqWts, ctSummary, ctObtainedRows } = req.body;

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    if (req.user.role === 'teacher') {
      const isAssigned = course.assignedTeachers.some(assignment => {
        const teacherId = assignment.teacher?._id || assignment.teacher;
        return teacherId.toString() === req.user._id.toString();
      });

      if (!isAssigned) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You are not assigned to this course.'
        });
      }
    }

    const cleanedCtObtainedRows = (ctObtainedRows || []).map(({ _id, __v, ...rest }) => rest);
    const ctData = await CTAttainment.findOneAndUpdate(
      { course: courseId },
      {
        $set: {
          course: courseId,
          ctRows,
          ctFactors,
          ctManualWts,
          ctEqWts,
          ctSummary,
          ctObtainedRows: cleanedCtObtainedRows,
          updatedBy: req.user._id
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: false }
    );

    res.json({
      success: true,
      message: 'CT data saved successfully',
      data: ctData
    });
  } catch (error) {
    console.error('Error saving CT data:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

exports.getCTData = async (req, res) => {
  try {
    const { courseId } = req.params;

    const [course, ctData] = await Promise.all([
      Course.findById(courseId).select('assignedTeachers assignedBatches').lean(),
      CTAttainment.findOne({ course: courseId }).lean()
    ]);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    if (req.user.role === 'teacher') {
      const isAssigned = course.assignedTeachers.some(assignment => {
        const teacherId = assignment.teacher?._id || assignment.teacher;
        return teacherId.toString() === req.user._id.toString();
      });

      if (!isAssigned) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You are not assigned to this course.'
        });
      }
    }

    const assignedBatches = course.assignedBatches || [];
    let enrolledStudents = [];

    if (assignedBatches.length > 0) {
      const students = await User.find({
        role: 'student',
        isActive: true,
        isEmailVerified: true,
        isApprovedByAdmin: true
      }).select('name roll email department').lean();

      enrolledStudents = students.filter(student => {
        let roll = student.roll;
        if (!roll && student.email) {
          const match = student.email.match(/^(\d+)/);
          if (match) roll = match[1];
        }
        if (!roll || roll.length < 4) return false;

        const batch = roll.substring(0, 2);
        const deptCode = roll.substring(2, 4);

        return assignedBatches.some(assignment => 
          assignment.batch === batch && assignment.deptCode === deptCode
        );
      }).map(s => {
          let roll = s.roll;
          if (!roll && s.email) {
            const match = s.email.match(/^(\d+)/);
            if (match) roll = match[1];
          }
          return { rollNumber: roll, name: s.name };
      }).sort((a, b) => (a.rollNumber || '').localeCompare(b.rollNumber || '', undefined, { numeric: true }));
    }

    let responseData = ctData;

    if (!responseData) {
      responseData = {
        course: courseId,
        ctRows: [],
        ctFactors: { CT1: 1, CT2: 1, CT3: 1 },
        ctManualWts: {},
        ctEqWts: { CT1: 0, CT2: 0, CT3: 0 },
        ctSummary: { ctTaken: 0, coMappedMarks60: 0, useEqWt: 0 },
        ctObtainedRows: enrolledStudents.map(s => ({
          rollNumber: s.rollNumber,
          name: s.name,
          CT1_Q1: 0, CT1_Q2: 0, CT1_Q3: 0,
          CT2_Q1: 0, CT2_Q2: 0, CT2_Q3: 0,
          CT3_Q1: 0, CT3_Q2: 0, CT3_Q3: 0
        }))
      };
      
      return res.json({
        success: true,
        message: 'No CT data found, initialized from enrollment',
        data: responseData
      });
    }

    if (enrolledStudents.length > 0) {
      const existingRolls = new Set((responseData.ctObtainedRows || []).map(r => String(r.rollNumber || '').trim()));
      const missingStudents = enrolledStudents.filter(s => !existingRolls.has(String(s.rollNumber).trim()));

      if (missingStudents.length > 0) {
        const newRows = missingStudents.map(s => ({
          rollNumber: s.rollNumber,
          name: s.name,
          CT1_Q1: 0, CT1_Q2: 0, CT1_Q3: 0,
          CT2_Q1: 0, CT2_Q2: 0, CT2_Q3: 0,
          CT3_Q1: 0, CT3_Q2: 0, CT3_Q3: 0
        }));

        responseData.ctObtainedRows = [...(responseData.ctObtainedRows || []), ...newRows];
        responseData.ctObtainedRows.sort((a, b) => 
           (String(a.rollNumber) || '').localeCompare(String(b.rollNumber) || '', undefined, { numeric: true })
        );
      }
    }

    res.json({
      success: true,
      data: responseData
    });
  } catch (error) {
    console.error('Error getting CT data:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

exports.parseCTUpload = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const { courseId } = req.params;

    const course = await Course.findById(courseId).select('assignedTeachers').lean();
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    if (req.user.role === 'teacher') {
      const isAssigned = course.assignedTeachers.some(assignment => {
        const teacherId = assignment.teacher?._id || assignment.teacher;
        return teacherId.toString() === req.user._id.toString();
      });
      if (!isAssigned) {
        return res.status(403).json({ success: false, message: 'Access denied.' });
      }
    }

    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();

    const fileName = req.file.originalname.toLowerCase();
    const isCSV = fileName.endsWith('.csv') || req.file.mimetype === 'text/csv' || req.file.mimetype === 'application/csv';

    if (isCSV) {
      const { Readable } = require('stream');
      const stream = Readable.from(req.file.buffer.toString('utf-8'));
      await workbook.csv.read(stream);
    } else {
      await workbook.xlsx.load(req.file.buffer);
    }

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return res.status(400).json({ success: false, message: 'No worksheet found in file' });
    }

    const totalRows = worksheet.rowCount;
    let manualWt = null;
    let q1Total = 0, q2Total = 0, q3Total = 0;
    let q1CO = null, q2CO = null, q3CO = null;
    let dataStartRow = -1;

    const getCellText = (val) => {
      if (val == null) return '';
      if (typeof val === 'object') {
        if (Array.isArray(val.richText))
          return val.richText.map(rt => (rt.text || '')).join('');
        if ('result' in val && val.result != null) return getCellText(val.result);
      }
      return val.toString();
    };

    const extractTotal = (cellValue) => {
      const str = getCellText(cellValue).replace(/\s+/g, '');
      const match = str.match(/\((\d+(?:\.\d+)?)\)/);
      return match ? parseFloat(match[1]) : 0;
    };

    const extractCO = (cellValue) => {
      const str = getCellText(cellValue).replace(/\s+/g, '');
      const m = str.match(/\(((?:CO|CLO)\d+)\)/i);
      if (!m) return null;
      return m[1].replace(/^CLO/i, 'CO').toUpperCase();
    };

    let q1Col = -1, q2Col = -1, q3Col = -1;

    for (let r = 1; r <= totalRows; r++) {
      const row = worksheet.getRow(r);
      const col1 = getCellText(row.getCell(1).value).trim();

      if (col1.toLowerCase() === 'manual wt') {
        manualWt = parseFloat(getCellText(row.getCell(2).value)) || 0;
        continue;
      }

      if (col1.toLowerCase() === 'roll') {
        const maxC = Math.max(worksheet.columnCount || 0, row.cellCount || 0, 20);
        let foundQ = false;
        for (let c = 2; c <= maxC; c++) {
          const cv = getCellText(row.getCell(c).value).trim();
          if (!cv) continue;
          if (/^q\s*1\b/i.test(cv)) {
            q1Col = c; q1Total = extractTotal(cv) || q1Total; q1CO = extractCO(cv) || q1CO; foundQ = true;
          } else if (/^q\s*2\b/i.test(cv)) {
            q2Col = c; q2Total = extractTotal(cv) || q2Total; q2CO = extractCO(cv) || q2CO; foundQ = true;
          } else if (/^q\s*3\b/i.test(cv)) {
            q3Col = c; q3Total = extractTotal(cv) || q3Total; q3CO = extractCO(cv) || q3CO; foundQ = true;
          }
        }
        dataStartRow = r + 1;
        if (foundQ) break;
        continue;
      }

      if (dataStartRow !== -1 && col1 && col1.toLowerCase() !== 'roll') break;
    }

    if (!q1CO || !q2CO || !q3CO || (!q1Total && !q2Total && !q3Total)) {
      for (let r = 1; r <= totalRows; r++) {
        const row = worksheet.getRow(r);
        const c1 = getCellText(row.getCell(1).value).trim().toLowerCase();
        if (c1 !== 'co no.' && c1 !== 'co no') continue;
        const maxC2 = Math.max(worksheet.columnCount || 0, row.cellCount || 0, 20);
        let tq1 = -1, tq2 = -1, tq3 = -1;
        for (let c = 2; c <= maxC2; c++) {
          const cv = getCellText(row.getCell(c).value).trim();
          if (!cv) continue;
          if (/^q\s*1\b/i.test(cv) && tq1 === -1) { tq1 = c; if (!q1Total) q1Total = extractTotal(cv); }
          else if (/^q\s*2\b/i.test(cv) && tq2 === -1) { tq2 = c; if (!q2Total) q2Total = extractTotal(cv); }
          else if (/^q\s*3\b/i.test(cv) && tq3 === -1) { tq3 = c; if (!q3Total) q3Total = extractTotal(cv); }
        }
        if (tq1 === -1 && tq2 === -1 && tq3 === -1) continue;
        let q1Sum = 0, q2Sum = 0, q3Sum = 0;
        for (let dr = r + 1; dr <= totalRows; dr++) {
          const drow = worksheet.getRow(dr);
          const dc1 = getCellText(drow.getCell(1).value).trim();
          if (!dc1 || !/^(CO|CLO)\d+$/i.test(dc1)) break;
          const coNum = dc1.replace(/^CLO/i, 'CO').toUpperCase();
          if (tq1 !== -1) { const v = parseFloat(getCellText(drow.getCell(tq1).value)) || 0; q1Sum += v; if (v > 0 && !q1CO) q1CO = coNum; }
          if (tq2 !== -1) { const v = parseFloat(getCellText(drow.getCell(tq2).value)) || 0; q2Sum += v; if (v > 0 && !q2CO) q2CO = coNum; }
          if (tq3 !== -1) { const v = parseFloat(getCellText(drow.getCell(tq3).value)) || 0; q3Sum += v; if (v > 0 && !q3CO) q3CO = coNum; }
        }
        if (!q1Total && q1Sum > 0) q1Total = q1Sum;
        if (!q2Total && q2Sum > 0) q2Total = q2Sum;
        if (!q3Total && q3Sum > 0) q3Total = q3Sum;
        break;
      }
    }

    if (dataStartRow === -1) {
      return res.json({
        success: true,
        data: { manualWt, q1Total, q2Total, q3Total, q1CO, q2CO, q3CO, hasQ1: false, hasQ2: false, hasQ3: false, rows: [] }
      });
    }

    const parseCTCellValue = (raw) => {
      const str = getCellText(raw).trim();
      if (str === '') return null;
      if (str.toLowerCase() === 'a') return 'A';
      return parseFloat(str) ?? 0;
    };

    const rows = [];
    let emptyStreak = 0;
    for (let rowNum = dataStartRow; rowNum <= totalRows; rowNum++) {
      const dataRow = worksheet.getRow(rowNum);
      const rawRoll = dataRow.getCell(1).value;
      const rollStr = getCellText(rawRoll).trim();
      if (!rollStr) {
        emptyStreak++;
        if (emptyStreak >= 5) break;
        continue;
      }
      emptyStreak = 0;
      if (!rollStr || rollStr.toLowerCase() === 'roll') continue;
      rows.push({
        rollNumber: rollStr,
        q1: q1Col !== -1 ? parseCTCellValue(dataRow.getCell(q1Col).value) : null,
        q2: q2Col !== -1 ? parseCTCellValue(dataRow.getCell(q2Col).value) : null,
        q3: q3Col !== -1 ? parseCTCellValue(dataRow.getCell(q3Col).value) : null,
      });
    }

    return res.json({
      success: true,
      data: { manualWt, q1Total, q2Total, q3Total, q1CO, q2CO, q3CO, hasQ1: q1Col !== -1, hasQ2: q2Col !== -1, hasQ3: q3Col !== -1, rows }
    });
  } catch (error) {
    console.error('Error parsing CT upload:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.parseLabUpload = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const { courseId } = req.params;
    const course = await Course.findById(courseId).select('assignedTeachers').lean();
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
    if (req.user.role === 'teacher') {
      const isAssigned = course.assignedTeachers.some(a => {
        const tid = a.teacher?._id || a.teacher;
        return tid.toString() === req.user._id.toString();
      });
      if (!isAssigned) return res.status(403).json({ success: false, message: 'Access denied.' });
    }
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const fileName = req.file.originalname.toLowerCase();
    const isCSV = fileName.endsWith('.csv') || req.file.mimetype === 'text/csv' || req.file.mimetype === 'application/csv';
    if (isCSV) {
      const { Readable } = require('stream');
      await workbook.csv.read(Readable.from(req.file.buffer.toString('utf-8')));
    } else {
      await workbook.xlsx.load(req.file.buffer);
    }
    const worksheet = workbook.worksheets[0];
    if (!worksheet) return res.status(400).json({ success: false, message: 'No worksheet found' });

    const totalRows = worksheet.rowCount;
    let manualWt = null;
    let attnTotal = 0, quizTotal = 0, vivaTotal = 0, otherTotal = 0;
    let q1Total = 0, q2Total = 0, q3Total = 0;
    let q1CO = null, q2CO = null, q3CO = null;
    let dataStartRow = -1;

    const getCellText = (val) => {
      if (val == null) return '';
      if (typeof val === 'object') {
        if (Array.isArray(val.richText))
          return val.richText.map(rt => (rt.text || '')).join('');
        if ('result' in val && val.result != null) return getCellText(val.result);
      }
      return val.toString();
    };
    const extractTotal = (cv) => {
      const s = getCellText(cv).replace(/\s+/g, '');
      const m2 = s.match(/\((\d+(?:\.\d+)?)\)/);
      return m2 ? parseFloat(m2[1]) : 0;
    };
    const extractCO = (cv) => {
      const s = getCellText(cv).replace(/\s+/g, '');
      const m = s.match(/\(((?:CO|CLO)\d+)\)/i);
      if (!m) return null;
      return m[1].replace(/^CLO/i, 'CO').toUpperCase();
    };

    let attnCol = -1, quizCol = -1, vivaCol = -1, otherCol = -1;
    let q1Col = -1, q2Col = -1, q3Col = -1;

    for (let r = 1; r <= totalRows; r++) {
      const row = worksheet.getRow(r);
      const col1 = getCellText(row.getCell(1).value).trim();
      if (col1.toLowerCase() === 'manual wt') { manualWt = parseFloat(getCellText(row.getCell(2).value)) || 0; continue; }
      if (col1.toLowerCase() === 'roll') {
        const maxC = Math.max(worksheet.columnCount || 0, row.cellCount || 0, 20);
        for (let c = 2; c <= maxC; c++) {
          const cv = getCellText(row.getCell(c).value).trim();
          const cvL = cv.toLowerCase();
          if (!cvL) continue;
          if (cvL.startsWith('attn')) {
            attnCol = c;
            const t = extractTotal(cv); if (t) attnTotal = t;
          } else if (cvL.startsWith('quiz')) {
            quizCol = c;
            const t = extractTotal(cv); if (t) quizTotal = t;
          } else if (cvL.includes('viva')) {
            vivaCol = c;
            const t = extractTotal(cv); if (t) vivaTotal = t;
          } else if (cvL.startsWith('other')) {
            otherCol = c;
            const t = extractTotal(cv); if (t) otherTotal = t;
          } else if (/^q\s*1\b/i.test(cv)) {
            q1Col = c; q1Total = extractTotal(cv); q1CO = extractCO(cv);
          } else if (/^q\s*2\b/i.test(cv)) {
            q2Col = c; q2Total = extractTotal(cv); q2CO = extractCO(cv);
          } else if (/^q\s*3\b/i.test(cv)) {
            q3Col = c; q3Total = extractTotal(cv); q3CO = extractCO(cv);
          }
        }
        dataStartRow = r + 1;
        break;
      }
    }
    if (!q1CO || !q2CO || !q3CO || (!q1Total && !q2Total && !q3Total)) {
      for (let r = 1; r <= totalRows; r++) {
        const row = worksheet.getRow(r);
        const c1 = getCellText(row.getCell(1).value).trim().toLowerCase();
        if (c1 !== 'co no.' && c1 !== 'co no') continue;
        const maxC2 = Math.max(worksheet.columnCount || 0, row.cellCount || 0, 20);
        let tq1 = -1, tq2 = -1, tq3 = -1;
        for (let c = 2; c <= maxC2; c++) {
          const cv = getCellText(row.getCell(c).value).trim();
          if (!cv) continue;
          if (/^q\s*1\b/i.test(cv) && tq1 === -1) { tq1 = c; if (!q1Total) q1Total = extractTotal(cv); }
          else if (/^q\s*2\b/i.test(cv) && tq2 === -1) { tq2 = c; if (!q2Total) q2Total = extractTotal(cv); }
          else if (/^q\s*3\b/i.test(cv) && tq3 === -1) { tq3 = c; if (!q3Total) q3Total = extractTotal(cv); }
        }
        if (tq1 === -1 && tq2 === -1 && tq3 === -1) continue;
        let q1Sum = 0, q2Sum = 0, q3Sum = 0;
        for (let dr = r + 1; dr <= totalRows; dr++) {
          const drow = worksheet.getRow(dr);
          const dc1 = getCellText(drow.getCell(1).value).trim();
          if (!dc1 || !/^(CO|CLO)\d+$/i.test(dc1)) break;
          const coNum = dc1.replace(/^CLO/i, 'CO').toUpperCase();
          if (tq1 !== -1) { const v = parseFloat(getCellText(drow.getCell(tq1).value)) || 0; q1Sum += v; if (v > 0 && !q1CO) q1CO = coNum; }
          if (tq2 !== -1) { const v = parseFloat(getCellText(drow.getCell(tq2).value)) || 0; q2Sum += v; if (v > 0 && !q2CO) q2CO = coNum; }
          if (tq3 !== -1) { const v = parseFloat(getCellText(drow.getCell(tq3).value)) || 0; q3Sum += v; if (v > 0 && !q3CO) q3CO = coNum; }
        }
        if (!q1Total && q1Sum > 0) q1Total = q1Sum;
        if (!q2Total && q2Sum > 0) q2Total = q2Sum;
        if (!q3Total && q3Sum > 0) q3Total = q3Sum;
        break;
      }
    }
    if (dataStartRow === -1) {
      console.log('[parseLabUpload] No "Roll" header row found. totalRows=%d. First 5 col-1 values:', totalRows,
        Array.from({ length: Math.min(5, totalRows) }, (_, i) => getCellText(worksheet.getRow(i + 1).getCell(1).value).trim())
      );
      return res.json({ success: true, data: { manualWt, attnTotal, quizTotal, vivaTotal, otherTotal, q1Total, q2Total, q3Total, q1CO, q2CO, q3CO, hasAttn: false, hasQuiz: false, hasViva: false, hasOther: false, hasQ1: false, hasQ2: false, hasQ3: false, rows: [] } });
    }
    const hasAttn = attnCol !== -1;
    const hasQuiz = quizCol !== -1;
    const hasViva = vivaCol !== -1;
    const hasOther = otherCol !== -1;

    const parseVal = (raw) => {
      const s = getCellText(raw).trim();
      if (s === '') return null;
      if (s.toLowerCase() === 'a') return 'A';
      return parseFloat(s) ?? 0;
    };
    const rows = [];
    let emptyStreak = 0;
    for (let rn = dataStartRow; rn <= totalRows; rn++) {
      const dr = worksheet.getRow(rn);
      const rawRoll = dr.getCell(1).value;
      const rollStr = getCellText(rawRoll).trim();
      if (!rollStr) {
        if (++emptyStreak >= 5) break;
        continue;
      }
      emptyStreak = 0;
      if (rollStr.toLowerCase() === 'roll') continue;
      rows.push({
        rollNumber: rollStr,
        attn: hasAttn ? parseVal(dr.getCell(attnCol).value) : null,
        quiz: hasQuiz ? parseVal(dr.getCell(quizCol).value) : null,
        viva: hasViva ? parseVal(dr.getCell(vivaCol).value) : null,
        q1: q1Col !== -1 ? parseVal(dr.getCell(q1Col).value) : null,
        q2: q2Col !== -1 ? parseVal(dr.getCell(q2Col).value) : null,
        q3: q3Col !== -1 ? parseVal(dr.getCell(q3Col).value) : null,
        other: hasOther ? parseVal(dr.getCell(otherCol).value) : null,
      });
    }
    console.log('[parseLabUpload] Parsed OK — rows=%d attnTotal=%s quizTotal=%s q1Total=%s q1CO=%s q2Total=%s q2CO=%s otherTotal=%s', rows.length, attnTotal, quizTotal, q1Total, q1CO, q2Total, q2CO, otherTotal);
    return res.json({ success: true, data: { manualWt, attnTotal, quizTotal, vivaTotal, otherTotal, q1Total, q2Total, q3Total, q1CO, q2CO, q3CO, hasAttn, hasQuiz, hasViva, hasOther, hasQ1: q1Col !== -1, hasQ2: q2Col !== -1, hasQ3: q3Col !== -1, rows } });
  } catch (error) {
    console.error('Error parsing lab upload:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.parseAssignUpload = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const { courseId } = req.params;
    const course = await Course.findById(courseId).select('assignedTeachers').lean();
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
    if (req.user.role === 'teacher') {
      const isAssigned = course.assignedTeachers.some(a => {
        const tid = a.teacher?._id || a.teacher;
        return tid.toString() === req.user._id.toString();
      });
      if (!isAssigned) return res.status(403).json({ success: false, message: 'Access denied.' });
    }
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const fileName = req.file.originalname.toLowerCase();
    const isCSV = fileName.endsWith('.csv') || req.file.mimetype === 'text/csv' || req.file.mimetype === 'application/csv';
    if (isCSV) {
      const { Readable } = require('stream');
      await workbook.csv.read(Readable.from(req.file.buffer.toString('utf-8')));
    } else {
      await workbook.xlsx.load(req.file.buffer);
    }
    const worksheet = workbook.worksheets[0];
    if (!worksheet) return res.status(400).json({ success: false, message: 'No worksheet found' });

    const totalRows = worksheet.rowCount;
    let manualWt = null;
    let q1Total = 0, q2Total = 0, q3Total = 0;
    let q1CO = null, q2CO = null, q3CO = null;
    let dataStartRow = -1;

    const getCellText = (val) => {
      if (val == null) return '';
      if (typeof val === 'object') {
        if (Array.isArray(val.richText))
          return val.richText.map(rt => (rt.text || '')).join('');
        if ('result' in val && val.result != null) return getCellText(val.result);
      }
      return val.toString();
    };
    const extractTotal = (cv) => {
      const s = getCellText(cv).replace(/\s+/g, '');
      const m2 = s.match(/\((\d+(?:\.\d+)?)\)/);
      return m2 ? parseFloat(m2[1]) : 0;
    };
    const extractCO = (cv) => {
      const s = getCellText(cv).replace(/\s+/g, '');
      const m = s.match(/\(((?:CO|CLO)\d+)\)/i);
      if (!m) return null;
      return m[1].replace(/^CLO/i, 'CO').toUpperCase();
    };

    let attnPerfCol = -1, q1Col = -1, q2Col = -1, q3Col = -1;
    for (let r = 1; r <= totalRows; r++) {
      const row = worksheet.getRow(r);
      const col1 = getCellText(row.getCell(1).value).trim();
      if (col1.toLowerCase() === 'manual wt') { manualWt = parseFloat(getCellText(row.getCell(2).value)) || 0; continue; }
      if (col1.toLowerCase() === 'roll') {
        const maxC = Math.max(worksheet.columnCount || 0, row.cellCount || 0, 20);
        for (let c = 2; c <= maxC; c++) {
          const cv = getCellText(row.getCell(c).value).trim();
          const cvL = cv.toLowerCase();
          if (!cvL) continue;
          if (cvL.startsWith('attn')) {
            attnPerfCol = c;
          } else if (/^q\s*1\b/i.test(cv)) {
            q1Col = c; q1Total = extractTotal(cv); q1CO = extractCO(cv);
          } else if (/^q\s*2\b/i.test(cv)) {
            q2Col = c; q2Total = extractTotal(cv); q2CO = extractCO(cv);
          } else if (/^q\s*3\b/i.test(cv)) {
            q3Col = c; q3Total = extractTotal(cv); q3CO = extractCO(cv);
          }
        }
        dataStartRow = r + 1;
        break;
      }
    }
    if (!q1CO || !q2CO || !q3CO || (!q1Total && !q2Total && !q3Total)) {
      for (let r = 1; r <= totalRows; r++) {
        const row = worksheet.getRow(r);
        const c1 = getCellText(row.getCell(1).value).trim().toLowerCase();
        if (c1 !== 'co no.' && c1 !== 'co no') continue;
        const maxC2 = Math.max(worksheet.columnCount || 0, row.cellCount || 0, 20);
        let tq1 = -1, tq2 = -1, tq3 = -1;
        for (let c = 2; c <= maxC2; c++) {
          const cv = getCellText(row.getCell(c).value).trim();
          if (!cv) continue;
          if (/^q\s*1\b/i.test(cv) && tq1 === -1) { tq1 = c; if (!q1Total) q1Total = extractTotal(cv); }
          else if (/^q\s*2\b/i.test(cv) && tq2 === -1) { tq2 = c; if (!q2Total) q2Total = extractTotal(cv); }
          else if (/^q\s*3\b/i.test(cv) && tq3 === -1) { tq3 = c; if (!q3Total) q3Total = extractTotal(cv); }
        }
        if (tq1 === -1 && tq2 === -1 && tq3 === -1) continue;
        let q1Sum = 0, q2Sum = 0, q3Sum = 0;
        for (let dr = r + 1; dr <= totalRows; dr++) {
          const drow = worksheet.getRow(dr);
          const dc1 = getCellText(drow.getCell(1).value).trim();
          if (!dc1 || !/^(CO|CLO)\d+$/i.test(dc1)) break;
          const coNum = dc1.replace(/^CLO/i, 'CO').toUpperCase();
          if (tq1 !== -1) { const v = parseFloat(getCellText(drow.getCell(tq1).value)) || 0; q1Sum += v; if (v > 0 && !q1CO) q1CO = coNum; }
          if (tq2 !== -1) { const v = parseFloat(getCellText(drow.getCell(tq2).value)) || 0; q2Sum += v; if (v > 0 && !q2CO) q2CO = coNum; }
          if (tq3 !== -1) { const v = parseFloat(getCellText(drow.getCell(tq3).value)) || 0; q3Sum += v; if (v > 0 && !q3CO) q3CO = coNum; }
        }
        if (!q1Total && q1Sum > 0) q1Total = q1Sum;
        if (!q2Total && q2Sum > 0) q2Total = q2Sum;
        if (!q3Total && q3Sum > 0) q3Total = q3Sum;
        break;
      }
    }
    if (dataStartRow === -1) {
      return res.json({ success: true, data: { manualWt, q1Total, q2Total, q3Total, q1CO, q2CO, q3CO, hasAttnPerf: false, hasQ1: false, hasQ2: false, hasQ3: false, rows: [] } });
    }
    const hasAttnPerf = attnPerfCol !== -1;
    const parseVal = (raw) => {
      const s = getCellText(raw).trim();
      if (s === '') return null;
      if (s.toLowerCase() === 'a') return 'A';
      return parseFloat(s) ?? 0;
    };
    const rows = [];
    let emptyStreak = 0;
    for (let rn = dataStartRow; rn <= totalRows; rn++) {
      const dr = worksheet.getRow(rn);
      const rawRoll = dr.getCell(1).value;
      const rollStr = getCellText(rawRoll).trim();
      if (!rollStr) {
        if (++emptyStreak >= 5) break;
        continue;
      }
      emptyStreak = 0;
      if (rollStr.toLowerCase() === 'roll') continue;
      rows.push({
        rollNumber: rollStr,
        attnPerf: hasAttnPerf ? parseVal(dr.getCell(attnPerfCol).value) : null,
        q1: q1Col !== -1 ? parseVal(dr.getCell(q1Col).value) : null,
        q2: q2Col !== -1 ? parseVal(dr.getCell(q2Col).value) : null,
        q3: q3Col !== -1 ? parseVal(dr.getCell(q3Col).value) : null,
      });
    }
    return res.json({ success: true, data: { manualWt, q1Total, q2Total, q3Total, q1CO, q2CO, q3CO, hasAttnPerf, hasQ1: q1Col !== -1, hasQ2: q2Col !== -1, hasQ3: q3Col !== -1, rows } });
  } catch (error) {
    console.error('Error parsing assignment upload:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getTermExamMarks = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { section } = req.query;

    const query = { course: courseId };
    if (section) {
      query.section = section;
    }

    const [course, termMarks] = await Promise.all([
      Course.findById(courseId).select('assignedTeachers').lean(),
      TermExamMarks.find(query)
        .populate('student', 'name roll email')
        .populate('enteredBy', 'name email')
        .sort({ 'student.roll': 1 })
        .lean()
    ]);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

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

    const formattedMarks = termMarks.map(mark => {
      const marksObj = {};
      
      const sourceMarks = mark.marks;
      
      if (sourceMarks) {
        const marksEntries = sourceMarks instanceof Map ? 
          Array.from(sourceMarks.entries()) : 
          Object.entries(sourceMarks);
        
        for (const [key, value] of marksEntries) {
          if (['a', 'b', 'c', 'd'].includes(key)) {
            marksObj[key] = {};
            
            const questionEntries = value instanceof Map ? 
              Array.from(value.entries()) : 
              Object.entries(value || {});
            
            for (const [qKey, qVal] of questionEntries) {
              marksObj[key][qKey] = qVal;
            }
          }
        }
      }
      
      return {
        student: {
          _id: mark.student._id,
          roll: mark.student.roll,
          rollNumber: mark.student.roll,
          name: mark.student.name,
          email: mark.student.email
        },
        rollNumber: mark.student.roll, // Also provide at top level for convenience
        section: mark.section,
        marks: marksObj, // Only a, b, c, d rows (not e, f, g)
        totalMarks: mark.totalMarks,
        imageUrl: mark.imageUrl,
        enteredBy: mark.enteredBy,
        lastModified: mark.lastModified
      };
    });

    res.json({
      success: true,
      count: formattedMarks.length,
      data: formattedMarks
    });
  } catch (error) {
    console.error('Error getting term exam marks for attainment:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

exports.saveAssignmentData = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { assignmentRows, assignmentManualWts, assignmentSummary, attendanceMarks, attnAssignObtainedRows } = req.body;

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    if (req.user.role === 'teacher') {
      const isAssigned = course.assignedTeachers.some(assignment => {
        const teacherId = assignment.teacher?._id || assignment.teacher;
        return teacherId.toString() === req.user._id.toString();
      });

      if (!isAssigned) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You are not assigned to this course.'
        });
      }
    }

    const User = require('../models/User');
    const assignedBatches = course.assignedBatches || [];
    let validRollSet = null; // null means "no batch configured — allow all"
    if (assignedBatches.length > 0) {
      const allStudents = await User.find({
        role: 'student',
        isActive: true,
        isEmailVerified: true,
        isApprovedByAdmin: true,
      }).select('roll email').lean();
      const enrolledRolls = allStudents
        .map(s => {
          let roll = s.roll;
          if (!roll && s.email) {
            const m = s.email.match(/^(\d+)/);
            if (m) roll = m[1];
          }
          return roll;
        })
        .filter(roll => {
          if (!roll || roll.length < 4) return false;
          const batch = roll.substring(0, 2);
          const deptCode = roll.substring(2, 4);
          return assignedBatches.some(a => a.batch === batch && a.deptCode === deptCode);
        });
      validRollSet = new Set(enrolledRolls.map(r => String(r).trim()));
    }

    const rawObtainedRows = (attnAssignObtainedRows || []).map(({ _id, __v, ...rest }) => rest);
    const cleanedObtainedRows = validRollSet
      ? rawObtainedRows.filter(r => r.rollNumber && validRollSet.has(String(r.rollNumber).trim()))
      : rawObtainedRows;
    const assignmentData = await AssignmentAttainment.findOneAndUpdate(
      { course: courseId },
      {
        $set: {
          course: courseId,
          assignmentRows,
          assignmentManualWts,
          assignmentSummary,
          attendanceMarks,
          attnAssignObtainedRows: cleanedObtainedRows,
          updatedBy: req.user._id
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: false }
    );

    res.json({
      success: true,
      message: 'Assignment/Attendance data saved successfully',
      data: assignmentData
    });
  } catch (error) {
    console.error('Error saving assignment data:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

exports.getAssignmentData = async (req, res) => {
  try {
    const { courseId } = req.params;

    const [course, assignmentData] = await Promise.all([
      Course.findById(courseId).select('assignedTeachers assignedBatches').lean(),
      AssignmentAttainment.findOne({ course: courseId }).lean()
    ]);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    if (req.user.role === 'teacher') {
      const isAssigned = course.assignedTeachers.some(assignment => {
        const teacherId = assignment.teacher?._id || assignment.teacher;
        return teacherId.toString() === req.user._id.toString();
      });

      if (!isAssigned) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You are not assigned to this course.'
        });
      }
    }

    const assignedBatches = course.assignedBatches || [];
    let enrolledStudents = [];

    if (assignedBatches.length > 0) {
      const students = await User.find({
        role: 'student',
        isActive: true,
        isEmailVerified: true,
        isApprovedByAdmin: true
      }).select('name roll email department').lean();

      enrolledStudents = students.filter(student => {
        let roll = student.roll;
        if (!roll && student.email) {
          const match = student.email.match(/^(\d+)/);
          if (match) roll = match[1];
        }
        if (!roll || roll.length < 4) return false;

        const batch = roll.substring(0, 2);
        const deptCode = roll.substring(2, 4);

        return assignedBatches.some(assignment => 
          assignment.batch === batch && assignment.deptCode === deptCode
        );
      }).map(s => {
          let roll = s.roll;
          if (!roll && s.email) {
            const match = s.email.match(/^(\d+)/);
            if (match) roll = match[1];
          }
          return { rollNumber: roll, name: s.name };
      }).sort((a, b) => (a.rollNumber || '').localeCompare(b.rollNumber || '', undefined, { numeric: true }));
    }

    let responseData = assignmentData;

    if (!responseData) {
      responseData = {
        course: courseId,
        assignmentRows: [],
        assignmentManualWts: {},
        assignmentSummary: { assignTaken: 0, assignmentMarks30: 0, useEqWt: 0, attendancePerformance: 0 },
        attendanceMarks: 0,
        attnAssignObtainedRows: enrolledStudents.map(s => ({
          rollNumber: s.rollNumber,
          name: s.name,
          attendance: 0,
          Assgn1_Q1: 0, Assgn1_Q2: 0, Assgn1_Q3: 0,
          Assgn2_Q1: 0, Assgn2_Q2: 0, Assgn2_Q3: 0,
          Assgn3_Q1: 0, Assgn3_Q2: 0, Assgn3_Q3: 0
        }))
      };
      
      return res.json({
        success: true,
        message: 'No assignment data found, initialized from enrollment',
        data: responseData
      });
    }

    if (enrolledStudents.length > 0) {
      const existingRolls = new Set((responseData.attnAssignObtainedRows || []).map(r => String(r.rollNumber || '').trim()));
      const missingStudents = enrolledStudents.filter(s => !existingRolls.has(String(s.rollNumber).trim()));

      if (missingStudents.length > 0) {
        const newRows = missingStudents.map(s => ({
          rollNumber: s.rollNumber,
          name: s.name,
          attendance: 0,
          Assgn1_Q1: 0, Assgn1_Q2: 0, Assgn1_Q3: 0,
          Assgn2_Q1: 0, Assgn2_Q2: 0, Assgn2_Q3: 0,
          Assgn3_Q1: 0, Assgn3_Q2: 0, Assgn3_Q3: 0
        }));

        responseData.attnAssignObtainedRows = [...(responseData.attnAssignObtainedRows || []), ...newRows];
        responseData.attnAssignObtainedRows.sort((a, b) => 
           (String(a.rollNumber) || '').localeCompare(String(b.rollNumber) || '', undefined, { numeric: true })
        );
      }
    }

    res.json({
      success: true,
      data: responseData
    });
  } catch (error) {
    console.error('Error getting assignment data:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

exports.saveLabActivityData = async (req, res) => {
  try {
    const { courseId } = req.params;
    const {
      labActivityRows,
      labActivityFactors,
      labActivityEqWts,
      labActivityManualWts,
      labAttendanceMarks,
      labQuizMarks,
      labVivaMarks,
      activityTaken,
      otherActivityRemaining,
      otherActivityMeasured,
      coMappedActivityMarks,
      useEqWtActivity,
      labActivityObtainedRows
    } = req.body;

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    if (req.user.role === 'teacher') {
      const isAssigned = course.assignedTeachers.some(assignment => {
        const teacherId = assignment.teacher?._id || assignment.teacher;
        return teacherId.toString() === req.user._id.toString();
      });

      if (!isAssigned) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You are not assigned to this course.'
        });
      }
    }

    const cleanedLabObtainedRows = (labActivityObtainedRows || []).map(({ _id, __v, ...rest }) => rest);
    const labActivityData = await LabActivityAttainment.findOneAndUpdate(
      { course: courseId },
      {
        $set: {
          course: courseId,
          labActivityRows,
          labActivityFactors,
          labActivityEqWts,
          labActivityManualWts,
          labAttendanceMarks,
          labQuizMarks,
          labVivaMarks,
          activityTaken,
          otherActivityRemaining,
          otherActivityMeasured,
          coMappedActivityMarks,
          useEqWtActivity,
          labActivityObtainedRows: cleanedLabObtainedRows,
          updatedBy: req.user._id
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: false }
    );

    res.json({
      success: true,
      message: 'Lab Activity data saved successfully',
      data: labActivityData
    });
  } catch (error) {
    console.error('Error saving lab activity data:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

exports.getLabActivityData = async (req, res) => {
  try {
    const { courseId } = req.params;

    const [course, labActivityData] = await Promise.all([
      Course.findById(courseId).select('assignedTeachers assignedBatches').lean(),
      LabActivityAttainment.findOne({ course: courseId }).lean()
    ]);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    if (req.user.role === 'teacher') {
      const isAssigned = course.assignedTeachers.some(assignment => {
        const teacherId = assignment.teacher?._id || assignment.teacher;
        return teacherId.toString() === req.user._id.toString();
      });

      if (!isAssigned) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You are not assigned to this course.'
        });
      }
    }

    const assignedBatches = course.assignedBatches || [];
    let enrolledStudents = [];

    if (assignedBatches.length > 0) {
      const students = await User.find({
        role: 'student',
        isActive: true,
        isEmailVerified: true,
        isApprovedByAdmin: true
      }).select('name roll email department').lean();

      enrolledStudents = students.filter(student => {
        let roll = student.roll;
        if (!roll && student.email) {
          const match = student.email.match(/^(\d+)/);
          if (match) roll = match[1];
        }
        if (!roll || roll.length < 4) return false;

        const batch = roll.substring(0, 2);
        const deptCode = roll.substring(2, 4);

        return assignedBatches.some(assignment => 
          assignment.batch === batch && assignment.deptCode === deptCode
        );
      }).map(s => {
          let roll = s.roll;
          if (!roll && s.email) {
            const match = s.email.match(/^(\d+)/);
            if (match) roll = match[1];
          }
          return { rollNumber: roll, name: s.name };
      }).sort((a, b) => (a.rollNumber || '').localeCompare(b.rollNumber || '', undefined, { numeric: true }));
    }

    let responseData = labActivityData;

    if (!responseData) {
      responseData = {
        course: courseId,
        labActivityRows: [],
        labActivityManualWts: {},
        labActivityEqWts: {},
        labActivityObtainedRows: enrolledStudents.map(s => ({
          rollNumber: s.rollNumber,
          name: s.name,
          attn: 0, quiz: 0, viva: 0,
          Activity1_Q1: 0, Activity1_Q2: 0, Activity1_Q3: 0,
          Activity2_Q1: 0, Activity2_Q2: 0, Activity2_Q3: 0,
          Activity3_Q1: 0, Activity3_Q2: 0, Activity3_Q3: 0,
          Activity4_Q1: 0, Activity4_Q2: 0, Activity4_Q3: 0,
          Activity5_Q1: 0, Activity5_Q2: 0, Activity5_Q3: 0,
          otherMeasured: 0, other: 0
        })),
        labActivityFactors: { Activity1: 1, Activity2: 1, Activity3: 1, Activity4: 1, Activity5: 1 },
        labAttendanceMarks: 0, labQuizMarks: 0, labVivaMarks: 0,
        activityTaken: 1, otherActivityRemaining: 0, otherActivityMeasured: 0, coMappedActivityMarks: 0, useEqWtActivity: 0
      };

      return res.json({
        success: true,
        message: 'No lab activity data found, initialized from enrollment',
        data: responseData
      });
    }

    if (enrolledStudents.length > 0) {
      const existingRolls = new Set((responseData.labActivityObtainedRows || []).map(r => String(r.rollNumber || '').trim()));
      const missingStudents = enrolledStudents.filter(s => !existingRolls.has(String(s.rollNumber).trim()));

      if (missingStudents.length > 0) {
        const newRows = missingStudents.map(s => ({
          rollNumber: s.rollNumber,
          name: s.name,
          attn: 0, quiz: 0, viva: 0,
          Activity1_Q1: 0, Activity1_Q2: 0, Activity1_Q3: 0,
          Activity2_Q1: 0, Activity2_Q2: 0, Activity2_Q3: 0,
          Activity3_Q1: 0, Activity3_Q2: 0, Activity3_Q3: 0,
          Activity4_Q1: 0, Activity4_Q2: 0, Activity4_Q3: 0,
          Activity5_Q1: 0, Activity5_Q2: 0, Activity5_Q3: 0,
          otherMeasured: 0, other: 0
        }));

        responseData.labActivityObtainedRows = [...(responseData.labActivityObtainedRows || []), ...newRows];
        responseData.labActivityObtainedRows.sort((a, b) => 
           (String(a.rollNumber) || '').localeCompare(String(b.rollNumber) || '', undefined, { numeric: true })
        );
      }
    }

    res.json({
      success: true,
      data: responseData
    });
  } catch (error) {
    console.error('Error getting lab activity data:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

exports.saveSectionAData = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { sectionARows, sectionAObtainedRows, sectionBRows, sectionBObtainedRows } = req.body;

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    if (req.user.role === 'teacher') {
      const isAssigned = course.assignedTeachers.some(assignment => {
        const teacherId = assignment.teacher?._id || assignment.teacher;
        return teacherId.toString() === req.user._id.toString();
      });

      if (!isAssigned) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You are not assigned to this course.'
        });
      }
    }

    const sectionData = await TermExamAttainment.findOneAndUpdate(
      { course: courseId },
      {
        course: courseId,
        sectionARows,
        sectionAObtainedRows,
        sectionBRows,
        sectionBObtainedRows,
        updatedBy: req.user._id
      },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      message: 'Section A & B data saved successfully',
      data: sectionData
    });
  } catch (error) {
    console.error('Error saving Section A data:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

exports.getSectionAData = async (req, res) => {
  try {
    const { courseId } = req.params;

    const [course, sectionAData, termExamMarksA, termExamMarksB] = await Promise.all([
      Course.findById(courseId).select('assignedTeachers').lean(),
      TermExamAttainment.findOne({ course: courseId }).lean(),
      TermExamMarks.find({ course: courseId, section: 'A' }).populate('student', 'roll name').lean(),
      TermExamMarks.find({ course: courseId, section: 'B' }).populate('student', 'roll name').lean()
    ]);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    if (req.user.role === 'teacher') {
      const isAssigned = course.assignedTeachers.some(assignment => {
        const teacherId = assignment.teacher?._id || assignment.teacher;
        return teacherId.toString() === req.user._id.toString();
      });

      if (!isAssigned) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You are not assigned to this course.'
        });
      }
    }

    let sectionAObtainedRows = [];
    let sectionBObtainedRows = [];
    
    if (termExamMarksA && termExamMarksA.length > 0) {
      const getMark = (marksObj, row, question) => {
        try {
          let marks = marksObj;
          if (marksObj instanceof Map) {
            marks = {};
            for (const [key, value] of marksObj.entries()) {
              marks[key] = value instanceof Map ? Object.fromEntries(value) : value;
            }
          }
          
          if (!marks || !marks[row]) {
            return 0;
          }
          
          let rowData = marks[row];
          
          if (rowData instanceof Map) {
            rowData = Object.fromEntries(rowData);
          }
          
          if (!rowData || typeof rowData !== 'object') {
            return 0;
          }
          
          const value = rowData[question] !== undefined ? rowData[question] : rowData[String(question)];
          
          if (value === '' || value === null || value === undefined) {
            return 0;
          }
          
          const parsed = parseFloat(value);
          const result = isNaN(parsed) ? 0 : parsed;
          return result;
        } catch (error) {
          console.error(`[getMark] Error getting mark for ${row}${question}:`, error);
          return 0;
        }
      };
      
      termExamMarksA.forEach((examMark) => {
        const student = examMark.student;
        const marks = examMark.marks;
        
        const sectionARow = {
          rollNumber: student?.roll || 'N/A',
          name: student?.name || 'Unknown',
          Q1a: getMark(marks, 'a', '1'),
          Q1b: getMark(marks, 'b', '1'),
          Q1c: getMark(marks, 'c', '1'),
          Q1d: getMark(marks, 'd', '1'),
          Q2a: getMark(marks, 'a', '2'),
          Q2b: getMark(marks, 'b', '2'),
          Q2c: getMark(marks, 'c', '2'),
          Q2d: getMark(marks, 'd', '2'),
          Q3a: getMark(marks, 'a', '3'),
          Q3b: getMark(marks, 'b', '3'),
          Q3c: getMark(marks, 'c', '3'),
          Q3d: getMark(marks, 'd', '3'),
          Q4a: getMark(marks, 'a', '4'),
          Q4b: getMark(marks, 'b', '4'),
          Q4c: getMark(marks, 'c', '4'),
          Q4d: getMark(marks, 'd', '4')
        };
        
        sectionAObtainedRows.push(sectionARow);
      });
    }
    
    if (termExamMarksB && termExamMarksB.length > 0) {
      const getMark = (marksObj, row, question) => {
        try {
          let marks = marksObj;
          if (marksObj instanceof Map) {
            marks = {};
            for (const [key, value] of marksObj.entries()) {
              marks[key] = value instanceof Map ? Object.fromEntries(value) : value;
            }
          }
          
          if (!marks || !marks[row]) {
            return 0;
          }
          
          let rowData = marks[row];
          
          if (rowData instanceof Map) {
            rowData = Object.fromEntries(rowData);
          }
          
          if (!rowData || typeof rowData !== 'object') {
            return 0;
          }
          
          const value = rowData[question] !== undefined ? rowData[question] : rowData[String(question)];
          
          if (value === '' || value === null || value === undefined) {
            return 0;
          }
          
          const parsed = parseFloat(value);
          const result = isNaN(parsed) ? 0 : parsed;
          return result;
        } catch (error) {
          console.error(`[getMark] Error getting mark for ${row}${question}:`, error);
          return 0;
        }
      };
      
      termExamMarksB.forEach((examMark) => {
        const student = examMark.student;
        const marks = examMark.marks;
        
        const sectionBRow = {
          rollNumber: student?.roll || 'N/A',
          name: student?.name || 'Unknown',
          Q1a: getMark(marks, 'a', '5'),
          Q1b: getMark(marks, 'b', '5'),
          Q1c: getMark(marks, 'c', '5'),
          Q1d: getMark(marks, 'd', '5'),
          Q2a: getMark(marks, 'a', '6'),
          Q2b: getMark(marks, 'b', '6'),
          Q2c: getMark(marks, 'c', '6'),
          Q2d: getMark(marks, 'd', '6'),
          Q3a: getMark(marks, 'a', '7'),
          Q3b: getMark(marks, 'b', '7'),
          Q3c: getMark(marks, 'c', '7'),
          Q3d: getMark(marks, 'd', '7'),
          Q4a: getMark(marks, 'a', '8'),
          Q4b: getMark(marks, 'b', '8'),
          Q4c: getMark(marks, 'c', '8'),
          Q4d: getMark(marks, 'd', '8')
        };
        sectionBObtainedRows.push(sectionBRow);
      });
    }

    let responseData = sectionAData || null;
    
    if (responseData) {
      responseData = {
        ...responseData,
        sectionAObtainedRows,
        sectionBObtainedRows
      };
    } else if (sectionAObtainedRows.length > 0 || sectionBObtainedRows.length > 0) {
      responseData = {
        course: courseId,
        sectionARows: [],
        sectionAObtainedRows,
        sectionBRows: [],
        sectionBObtainedRows
      };
    }

    res.json({
      success: true,
      data: responseData
    });
  } catch (error) {
    console.error('Error getting Section A data:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

exports.resetAttainmentData = async (req, res) => {
  try {
    const { courseId } = req.params;

    const course = await Course.findById(courseId).select('assignedTeachers').lean();
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    if (req.user.role === 'teacher') {
      const isAssigned = course.assignedTeachers.some(a => {
        const tid = a.teacher?._id || a.teacher;
        return tid.toString() === req.user._id.toString();
      });
      if (!isAssigned) {
        return res.status(403).json({ success: false, message: 'Access denied.' });
      }
    }

    await Promise.all([
      CTAttainment.deleteOne({ course: courseId }),
      AssignmentAttainment.deleteOne({ course: courseId }),
      LabActivityAttainment.deleteOne({ course: courseId }),
    ]);

    res.json({ success: true, message: 'Attainment data reset successfully' });
  } catch (error) {
    console.error('Error resetting attainment data:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

