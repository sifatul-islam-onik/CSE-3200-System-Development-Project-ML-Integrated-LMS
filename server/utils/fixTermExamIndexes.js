const mongoose = require('mongoose');
const TermExamMarks = require('../models/TermExamMarks');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const fixIndexes = async () => {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('MongoDB URI not found in environment variables');
      process.exit(1);
    }
    await mongoose.connect(mongoUri);
    console.log('MongoDB connected successfully');

    // Get all indexes on TermExamMarks collection
    const indexes = await TermExamMarks.collection.getIndexes();
    console.log('\nCurrent indexes:');
    console.log(JSON.stringify(indexes, null, 2));

    // Drop the old index that doesn't include academicYear
    try {
      await TermExamMarks.collection.dropIndex('student_1_course_1_section_1');
      console.log('\n✓ Dropped old index: student_1_course_1_section_1');
    } catch (error) {
      console.log('\nOld index not found or already dropped');
    }

    // Sync indexes with the schema (this will create the correct index with academicYear)
    await TermExamMarks.syncIndexes();
    console.log('✓ Synced indexes with schema');

    // Get updated indexes
    const newIndexes = await TermExamMarks.collection.getIndexes();
    console.log('\nNew indexes:');
    console.log(JSON.stringify(newIndexes, null, 2));

    // Now update the academicYear for existing records
    console.log('\n--- Updating academicYear for existing records ---');
    const marksWithoutYear = await TermExamMarks.find({ academicYear: null });
    console.log(`Found ${marksWithoutYear.length} records without academicYear`);

    if (marksWithoutYear.length > 0) {
      const result = await TermExamMarks.updateMany(
        { academicYear: null },
        { $set: { academicYear: '2026' } }
      );
      console.log(`✓ Updated ${result.modifiedCount} records to academicYear: "2026"`);

      // Verify
      const updated = await TermExamMarks.find({ academicYear: '2026' }).select('student course section academicYear');
      console.log('\nUpdated records:');
      updated.forEach((r, i) => {
        console.log(`${i + 1}. Section: ${r.section}, Year: ${r.academicYear}`);
      });
    }

    console.log('\n✓ All done! Term exam marks are now properly indexed with academicYear.');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

fixIndexes();
