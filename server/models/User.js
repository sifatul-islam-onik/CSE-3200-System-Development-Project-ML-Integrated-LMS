const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  role: {
    type: String,
    enum: {
      values: ['admin', 'teacher', 'student'],
      message: 'Role must be admin, teacher, or student'
    },
    required: [true, 'Role is required']
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  isApprovedByAdmin: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  profilePicture: {
    type: String,
    default: null
  },
  signature: {
    type: String,
    default: null
  },
  father: {
    type: String,
    default: ''
  },
  mother: {
    type: String,
    default: ''
  },
  advisor: {
    type: String,
    default: ''
  },
  phone: {
    type: String,
    default: ''
  },
  address: {
    type: String,
    default: ''
  },
  hall: {
    type: String,
    default: ''
  },
  scholarship: {
    type: String,
    default: ''
  },
  gender: {
    type: String,
    enum: {
      values: ['male', 'female', 'others'],
      message: 'Gender must be male, female, or others'
    },
    default: 'others'
  },
  bloodGroup: {
    type: String,
    default: ''
  },
  religion: {
    type: String,
    enum: {
      values: ['Islam', 'Hinduism', 'Buddhism', 'Christian', 'Others'],
      message: 'Religion must be one of Islam, Hinduism, Buddhism, Christian, Others'
    },
    default: 'Others'
  },
  emailVerificationOTP: {
    type: String,
    select: false
  },
  emailVerificationExpires: {
    type: Date,
    select: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password for authentication
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error(error);
  }
};

// Method to check if user can access system
userSchema.methods.canAccessSystem = function() {
  if (this.role === 'admin') {
    return this.isActive;
  }
  return this.isActive && this.isEmailVerified && this.isApprovedByAdmin;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
