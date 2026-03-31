const mongoose = require('mongoose');

const termExamAttainmentSchema = new mongoose.Schema({
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true,
    unique: true,
    index: true
  },
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

termExamAttainmentSchema.index({ course: 1, updatedAt: -1 });

module.exports = mongoose.model('TermExamAttainment', termExamAttainmentSchema);
