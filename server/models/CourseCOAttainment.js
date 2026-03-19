const mongoose = require('mongoose');

const coStatSchema = new mongoose.Schema({
  coNumber: { type: String, required: true }, // e.g., 'CO1', 'CO2'
  targetThreshold: { type: Number, default: 40 }, // Default passing percentage threshold (e.g. 40%)
  studentsAttempted: { type: Number, default: 0 },
  studentsPassed: { type: Number, default: 0 },
  passPercentage: { type: Number, default: 0 },
  attainmentLevel: { type: Number, default: 0 } // e.g., 1, 2, or 3
}, { _id: false });

const courseCOAttainmentSchema = new mongoose.Schema({
  course: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Course', 
    required: true 
  },
  batch: { type: String, required: true },
  deptCode: { type: String, required: true },
  yearLevel: { type: Number, required: true },
  term: { type: Number, required: true },
  
  // Stats broken down per Course Outcome
  coData: [coStatSchema],
  
  isPublished: { type: Boolean, default: false },
  publishedAt: { type: Date },
  publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

// Compound index to ensure uniqueness for a batch+course calculation
courseCOAttainmentSchema.index({ course: 1, batch: 1, yearLevel: 1, term: 1 }, { unique: true });
courseCOAttainmentSchema.index({ isPublished: 1 });

module.exports = mongoose.model('CourseCOAttainment', courseCOAttainmentSchema);