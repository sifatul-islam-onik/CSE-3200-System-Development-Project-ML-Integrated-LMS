const mongoose = require('mongoose');
const TermExamMarks = require('../models/TermExamMarks');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const fixMarksObtained = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('MongoDB URI not found in environment variables');
      process.exit(1);
    }
    await mongoose.connect(mongoUri);
    console.log('MongoDB connected successfully');

    // Find all term exam marks where marksObtained is 0 but totalMarks is not 0
    const records = await TermExamMarks.find({ 
      marksObtained: 0,
      totalMarks: { $ne: 0 }
    });

    console.log(`\nFound ${records.length} records with marksObtained=0 but totalMarks>0`);

    if (records.length === 0) {
      console.log('No records to fix.');
      process.exit(0);
    }

    // Update each record to set marksObtained = totalMarks
    for (const record of records) {
      console.log(`\nFixing record ${record._id}:`);
      console.log(`  Student: ${record.student}`);
      console.log(`  Course: ${record.course}`);
      console.log(`  Before: marksObtained=${record.marksObtained}, totalMarks=${record.totalMarks}`);
      
      record.marksObtained = record.totalMarks;
      await record.save();
      
      console.log(`  After: marksObtained=${record.marksObtained}, totalMarks=${record.totalMarks}`);
    }

    console.log(`\n✓ Fixed ${records.length} records`);
    
    // Verify
    const remaining = await TermExamMarks.find({ 
      marksObtained: 0,
      totalMarks: { $ne: 0 }
    });
    
    if (remaining.length === 0) {
      console.log('✓ All records fixed successfully!');
    } else {
      console.log(`⚠ Warning: ${remaining.length} records still need fixing`);
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

fixMarksObtained();
