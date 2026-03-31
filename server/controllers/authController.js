const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { validationResult } = require('express-validator');
const { hashToken } = require('../utils/tokenUtils');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/emailService');

const loginAttempts = new Map(); // key: normalised email -> { count, lockedUntil }
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

const generateToken = (userId, role) => {
  return jwt.sign(
    { 
      id: userId,
      role: role
    }, 
    process.env.JWT_SECRET, 
    {
      expiresIn: process.env.JWT_EXPIRE
    }
  );
};

exports.login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }

    const { identifier, password } = req.body;

    const lockKey = String(identifier || '').toLowerCase().trim();
    const lockInfo = loginAttempts.get(lockKey) || { count: 0, lockedUntil: 0 };
    if (lockInfo.lockedUntil > Date.now()) {
      const remainingMinutes = Math.ceil((lockInfo.lockedUntil - Date.now()) / 60000);
      return res.status(429).json({
        success: false,
        message: `Too many failed login attempts. Please try again in ${remainingMinutes} minute(s).`
      });
    }

    const user = await User.findOne({
      $or: [
        { email: identifier.toLowerCase() },
        { roll: identifier }
      ]
    }).select('+password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email/roll number or password'
      });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      const newCount = (lockInfo.count || 0) + 1;
      const lockedUntil = newCount >= MAX_LOGIN_ATTEMPTS ? Date.now() + LOCKOUT_DURATION_MS : 0;
      loginAttempts.set(lockKey, { count: newCount, lockedUntil });
      return res.status(401).json({
        success: false,
        message: newCount >= MAX_LOGIN_ATTEMPTS
          ? 'Too many failed login attempts. Account locked for 15 minutes.'
          : 'Invalid email/roll number or password'
      });
    }
    loginAttempts.delete(lockKey);

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is inactive'
      });
    }

    const token = generateToken(user._id, user.role);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      data: {
        userId: user._id,
        name: user.name,
        email: user.email,
        roll: user.roll,
        father: user.father,
        mother: user.mother,
        advisor: user.advisor,
        phone: user.phone,
        address: user.address,
        hall: user.hall,
        scholarship: user.scholarship,
        gender: user.gender,
        bloodGroup: user.bloodGroup,
        religion: user.religion,
        profilePicture: user.profilePicture,
        signature: user.signature,
        designation: user.designation,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        isApprovedByAdmin: user.isApprovedByAdmin,
        isActive: user.isActive,
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
};

exports.verifyEmail = async (req, res) => {
  try {
    let { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Email and OTP are required'
      });
    }

    email = email.trim().toLowerCase();
    otp = otp.trim();

    const user = await User.findOne({ email }).select('+emailVerificationOTP +emailVerificationExpires');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found. Please check your email address.'
      });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email already verified'
      });
    }

    if (!user.emailVerificationOTP) {
      return res.status(400).json({
        success: false,
        message: 'No verification code found. Please register again.'
      });
    }

    if (user.emailVerificationExpires < Date.now()) {
      return res.status(400).json({
        success: false,
        message: 'Verification code has expired. Please request a new one.'
      });
    }

    const hashedOTP = hashToken(otp);
    if (hashedOTP !== user.emailVerificationOTP) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification code'
      });
    }

    user.isEmailVerified = true;
    user.emailVerificationOTP = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Email verified successfully! Your account is now pending admin approval.',
      data: {
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

exports.resendOTP = async (req, res) => {
  try {
    let { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    email = email.trim().toLowerCase();

    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email already verified'
      });
    }

    const otp = crypto.randomInt(100000, 1000000).toString();
    const hashedOTP = hashToken(otp);

    user.emailVerificationOTP = hashedOTP;
    user.emailVerificationExpires = Date.now() + 15 * 60 * 1000; // 15 minutes
    await user.save();

    try {
      await sendVerificationEmail(user.email, user.name, otp);
    } catch (emailError) {
      console.error('Failed to send OTP email:', emailError);
      return res.status(500).json({
        success: false,
        message: 'Failed to send verification email'
      });
    }

    res.status(200).json({
      success: true,
      message: 'New verification code sent to your email'
    });

  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    let { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    email = email.trim().toLowerCase();

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this email'
      });
    }

    const otp = crypto.randomInt(100000, 1000000).toString();
    const hashedOTP = hashToken(otp);

    user.passwordResetOTP = hashedOTP;
    user.passwordResetExpires = Date.now() + 15 * 60 * 1000;
    await user.save();

    try {
      await sendPasswordResetEmail(user.email, user.name, otp);
    } catch (emailError) {
      console.error('Failed to send password reset email:', emailError);
      return res.status(500).json({
        success: false,
        message: 'Failed to send password reset code'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'A password reset code has been sent to your email'
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    let { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Email, OTP and new password are required'
      });
    }

    email = email.trim().toLowerCase();
    otp = String(otp).trim();

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    const user = await User.findOne({ email }).select('+passwordResetOTP +passwordResetExpires');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.passwordResetOTP || !user.passwordResetExpires) {
      return res.status(400).json({
        success: false,
        message: 'No active reset request found. Please request a new code.'
      });
    }

    if (user.passwordResetExpires < Date.now()) {
      return res.status(400).json({
        success: false,
        message: 'Reset code has expired. Please request a new code.'
      });
    }

    const hashedOTP = hashToken(otp);
    if (hashedOTP !== user.passwordResetOTP) {
      return res.status(400).json({
        success: false,
        message: 'Invalid reset code'
      });
    }

    user.password = newPassword;
    user.passwordResetOTP = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Password reset successful. You can now log in.'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      name,
      profilePicture,
      signature,
      father,
      mother,
      advisor,
      phone,
      address,
      hall,
      scholarship,
      gender,
      bloodGroup,
      religion,
      currentPassword,
      newPassword
    } = req.body;

    const user = await User.findById(userId).select(currentPassword && newPassword ? '+password' : '');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (name !== undefined) {
      if (!name || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Name is required'
        });
      }

      if (name.trim().length < 2) {
        return res.status(400).json({
          success: false,
          message: 'Name must be at least 2 characters'
        });
      }
      user.name = name.trim();
    }

    if (profilePicture !== undefined) {
      user.profilePicture = profilePicture;
    }

    if (signature !== undefined) {
      user.signature = signature;
    }

    if (father !== undefined) user.father = father;
    if (mother !== undefined) user.mother = mother;
    if (advisor !== undefined) user.advisor = advisor;
    if (phone !== undefined) user.phone = phone;
    if (address !== undefined) user.address = address;
    if (hall !== undefined) user.hall = hall;
    if (scholarship !== undefined) user.scholarship = scholarship;
    if (bloodGroup !== undefined) user.bloodGroup = bloodGroup;
    if (religion !== undefined) {
      const rRaw = String(religion || '').trim().toLowerCase();
      const allowedReligions = ['islam', 'hinduism', 'buddhism', 'christian', 'others'];
      if (!allowedReligions.includes(rRaw)) {
        return res.status(400).json({ success: false, message: 'Invalid religion value' });
      }
      const canonicalReligionMap = {
        islam: 'Islam',
        hinduism: 'Hinduism',
        buddhism: 'Buddhism',
        christian: 'Christian',
        others: 'Others'
      };
      user.religion = canonicalReligionMap[rRaw];
    }

    if (gender !== undefined) {
      const g = String(gender || '').toLowerCase();
      if (!['male', 'female', 'others'].includes(g)) {
        return res.status(400).json({ success: false, message: 'Invalid gender value' });
      }
      user.gender = g;
    }

    if (currentPassword !== undefined || newPassword !== undefined) {
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ success: false, message: 'Current and new password are required' });
      }
      if (!user.password) {
        return res.status(400).json({ success: false, message: 'Password not available for comparison' });
      }
      const isValid = await user.comparePassword(currentPassword);
      if (!isValid) {
        return res.status(401).json({ success: false, message: 'Current password is incorrect' });
      }
      if (String(newPassword).length < 6) {
        return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
      }
      user.password = newPassword; // pre-save hook will hash
      user.initialPassword = newPassword; // Update initial password for export purposes
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        _id: user._id,
        name: user.name,
        father: user.father,
        mother: user.mother,
        advisor: user.advisor,
        phone: user.phone,
        address: user.address,
        hall: user.hall,
        scholarship: user.scholarship,
        gender: user.gender,
        bloodGroup: user.bloodGroup,
        religion: user.religion,
        email: user.email,
        designation: user.designation,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        isApprovedByAdmin: user.isApprovedByAdmin,
        isActive: user.isActive,
        profilePicture: user.profilePicture,
        signature: user.signature,
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating profile'
    });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.status(200).json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        father: user.father,
        mother: user.mother,
        advisor: user.advisor,
        phone: user.phone,
        address: user.address,
        hall: user.hall,
        scholarship: user.scholarship,
        gender: user.gender,
        bloodGroup: user.bloodGroup,
        religion: user.religion,
        email: user.email,
        designation: user.designation,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        isApprovedByAdmin: user.isApprovedByAdmin,
        isActive: user.isActive,
        profilePicture: user.profilePicture,
        signature: user.signature,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching profile' });
  }
};
