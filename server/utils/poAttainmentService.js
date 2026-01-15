const COPOMapping = require('../models/COPOMapping');
const ProgramOutcome = require('../models/ProgramOutcome');
const coAttainmentService = require('./coAttainmentService');

/**
 * Calculate PO attainment for a course using CO attainment and CO-PO mappings
 * @param {String} courseId - Course ID
 * @param {String} section - Section (A/B/null)
 * @param {String} academicYear - Academic year
 * @returns {Object} PO attainment results
 */
exports.calculatePOAttainment = async (courseId, section, academicYear) => {
  try {
    // 1. Get CO attainment for the course
    const coAttainmentData = await coAttainmentService.calculateCOAttainment(
      courseId,
      section,
      academicYear
    );

    if (!coAttainmentData.coAttainment || coAttainmentData.coAttainment.length === 0) {
      return {
        courseId,
        section,
        academicYear,
        poAttainment: [],
        summary: {
          totalPOs: 0,
          averageAttainment: 0,
          attainmentDistribution: {
            level0: 0,
            level1: 0,
            level2: 0,
            level3: 0
          }
        },
        message: 'No CO attainment data available'
      };
    }

    // 2. Fetch all CO-PO mappings for these COs
    const coIds = coAttainmentData.coAttainment.map(co => co.courseOutcome._id);
    const copoMappings = await COPOMapping.find({
      course_outcome: { $in: coIds }
    }).populate('course_outcome', 'co_code description');

    // 3. Initialize PO attainment map
    const poAttainmentMap = new Map();

    // Get all program outcomes
    const allPOs = await ProgramOutcome.find({}).sort({ code: 1 });

    // Initialize all POs with zero values
    for (const po of allPOs) {
      poAttainmentMap.set(po.code, {
        programOutcome: {
          code: po.code,
          description: po.description
        },
        totalWeightedAttainment: 0,
        totalMappingWeight: 0,
        contributingCOs: []
      });
    }

    // 4. Calculate weighted attainment for each PO
    for (const coAttainment of coAttainmentData.coAttainment) {
      const coId = coAttainment.courseOutcome._id.toString();

      // Get all PO mappings for this CO
      const coMappings = copoMappings.filter(
        mapping => mapping.course_outcome._id.toString() === coId
      );

      for (const mapping of coMappings) {
        const poCode = mapping.program_outcome_code;
        const mappingLevel = mapping.level; // 0 or 1 (Not Mapped or Mapped)

        if (mappingLevel === 0) {
          continue; // Skip not mapped COs
        }

        if (!poAttainmentMap.has(poCode)) {
          continue; // Skip if PO not found (shouldn't happen)
        }

        const poData = poAttainmentMap.get(poCode);

        // Weight the CO attainment by the mapping level
        const weightedAttainment = coAttainment.attainmentPercentage * mappingLevel;

        poData.totalWeightedAttainment += weightedAttainment;
        poData.totalMappingWeight += mappingLevel;
        poData.contributingCOs.push({
          co_code: coAttainment.courseOutcome.co_code,
          co_id: coAttainment.courseOutcome._id,
          attainmentPercentage: coAttainment.attainmentPercentage,
          mappingLevel: mappingLevel
        });
      }
    }

    // 5. Calculate final PO attainment percentages
    const poAttainmentResults = [];

    for (const [poCode, poData] of poAttainmentMap) {
      // Only include POs that have at least one CO mapped
      if (poData.totalMappingWeight === 0) {
        continue;
      }

      const attainmentPercentage = poData.totalWeightedAttainment / poData.totalMappingWeight;
      const attainmentLevel = coAttainmentService.determineAttainmentLevel(attainmentPercentage);

      poAttainmentResults.push({
        programOutcome: poData.programOutcome,
        attainmentPercentage: parseFloat(attainmentPercentage.toFixed(2)),
        attainmentLevel,
        contributingCOs: poData.contributingCOs,
        totalMappedCOs: poData.contributingCOs.length
      });
    }

    // Sort by PO code
    poAttainmentResults.sort((a, b) => {
      return a.programOutcome.code.localeCompare(b.programOutcome.code);
    });

    // 6. Calculate summary statistics
    const summary = {
      totalPOs: poAttainmentResults.length,
      averageAttainment: poAttainmentResults.length > 0
        ? parseFloat((poAttainmentResults.reduce((sum, po) => sum + po.attainmentPercentage, 0) / poAttainmentResults.length).toFixed(2))
        : 0,
      attainmentDistribution: coAttainmentService.calculateAttainmentDistribution(poAttainmentResults)
    };

    return {
      courseId,
      section,
      academicYear,
      poAttainment: poAttainmentResults,
      summary,
      coAttainmentSummary: coAttainmentData.summary
    };

  } catch (error) {
    console.error('PO attainment calculation error:', error);
    throw error;
  }
};

/**
 * Calculate PO attainment for a student in a course
 * @param {String} studentId - Student ID
 * @param {String} courseId - Course ID
 * @param {String} section - Section
 * @param {String} academicYear - Academic year
 * @returns {Object} Student PO attainment
 */
exports.calculateStudentPOAttainment = async (studentId, courseId, section, academicYear) => {
  try {
    // 1. Get student CO attainment
    const studentCOAttainment = await coAttainmentService.calculateStudentCOAttainment(
      studentId,
      courseId,
      section,
      academicYear
    );

    if (!studentCOAttainment || studentCOAttainment.length === 0) {
      return {
        studentId,
        courseId,
        section,
        academicYear,
        poAttainment: [],
        message: 'No CO attainment data available for student'
      };
    }

    // 2. Fetch CO-PO mappings
    const coIds = studentCOAttainment.map(co => co.courseOutcome._id);
    const copoMappings = await COPOMapping.find({
      course_outcome: { $in: coIds }
    }).populate('course_outcome', 'co_code description');

    // 3. Initialize PO attainment map
    const poAttainmentMap = new Map();

    // Get all program outcomes
    const allPOs = await ProgramOutcome.find({}).sort({ code: 1 });

    for (const po of allPOs) {
      poAttainmentMap.set(po.code, {
        programOutcome: {
          code: po.code,
          description: po.description
        },
        totalWeightedAttainment: 0,
        totalMappingWeight: 0,
        contributingCOs: []
      });
    }

    // 4. Calculate weighted attainment for each PO
    for (const coAttainment of studentCOAttainment) {
      const coId = coAttainment.courseOutcome._id.toString();

      const coMappings = copoMappings.filter(
        mapping => mapping.course_outcome._id.toString() === coId
      );

      for (const mapping of coMappings) {
        const poCode = mapping.program_outcome_code;
        const mappingLevel = mapping.level;

        if (mappingLevel === 0) {
          continue;
        }

        if (!poAttainmentMap.has(poCode)) {
          continue;
        }

        const poData = poAttainmentMap.get(poCode);

        const weightedAttainment = coAttainment.attainmentPercentage * mappingLevel;

        poData.totalWeightedAttainment += weightedAttainment;
        poData.totalMappingWeight += mappingLevel;
        poData.contributingCOs.push({
          co_code: coAttainment.courseOutcome.co_code,
          co_id: coAttainment.courseOutcome._id,
          attainmentPercentage: coAttainment.attainmentPercentage,
          mappingLevel: mappingLevel
        });
      }
    }

    // 5. Calculate final PO attainment
    const studentPOAttainment = [];

    for (const [poCode, poData] of poAttainmentMap) {
      if (poData.totalMappingWeight === 0) {
        continue;
      }

      const attainmentPercentage = poData.totalWeightedAttainment / poData.totalMappingWeight;
      const attainmentLevel = coAttainmentService.determineAttainmentLevel(attainmentPercentage);

      studentPOAttainment.push({
        programOutcome: poData.programOutcome,
        attainmentPercentage: parseFloat(attainmentPercentage.toFixed(2)),
        attainmentLevel,
        contributingCOs: poData.contributingCOs
      });
    }

    // Sort by PO code
    studentPOAttainment.sort((a, b) => {
      return a.programOutcome.code.localeCompare(b.programOutcome.code);
    });

    return {
      studentId,
      courseId,
      section,
      academicYear,
      poAttainment: studentPOAttainment
    };

  } catch (error) {
    console.error('Student PO attainment calculation error:', error);
    throw error;
  }
};

/**
 * Generate PO attainment matrix for a course
 * Shows which COs contribute to which POs
 * @param {String} courseId - Course ID
 * @param {String} section - Section
 * @param {String} academicYear - Academic year
 * @returns {Object} PO attainment matrix
 */
exports.generatePOAttainmentMatrix = async (courseId, section, academicYear) => {
  try {
    // Get CO attainment
    const coAttainmentData = await coAttainmentService.calculateCOAttainment(
      courseId,
      section,
      academicYear
    );

    if (!coAttainmentData.coAttainment || coAttainmentData.coAttainment.length === 0) {
      return {
        courseId,
        section,
        academicYear,
        matrix: [],
        message: 'No CO attainment data available'
      };
    }

    // Fetch CO-PO mappings
    const coIds = coAttainmentData.coAttainment.map(co => co.courseOutcome._id);
    const copoMappings = await COPOMapping.find({
      course_outcome: { $in: coIds }
    }).populate('course_outcome', 'co_code description');

    // Get all POs
    const allPOs = await ProgramOutcome.find({}).sort({ code: 1 });
    const poList = allPOs.map(po => po.code);

    // Build matrix
    const matrix = [];

    for (const coAttainment of coAttainmentData.coAttainment) {
      const coId = coAttainment.courseOutcome._id.toString();
      const row = {
        co_code: coAttainment.courseOutcome.co_code,
        co_id: coAttainment.courseOutcome._id,
        coAttainmentPercentage: coAttainment.attainmentPercentage,
        coAttainmentLevel: coAttainment.attainmentLevel,
        poMappings: {}
      };

      // Initialize all POs with null
      for (const poCode of poList) {
        row.poMappings[poCode] = null;
      }

      // Fill in mapped POs
      const coMappings = copoMappings.filter(
        mapping => mapping.course_outcome._id.toString() === coId
      );

      for (const mapping of coMappings) {
        const poCode = mapping.program_outcome_code;
        const mappingLevel = mapping.level;

        if (mappingLevel === 1) {
          row.poMappings[poCode] = {
            mapped: true,
            mappingLevel: mappingLevel,
            contributedAttainment: parseFloat((coAttainment.attainmentPercentage * mappingLevel).toFixed(2))
          };
        } else {
          row.poMappings[poCode] = {
            mapped: false,
            mappingLevel: 0,
            contributedAttainment: 0
          };
        }
      }

      matrix.push(row);
    }

    return {
      courseId,
      section,
      academicYear,
      poList,
      matrix
    };

  } catch (error) {
    console.error('PO attainment matrix generation error:', error);
    throw error;
  }
};
