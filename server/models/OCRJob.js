const mongoose = require('mongoose');

const ocrJobSchema = new mongoose.Schema({
  jobId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
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
    default: null
  },
  imageUrl: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending',
    index: true
  },
  marks: {
    type: Map,
    of: {
      type: Map,
      of: String
    },
    default: null
  },
  confidence: {
    type: Number,
    default: null
  },
  rawTable: {
    type: [[String]],
    default: null
  },
  error: {
    type: String,
    default: null
  },
  progress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  startedAt: {
    type: Date,
    default: null
  },
  completedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Index for efficient queries
ocrJobSchema.index({ user: 1, createdAt: -1 });
ocrJobSchema.index({ user: 1, student: 1, course: 1 });
ocrJobSchema.index({ status: 1, createdAt: 1 });

module.exports = mongoose.model('OCRJob', ocrJobSchema);
