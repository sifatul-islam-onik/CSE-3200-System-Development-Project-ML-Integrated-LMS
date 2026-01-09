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
      for (const key of keys) {
        if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
          return String(row[key]).trim();
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

    // Prepare export data using stored initial passwords (do not reset current passwords)
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
      console.log(`Warning: ${withoutPassword} of ${teachers.length} teachers don't have initial passwords recorded`);
    }
    
    // Prepare data with actual initial passwords
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
