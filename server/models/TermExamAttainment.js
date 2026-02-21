const mongoose = require('mongoose');

const termExamAttainmentSchema = new mongoose.Schema({
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true,
    unique: true,
    index: true
  },
  // Section A: CO allocation for questions 1-4, sub-parts a,b,c,d
  sectionARows: [{
    coNumber: String,
    Q1a: { type: Number, default: 0 },
    Q1b: { type: Number, default: 0 },
    Q1c: { type: Number, default: 0 },
    Q1d: { type: Number, default: 0 },
    Q2a: { type: Number, default: 0 },
    Q2b: { type: Number, default: 0 },
    Q2c: { type: Number, default: 0 },
    Q2d: { type: Number, default: 0 },
    Q3a: { type: Number, default: 0 },
    Q3b: { type: Number, default: 0 },
    Q3c: { type: Number, default: 0 },
    Q3d: { type: Number, default: 0 },
    Q4a: { type: Number, default: 0 },
    Q4b: { type: Number, default: 0 },
    Q4c: { type: Number, default: 0 },
    Q4d: { type: Number, default: 0 }
  }],
  // Section A: Student obtained marks (auto-populated from term marks, stored for reference)
  sectionAObtainedRows: [{
    rollNumber: String,
    name: String,
    Q1a: { type: Number, default: 0 },
    Q1b: { type: Number, default: 0 },
    Q1c: { type: Number, default: 0 },
    Q1d: { type: Number, default: 0 },
    Q2a: { type: Number, default: 0 },
    Q2b: { type: Number, default: 0 },
    Q2c: { type: Number, default: 0 },
    Q2d: { type: Number, default: 0 },
    Q3a: { type: Number, default: 0 },
    Q3b: { type: Number, default: 0 },
    Q3c: { type: Number, default: 0 },
    Q3d: { type: Number, default: 0 },
    Q4a: { type: Number, default: 0 },
    Q4b: { type: Number, default: 0 },
    Q4c: { type: Number, default: 0 },
    Q4d: { type: Number, default: 0 }
  }],
  // Section B: CO allocation for questions 1-4, sub-parts a,b,c,d
  sectionBRows: [{
    coNumber: String,
    Q1a: { type: Number, default: 0 },
    Q1b: { type: Number, default: 0 },
    Q1c: { type: Number, default: 0 },
    Q1d: { type: Number, default: 0 },
    Q2a: { type: Number, default: 0 },
    Q2b: { type: Number, default: 0 },
    Q2c: { type: Number, default: 0 },
    Q2d: { type: Number, default: 0 },
    Q3a: { type: Number, default: 0 },
    Q3b: { type: Number, default: 0 },
    Q3c: { type: Number, default: 0 },
    Q3d: { type: Number, default: 0 },
    Q4a: { type: Number, default: 0 },
    Q4b: { type: Number, default: 0 },
    Q4c: { type: Number, default: 0 },
    Q4d: { type: Number, default: 0 }
  }],
  // Section B: Student obtained marks (auto-populated from term marks, stored for reference)
  sectionBObtainedRows: [{
    rollNumber: String,
    name: String,
    Q1a: { type: Number, default: 0 },
    Q1b: { type: Number, default: 0 },
    Q1c: { type: Number, default: 0 },
    Q1d: { type: Number, default: 0 },
    Q2a: { type: Number, default: 0 },
    Q2b: { type: Number, default: 0 },
    Q2c: { type: Number, default: 0 },
    Q2d: { type: Number, default: 0 },
    Q3a: { type: Number, default: 0 },
    Q3b: { type: Number, default: 0 },
    Q3c: { type: Number, default: 0 },
    Q3d: { type: Number, default: 0 },
    Q4a: { type: Number, default: 0 },
    Q4b: { type: Number, default: 0 },
    Q4c: { type: Number, default: 0 },
    Q4d: { type: Number, default: 0 }
  }],
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Add compound index for common query patterns
termExamAttainmentSchema.index({ course: 1, updatedAt: -1 });

module.exports = mongoose.model('TermExamAttainment', termExamAttainmentSchema);
