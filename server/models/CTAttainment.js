const mongoose = require('mongoose');

const ctAttainmentSchema = new mongoose.Schema({
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true,
    unique: true,
    index: true
  },
  ctRows: [{
    coNumber: String,
    CT1_Q1: { type: Number, default: 0 },
    CT1_Q2: { type: Number, default: 0 },
    CT1_Q3: { type: Number, default: 0 },
    CT2_Q1: { type: Number, default: 0 },
    CT2_Q2: { type: Number, default: 0 },
    CT2_Q3: { type: Number, default: 0 },
    CT3_Q1: { type: Number, default: 0 },
    CT3_Q2: { type: Number, default: 0 },
    CT3_Q3: { type: Number, default: 0 }
  }],
  ctFactors: {
    CT1: { type: Number, default: 1 },
    CT2: { type: Number, default: 1 },
    CT3: { type: Number, default: 1 }
  },
  ctManualWts: {
    type: Map,
    of: Number,
    default: {}
  },
  ctEqWts: {
    CT1: { type: Number, default: 0 },
    CT2: { type: Number, default: 0 },
    CT3: { type: Number, default: 0 }
  },
  ctSummary: {
    ctTaken: { type: Number, default: 3 },
    coMappedMarks60: { type: Number, default: 0 },
    useEqWt: { type: Number, default: 0 }
  },
  ctObtainedRows: [{
    rollNumber: String,
    name: String,
    CT1_Q1: { type: Number, default: 0 },
    CT1_Q2: { type: Number, default: 0 },
    CT1_Q3: { type: Number, default: 0 },
    CT2_Q1: { type: Number, default: 0 },
    CT2_Q2: { type: Number, default: 0 },
    CT2_Q3: { type: Number, default: 0 },
    CT3_Q1: { type: Number, default: 0 },
    CT3_Q2: { type: Number, default: 0 },
    CT3_Q3: { type: Number, default: 0 }
  }],
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Add compound index for common query patterns
ctAttainmentSchema.index({ course: 1, updatedAt: -1 });

module.exports = mongoose.model('CTAttainment', ctAttainmentSchema);
