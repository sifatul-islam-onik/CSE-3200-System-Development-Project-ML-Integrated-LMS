const mongoose = require('mongoose');

const courseOutcomeSchema = new mongoose.Schema({
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: [true, 'Course reference is required'],
    index: true
  },
  co_code: {
    type: String,
    required: [true, 'CO code is required'],
    trim: true,
    uppercase: true
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true
  },
  taxonomy_levels: {
    type: [String],
    default: [],
    validate: {
      validator: function(v) {
        const validTaxonomies = [
          'C1', 'C2', 'C3', 'C4', 'C5', 'C6',
          'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7',
          'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7',
          'S1', 'S2', 'S3', 'S4', 'S5'
        ];
        return v.every(level => validTaxonomies.includes(level));
      },
      message: 'Invalid taxonomy level. Must be C1-6, P1-7, A1-7, or S1-5'
    }
  },
  is_deleted: {
    type: Boolean,
    default: false
  },
  deleted_at: {
    type: Date,
    default: null
  },
  deleted_reason: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Compound index – unique only among active (non-deleted) documents.
// Soft-deleted COs keep their co_code so they don't block future re-use.
courseOutcomeSchema.index(
  { course: 1, co_code: 1 },
  { unique: true, partialFilterExpression: { is_deleted: { $ne: true } } }
);

// Cascade delete CO-PO mappings when CO is deleted
courseOutcomeSchema.pre('deleteOne', { document: true, query: false }, async function(next) {
  try {
    const COPOMapping = require('./COPOMapping');
    await COPOMapping.deleteMany({ course_outcome: this._id });
    next();
  } catch (error) {
    next(error);
  }
});

courseOutcomeSchema.pre('findOneAndDelete', async function(next) {
  try {
    const COPOMapping = require('./COPOMapping');
    const doc = await this.model.findOne(this.getQuery());
    if (doc) {
      await COPOMapping.deleteMany({ course_outcome: doc._id });
    }
    next();
  } catch (error) {
    next(error);
  }
});

const CourseOutcome = mongoose.model('CourseOutcome', courseOutcomeSchema);

module.exports = CourseOutcome;
