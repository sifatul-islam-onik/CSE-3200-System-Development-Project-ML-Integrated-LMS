const User = require('../models/User');
const { hashToken } = require('../utils/tokenUtils');

exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;

    const hashedToken = hashToken(token);

    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification token'
      });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email is already verified'
      });
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Email verified successfully! Your account is now pending admin approval. You will be notified once approved.',
      data: {
        userId: user._id,
        email: user.email,
        isEmailVerified: user.isEmailVerified,
        isApprovedByAdmin: user.isApprovedByAdmin
      }
    });

  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during email verification'
    });
  }
};
