// @desc    Get user metadata (departments, batches)
// @route   GET /api/admin/users/metadata
// @access  Admin only
exports.getUsersMetadata = async (req, res) => {
  try {
    const teachers = await User.find({ role: 'teacher' }).select('department email -_id').lean();
    const students = await User.find({ role: 'student' }).select('department roll -_id').lean();
    
    res.status(200).json({
      success: true,
      data: {
        teachers,
        students
      }
    });
  } catch (error) {
    console.error('Get users metadata error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching users metadata'
    });
  }
};
