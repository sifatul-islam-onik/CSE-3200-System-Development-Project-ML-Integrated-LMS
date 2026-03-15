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
  credit: {
    type: Number,
    required: [true, 'Credit is required'],
    min: [0, 'Credit cannot be negative']
  },
  course_type: {
    type: String,
    required: [true, 'Course type is required'],
    uppercase: true,
    enum: {
      values: ['THEORY', 'SESSIONAL', 'PROJECT/THESIS'],
      message: 'Course type must be THEORY, SESSIONAL, or PROJECT/THESIS'
    },
    default: 'THEORY'
  },
  course_offered_to: {
    type: String,
    ref: 'Department',
    required: [true, 'Course offered to department is required']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    uppercase: true,
    enum: {
      values: ['COMPULSORY', 'OPTIONAL'],
      message: 'Category must be COMPULSORY or OPTIONAL'
    }
  },
  elective_group: {
    type: String,
    uppercase: true,
    enum: {
      values: ['OPTIONAL_I', 'OPTIONAL_II', 'OPTIONAL_III', null],
      message: 'Elective group must be OPTIONAL_I, OPTIONAL_II, OPTIONAL_III, or null'
    },
    default: null
  },
  term: {
    type: Number,
    min: 1,
    max: 2
  },
  status: {
    type: String,
    enum: {
      values: ['ACTIVE', 'INACTIVE'],
      message: 'Status must be ACTIVE or INACTIVE'
    },
    default: 'ACTIVE'
  },
  // Attendance marks for OBE
  attendanceMarks: {
    type: Number,
    default: 0
  },
  // OBE: Curriculum details
  academicYear: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        if (!v) return true; // Allow empty (optional field)
        // Accept either YYYY format (will be converted by pre-save hook) or YYYY-YY format
        return /^\d{4}$/.test(v) || /^\d{4}-\d{2}$/.test(v);
      },
      message: 'Academic year must be a 4-digit year (e.g., 2024) or YYYY-YY format (e.g., 2024-25)'
    }
  },
  semester: {
    type: Number,
    min: [1, 'Semester must be at least 1'],
    max: [8, 'Semester must be at most 8'],
    validate: {
      validator: Number.isInteger,
      message: 'Semester must be an integer value'
    }
  },
  yearLevel: {
    type: Number,
    validate: {
      validator: function(v) {
        if (v === undefined || v === null) return true; // Allow undefined/null
        if (!Number.isInteger(v)) return false;
        if (v < 1) return false;
        // ARCH department allows 1-5, others allow 1-4
        const maxYear = this.course_offered_to === 'ARCH' ? 5 : 4;
        return v <= maxYear;
      },
      message: function(props) {
        const dept = props.instance && props.instance.course_offered_to ? props.instance.course_offered_to : 'this department';
        const maxYear = dept === 'ARCH' ? 5 : 4;
        return `Year level must be between 1 and ${maxYear} for ${dept}`;
      }
    }
  },
  contactHours: {
    type: String,
    trim: true
  },
  // OBE: Prerequisites
  prerequisites: [{
    type: String,
    trim: true
  }],
  // OBE: Required prerequisite knowledge
  knowledge_required: {
    type: [{
      type: String,
      trim: true
    }],
    default: [],
    validate: {
      validator: function(v) {
        // If array is provided, ensure no empty items
        if (v && v.length > 0) {
          return v.every(knowledge => knowledge && knowledge.trim() !== '');
        }
        // Empty array is allowed
        return true;
      },
      message: 'All knowledge required entries must be non-empty'
    }
  },
  // OBE: Course objectives
  course_objectives: {
    type: [{
      type: String,
      trim: true
    }],
    validate: {
      validator: function(v) {
        if (!v || v.length === 0) return false;
        // Ensure no empty objectives
        return v.every(obj => obj && obj.trim() !== '');
      },
      message: 'Course objectives must contain at least one non-empty objective'
    }
  },
  // OBE: Course content concepts
  course_content: {
    type: [{
      concept_name: {
        type: String,
        trim: true
      },
      concept_description: {
        type: String,
        required: [true, 'Concept description is required'],
        trim: true
      }
    }],
    validate: {
      validator: function(v) {
        if (!v || v.length === 0) return false;
        // Ensure no empty concepts - only description is required
        return v.every(concept => 
          concept.concept_description && concept.concept_description.trim() !== ''
        );
      },
      message: 'Course content must contain at least one concept with valid description'
    }
  },
  // OBE: Lecture plan (week-by-week plan)
  lecture_plan: {
    type: [{
      week: {
        type: Number,
        min: [1, 'Week must be at least 1'],
        max: [13, 'Week must be at most 13'],
        validate: {
          validator: Number.isInteger,
          message: 'Week must be an integer value'
        }
      },
      plan: {
        type: String,
        required: [true, 'Plan description is required'],
        trim: true
      }
    }],
    required: [true, 'Lecture plan is required'],
    validate: [
      {
        validator: function(v) {
          return v && v.length > 0;
        },
        message: 'At least one lecture plan entry is required'
      },
      {
        validator: function(v) {
          return v && v.length <= 13;
        },
        message: 'Maximum 13 lecture plan entries allowed'
      },
      {
        validator: function(v) {
          if (!v || v.length === 0) return true;
          // Week is only required if there are multiple entries
          if (v.length > 1) {
            // Check all entries have week numbers
            return v.every(item => item.week !== undefined && item.week !== null);
          }
          return true; // Single entry doesn't require week
        },
        message: 'Week number is required for each entry when there are multiple lecture plan entries'
      },
      {
        validator: function(v) {
          if (!v || v.length === 0) return true;
          // Check for duplicate week values
          const weeks = v.map(item => item.week);
          const uniqueWeeks = new Set(weeks);
          return weeks.length === uniqueWeeks.size;
        },
        message: 'Duplicate week values are not allowed in lecture plan'
      },
      {
        validator: function(v) {
          if (!v || v.length === 0) return true;
          // Ensure no empty plan descriptions
          return v.every(item => item.plan && item.plan.trim() !== '');
        },
        message: 'All lecture plan entries must have a non-empty plan description'
      }
    ]
  },
  // OBE: References (books/learning resources)
  references: {
    type: [String],
    validate: {
      validator: function(v) {
        if (!v || v.length === 0) return true; // Allow empty
        // Ensure no empty references if array has items
        return v.every(ref => ref && ref.trim() !== '');
      },
      message: 'References must contain only non-empty items'
    }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Creator is required']
  },
  // Assigned teachers who can access this course
  assignedTeachers: [{
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    section: {
      type: String,
      enum: ['A', 'B', null],
      default: null
    }
  }],
  // Assigned batches (students) who can access this course
  assignedBatches: [{
    batch: {
      type: String,
      required: true,
      validate: {
        validator: function(v) {
          return /^\d{2}$/.test(v); // 2-digit batch year (e.g., "21" for 2021)
        },
        message: 'Batch must be 2 digits (e.g., "21" for 2021)'
      }
    },
    deptCode: {
      type: String,
      required: true,
      message: 'Department code must be valid'
    }
  }],
  // OBE: Accreditation tracking
  lastReviewed: {
    type: Date
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },  // OBE: Assignment and Attendance marks configuration
  attendanceMarks: {
    type: Number,
    default: 10,
    min: [0, 'Attendance marks cannot be negative'],
    max: [100, 'Attendance marks cannot exceed 100']
  },
  assignmentMarks: {
    type: Number,
    default: 15,
    min: [0, 'Assignment marks cannot be negative'],
    max: [100, 'Assignment marks cannot exceed 100']
  },  // OBE: KPA mapping (Knowledge, Performance, Attitude)
  kpa_mapping: {
    type: [{
      type: String,
      uppercase: true,
      enum: {
        values: ['K1', 'K2', 'K3', 'K4', 'K5', 'K6', 'K7', 'K8', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'A1', 'A2', 'A3', 'A4', 'A5'],
        message: 'KPA mapping must contain valid KPA codes: K1-K8, P1-P7, A1-A5'
      }
    }],
    required: [true, 'KPA mapping is required'],
    validate: {
      validator: function(v) {
        return v && v.length > 0;
      },
      message: 'At least one KPA mapping value must be selected'
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Custom validation: elective_group is required when category is OPTIONAL
courseSchema.pre('save', function(next) {
  if (this.category === 'OPTIONAL' && !this.elective_group) {
    return next(new Error('Elective group is required when category is OPTIONAL'));
  }
  if (this.category === 'COMPULSORY' && this.elective_group) {
    this.elective_group = null; // Clear elective_group for COMPULSORY courses
  }
  
  // Format academicYear: if it's a 4-digit year, convert to YYYY-YY format
  if (this.academicYear && /^\d{4}$/.test(this.academicYear)) {
    const year = parseInt(this.academicYear);
    const nextYear = (year + 1).toString().slice(-2);
    this.academicYear = `${year}-${nextYear}`;
  }
  
  // Sort lecture_plan by week number
  if (this.lecture_plan && this.lecture_plan.length > 0) {
    this.lecture_plan.sort((a, b) => a.week - b.week);
  }

  // Enforce: only one batch assignment per course
  if (Array.isArray(this.assignedBatches) && this.assignedBatches.length > 1) {
    this.assignedBatches = [this.assignedBatches[this.assignedBatches.length - 1]];
  }
  
  next();
});

// Middleware to update updatedAt on save
courseSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Middleware to cascade delete course outcomes when course is deleted
courseSchema.pre('deleteOne', { document: true, query: false }, async function(next) {
  try {
    const CourseOutcome = require('./CourseOutcome');
    await CourseOutcome.deleteMany({ course: this._id });
    next();
  } catch (error) {
    next(error);
  }
});

courseSchema.pre('findOneAndDelete', async function(next) {
  try {
    const CourseOutcome = require('./CourseOutcome');
    const doc = await this.model.findOne(this.getQuery());
    if (doc) {
      await CourseOutcome.deleteMany({ course: doc._id });
    }
    next();
  } catch (error) {
    next(error);
  }
});

// Index for faster queries
courseSchema.index({ courseCode: 1 }, { unique: true });
courseSchema.index({ course_offered_to: 1 });
courseSchema.index({ semester: 1 });
courseSchema.index({ yearLevel: 1 });
courseSchema.index({ course_type: 1 });
courseSchema.index({ category: 1 });
courseSchema.index({ elective_group: 1 });
courseSchema.index({ term: 1 });
courseSchema.index({ status: 1 });

const Course = mongoose.model('Course', courseSchema);

module.exports = Course;
