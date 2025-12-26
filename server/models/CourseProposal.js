const mongoose = require('mongoose');

const courseProposalSchema = new mongoose.Schema({
  // Proposal metadata
  proposalType: {
    type: String,
    required: true,
    enum: ['CREATE', 'UPDATE'],
    uppercase: true
  },
  status: {
    type: String,
    required: true,
    enum: ['PENDING', 'APPROVED', 'REJECTED'],
    default: 'PENDING'
  },
  
  // Reference to existing course (for UPDATE proposals)
  existingCourse: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: function() {
      return this.proposalType === 'UPDATE';
    }
  },
  
  // Proposed course data (same structure as Course model)
  proposedData: {
    courseCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true
    },
    courseTitle: {
      type: String,
      required: true,
      trim: true
    },
    credit: {
      type: Number,
      required: true,
      min: 0
    },
    course_type: {
      type: String,
      required: true,
      uppercase: true,
      enum: ['THEORY', 'SESSIONAL', 'PROJECT/THESIS']
    },
    course_offered_to: {
      type: String,
      required: true,
      enum: ['CSE', 'EEE', 'ME', 'CE', 'ECE', 'IEM', 'ESE', 'BME', 'URP', 'LE', 'TE', 'BECM', 'ARCH', 'MSE', 'CHE', 'MTE']
    },
    category: {
      type: String,
      required: true,
      uppercase: true,
      enum: ['COMPULSORY', 'OPTIONAL']
    },
    elective_group: {
      type: String,
      uppercase: true,
      enum: ['OPTIONAL_I', 'OPTIONAL_II', 'OPTIONAL_III', null],
      default: null
    },
    term: Number,
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE'
    },
    academicYear: String,
    semester: Number,
    yearLevel: Number,
    contactHours: String,
    prerequisites: [String],
    knowledge_required: [String],
    course_objectives: [String],
    learningObjectives: [String],
    syllabusOutline: [{
      week: Number,
      topic: String,
      learningActivities: String
    }],
    course_content: [{
      concept_name: String,
      concept_description: String
    }],
    lecture_plan: [{
      week: Number,
      plan: String
    }],
    references: [String],
    assessmentPlan: {
      continuous: Number,
      midterm: Number,
      final: Number
    },
    textbooks: [{
      title: String,
      author: String,
      edition: String,
      type: String
    }],
    kpa_mapping: [String],
    accreditationStatus: String,
    // Course Outcomes data
    courseOutcomes: [{
      co_code: String,
      description: String,
      po_mappings: [{
        program_outcome_code: String,
        level: Number
      }],
      taxonomy_levels: [String]
    }]
  },
  
  // Proposal tracking
  proposedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  proposedAt: {
    type: Date,
    default: Date.now
  },
  
  // Review tracking
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedAt: Date,
  reviewComment: String,
  
  // Change description
  changeDescription: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Index for faster queries
courseProposalSchema.index({ status: 1 });
courseProposalSchema.index({ proposalType: 1 });
courseProposalSchema.index({ proposedBy: 1 });
courseProposalSchema.index({ existingCourse: 1 });
courseProposalSchema.index({ 'proposedData.courseCode': 1 });

const CourseProposal = mongoose.model('CourseProposal', courseProposalSchema);

module.exports = CourseProposal;
