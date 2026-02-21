const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');
const bcrypt = require('bcryptjs');

dotenv.config();

const testLogin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB\n');

    const email = 'admin@lms.com';
    const testPassword = 'admin123'; // Common default password

    console.log(`Testing login for: ${email}`);
    console.log(`Test password: ${testPassword}\n`);

    // Find user with password field
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      console.log('❌ User not found');
      process.exit(1);
    }

    console.log('✅ User found');
    console.log('   Name:', user.name);
    console.log('   Email:', user.email);
    console.log('   Role:', user.role);
    console.log('   Email Verified:', user.isEmailVerified);
    console.log('   Approved by Admin:', user.isApprovedByAdmin);
    console.log('   Active:', user.isActive);
    console.log('   Has password:', !!user.password);
    console.log('   Password length:', user.password ? user.password.length : 0);
    console.log('   Password starts with $2a$ (bcrypt):', user.password ? user.password.startsWith('$2a$') : false);

    // Try to compare password
    const isMatch = await user.comparePassword(testPassword);
    console.log('\n   Password match result:', isMatch);

    if (!isMatch) {
      console.log('\n❌ Password does not match');
      console.log('\nTrying other common passwords:');
      const commonPasswords = ['admin', 'password', 'Admin123', 'admin@123', '123456'];
      for (const pwd of commonPasswords) {
        const match = await user.comparePassword(pwd);
        if (match) {
          console.log(`   ✅ Password matched: ${pwd}`);
          break;
        } else {
          console.log(`   ❌ Not: ${pwd}`);
        }
      }
    } else {
      console.log('✅ Password matches!');
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
};

testLogin();
