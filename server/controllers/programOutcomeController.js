const ProgramOutcome = require('../models/ProgramOutcome');

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

