const User = require('../models/User');
const { sendApprovalEmail } = require('../utils/emailService');

// @desc    Get all pending users (email verified but not approved)
// @route   GET /api/admin/pending-users
// @access  Admin only
exports.getPendingUsers = async (req, res) => {
  try {
    // Additional security check - verify admin role from req.user
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const pendingUsers = await User.find({
      role: { $ne: 'admin' },
      isEmailVerified: true,
      isApprovedByAdmin: false
    }).select('-password');

    res.status(200).json({
      success: true,
      count: pendingUsers.length,
      data: pendingUsers
    });

  } catch (error) {
    console.error('Get pending users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching pending users'
    });
  }
};

// @desc    Approve a user
// @route   PUT /api/admin/approve-user/:userId
// @access  Admin only
exports.approveUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.role === 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Cannot modify admin users'
      });
    }

    if (user.isApprovedByAdmin) {
      return res.status(400).json({
        success: false,
        message: 'User is already approved'
      });
    }

    if (!user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: 'User email must be verified before approval'
      });
    }

    user.isApprovedByAdmin = true;
    await user.save();

    // Send approval email
    try {
      await sendApprovalEmail(user.email, user.name);
    } catch (emailError) {
      console.error('Failed to send approval email:', emailError);
    }

    res.status(200).json({
      success: true,
      message: 'User approved successfully',
      data: {
        userId: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isApprovedByAdmin: user.isApprovedByAdmin
      }
    });

  } catch (error) {
    console.error('Approve user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error approving user'
    });
  }
};

// @desc    Reject/delete a user
// @route   PUT /api/admin/reject-user/:userId
// @access  Admin only
exports.rejectUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.role === 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Cannot reject admin users'
      });
    }

    await User.findByIdAndDelete(userId);

    res.status(200).json({
      success: true,
      message: 'User rejected and removed from system'
    });

  } catch (error) {
    console.error('Reject user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error rejecting user'
    });
  }
};

// @desc    Get all users
// @route   GET /api/admin/users
// @access  Admin only
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password');

    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });

  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching users'
    });
  }
};

// @desc    Toggle user active status
// @route   PUT /api/admin/users/:userId/toggle-status
// @access  Admin only
exports.toggleUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.role === 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Cannot modify admin users'
      });
    }

    user.isActive = !user.isActive;
    await user.save();

    res.status(200).json({
      success: true,
      message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully`,
      data: {
        userId: user._id,
        name: user.name,
        email: user.email,
        isActive: user.isActive
      }
    });

  } catch (error) {
    console.error('Toggle user status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error toggling user status'
    });
  }
};
