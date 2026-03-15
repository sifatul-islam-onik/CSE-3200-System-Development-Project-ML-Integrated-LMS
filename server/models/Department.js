const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: [true, 'Department code is required'],
    uppercase: true,
    trim: true,
    description: 'The short alphanumeric code of the department (e.g., CSE, EEE)'
  },
  name: {
    type: String,
    required: [true, 'Department full name is required'],
    trim: true
  },
  numericCode: {
    type: String,
    required: [true, 'Numeric code is required'],
    unique: true,
    trim: true,
    description: 'The 2-digit numeric code used in student rolls (e.g., 01 for CSE)'
  },
  maxYear: {
    type: Number,
    default: 4,
    description: 'Maximum year level allowed (e.g., 5 for Architecture, 4 for others)'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Department', departmentSchema);