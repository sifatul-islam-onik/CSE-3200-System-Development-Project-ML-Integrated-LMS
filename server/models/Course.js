const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
  courseCode: {
    type: String,
    required: [true, 'Course code is required'],
    uppercase: true,
    trim: true
  },
  courseTitle: {
    type: String,
    required: [true, 'Course title is required'],
    trim: true
  },
  courseType: {
    type: String,
    enum: {
      values: ['Core', 'Optional', 'Lab'],
      message: 'Course type must be Core, Optional, or Lab'
    },
    required: [true, 'Course type is required']
  },
  credit: {
    type: Number,
    required: [true, 'Credit is required'],
    min: [0, 'Credit cannot be negative']
  },
  department: {
    type: String,
    required: [true, 'Department is required'],
    trim: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Creator is required']
  },
  isPublished: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index for faster queries
courseSchema.index({ courseCode: 1 }, { unique: true });
courseSchema.index({ department: 1 });
courseSchema.index({ isPublished: 1 });

const Course = mongoose.model('Course', courseSchema);

module.exports = Course;
