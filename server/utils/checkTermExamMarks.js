const mongoose = require('mongoose');
const TermExamMarks = require('../models/TermExamMarks');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const checkMarks = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    await mongoose.connect(mongoUri);
    console.log('MongoDB connected\n');

    const marks = await TermExamMarks.find({}).select('student course section academicYear totalMarks marksObtained marks');
    
    console.log(`Found ${marks.length} term exam records:\n`);
    
    marks.forEach((m, i) => {
      console.log(`${i + 1}. Record ${m._id}`);
      console.log(`   Student: ${m.student}`);
      console.log(`   Course: ${m.course}`);
      console.log(`   Section: ${m.section}`);
      console.log(`   Academic Year: ${m.academicYear}`);
      console.log(`   totalMarks: ${m.totalMarks}`);
      console.log(`   marksObtained: ${m.marksObtained}`);
      
      // Calculate total from marks object
      let calculatedTotal = 0;
      if (m.marks) {
        Object.values(m.marks).forEach(question => {
          Object.values(question).forEach(mark => {
            calculatedTotal += parseFloat(mark) || 0;
          });
        });
      }
      console.log(`   Calculated from marks object: ${calculatedTotal.toFixed(2)}`);
      console.log('');
    });

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

checkMarks();
