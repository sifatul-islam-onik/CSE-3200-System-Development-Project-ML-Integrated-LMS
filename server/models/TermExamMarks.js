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
    default: null
  },
  marks: {
    type: Map,
    of: {
      type: Map,
      of: String
    },
    default: {
      a: { '1': '', '2': '', '3': '', '4': '', '5': '', '6': '', '7': '', '8': '' },
      b: { '1': '', '2': '', '3': '', '4': '', '5': '', '6': '', '7': '', '8': '' },
      c: { '1': '', '2': '', '3': '', '4': '', '5': '', '6': '', '7': '', '8': '' },
      d: { '1': '', '2': '', '3': '', '4': '', '5': '', '6': '', '7': '', '8': '' },
      e: { '1': '', '2': '', '3': '', '4': '', '5': '', '6': '', '7': '', '8': '' },
      f: { '1': '', '2': '', '3': '', '4': '', '5': '', '6': '', '7': '', '8': '' },
      g: { '1': '', '2': '', '3': '', '4': '', '5': '', '6': '', '7': '', '8': '' }
    }
  },
  totalMarks: {
    type: Number,
    default: 0
  },
  imageUrl: {
    type: String,
    default: null
  },
  enteredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  lastModified: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

termExamMarksSchema.index({ courseId: 1, studentId: 1, examType: 1 });
termExamMarksSchema.index({ courseId: 1, year: 1, semester: 1, section: 1 });

module.exports = mongoose.model('TermExamMarks', termExamMarksSchema);
