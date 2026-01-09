/**
 * Utility script to delete all teacher accounts from the database
 * Usage: node server/utils/deleteTeachers.js
 */

const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

const deleteTeachers = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✓ Connected to MongoDB');

    // Find all teachers
    const teachers = await User.find({ role: 'teacher' });
    console.log(`\nFound ${teachers.length} teacher(s) in the database`);

    if (teachers.length === 0) {
      console.log('No teachers to delete.');
      await mongoose.connection.close();
      return;
    }

    // List teachers to be deleted
    console.log('\nTeachers to be deleted:');
    teachers.forEach((teacher, index) => {
      console.log(`  ${index + 1}. ${teacher.name} (${teacher.email})`);
    });

    // Delete all teachers
    const result = await User.deleteMany({ role: 'teacher' });
    
    console.log(`\n✓ Successfully deleted ${result.deletedCount} teacher account(s)`);
    
    await mongoose.connection.close();
    console.log('\n✓ Database connection closed');
    
  } catch (error) {
    console.error('❌ Error deleting teachers:', error.message);
    process.exit(1);
  }
};

// Run the script
deleteTeachers().then(() => {
  console.log('\nDone!');
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
