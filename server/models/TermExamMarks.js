const mongoose = require('mongoose');

const termExamMarksSchema = new mongoose.Schema({
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
    default: null,
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
  marks: {
    question1: {
      a: { type: String, default: '' },
      b: { type: String, default: '' },
      c: { type: String, default: '' },
      d: { type: String, default: '' }
    },
    question2: {
      a: { type: String, default: '' },
      b: { type: String, default: '' },
      c: { type: String, default: '' },
      d: { type: String, default: '' }
    },
    question3: {
      a: { type: String, default: '' },
      b: { type: String, default: '' },
      c: { type: String, default: '' },
      d: { type: String, default: '' }
    },
    question4: {
      a: { type: String, default: '' },
      b: { type: String, default: '' },
      c: { type: String, default: '' },
      d: { type: String, default: '' }
    }
  },
  totalMarks: {
    type: Number,
    default: 0
  },
  // For OBE: Map term exam questions to Course Outcomes
  questionCOMapping: [{
    questionNumber: {
      type: Number,
      required: true,
      min: 1
    },
    subQuestionLabel: {
      type: String, // e.g., 'a', 'b', 'c', 'd'
      trim: true
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
  imageUrl: {
    type: String,
    default: null
  },
  enteredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  academicYear: {
    type: String,
    default: null
  },
  lastModified: {
    type: Date,
    default: Date.now
  },
  // Computed field for marks obtained (for compatibility with grading system)
  marksObtained: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Pre-save hook to calculate marksObtained from totalMarks if questionCOMapping is empty
termExamMarksSchema.pre('save', function(next) {
  // If questionCOMapping exists and has data, calculate marksObtained from it
  if (this.questionCOMapping && this.questionCOMapping.length > 0) {
    this.marksObtained = this.questionCOMapping.reduce((sum, q) => sum + (q.marksObtained || 0), 0);
  }
  // Otherwise marksObtained is set directly (backward compatibility)
  next();
});

// Compound index to ensure one entry per student per course per section per academic year
termExamMarksSchema.index({ student: 1, course: 1, section: 1, academicYear: 1 }, { unique: true });

module.exports = mongoose.model('TermExamMarks', termExamMarksSchema);
