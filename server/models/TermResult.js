const mongoose = require('mongoose');

const courseResultSchema = new mongoose.Schema({
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
  courseCode: { type: String },
  courseTitle: { type: String },
  credit: { type: Number },
  course_type: { type: String },
  totalMarks: { type: Number },
  letterGrade: { type: String },
  gradePoint: { type: Number },
}, { _id: false });

const termResultSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  studentRoll: { type: String, required: true },
  studentName: { type: String, required: true },
  batch: { type: String, required: true },
  deptCode: { type: String, required: true },
  yearLevel: { type: Number, required: true },
  term: { type: Number, required: true },
  semester: { type: Number },
  courses: [courseResultSchema],
  creditTaken: { type: Number, default: 0 },
  creditCompleted: { type: Number, default: 0 },
  totalCreditCompleted: { type: Number, default: 0 },
  termGPA: { type: Number, default: 0 },
  cgpa: { type: Number, default: 0 },
  isPublished: { type: Boolean, default: false },
  publishedAt: { type: Date },
  publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

// One result record per student per term (year+term)
termResultSchema.index({ student: 1, yearLevel: 1, term: 1 }, { unique: true });
termResultSchema.index({ batch: 1, deptCode: 1, yearLevel: 1, term: 1 });
termResultSchema.index({ isPublished: 1 });

module.exports = mongoose.model('TermResult', termResultSchema);
