const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');

dotenv.config();

const checkAdmins = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const admins = await User.find({ role: 'admin' }).select('name email role isEmailVerified isApprovedByAdmin isActive');
    console.log('\nAdmin users count:', admins.length);
    
    if (admins.length > 0) {
      console.log('\nAdmin users:');
      admins.forEach(admin => {
        console.log(`- Name: ${admin.name}`);
        console.log(`  Email: ${admin.email}`);
        console.log(`  Email Verified: ${admin.isEmailVerified}`);
        console.log(`  Approved by Admin: ${admin.isApprovedByAdmin}`);
        console.log(`  Active: ${admin.isActive}\n`);
      });
    } else {
      console.log('\nNo admin users found!');
      console.log('Run: node utils/createAdmin.js');
    }

    const teachers = await User.find({ role: 'teacher' }).select('name email role isEmailVerified isApprovedByAdmin isActive');
    console.log('Teacher users count:', teachers.length);

    const students = await User.find({ role: 'student' }).select('name email role isEmailVerified isApprovedByAdmin isActive');
    console.log('Student users count:', students.length);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
};

checkAdmins();
