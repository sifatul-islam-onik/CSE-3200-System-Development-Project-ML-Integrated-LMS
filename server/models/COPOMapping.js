const mongoose = require('mongoose');

const copoMappingSchema = new mongoose.Schema({
  course_outcome: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CourseOutcome',
    required: [true, 'Course outcome reference is required'],
    index: true
  },
  program_outcome_code: {
    type: String,
    required: [true, 'Program outcome code is required'],
    uppercase: true,
    trim: true,
    enum: {
      values: ['PO_A', 'PO_B', 'PO_C', 'PO_D', 'PO_E', 'PO_F', 'PO_G', 'PO_H', 'PO_I', 'PO_J', 'PO_K', 'PO_L'],
      message: 'Invalid program outcome code'
    }
  },
  level: {
    type: Number,
    required: [true, 'Mapping level is required'],
    min: [0, 'Mapping level must be at least 0 (Not Mapped)'],
    max: [1, 'Mapping level must be at most 1 (Mapped)'],
    enum: {
      values: [0, 1],
      message: 'Mapping level must be 0 (Not Mapped) or 1 (Mapped)'
    }
  }
}, {
  timestamps: true
});

// Compound unique index: one CO can map to one PO only once
copoMappingSchema.index({ course_outcome: 1, program_outcome_code: 1 }, { unique: true });

// Index for querying by PO
copoMappingSchema.index({ program_outcome_code: 1 });

// Virtual to get level description
copoMappingSchema.virtual('level_description').get(function() {
  const levels = {
    0: 'Not Mapped',
    1: 'Mapped'
  };
  return levels[this.level] || 'Unknown';
});

// Cascade delete: Remove mappings when CO is deleted
copoMappingSchema.pre('deleteMany', function(next) {
  console.log('Deleting CO-PO mappings for course outcome');
  next();
});

const COPOMapping = mongoose.model('COPOMapping', copoMappingSchema);

module.exports = COPOMapping;
