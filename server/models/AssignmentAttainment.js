const mongoose = require('mongoose');

const assignmentAttainmentSchema = new mongoose.Schema({
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true,
    unique: true,
    index: true
  },
  assignmentRows: [{
    coNumber: String,
    Assgn1_Q1: { type: Number, default: 0 },
    Assgn1_Q2: { type: Number, default: 0 },
    Assgn1_Q3: { type: Number, default: 0 },
    Assgn2_Q1: { type: Number, default: 0 },
    Assgn2_Q2: { type: Number, default: 0 },
    Assgn2_Q3: { type: Number, default: 0 },
    Assgn3_Q1: { type: Number, default: 0 },
    Assgn3_Q2: { type: Number, default: 0 },
    Assgn3_Q3: { type: Number, default: 0 }
  }],
  assignmentManualWts: {
    type: Map,
    of: Number,
    default: {}
  },
  assignmentSummary: {
    assignTaken: { type: Number, default: 3 },
    assignmentMarks30: { type: Number, default: 0 },
    useEqWt: { type: Number, default: 0 },
    attendancePerformance: { type: Number, default: 0 }
  },
  attendanceMarks: {
    type: Number,
    default: 0
  },
  attnAssignObtainedRows: [{
    rollNumber: String,
    name: String,
    attendance: { type: mongoose.Schema.Types.Mixed, default: 0 },
    Assgn1_Q1: { type: mongoose.Schema.Types.Mixed, default: 0 },
    Assgn1_Q2: { type: mongoose.Schema.Types.Mixed, default: 0 },
    Assgn1_Q3: { type: mongoose.Schema.Types.Mixed, default: 0 },
    Assgn2_Q1: { type: mongoose.Schema.Types.Mixed, default: 0 },
    Assgn2_Q2: { type: mongoose.Schema.Types.Mixed, default: 0 },
    Assgn2_Q3: { type: mongoose.Schema.Types.Mixed, default: 0 },
    Assgn3_Q1: { type: mongoose.Schema.Types.Mixed, default: 0 },
    Assgn3_Q2: { type: mongoose.Schema.Types.Mixed, default: 0 },
    Assgn3_Q3: { type: mongoose.Schema.Types.Mixed, default: 0 }
  }],
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

assignmentAttainmentSchema.index({ course: 1, updatedAt: -1 });

module.exports = mongoose.model('AssignmentAttainment', assignmentAttainmentSchema);
