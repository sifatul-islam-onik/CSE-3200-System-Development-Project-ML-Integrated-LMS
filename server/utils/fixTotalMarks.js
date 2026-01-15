const mongoose = require('mongoose');
const TermExamMarks = require('../models/TermExamMarks');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const fixTotalMarks = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    await mongoose.connect(mongoUri);
    console.log('MongoDB connected\n');

    // Find all term exam marks
    const records = await TermExamMarks.find({}).select('student course section academicYear totalMarks marksObtained');
    
    console.log(`Found ${records.length} term exam records\n`);

    let updatedCount = 0;
    
    for (const record of records) {
      console.log(`Record ${record._id}:`);
      console.log(`  Before: marksObtained=${record.marksObtained}, totalMarks=${record.totalMarks}`);
      
      // Set totalMarks to 105 (the maximum for a section)
      record.totalMarks = 105;
      await record.save();
      
      console.log(`  After:  marksObtained=${record.marksObtained}, totalMarks=${record.totalMarks}`);
      console.log('');
      updatedCount++;
    }

    console.log(`✓ Updated ${updatedCount} records to have totalMarks = 105`);
    console.log('✓ All marksObtained values preserved');

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

fixTotalMarks();
