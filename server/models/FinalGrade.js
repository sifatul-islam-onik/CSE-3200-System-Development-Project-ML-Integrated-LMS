const mongoose = require('mongoose');

const finalGradeSchema = new mongoose.Schema({
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
  // Detailed breakdown
  breakdown: {
    ctMarks: [{
      ctNumber: Number,
      marks: Number,
      totalMarks: Number
    }],
    bestCTsTotal: Number,     // After applying best N-1 policy
    ctWeightedMarks: Number,  // Scaled to course policy (e.g., 40/100)
    
    attendance: {
      classes: Number,
      attended: Number,
      percentage: Number,
      marks: Number
    },
    
    assignments: [{
      assignmentNumber: Number,
      marks: Number,
      totalMarks: Number
    }],
    assignmentTotal: Number,
    
    termExam: {
      marks: Number,
      totalMarks: Number,
      weightedMarks: Number
    }
  },
  // Final calculations
  totalMarks: {
    type: Number,
    required: true
  },
  percentage: {
    type: Number,
    required: true
  },
  letterGrade: {
    type: String,
    enum: ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'F'],
    required: true
  },
  gradePoint: {
    type: Number,
    required: true,
    min: 0,
    max: 4.0
  },
  // Grade status
  isFinalized: {
    type: Boolean,
    default: false
  },
  finalizedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  finalizedAt: Date,
  // Audit
  calculatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  lastCalculated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound unique index
finalGradeSchema.index(
  { student: 1, course: 1, section: 1, academicYear: 1 },
  { unique: true }
);

module.exports = mongoose.model('FinalGrade', finalGradeSchema);
