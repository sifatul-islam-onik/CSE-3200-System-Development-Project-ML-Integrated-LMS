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

    // Disallow student self-registration; only teachers may self-register
    if (role === 'student') {
      return res.status(403).json({
        success: false,
        message: 'Student accounts cannot be created via self-registration. Please contact an administrator.'
      });
    }

    // Force role to be teacher only at this endpoint
    if (role !== 'teacher') {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Only teacher self-registration is allowed.'
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
      initialPassword: password,
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
// @desc    Update user profile
// @route   PUT /api/auth/profile/update
// @access  Protected
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      name,
      email,
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

    // If changing password, include password in query
    const user = await User.findById(userId).select(currentPassword && newPassword ? '+password' : '');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update name if provided
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

    // Update profile picture if provided (base64 string)
    if (profilePicture !== undefined) {
      user.profilePicture = profilePicture;
    }

    // Update signature if provided (base64 string)
    if (signature !== undefined) {
      user.signature = signature;
    }

    // Update simple text fields if provided
    if (father !== undefined) user.father = father;
    if (mother !== undefined) user.mother = mother;
    if (advisor !== undefined) user.advisor = advisor;
    if (phone !== undefined) user.phone = phone;
    if (address !== undefined) user.address = address;
    if (hall !== undefined) user.hall = hall;
    if (scholarship !== undefined) user.scholarship = scholarship;
    if (bloodGroup !== undefined) user.bloodGroup = bloodGroup;
    // Update religion if provided and valid; map to canonical case
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

    // Update gender if provided and valid
    if (gender !== undefined) {
      const g = String(gender || '').toLowerCase();
      if (!['male', 'female', 'others'].includes(g)) {
        return res.status(400).json({ success: false, message: 'Invalid gender value' });
      }
      user.gender = g;
    }

    // Update email if provided
    if (email !== undefined) {
      const normalized = String(email).trim().toLowerCase();
      const emailRegex = /^\S+@\S+\.\S+$/;
      if (!emailRegex.test(normalized)) {
        return res.status(400).json({ success: false, message: 'Please enter a valid email' });
      }
      // Ensure email uniqueness
      const existing = await User.findOne({ email: normalized, _id: { $ne: userId } });
      if (existing) {
        return res.status(409).json({ success: false, message: 'Email already in use' });
      }
      user.email = normalized;
    }

    // Handle password change if requested
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

// @desc    Get current user profile
// @route   GET /api/auth/profile
// @access  Protected
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