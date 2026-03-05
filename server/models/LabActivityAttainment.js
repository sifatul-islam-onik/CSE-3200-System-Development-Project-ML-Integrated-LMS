const mongoose = require('mongoose');

const labActivityAttainmentSchema = new mongoose.Schema({
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true,
    unique: true,
    index: true
  },
  labActivityRows: [{
    coNumber: String,
    attn: { type: Number, default: 0 },
    quiz: { type: Number, default: 0 },
    viva: { type: Number, default: 0 },
    Activity1_Q1: { type: Number, default: 0 },
    Activity1_Q2: { type: Number, default: 0 },
    Activity1_Q3: { type: Number, default: 0 },
    Activity2_Q1: { type: Number, default: 0 },
    Activity2_Q2: { type: Number, default: 0 },
    Activity2_Q3: { type: Number, default: 0 },
    Activity3_Q1: { type: Number, default: 0 },
    Activity3_Q2: { type: Number, default: 0 },
    Activity3_Q3: { type: Number, default: 0 },
    Activity4_Q1: { type: Number, default: 0 },
    Activity4_Q2: { type: Number, default: 0 },
    Activity4_Q3: { type: Number, default: 0 },
    Activity5_Q1: { type: Number, default: 0 },
    Activity5_Q2: { type: Number, default: 0 },
    Activity5_Q3: { type: Number, default: 0 }
  }],
  labActivityFactors: {
    type: Map,
    of: Number,
    default: {}
  },
  labActivityEqWts: {
    type: Map,
    of: Number,
    default: {}
  },
  labActivityManualWts: {
    type: Map,
    of: Number,
    default: {}
  },
  labAttendanceMarks: {
    type: Number,
    default: 0
  },
  labQuizMarks: {
    type: Number,
    default: 0
  },
  labVivaMarks: {
    type: Number,
    default: 0
  },
  activityTaken: {
    type: Number,
    default: 0
  },
  otherActivityRemaining: {
    type: Number,
    default: 0
  },
  otherActivityMeasured: {
    type: Number,
    default: 0
  },
  coMappedActivityMarks: {
    type: Number,
    default: 0
  },
  useEqWtActivity: {
    type: Number,
    default: 0
  },
  labActivityObtainedRows: [{
    rollNumber: String,
    name: String,
    attn: { type: mongoose.Schema.Types.Mixed, default: 0 },
    quiz: { type: mongoose.Schema.Types.Mixed, default: 0 },
    viva: { type: mongoose.Schema.Types.Mixed, default: 0 },
    Activity1_Q1: { type: mongoose.Schema.Types.Mixed, default: 0 },
    Activity1_Q2: { type: mongoose.Schema.Types.Mixed, default: 0 },
    Activity1_Q3: { type: mongoose.Schema.Types.Mixed, default: 0 },
    Activity2_Q1: { type: mongoose.Schema.Types.Mixed, default: 0 },
    Activity2_Q2: { type: mongoose.Schema.Types.Mixed, default: 0 },
    Activity2_Q3: { type: mongoose.Schema.Types.Mixed, default: 0 },
    Activity3_Q1: { type: mongoose.Schema.Types.Mixed, default: 0 },
    Activity3_Q2: { type: mongoose.Schema.Types.Mixed, default: 0 },
    Activity3_Q3: { type: mongoose.Schema.Types.Mixed, default: 0 },
    Activity4_Q1: { type: mongoose.Schema.Types.Mixed, default: 0 },
    Activity4_Q2: { type: mongoose.Schema.Types.Mixed, default: 0 },
    Activity4_Q3: { type: mongoose.Schema.Types.Mixed, default: 0 },
    Activity5_Q1: { type: mongoose.Schema.Types.Mixed, default: 0 },
    Activity5_Q2: { type: mongoose.Schema.Types.Mixed, default: 0 },
    Activity5_Q3: { type: mongoose.Schema.Types.Mixed, default: 0 },
    otherMeasured: { type: Number, default: 0 },
    other: { type: Number, default: 0 }
  }],
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Add compound index for common query patterns
labActivityAttainmentSchema.index({ course: 1, updatedAt: -1 });

module.exports = mongoose.model('LabActivityAttainment', labActivityAttainmentSchema);
