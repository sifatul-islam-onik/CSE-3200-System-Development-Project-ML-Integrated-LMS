const mongoose = require('mongoose');

const programOutcomeSchema = new mongoose.Schema({
  po_code: {
    type: String,
    required: [true, 'PO code is required'],
    unique: true,
    uppercase: true,
    trim: true,
    enum: ['PO_A', 'PO_B', 'PO_C', 'PO_D', 'PO_E', 'PO_F', 'PO_G', 'PO_H', 'PO_I', 'PO_J', 'PO_K', 'PO_L']
  },
  po_number: {
    type: Number,
    required: true,
    min: 1,
    max: 12
  },
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true
  },
  // Flag to prevent accidental deletion
  is_system: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for faster queries
programOutcomeSchema.index({ po_code: 1 });
programOutcomeSchema.index({ po_number: 1 });

// Prevent deletion of system POs
programOutcomeSchema.pre('deleteOne', { document: true, query: false }, function(next) {
  if (this.is_system) {
    return next(new Error('Cannot delete system Program Outcomes'));
  }
  next();
});

programOutcomeSchema.pre('findOneAndDelete', function(next) {
  next(new Error('Deletion of Program Outcomes is not allowed'));
});

const ProgramOutcome = mongoose.model('ProgramOutcome', programOutcomeSchema);

module.exports = ProgramOutcome;
