const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');

dotenv.config();

const checkUsers = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const count = await User.countDocuments();
    console.log('\nTotal users in database:', count);

    if (count > 0) {
      const users = await User.find({}).select('email role isEmailVerified isApprovedByAdmin isActive');
      console.log('\nUsers:');
      users.forEach(user => {
        console.log(`- Email: ${user.email}`);
        console.log(`  Role: ${user.role}`);
        console.log(`  Email Verified: ${user.isEmailVerified}`);
        console.log(`  Approved by Admin: ${user.isApprovedByAdmin}`);
        console.log(`  Active: ${user.isActive}\n`);
      });
    } else {
      console.log('\nNo users found in database!');
      console.log('You need to create an admin user first.');
      console.log('Run: node utils/createAdmin.js');
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
};

checkUsers();
