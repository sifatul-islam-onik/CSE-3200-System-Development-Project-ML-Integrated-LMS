const ProgramOutcome = require('../models/ProgramOutcome');

// @desc    Get all program outcomes
// @route   GET /api/program-outcomes
// @access  Public
exports.getAllProgramOutcomes = async (req, res) => {
  try {
    const programOutcomes = await ProgramOutcome.find()
      .sort({ po_number: 1 })
      .select('-__v');

    res.status(200).json({
      success: true,
      count: programOutcomes.length,
      data: programOutcomes
    });
  } catch (error) {
    console.error('Get all program outcomes error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching program outcomes',
      error: error.message
    });
  }
};

// @desc    Get single program outcome by code
// @route   GET /api/program-outcomes/:code
// @access  Public
exports.getProgramOutcomeByCode = async (req, res) => {
  try {
    const { code } = req.params;

    const programOutcome = await ProgramOutcome.findOne({ 
      po_code: code.toUpperCase() 
    });

    if (!programOutcome) {
      return res.status(404).json({
        success: false,
        message: 'Program outcome not found'
      });
    }

    res.status(200).json({
      success: true,
      data: programOutcome
    });
  } catch (error) {
    console.error('Get program outcome error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching program outcome',
      error: error.message
    });
  }
};

// @desc    Update program outcome (admin only, limited fields)
// @route   PUT /api/program-outcomes/:code
// @access  Admin only
exports.updateProgramOutcome = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const { code } = req.params;
    const { title, description } = req.body;

    const programOutcome = await ProgramOutcome.findOne({ 
      po_code: code.toUpperCase() 
    });

    if (!programOutcome) {
      return res.status(404).json({
        success: false,
        message: 'Program outcome not found'
      });
    }

    // Only allow updating title and description
    if (title) programOutcome.title = title;
    if (description) programOutcome.description = description;

    await programOutcome.save();

    res.status(200).json({
      success: true,
      message: 'Program outcome updated successfully',
      data: programOutcome
    });
  } catch (error) {
    console.error('Update program outcome error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating program outcome',
      error: error.message
    });
  }
};

// Note: Delete operations are intentionally NOT provided
// Program Outcomes are reference data and should not be deleted
