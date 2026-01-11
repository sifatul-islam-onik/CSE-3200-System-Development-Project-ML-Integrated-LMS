const User = require('../models/User');
const crypto = require('crypto');

// Generate random 8-character password with uppercase, lowercase, and numbers
const generatePassword = () => {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  
  let password = '';
  // Ensure at least one of each
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  
  // Fill remaining 5 characters
  const allChars = uppercase + lowercase + numbers;
  for (let i = 0; i < 5; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
};

// Normalize field value from different possible column names (case/spacing/punctuation tolerant)
// Returns: { found: boolean, value: string }
// found: true if column was found (even if empty)
// value: the trimmed value or empty string
const normalizeVal = (row, keys) => {
  const norm = (str) => String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const entries = Object.entries(row || {});
  
  // Try exact matches first
  for (const key of keys) {
    for (const [rk, rv] of entries) {
      if (rk === key) {
        // Exact match found; return value (may be empty)
        return { found: true, value: String(rv || '').trim() };
      }
    }
  }
  
  // If no exact match, try normalized matching
  const targetNorms = keys.map(norm);
  for (const [rk, rv] of entries) {
    const rkNorm = norm(rk);
    if (targetNorms.includes(rkNorm)) {
      // Normalized match found; return value (may be empty)
      return { found: true, value: String(rv || '').trim() };
    }
  }
  
  return { found: false, value: '' };
};

// Validate teacher data
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

// Bulk import teachers
const bulkImportTeachers = async (data) => {
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

  for (let idx = 0; idx < data.length; idx++) {
    const row = data[idx];
    const rowRef = `Row ${idx + 2}`;
    
    // Get values from different possible column names
    const fullNameResult = normalizeVal(row, ['Full Name', 'full name', 'FullName', 'fullName']);
    const nameForEmailResult = normalizeVal(row, ['Name', 'name']);
    const deptResult = normalizeVal(row, ['Dept', 'dept', 'Department', 'department']);
    const designationResult = normalizeVal(row, ['Designation', 'designation']);

    // Validate required fields
    const validationErrors = validateTeacherData(row, idx);
    if (validationErrors.length > 0) {
      results.errors.push(...validationErrors);
      continue;
    }

    const fullName = fullNameResult.value;
    const nameForEmail = nameForEmailResult.value;
    const dept = deptResult.value;
    const designationRaw = designationResult.value; // May be empty if column exists but cell is empty

    // Extract first word from nameForEmail for email creation
    const emailPrefix = nameForEmail.split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    const deptLower = dept.toLowerCase().replace(/[^a-z]/g, '');
    
    // Generate email: name@dept.kuet.ac.bd
    const email = `${emailPrefix}@${deptLower}.kuet.ac.bd`;

    // Check if email already exists
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      results.skipped.push({ row: idx + 2, reason: 'Email already exists', email });
      continue;
    }

    // Resolve designation (default to Lecturer if empty/invalid)
    let designation = 'Lecturer';
    if (designationRaw && designationRaw.trim()) {
      const norm = designationRaw.trim().toLowerCase();
      if (norm === 'professor') designation = 'Professor';
      else if (norm === 'assistant professor' || norm === 'assistantprofessor' || norm === 'asst professor' || norm === 'assistant_professor') designation = 'Assistant Professor';
      else if (norm === 'lecturer') designation = 'Lecturer';
      else {
        // Unknown designation; fall back to default
        designation = 'Lecturer';
      }
    }

    // Generate random password
    const password = generatePassword();
    
    console.log(`Creating teacher: ${fullName} (${email}) with designation: ${designation}`);

    try {
      // Create new teacher user
      const teacher = new User({
        name: fullName,
        email,
        password, // Will be hashed by the pre-save hook
        initialPassword: password, // Store plaintext password for export
        role: 'teacher',
        department: dept,
        designation,
        isEmailVerified: true, // Auto-verify for bulk imported teachers
        isApprovedByAdmin: true, // Auto-approve for bulk imported teachers
        isActive: true
      });

      await teacher.save();
      
      console.log(`Successfully created teacher: ${email}, designation: ${teacher.designation}, initialPassword set: ${!!teacher.initialPassword}`);
      
      results.created++;
      results.createdTeachers.push({
        name: fullName,
        email,
        password, // Return password so it can be displayed to admin
        department: dept,
        designation
      });
    } catch (err) {
      console.error(`Failed to create teacher ${email}:`, err.message);
      results.errors.push(`${rowRef}: Failed to create teacher - ${err.message}`);
    }
  }

  return results;
};

module.exports = { bulkImportTeachers, generatePassword, normalizeVal, validateTeacherData };
