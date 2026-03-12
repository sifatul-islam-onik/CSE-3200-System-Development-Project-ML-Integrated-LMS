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

// VULN-14: Hidden input — suppresses terminal echo for sensitive password entry
const getHiddenInput = (prompt) => {
  return new Promise((resolve) => {
    process.stdout.write(prompt);
    // output:null prevents readline from echoing characters back to stdout
    const rlHidden = readline.createInterface({ input: process.stdin, output: null });
    rlHidden.question('', (answer) => {
      process.stdout.write('\n');
      rlHidden.close();
      resolve(answer);
    });
  });
};

const resetPassword = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB\n');

    const email = await question('Enter user email to reset password: ');
    const newPassword = await getHiddenInput('Enter new password: '); // VULN-14: hidden

    const user = await User.findOne({ email });
    
    if (!user) {
      console.error('\n❌ User not found');
      process.exit(1);
    }

    user.password = newPassword;
    await user.save();

    console.log('\n✅ Password reset successful!');
    console.log('   Name:', user.name);
    console.log('   Email:', user.email);
    console.log('   Role:', user.role);
    console.log('\nYou can now login with the new password.');

    process.exit(0);
  } catch (error) {
    console.error('\nError resetting password:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
};

resetPassword();
