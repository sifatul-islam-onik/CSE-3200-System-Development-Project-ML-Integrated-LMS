const mongoose = require('mongoose');
const dotenv = require('dotenv');
const readline = require('readline');
const User = require('../models/User');

dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
};

const createAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    console.log('\n=== Create Admin User ===\n');

    const name = await question('Enter admin name: ');
    const email = await question('Enter admin email: ');
    const password = await question('Enter admin password: ');

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.error('\nError: User with this email already exists');
      process.exit(1);
    }

    const admin = await User.create({
      name,
      email,
      password,
      role: 'admin',
      isEmailVerified: true,
      isApprovedByAdmin: true,
      isActive: true
    });

    console.log('\n✓ Admin user created successfully!');
    console.log('Admin ID:', admin._id);
    console.log('Name:', admin.name);
    console.log('Email:', admin.email);
    console.log('Role:', admin.role);

    process.exit(0);
  } catch (error) {
    console.error('\nError creating admin:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
};

createAdmin();
