const User = require('../models/User');
const { sendApprovalEmail } = require('../utils/emailService');
const XLSX = require('xlsx');
const crypto = require('crypto');
const { bulkImportTeachers } = require('../utils/bulkTeacherImport');
const CTAttainment = require('../models/CTAttainment');
const AssignmentAttainment = require('../models/AssignmentAttainment');
const TermExamAttainment = require('../models/TermExamAttainment');
const LabActivityAttainment = require('../models/LabActivityAttainment');
const TermExamMarks = require('../models/TermExamMarks');
const { clearCache } = require('../middlewares/cacheMiddleware');

const generateRandomPassword = () => {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const allChars = uppercase + lowercase + numbers;

  let password = '';
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];

  for (let i = 0; i < 5; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  return password.split('').sort(() => Math.random() - 0.5).join('');
};

exports.getAllUsers = async (req, res) => {
  try {
    const { role, department, designation, search, batch } = req.query;

    let filter = {};

    if (role) filter.role = role.toLowerCase();

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      filter.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { roll: searchRegex }
      ];
    }

    if (department) filter.department = new RegExp(`^${department}$`, 'i');
    if (designation) filter.designation = new RegExp(`^${designation}$`, 'i');

    if (batch) {
      const batchRegex = new RegExp(`^${batch}0[1-9]`);
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { roll: batchRegex }];
        delete filter.$or;
      } else {
        filter.roll = batchRegex;
      }
    }

    const users = await User.find(filter).select('-password');

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

exports.getUsersMetadata = async (req, res) => {
  try {
    const teachers = await User.find({ role: 'teacher' }).select('department email -_id').lean();
    const students = await User.find({ role: 'student' }).select('department roll -_id').lean();
    
    res.status(200).json({
      success: true,
      data: {
        teachers,
        students
      }
    });
  } catch (error) {
    console.error('Get users metadata error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching users metadata'
    });
  }
};

exports.importStudentsFromExcel = async (req, res) => {
  try {
    const bcrypt = require('bcryptjs');
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const fileBuf = req.file.buffer;
    const isXLSX = fileBuf[0] === 0x50 && fileBuf[1] === 0x4B && fileBuf[2] === 0x03 && fileBuf[3] === 0x04;
    const isXLS  = fileBuf[0] === 0xD0 && fileBuf[1] === 0xCF && fileBuf[2] === 0x11 && fileBuf[3] === 0xE0;
    if (!isXLSX && !isXLS) {
      return res.status(400).json({ success: false, message: 'Invalid file format. Only .xlsx and .xls files are accepted.' });
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
      const normalize = (str) => String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      for (const key of keys) {
        if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
          return String(row[key]).trim();
        }
      }
      const targetNorms = keys.map(normalize);
      for (const [rowKey, rowValue] of Object.entries(row)) {
        const rowKeyNorm = normalize(rowKey);
        if (targetNorms.includes(rowKeyNorm) && rowValue !== undefined && rowValue !== null && String(rowValue).trim() !== '') {
          return String(rowValue).trim();
        }
      }
      return '';
    };

    const emailsToQuery = [];
    const rollsToQuery = [];
    const deptCodesToQuery = new Set();
    const processedRows = [];

    for (let idx = 0; idx < rows.length; idx++) {
      const row = rows[idx];
      const roll = normalizeVal(row, ['Roll', 'roll']);
      const name = normalizeVal(row, ['name', 'Name']);
      
      if (!roll || !name) {
        results.errors.push({ row: idx + 2, reason: 'Missing roll or name' });
        continue;
      }

      const nameParts = name.trim().split(/\s+/);
      const lastNameRaw = nameParts[nameParts.length - 1] || 'student';
      const lastName = lastNameRaw.toLowerCase().replace(/[^a-z0-9]/g, '');
      const email = `${lastName}${roll}@stud.kuet.ac.bd`.toLowerCase();

      const rollDigits = roll.replace(/\D/g, '');
      let deptCode = null;
      if (rollDigits.length >= 4) {
        deptCode = rollDigits.substring(2, 4);
        deptCodesToQuery.add(deptCode);
      }

      emailsToQuery.push(email);
      rollsToQuery.push(roll);

      processedRows.push({
        idx, row, roll, name, email, deptCode,
        advisor: normalizeVal(row, ['advisor', 'Advisor']),
        father: normalizeVal(row, ['father', 'Father']),
        mother: normalizeVal(row, ['mother', 'Mother']),
        hall: normalizeVal(row, ['hall', 'Hall']),
        scholarship: normalizeVal(row, ['scholarship', 'Scholarship']),
        department: normalizeVal(row, ['department', 'Department', 'dept', 'Dept'])
      });
    }

    const Department = require('../models/Department');
    const existingUsers = await User.find({ 
      $or: [
        { email: { $in: emailsToQuery } }, 
        { roll: { $in: rollsToQuery } }
      ] 
    }).select('email roll').lean();

    const existingEmails = new Set(existingUsers.map(u => u.email));
    const existingRolls = new Set(existingUsers.map(u => u.roll));
    
    const fetchedDepts = await Department.find({ numericCode: { $in: Array.from(deptCodesToQuery) } }).lean();
    const deptMap = new Map(fetchedDepts.map(d => [d.numericCode, d._id]));

    const usersToInsert = [];
    const intraBatchEmails = new Set();
    const intraBatchRolls = new Set();

    for (const data of processedRows) {
      const { idx, roll, name, email, deptCode, advisor, father, mother, hall, scholarship, department } = data;

      if (existingEmails.has(email) || existingRolls.has(roll) || intraBatchEmails.has(email) || intraBatchRolls.has(roll)) {
        results.skipped.push({ row: idx + 2, roll, email, reason: 'Email or roll already exists/duplicated' });
        continue;
      }

      intraBatchEmails.add(email);
      intraBatchRolls.add(roll);

      let finalDepartment = department;
      if (!finalDepartment && deptCode && deptMap.has(deptCode)) {
        finalDepartment = deptMap.get(deptCode);
      } else if (!finalDepartment) {
        finalDepartment = '';
      }

      const randomPassword = generateRandomPassword();
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(randomPassword, salt);

      usersToInsert.push({
        name,
        email,
        password: hashedPassword,
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
    }

    if (usersToInsert.length > 0) {
      try {
        await User.insertMany(usersToInsert);
        results.created += usersToInsert.length;
      } catch (err) {
        results.errors.push({ reason: 'Bulk insert failed: ' + err.message });
      }
    }

    return res.status(200).json({ success: true, ...results });
  } catch (error) {
    console.error('Import students error:', error);
    return res.status(500).json({ success: false, message: 'Server error importing students' });
  }
};

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
      const twoVal = parseInt(firstTwo, 10);
      const pivot = new Date().getFullYear() % 100; // e.g., 26 in 2026
      const century = twoVal <= pivot ? 20 : 19;
      const year = parseInt(`${century}${firstTwo}`, 10);
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

exports.getStudentsForCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const Course = require('../models/Course');
    
    const course = await Course.findById(courseId).select('assignedBatches courseCode');
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    if (!course.assignedBatches || course.assignedBatches.length === 0) {
      return res.status(200).json({ 
        success: true, 
        data: [],
        message: 'No batch assigned to this course'
      });
    }

    const assignment = course.assignedBatches[0];
    const { batch, deptCode } = assignment;

    const prefix = `${batch}${deptCode}`;
    const students = await User.find({ 
      role: 'student',
      roll: { $regex: `^${prefix}`, $options: 'i' }
    })
    .select('roll name email')
    .sort({ roll: 1 })
    .lean();

    res.status(200).json({ 
      success: true, 
      data: students,
      batch: assignment
    });
  } catch (error) {
    console.error('Get students for course error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching students' });
  }
};

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

exports.exportStudentCredentials = async (req, res) => {
  try {
    const { batchYear, deptCode } = req.body;

    const allowedDeptCodes = ['07','03','05','01','09','11','13','15','17','19','27','31','23','25','21','29'];

    if (!batchYear || !deptCode) {
      return res.status(400).json({ 
        success: false, 
        message: 'Batch year and department code are required' 
      });
    }

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

    const batchPrefix = batchYear.slice(-2);
    const rollPrefix = `${batchPrefix}${deptCode}`;

    const students = await User.find({
      role: 'student',
      roll: { $regex: `^${rollPrefix}`, $options: 'i' }
    }).select('+initialPassword name email roll').sort({ roll: 1 });

    if (students.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: `No students found for batch ${batchYear} and department ${deptCode}` 
      });
    }

    const exportData = students.map(s => ({
      Roll: s.roll,
      Name: s.name,
      Email: s.email,
      Password: s.initialPassword || '[Not Available]'
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Credentials');

    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

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

exports.importTeachersFromExcel = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const teacherFileBuf = req.file.buffer;
    const isTeacherXLSX = teacherFileBuf[0] === 0x50 && teacherFileBuf[1] === 0x4B && teacherFileBuf[2] === 0x03 && teacherFileBuf[3] === 0x04;
    const isTeacherXLS  = teacherFileBuf[0] === 0xD0 && teacherFileBuf[1] === 0xCF && teacherFileBuf[2] === 0x11 && teacherFileBuf[3] === 0xE0;
    if (!isTeacherXLSX && !isTeacherXLS) {
      return res.status(400).json({ success: false, message: 'Invalid file format. Only .xlsx and .xls files are accepted.' });
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

    const results = await bulkImportTeachers(rows);

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

    const deptRegex = new RegExp(`@${department}\\.kuet\\.ac\\.bd$`, 'i');
    const teachers = await User.find({
      role: 'teacher',
      $or: [
        { department: { $regex: new RegExp(`^${department}$`, 'i') } },
        { email: { $regex: deptRegex } }
      ]
    })
    .select('name email department +initialPassword')
    .lean();

    if (teachers.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No teachers found for department: ${department}`
      });
    }

    const workbook = XLSX.utils.book_new();
    
    const withPassword = teachers.filter(t => t.initialPassword).length;
    const withoutPassword = teachers.length - withPassword;
    
    const exportData = teachers.map(t => ({
      'Full Name': t.name || '',
      'Email': t.email || '',
      'Password': t.initialPassword || '[Not Available - Created before password tracking]',
      'Department': t.department || department
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    
    if (withoutPassword > 0) {
      XLSX.utils.sheet_add_aoa(worksheet, [[
        'Note:', 
        `${withoutPassword} teachers were created before password tracking was implemented.`,
        'Their passwords are not available.',
        'Consider resetting their passwords if needed.'
      ]], { origin: -1 });
    }
    
    worksheet['!cols'] = [
      { wch: 25 },  // Full Name
      { wch: 30 },  // Email
      { wch: 20 },  // Password
      { wch: 15 }   // Department
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Teacher Credentials');
    
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

exports.setUserDesignation = async (req, res) => {
  try {
    const { userId } = req.params;
    let { designation } = req.body;

    if (!designation) {
      return res.status(400).json({ success: false, message: 'Designation is required' });
    }

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

    await User.updateMany(
      { 
        department: user.department, 
        _id: { $ne: userId },
        isDepartmentHead: true 
      },
      { isDepartmentHead: false }
    );

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

    const Course = require('../models/Course');
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    if (course.course_type === 'THEORY') {
      if (!section) {
        return res.status(400).json({
          success: false,
          message: 'Section (A or B) is required for THEORY courses'
        });
      }
      if (!['A', 'B'].includes(section)) {
        return res.status(400).json({
          success: false,
          message: 'Section must be either A or B for THEORY courses'
        });
      }
    } else {
      if (section && section !== null) {
        return res.status(400).json({
          success: false,
          message: `Section assignment is not applicable for ${course.course_type} courses`
        });
      }
    }

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

    if (!course.assignedTeachers) {
      course.assignedTeachers = [];
    }

    course.assignedTeachers = course.assignedTeachers.map(item => {
      if (!item.teacher) {
        return { teacher: item, section: null };
      }
      return item;
    });

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

    if (course.assignedTeachers.length >= 2) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 2 teachers can be assigned to a course'
      });
    }

    if (course.course_type === 'THEORY' && section) {
      const sectionAlreadyAssigned = course.assignedTeachers.find(
        a => a.section === section
      );

      if (sectionAlreadyAssigned) {
        return res.status(400).json({
          success: false,
          message: `Section ${section} is already assigned to another teacher`
        });
      }
    }

    course.assignedTeachers.push({
      teacher: teacherId,
      section: course.course_type === 'THEORY' ? section : null
    });
    await course.save();

    await course.populate('assignedTeachers.teacher', 'name email designation');

    const assignedTeachersWithSection = course.assignedTeachers.map(assignment => ({
      teacher: assignment.teacher,
      section: assignment.section,
      _id: assignment._id
    }));

    res.status(200).json({
      success: true,
      message: 'Teacher assigned to course successfully',
      data: {
        courseId: course._id,
        courseCode: course.courseCode,
        courseTitle: course.courseTitle,
        assignedTeachers: assignedTeachersWithSection
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

exports.unassignTeacherFromCourse = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const { courseId, teacherId } = req.params;

    const Course = require('../models/Course');
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    if (!course.assignedTeachers || course.assignedTeachers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Teacher is not assigned to this course'
      });
    }

    course.assignedTeachers = course.assignedTeachers.map(item => {
      if (!item.teacher) {
        return { teacher: item, section: null };
      }
      return item;
    });

    const initialLength = course.assignedTeachers.length;
    course.assignedTeachers = course.assignedTeachers.filter(
      a => {
        const teacherId_item = a.teacher?._id || a.teacher;
        const teacherIdStr = teacherId_item.toString();
        return teacherIdStr !== teacherId.toString();
      }
    );

    if (course.assignedTeachers.length === initialLength) {
      return res.status(400).json({
        success: false,
        message: 'Teacher assignment not found'
      });
    }

    await course.save();

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

exports.getAssignedTeachers = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const { courseId } = req.params;

    const Course = require('../models/Course');
    const course = await Course.findById(courseId)
      .populate('assignedTeachers.teacher', 'name email designation isActive');
    
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    const sanitizedBatches = Array.isArray(course.assignedBatches) && course.assignedBatches.length > 1
      ? [course.assignedBatches[course.assignedBatches.length - 1]]
      : (course.assignedBatches || []);

    res.status(200).json({
      success: true,
      data: {
        courseId: course._id,
        courseCode: course.courseCode,
        courseTitle: course.courseTitle,
        courseType: course.course_type,
        assignedTeachers: course.assignedTeachers || [],
        assignedBatches: sanitizedBatches
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

exports.updateUserProfile = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const { userId } = req.params;
    const updateData = req.body;

    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.role === 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update admin users'
      });
    }

    const allowedFields = [
      'name', 'email', 'roll', 'father', 'mother', 'advisor',
      'phone', 'address', 'hall', 'scholarship', 'gender',
      'bloodGroup', 'religion', 'designation'
    ];

    const updates = {};
    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        updates[field] = updateData[field];
      }
    });

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

exports.assignBatchToCourse = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const { courseId } = req.params;
    const { batch, deptCode } = req.body;

    if (!batch || !deptCode) {
      return res.status(400).json({
        success: false,
        message: 'Batch and department code are required'
      });
    }

    if (!/^\d{2}$/.test(batch)) {
      return res.status(400).json({
        success: false,
        message: 'Batch must be 2 digits (e.g., "21" for 2021)'
      });
    }

    const Department = require('../models/Department');
    const isValidDept = await Department.exists({ numericCode: deptCode });
    
    if (!isValidDept) {
      return res.status(400).json({
        success: false,
        message: 'Invalid department code'
      });
    }

    const Course = require('../models/Course');
    const course = await Course.findById(courseId);
    
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    const { yearLevel: reqYearLevel, semester: reqSemester, term: reqTerm } = req.body;
    const reqYearLevelNum = (reqYearLevel !== undefined && reqYearLevel !== null) ? parseInt(reqYearLevel, 10) : undefined;
    const reqSemesterNum = (reqSemester !== undefined && reqSemester !== null) ? parseInt(reqSemester, 10) : undefined;
    const reqTermNum = (reqTerm !== undefined && reqTerm !== null) ? parseInt(reqTerm, 10) : undefined;

    let y = course.yearLevel;
    let s = course.semester;
    let t = course.term;
    let needsSave = false;

    if (Number.isInteger(reqYearLevelNum) && (Number.isInteger(reqSemesterNum) || Number.isInteger(reqTermNum))) {
      y = reqYearLevelNum;
      s = Number.isInteger(reqSemesterNum) ? reqSemesterNum : ((reqYearLevelNum - 1) * 2) + reqTermNum;
      t = Number.isInteger(reqTermNum) ? reqTermNum : (s % 2 === 0 ? 2 : 1);
      
      course.yearLevel = y;
      course.semester = s;
      course.term = t;
      needsSave = true;
    }
    else if (Number.isInteger(y) && Number.isInteger(t) && !Number.isInteger(s)) {
      s = ((y - 1) * 2) + t;
      course.semester = s;
      needsSave = true;
    }
    else if (!Number.isInteger(y) && Number.isInteger(s)) {
      y = Math.ceil(s / 2);
      t = s % 2 === 0 ? 2 : 1;
      course.yearLevel = y;
      course.term = t;
      needsSave = true;
    }

    if (needsSave) {
      await course.save();
    }

    if (!Number.isInteger(y) || !Number.isInteger(s)) {
      console.error('[assignBatchToCourse] MISSING year/semester:', {
        courseCode: course.courseCode,
        yearLevel: y,
        semester: s,
        requestHad: { reqYearLevelNum, reqSemesterNum, reqTermNum }
      });
      return res.status(400).json({
        success: false,
        message: `Cannot assign batch: course ${course.courseCode} is missing year/semester. Request must include yearLevel and (semester or term).`
      });
    }

    const alreadyAssigned = course.assignedBatches.some(
      ab => ab.batch === batch && ab.deptCode === deptCode
    );

    if (alreadyAssigned) {
      return res.status(400).json({
        success: false,
        message: 'This batch and department combination is already assigned to the course'
      });
    }



    const existingForBatch = await Course.find({
      'assignedBatches.batch': batch,
      'assignedBatches.deptCode': deptCode
    }).select('yearLevel semester courseCode');

    const conflictingSemester = existingForBatch.find(c =>
      Number.isInteger(c.yearLevel) && Number.isInteger(c.semester) && (c.yearLevel !== y || c.semester !== s)
    );

    if (conflictingSemester) {
      return res.status(400).json({
        success: false,
        message: `Batch ${batch}-${deptCode} is already assigned to semester ${conflictingSemester.yearLevel}-${conflictingSemester.semester}. A batch can only belong to one semester.`
      });
    }

    const coursesInSem = await Course.find({ yearLevel: y, semester: s, 'assignedBatches.deptCode': deptCode })
      .select('assignedBatches courseCode');

    const otherBatchInSem = coursesInSem.some(c =>
      (c.assignedBatches || []).some(ab => ab.deptCode === deptCode && ab.batch !== batch)
    );

    if (otherBatchInSem) {
      return res.status(400).json({
        success: false,
        message: `Semester ${y}-${s} for department ${deptCode} is already assigned to a different batch. A semester can be taught to only one batch at a time.`
      });
    }

    const oldAssignment = (course.assignedBatches || [])[0];
    const isBatchChange =
      !oldAssignment || // no prior batch — may still have leftover data from an unassign
      (oldAssignment.batch !== batch || oldAssignment.deptCode !== deptCode);

    if (isBatchChange) {
      await Promise.all([
        CTAttainment.updateOne(
          { course: courseId },
          {
            $set: {
              ctRows: [],
              ctFactors: { CT1: 1, CT2: 1, CT3: 1 },
              ctManualWts: {},
              ctEqWts: { CT1: 0, CT2: 0, CT3: 0 },
              ctSummary: { ctTaken: 0, coMappedMarks60: 0, useEqWt: 0 },
              ctObtainedRows: [],
            }
          }
        ),
        AssignmentAttainment.updateOne(
          { course: courseId },
          {
            $set: {
              assignmentRows: [],
              assignmentManualWts: {},
              assignmentSummary: { assignTaken: 0, assignmentMarks30: 0, useEqWt: 0, attendancePerformance: 0 },
              attendanceMarks: 0,
              attnAssignObtainedRows: [],
            }
          }
        ),
        TermExamAttainment.updateOne(
          { course: courseId },
          { $set: { sectionARows: [], sectionBRows: [], sectionAObtainedRows: [], sectionBObtainedRows: [] } }
        ),
        LabActivityAttainment.updateOne(
          { course: courseId },
          {
            $set: {
              labActivityRows: [],
              labActivityFactors: {},
              labActivityEqWts: {},
              labActivityManualWts: {},
              labAttendanceMarks: 0,
              labQuizMarks: 0,
              labVivaMarks: 0,
              activityTaken: 0,
              otherActivityRemaining: 0,
              otherActivityMeasured: 0,
              coMappedActivityMarks: 0,
              useEqWtActivity: 0,
              labActivityObtainedRows: [],
            }
          }
        ),
        TermExamMarks.deleteMany({ course: courseId }),
      ]);
    }

    course.assignedBatches = [{ batch, deptCode }];
    await course.save();

    if (isBatchChange) {
      clearCache(`ct_${courseId}`);
      clearCache(`assignment_${courseId}`);
      clearCache(`labactivity_${courseId}`);
      clearCache(`section-a_${courseId}`);
      clearCache(`term_${courseId}`);
    }

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

exports.unassignBatchFromCourse = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const { courseId } = req.params;
    const { batch, deptCode } = req.body;

    if (!batch || !deptCode) {
      return res.status(400).json({
        success: false,
        message: 'Batch and department code are required'
      });
    }

    const Course = require('../models/Course');
    const course = await Course.findById(courseId);
    
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    course.assignedBatches = course.assignedBatches.filter(
      ab => !(ab.batch === batch && ab.deptCode === deptCode)
    );

    await course.save();

    await Promise.all([
      CTAttainment.updateOne(
        { course: courseId },
        {
          $set: {
            ctRows: [],
            ctFactors: { CT1: 1, CT2: 1, CT3: 1 },
            ctManualWts: {},
            ctEqWts: { CT1: 0, CT2: 0, CT3: 0 },
            ctSummary: { ctTaken: 0, coMappedMarks60: 0, useEqWt: 0 },
            ctObtainedRows: [],
          }
        }
      ),
      AssignmentAttainment.updateOne(
        { course: courseId },
        {
          $set: {
            assignmentRows: [],
            assignmentManualWts: {},
            assignmentSummary: { assignTaken: 0, assignmentMarks30: 0, useEqWt: 0, attendancePerformance: 0 },
            attendanceMarks: 0,
            attnAssignObtainedRows: [],
          }
        }
      ),
      TermExamAttainment.updateOne(
        { course: courseId },
        { $set: { sectionARows: [], sectionBRows: [], sectionAObtainedRows: [], sectionBObtainedRows: [] } }
      ),
      LabActivityAttainment.updateOne(
        { course: courseId },
        {
          $set: {
            labActivityRows: [],
            labActivityFactors: {},
            labActivityEqWts: {},
            labActivityManualWts: {},
            labAttendanceMarks: 0,
            labQuizMarks: 0,
            labVivaMarks: 0,
            activityTaken: 0,
            otherActivityRemaining: 0,
            otherActivityMeasured: 0,
            coMappedActivityMarks: 0,
            useEqWtActivity: 0,
            labActivityObtainedRows: [],
          }
        }
      ),
      TermExamMarks.deleteMany({ course: courseId }),
    ]);

    clearCache(`ct_${courseId}`);
    clearCache(`assignment_${courseId}`);
    clearCache(`labactivity_${courseId}`);
    clearCache(`section-a_${courseId}`);
    clearCache(`term_${courseId}`);

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

exports.getAssignedBatches = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const { courseId } = req.params;

    const Course = require('../models/Course');
    const course = await Course.findById(courseId);
    
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    const sanitizedBatches = Array.isArray(course.assignedBatches) && course.assignedBatches.length > 1
      ? [course.assignedBatches[course.assignedBatches.length - 1]]
      : (course.assignedBatches || []);

    res.status(200).json({
      success: true,
      data: {
        courseId: course._id,
        courseCode: course.courseCode,
        courseTitle: course.courseTitle,
        assignedBatches: sanitizedBatches
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

exports.normalizeBatchAssignments = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const Course = require('../models/Course');
    const courses = await Course.find({ 'assignedBatches.1': { $exists: true } }) // length > 1
      .select('assignedBatches courseCode');

    if (courses.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No courses require normalization',
        data: { normalizedCount: 0, affectedCourseIds: [] }
      });
    }

    const affectedCourseIds = [];
    const bulkOps = [];
    for (const c of courses) {
      const latest = c.assignedBatches[c.assignedBatches.length - 1];
      const newBatches = latest ? [latest] : [];
      affectedCourseIds.push(c._id);
      bulkOps.push({
        updateOne: {
          filter: { _id: c._id },
          update: { $set: { assignedBatches: newBatches } }
        }
      });
    }

    if (bulkOps.length > 0) {
      await Course.bulkWrite(bulkOps);
    }

    return res.status(200).json({
      success: true,
      message: 'Batch assignments normalized (kept latest only) for affected courses',
      data: { normalizedCount: affectedCourseIds.length, affectedCourseIds }
    });

  } catch (error) {
    console.error('Normalize batch assignments error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error normalizing batch assignments'
    });
  }
};

