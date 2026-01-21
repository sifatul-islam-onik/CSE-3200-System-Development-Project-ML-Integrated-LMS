const {
  readCourseProfile,
  updateCLOField
} = require('../utils/courseProfileExcelUtil');

/**
 * Get CourseProfile CLO data
 * GET /api/course-profile
 */
exports.getCourseProfile = async (req, res) => {
  try {
    const clos = await readCourseProfile();
    
    res.json({
      success: true,
      data: clos
    });
  } catch (error) {
    console.error('Error reading course profile:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Update CLO field
 * PUT /api/course-profile/update
 */
exports.updateCLO = async (req, res) => {
  try {
    const { cloNumber, field, value } = req.body;

    if (!cloNumber || !field) {
      return res.status(400).json({
        success: false,
        error: 'CLO number and field are required'
      });
    }

    await updateCLOField(cloNumber, field, value);
    
    res.json({
      success: true,
      message: 'CLO updated successfully'
    });
  } catch (error) {
    console.error('Error updating CLO:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
