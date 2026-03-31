
const mongoose = require('mongoose');
const crypto   = require('crypto');
const bcrypt   = require('bcryptjs');
const path     = require('path');
const fs       = require('fs');
const XLSX     = require('xlsx');
const dotenv   = require('dotenv');

dotenv.config();

const User = require('../models/User');

const generateRandomPassword = () => {
  const upper   = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower   = 'abcdefghijklmnopqrstuvwxyz';
  const digits  = '0123456789';
  const all     = upper + lower + digits;

  let pwd = '';
  pwd += upper [crypto.randomInt(upper.length)];
  pwd += lower [crypto.randomInt(lower.length)];
  pwd += digits[crypto.randomInt(digits.length)];
  for (let i = 0; i < 5; i++) pwd += all[crypto.randomInt(all.length)];

  const arr = pwd.split('');
  for (let i = arr.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.join('');
};

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const students = await User.find({ role: 'student' })
    .select('+password name email roll department')
    .sort({ roll: 1 });

  console.log(`Found ${students.length} students. Resetting passwords…`);

  const exportRows = [];
  let done = 0;

  for (const student of students) {
    const newPassword = generateRandomPassword();

    student.password        = newPassword;
    student.initialPassword = newPassword;

    await student.save();

    exportRows.push({
      Roll:       student.roll  || '',
      Name:       student.name  || '',
      Email:      student.email || '',
      Department: student.department || '',
      Password:   newPassword
    });

    done++;
    if (done % 50 === 0) console.log(`  ${done} / ${students.length} done…`);
  }

  const outDir  = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const outPath = path.join(outDir, 'student_credentials_reset.xlsx');
  const ws      = XLSX.utils.json_to_sheet(exportRows);
  const wb      = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Student Credentials');
  XLSX.writeFile(wb, outPath);

  console.log(`\n✅ Done. ${done} students updated.`);
  console.log(`📄 Credentials saved to: ${outPath}`);

  await mongoose.disconnect();
  process.exit(0);
};

run().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
