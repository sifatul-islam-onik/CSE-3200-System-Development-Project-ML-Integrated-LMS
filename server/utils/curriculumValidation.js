/**
 * Curriculum Validation Utilities for KUET CSE (April 2024)
 * Provides OBE validation and compliance checks
 */

// KUET CSE Program Outcomes (PO1-PO12)
const PROGRAM_OUTCOMES = {
  PO1: 'Engineering knowledge',
  PO2: 'Problem analysis',
  PO3: 'Design/development of solutions',
  PO4: 'Conduct investigations of complex problems',
  PO5: 'Modern tool usage',
  PO6: 'The engineer and society',
  PO7: 'Environment and sustainability',
  PO8: 'Ethics',
  PO9: 'Individual and team work',
  PO10: 'Communication',
  PO11: 'Project management and finance',
  PO12: 'Life-long learning'
};

// Bloom's Taxonomy levels
const BLOOM_LEVELS = [
  'Remember',
  'Understand',
  'Apply',
  'Analyze',
  'Evaluate',
  'Create'
];

// KUET CSE curriculum constraints
const CURRICULUM_CONSTRAINTS = {
  minCreditsPerSemester: 12,
  maxCreditsPerSemester: 21,
  totalCredits: 162,
  minCOsPerCourse: 3,
  maxCOsPerCourse: 8
};

/**
 * Validate Course Outcomes
 */
const validateCourseOutcomes = (courseOutcomes) => {
  const errors = [];
  const warnings = [];

  if (!courseOutcomes || courseOutcomes.length === 0) {
    warnings.push('No course outcomes defined. OBE requires at least 3 COs.');
    return { valid: true, errors, warnings };
  }

  if (courseOutcomes.length < CURRICULUM_CONSTRAINTS.minCOsPerCourse) {
    warnings.push(`Course has ${courseOutcomes.length} COs. Recommended minimum is ${CURRICULUM_CONSTRAINTS.minCOsPerCourse}.`);
  }

  if (courseOutcomes.length > CURRICULUM_CONSTRAINTS.maxCOsPerCourse) {
    warnings.push(`Course has ${courseOutcomes.length} COs. Recommended maximum is ${CURRICULUM_CONSTRAINTS.maxCOsPerCourse}.`);
  }

  // Check each CO
  courseOutcomes.forEach((co, index) => {
    if (!co.coNumber || !co.description) {
      errors.push(`CO ${index + 1}: Missing required fields (coNumber or description)`);
    }

    // Check if at least one PO is mapped
    const hasPOMapping = co.poMapping && Object.values(co.poMapping).some(val => val > 0);
    if (!hasPOMapping) {
      warnings.push(`CO ${co.coNumber || index + 1}: No PO mapping defined`);
    }

    // Validate Bloom's level
    if (co.bloomLevel && !BLOOM_LEVELS.includes(co.bloomLevel)) {
      errors.push(`CO ${co.coNumber}: Invalid Bloom's taxonomy level "${co.bloomLevel}"`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
};

/**
 * Validate PO mapping coverage
 * Checks if PO mappings are distributed across multiple POs
 */
const validatePOCoverage = (courseOutcomes) => {
  const warnings = [];
  
  if (!courseOutcomes || courseOutcomes.length === 0) {
    return { valid: true, warnings: ['No course outcomes to validate PO coverage'], coverage: {} };
  }

  const poCoverage = {};
  Object.keys(PROGRAM_OUTCOMES).forEach(po => {
    poCoverage[po] = 0;
  });

  // Aggregate PO mappings
  courseOutcomes.forEach(co => {
    if (co.poMapping) {
      Object.keys(co.poMapping).forEach(po => {
        if (co.poMapping[po] > 0) {
          poCoverage[po] += co.poMapping[po];
        }
      });
    }
  });

  const mappedPOs = Object.keys(poCoverage).filter(po => poCoverage[po] > 0);
  
  if (mappedPOs.length === 0) {
    warnings.push('Course has no PO mappings defined');
  } else if (mappedPOs.length < 3) {
    warnings.push(`Course maps to only ${mappedPOs.length} POs. Consider broader coverage.`);
  }

  return {
    valid: true,
    warnings,
    coverage: poCoverage,
    mappedPOs
  };
};

/**
 * Validate semester and year level consistency
 */
const validateSemesterYear = (semester, yearLevel) => {
  if (!semester || !yearLevel) {
    return { valid: true, message: 'Semester/year not specified' };
  }

  const expectedYear = Math.ceil(semester / 2);
  if (yearLevel !== expectedYear) {
    return {
      valid: false,
      message: `Semester ${semester} should be in year ${expectedYear}, but year ${yearLevel} was specified`
    };
  }

  return { valid: true, message: 'Semester and year are consistent' };
};

/**
 * Validate assessment plan totals to 100%
 */
const validateAssessmentPlan = (assessmentPlan) => {
  if (!assessmentPlan) {
    return { valid: true, message: 'No assessment plan provided' };
  }

  const { continuous = 0, midterm = 0, final = 0 } = assessmentPlan;
  const total = continuous + midterm + final;

  if (Math.abs(total - 100) > 0.01) {
    return {
      valid: false,
      message: `Assessment plan must total 100% (currently ${total}%)`,
      total
    };
  }

  return { valid: true, message: 'Assessment plan is valid', total };
};

/**
 * Main validation function for OBE compliance
 */
const validateOBECompliance = (courseData) => {
  const results = {
    valid: true,
    errors: [],
    warnings: [],
    details: {}
  };

  // Validate course outcomes
  const coCheck = validateCourseOutcomes(courseData.courseOutcomes);
  results.details.courseOutcomes = coCheck;
  if (!coCheck.valid) {
    results.errors.push(...coCheck.errors);
    results.valid = false;
  }
  if (coCheck.warnings.length > 0) {
    results.warnings.push(...coCheck.warnings);
  }

  // Validate PO coverage
  const poCheck = validatePOCoverage(courseData.courseOutcomes);
  results.details.poCoverage = poCheck;
  if (poCheck.warnings.length > 0) {
    results.warnings.push(...poCheck.warnings);
  }

  // Validate semester/year consistency
  if (courseData.semester && courseData.yearLevel) {
    const semesterCheck = validateSemesterYear(courseData.semester, courseData.yearLevel);
    results.details.semesterYear = semesterCheck;
    if (!semesterCheck.valid) {
      results.errors.push(semesterCheck.message);
      results.valid = false;
    }
  }

  // Validate assessment plan
  if (courseData.assessmentPlan) {
    const assessmentCheck = validateAssessmentPlan(courseData.assessmentPlan);
    results.details.assessmentPlan = assessmentCheck;
    if (!assessmentCheck.valid) {
      results.errors.push(assessmentCheck.message);
      results.valid = false;
    }
  }

  return results;
};

/**
 * Generate CO-PO mapping matrix for reporting
 */
const generateCOPOMatrix = (courseOutcomes) => {
  if (!courseOutcomes || courseOutcomes.length === 0) {
    return null;
  }

  const matrix = [];
  const poTotals = {};
  
  Object.keys(PROGRAM_OUTCOMES).forEach(po => {
    poTotals[po] = 0;
  });

  courseOutcomes.forEach(co => {
    const row = {
      coNumber: co.coNumber,
      description: co.description,
      bloomLevel: co.bloomLevel,
      ...co.poMapping
    };
    
    // Calculate totals
    Object.keys(co.poMapping || {}).forEach(po => {
      if (co.poMapping[po] > 0) {
        poTotals[po] += co.poMapping[po];
      }
    });
    
    matrix.push(row);
  });

  return {
    matrix,
    poTotals,
    averages: Object.keys(poTotals).reduce((acc, po) => {
      acc[po] = courseOutcomes.length > 0 ? (poTotals[po] / courseOutcomes.length).toFixed(2) : 0;
      return acc;
    }, {})
  };
};

module.exports = {
  PROGRAM_OUTCOMES,
  BLOOM_LEVELS,
  CURRICULUM_CONSTRAINTS,
  validateCourseOutcomes,
  validatePOCoverage,
  validateSemesterYear,
  validateAssessmentPlan,
  validateOBECompliance,
  generateCOPOMatrix
};
