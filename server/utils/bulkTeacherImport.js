const User = require('../models/User');
const crypto = require('crypto');

const generatePassword = () => {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  
  let password = '';
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  
  const allChars = uppercase + lowercase + numbers;
  for (let i = 0; i < 5; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  return password.split('').sort(() => Math.random() - 0.5).join('');
};

const normalizeVal = (row, keys) => {
  const norm = (str) => String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const entries = Object.entries(row || {});
  
  for (const key of keys) {
    for (const [rk, rv] of entries) {
      if (rk === key) {
        return { found: true, value: String(rv || '').trim() };
      }
    }
  }
  
  const targetNorms = keys.map(norm);
  for (const [rk, rv] of entries) {
    const rkNorm = norm(rk);
    if (targetNorms.includes(rkNorm)) {
      return { found: true, value: String(rv || '').trim() };
    }
  }
  
  return { found: false, value: '' };
};

const validateTeacherData = (row, index) => {
  const errors = [];
  const rowRef = `Row ${index + 2}`;
  
  const fullNameResult = normalizeVal(row, ['Full Name', 'full name', 'FullName', 'fullName']);
  const nameResult = normalizeVal(row, ['Name', 'name']);
  const deptResult = normalizeVal(row, ['Dept', 'dept', 'Department', 'department']);
  
  if (!fullNameResult.value) {
    errors.push(`${rowRef}: Full Name is required`);
  }
  if (!nameResult.value) {
    errors.push(`${rowRef}: Name is required (will be used for email)`);
  }
  if (!deptResult.value) {
    errors.push(`${rowRef}: Dept is required`);
  }
  
  return errors;
};

const bulkImportTeachers = async (data) => {
  const bcrypt = require('bcryptjs');
  const results = {
    created: 0,
    skipped: [],
    errors: [],
    createdTeachers: []
  };

  if (!Array.isArray(data) || data.length === 0) {
    results.errors.push('No data provided');
    return results;
  }

  const processedRows = [];
  const emailsToQuery = [];

  for (let idx = 0; idx < data.length; idx++) {
    const row = data[idx];
    const rowRef = 'Row ' + (idx + 2);

    const fullNameResult = normalizeVal(row, ['Full Name', 'full name', 'FullName', 'fullName']);
    const nameForEmailResult = normalizeVal(row, ['Name', 'name']);
    const deptResult = normalizeVal(row, ['Dept', 'dept', 'Department', 'department']);
    const designationResult = normalizeVal(row, ['Designation', 'designation']);

    const validationErrors = validateTeacherData(row, idx);
    if (validationErrors.length > 0) {
      results.errors.push(...validationErrors);
      continue;
    }

    const fullName = fullNameResult.value;
    const nameForEmail = nameForEmailResult.value;
    const dept = deptResult.value;
    const designationRaw = designationResult.value; // May be empty if column exists but cell is empty

    const emailPrefix = nameForEmail.split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    const deptLower = dept.toLowerCase().replace(/[^a-z]/g, '');

    const email = emailPrefix + '@' + deptLower + '.kuet.ac.bd';

    let designation = 'Lecturer';
    if (designationRaw && designationRaw.trim()) {
      const norm = designationRaw.trim().toLowerCase();
      if (norm === 'professor') designation = 'Professor';
      else if (norm === 'assistant professor' || norm === 'assistantprofessor' || norm === 'asst professor' || norm === 'assistant_professor') designation = 'Assistant Professor';
      else if (norm === 'lecturer') designation = 'Lecturer';
    }

    processedRows.push({ idx, rowRef, fullName, email, dept, designation });
    emailsToQuery.push(email);
  }

  const existingUsers = await User.find({ email: { $in: emailsToQuery } }).select('email').lean();
  const existingEmailsSet = new Set(existingUsers.map(u => u.email));

  const teachersToInsert = [];
  const seenEmailsInMatch = new Set();

  for (const rowData of processedRows) {
    const { idx, rowRef, fullName, email, dept, designation } = rowData;

    if (existingEmailsSet.has(email)) {
      results.skipped.push({ row: idx + 2, reason: 'Email already exists', email });
      continue;
    }

    if (seenEmailsInMatch.has(email)) {
      results.skipped.push({ row: idx + 2, reason: 'Duplicate email in import list', email });
      continue;
    }

    seenEmailsInMatch.add(email);

    const password = generatePassword();
    console.log('Preparing teacher: ' + fullName + ' (' + email + ') with designation: ' + designation);

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    teachersToInsert.push({
      name: fullName,
      email,
      password: hashedPassword,
      initialPassword: password, // Store plaintext password for export       
      role: 'teacher',
      department: dept,
      designation,
      isEmailVerified: true, // Auto-verify for bulk imported teachers        
      isApprovedByAdmin: true, // Auto-approve for bulk imported teachers     
      isActive: true
    });
  }

  if (teachersToInsert.length > 0) {
    try {
      await User.insertMany(teachersToInsert);

      for (const t of teachersToInsert) {
        console.log('Successfully created teacher: ' + t.email + ', designation: ' + t.designation);
        results.created++;
        results.createdTeachers.push({
          name: t.name,
          email: t.email,
          password: t.initialPassword, // Return password so it can be displayed to admin
          department: t.department,
          designation: t.designation
        });
      }
    } catch (err) {
      console.error('Failed to bulk create teachers:', err.message);
      results.errors.push('Bulk import failed: ' + err.message);
    }
  }

  return results;
};

module.exports = { bulkImportTeachers, generatePassword, normalizeVal, validateTeacherData };
