const { computeStudentTotal, computeLabStudentTotal, computeCTColumnTotals, computeAssignmentColumnTotals, getStudentCTFactoredMarks, getStudentAssignmentFactoredMarks, computeSectionCOMarks, computeLabActivityColumnTotals } = require('./gradeUtils');

const calculateFactoredCOTotals = (ctData, activeCTFields, coNumbers) => {
  const { ctRows = [], ctSummary = {}, ctManualWts = {} } = ctData;
  const useEqWt = ctSummary.useEqWt || 0;
  const coMappedMarks = ctSummary.coMappedMarks60 || 0;
  const ctTaken = ctSummary.ctTaken || 1;
  const ctTotals = computeCTColumnTotals(ctRows);
  
  const factoredTotals = {};

  coNumbers.forEach(coKey => {
    const row = ctRows.find(r => (r.coNumber || '').toString().replace('CLO', 'CO') === coKey);
    if (!row) {
      factoredTotals[coKey] = 0;
      return;
    }

    let factoredTotal = 0;
    activeCTFields.forEach(field => {
      const allocatedMarks = row[field] || 0;
      if (allocatedMarks === 0) return;
      
      const ctKey = field.substring(0, 3); // e.g. "CT1"
      const total = ctTotals[ctKey] || 0;
      let factor = 0;
      
      if (total > 0) {
        if (useEqWt !== 0) {
          const eqWtValue = coMappedMarks / ctTaken;
          factor = eqWtValue / total;
        } else {
          const manualWt = (ctManualWts[ctKey] > 0) ? ctManualWts[ctKey] : total;
          factor = manualWt / total;
        }
      }
      
      factoredTotal += factor * allocatedMarks;
    });

    factoredTotals[coKey] = factoredTotal;
  });

  return factoredTotals;
};

const calculateFactoredAssignmentCOTotals = (assignData, activeAssignFields, coNumbers) => {
  const { assignmentRows = [], assignmentSummary = {}, assignmentManualWts = {} } = assignData;
  const useEqWt = assignmentSummary.useEqWt || 0;
  const assignmentMarks = assignmentSummary.assignmentMarks30 || 0;
  const assignTaken = assignmentSummary.assignTaken || 1;
  const totals = computeAssignmentColumnTotals(assignmentRows);
  
  const factoredTotals = {};

  coNumbers.forEach(coKey => {
    const row = assignmentRows.find(r => (r.coNumber || '').toString().replace('CLO', 'CO') === coKey);
    if (!row) {
      factoredTotals[coKey] = 0;
      return;
    }

    let factoredTotal = 0;
    activeAssignFields.forEach(field => {
      const allocatedMarks = row[field] || 0;
      if (allocatedMarks === 0) return;
      
      const assignmentKey = field.split('_')[0]; // "Assgn1"
      const total = totals[assignmentKey] || 0;
      let factor = 0;
      
      if (total > 0) {
        if (useEqWt !== 0) {
          const eqWtValue = assignmentMarks / assignTaken;
          factor = eqWtValue / total;
        } else {
          const manualWt = (assignmentManualWts[assignmentKey] > 0) ? assignmentManualWts[assignmentKey] : total;
          factor = manualWt / total;
        }
      }
      
      factoredTotal += factor * allocatedMarks;
    });

    factoredTotals[coKey] = factoredTotal;
  });

  return factoredTotals;
};

const normalizeRoll = (value) => String(value || '').trim().toLowerCase();

const resolveCtTaken = (ctData) => {
  const ctSummary = ctData?.ctSummary || {};
  const ctRows = ctData?.ctRows || [];
  if ((ctSummary.ctTaken || 0) > 0) return ctSummary.ctTaken;
  const hasCT3 = ctRows.some(r => (r.CT3_Q1 || 0) + (r.CT3_Q2 || 0) + (r.CT3_Q3 || 0) > 0);
  if (hasCT3) return 3;
  const hasCT2 = ctRows.some(r => (r.CT2_Q1 || 0) + (r.CT2_Q2 || 0) + (r.CT2_Q3 || 0) > 0);
  if (hasCT2) return 2;
  const hasCT1 = ctRows.some(r => (r.CT1_Q1 || 0) + (r.CT1_Q2 || 0) + (r.CT1_Q3 || 0) > 0);
  return hasCT1 ? 1 : 0;
};

const resolveAssignTaken = (assignData) => {
  const assignmentSummary = assignData?.assignmentSummary || {};
  const assignmentRows = assignData?.assignmentRows || [];
  if ((assignmentSummary.assignTaken || 0) > 0) return assignmentSummary.assignTaken;
  const hasA3 = assignmentRows.some(r => (r.Assgn3_Q1 || 0) + (r.Assgn3_Q2 || 0) + (r.Assgn3_Q3 || 0) > 0);
  if (hasA3) return 3;
  const hasA2 = assignmentRows.some(r => (r.Assgn2_Q1 || 0) + (r.Assgn2_Q2 || 0) + (r.Assgn2_Q3 || 0) > 0);
  if (hasA2) return 2;
  const hasA1 = assignmentRows.some(r => (r.Assgn1_Q1 || 0) + (r.Assgn1_Q2 || 0) + (r.Assgn1_Q3 || 0) > 0);
  return hasA1 ? 1 : 0;
};

const getSectionMarksDistribution = (coRow, studentObtainedRow, isSectionB = false) => {
  if (!coRow || !studentObtainedRow) return 0;

  const answered = [];
  for (let qNum = 1; qNum <= 4; qNum++) {
    let total = 0;
    ['a', 'b', 'c', 'd'].forEach(part => {
      total += (parseFloat(studentObtainedRow[`Q${qNum}${part}`]) || 0);
    });
    if (total > 0) answered.push(qNum + (isSectionB ? 4 : 0));
  }

  const combinationMap = {
    '1,2,3': 'q123', '1,2,4': 'q124', '1,3,4': 'q134', '2,3,4': 'q234',
    '1,2': 'q12', '1,3': 'q13', '1,4': 'q14', '2,3': 'q23', '2,4': 'q24', '3,4': 'q34',
    '1': 'q1', '2': 'q2', '3': 'q3', '4': 'q4',
    '5,6,7': 'q123', '5,6,8': 'q124', '5,7,8': 'q134', '6,7,8': 'q234',
    '5,6': 'q12', '5,7': 'q13', '5,8': 'q14', '6,7': 'q23', '6,8': 'q24', '7,8': 'q34',
    '5': 'q1', '6': 'q2', '7': 'q3', '8': 'q4',
  };

  const answerKey = answered.length > 0 ? answered.join(',') : 'none';
  const combinationKey = answerKey === 'none' ? 'none' : (combinationMap[answerKey] || 'none');

  const q1 = (coRow.Q1a || 0) + (coRow.Q1b || 0) + (coRow.Q1c || 0) + (coRow.Q1d || 0);
  const q2 = (coRow.Q2a || 0) + (coRow.Q2b || 0) + (coRow.Q2c || 0) + (coRow.Q2d || 0);
  const q3 = (coRow.Q3a || 0) + (coRow.Q3b || 0) + (coRow.Q3c || 0) + (coRow.Q3d || 0);
  const q4 = (coRow.Q4a || 0) + (coRow.Q4b || 0) + (coRow.Q4c || 0) + (coRow.Q4d || 0);

  switch (combinationKey) {
    case 'q123': return q1 + q2 + q3;
    case 'q124': return q1 + q2 + q4;
    case 'q134': return q1 + q3 + q4;
    case 'q234': return q2 + q3 + q4;
    case 'q12': return q1 + q2;
    case 'q13': return q1 + q3;
    case 'q14': return q1 + q4;
    case 'q23': return q2 + q3;
    case 'q24': return q2 + q4;
    case 'q34': return q3 + q4;
    case 'q1': return q1;
    case 'q2': return q2;
    case 'q3': return q3;
    case 'q4': return q4;
    default: return 0;
  }
};

const calculateTheoryCOAttainment = (students, coNumbers, attainmentData) => {
  const { sectionAData, sectionBData, ctData, assignData } = attainmentData;
  const { sectionARows = [], sectionAObtainedRows = [] } = sectionAData;
  const { sectionBRows = [], sectionBObtainedRows = [] } = sectionBData;

  const ctTaken = (ctData?.ctSummary?.ctTaken) || 3;
  const allCTFields = ['CT1_Q1', 'CT1_Q2', 'CT1_Q3', 'CT2_Q1', 'CT2_Q2', 'CT2_Q3', 'CT3_Q1', 'CT3_Q2', 'CT3_Q3'];
  const activeCTFields = allCTFields.slice(0, ctTaken * 3);

  const assignTaken = (assignData?.assignmentSummary?.assignTaken) || 3;
  const allAssignFields = ['Assgn1_Q1', 'Assgn1_Q2', 'Assgn1_Q3', 'Assgn2_Q1', 'Assgn2_Q2', 'Assgn2_Q3', 'Assgn3_Q1', 'Assgn3_Q2', 'Assgn3_Q3'];
  const activeAssignFields = allAssignFields.slice(0, assignTaken * 3);

  const factoredCTTotals = calculateFactoredCOTotals(ctData, activeCTFields, coNumbers);
  const factoredAssignTotals = calculateFactoredAssignmentCOTotals(assignData, activeAssignFields, coNumbers);

  const coStats = {};
  coNumbers.forEach(co => {
    coStats[co] = {
      attempted: 0,
      passedThreshold: 0
    };
  });

  students.forEach(student => {
    const studentObtA = sectionAObtainedRows.find(r => String(r.rollNumber || '').trim().toLowerCase() === String(student.roll || '').trim().toLowerCase());
    const studentObtB = sectionBObtainedRows.find(r => String(r.rollNumber || '').trim().toLowerCase() === String(student.roll || '').trim().toLowerCase());

    coNumbers.forEach(coNumber => {
      const coRowA = sectionARows.find(r => String(r.coNumber || '').replace('CLO', 'CO') === coNumber);
      const coRowB = sectionBRows.find(r => String(r.coNumber || '').replace('CLO', 'CO') === coNumber);

      let distA = 0; let distB = 0;
      if (coRowA) {
        ['Q1a','Q1b','Q1c','Q1d','Q2a','Q2b','Q2c','Q2d','Q3a','Q3b','Q3c','Q3d','Q4a','Q4b','Q4c','Q4d'].forEach(f => distA += (parseFloat(coRowA[f]) || 0));
      }
      if (coRowB) {
        ['Q5a','Q5b','Q5c','Q5d','Q6a','Q6b','Q6c','Q6d','Q7a','Q7b','Q7c','Q7d','Q8a','Q8b','Q8c','Q8d'].forEach(f => distB += (parseFloat(coRowB[f]) || 0));
      }

      const totalDist = distA + distB + (factoredCTTotals[coNumber] || 0) + (factoredAssignTotals[coNumber] || 0);

      const obtA = computeSectionCOMarks(studentObtA, coRowA);
      const obtB = computeSectionCOMarks(studentObtB, coRowB);
      const obtCT = getStudentCTFactoredMarks(student.roll, coNumber, ctData);
      const obtAssign = getStudentAssignmentFactoredMarks(student.roll, coNumber, assignData);
      const totalObt = obtA + obtB + obtCT + obtAssign;

      if (totalDist > 0) {
        coStats[coNumber].attempted += 1;
        const percentage = (totalObt / totalDist) * 100;
        if (percentage >= 55.0) { // Using standard 40% pass threshold
          coStats[coNumber].passedThreshold += 1;
        }
      }
    });
  });

  return generateFinalStats(coStats);
};

const generateFinalStats = (coStats) => {
  return Object.keys(coStats).map(coKey => {
    const stat = coStats[coKey];
    const passPercentage = stat.attempted > 0 ? (stat.passedThreshold / stat.attempted) * 100 : 0;
    
    let attainmentLevel = 0;
    if (passPercentage >= 60) attainmentLevel = 3;
    else if (passPercentage >= 50) attainmentLevel = 2;
    else if (passPercentage >= 40) attainmentLevel = 1;

    return {
      coNumber: coKey,
      targetThreshold: 55,
      studentsAttempted: stat.attempted,
      studentsPassed: stat.passedThreshold,
      passPercentage: Number(passPercentage.toFixed(2)),
      attainmentLevel
    };
  });
};

const calculateLabFactoredValue = (row, field, activityKey, activityTotals, labData) => {
  const cellValue = parseFloat(row[field]) || 0;
  if (cellValue === 0) return 0;

  const activityTotal = activityTotals[activityKey] || 0;
  let calculatedFactor = 0;

  if (activityTotal > 0) {
    if (labData.useEqWtActivity) {
      const eqWtValue = (labData.coMappedActivityMarks || 0) / (labData.activityTaken || 1);
      calculatedFactor = eqWtValue / activityTotal;
    } else {
      const manualWtValue = (labData.labActivityManualWts && labData.labActivityManualWts[activityKey]) || 0;
      calculatedFactor = manualWtValue / activityTotal;
    }
  }

  return cellValue * calculatedFactor;
};

const getLabActivityGeneratedCOTotal = (coRow, activityTotals, labData) => {
  let total = 0;
  for (let i = 1; i <= (labData.activityTaken || 5); i++) {
    const activityKey = `activity${i}`;
    total += calculateLabFactoredValue(coRow, `Activity${i}_Q1`, activityKey, activityTotals, labData);
    total += calculateLabFactoredValue(coRow, `Activity${i}_Q2`, activityKey, activityTotals, labData);
    total += calculateLabFactoredValue(coRow, `Activity${i}_Q3`, activityKey, activityTotals, labData);
  }
  return total;
};

const getLabActivityStudentCOMappedMarks = (studentObtainedRow, coRow, activityTotals, labData) => {
  let total = 0;
  for (let i = 1; i <= (labData.activityTaken || 5); i++) {
    const activityKey = `activity${i}`;
    const activityTotal = activityTotals[activityKey] || 0;
    let calculatedFactor = 0;

    if (activityTotal > 0) {
      if (labData.useEqWtActivity) {
        const eqWtValue = (labData.coMappedActivityMarks || 0) / (labData.activityTaken || 1);
        calculatedFactor = eqWtValue / activityTotal;
      } else {
        const manualWtValue = (labData.labActivityManualWts && labData.labActivityManualWts[activityKey]) || 0;
        calculatedFactor = manualWtValue / activityTotal;
      }
    }

    if ((coRow[`Activity${i}_Q1`] || 0) > 0) {
      total += (parseFloat(studentObtainedRow[`Activity${i}_Q1`]) || 0) * calculatedFactor;
    }
    if ((coRow[`Activity${i}_Q2`] || 0) > 0) {
      total += (parseFloat(studentObtainedRow[`Activity${i}_Q2`]) || 0) * calculatedFactor;
    }
    if ((coRow[`Activity${i}_Q3`] || 0) > 0) {
      total += (parseFloat(studentObtainedRow[`Activity${i}_Q3`]) || 0) * calculatedFactor;
    }
  }
  return total;
};

const calculateLabCOAttainment = (students, coNumbers, attainmentData) => {
  const { labActivityRows = [], labActivityObtainedRows = [] } = attainmentData;
  const activityTotals = computeLabActivityColumnTotals(labActivityRows, attainmentData.activityTaken || 5);

  const coStats = {};
  coNumbers.forEach(co => {
    coStats[co] = {
      attempted: 0,
      passedThreshold: 0
    };
  });

  students.forEach(student => {
    const studentObt = labActivityObtainedRows.find(r => 
      String(r.rollNumber || '').trim().toLowerCase() === String(student.roll || '').trim().toLowerCase()
    );

    if (!studentObt) return;

    coNumbers.forEach(coNumber => {
      const coRow = labActivityRows.find(r => String(r.coNumber || '').replace('CLO', 'CO') === coNumber);
      if (!coRow) return;

      const allocatedMarks = getLabActivityGeneratedCOTotal(coRow, activityTotals, attainmentData);
      const obtainedMarks = getLabActivityStudentCOMappedMarks(studentObt, coRow, activityTotals, attainmentData);

      if (allocatedMarks > 0) {
        coStats[coNumber].attempted += 1;
        const ratio = obtainedMarks / allocatedMarks;
        const percentage = ratio * 100;
        
        if (percentage >= 55.0) {
          coStats[coNumber].passedThreshold += 1;
        }
      }
    });
  });

  return generateFinalStats(coStats);
};

const getLabActivityStudentCOMarks = (studentRow, coRow, activityTaken) => {
  if (!studentRow || !coRow) return 0;
  let total = 0;
  if ((coRow.attn || 0) > 0) total += (parseFloat(studentRow.attn) || 0);
  if ((coRow.quiz || 0) > 0) total += (parseFloat(studentRow.quiz) || 0);
  if ((coRow.viva || 0) > 0) total += (parseFloat(studentRow.viva) || 0);
  for (let i = 1; i <= (activityTaken || 5); i++) {
    const q1Field = `Activity${i}_Q1`;
    const q2Field = `Activity${i}_Q2`;
    const q3Field = `Activity${i}_Q3`;
    if ((coRow[q1Field] || 0) > 0) total += (parseFloat(studentRow[q1Field]) || 0);
    if ((coRow[q2Field] || 0) > 0) total += (parseFloat(studentRow[q2Field]) || 0);
    if ((coRow[q3Field] || 0) > 0) total += (parseFloat(studentRow[q3Field]) || 0);
  }
  return total;
};

const computeLabActivityCOTotal = (coRow, activityTaken) => {
  if (!coRow) return 0;
  let sum = (coRow.attn || 0) + (coRow.quiz || 0) + (coRow.viva || 0);
  for (let i = 1; i <= (activityTaken || 5); i++) {
    sum += (coRow[`Activity${i}_Q1`] || 0) + (coRow[`Activity${i}_Q2`] || 0) + (coRow[`Activity${i}_Q3`] || 0);
  }
  return sum;
};

const buildTheoryTotalsByStudent = (students, coNumbers, attainmentData) => {
  const { sectionAData, sectionBData, ctData, assignData } = attainmentData;
  const { sectionARows = [], sectionAObtainedRows = [] } = sectionAData || {};
  const { sectionBRows = [], sectionBObtainedRows = [] } = sectionBData || {};

  const ctTaken = resolveCtTaken(ctData);
  const allCTFields = ['CT1_Q1', 'CT1_Q2', 'CT1_Q3', 'CT2_Q1', 'CT2_Q2', 'CT2_Q3', 'CT3_Q1', 'CT3_Q2', 'CT3_Q3'];
  const activeCTFields = allCTFields.slice(0, ctTaken * 3);

  const assignTaken = resolveAssignTaken(assignData);
  const allAssignFields = ['Assgn1_Q1', 'Assgn1_Q2', 'Assgn1_Q3', 'Assgn2_Q1', 'Assgn2_Q2', 'Assgn2_Q3', 'Assgn3_Q1', 'Assgn3_Q2', 'Assgn3_Q3'];
  const activeAssignFields = allAssignFields.slice(0, assignTaken * 3);

  const factoredCTTotals = calculateFactoredCOTotals(ctData || {}, activeCTFields, coNumbers);
  const factoredAssignTotals = calculateFactoredAssignmentCOTotals(assignData || {}, activeAssignFields, coNumbers);

  return (students || []).map(student => {
    const roll = student.roll || student.rollNumber || student.studentRoll;
    const studentObtA = sectionAObtainedRows.find(r => normalizeRoll(r.rollNumber) === normalizeRoll(roll));
    const studentObtB = sectionBObtainedRows.find(r => normalizeRoll(r.rollNumber) === normalizeRoll(roll));
    const totals = {};

    coNumbers.forEach(coNumber => {
      const coRowA = sectionARows.find(r => String(r.coNumber || '').replace('CLO', 'CO') === coNumber);
      const coRowB = sectionBRows.find(r => String(r.coNumber || '').replace('CLO', 'CO') === coNumber);

      const distA = getSectionMarksDistribution(coRowA, studentObtA, false);
      const distB = getSectionMarksDistribution(coRowB, studentObtB, true);

      const obtA = computeSectionCOMarks(studentObtA, coRowA);
      const obtB = computeSectionCOMarks(studentObtB, coRowB);
      const obtCT = getStudentCTFactoredMarks(roll, coNumber, ctData || {});
      const obtAssign = getStudentAssignmentFactoredMarks(roll, coNumber, assignData || {});

      totals[coNumber] = {
        obtained: obtA + obtB + obtCT + obtAssign,
        distribution: distA + distB + (factoredCTTotals[coNumber] || 0) + (factoredAssignTotals[coNumber] || 0)
      };
    });

    return { rollNumber: roll, totals };
  });
};

const calculateTheoryCoAttainmentByStudent = (students, coNumbers, attainmentData) => {
  const totalsByStudent = buildTheoryTotalsByStudent(students, coNumbers, attainmentData || {
    sectionAData: {}, sectionBData: {}, ctData: {}, assignData: {}
  });

  return totalsByStudent.map(studentRow => {
    const coValues = {};
    coNumbers.forEach(coNumber => {
      const totals = studentRow.totals[coNumber] || { obtained: 0, distribution: 0 };
      coValues[coNumber] = totals.distribution > 0
        ? Number(((totals.obtained / totals.distribution) * 100).toFixed(4))
        : 0;
    });
    return { rollNumber: studentRow.rollNumber, coValues };
  });
};

const calculateLabCoAttainmentByStudent = (students, coNumbers, labData) => {
  const { labActivityRows = [], labActivityObtainedRows = [] } = labData || {};
  const activityTotals = computeLabActivityColumnTotals(labActivityRows, labData?.activityTaken || 5);

  return (students || []).map(student => {
    const roll = student.roll || student.rollNumber || student.studentRoll;
    const studentObt = labActivityObtainedRows.find(r => normalizeRoll(r.rollNumber) === normalizeRoll(roll));
    const coValues = {};

    coNumbers.forEach(coNumber => {
      const coRow = labActivityRows.find(r => String(r.coNumber || '').replace('CLO', 'CO') === coNumber);
      if (!studentObt || !coRow) {
        coValues[coNumber] = 0;
        return;
      }
      const allocatedMarks = getLabActivityGeneratedCOTotal(coRow, activityTotals, labData || {});
      const obtainedMarks = getLabActivityStudentCOMappedMarks(studentObt, coRow, activityTotals, labData || {});
      coValues[coNumber] = allocatedMarks > 0 ? Number(((obtainedMarks / allocatedMarks) * 100).toFixed(4)) : 0;
    });

    return { rollNumber: roll, coValues };
  });
};

const calculateCombinedCoAttainmentByStudent = (students, coNumbers, theoryData, labData) => {
  const theoryTotals = buildTheoryTotalsByStudent(students, coNumbers, theoryData || {
    sectionAData: {}, sectionBData: {}, ctData: {}, assignData: {}
  });

  const { labActivityRows = [], labActivityObtainedRows = [] } = labData || {};
  const activityTaken = labData?.activityTaken || 5;
  const eqWt = (labData?.coMappedActivityMarks || 0) / (activityTaken || 1);
  const activityTotals = computeLabActivityColumnTotals(labActivityRows, activityTaken);

  return theoryTotals.map(studentRow => {
    const roll = studentRow.rollNumber;
    const studentObt = labActivityObtainedRows.find(r => normalizeRoll(r.rollNumber) === normalizeRoll(roll));
    const coValues = {};

    coNumbers.forEach(coNumber => {
      const theory = studentRow.totals[coNumber] || { obtained: 0, distribution: 0 };
      const coRow = labActivityRows.find(r => String(r.coNumber || '').replace('CLO', 'CO') === coNumber);
      let labObt = 0;
      let labDist = 0;

      if (studentObt && coRow) {
        labObt = getLabActivityStudentCOMappedMarks(studentObt, coRow, activityTotals, labData || {});
        for (let i = 1; i <= activityTaken; i++) {
          if ((coRow[`Activity${i}_Q1`] || 0) !== 0) labDist += eqWt;
          if ((coRow[`Activity${i}_Q2`] || 0) !== 0) labDist += eqWt;
          if ((coRow[`Activity${i}_Q3`] || 0) !== 0) labDist += eqWt;
        }
      }

      const totalDist = (theory.distribution || 0) + labDist;
      const totalObt = (theory.obtained || 0) + labObt;
      coValues[coNumber] = totalDist > 0 ? Number(((totalObt / totalDist) * 100).toFixed(4)) : 0;
    });

    return { rollNumber: roll, coValues };
  });
};

const calculateUnnormedCoAttainmentByStudent = (students, coNumbers, theoryData, labData) => {
  const theoryTotals = buildTheoryTotalsByStudent(students, coNumbers, theoryData || {
    sectionAData: {}, sectionBData: {}, ctData: {}, assignData: {}
  });

  const { labActivityRows = [], labActivityObtainedRows = [] } = labData || {};
  const activityTaken = labData?.activityTaken || 5;

  return theoryTotals.map(studentRow => {
    const roll = studentRow.rollNumber;
    const studentObt = labActivityObtainedRows.find(r => normalizeRoll(r.rollNumber) === normalizeRoll(roll));
    const coValues = {};

    coNumbers.forEach(coNumber => {
      const theory = studentRow.totals[coNumber] || { obtained: 0, distribution: 0 };
      const coRow = labActivityRows.find(r => String(r.coNumber || '').replace('CLO', 'CO') === coNumber);
      let labObt = 0;
      let labDist = 0;

      if (studentObt && coRow) {
        labObt = getLabActivityStudentCOMarks(studentObt, coRow, activityTaken);
        labDist = computeLabActivityCOTotal(coRow, activityTaken);
      }

      const totalDist = (theory.distribution || 0) + labDist;
      const totalObt = (theory.obtained || 0) + labObt;
      coValues[coNumber] = totalDist > 0 ? Number(((totalObt / totalDist) * 100).toFixed(4)) : 0;
    });

    return { rollNumber: roll, coValues };
  });
};

const calculateEqualWtCoAttainmentByStudent = (theoryRows, labRows, coNumbers, sourceTypeMap = {}) => {
  const theoryMap = new Map((theoryRows || []).map(r => [normalizeRoll(r.rollNumber), r]));
  const labMap = new Map((labRows || []).map(r => [normalizeRoll(r.rollNumber), r]));
  const rollSet = new Set([...theoryMap.keys(), ...labMap.keys()]);

  const weights = {};
  coNumbers.forEach(coNumber => {
    const sourceType = sourceTypeMap[coNumber];
    let tBin = 0;
    let lBin = 0;
    if (sourceType === 'theory' || sourceType === 'both') tBin = 1;
    if (sourceType === 'lab' || sourceType === 'both') lBin = 1;
    if (!sourceType) {
      tBin = (theoryRows || []).some(r => (r.coValues?.[coNumber] || 0) > 0) ? 1 : 0;
      lBin = (labRows || []).some(r => (r.coValues?.[coNumber] || 0) > 0) ? 1 : 0;
    }
    const sum = tBin + lBin;
    weights[coNumber] = {
      theory: sum > 0 ? tBin / sum : 0,
      lab: sum > 0 ? lBin / sum : 0,
    };
  });

  return Array.from(rollSet).filter(Boolean).map(roll => {
    const theoryRow = theoryMap.get(roll);
    const labRow = labMap.get(roll);
    const coValues = {};

    coNumbers.forEach(coNumber => {
      const tVal = theoryRow?.coValues?.[coNumber] || 0;
      const lVal = labRow?.coValues?.[coNumber] || 0;
      const wt = weights[coNumber] || { theory: 0, lab: 0 };
      coValues[coNumber] = Number(((tVal * wt.theory) + (lVal * wt.lab)).toFixed(4));
    });

    return { rollNumber: roll, coValues };
  });
};

const calculateCourseCOAttainment = (courseType, students, coNumbers, attainmentData) => {
  const isLab = courseType === 'SESSIONAL' || courseType === 'PROJECT/THESIS';
  if (isLab) {
    return calculateLabCOAttainment(students, coNumbers, attainmentData);
  } else {
    return calculateTheoryCOAttainment(students, coNumbers, attainmentData);
  }
};

module.exports = {
  calculateCourseCOAttainment,
  calculateTheoryCoAttainmentByStudent,
  calculateLabCoAttainmentByStudent,
  calculateCombinedCoAttainmentByStudent,
  calculateUnnormedCoAttainmentByStudent,
  calculateEqualWtCoAttainmentByStudent
};
