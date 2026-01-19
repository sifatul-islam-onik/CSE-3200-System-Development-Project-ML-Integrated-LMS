const mongoose = require('mongoose');

const ctMarksSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Student reference is required'],
    index: true
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: [true, 'Course reference is required'],
    index: true
  },
  section: {
    type: String,
    default: null,
    enum: {
      values: ['A', 'B', null],
      message: 'Section must be A, B, or null'
    },
    validate: {
      validator: async function(sectionValue) {
        // Skip validation if section is not null (it's set)
        if (sectionValue !== null) return true;
        
        // Only validate if this is a new document or section is being modified
        if (!this.isModified('section') && !this.isNew) return true;
        
        // If we have a course reference, check if it's a theory course
        if (this.course) {
          const Course = require('./Course');
          const course = await Course.findById(this.course);
          if (course && course.course_type === 'THEORY') {
            return false; // Section is required for theory courses
          }
        }
        return true;
      },
      message: 'Section (A or B) is required for theory courses'
    }
  },
  academicYear: {
    type: String,
    required: [true, 'Academic year is required'],
    trim: true,
    validate: {
      validator: function(v) {
        // Accept YYYY or YYYY-YY format
        return /^\d{4}$/.test(v) || /^\d{4}-\d{2}$/.test(v);
      },
      message: 'Academic year must be in YYYY or YYYY-YY format (e.g., 2025 or 2025-26)'
    }
  },
  ctNumber: {
    type: Number,
    required: [true, 'CT number is required'],
    min: [1, 'CT number must be at least 1'],
    validate: {
      validator: Number.isInteger,
      message: 'CT number must be an integer'
    }
  },
  marksObtained: {
    type: Number,
    required: [true, 'Marks obtained is required'],
    min: [0, 'Marks obtained cannot be negative'],
    validate: {
      validator: function(v) {
        // During update operations, totalMarks might not be in 'this' context yet
        // We rely on controller-level validation instead
        // Only validate if totalMarks is available in the current document context
        if (this.totalMarks !== undefined && this.totalMarks !== null) {
          return v <= this.totalMarks;
        }
        return true; // Skip validation if totalMarks not available (will be validated at controller level)
      },
      message: 'Marks obtained cannot exceed total marks'
    }
  },
  totalMarks: {
    type: Number,
    required: [true, 'Total marks is required'],
    min: [0, 'Total marks must be at least 0']
  },
  // For OBE: Map CT questions to Course Outcomes
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
  enteredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Entered by reference is required']
  },
  lastModified: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Update lastModified on save
ctMarksSchema.pre('save', function(next) {
  this.lastModified = Date.now();
  next();
});

// Compound unique index to ensure one entry per student per course per section per CT per academic year
ctMarksSchema.index(
  { 
    student: 1, 
    course: 1, 
    section: 1, 
    ctNumber: 1, 
    academicYear: 1 
  }, 
  { unique: true }
);

// Additional indexes for efficient querying
ctMarksSchema.index({ course: 1, section: 1, academicYear: 1 });
ctMarksSchema.index({ enteredBy: 1 });

// Virtual to get percentage
ctMarksSchema.virtual('percentage').get(function() {
  if (this.totalMarks === 0) return 0;
  return ((this.marksObtained / this.totalMarks) * 100).toFixed(2);
});

// Ensure virtuals are included in JSON output
ctMarksSchema.set('toJSON', { virtuals: true });
ctMarksSchema.set('toObject', { virtuals: true });

const CTMarks = mongoose.model('CTMarks', ctMarksSchema);

module.exports = CTMarks;
