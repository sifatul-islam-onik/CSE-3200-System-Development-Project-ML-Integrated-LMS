const { computeStudentTotal, computeLabStudentTotal, computeCTColumnTotals, computeAssignmentColumnTotals, getStudentCTFactoredMarks, getStudentAssignmentFactoredMarks, computeSectionCOMarks, computeLabActivityColumnTotals } = require('./gradeUtils');

// Helper to determine the factored mapped marks distribution per CO
const calculateFactoredCOTotals = (ctData, activeCTFields, coNumbers) => {
  const { ctRows = [], ctSummary = {}, ctManualWts = {} } = ctData;
  const useEqWt = ctSummary.useEqWt || 0;
  const coMappedMarks = ctSummary.coMappedMarks60 || 0;
  const ctTaken = ctSummary.ctTaken || 1;
  const ctTotals = computeCTColumnTotals(ctRows);
  
  const factoredTotals = {};

  coNumbers.forEach(coKey => {
    // Find the CO row
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

/**
 * Calculates CO percentage statistics for a particular theory course.
 */
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
      // 1. Calculate section allocated marks
      const coRowA = sectionARows.find(r => String(r.coNumber || '').replace('CLO', 'CO') === coNumber);
      const coRowB = sectionBRows.find(r => String(r.coNumber || '').replace('CLO', 'CO') === coNumber);

      let distA = 0; let distB = 0;
      if (coRowA) {
        ['Q1a','Q1b','Q1c','Q1d','Q2a','Q2b','Q2c','Q2d','Q3a','Q3b','Q3c','Q3d','Q4a','Q4b','Q4c','Q4d'].forEach(f => distA += (parseFloat(coRowA[f]) || 0));
      }
      if (coRowB) {
        ['Q5a','Q5b','Q5c','Q5d','Q6a','Q6b','Q6c','Q6d','Q7a','Q7b','Q7c','Q7d','Q8a','Q8b','Q8c','Q8d'].forEach(f => distB += (parseFloat(coRowB[f]) || 0));
      }

      // 2. Computed distributed (total allocated marks for this CO)
      const totalDist = distA + distB + (factoredCTTotals[coNumber] || 0) + (factoredAssignTotals[coNumber] || 0);

      // 3. Computed obtained total marks for this CO
      const obtA = computeSectionCOMarks(studentObtA, coRowA);
      const obtB = computeSectionCOMarks(studentObtB, coRowB);
      const obtCT = getStudentCTFactoredMarks(student.roll, coNumber, ctData);
      const obtAssign = getStudentAssignmentFactoredMarks(student.roll, coNumber, assignData);
      const totalObt = obtA + obtB + obtCT + obtAssign;

      // 4. Calculate Percentage
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

/**
 * Transforms intermediate count into formatted array for db
 */
const generateFinalStats = (coStats) => {
  return Object.keys(coStats).map(coKey => {
    const stat = coStats[coKey];
    const passPercentage = stat.attempted > 0 ? (stat.passedThreshold / stat.attempted) * 100 : 0;
    
    // Example target rules: > 60% = Level 3, > 50% = Level 2, > 40% = Level 1
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

/**
 * Calculates CO percentage statistics for a particular lab course.
 */
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

/**
 * Main export for server side CO Attainment Calculation
 */
const calculateCourseCOAttainment = (courseType, students, coNumbers, attainmentData) => {
  const isLab = courseType === 'SESSIONAL' || courseType === 'PROJECT/THESIS';
  if (isLab) {
    return calculateLabCOAttainment(students, coNumbers, attainmentData);
  } else {
    return calculateTheoryCOAttainment(students, coNumbers, attainmentData);
  }
};

module.exports = {
  calculateCourseCOAttainment
};