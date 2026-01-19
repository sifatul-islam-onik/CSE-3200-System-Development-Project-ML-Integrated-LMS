const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  section: {
    type: String,
    enum: ['A', 'B', null],
    default: null
  },
  academicYear: {
    type: String,
    required: true
  },
  totalClasses: {
    type: Number,
    required: true,
    min: 0
  },
  attendedClasses: {
    type: Number,
    required: true,
    min: 0,
    validate: {
      validator: function(v) {
        // During updates, totalClasses might not be available yet in 'this'
        // Only validate if totalClasses is defined
        if (this.totalClasses !== undefined && this.totalClasses !== null) {
          return v <= this.totalClasses;
        }
        return true; // Skip validation if totalClasses not available
      },
      message: 'Attended classes cannot exceed total classes'
    }
  },
  percentage: {
    type: Number,
    min: 0,
    max: 100
  },
  marksAwarded: {
    type: Number,
    required: true,
    min: 0
  },
  totalMarks: {
    type: Number,
    required: true
  },
  assignments: [{
    marksObtained: {
      type: Number,
      default: 0,
      min: 0
    },
    totalMarks: {
      type: Number,
      default: 0,
      min: 0
    }
  }],
  enteredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lastModified: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Calculate percentage before saving
attendanceSchema.pre('save', function(next) {
  if (this.totalClasses > 0) {
    this.percentage = (this.attendedClasses / this.totalClasses) * 100;
  }
  next();
});

// Compound unique index
attendanceSchema.index(
  { student: 1, course: 1, section: 1, academicYear: 1 },
  { unique: true }
);

module.exports = mongoose.model('Attendance', attendanceSchema);
