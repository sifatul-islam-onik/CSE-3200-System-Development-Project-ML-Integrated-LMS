
const GRADE_BOUNDARIES = [
  { threshold: 119, grade: 'F',  point: 0.00 },
  { threshold: 134, grade: 'D',  point: 2.00 },
  { threshold: 149, grade: 'C',  point: 2.25 },
  { threshold: 164, grade: 'C+', point: 2.50 },
  { threshold: 179, grade: 'B-', point: 2.75 },
  { threshold: 194, grade: 'B',  point: 3.00 },
  { threshold: 209, grade: 'B+', point: 3.25 },
  { threshold: 224, grade: 'A-', point: 3.50 },
  { threshold: 239, grade: 'A',  point: 3.75 },
];

const GRADE_POINT_MAP = {
  'A+': 4.00, 'A': 3.75, 'A-': 3.50,
  'B+': 3.25, 'B': 3.00, 'B-': 2.75,
  'C+': 2.50, 'C': 2.25, 'D': 2.00, 'F': 0.00,
};

const getLetterGrade = (total) => {
  for (const b of GRADE_BOUNDARIES) {
    if (total < b.threshold) return b.grade;
  }
  return 'A+';
};

const getGradePoint = (letterGrade) => GRADE_POINT_MAP[letterGrade] ?? 0.00;


const getActiveCTFields = (ctSummary) => {
  const ctTaken = (ctSummary && ctSummary.ctTaken) || 3;
  const allFields = [
    'CT1_Q1', 'CT1_Q2', 'CT1_Q3',
    'CT2_Q1', 'CT2_Q2', 'CT2_Q3',
    'CT3_Q1', 'CT3_Q2', 'CT3_Q3',
  ];
  return allFields.slice(0, ctTaken * 3);
};

const getActiveAssignmentFields = (assignmentSummary) => {
  const assignTaken = (assignmentSummary && assignmentSummary.assignTaken) || 3;
  const allFields = [
    'Assgn1_Q1', 'Assgn1_Q2', 'Assgn1_Q3',
    'Assgn2_Q1', 'Assgn2_Q2', 'Assgn2_Q3',
    'Assgn3_Q1', 'Assgn3_Q2', 'Assgn3_Q3',
  ];
  return allFields.slice(0, assignTaken * 3);
};

const computeCTColumnTotals = (ctRows) => {
  let ct1 = 0, ct2 = 0, ct3 = 0;
  (ctRows || []).forEach(r => {
    ct1 += (r.CT1_Q1 || 0) + (r.CT1_Q2 || 0) + (r.CT1_Q3 || 0);
    ct2 += (r.CT2_Q1 || 0) + (r.CT2_Q2 || 0) + (r.CT2_Q3 || 0);
    ct3 += (r.CT3_Q1 || 0) + (r.CT3_Q2 || 0) + (r.CT3_Q3 || 0);
  });
  return { CT1: ct1, CT2: ct2, CT3: ct3 };
};

const computeAutoEqWt = (ctRows, ctSummary) => {
  const ctTotals = computeCTColumnTotals(ctRows);
  const coMappedMarks = (ctSummary && ctSummary.coMappedMarks60) || 0;
  const ctTaken = (ctSummary && ctSummary.ctTaken) || 1;
  return {
    CT1: ctTotals.CT1 > 0 ? coMappedMarks / ctTaken : 0,
    CT2: ctTotals.CT2 > 0 ? coMappedMarks / ctTaken : 0,
    CT3: ctTotals.CT3 > 0 ? coMappedMarks / ctTaken : 0,
  };
};

const computeCTFactors = (ctData) => {
  const { ctRows = [], ctManualWts = {}, ctSummary = {} } = ctData;
  const ctTotals = computeCTColumnTotals(ctRows);
  const autoEqWt = computeAutoEqWt(ctRows, ctSummary);
  const useEqWt = ctSummary.useEqWt || 0;
  const result = {};
  for (const key of ['CT1', 'CT2', 'CT3']) {
    const total = ctTotals[key] || 0;
    if (total > 0) {
      if (useEqWt !== 0) {
        result[key] = autoEqWt[key] / total;
      } else {
        const manualWt = ctManualWts[key] > 0 ? ctManualWts[key] : total;
        result[key] = manualWt / total;
      }
    } else {
      result[key] = 0;
    }
  }
  return result;
};


const computeAssignmentColumnTotals = (assignmentRows) => {
  let a1 = 0, a2 = 0, a3 = 0;
  (assignmentRows || []).forEach(r => {
    a1 += (r.Assgn1_Q1 || 0) + (r.Assgn1_Q2 || 0) + (r.Assgn1_Q3 || 0);
    a2 += (r.Assgn2_Q1 || 0) + (r.Assgn2_Q2 || 0) + (r.Assgn2_Q3 || 0);
    a3 += (r.Assgn3_Q1 || 0) + (r.Assgn3_Q2 || 0) + (r.Assgn3_Q3 || 0);
  });
  return { Assgn1: a1, Assgn2: a2, Assgn3: a3 };
};

const computeAssignmentAutoEqWt = (assignmentRows, assignmentSummary) => {
  const totals = computeAssignmentColumnTotals(assignmentRows);
  const assignmentMarks = (assignmentSummary && assignmentSummary.assignmentMarks30) || 0;
  const assignTaken = (assignmentSummary && assignmentSummary.assignTaken) || 1;
  return {
    Assgn1: totals.Assgn1 > 0 ? assignmentMarks / assignTaken : 0,
    Assgn2: totals.Assgn2 > 0 ? assignmentMarks / assignTaken : 0,
    Assgn3: totals.Assgn3 > 0 ? assignmentMarks / assignTaken : 0,
  };
};

const computeAssignmentFactors = (assignData) => {
  const { assignmentRows = [], assignmentManualWts = {}, assignmentSummary = {} } = assignData;
  const totals = computeAssignmentColumnTotals(assignmentRows);
  const autoEqWt = computeAssignmentAutoEqWt(assignmentRows, assignmentSummary);
  const useEqWt = assignmentSummary.useEqWt || 0;
  const result = {};
  for (const key of ['Assgn1', 'Assgn2', 'Assgn3']) {
    const total = totals[key] || 0;
    if (total > 0) {
      if (useEqWt !== 0) {
        result[key] = autoEqWt[key] / total;
      } else {
        const manualWt = assignmentManualWts[key] > 0 ? assignmentManualWts[key] : total;
        result[key] = manualWt / total;
      }
    } else {
      result[key] = 0;
    }
  }
  return result;
};


const normaliseRoll = (r) => String(r || '').trim().toLowerCase();

const getStudentCTFactoredMarks = (rollNumber, coNumber, ctData) => {
  const { ctRows = [], ctObtainedRows = [], ctManualWts = {}, ctSummary = {} } = ctData;

  const studentRow = ctObtainedRows.find(r =>
    normaliseRoll(r.rollNumber) === normaliseRoll(rollNumber)
  );
  if (!studentRow) return 0;

  const coRow = ctRows.find(row => {
    const rowCo = String(row.coNumber || '').replace('CLO', 'CO');
    return rowCo === coNumber;
  });
  if (!coRow) return 0;

  const activeFields = getActiveCTFields(ctSummary);
  const factors = computeCTFactors({ ctRows, ctManualWts, ctSummary });

  return activeFields.reduce((sum, field) => {
    const allocated = parseFloat(coRow[field]) || 0;
    if (allocated === 0) return sum;
    const ctKey = field.replace(/(_Q[123])$/, ''); // e.g. "CT1_Q2" → "CT1"
    const factor = factors[ctKey] || 0;
    const raw = studentRow[field];
    const mark = (raw === 'A' || raw === 'Absent') ? 0 : (parseFloat(raw) || 0);
    return sum + factor * mark;
  }, 0);
};

const getStudentAssignmentFactoredMarks = (rollNumber, coNumber, assignData) => {
  const {
    assignmentRows = [],
    attnAssignObtainedRows = [],
    assignmentManualWts = {},
    assignmentSummary = {},
  } = assignData;

  const studentRow = attnAssignObtainedRows.find(r =>
    normaliseRoll(r.rollNumber) === normaliseRoll(rollNumber)
  );
  if (!studentRow) return 0;

  const coRow = assignmentRows.find(row => {
    const rowCo = String(row.coNumber || '').replace('CLO', 'CO');
    return rowCo === coNumber;
  });
  if (!coRow) return 0;

  const activeFields = getActiveAssignmentFields(assignmentSummary);
  const factors = computeAssignmentFactors({ assignmentRows, assignmentManualWts, assignmentSummary });

  return activeFields.reduce((sum, field) => {
    const allocated = parseFloat(coRow[field]) || 0;
    if (allocated === 0) return sum;
    const assignKey = field.replace(/(_Q[123])$/, ''); // e.g. "Assgn1_Q2" → "Assgn1"
    const factor = factors[assignKey] || 0;
    const mark = parseFloat(studentRow[field]) || 0;
    return sum + factor * mark;
  }, 0);
};


const SECTION_Q_PARTS = ['a', 'b', 'c', 'd'];
const SECTION_Q_NUMS  = [1, 2, 3, 4];

const computeSectionCOMarks = (studentObtained, coAllocationRow) => {
  if (!studentObtained || !coAllocationRow) return 0;
  let total = 0;
  for (const qNum of SECTION_Q_NUMS) {
    for (const part of SECTION_Q_PARTS) {
      const field = `Q${qNum}${part}`;
      const allocated = parseFloat(coAllocationRow[field]) || 0;
      if (allocated > 0) {
        total += parseFloat(studentObtained[field]) || 0;
      }
    }
  }
  return total;
};


const computeStudentTotal = (rollNumber, coNumbers, sectionAData, sectionBData, ctData, assignData) => {
  const { sectionARows = [], sectionAObtainedRows = [] } = sectionAData;
  const { sectionBRows = [], sectionBObtainedRows = [] } = sectionBData;
  const { attnAssignObtainedRows = [] } = assignData;

  const attnRow = attnAssignObtainedRows.find(r =>
    normaliseRoll(r.rollNumber) === normaliseRoll(rollNumber)
  );
  const attendance = attnRow ? (parseFloat(attnRow.attendance) || 0) : 0;

  const studentObtA = sectionAObtainedRows.find(r =>
    normaliseRoll(r.rollNumber) === normaliseRoll(rollNumber)
  );
  const studentObtB = sectionBObtainedRows.find(r =>
    normaliseRoll(r.rollNumber) === normaliseRoll(rollNumber)
  );

  let marksTotal = 0;
  for (const coNumber of coNumbers) {
    const coRowA = sectionARows.find(r => {
      const rCo = String(r.coNumber || '').replace('CLO', 'CO');
      return rCo === coNumber;
    });
    const coRowB = sectionBRows.find(r => {
      const rCo = String(r.coNumber || '').replace('CLO', 'CO');
      return rCo === coNumber;
    });

    marksTotal += computeSectionCOMarks(studentObtA, coRowA);
    marksTotal += computeSectionCOMarks(studentObtB, coRowB);
    marksTotal += getStudentCTFactoredMarks(rollNumber, coNumber, ctData);
    marksTotal += getStudentAssignmentFactoredMarks(rollNumber, coNumber, assignData);
  }

  return marksTotal + attendance;
};


const computeTermGPA = (courseResults) => {
  let totalCreditPoints = 0;
  let totalCredits = 0;
  for (const cr of courseResults) {
    const credit = cr.credit || 0;
    const gp = cr.gradePoint || 0;
    totalCreditPoints += credit * gp;
    totalCredits += credit;
  }
  if (totalCredits === 0) return 0;
  return Math.round((totalCreditPoints / totalCredits) * 100) / 100;
};

const computeCGPA = (allTermResults) => {
  let totalCreditPoints = 0;
  let totalCredits = 0;
  for (const tr of allTermResults) {
    for (const cr of (tr.courses || [])) {
      const credit = cr.credit || 0;
      const gp = cr.gradePoint || 0;
      totalCreditPoints += credit * gp;
      totalCredits += credit;
    }
  }
  if (totalCredits === 0) return 0;
  return Math.round((totalCreditPoints / totalCredits) * 100) / 100;
};

const getLetterGradeForLab = (total) => {
  if (total >= 80) return 'A+';
  if (total >= 75) return 'A';
  if (total >= 70) return 'A-';
  if (total >= 65) return 'B+';
  if (total >= 60) return 'B';
  if (total >= 55) return 'B-';
  if (total >= 50) return 'C+';
  if (total >= 45) return 'C';
  if (total >= 40) return 'D';
  return 'F';
};

const computeLabActivityColumnTotals = (labActivityRows, activityTaken) => {
  const result = {};
  for (let i = 1; i <= (activityTaken || 5); i++) {
    result[`activity${i}`] = (labActivityRows || []).reduce((sum, r) => {
      return sum + (r[`Activity${i}_Q1`] || 0) + (r[`Activity${i}_Q2`] || 0) + (r[`Activity${i}_Q3`] || 0);
    }, 0);
  }
  return result;
};

const computeLabStudentTotal = (rollNumber, labData) => {
  const {
    labActivityRows = [],
    labActivityObtainedRows = [],
    labAttendanceMarks = 0,
    labQuizMarks = 0,
    labVivaMarks = 0,
    activityTaken = 5,
    useEqWtActivity = 0,
    coMappedActivityMarks = 0,
    labActivityManualWts = {},
    otherActivityRemaining = 0,
  } = labData;

  const studentRow = labActivityObtainedRows.find(r =>
    normaliseRoll(r.rollNumber) === normaliseRoll(rollNumber)
  );
  if (!studentRow) return 0;

  let total = 0;
  total += parseFloat(studentRow.attn) || 0;
  total += parseFloat(studentRow.quiz) || 0;
  total += parseFloat(studentRow.viva) || 0;

  const activityTotals = computeLabActivityColumnTotals(labActivityRows, activityTaken);

  const rawOther = parseFloat(studentRow.otherMeasured) || 0;
  if (rawOther > 0 && otherActivityRemaining > 0) {
    let measuredTotal = (labAttendanceMarks || 0) + (labQuizMarks || 0) + (labVivaMarks || 0);
    for (let i = 1; i <= (activityTaken || 5); i++) measuredTotal += activityTotals[`activity${i}`] || 0;
    total += measuredTotal > 0 ? rawOther * (otherActivityRemaining / measuredTotal) : 0;
  } else {
    total += parseFloat(studentRow.other) || 0;
  }

  labActivityRows.forEach(coRow => {
    for (let i = 1; i <= (activityTaken || 5); i++) {
      const actTotal = activityTotals[`activity${i}`] || 0;
      let factor = 0;
      if (actTotal > 0) {
        if (useEqWtActivity) {
          factor = ((coMappedActivityMarks || 0) / (activityTaken || 1)) / actTotal;
        } else {
          factor = ((labActivityManualWts[`activity${i}`]) || 0) / actTotal;
        }
      }
      if ((coRow[`Activity${i}_Q1`] || 0) > 0) total += (parseFloat(studentRow[`Activity${i}_Q1`]) || 0) * factor;
      if ((coRow[`Activity${i}_Q2`] || 0) > 0) total += (parseFloat(studentRow[`Activity${i}_Q2`]) || 0) * factor;
      if ((coRow[`Activity${i}_Q3`] || 0) > 0) total += (parseFloat(studentRow[`Activity${i}_Q3`]) || 0) * factor;
    }
  });

  return total;
};

module.exports = {
  getLetterGrade,
  getGradePoint,
  getLetterGradeForLab,
  getActiveCTFields,
  getActiveAssignmentFields,
  computeCTColumnTotals,
  computeCTFactors,
  computeAssignmentColumnTotals,
  computeAssignmentFactors,
  computeLabActivityColumnTotals,
  getStudentCTFactoredMarks,
  getStudentAssignmentFactoredMarks,
  computeSectionCOMarks,
  computeStudentTotal,
  computeLabStudentTotal,
  computeTermGPA,
  computeCGPA,
};
