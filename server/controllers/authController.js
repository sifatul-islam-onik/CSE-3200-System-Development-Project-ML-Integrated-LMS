const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const { hashToken } = require('../utils/tokenUtils');
const { sendVerificationEmail } = require('../utils/emailService');

// Generate JWT token
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

// @desc    Register a new user (teacher or student only)
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }

    let { name, email, password, role } = req.body;

    // CRITICAL: Prevent admin registration through public API
    // Double-check and sanitize role to prevent any bypass attempts
    if (role === 'admin' || role?.toLowerCase() === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin accounts cannot be created through registration. Contact system administrator.'
      });
    }

    // Force role to be either teacher or student - no other values accepted
    if (role !== 'teacher' && role !== 'student') {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Only teacher and student roles are allowed.'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOTP = hashToken(otp);

    // Create new user
    const user = new User({
      name,
      email,
      password,
      role
    });

    // Set OTP fields explicitly
    user.emailVerificationOTP = hashedOTP;
    user.emailVerificationExpires = Date.now() + 15 * 60 * 1000; // 15 minutes
    
    // Save user
    await user.save();

    // Send verification email with OTP
    try {
      await sendVerificationEmail(user.email, user.name, otp);
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      // Continue with registration even if email fails
    }

    res.status(201).json({
      success: true,
      message: 'Registration successful! A 6-digit OTP has been sent to your email. Please verify your email within 15 minutes. After verification, your account will need admin approval before you can log in.',
      data: {
        userId: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        isApprovedByAdmin: user.isApprovedByAdmin
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration'
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }

    const { email, password } = req.body;

    // Find user and include password field
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is inactive'
      });
    }

    // Check email verification (not required for admin)
    if (user.role !== 'admin' && !user.isEmailVerified) {
      // Generate new OTP for unverified user
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const hashedOTP = hashToken(otp);

      user.emailVerificationOTP = hashedOTP;
      user.emailVerificationExpires = Date.now() + 15 * 60 * 1000; // 15 minutes
      await user.save();

      // Send new verification email
      try {
        await sendVerificationEmail(user.email, user.name, otp);
      } catch (emailError) {
        console.error('Failed to send OTP:', emailError);
      }

      return res.status(403).json({
        success: false,
        message: 'Your email is not verified. A new verification code has been sent to your email.',
        requiresVerification: true,
        email: user.email
      });
    }

    // Check admin approval (not required for admin)
    if (user.role !== 'admin' && !user.isApprovedByAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Your account is pending admin approval'
      });
    }

    // Generate token with user id and role
    const token = generateToken(user._id, user.role);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      data: {
        userId: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        isApprovedByAdmin: user.isApprovedByAdmin
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

// @desc    Verify email with OTP
// @route   POST /api/auth/verify-email
// @access  Public
exports.verifyEmail = async (req, res) => {
  try {
    let { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Email and OTP are required'
      });
    }

    // Normalize email (trim and lowercase)
    email = email.trim().toLowerCase();
    otp = otp.trim();

    // Find user with email
    const user = await User.findOne({ email }).select('+emailVerificationOTP +emailVerificationExpires');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found. Please check your email address.'
      });
    }

    // Check if already verified
    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email already verified'
      });
    }

    // Check if OTP exists
    if (!user.emailVerificationOTP) {
      return res.status(400).json({
        success: false,
        message: 'No verification code found. Please register again.'
      });
    }

    // Check if OTP expired
    if (user.emailVerificationExpires < Date.now()) {
      return res.status(400).json({
        success: false,
        message: 'Verification code has expired. Please request a new one.'
      });
    }

    // Hash the provided OTP and compare
    const hashedOTP = hashToken(otp);
    if (hashedOTP !== user.emailVerificationOTP) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification code'
      });
    }

    // Verify email
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

// @desc    Resend verification OTP
// @route   POST /api/auth/resend-otp
// @access  Public
exports.resendOTP = async (req, res) => {
  try {
    let { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    // Normalize email
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

    // Generate new OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOTP = hashToken(otp);

    user.emailVerificationOTP = hashedOTP;
    user.emailVerificationExpires = Date.now() + 15 * 60 * 1000; // 15 minutes
    await user.save();

    // Send verification email
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
