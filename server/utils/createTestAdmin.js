const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

async function createTestAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/lms');
    console.log('Connected to MongoDB');

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: 'admin@lms.com' });
    if (existingAdmin) {
      console.log('Admin user already exists!');
      process.exit(0);
    }

    // Create admin user
    const admin = new User({
      name: 'Admin Test',
      email: 'admin@lms.com',
      password: 'adminpass123',
      role: 'admin',
      isEmailVerified: true,
      isApprovedByAdmin: true,
      isActive: true
    });

    await admin.save();
    console.log('\n✓ Admin user created successfully!');
    console.log('Email: admin@lms.com');
    console.log('Password: adminpass123');
    console.log('\nYou can now log in with these credentials.\n');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

createTestAdmin();
