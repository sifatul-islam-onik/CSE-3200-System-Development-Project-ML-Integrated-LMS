const COPOMapping = require('../models/COPOMapping');
const CourseOutcome = require('../models/CourseOutcome');
const ProgramOutcome = require('../models/ProgramOutcome');
const { validationResult } = require('express-validator');

// @desc    Create or update CO-PO mappings for a course outcome
// @route   POST /api/course-outcomes/:coId/po-mappings
// @access  Admin only
exports.setCOPOMappings = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }

    const { coId } = req.params;
    const { mappings } = req.body; // Array of { program_outcome_code, level }

    // Verify course outcome exists
    const courseOutcome = await CourseOutcome.findById(coId);
    if (!courseOutcome) {
      return res.status(404).json({
        success: false,
        message: 'Course outcome not found'
      });
    }

    // Validate mappings array
    if (!Array.isArray(mappings) || mappings.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one PO mapping is required for a CO'
      });
    }

    // Validate each mapping
    const validPOCodes = ['PO_A', 'PO_B', 'PO_C', 'PO_D', 'PO_E', 'PO_F', 'PO_G', 'PO_H', 'PO_I', 'PO_J', 'PO_K', 'PO_L'];
    const processedMappings = [];
    const seenPOs = new Set();

    for (const mapping of mappings) {
      const { program_outcome_code, level } = mapping;

      // Validate PO code
      if (!program_outcome_code || !validPOCodes.includes(program_outcome_code.toUpperCase())) {
        return res.status(400).json({
          success: false,
          message: `Invalid program outcome code: ${program_outcome_code}`
        });
      }

      // Validate level
      if (level === undefined || level === null) {
        return res.status(400).json({
          success: false,
          message: 'Mapping level is required'
        });
      }

      const levelNum = Number(level);
      if (isNaN(levelNum) || levelNum < 1 || levelNum > 3) {
        return res.status(400).json({
          success: false,
          message: 'Mapping level must be 1 (Low), 2 (Medium), or 3 (High)'
        });
      }

      // Check for duplicates in request
      const poCodeUpper = program_outcome_code.toUpperCase();
      if (seenPOs.has(poCodeUpper)) {
        return res.status(400).json({
          success: false,
          message: `Duplicate PO mapping for ${poCodeUpper}`
        });
      }
      seenPOs.add(poCodeUpper);

      // Verify PO exists in database
      const poExists = await ProgramOutcome.findOne({ po_code: poCodeUpper });
      if (!poExists) {
        return res.status(400).json({
          success: false,
          message: `Program outcome ${poCodeUpper} does not exist`
        });
      }

      processedMappings.push({
        program_outcome_code: poCodeUpper,
        level: levelNum
      });
    }

    // Delete existing mappings for this CO
    await COPOMapping.deleteMany({ course_outcome: coId });

    // Create new mappings (only non-zero levels, which are all 1-3)
    const createdMappings = [];
    for (const mapping of processedMappings) {
      const copoMapping = await COPOMapping.create({
        course_outcome: coId,
        program_outcome_code: mapping.program_outcome_code,
        level: mapping.level
      });
      createdMappings.push(copoMapping);
    }

    res.status(200).json({
      success: true,
      message: `CO-PO mappings updated successfully (${createdMappings.length} mappings)`,
      data: createdMappings
    });

  } catch (error) {
    console.error('Set CO-PO mappings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while setting CO-PO mappings',
      error: error.message
    });
  }
};

// @desc    Get CO-PO mappings for a course outcome
// @route   GET /api/course-outcomes/:coId/po-mappings
// @access  Public
exports.getCOPOMappings = async (req, res) => {
  try {
    const { coId } = req.params;

    // Verify course outcome exists
    const courseOutcome = await CourseOutcome.findById(coId);
    if (!courseOutcome) {
      return res.status(404).json({
        success: false,
        message: 'Course outcome not found'
      });
    }

    const mappings = await COPOMapping.find({ course_outcome: coId })
      .populate('course_outcome', 'co_code description')
      .sort({ program_outcome_code: 1 });

    res.status(200).json({
      success: true,
      count: mappings.length,
      data: mappings
    });

  } catch (error) {
    console.error('Get CO-PO mappings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching CO-PO mappings',
      error: error.message
    });
  }
};

// @desc    Get CO-PO matrix for a course
// @route   GET /api/courses/:courseId/co-po-matrix
// @access  Public
exports.getCOPOMatrixForCourse = async (req, res) => {
  try {
    const { courseId } = req.params;

    // Get all COs for this course
    const courseOutcomes = await CourseOutcome.find({ course: courseId })
      .sort({ co_code: 1 });

    if (courseOutcomes.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No course outcomes found for this course'
      });
    }

    // Get all mappings for these COs
    const coIds = courseOutcomes.map(co => co._id);
    const mappings = await COPOMapping.find({ 
      course_outcome: { $in: coIds } 
    }).populate('course_outcome', 'co_code description');

    // Build matrix structure
    const matrix = {};
    const poList = ['PO_A', 'PO_B', 'PO_C', 'PO_D', 'PO_E', 'PO_F', 'PO_G', 'PO_H', 'PO_I', 'PO_J', 'PO_K', 'PO_L'];
    
    // Initialize matrix
    courseOutcomes.forEach(co => {
      matrix[co.co_code] = {
        co_id: co._id,
        description: co.description,
        mappings: {}
      };
      // Initialize all POs to 0
      poList.forEach(po => {
        matrix[co.co_code].mappings[po] = 0;
      });
    });

    // Fill in actual mappings
    mappings.forEach(mapping => {
      const coCode = mapping.course_outcome.co_code;
      if (matrix[coCode]) {
        matrix[coCode].mappings[mapping.program_outcome_code] = mapping.level;
      }
    });

    // Calculate PO-wise totals and averages
    const poSummary = {};
    const poTotals = {};
    const averages = {};
    
    poList.forEach(po => {
      let total = 0;
      let count = 0;
      
      courseOutcomes.forEach(co => {
        const level = matrix[co.co_code].mappings[po];
        if (level > 0) {
          total += level;
          count++;
        }
      });

      poSummary[po] = {
        total,
        count,
        average: count > 0 ? (total / count).toFixed(2) : 0
      };
      poTotals[po] = total;
      averages[po] = count > 0 ? (total / count).toFixed(2) : '0.00';
    });

    // Convert matrix object to array format for frontend
    const matrixArray = courseOutcomes.map(co => {
      const row = {
        coNumber: co.co_code,
        description: co.description,
        taxonomy_levels: co.taxonomy_levels || []
      };
      
      // Add PO mapping levels to the row
      poList.forEach(po => {
        row[po] = matrix[co.co_code].mappings[po];
      });
      
      return row;
    });

    res.status(200).json({
      success: true,
      data: {
        course_id: courseId,
        matrix: matrixArray, // Array format for frontend
        poTotals,
        averages,
        po_summary: poSummary,
        total_cos: courseOutcomes.length,
        total_mappings: mappings.length
      }
    });

  } catch (error) {
    console.error('Get CO-PO matrix error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while generating CO-PO matrix',
      error: error.message
    });
  }
};

// @desc    Delete a specific CO-PO mapping
// @route   DELETE /api/course-outcomes/:coId/po-mappings/:poCode
// @access  Admin only
exports.deleteCOPOMapping = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const { coId, poCode } = req.params;

    // Check remaining mappings count
    const remainingCount = await COPOMapping.countDocuments({ 
      course_outcome: coId 
    });

    if (remainingCount <= 1) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete the last PO mapping. A CO must map to at least one PO.'
      });
    }

    const mapping = await COPOMapping.findOneAndDelete({
      course_outcome: coId,
      program_outcome_code: poCode.toUpperCase()
    });

    if (!mapping) {
      return res.status(404).json({
        success: false,
        message: 'CO-PO mapping not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'CO-PO mapping deleted successfully'
    });

  } catch (error) {
    console.error('Delete CO-PO mapping error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting CO-PO mapping',
      error: error.message
    });
  }
};

// @desc    Get PO attainment across all courses
// @route   GET /api/co-po-mappings/po-attainment
// @access  Public
exports.getPOAttainment = async (req, res) => {
  try {
    const { course_offered_to } = req.query;

    // Build query to get courses
    let courseQuery = {};
    if (course_offered_to) {
      courseQuery.course_offered_to = course_offered_to.toUpperCase();
    }

    const Course = require('../models/Course');
    const courses = await Course.find(courseQuery);
    const courseIds = courses.map(c => c._id);

    // Get all COs for these courses
    const courseOutcomes = await CourseOutcome.find({ 
      course: { $in: courseIds } 
    });
    const coIds = courseOutcomes.map(co => co._id);

    // Get all mappings
    const mappings = await COPOMapping.find({ 
      course_outcome: { $in: coIds } 
    });

    // Calculate attainment per PO
    const poList = ['PO_A', 'PO_B', 'PO_C', 'PO_D', 'PO_E', 'PO_F', 'PO_G', 'PO_H', 'PO_I', 'PO_J', 'PO_K', 'PO_L'];
    const attainment = {};

    poList.forEach(po => {
      const poMappings = mappings.filter(m => m.program_outcome_code === po);
      const total = poMappings.reduce((sum, m) => sum + m.level, 0);
      const count = poMappings.length;

      attainment[po] = {
        total,
        count,
        average: count > 0 ? (total / count).toFixed(2) : 0,
        courses_mapped: new Set(
          poMappings.map(m => {
            const co = courseOutcomes.find(c => c._id.toString() === m.course_outcome.toString());
            return co ? co.course.toString() : null;
          }).filter(Boolean)
        ).size
      };
    });

    res.status(200).json({
      success: true,
      data: {
        course_offered_to: course_offered_to || 'All',
        total_courses: courses.length,
        total_cos: courseOutcomes.length,
        total_mappings: mappings.length,
        po_attainment: attainment
      }
    });

  } catch (error) {
    console.error('Get PO attainment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while calculating PO attainment',
      error: error.message
    });
  }
};
