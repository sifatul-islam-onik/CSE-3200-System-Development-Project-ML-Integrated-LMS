const mongoose = require('mongoose');

const termExamMarksSchema = new mongoose.Schema({
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  rollNumber: {
    type: String,
    required: true
  },
  year: {
    type: Number,
    required: true
  },
  semester: {
    type: String,
    required: true,
    enum: ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th']
  },
  section: {
    type: String,
    required: true
  },
  examType: {
    type: String,
    required: true,
    enum: ['midterm', 'final']
  },
  // CO-wise marks
  coMarks: [{
    co: {
      type: String,
      required: true
    },
    obtainedMarks: {
      type: Number,
      required: true
    },
    totalMarks: {
      type: Number,
      required: true
    }
  }],
  // Total marks
  totalObtained: {
    type: Number,
    required: true
  },
  totalMarks: {
    type: Number,
    required: true
  },
  percentage: {
    type: Number
  },
  remarks: {
    type: String
  }
}, {
  timestamps: true
});

// Index for faster queries
termExamMarksSchema.index({ courseId: 1, studentId: 1, examType: 1 });
termExamMarksSchema.index({ courseId: 1, year: 1, semester: 1, section: 1 });

module.exports = mongoose.model('TermExamMarks', termExamMarksSchema);
