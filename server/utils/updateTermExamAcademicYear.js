const mongoose = require('mongoose');
const TermExamMarks = require('../models/TermExamMarks');
require('dotenv').config();

const updateTermExamAcademicYear = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected successfully');

    // Find all term exam marks with null academicYear
    const marksWithoutYear = await TermExamMarks.find({ academicYear: null });
    
    console.log(`\nFound ${marksWithoutYear.length} term exam marks records without academicYear`);
    
    if (marksWithoutYear.length === 0) {
      console.log('No records to update.');
      process.exit(0);
    }

    // Update all records to set academicYear to '2026'
    const result = await TermExamMarks.updateMany(
      { academicYear: null },
      { $set: { academicYear: '2026' } }
    );

    console.log(`\n✓ Updated ${result.modifiedCount} records`);
    console.log('All term exam marks now have academicYear: "2026"');

    // Verify the update
    const updatedRecords = await TermExamMarks.find({ academicYear: '2026' }).select('student course section academicYear');
    console.log('\nUpdated records:');
    updatedRecords.forEach((record, index) => {
      console.log(`${index + 1}. Student: ${record.student}, Course: ${record.course}, Section: ${record.section}, Year: ${record.academicYear}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Error updating academic year:', error);
    process.exit(1);
  }
};

updateTermExamAcademicYear();
