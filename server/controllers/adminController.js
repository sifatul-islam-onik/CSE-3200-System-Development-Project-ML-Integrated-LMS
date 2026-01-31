const User = require('../models/User');
const { sendApprovalEmail } = require('../utils/emailService');
const XLSX = require('xlsx');
const crypto = require('crypto');
const { bulkImportTeachers } = require('../utils/bulkTeacherImport');

// Helper function to generate random password
const generateRandomPassword = () => {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const allChars = uppercase + lowercase + numbers;

  let password = '';
  // Ensure at least one character from each category
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];

  // Fill the rest randomly (5 more chars to make 8 total)
  for (let i = 0; i < 5; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
};

// @desc    Get all pending users (email verified but not approved)
// @route   GET /api/admin/pending-users
// @access  Admin only
exports.getPendingUsers = async (req, res) => {
  try {
    // Additional security check - verify admin role from req.user
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const pendingUsers = await User.find({
      role: { $ne: 'admin' },
      isEmailVerified: true,
      isApprovedByAdmin: false
    }).select('-password');

    res.status(200).json({
      success: true,
      count: pendingUsers.length,
      data: pendingUsers
    });

  } catch (error) {
    console.error('Get pending users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching pending users'
    });
  }
};

// @desc    Approve a user
// @route   PUT /api/admin/approve-user/:userId
// @access  Admin only
exports.approveUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.role === 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Cannot modify admin users'
      });
    }

    if (user.isApprovedByAdmin) {
      return res.status(400).json({
        success: false,
        message: 'User is already approved'
      });
    }

    if (!user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: 'User email must be verified before approval'
      });
    }

    user.isApprovedByAdmin = true;
    await user.save();

    // Send approval email
    try {
      await sendApprovalEmail(user.email, user.name);
    } catch (emailError) {
      console.error('Failed to send approval email:', emailError);
    }

    res.status(200).json({
      success: true,
      message: 'User approved successfully',
      data: {
        userId: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isApprovedByAdmin: user.isApprovedByAdmin
      }
    });

  } catch (error) {
    console.error('Approve user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error approving user'
    });
  }
};

// @desc    Reject/delete a user
// @route   PUT /api/admin/reject-user/:userId
// @access  Admin only
exports.rejectUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.role === 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Cannot reject admin users'
      });
    }

    await User.findByIdAndDelete(userId);

    res.status(200).json({
      success: true,
      message: 'User rejected and removed from system'
    });

  } catch (error) {
    console.error('Reject user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error rejecting user'
    });
  }
};

// @desc    Get all users
// @route   GET /api/admin/users
// @access  Admin only
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password');

    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });

  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching users'
    });
  }
};

// @desc    Bulk import students from Excel
// @route   POST /api/admin/users/import
// @access  Admin only
exports.importStudentsFromExcel = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      return res.status(400).json({ success: false, message: 'No sheet found in workbook' });
    }

    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    if (!rows.length) {
      return res.status(400).json({ success: false, message: 'Sheet is empty' });
    }

    const results = {
      created: 0,
      skipped: [],
      errors: []
    };

    const normalizeVal = (row, keys) => {
      // Normalize a string for comparison
      const normalize = (str) => String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      
      // Try exact matches first
      for (const key of keys) {
        if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
          return String(row[key]).trim();
        }
      }
      
      // If no exact match, try normalized matching against all row keys
      const targetNorms = keys.map(normalize);
      for (const [rowKey, rowValue] of Object.entries(row)) {
        const rowKeyNorm = normalize(rowKey);
        if (targetNorms.includes(rowKeyNorm) && rowValue !== undefined && rowValue !== null && String(rowValue).trim() !== '') {
          return String(rowValue).trim();
        }
      }
      
      return '';
    };

    for (let idx = 0; idx < rows.length; idx++) {
      const row = rows[idx];
      const roll = normalizeVal(row, ['Roll', 'roll']);
      const name = normalizeVal(row, ['name', 'Name']);
      const advisor = normalizeVal(row, ['advisor', 'Advisor']);
      const father = normalizeVal(row, ['father', 'Father']);
      const mother = normalizeVal(row, ['mother', 'Mother']);
      const hall = normalizeVal(row, ['hall', 'Hall']);
      const scholarship = normalizeVal(row, ['scholarship', 'Scholarship']);
      const department = normalizeVal(row, ['department', 'Department', 'dept', 'Dept']);

      if (!roll || !name) {
        results.errors.push({ row: idx + 2, reason: 'Missing roll or name' });
        continue;
      }

      // Generate email: lastname + roll + @kuet.ac.bd
      const nameParts = name.trim().split(/\s+/);
      const lastNameRaw = nameParts[nameParts.length - 1] || 'student';
      const lastName = lastNameRaw.toLowerCase().replace(/[^a-z0-9]/g, '');
      const email = `${lastName}${roll}@stud.kuet.ac.bd`.toLowerCase();

      // Skip if email or roll already exists
      const existing = await User.findOne({ $or: [{ email }, { roll }] });
      if (existing) {
        results.skipped.push({ row: idx + 2, roll, email, reason: 'Email or roll already exists' });
        continue;
      }

      // Extract department from roll if not provided
      // KUET roll format typically: YYMMNNN where MM is department code
      let finalDepartment = department;
      if (!finalDepartment && roll) {
        const rollDigits = roll.replace(/\D/g, '');
        if (rollDigits.length >= 4) {
          const deptCode = rollDigits.substring(2, 4);
          // Map KUET department codes to names
          const departmentMap = {
            '01': 'CE',
            '03': 'EEE',
            '05': 'ME',
            '07': 'CSE',
            '09': 'ECE',
            '11': 'IEM',
            '13': 'ESE',
            '15': 'BME',
            '17': 'URP',
            '19': 'LE',
            '21': 'TE',
            '23': 'BECM',
            '25': 'ARCH',
            '27': 'MSE',
            '29': 'CHE',
            '31': 'MTE'
          };
          finalDepartment = departmentMap[deptCode] || '';
        }
      }

      // Generate random password
      const randomPassword = generateRandomPassword();

      const user = new User({
        name,
        email,
        password: randomPassword,
        initialPassword: randomPassword,
        role: 'student',
        roll,
        advisor,
        father,
        mother,
        hall,
        scholarship,
        department: finalDepartment,
        isEmailVerified: true,
        isApprovedByAdmin: true,
        isActive: true
      });

      try {
        await user.save();
        results.created += 1;
      } catch (saveErr) {
        results.errors.push({ row: idx + 2, roll, email, reason: saveErr.message });
      }
    }

    return res.status(200).json({ success: true, ...results });
  } catch (error) {
    console.error('Import students error:', error);
    return res.status(500).json({ success: false, message: 'Server error importing students' });
  }
};

// @desc    Get distinct student batches (derived from roll: 20 + first two digits)
// @route   GET /api/admin/students/batches
// @access  Admin only
exports.getStudentBatches = async (req, res) => {
  try {
    const students = await User.find({ role: 'student' }).select('roll').lean();
    const batchSet = new Set();

    for (const s of students) {
      const roll = String(s.roll || '').trim();
      if (!roll) continue;
      const digits = roll.replace(/\D/g, '');
      if (digits.length < 2) continue;
      const firstTwo = digits.slice(0, 2);
      const yearStr = `20${firstTwo}`;
      const year = parseInt(yearStr, 10);
      if (!Number.isNaN(year)) {
        batchSet.add(year);
      }
    }

    const batches = Array.from(batchSet).sort((a, b) => b - a);
    return res.status(200).json({ success: true, data: batches });
  } catch (error) {
    console.error('Get student batches error:', error);
    return res.status(500).json({ success: false, message: 'Server error fetching student batches' });
  }
};

// @desc    Toggle user active status
// @route   PUT /api/admin/users/:userId/toggle-status
// @access  Admin only
exports.toggleUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.role === 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Cannot modify admin users'
      });
    }

    user.isActive = !user.isActive;
    await user.save();

    res.status(200).json({
      success: true,
      message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully`,
      data: {
        userId: user._id,
        name: user.name,
        email: user.email,
        isActive: user.isActive
      }
    });

  } catch (error) {
    console.error('Toggle user status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error toggling user status'
    });
  }
};

// @desc    Update user active status explicitly
// @route   PUT /api/admin/users/:userId/status
// @access  Admin only
exports.setUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isActive must be provided as boolean'
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.role === 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Cannot modify admin users'
      });
    }

    user.isActive = isActive;
    await user.save();

    res.status(200).json({
      success: true,
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: {
        userId: user._id,
        name: user.name,
        email: user.email,
        isActive: user.isActive
      }
    });

  } catch (error) {
    console.error('Set user status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating user status'
    });
  }
};

// @desc    Delete a user account
// @route   DELETE /api/admin/users/:userId
// @access  Admin only
exports.deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.role === 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete admin users'
      });
    }

    await User.findByIdAndDelete(userId);

    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting user'
    });
  }
};

// @desc    Export student credentials by batch and department
// @route   POST /api/admin/users/export-credentials
// @access  Admin only
exports.exportStudentCredentials = async (req, res) => {
  try {
    const { batchYear, deptCode } = req.body;

    const allowedDeptCodes = ['07','03','05','01','09','11','13','15','17','19','27','31','23','25','21','29'];

    // Validate inputs
    if (!batchYear || !deptCode) {
      return res.status(400).json({ 
        success: false, 
        message: 'Batch year and department code are required' 
      });
    }

    // Validate batch year (4 digits)
    if (!/^\d{4}$/.test(batchYear)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Batch year must be 4 digits' 
      });
    }

    if (!allowedDeptCodes.includes(deptCode)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid department code'
      });
    }

    // Get last 2 digits of batch year
    const batchPrefix = batchYear.slice(-2);
    const rollPrefix = `${batchPrefix}${deptCode}`;

    // Find students with matching roll prefix
    const students = await User.find({
      role: 'student',
      roll: { $regex: `^${rollPrefix}`, $options: 'i' }
    }).select('name email roll +initialPassword').sort({ roll: 1 });

    if (students.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: `No students found for batch ${batchYear} and department ${deptCode}` 
      });
    }

    // Prepare export data using current passwords (initialPassword is updated when users change passwords)
    const exportData = students.map((student) => ({
      Roll: student.roll,
      Name: student.name,
      Email: student.email,
      Password: student.initialPassword || 'N/A'
    }));

    // Create Excel workbook
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Credentials');

    // Generate Excel buffer
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // Set response headers for file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=students_${batchYear}_${deptCode}.xlsx`);
    
    res.send(excelBuffer);

  } catch (error) {
    console.error('Export credentials error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error exporting credentials'
    });
  }
};

// @desc    Bulk import teachers from Excel
// @route   POST /api/admin/teachers/import
// @access  Admin only
exports.importTeachersFromExcel = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    if (!sheet) {
      return res.status(400).json({ success: false, message: 'No sheet found in workbook' });
    }

    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    if (!rows.length) {
      return res.status(400).json({ success: false, message: 'Sheet is empty' });
    }

    // Import teachers
    const results = await bulkImportTeachers(rows);

    // Return results with created teachers' credentials
    res.status(200).json({
      success: results.errors.length === 0,
      message: `Teachers import completed: ${results.created} created, ${results.skipped.length} skipped`,
      data: {
        created: results.created,
        skipped: results.skipped,
        errors: results.errors,
        createdTeachers: results.createdTeachers // Include credentials for admin to save/print
      }
    });
  } catch (error) {
    console.error('Import teachers error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error importing teachers'
    });
  }
};

exports.exportTeacherCredentials = async (req, res) => {
  try {
    const { department } = req.body;

    if (!department) {
      return res.status(400).json({ success: false, message: 'Department is required' });
    }

    console.log('Exporting credentials for department:', department);

    // Get all teachers in the department, matching either the department field
    // or the email subdomain (format: name@DEPT.kuet.ac.bd)
    const deptRegex = new RegExp(`@${department}\\.kuet\\.ac\\.bd$`, 'i');
    const teachers = await User.find({
      role: 'teacher',
      $or: [
        // Match department field case-insensitively
        { department: { $regex: new RegExp(`^${department}$`, 'i') } },
        // Or infer from email domain sub-part
        { email: { $regex: deptRegex } }
      ]
    })
    .select('name email department +initialPassword')
    .lean();

    console.log(`Found ${teachers.length} teachers for department: ${department}`);
    
    // Log first teacher to debug initialPassword field
    if (teachers.length > 0) {
      console.log('Sample teacher data:', {
        name: teachers[0].name,
        email: teachers[0].email,
        department: teachers[0].department,
        hasInitialPassword: !!teachers[0].initialPassword,
        initialPasswordValue: teachers[0].initialPassword ? '[SET]' : '[NOT SET]'
      });
    }

    // If no teachers found, return an error as JSON
    if (teachers.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No teachers found for department: ${department}`
      });
    }

    // Create workbook
    const workbook = XLSX.utils.book_new();
    
    // Count how many teachers have initialPassword set
    const withPassword = teachers.filter(t => t.initialPassword).length;
    const withoutPassword = teachers.length - withPassword;
    
    if (withoutPassword > 0) {
      console.log(`Warning: ${withoutPassword} of ${teachers.length} teachers don't have current passwords recorded`);
    }
    
    // Prepare data with current passwords (initialPassword is updated when users change passwords)
    const exportData = teachers.map(t => ({
      'Full Name': t.name || '',
      'Email': t.email || '',
      'Password': t.initialPassword || '[Not Available - Created before password tracking]',
      'Department': t.department || department
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    
    // Add a note at the top if some passwords are missing
    if (withoutPassword > 0) {
      XLSX.utils.sheet_add_aoa(worksheet, [[
        'Note:', 
        `${withoutPassword} teachers were created before password tracking was implemented.`,
        'Their passwords are not available.',
        'Consider resetting their passwords if needed.'
      ]], { origin: -1 });
    }
    
    // Set column widths
    worksheet['!cols'] = [
      { wch: 25 },  // Full Name
      { wch: 30 },  // Email
      { wch: 20 },  // Password
      { wch: 15 }   // Department
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Teacher Credentials');
    
    // Generate file and send
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `teacher_credentials_${department}_${timestamp}.xlsx`;
    
    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
    
    res.set({
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    
    res.send(buffer);
  } catch (error) {
    console.error('Export teacher credentials error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      code: error.code
    });
    res.status(500).json({
      success: false,
      message: `Server error exporting teacher credentials: ${error.message}`
    });
  }
};

// @desc    Set a teacher's designation
// @route   PUT /api/admin/users/:userId/designation
// @access  Admin only
exports.setUserDesignation = async (req, res) => {
  try {
    const { userId } = req.params;
    let { designation } = req.body;

    if (!designation) {
      return res.status(400).json({ success: false, message: 'Designation is required' });
    }

    // Normalize and validate designation
    const allowed = ['Professor', 'Assistant Professor', 'Lecturer'];
    const normalized = String(designation).trim();
    if (!allowed.includes(normalized)) {
      return res.status(400).json({ success: false, message: 'Invalid designation value' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.role !== 'teacher') {
      return res.status(400).json({ success: false, message: 'Designation can only be set for teachers' });
    }

    user.designation = normalized;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Designation updated successfully',
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        designation: user.designation,
        isActive: user.isActive,
        isApprovedByAdmin: user.isApprovedByAdmin,
        isEmailVerified: user.isEmailVerified,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Set designation error:', error);
    res.status(500).json({ success: false, message: 'Server error setting designation' });
  }
};

// @desc    Set a teacher as department head (must be Professor)
// @route   PUT /api/admin/users/:userId/department-head
// @access  Admin only
exports.setDepartmentHead = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.role !== 'teacher') {
      return res.status(400).json({ success: false, message: 'Only teachers can be department heads' });
    }

    if (user.designation !== 'Professor') {
      return res.status(400).json({ success: false, message: 'Only Professors can be department heads' });
    }

    if (!user.department) {
      return res.status(400).json({ success: false, message: 'Teacher must have a department assigned' });
    }

    // Remove department head status from any other teacher in the same department
    await User.updateMany(
      { 
        department: user.department, 
        _id: { $ne: userId },
        isDepartmentHead: true 
      },
      { isDepartmentHead: false }
    );

    // Set this teacher as department head
    user.isDepartmentHead = true;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Department head assigned successfully',
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        designation: user.designation,
        department: user.department,
        isDepartmentHead: user.isDepartmentHead,
        isActive: user.isActive,
        isApprovedByAdmin: user.isApprovedByAdmin,
        isEmailVerified: user.isEmailVerified,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Set department head error:', error);
    res.status(500).json({ success: false, message: 'Server error setting department head' });
  }
};

// @desc    Remove department head status from a teacher
// @route   DELETE /api/admin/users/:userId/department-head
// @access  Admin only
exports.removeDepartmentHead = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.role !== 'teacher') {
      return res.status(400).json({ success: false, message: 'Only teachers can have department head status' });
    }

    user.isDepartmentHead = false;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Department head status removed successfully',
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        designation: user.designation,
        department: user.department,
        isDepartmentHead: user.isDepartmentHead,
        isActive: user.isActive,
        isApprovedByAdmin: user.isApprovedByAdmin,
        isEmailVerified: user.isEmailVerified,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Remove department head error:', error);
    res.status(500).json({ success: false, message: 'Server error removing department head' });
  }
};

// @desc    Assign a teacher to a course
// @route   POST /api/admin/courses/:courseId/assign-teacher
// @access  Admin only
exports.assignTeacherToCourse = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const { courseId } = req.params;
    const { teacherId, section } = req.body;

    if (!teacherId) {
      return res.status(400).json({
        success: false,
        message: 'Teacher ID is required'
      });
    }

    // Validate course exists
    const Course = require('../models/Course');
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Validate teacher exists and is a teacher
    const teacher = await User.findById(teacherId);
    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: 'Teacher not found'
      });
    }

    if (teacher.role !== 'teacher') {
      return res.status(400).json({
        success: false,
        message: 'User is not a teacher'
      });
    }

    // Validate section value (if provided)
    if (section && !['A', 'B'].includes(section)) {
      return res.status(400).json({
        success: false,
        message: 'Section must be A or B'
      });
    }

    // Initialize assignedTeachers if needed
    if (!course.assignedTeachers) {
      course.assignedTeachers = [];
    }

    // Normalize assignedTeachers to new format if needed (handle legacy data)
    course.assignedTeachers = course.assignedTeachers.map(item => {
      // If item doesn't have a 'teacher' property, it's in old format (just an ObjectId)
      if (!item.teacher) {
        return { teacher: item, section: null };
      }
      return item;
    });

    // Check if teacher is already assigned (regardless of section)
    const existingAssignment = course.assignedTeachers.find(
      a => {
        const teacherId_item = a.teacher?._id || a.teacher;
        const teacherIdStr = teacherId_item.toString();
        return teacherIdStr === teacherId.toString();
      }
    );

    if (existingAssignment) {
      return res.status(400).json({
        success: false,
        message: 'Teacher is already assigned to this course'
      });
    }

    // Check if maximum 2 teachers already assigned
    if (course.assignedTeachers.length >= 2) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 2 teachers can be assigned to a course'
      });
    }

    // Add teacher to assignedTeachers array
    course.assignedTeachers.push({
      teacher: teacherId,
      section: section || null
    });
    await course.save();

    // Populate teacher info for response
    await course.populate('assignedTeachers.teacher', 'name email designation');

    res.status(200).json({
      success: true,
      message: 'Teacher assigned to course successfully',
      data: {
        courseId: course._id,
        courseCode: course.courseCode,
        courseTitle: course.courseTitle,
        assignedTeachers: course.assignedTeachers
      }
    });

  } catch (error) {
    console.error('Assign teacher to course error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error assigning teacher to course'
    });
  }
};

// @desc    Unassign a teacher from a course
// @route   DELETE /api/admin/courses/:courseId/unassign-teacher/:teacherId
// @access  Admin only
exports.unassignTeacherFromCourse = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const { courseId, teacherId } = req.params;
    const { section } = req.query;

    // Validate course exists
    const Course = require('../models/Course');
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Check if teacher is assigned
    if (!course.assignedTeachers || course.assignedTeachers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Teacher is not assigned to this course'
      });
    }

    // Normalize assignedTeachers to new format if needed (handle legacy data)
    course.assignedTeachers = course.assignedTeachers.map(item => {
      // If item doesn't have a 'teacher' property, it's in old format (just an ObjectId)
      if (!item.teacher) {
        return { teacher: item, section: null };
      }
      return item;
    });

    // Find and remove the assignment
    const initialLength = course.assignedTeachers.length;
    course.assignedTeachers = course.assignedTeachers.filter(
      a => {
        const teacherId_item = a.teacher?._id || a.teacher;
        const teacherIdStr = teacherId_item.toString();
        return !(teacherIdStr === teacherId.toString() && 
               (section ? a.section === section : true));
      }
    );

    if (course.assignedTeachers.length === initialLength) {
      return res.status(400).json({
        success: false,
        message: 'Teacher assignment not found'
      });
    }

    await course.save();

    // Populate teacher info for response
    await course.populate('assignedTeachers.teacher', 'name email designation');

    res.status(200).json({
      success: true,
      message: 'Teacher unassigned from course successfully',
      data: {
        courseId: course._id,
        courseCode: course.courseCode,
        courseTitle: course.courseTitle,
        assignedTeachers: course.assignedTeachers
      }
    });

  } catch (error) {
    console.error('Unassign teacher from course error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error unassigning teacher from course'
    });
  }
};

// @desc    Get all teachers assigned to a course
// @route   GET /api/admin/courses/:courseId/assigned-teachers
// @access  Admin only
exports.getAssignedTeachers = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const { courseId } = req.params;

    // Validate course exists
    const Course = require('../models/Course');
    const course = await Course.findById(courseId)
      .populate('assignedTeachers.teacher', 'name email designation isActive');
    
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        courseId: course._id,
        courseCode: course.courseCode,
        courseTitle: course.courseTitle,
        courseType: course.course_type,
        assignedTeachers: course.assignedTeachers || []
      }
    });

  } catch (error) {
    console.error('Get assigned teachers error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting assigned teachers'
    });
  }
};

// @desc    Update user profile
// @route   PUT /api/admin/users/:userId/profile
// @access  Admin only
exports.updateUserProfile = async (req, res) => {
  try {
    // Verify admin role
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const { userId } = req.params;
    const updateData = req.body;

    // Validate user exists
    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent updating admin users
    if (user.role === 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update admin users'
      });
    }

    // Fields allowed to update
    const allowedFields = [
      'name', 'email', 'roll', 'father', 'mother', 'advisor',
      'phone', 'address', 'hall', 'scholarship', 'gender',
      'bloodGroup', 'religion', 'designation'
    ];

    // Filter and update only allowed fields
    const updates = {};
    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        updates[field] = updateData[field];
      }
    });

    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password');

    res.status(200).json({
      success: true,
      message: 'User profile updated successfully',
      data: updatedUser
    });

  } catch (error) {
    console.error('Update user profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating user profile'
    });
  }
};

// @desc    Assign batch to a course
// @route   POST /api/admin/courses/:courseId/assign-batch
// @access  Admin only
exports.assignBatchToCourse = async (req, res) => {
  try {
    // Verify admin role
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const { courseId } = req.params;
    const { batch, deptCode } = req.body;

    // Validate inputs
    if (!batch || !deptCode) {
      return res.status(400).json({
        success: false,
        message: 'Batch and department code are required'
      });
    }

    // Validate batch format (2 digits)
    if (!/^\d{2}$/.test(batch)) {
      return res.status(400).json({
        success: false,
        message: 'Batch must be 2 digits (e.g., "21" for 2021)'
      });
    }

    // Validate department code
    const validDeptCodes = ['01', '03', '05', '07', '09', '11', '13', '15', '17', '19', '21', '23', '25', '27', '29', '31'];
    if (!validDeptCodes.includes(deptCode)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid department code'
      });
    }

    // Validate course exists
    const Course = require('../models/Course');
    const course = await Course.findById(courseId);
    
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Check if this batch+dept combination is already assigned
    const alreadyAssigned = course.assignedBatches.some(
      ab => ab.batch === batch && ab.deptCode === deptCode
    );

    if (alreadyAssigned) {
      return res.status(400).json({
        success: false,
        message: 'This batch and department combination is already assigned to the course'
      });
    }

    // Add the batch assignment
    course.assignedBatches.push({ batch, deptCode });
    await course.save();

    // Populate and return updated course
    const updatedCourse = await Course.findById(courseId)
      .populate('assignedTeachers.teacher', 'name email designation');

    res.status(200).json({
      success: true,
      message: 'Batch assigned to course successfully',
      data: {
        courseId: updatedCourse._id,
        courseCode: updatedCourse.courseCode,
        courseTitle: updatedCourse.courseTitle,
        assignedBatches: updatedCourse.assignedBatches
      }
    });

  } catch (error) {
    console.error('Assign batch to course error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error assigning batch to course'
    });
  }
};

// @desc    Unassign batch from a course
// @route   DELETE /api/admin/courses/:courseId/unassign-batch
// @access  Admin only
exports.unassignBatchFromCourse = async (req, res) => {
  try {
    // Verify admin role
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const { courseId } = req.params;
    const { batch, deptCode } = req.body;

    // Validate inputs
    if (!batch || !deptCode) {
      return res.status(400).json({
        success: false,
        message: 'Batch and department code are required'
      });
    }

    // Validate course exists
    const Course = require('../models/Course');
    const course = await Course.findById(courseId);
    
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Remove the batch assignment
    course.assignedBatches = course.assignedBatches.filter(
      ab => !(ab.batch === batch && ab.deptCode === deptCode)
    );

    await course.save();

    // Populate and return updated course
    const updatedCourse = await Course.findById(courseId)
      .populate('assignedTeachers.teacher', 'name email designation');

    res.status(200).json({
      success: true,
      message: 'Batch unassigned from course successfully',
      data: {
        courseId: updatedCourse._id,
        courseCode: updatedCourse.courseCode,
        courseTitle: updatedCourse.courseTitle,
        assignedBatches: updatedCourse.assignedBatches
      }
    });

  } catch (error) {
    console.error('Unassign batch from course error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error unassigning batch from course'
    });
  }
};

// @desc    Get assigned batches for a course
// @route   GET /api/admin/courses/:courseId/assigned-batches
// @access  Admin only
exports.getAssignedBatches = async (req, res) => {
  try {
    // Verify admin role
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const { courseId } = req.params;

    // Validate course exists
    const Course = require('../models/Course');
    const course = await Course.findById(courseId);
    
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        courseId: course._id,
        courseCode: course.courseCode,
        courseTitle: course.courseTitle,
        assignedBatches: course.assignedBatches || []
      }
    });

  } catch (error) {
    console.error('Get assigned batches error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting assigned batches'
    });
  }
};

