const mongoose = require('mongoose');

const assignmentSchema = new mongoose.Schema({
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
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  assignmentNumber: {
    type: Number,
    required: true,
    min: 1
  },
  totalMarks: {
    type: Number,
    required: true,
    min: 0
  },
  dueDate: {
    type: Date
  },
  // For OBE: Map assignment to Course Outcomes
  courseOutcomes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CourseOutcome'
  }],
  // Student submissions
  submissions: [{
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    marksObtained: {
      type: Number,
      min: 0
    },
    // For OBE: Map submission questions/parts to Course Outcomes
    questionCOMapping: [{
      questionNumber: {
        type: Number,
        required: true,
        min: 1
      },
      courseOutcome: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CourseOutcome',
        required: true
      },
      marksObtained: {
        type: Number,
        required: true,
        min: 0
      },
      totalMarks: {
        type: Number,
        required: true,
        min: 0
      }
    }],
    submittedAt: Date,
    feedback: String,
    gradedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    gradedAt: Date
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Compound index for efficient querying
assignmentSchema.index({ course: 1, section: 1, academicYear: 1 });
assignmentSchema.index({ 'submissions.student': 1 });

module.exports = mongoose.model('Assignment', assignmentSchema);
