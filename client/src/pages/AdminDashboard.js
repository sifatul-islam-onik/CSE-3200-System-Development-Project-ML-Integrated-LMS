import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faTimes, faChartBar, faEdit, faBookOpen, faPlus, faHourglass, faUsers, faCog, faSignOutAlt, faTrash, faClipboardList, faChevronRight, faUser, faEye, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { getUser, logout } from '../components/ProtectedRoute';
import { getPendingUsers, approveUser, rejectUser, getAllUsers, importStudentsFromExcel, setUserStatus, deleteUser, exportStudentCredentials, importTeachersFromExcel, exportTeacherCredentials, setUserDesignation, setDepartmentHead, removeDepartmentHead, assignTeacherToCourse, unassignTeacherFromCourse, getAssignedTeachers, updateUserProfile, assignBatchToCourse, unassignBatchFromCourse, getAssignedBatches, getStudentBatches } from '../services/adminService';
import { createCourse, getAllCourses, updateCourse, deleteCourse } from '../services/courseService';
import { getAllProposals, getProposalById, approveProposal, rejectProposal } from '../services/courseProposalService';
import CourseForm from '../components/CourseForm';
import CourseOBEView from '../components/CourseOBEView';
import '../styles/Dashboard.css';
import '../styles/AdminDashboard.css';
import '../styles/spinner.css';
import '../styles/Profile.css';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [activeSection, setActiveSection] = useState('pending');
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 1024);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [importFile, setImportFile] = useState(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importMessage, setImportMessage] = useState('');
  const [importError, setImportError] = useState('');
  const [exportBatchYear, setExportBatchYear] = useState('');
  const [exportDeptCode, setExportDeptCode] = useState('');
  const [exportLoading, setExportLoading] = useState(false);
  const [exportMessage, setExportMessage] = useState('');
  const [exportError, setExportError] = useState('');
  const [userLookupInput, setUserLookupInput] = useState('');
  const [lookupUser, setLookupUser] = useState(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [lookupDesignation, setLookupDesignation] = useState('Lecturer');
  const [lookupDesignationSaving, setLookupDesignationSaving] = useState(false);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userActionLoading, setUserActionLoading] = useState(null);
  const [error, setError] = useState('');
  const [usersError, setUsersError] = useState('');
  const [selectedUserRole, setSelectedUserRole] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [courseFormLoading, setCourseFormLoading] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [showOBEView, setShowOBEView] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [courseToDelete, setCourseToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [proposals, setProposals] = useState([]);
  const [selectedProposal, setSelectedProposal] = useState(null);
  const [showProposalDetail, setShowProposalDetail] = useState(false);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewError, setReviewError] = useState('');
  const [courseGroupPath, setCourseGroupPath] = useState(null);
  const [courseFormError, setCourseFormError] = useState('');
  const [adminProfileForm, setAdminProfileForm] = useState({
    name: '', father: '', mother: '', advisor: '', phone: '', address: '', hall: '', email: '', scholarship: '', gender: 'others', bloodGroup: '', religion: ''
  });
  const [adminCurrentPassword, setAdminCurrentPassword] = useState('');
  const [adminNewPassword, setAdminNewPassword] = useState('');
  const [adminConfirmPassword, setAdminConfirmPassword] = useState('');
  const [adminProfileSaving, setAdminProfileSaving] = useState(false);
  const [adminProfileMessage, setAdminProfileMessage] = useState('');
  const [teacherImportFile, setTeacherImportFile] = useState(null);
  const [teacherImportLoading, setTeacherImportLoading] = useState(false);
  const [teacherImportMessage, setTeacherImportMessage] = useState('');
  const [teacherImportError, setTeacherImportError] = useState('');
  const [teacherExportDept, setTeacherExportDept] = useState('');
  const [teacherExportLoading, setTeacherExportLoading] = useState(false);
  const [teacherExportMessage, setTeacherExportMessage] = useState('');
  const [teacherExportError, setTeacherExportError] = useState('');
  const [availableDepartments, setAvailableDepartments] = useState([]);
  const [availableTeacherDepartments, setAvailableTeacherDepartments] = useState([]);
  const [availableStudentDepartments, setAvailableStudentDepartments] = useState([]);
  const [availableStudentBatches, setAvailableStudentBatches] = useState([]);
  const [teacherFilterDept, setTeacherFilterDept] = useState('');
  const [teacherFilterDesignation, setTeacherFilterDesignation] = useState('');
  const [studentFilterDept, setStudentFilterDept] = useState('');
  const [studentFilterBatch, setStudentFilterBatch] = useState('');
  const [userSearchText, setUserSearchText] = useState('');
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [selectedCourseForAssignment, setSelectedCourseForAssignment] = useState(null);
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [assignmentError, setAssignmentError] = useState('');
  const [assignmentSuccess, setAssignmentSuccess] = useState('');
  const [teacherSectionSelections, setTeacherSectionSelections] = useState({});
  const [teacherFilter, setTeacherFilter] = useState('');
  const [showBatchAssignmentModal, setShowBatchAssignmentModal] = useState(false);
  const [selectedCourseForBatch, setSelectedCourseForBatch] = useState(null);
  const [batchAssignmentLoading, setBatchAssignmentLoading] = useState(false);
  const [batchAssignmentError, setBatchAssignmentError] = useState('');
  const [batchAssignmentSuccess, setBatchAssignmentSuccess] = useState('');
  const [batchInput, setBatchInput] = useState('');
  const [deptCodeInput, setDeptCodeInput] = useState('');
  const [showUserProfileModal, setShowUserProfileModal] = useState(false);
  const [selectedUserProfile, setSelectedUserProfile] = useState(null);
  const [userProfileForm, setUserProfileForm] = useState({});
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');

  // Navigate to a course group (drill-down)
  const navigateToGroup = (groupKey) => {
    setCourseGroupPath(groupKey);
  };

  // Go back to previous level
  const goBackGroup = () => {
    if (!courseGroupPath) return;
    
    const parts = courseGroupPath.split('-');
    if (parts.length === 2) {
      // Going back from year-semester to root
      setCourseGroupPath(null);
    } else if (parts.length === 3) {
      // Going back from type to year-semester
      setCourseGroupPath(`${parts[0]}-${parts[1]}`);
    }
  };

  // Organize courses by year-semester (e.g., 3-1, 1-2) and type
  const getOrganizedCourses = () => {
    const organized = {};
    courses.forEach(course => {
      const year = course.yearLevel !== null && course.yearLevel !== undefined ? course.yearLevel : 'Other';
      const term = course.term !== null && course.term !== undefined ? course.term : 'Other';
      const type = course.course_type || 'THEORY';
      
      // If term is 0, add course to both semester 1 and 2 of that year
      if (term === 0) {
        [1, 2].forEach(sem => {
          const yearSemKey = `${year}-${sem}`;
          if (!organized[yearSemKey]) organized[yearSemKey] = {};
          if (!organized[yearSemKey][type]) organized[yearSemKey][type] = [];
          organized[yearSemKey][type].push(course);
        });
      } else {
        const yearSemKey = `${year}-${term}`;
        if (!organized[yearSemKey]) organized[yearSemKey] = {};
        if (!organized[yearSemKey][type]) organized[yearSemKey][type] = [];
        organized[yearSemKey][type].push(course);
      }
    });
    return organized;
  };

  useEffect(() => {
    const userData = getUser();
    setUser(userData);
    if (userData) {
      setAdminProfileForm({
        name: userData.name || '',
        father: userData.father || '',
        mother: userData.mother || '',
        advisor: userData.advisor || '',
        phone: userData.phone || '',
        address: userData.address || '',
        hall: userData.hall || '',
        email: userData.email || '',
        scholarship: userData.scholarship || '',
        gender: userData.gender || 'others',
        bloodGroup: userData.bloodGroup || '',
        religion: userData.religion || ''
      });
    }
    // Fetch initial data for badge counts
    fetchPendingUsers();
    fetchProposals();

    // Handle window resize for sidebar behavior
    const handleResize = () => {
      if (window.innerWidth > 1024) {
        setSidebarOpen(true);
      } else {
        setSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (activeSection === 'pending') {
      fetchPendingUsers();
    } else if (activeSection === 'courses') {
      fetchCourses();
    } else if (activeSection === 'proposals') {
      fetchProposals();
    } else if (activeSection === 'users') {
      fetchAllUsers();
    }
  }, [activeSection]);

  const fetchPendingUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await getPendingUsers();
      setPendingUsers(response.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch pending users');
    } finally {
      setLoading(false);
    }
  };

  const fetchCourses = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await getAllCourses();
      setCourses(response.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch courses');
    } finally {
      setLoading(false);
    }
  };

  const fetchProposals = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await getAllProposals();
      const pendingOnly = (response.data || []).filter(
        (p) => (p.status || '').toUpperCase() === 'PENDING'
      );
      setProposals(pendingOnly);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch proposals');
    } finally {
      setLoading(false);
    }
  };

  const toggleUserGroup = (role) => {
    setSelectedUserRole(role);
    if (role === 'student') {
      // Fetch available batches from server
      (async () => {
        try {
          const resp = await getStudentBatches();
          setAvailableStudentBatches(Array.isArray(resp.data) ? resp.data : []);
        } catch (e) {
          // ignore; keep empty
          setAvailableStudentBatches([]);
        }
      })();
    }
  };

  const goBackUserGroups = () => {
    setSelectedUserRole(null);
  };

  const fetchAllUsers = async () => {
    setUsersLoading(true);
    setUsersError('');
    try {
      const response = await getAllUsers();
      setUsers(response.data || []);
      
      // Extract unique departments from teacher accounts
      const teachers = (response.data || []).filter(u => u.role === 'teacher');
      const depts = new Set();
      teachers.forEach(t => {
        if (t.department) {
          depts.add(t.department);
        } else if (t.email && t.email.includes('@') && t.email.includes('.kuet.ac.bd')) {
          // Extract from email format: name@DEPT.kuet.ac.bd
          const match = t.email.match(/@([^.]+)\.kuet\.ac\.bd/);
          if (match) depts.add(match[1].toUpperCase());
        }
      });
      const teacherDeptList = Array.from(depts).sort();
      setAvailableDepartments(teacherDeptList);
      setAvailableTeacherDepartments(teacherDeptList);

      // Extract unique departments from students
      const students = (response.data || []).filter(u => u.role === 'student');
      const studentDepts = new Set();
      students.forEach(s => {
        if (s.department) {
          studentDepts.add(s.department);
        } else if (s.roll) {
          // Extract department from roll number (YYMMNNN format)
          const rollDigits = String(s.roll).replace(/\D/g, '');
          if (rollDigits.length >= 4) {
            const deptCode = rollDigits.substring(2, 4);
            const dept = departmentMap[deptCode];
            if (dept) studentDepts.add(dept);
          }
        }
      });
      setAvailableStudentDepartments(Array.from(studentDepts).sort());
    } catch (err) {
      setUsersError(err.response?.data?.message || 'Failed to fetch users');
    } finally {
      setUsersLoading(false);
    }
  };

  const handleImportStudents = async () => {
    if (!importFile) {
      setImportError('Please select an Excel file');
      setTimeout(() => setImportError(''), 3000);
      return;
    }

    setImportLoading(true);
    setImportError('');
    setImportMessage('');

    try {
      const formData = new FormData();
      formData.append('file', importFile);
      const result = await importStudentsFromExcel(formData);

      const created = result.created || 0;
      const skipped = (result.skipped || []).length;
      const errors = (result.errors || []).length;
      let summary = `Imported ${created} students.`;
      if (skipped) summary += ` Skipped ${skipped} duplicate/invalid rows.`;
      if (errors) summary += ` ${errors} rows had errors.`;
      setImportMessage(summary);

      // Refresh users list to include new students
      fetchAllUsers();
    } catch (err) {
      setImportError(err.response?.data?.message || 'Failed to import students');
    } finally {
      setImportLoading(false);
      setImportFile(null);
    }
  };

  const handleExportCredentials = async () => {
    if (!exportBatchYear || !exportDeptCode) {
      setExportError('Please select batch year and department');
      setTimeout(() => setExportError(''), 3000);
      return;
    }

    const confirmed = window.confirm(
      `Export current credentials for batch ${exportBatchYear} (dept ${exportDeptCode}). Proceed?`
    );
    if (!confirmed) return;

    setExportLoading(true);
    setExportError('');
    setExportMessage('');

    try {
      const blob = await exportStudentCredentials(exportBatchYear, exportDeptCode);
      
      // Check if blob is valid
      if (!blob || blob.size === 0) {
        setExportError('No data received from server');
        setTimeout(() => setExportError(''), 5000);
        return;
      }

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `students_${exportBatchYear}_${exportDeptCode}.xlsx`;
      document.body.appendChild(link);
      link.click();
      
      // Delay cleanup to ensure download starts
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }, 100);

      setExportMessage('Credentials exported successfully.');
      setExportBatchYear('');
      setExportDeptCode('');
      setTimeout(() => setExportMessage(''), 5000);
    } catch (err) {
      console.error('Export error:', err);
      
      // Try to extract error message from blob if it's a JSON error response
      let errorMessage = 'Failed to export credentials';
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const errorData = JSON.parse(text);
          errorMessage = errorData.message || errorMessage;
        } catch (parseErr) {
          // If parsing fails, use default message
        }
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setExportError(errorMessage);
      setTimeout(() => setExportError(''), 5000);
    } finally {
      setExportLoading(false);
    }
  };

  const handleImportTeachers = async () => {
    if (!teacherImportFile) {
      setTeacherImportError('Please select an Excel file');
      setTimeout(() => setTeacherImportError(''), 3000);
      return;
    }

    setTeacherImportLoading(true);
    setTeacherImportError('');
    setTeacherImportMessage('');

    try {
      const formData = new FormData();
      formData.append('file', teacherImportFile);
      const result = await importTeachersFromExcel(formData);

      const created = result.data?.created || 0;
      const skipped = (result.data?.skipped || []).length;
      const errors = (result.data?.errors || []).length;
      let summary = `✅ Successfully imported ${created} teachers.`;
      if (skipped) summary += ` (${skipped} rows skipped)`;
      if (errors) summary += ` (${errors} rows had errors)`;
      setTeacherImportMessage(summary);
      
      // Refresh users list and departments dropdown
      if (created > 0) {
        await fetchAllUsers();
      }
    } catch (err) {
      setTeacherImportError(err.response?.data?.message || 'Failed to import teachers');
    } finally {
      setTeacherImportLoading(false);
      setTeacherImportFile(null);
    }
  };

  const handleExportTeachers = async () => {
    if (!teacherExportDept) {
      setTeacherExportError('Please select a department');
      setTimeout(() => setTeacherExportError(''), 3000);
      return;
    }

    setTeacherExportLoading(true);
    setTeacherExportError('');
    setTeacherExportMessage('');

    try {
      const blob = await exportTeacherCredentials(teacherExportDept);
      
      // Check if blob is valid
      if (!blob || blob.size === 0) {
        setTeacherExportError('No data received from server');
        setTimeout(() => setTeacherExportError(''), 5000);
        return;
      }

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `teacher_credentials_${teacherExportDept}_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      
      // Delay cleanup to ensure download starts
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }, 100);

      setTeacherExportMessage('Teacher credentials exported successfully.');
      setTeacherExportDept('');
      setTimeout(() => setTeacherExportMessage(''), 5000);
    } catch (err) {
      console.error('Export error:', err);
      
      // Try to extract error message from blob if it's a JSON error response
      let errorMessage = 'Failed to export teacher credentials';
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const errorData = JSON.parse(text);
          errorMessage = errorData.message || errorMessage;
        } catch (parseErr) {
          // If parsing fails, use default message
        }
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setTeacherExportError(errorMessage);
      setTimeout(() => setTeacherExportError(''), 5000);
    } finally {
      setTeacherExportLoading(false);
    }
  };

  const handleSectionChange = (section) => {
    setActiveSection(section);
    // Close sidebar on mobile after selecting a section
    if (window.innerWidth <= 1024) {
      setSidebarOpen(false);
    }
  };

  const handleApprove = async (userId) => {
    try {
      await approveUser(userId);
      setSuccessMessage('User approved successfully');
      setPendingUsers(pendingUsers.filter(u => u._id !== userId));
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to approve user');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleReject = async (userId) => {
    try {
      await rejectUser(userId);
      setSuccessMessage('User rejected successfully');
      setPendingUsers(pendingUsers.filter(u => u._id !== userId));
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reject user');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleUserStatusChange = async (member, isActive) => {
    if ((member.role || '').toLowerCase() === 'admin') {
      setUsersError('Cannot modify admin users');
      setTimeout(() => setUsersError(''), 3000);
      return;
    }

    setUserActionLoading(member._id);
    try {
      await setUserStatus(member._id, isActive);
      setSuccessMessage(`User ${isActive ? 'activated' : 'deactivated'} successfully`);
      fetchAllUsers();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setUsersError(err.response?.data?.message || 'Failed to update user status');
      setTimeout(() => setUsersError(''), 3000);
    } finally {
      setUserActionLoading(null);
    }
  };

  const handleDeleteUserAccount = async (member) => {
    if ((member.role || '').toLowerCase() === 'admin') {
      setUsersError('Cannot delete admin users');
      setTimeout(() => setUsersError(''), 3000);
      return;
    }

    const confirmed = window.confirm(`Delete ${member.name || 'this user'}? This cannot be undone.`);
    if (!confirmed) return;

    setUserActionLoading(member._id);
    try {
      await deleteUser(member._id);
      setSuccessMessage('User deleted successfully');
      setUsers(users.filter(u => u._id !== member._id));
      fetchAllUsers();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setUsersError(err.response?.data?.message || 'Failed to delete user');
      setTimeout(() => setUsersError(''), 3000);
    } finally {
      setUserActionLoading(null);
    }
  };

  const handleLookupUser = async () => {
    if (!userLookupInput.trim()) {
      setLookupError('Please enter email, roll number, or user ID');
      setTimeout(() => setLookupError(''), 3000);
      return;
    }

    setLookupLoading(true);
    setLookupError('');
    setLookupUser(null);

    try {
      const response = await getAllUsers();
      const allUsers = response.data || [];
      
      const searchTerm = userLookupInput.trim().toLowerCase();
      const foundUser = allUsers.find(u => 
        (u.email || '').toLowerCase() === searchTerm ||
        (u.roll || '').toLowerCase() === searchTerm ||
        (u._id || '').toLowerCase() === searchTerm
      );

      if (foundUser) {
        setLookupUser(foundUser);
        // Initialize designation selector for teachers when a user is found
        if ((foundUser.role || '').toLowerCase() === 'teacher') {
          setLookupDesignation(foundUser.designation || 'Lecturer');
        }
      } else {
        setLookupError('User not found');
      }
    } catch (err) {
      setLookupError('Failed to search user');
    } finally {
      setLookupLoading(false);
    }
  };

  const handleLookupUserAction = async (action) => {
    if (!lookupUser) return;

    if (lookupUser.role === 'admin') {
      setLookupError('Cannot modify admin users');
      setTimeout(() => setLookupError(''), 3000);
      return;
    }

    if (action === 'delete') {
      const confirmed = window.confirm(
        `Delete ${lookupUser.name || 'this user'}? This cannot be undone.`
      );
      if (!confirmed) return;

      setLookupLoading(true);
      try {
        await deleteUser(lookupUser._id);
        setSuccessMessage('User deleted successfully');
        setLookupUser(null);
        setUserLookupInput('');
        fetchAllUsers();
        setTimeout(() => setSuccessMessage(''), 3000);
      } catch (err) {
        setLookupError(err.response?.data?.message || 'Failed to delete user');
        setTimeout(() => setLookupError(''), 3000);
      } finally {
        setLookupLoading(false);
      }
    } else if (action === 'toggle') {
      setLookupLoading(true);
      try {
        const newStatus = !lookupUser.isActive;
        await setUserStatus(lookupUser._id, newStatus);
        setSuccessMessage(`User ${newStatus ? 'activated' : 'deactivated'} successfully`);
        setLookupUser({ ...lookupUser, isActive: newStatus });
        fetchAllUsers();
        setTimeout(() => setSuccessMessage(''), 3000);
      } catch (err) {
        setLookupError(err.response?.data?.message || 'Failed to update user status');
        setTimeout(() => setLookupError(''), 3000);
      } finally {
        setLookupLoading(false);
      }
    }
  };

  const handleCreateCourse = async (courseData) => {
    setCourseFormLoading(true);
    setCourseFormError('');
    console.log('=== Submitting Course Data ===');
    console.log(JSON.stringify(courseData, null, 2));
    try {
      await createCourse(courseData);
      setSuccessMessage('Course created successfully');
      setShowCourseForm(false);
      fetchCourses();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('=== Course Creation Error ===');
      console.error('Error:', err);
      console.error('Response:', err.response?.data);
      console.error('Response Message:', err.response?.data?.message);
      console.error('Response Error:', err.response?.data?.error);
      if (err.response?.data?.errors) {
        console.error('Validation Errors:', JSON.stringify(err.response.data.errors, null, 2));
      }
      // Build error message with details
      let errorMsg = err.response?.data?.message || 'Failed to create course';
      if (err.response?.data?.error) {
        errorMsg += `: ${err.response.data.error}`;
      }
      if (err.response?.data?.details && err.response.data.details.length > 0) {
        errorMsg += ` - ${err.response.data.details.join('; ')}`;
      }
      setCourseFormError(errorMsg);
    } finally {
      setCourseFormLoading(false);
    }
  };

  const handleUpdateCourse = async (courseData) => {
    setCourseFormLoading(true);
    setCourseFormError('');
    console.log('=== Updating Course Data ===');
    console.log(JSON.stringify(courseData, null, 2));
    try {
      await updateCourse(editingCourse._id, courseData);
      setSuccessMessage('Course updated successfully');
      setShowCourseForm(false);
      setEditingCourse(null);
      fetchCourses();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('=== Course Update Error ===');
      console.error('Error:', err);
      console.error('Response:', err.response?.data);
      console.error('Response Message:', err.response?.data?.message);
      console.error('Response Error:', err.response?.data?.error);
      console.error('Response Details:', err.response?.data?.details);
      console.error('Response Errors Array:', err.response?.data?.errors);
      
      // Build detailed error message
      const responseData = err.response?.data;
      let errorMsg = responseData?.message || 'Failed to update course';
      
      console.log('Building error message...');
      console.log('Base message:', errorMsg);
      console.log('Has error field?', !!responseData?.error);
      console.log('Has details field?', !!responseData?.details);
      console.log('Has errors array?', !!responseData?.errors);
      
      if (responseData?.error && typeof responseData.error === 'string') {
        errorMsg += `: ${responseData.error}`;
        console.log('Added error:', responseData.error);
      }
      
      if (responseData?.details && Array.isArray(responseData.details) && responseData.details.length > 0) {
        errorMsg += ` - ${responseData.details.join('; ')}`;
        console.log('Added details:', responseData.details);
      }
      
      // Handle express-validator errors array
      if (responseData?.errors && Array.isArray(responseData.errors) && responseData.errors.length > 0) {
        const validationErrors = responseData.errors.map(e => `${e.path || e.param}: ${e.msg}`).join('; ');
        if (!errorMsg.includes(validationErrors)) {
          errorMsg += ` - ${validationErrors}`;
          console.log('Added validation errors:', validationErrors);
        }
      }
      
      console.log('Final error message:', errorMsg);
      setCourseFormError(errorMsg);
    } finally {
      setCourseFormLoading(false);
    }
  };

  const handleDeleteCourse = async () => {
    if (!courseToDelete) return;
    
    setDeleteLoading(true);
    try {
      await deleteCourse(courseToDelete._id);
      setSuccessMessage(`Course "${courseToDelete.courseCode}" deleted successfully`);
      setCourses(courses.filter(c => c._id !== courseToDelete._id));
      setShowDeleteModal(false);
      setCourseToDelete(null);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('=== Course Delete Error ===');
      console.error(err);
      setError(err.response?.data?.message || 'Failed to delete course');
      setTimeout(() => setError(''), 3000);
    } finally {
      setDeleteLoading(false);
    }
  };

  const openDeleteModal = (course) => {
    setCourseToDelete(course);
    setShowDeleteModal(true);
  };

  const openAssignmentModal = async (course) => {
    setSelectedCourseForAssignment(course);
    setShowAssignmentModal(true);
    setAssignmentError('');
    setAssignmentSuccess('');
    setTeacherFilter('');
    
    // Fetch users if not already loaded
    if (users.length === 0) {
      try {
        const response = await getAllUsers();
        setUsers(response.data || []);
      } catch (err) {
        setAssignmentError('Failed to load teachers');
      }
    }
  };

  const handleAssignTeacher = async (teacherId, section) => {
    if (!selectedCourseForAssignment) return;
    
    setAssignmentLoading(true);
    setAssignmentError('');
    setAssignmentSuccess('');
    
    console.log('Assigning teacher:', {
      courseId: selectedCourseForAssignment._id,
      teacherId,
      section
    });
    
    try {
      const response = await assignTeacherToCourse(selectedCourseForAssignment._id, teacherId, section);
      console.log('Teacher assignment response:', response);
      console.log('assignedTeachers from response:', JSON.stringify(response.data?.assignedTeachers, null, 2));
      setAssignmentSuccess('Teacher assigned successfully');
      
      // Update the selected course with the new assignment data
      if (response.data?.assignedTeachers) {
        console.log('Updating selectedCourseForAssignment state with:', JSON.stringify(response.data.assignedTeachers, null, 2));
        setSelectedCourseForAssignment(prev => {
          const updated = {
            ...prev,
            assignedTeachers: response.data.assignedTeachers
          };
          console.log('New selectedCourseForAssignment:', JSON.stringify(updated.assignedTeachers, null, 2));
          return updated;
        });
      }
      
      // Clear the section selection for this teacher
      setTeacherSectionSelections(prev => {
        const updated = { ...prev };
        delete updated[teacherId];
        return updated;
      });
      
      fetchCourses(); // Refresh courses list
      setTimeout(() => setAssignmentSuccess(''), 3000);
    } catch (err) {
      console.error('Teacher assignment error:', err);
      console.error('Error response:', err.response?.data);
      setAssignmentError(err.response?.data?.message || err.message || 'Failed to assign teacher');
      setTimeout(() => setAssignmentError(''), 3000);
    } finally {
      setAssignmentLoading(false);
    }
  };

  const handleUnassignTeacher = async (teacherId) => {
    if (!selectedCourseForAssignment) return;
    
    setAssignmentLoading(true);
    setAssignmentError('');
    setAssignmentSuccess('');
    
    try {
      const response = await unassignTeacherFromCourse(selectedCourseForAssignment._id, teacherId);
      setAssignmentSuccess('Teacher unassigned successfully');
      
      // Update the selected course with the new assignment data
      if (response.data?.assignedTeachers) {
        setSelectedCourseForAssignment(prev => ({
          ...prev,
          assignedTeachers: response.data.assignedTeachers
        }));
      }
      
      fetchCourses(); // Refresh courses list
      setTimeout(() => setAssignmentSuccess(''), 3000);
    } catch (err) {
      setAssignmentError(err.response?.data?.message || 'Failed to unassign teacher');
      setTimeout(() => setAssignmentError(''), 3000);
    } finally {
      setAssignmentLoading(false);
    }
  };

  const openUserProfileModal = (user) => {
    setSelectedUserProfile(user);
    setUserProfileForm({
      name: user.name || '',
      email: user.email || '',
      roll: user.roll || '',
      father: user.father || '',
      mother: user.mother || '',
      advisor: user.advisor || '',
      phone: user.phone || '',
      address: user.address || '',
      hall: user.hall || '',
      scholarship: user.scholarship || '',
      gender: user.gender || 'others',
      bloodGroup: user.bloodGroup || '',
      religion: user.religion || '',
      designation: user.designation || ''
    });
    setShowUserProfileModal(true);
    setProfileError('');
    setProfileSuccess('');
  };

  const handleUpdateUserProfile = async () => {
    if (!selectedUserProfile) return;
    
    setProfileSaving(true);
    setProfileError('');
    setProfileSuccess('');
    
    try {
      // Call API to update user profile
      const response = await fetch(`${process.env.REACT_APP_API_URL || '/api'}/admin/users/${selectedUserProfile._id}/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(userProfileForm)
      });
      
      const data = await response.json();
      
      if (data.success) {
        setProfileSuccess('Profile updated successfully');
        // Update users list
        setUsers(prev => prev.map(u => u._id === selectedUserProfile._id ? { ...u, ...userProfileForm } : u));
        // Update lookup user if it's the same
        if (lookupUser && lookupUser._id === selectedUserProfile._id) {
          setLookupUser({ ...lookupUser, ...userProfileForm });
        }
        setTimeout(() => {
          setProfileSuccess('');
          setShowUserProfileModal(false);
        }, 2000);
      } else {
        setProfileError(data.message || 'Failed to update profile');
      }
    } catch (err) {
      setProfileError('Failed to update profile');
    } finally {
      setProfileSaving(false);
    }
  };

  // Department mapping
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

  // Open batch assignment modal
  const openBatchAssignmentModal = async (course) => {
    setSelectedCourseForBatch(course);
    setShowBatchAssignmentModal(true);
    setBatchAssignmentError('');
    setBatchAssignmentSuccess('');
    setBatchInput('');
    setDeptCodeInput('');
  };

  // Helper: derive full year from two-digit batch per rule
  const formatBatchYear = (twoDigits) => {
    const val = parseInt(String(twoDigits || '').replace(/\D/g, ''), 10);
    if (Number.isNaN(val) || val < 0 || val > 99) return '';
    const pivot = new Date().getFullYear() % 100; // e.g., 26 in 2026
    const century = val <= pivot ? 20 : 19;
    return `${century}${val.toString().padStart(2, '0')}`;
  };

  // Handle assign batch to course
  const handleAssignBatch = async () => {
    if (!batchInput || !deptCodeInput) {
      setBatchAssignmentError('Please enter both batch and department code');
      return;
    }

    setBatchAssignmentLoading(true);
    setBatchAssignmentError('');
    setBatchAssignmentSuccess('');

    try {
      const normalizedBatch = String(batchInput).replace(/\D/g, '').padStart(2, '0');
      console.log('Assigning batch:', { batch: normalizedBatch, deptCode: deptCodeInput, courseId: selectedCourseForBatch._id });
      
      // Check if this is a group assignment
      if (selectedCourseForBatch._isGroupAssignment && selectedCourseForBatch._groupCourses) {
        console.log('[handleAssignBatch] GROUP assignment:', {
          groupName: selectedCourseForBatch._groupName,
          groupYear: selectedCourseForBatch._groupYear,
          groupTerm: selectedCourseForBatch._groupTerm,
          groupSemester: selectedCourseForBatch._groupSemester,
          courseCount: selectedCourseForBatch._groupCourses.length
        });
        
        // Assign batch to all courses in the group
        const promises = selectedCourseForBatch._groupCourses.map(course => {
          const y = Number.isInteger(course.yearLevel) ? course.yearLevel : selectedCourseForBatch._groupYear;
          const t = Number.isInteger(course.term) ? course.term : selectedCourseForBatch._groupTerm;
          const s = Number.isInteger(course.semester) ? course.semester : selectedCourseForBatch._groupSemester;
          
          console.log('[handleAssignBatch] assigning course:', {
            courseId: course._id,
            courseCode: course.courseCode,
            values: { y, s, t }
          });
          
          return assignBatchToCourse(
            course._id,
            normalizedBatch,
            deptCodeInput,
            y,
            s,
            t
          );
        });
        
        await Promise.all(promises);
        
        setBatchAssignmentSuccess(`Batch assigned to all ${selectedCourseForBatch._groupCourses.length} courses in ${selectedCourseForBatch._groupName}`);
        
        // Update the courses list for all assigned courses
        setCourses(prevCourses => 
          prevCourses.map(c => {
            const assignedCourse = selectedCourseForBatch._groupCourses.find(gc => gc._id === c._id);
            if (assignedCourse) {
              return { 
                ...c, 
                assignedBatches: [{ batch: normalizedBatch, deptCode: deptCodeInput }]
              };
            }
            return c;
          })
        );
        
        // Close modal after successful group assignment
        setTimeout(() => {
          setShowBatchAssignmentModal(false);
          setBatchAssignmentSuccess('');
        }, 2000);
      } else {
        // Single course assignment
        const response = await assignBatchToCourse(
          selectedCourseForBatch._id,
          normalizedBatch,
          deptCodeInput,
          selectedCourseForBatch.yearLevel,
          selectedCourseForBatch.semester,
          selectedCourseForBatch.term
        );
        console.log('Batch assignment response:', response);
        setBatchAssignmentSuccess('Batch assigned successfully');
        
        // Update local state
        setSelectedCourseForBatch(prev => ({
          ...prev,
          assignedBatches: response.data.assignedBatches
        }));

        // Also update the courses list
        setCourses(prevCourses => 
          prevCourses.map(c => 
            c._id === selectedCourseForBatch._id 
              ? { ...c, assignedBatches: response.data.assignedBatches }
              : c
          )
        );
      }

      // Clear inputs
      setBatchInput('');
      setDeptCodeInput('');
      
      setTimeout(() => setBatchAssignmentSuccess(''), 3000);
    } catch (err) {
      console.error('Batch assignment error:', err);
      setBatchAssignmentError(err.response?.data?.message || err.message || 'Failed to assign batch');
      setTimeout(() => setBatchAssignmentError(''), 5000);
    } finally {
      setBatchAssignmentLoading(false);
    }
  };

  // Handle unassign batch from course
  const handleUnassignBatch = async (batch, deptCode) => {
    setBatchAssignmentLoading(true);
    setBatchAssignmentError('');
    setBatchAssignmentSuccess('');

    try {
      const response = await unassignBatchFromCourse(selectedCourseForBatch._id, batch, deptCode);
      setBatchAssignmentSuccess('Batch unassigned successfully');
      
      // Update local state
      setSelectedCourseForBatch(prev => ({
        ...prev,
        assignedBatches: response.data.assignedBatches
      }));

      // Also update the courses list
      setCourses(prevCourses => 
        prevCourses.map(c => 
          c._id === selectedCourseForBatch._id 
            ? { ...c, assignedBatches: response.data.assignedBatches }
            : c
        )
      );

      setTimeout(() => setBatchAssignmentSuccess(''), 3000);
    } catch (err) {
      setBatchAssignmentError(err.response?.data?.message || 'Failed to unassign batch');
      setTimeout(() => setBatchAssignmentError(''), 5000);
    } finally {
      setBatchAssignmentLoading(false);
    }
  };

  // Handle remove all batch assignments from group
  const handleRemoveAllBatches = async () => {
    if (!selectedCourseForBatch._isGroupAssignment || !selectedCourseForBatch._groupCourses) {
      return;
    }

    if (!window.confirm(`Clear batch assignment from all ${selectedCourseForBatch._groupCourses.length} courses in ${selectedCourseForBatch._groupName}?`)) {
      return;
    }

    setBatchAssignmentLoading(true);
    setBatchAssignmentError('');
    setBatchAssignmentSuccess('');

    try {
      // Get all courses with their assigned batches
      const coursesWithBatches = selectedCourseForBatch._groupCourses.filter(
        course => course.assignedBatches && course.assignedBatches.length > 0
      );

      if (coursesWithBatches.length === 0) {
        setBatchAssignmentError('No batch assignment to remove');
        setTimeout(() => setBatchAssignmentError(''), 3000);
        return;
      }

      // Unassign batch from each course
      const promises = coursesWithBatches.flatMap(course =>
        course.assignedBatches.map(assignment =>
          unassignBatchFromCourse(course._id, assignment.batch, assignment.deptCode)
        )
      );

      await Promise.all(promises);

      setBatchAssignmentSuccess(`Cleared batch assignment from ${coursesWithBatches.length} course${coursesWithBatches.length !== 1 ? 's' : ''}`);

      // Update courses list to clear assignments
      setCourses(prevCourses =>
        prevCourses.map(c => {
          const unassignedCourse = coursesWithBatches.find(gc => gc._id === c._id);
          if (unassignedCourse) {
            return { ...c, assignedBatches: [] };
          }
          return c;
        })
      );

      // Close modal after successful removal
      setTimeout(() => {
        setShowBatchAssignmentModal(false);
        setBatchAssignmentSuccess('');
      }, 2000);
    } catch (err) {
      console.error('Remove all batches error:', err);
      setBatchAssignmentError(err.response?.data?.message || err.message || 'Failed to clear batch assignment');
      setTimeout(() => setBatchAssignmentError(''), 5000);
    } finally {
      setBatchAssignmentLoading(false);
    }
  };

  const handleViewProposal = async (proposalId) => {
    setLoading(true);
    try {
      const response = await getProposalById(proposalId);
      setSelectedProposal(response.data);
      setShowProposalDetail(true);
      setReviewComment('');
      setReviewError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch proposal details');
      setTimeout(() => setError(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  // Helper to render field comparison for UPDATE proposals
  const renderFieldComparison = (label, oldValue, newValue, formatter = (v) => v) => {
    const hasChanged = JSON.stringify(oldValue) !== JSON.stringify(newValue);
    
    if (!hasChanged) {
      return (
        <div className="detail-item">
          <strong>{label}:</strong> {formatter(newValue)}
        </div>
      );
    }

    return (
      <div className="detail-item" style={{backgroundColor: '#fff3cd', padding: '12px', borderRadius: '6px', border: '2px solid #ffc107'}}>
        <strong>{label}:</strong>
        <div style={{marginTop: '6px'}}>
          <div style={{
            color: '#dc3545',
            textDecoration: 'line-through',
            opacity: 0.7,
            marginBottom: '4px',
            fontSize: '14px'
          }}>
            <span style={{fontWeight: 600, marginRight: '6px'}}>Old:</span>{formatter(oldValue)}
          </div>
          <div style={{
            color: '#28a745',
            fontWeight: 600,
            fontSize: '14px',
            padding: '4px 8px',
            backgroundColor: '#d4edda',
            borderRadius: '4px',
            display: 'inline-block'
          }}>
            <span style={{marginRight: '6px'}}>New:</span>{formatter(newValue)}
          </div>
        </div>
      </div>
    );
  };

  // Helper to render array comparison (KPA, Prerequisites, Knowledge, Objectives)
  const renderArrayComparison = (title, oldArray = [], newArray = [], renderItem) => {
    const oldSet = new Set(oldArray.map(item => JSON.stringify(item)));
    const newSet = new Set(newArray.map(item => JSON.stringify(item)));
    
    const removed = oldArray.filter(item => !newSet.has(JSON.stringify(item)));
    const added = newArray.filter(item => !oldSet.has(JSON.stringify(item)));
    const unchanged = newArray.filter(item => oldSet.has(JSON.stringify(item)));
    
    const hasChanges = removed.length > 0 || added.length > 0;

    return (
      <div style={{marginTop: '20px'}}>
        <h4>{title} {hasChanges && <span style={{color: '#ffc107', fontSize: '14px', marginLeft: '8px'}}>✦ Modified</span>}</h4>
        {hasChanges && (
          <div style={{
            backgroundColor: '#fff3cd',
            padding: '12px',
            borderRadius: '6px',
            border: '2px solid #ffc107',
            marginTop: '10px'
          }}>
            {removed.length > 0 && (
              <div style={{marginBottom: removed.length > 0 && added.length > 0 ? '12px' : '0'}}>
                <div style={{color: '#dc3545', fontWeight: 600, marginBottom: '6px', fontSize: '14px'}}>🗑 Removed:</div>
                {removed.map((item, idx) => renderItem(item, idx, 'removed'))}
              </div>
            )}
            {added.length > 0 && (
              <div>
                <div style={{color: '#28a745', fontWeight: 600, marginBottom: '6px', fontSize: '14px'}}>✅ Added:</div>
                {added.map((item, idx) => renderItem(item, idx, 'added'))}
              </div>
            )}
          </div>
        )}
        {unchanged.length > 0 && (
          <div style={{marginTop: hasChanges ? '12px' : '10px'}}>
            <div style={{color: '#666', fontWeight: 500, marginBottom: '6px', fontSize: '13px'}}>Unchanged:</div>
            {unchanged.map((item, idx) => renderItem(item, idx, 'unchanged'))}
          </div>
        )}
      </div>
    );
  };

  // Helper to render Course Outcomes comparison with table highlighting
  const renderCourseOutcomesComparison = (oldCOs = [], newCOs = []) => {
    const oldCoMap = new Map(oldCOs.map(co => [co.co_code, co]));
    const newCoMap = new Map(newCOs.map(co => [co.co_code, co]));
    
    const allCoCodes = new Set([...oldCoMap.keys(), ...newCoMap.keys()]);
    const changes = [];
    
    // Helper to deeply compare CO objects
    const areCOsEqual = (co1, co2) => {
      if (!co1 || !co2) return false;
      // Compare description
      if (co1.description !== co2.description) return false;
      // Compare PO mappings - need to compare both code and level
      const po1Sorted = (co1.po_mappings || []).sort((a, b) => a.program_outcome_code.localeCompare(b.program_outcome_code));
      const po2Sorted = (co2.po_mappings || []).sort((a, b) => a.program_outcome_code.localeCompare(b.program_outcome_code));
      if (po1Sorted.length !== po2Sorted.length) return false;
      for (let i = 0; i < po1Sorted.length; i++) {
        if (po1Sorted[i].program_outcome_code !== po2Sorted[i].program_outcome_code ||
            po1Sorted[i].mapping_level !== po2Sorted[i].mapping_level) {
          return false;
        }
      }
      // Compare taxonomy levels
      const tax1 = (co1.taxonomy_levels || []).sort().join(',');
      const tax2 = (co2.taxonomy_levels || []).sort().join(',');
      if (tax1 !== tax2) return false;
      return true;
    };
    
    allCoCodes.forEach(code => {
      const oldCO = oldCoMap.get(code);
      const newCO = newCoMap.get(code);
      
      if (!oldCO) {
        changes.push({ type: 'added', co: newCO });
      } else if (!newCO) {
        changes.push({ type: 'removed', co: oldCO });
      } else if (!areCOsEqual(oldCO, newCO)) {
        changes.push({ type: 'modified', oldCO, newCO });
      } else {
        changes.push({ type: 'unchanged', co: newCO });
      }
    });
    
    const hasChanges = changes.some(c => c.type !== 'unchanged');
    
    return (
      <div style={{marginTop: '20px'}}>
        <h4>Course Outcomes ({newCOs.length}) {hasChanges && <span style={{color: '#ffc107', fontSize: '14px', marginLeft: '8px'}}>✦ Modified</span>}</h4>
        <div style={{marginTop: '10px', overflowX: 'auto'}}>
          <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '13px'}}>
            <thead>
              <tr style={{backgroundColor: '#f5f5f5'}}>
                <th style={{padding: '8px', border: '1px solid #ddd', textAlign: 'left'}}>CO</th>
                <th style={{padding: '8px', border: '1px solid #ddd', textAlign: 'left'}}>Description</th>
                <th style={{padding: '8px', border: '1px solid #ddd', textAlign: 'left'}}>PO Mappings</th>
                <th style={{padding: '8px', border: '1px solid #ddd', textAlign: 'left'}}>Taxonomy</th>
              </tr>
            </thead>
            <tbody>
              {changes.map((change, idx) => {
                const co = change.co || change.newCO || change.oldCO;
                const bgColor = change.type === 'removed' ? '#f8d7da' : 
                               change.type === 'added' ? '#d4edda' : 
                               change.type === 'modified' ? '#fff3cd' : 'transparent';
                
                return (
                  <tr key={idx} style={{backgroundColor: bgColor}}>
                    <td style={{padding: '8px', border: '1px solid #ddd'}}>{co.co_code}</td>
                    <td style={{padding: '8px', border: '1px solid #ddd'}}>
                      {change.type === 'modified' && change.oldCO.description !== change.newCO.description ? (
                        <>
                          <div style={{color: '#dc3545', textDecoration: 'line-through', marginBottom: '4px'}}>{change.oldCO.description}</div>
                          <div style={{color: '#28a745', fontWeight: 600}}>{change.newCO.description}</div>
                        </>
                      ) : co.description}
                    </td>
                    <td style={{padding: '8px', border: '1px solid #ddd'}}>
                      {change.type === 'modified' ? (
                        (() => {
                          // Compare PO mappings properly
                          const oldPOsSorted = (change.oldCO.po_mappings || []).sort((a, b) => a.program_outcome_code.localeCompare(b.program_outcome_code));
                          const newPOsSorted = (change.newCO.po_mappings || []).sort((a, b) => a.program_outcome_code.localeCompare(b.program_outcome_code));
                          
                          let posChanged = false;
                          if (oldPOsSorted.length !== newPOsSorted.length) {
                            posChanged = true;
                          } else {
                            for (let i = 0; i < oldPOsSorted.length; i++) {
                              if (oldPOsSorted[i].program_outcome_code !== newPOsSorted[i].program_outcome_code ||
                                  oldPOsSorted[i].mapping_level !== newPOsSorted[i].mapping_level) {
                                posChanged = true;
                                break;
                              }
                            }
                          }
                          
                          if (posChanged) {
                            return (
                              <>
                                <div style={{color: '#dc3545', textDecoration: 'line-through', marginBottom: '4px'}}>
                                  {change.oldCO.po_mappings && change.oldCO.po_mappings.length > 0 
                                    ? change.oldCO.po_mappings.map(m => {
                                        const letter = m.program_outcome_code.split('_')[1]?.toLowerCase() || '';
                                        return `PO(${letter})`;
                                      }).join(', ')
                                    : '-'
                                  }
                                </div>
                                <div style={{color: '#28a745', fontWeight: 600}}>
                                  {change.newCO.po_mappings && change.newCO.po_mappings.length > 0 
                                    ? change.newCO.po_mappings.map(m => {
                                        const letter = m.program_outcome_code.split('_')[1]?.toLowerCase() || '';
                                        return `PO(${letter})`;
                                      }).join(', ')
                                    : '-'
                                  }
                                </div>
                              </>
                            );
                          } else {
                            return (
                              <>
                                {co.po_mappings && co.po_mappings.length > 0 
                                  ? co.po_mappings.map(m => {
                                      const letter = m.program_outcome_code.split('_')[1]?.toLowerCase() || '';
                                      return `PO(${letter})`;
                                    }).join(', ')
                                  : '-'
                                }
                              </>
                            );
                          }
                        })()
                      ) : (
                        <>
                          {co.po_mappings && co.po_mappings.length > 0 
                            ? co.po_mappings.map(m => {
                                const letter = m.program_outcome_code.split('_')[1]?.toLowerCase() || '';
                                return `PO(${letter})`;
                              }).join(', ')
                            : '-'
                          }
                        </>
                      )}
                    </td>
                    <td style={{padding: '8px', border: '1px solid #ddd'}}>
                      {change.type === 'modified' ? (
                        <>
                          {(change.oldCO.taxonomy_levels || []).sort().join(', ') !== (change.newCO.taxonomy_levels || []).sort().join(', ') && (
                            <>
                              <div style={{color: '#dc3545', textDecoration: 'line-through', marginBottom: '4px'}}>
                                {change.oldCO.taxonomy_levels && change.oldCO.taxonomy_levels.length > 0 ? change.oldCO.taxonomy_levels.join(', ') : '-'}
                              </div>
                              <div style={{color: '#28a745', fontWeight: 600}}>
                                {change.newCO.taxonomy_levels && change.newCO.taxonomy_levels.length > 0 ? change.newCO.taxonomy_levels.join(', ') : '-'}
                              </div>
                            </>
                          )}
                          {(change.oldCO.taxonomy_levels || []).sort().join(', ') === (change.newCO.taxonomy_levels || []).sort().join(', ') && (
                            <>{co.taxonomy_levels && co.taxonomy_levels.length > 0 ? co.taxonomy_levels.join(', ') : '-'}</>
                          )}
                        </>
                      ) : (
                        <>{co.taxonomy_levels && co.taxonomy_levels.length > 0 ? co.taxonomy_levels.join(', ') : '-'}</>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // Helper to render Lecture Plan comparison with highlighting
  const renderLecturePlanComparison = (oldPlan = [], newPlan = []) => {
    const oldPlanMap = new Map(oldPlan.map(lec => [lec.week, lec.plan]));
    const newPlanMap = new Map(newPlan.map(lec => [lec.week, lec.plan]));
    
    const allWeeks = new Set([...oldPlanMap.keys(), ...newPlanMap.keys()]);
    const changes = Array.from(allWeeks).sort((a, b) => a - b).map(week => {
      const oldPlan = oldPlanMap.get(week);
      const newPlan = newPlanMap.get(week);
      
      if (!oldPlan) return { type: 'added', week, plan: newPlan };
      if (!newPlan) return { type: 'removed', week, plan: oldPlan };
      if (oldPlan !== newPlan) return { type: 'modified', week, oldPlan, newPlan };
      return { type: 'unchanged', week, plan: newPlan };
    });
    
    const hasChanges = changes.some(c => c.type !== 'unchanged');
    
    return (
      <div style={{marginTop: '20px'}}>
        <h4>Lecture Plan {hasChanges && <span style={{color: '#ffc107', fontSize: '14px', marginLeft: '8px'}}>✦ Modified</span>}</h4>
        <div style={{marginTop: '10px', overflowX: 'auto'}}>
          <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '13px'}}>
            <thead>
              <tr style={{backgroundColor: '#f5f5f5'}}>
                <th style={{padding: '8px', border: '1px solid #ddd', width: '80px'}}>Week</th>
                <th style={{padding: '8px', border: '1px solid #ddd', textAlign: 'left'}}>Plan</th>
              </tr>
            </thead>
            <tbody>
              {changes.map((change, idx) => {
                const bgColor = change.type === 'removed' ? '#f8d7da' : 
                               change.type === 'added' ? '#d4edda' : 
                               change.type === 'modified' ? '#fff3cd' : 'transparent';
                
                return (
                  <tr key={idx} style={{backgroundColor: bgColor}}>
                    <td style={{padding: '8px', border: '1px solid #ddd', textAlign: 'center'}}>Week {change.week}</td>
                    <td style={{padding: '8px', border: '1px solid #ddd'}}>
                      {change.type === 'modified' ? (
                        <>
                          <div style={{color: '#dc3545', textDecoration: 'line-through', marginBottom: '4px'}}>{change.oldPlan}</div>
                          <div style={{color: '#28a745', fontWeight: 600}}>{change.newPlan}</div>
                        </>
                      ) : change.plan}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const handleApproveProposal = async () => {
    if (!selectedProposal) return;
    
    setLoading(true);
    setReviewError('');
    try {
      await approveProposal(selectedProposal._id, reviewComment);
      setSuccessMessage('Course proposal approved successfully');
      setShowProposalDetail(false);
      setSelectedProposal(null);
      fetchProposals();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      // Surface meaningful error messages from service (which throws data objects)
      const msg = err?.message || err?.error || err?.response?.data?.message || 'Failed to approve proposal';
      setError(msg);
      setTimeout(() => setError(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleRejectProposal = async () => {
    if (!selectedProposal || !reviewComment.trim()) {
      setReviewError('Please provide a reason for rejection');
      return;
    }
    
    setLoading(true);
    try {
      await rejectProposal(selectedProposal._id, reviewComment);
      setSuccessMessage('Course proposal rejected');
      setShowProposalDetail(false);
      setSelectedProposal(null);
      fetchProposals();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      const msg = err?.message || err?.error || err?.response?.data?.message || 'Failed to reject proposal';
      setReviewError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const renderSection = () => {
    switch (activeSection) {
      case 'pending':
        return (
          <div className="section-container">
            <div className="section-header">
              <h2>Pending User Approvals</h2>
              <p>Review and approve new user registrations</p>
            </div>
            <div className="section-body">
              {successMessage && (
                <div className="alert alert-success">
                  {successMessage}
                </div>
              )}

              {error && (
                <div className="alert alert-error">
                  {error}
                </div>
              )}

              {loading ? (
                <div className="loading-container">
                  <div className="spinner spinner-large"></div>
                  <p>Loading pending users...</p>
                </div>
              ) : pendingUsers.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon"><FontAwesomeIcon icon={faCheck} /></div>
                  <h3>No Pending Approvals</h3>
                  <p>All user registrations have been processed</p>
                </div>
              ) : (
                <div className="users-grid">
                  {pendingUsers.map((pendingUser) => (
                    <div key={pendingUser._id} className="user-card">
                      <div className="user-card-header">
                        <div className="user-avatar">
                          {pendingUser.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="user-info">
                          <h3>{pendingUser.name}</h3>
                          <p className="user-email">{pendingUser.email}</p>
                        </div>
                      </div>
                      <div className="user-card-body">
                        <div className="user-meta">
                          <span className={`role-badge ${pendingUser.role}`}>
                            {pendingUser.role}
                          </span>
                          <span className="user-date">
                            Registered: {new Date(pendingUser.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="user-status">
                          <span className={`status-badge ${pendingUser.isEmailVerified ? 'verified' : 'unverified'}`}>
                            Email: {pendingUser.isEmailVerified ? 'Verified' : 'Not Verified'}
                          </span>
                        </div>
                      </div>
                      <div className="user-card-actions">
                        <button 
                          className="btn btn-approve"
                          onClick={() => handleApprove(pendingUser._id)}
                        >
                          Approve
                        </button>
                        <button 
                          className="btn btn-reject"
                          onClick={() => handleReject(pendingUser._id)}
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );

      case 'proposals':
        return (
          <div className="section-container">
            <div className="section-header">
              <h2>Course Proposals</h2>
              <p>Review and approve course creation and update requests from teachers</p>
            </div>
            <div className="section-body">
              {successMessage && (
                <div className="alert alert-success">
                  {successMessage}
                </div>
              )}

              {error && (
                <div className="alert alert-error">
                  {error}
                </div>
              )}

              {loading && !showProposalDetail ? (
                <div className="loading-container">
                  <div className="spinner spinner-large"></div>
                  <p>Loading proposals...</p>
                </div>
              ) : proposals.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon"><FontAwesomeIcon icon={faClipboardList} /></div>
                  <h3>No Pending Proposals</h3>
                  <p>All proposals have been processed</p>
                </div>
              ) : (
                <div className="proposals-grid">
                  {proposals.map((proposal) => (
                    <div key={proposal._id} className="proposal-card">
                      <div className="proposal-header">
                        <span className={`proposal-type-badge ${proposal.proposalType.toLowerCase()}`}>
                          {proposal.proposalType}
                        </span>
                        <span className={`status-badge status-${proposal.status.toLowerCase()}`}>
                          {proposal.status}
                        </span>
                      </div>
                      <div className="proposal-body">
                        <h3>{proposal.proposedData.courseCode} - {proposal.proposedData.courseTitle}</h3>
                        <div className="proposal-meta">
                          <p><strong>Proposed by:</strong> {proposal.proposedBy?.name || 'Unknown'}</p>
                          <p><strong>Date:</strong> {new Date(proposal.createdAt).toLocaleDateString()}</p>
                          {proposal.proposalType === 'UPDATE' && proposal.existingCourse && (
                            <p><strong>Existing Course:</strong> {proposal.existingCourse.courseCode}</p>
                          )}
                        </div>
                        {proposal.changeDescription && (
                          <div className="proposal-description">
                            <strong>Description:</strong>
                            <p>{proposal.changeDescription}</p>
                          </div>
                        )}
                      </div>
                      <div className="proposal-actions">
                        <button 
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleViewProposal(proposal._id)}
                        >
                          View Details
                        </button>
                        {proposal.status === 'PENDING' && (
                          <>
                            <button 
                              className="btn btn-approve btn-sm"
                              onClick={() => handleViewProposal(proposal._id)}
                            >
                              <FontAwesomeIcon icon={faCheck} /> Review
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );

      case 'courses':
        const organizedCourses = getOrganizedCourses();
        const yearSemKeys = Object.keys(organizedCourses).sort((a, b) => {
          const [aYear, aSem] = a.split('-').map(Number);
          const [bYear, bSem] = b.split('-').map(Number);
          if (aYear !== bYear) return aYear - bYear;
          return aSem - bSem;
        });

        return (
          <div className="section-container">
            <div className="section-header">
              <div className="header-content">
                <h2>Course Management</h2>
                <p className="header-subtitle">Manage course catalog and outcomes</p>
              </div>
              <button
                className="btn btn-primary"
                onClick={() => setShowCourseForm(true)}
              >
                <FontAwesomeIcon icon={faPlus} /> Create New Course
              </button>
            </div>
            <div className="section-body">
              {successMessage && (
                <div className="alert alert-success">
                  <span className="alert-icon"><FontAwesomeIcon icon={faCheck} /></span>
                  {successMessage}
                </div>
              )}

              {error && (
                <div className="alert alert-error">
                  <span className="alert-icon"><FontAwesomeIcon icon={faTimes} /></span>
                  {error}
                </div>
              )}

              {loading ? (
                <div className="loading-container">
                  <div className="spinner spinner-large"></div>
                  <p>Loading courses...</p>
                </div>
              ) : courses.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon"><FontAwesomeIcon icon={faBookOpen} /></div>
                  <h3>No Courses Yet</h3>
                  <p>Create your first course to get started</p>
                  <button
                    className="btn btn-primary"
                    onClick={() => setShowCourseForm(true)}
                  >
                    Create First Course
                  </button>
                </div>
              ) : (
                <div className="courses-tree">
                  {courseGroupPath && (
                    <div className="breadcrumb-nav">
                      <button className="breadcrumb-btn" onClick={goBackGroup}>← Back</button>
                    </div>
                  )}

                  {!courseGroupPath ? (
                    <div className="tree-group">
                      {yearSemKeys.map((yearSemKey) => (
                        <button
                          key={yearSemKey}
                          className="tree-header tree-year-header"
                          onClick={() => navigateToGroup(yearSemKey)}
                        >
                          <FontAwesomeIcon icon={faChevronRight} />
                          <span>{yearSemKey}</span>
                        </button>
                      ))}
                    </div>
                  ) : organizedCourses[courseGroupPath] ? (
                    (() => {
                      const types = Object.keys(organizedCourses[courseGroupPath] || {});
                      const allCoursesInGroup = types.flatMap(type => organizedCourses[courseGroupPath][type]);
                      return (
                        <>
                          <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <button
                              className="btn btn-sm"
                              style={{
                                backgroundColor: '#10b981',
                                color: 'white',
                                border: 'none'
                              }}
                              onClick={() => {
                                if (allCoursesInGroup.length > 0) {
                                  const parts = String(courseGroupPath).split('-');
                                  const grpYear = parseInt(parts[0], 10);
                                  const grpTerm = parseInt(parts[1], 10);
                                  const grpSemester = Number.isInteger(grpYear) && Number.isInteger(grpTerm) ? ((grpYear - 1) * 2 + grpTerm) : undefined;
                                  openBatchAssignmentModal({ 
                                    ...allCoursesInGroup[0], 
                                    _isGroupAssignment: true,
                                    _groupCourses: allCoursesInGroup,
                                    _groupName: `${courseGroupPath} - All Courses`,
                                    _groupYear: grpYear,
                                    _groupTerm: grpTerm,
                                    _groupSemester: grpSemester
                                  });
                                }
                              }}
                            >
                              <FontAwesomeIcon icon={faUsers} /> Assign {courseGroupPath} to Batch
                            </button>
                            <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                              ({allCoursesInGroup.length} course{allCoursesInGroup.length !== 1 ? 's' : ''})
                            </span>
                          </div>
                          <div className="tree-group">
                            {types.map((type) => {
                              const typeCourses = organizedCourses[courseGroupPath][type];
                              const typeLabel = type === 'THEORY' ? 'Theory' : type === 'SESSIONAL' ? 'Sessional' : 'Project/Thesis';
                              return (
                                <button
                                  key={`${courseGroupPath}-${type}`}
                                  className="tree-header tree-type-header"
                                  onClick={() => navigateToGroup(`${courseGroupPath}-${type}`)}
                                >
                                  <FontAwesomeIcon icon={faChevronRight} />
                                  <span>{typeLabel} ({typeCourses.length})</span>
                                </button>
                              );
                            })}
                          </div>
                        </>
                      );
                    })()
                  ) : courseGroupPath.includes('-') ? (
                    (() => {
                      const parts = courseGroupPath.split('-');
                      const yearSem = `${parts[0]}-${parts[1]}`;
                      const type = parts[2];
                      const typeCourses = organizedCourses[yearSem]?.[type] || [];
                      return (
                        <div className="tree-content">
                            {typeCourses.map((course) => (
                              <div key={course._id} className="course-item">
                                <div className="course-item-header">
                                  <div className="course-info">
                                    <span className="course-code">{course.courseCode}</span>
                                    <span className="course-credit">{course.credit} Cr</span>
                                    {course.assignedTeachers && course.assignedTeachers.length > 0 && (
                                      <span className="course-assigned" style={{ 
                                        fontSize: '12px', 
                                        color: '#059669', 
                                        backgroundColor: '#d1fae5',
                                        padding: '2px 8px',
                                        borderRadius: '4px',
                                        marginLeft: '8px'
                                      }}>
                                        <FontAwesomeIcon icon={faUsers} /> {course.assignedTeachers.length} Teacher{course.assignedTeachers.length !== 1 ? 's' : ''}
                                      </span>
                                    )}
                                    <span className="course-title">{course.courseTitle}</span>
                                  </div>
                                </div>
                                <div className="course-item-actions">
                                  <button
                                    className="btn btn-sm btn-secondary"
                                    onClick={() => {
                                      setSelectedCourse(course);
                                      // Extract semester from courseGroupPath (e.g., "3-1" -> 1, "3-2" -> 2)
                                      const semesterMatch = courseGroupPath ? courseGroupPath.split('-')[1] : null;
                                      setShowOBEView(semesterMatch ? parseInt(semesterMatch) : true);
                                    }}
                                  >
                                    <FontAwesomeIcon icon={faEye} /> View
                                  </button>
                                  <button
                                    className="btn btn-sm"
                                    style={{
                                      backgroundColor: '#8b5cf6',
                                      color: 'white',
                                      border: 'none'
                                    }}
                                    onClick={() => openAssignmentModal(course)}
                                  >
                                    <FontAwesomeIcon icon={faUsers} /> Assign Teachers
                                  </button>
                                  <button
                                    className="btn btn-sm btn-primary"
                                    onClick={() => {
                                      setEditingCourse(course);
                                      setShowCourseForm(true);
                                    }}
                                  >
                                    <FontAwesomeIcon icon={faEdit} /> Edit
                                  </button>
                                  <button
                                    className="btn btn-sm btn-danger"
                                    onClick={() => openDeleteModal(course)}
                                  >
                                    <FontAwesomeIcon icon={faTrash} /> Delete
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                      );
                    })()
                  ) : null}
                </div>
              )}
            </div>
          </div>
        );

      case 'users':
        // Group users by role and support drill-down view
        const groupedUsers = [
          { role: 'teacher', members: users.filter(u => (u.role || '').toLowerCase() === 'teacher') },
          { role: 'student', members: users.filter(u => (u.role || '').toLowerCase() === 'student') },
        ];

        return (
          <div className="section-container">
            <div className="section-header">
              <h2>All Users</h2>
              <p>Manage all registered users</p>
            </div>
            <div className="section-body">
              {usersError && <div className="alert alert-error">{usersError}</div>}

              {usersLoading ? (
                <div className="loading-container">
                  <div className="spinner spinner-large"></div>
                  <p>Loading users...</p>
                </div>
              ) : selectedUserRole ? (
                <div>
                  <div className="breadcrumb-nav" style={{marginBottom: '12px'}}>
                    <button className="breadcrumb-btn" onClick={goBackUserGroups}>← Back</button>
                  </div>
                  {selectedUserRole === 'student' && (
                    <>
                      <div className="proposal-card" style={{ marginBottom: '16px' }}>
                        <div className="proposal-header" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <h3 style={{ margin: 0, fontSize: '16px' }}>Import Students from Excel</h3>
                            <p style={{ margin: '6px 0 0', color: '#6b7280', fontSize: '13px' }}>Columns: Roll, Name, Advisor, Father, Mother, Hall, Scholarship</p>
                          </div>
                        </div>
                        <div className="proposal-body" style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                          <input
                            type="file"
                            accept=".xlsx,.xls"
                            onChange={(e) => {
                              setImportFile(e.target.files[0] || null);
                              setImportError('');
                              setImportMessage('');
                            }}
                          />
                          <button
                            className="btn btn-primary"
                            onClick={handleImportStudents}
                            disabled={importLoading}
                          >
                            {importLoading ? 'Importing...' : 'Import Students'}
                          </button>
                        </div>
                        {(importMessage || importError) && (
                          <div style={{ marginTop: '10px' }}>
                            {importMessage && <div className="alert alert-success">{importMessage}</div>}
                            {importError && <div className="alert alert-error">{importError}</div>}
                          </div>
                        )}
                      </div>

                      <div className="proposal-card" style={{ marginBottom: '16px' }}>
                        <div className="proposal-header" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <h3 style={{ margin: 0, fontSize: '16px' }}>Export Student Credentials</h3>
                            <p style={{ margin: '6px 0 0', color: '#6b7280', fontSize: '13px' }}>Export emails and current passwords for a specific batch and department</p>
                          </div>
                        </div>
                        <div className="proposal-body" style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                          <select
                            value={exportBatchYear}
                            onChange={(e) => {
                              setExportBatchYear(e.target.value);
                              setExportError('');
                              setExportMessage('');
                            }}
                            style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '4px', width: '180px' }}
                          >
                            <option value="">Select Batch Year</option>
                            {availableStudentBatches.map((batch) => (
                              <option key={batch} value={String(batch)}>{batch}</option>
                            ))}
                          </select>
                          <select
                            value={exportDeptCode}
                            onChange={(e) => {
                              setExportDeptCode(e.target.value);
                              setExportError('');
                              setExportMessage('');
                            }}
                            style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '4px', width: '200px' }}
                          >
                            <option value="">Select Department</option>
                            <option value="07">CSE-07</option>
                            <option value="03">EEE-03</option>
                            <option value="05">ME-05</option>
                            <option value="01">CE-01</option>
                            <option value="09">ECE-09</option>
                            <option value="11">IEM-11</option>
                            <option value="13">ESE-13</option>
                            <option value="15">BME-15</option>
                            <option value="17">URP-17</option>
                            <option value="19">LE-19</option>
                            <option value="27">MSE-27</option>
                            <option value="31">MTE-31</option>
                            <option value="23">BECM-23</option>
                            <option value="25">ARCH-25</option>
                            <option value="21">TE-21</option>
                            <option value="29">CHE-29</option>
                          </select>
                          <button
                            className="btn btn-primary"
                            onClick={handleExportCredentials}
                            disabled={exportLoading}
                          >
                            {exportLoading ? 'Exporting...' : 'Export Credentials'}
                          </button>
                        </div>
                        {(exportMessage || exportError) && (
                          <div style={{ marginTop: '10px' }}>
                            {exportMessage && <div className="alert alert-success">{exportMessage}</div>}
                            {exportError && <div className="alert alert-error">{exportError}</div>}
                          </div>
                        )}
                      </div>

                      {/* Student Filters */}
                      <div className="proposal-card" style={{ marginBottom: '16px' }}>
                        <div className="proposal-header" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <h3 style={{ margin: 0, fontSize: '16px' }}>Filter Students</h3>
                            <p style={{ margin: '6px 0 0', color: '#6b7280', fontSize: '13px' }}>Search by name, email, or roll; filter by department and batch</p>
                          </div>
                        </div>
                        <div className="proposal-body" style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                          <input
                            type="text"
                            placeholder="Search by name, email, or roll..."
                            value={userSearchText}
                            onChange={(e) => setUserSearchText(e.target.value)}
                            style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '4px', minWidth: '250px', flex: '1 1 250px' }}
                          />
                          <select
                            value={studentFilterDept}
                            onChange={(e) => setStudentFilterDept(e.target.value)}
                            style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '4px', minWidth: '200px' }}
                          >
                            <option value="">All Departments</option>
                            {availableStudentDepartments.map((dept) => (
                              <option key={dept} value={dept}>{dept}</option>
                            ))}
                          </select>
                          <select
                            value={studentFilterBatch}
                            onChange={(e) => setStudentFilterBatch(e.target.value)}
                            style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '4px', minWidth: '200px' }}
                          >
                            <option value="">All Batches</option>
                            {availableStudentBatches.map((b) => (
                              <option key={b} value={String(b)}>{b}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </>
                  )}
                  {selectedUserRole === 'teacher' && (
                    <>
                      {teacherImportMessage && (
                        <div className="alert alert-success" style={{ marginBottom: '16px' }}>
                          {teacherImportMessage}
                        </div>
                      )}

                      {teacherImportError && (
                        <div className="alert alert-error" style={{ marginBottom: '16px' }}>
                          {teacherImportError}
                        </div>
                      )}

                      <div className="proposal-card" style={{ marginBottom: '16px' }}>
                        <div className="proposal-header" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <h3 style={{ margin: 0, fontSize: '16px' }}>Import Teachers from Excel</h3>
                            <p style={{ margin: '6px 0 0', color: '#6b7280', fontSize: '13px' }}>Columns: Full Name, Name (for email), Dept, Designation</p>
                          </div>
                        </div>
                        <div className="proposal-body" style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                          <input
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            onChange={(e) => {
                              setTeacherImportFile(e.target.files?.[0] || null);
                              setTeacherImportError('');
                              setTeacherImportMessage('');
                            }}
                            disabled={teacherImportLoading}
                          />
                          <button
                            className="btn btn-primary"
                            onClick={handleImportTeachers}
                            disabled={teacherImportLoading || !teacherImportFile}
                          >
                            {teacherImportLoading ? 'Importing...' : 'Import Teachers'}
                          </button>
                        </div>
                      </div>

                      <div className="proposal-card" style={{ marginBottom: '16px' }}>
                        <div className="proposal-header" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <h3 style={{ margin: 0, fontSize: '16px' }}>Export Teacher Credentials</h3>
                            <p style={{ margin: '6px 0 0', color: '#6b7280', fontSize: '13px' }}>Select a department and export teacher emails and current passwords</p>
                          </div>
                        </div>
                        <div className="proposal-body" style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                          <select
                            value={teacherExportDept}
                            onChange={(e) => {
                              setTeacherExportDept(e.target.value);
                              setTeacherExportError('');
                              setTeacherExportMessage('');
                            }}
                            style={{
                              padding: '8px 12px',
                              borderRadius: '6px',
                              border: '1px solid #d1d5db',
                              fontSize: '14px',
                              minWidth: '200px'
                            }}
                            disabled={teacherExportLoading}
                          >
                            <option value="">-- Select Department --</option>
                            {availableDepartments.map(dept => (
                              <option key={dept} value={dept}>{dept}</option>
                            ))}
                          </select>
                          <button
                            className="btn btn-primary"
                            onClick={handleExportTeachers}
                            disabled={teacherExportLoading || !teacherExportDept}
                          >
                            {teacherExportLoading ? 'Exporting...' : 'Export Credentials'}
                          </button>
                        </div>
                        {(teacherExportMessage || teacherExportError) && (
                          <div style={{ marginTop: '10px' }}>
                            {teacherExportMessage && <div className="alert alert-success">{teacherExportMessage}</div>}
                            {teacherExportError && <div className="alert alert-error">{teacherExportError}</div>}
                          </div>
                        )}
                      </div>

                      {/* Teacher Filters */}
                      <div className="proposal-card" style={{ marginBottom: '16px' }}>
                        <div className="proposal-header" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <h3 style={{ margin: 0, fontSize: '16px' }}>Filter Teachers</h3>
                            <p style={{ margin: '6px 0 0', color: '#6b7280', fontSize: '13px' }}>Search by name or email; filter by department and designation</p>
                          </div>
                        </div>
                        <div className="proposal-body" style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                          <input
                            type="text"
                            placeholder="Search by name or email..."
                            value={userSearchText}
                            onChange={(e) => setUserSearchText(e.target.value)}
                            style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '4px', minWidth: '250px', flex: '1 1 250px' }}
                          />
                          <select
                            value={teacherFilterDept}
                            onChange={(e) => setTeacherFilterDept(e.target.value)}
                            style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '4px', minWidth: '200px' }}
                          >
                            <option value="">All Departments</option>
                            {availableTeacherDepartments.map((dept) => (
                              <option key={dept} value={dept}>{dept}</option>
                            ))}
                          </select>
                          <select
                            value={teacherFilterDesignation}
                            onChange={(e) => setTeacherFilterDesignation(e.target.value)}
                            style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '4px', minWidth: '200px' }}
                          >
                            <option value="">All Designations</option>
                            <option value="Professor">Professor</option>
                            <option value="Assistant Professor">Assistant Professor</option>
                            <option value="Lecturer">Lecturer</option>
                          </select>
                        </div>
                      </div>
                    </>
                  )}

                  {/* User List */}
                  <div className="user-groups-container" style={{ marginTop: '20px' }}>
                    <h3 style={{ fontSize: '24px', marginBottom: '16px', textTransform: 'capitalize', fontWeight: '700' }}>
                      {selectedUserRole}s ({users.filter(u => {
                        if ((u.role || '').toLowerCase() !== selectedUserRole) return false;
                        // Text search filter
                        if (userSearchText) {
                          const searchLower = userSearchText.toLowerCase();
                          const nameMatch = (u.name || '').toLowerCase().includes(searchLower);
                          const emailMatch = (u.email || '').toLowerCase().includes(searchLower);
                          const rollMatch = selectedUserRole === 'student' && (u.roll || '').toLowerCase().includes(searchLower);
                          if (!nameMatch && !emailMatch && !rollMatch) return false;
                        }
                        if (selectedUserRole === 'teacher') {
                          if (teacherFilterDept && (u.department || '').toLowerCase() !== teacherFilterDept.toLowerCase()) return false;
                          if (teacherFilterDesignation && (u.designation || '').toLowerCase() !== teacherFilterDesignation.toLowerCase()) return false;
                        } else if (selectedUserRole === 'student') {
                          if (studentFilterDept) {
                            let userDept = u.department || '';
                            // Extract from roll if department not set
                            if (!userDept && u.roll) {
                              const rollDigits = String(u.roll).replace(/\D/g, '');
                              if (rollDigits.length >= 4) {
                                const deptCode = rollDigits.substring(2, 4);
                                userDept = departmentMap[deptCode] || '';
                              }
                            }
                            if (userDept.toLowerCase() !== studentFilterDept.toLowerCase()) return false;
                          }
                          if (studentFilterBatch) {
                            const rollDigits = String(u.roll || '').replace(/\D/g, '');
                            const prefix = rollDigits.slice(0, 2);
                            const batchFromRoll = prefix ? `20${prefix}` : '';
                            if (String(studentFilterBatch) !== batchFromRoll) return false;
                          }
                        }
                        return true;
                      }).length})
                    </h3>

                    <div style={selectedUserRole === 'teacher' ? { display: 'block' } : {}}>
                      {Object.entries(
                        users
                          .filter(u => {
                            if ((u.role || '').toLowerCase() !== selectedUserRole) return false;
                            // Text search filter
                            if (userSearchText) {
                              const searchLower = userSearchText.toLowerCase();
                              const nameMatch = (u.name || '').toLowerCase().includes(searchLower);
                              const emailMatch = (u.email || '').toLowerCase().includes(searchLower);
                              const rollMatch = selectedUserRole === 'student' && (u.roll || '').toLowerCase().includes(searchLower);
                              if (!nameMatch && !emailMatch && !rollMatch) return false;
                            }
                            // Apply role-specific filters only
                            if (selectedUserRole === 'teacher') {
                              if (teacherFilterDept && (u.department || '').toLowerCase() !== teacherFilterDept.toLowerCase()) return false;
                              if (teacherFilterDesignation && (u.designation || '').toLowerCase() !== teacherFilterDesignation.toLowerCase()) return false;
                            } else if (selectedUserRole === 'student') {
                              if (studentFilterDept) {
                                let userDept = u.department || '';
                                // Extract from roll if department not set
                                if (!userDept && u.roll) {
                                  const rollDigits = String(u.roll).replace(/\D/g, '');
                                  if (rollDigits.length >= 4) {
                                    const deptCode = rollDigits.substring(2, 4);
                                    userDept = departmentMap[deptCode] || '';
                                  }
                                }
                                if (userDept.toLowerCase() !== studentFilterDept.toLowerCase()) return false;
                              }
                              if (studentFilterBatch) {
                                const rollDigits = String(u.roll || '').replace(/\D/g, '');
                                const prefix = rollDigits.slice(0, 2);
                                const batchFromRoll = prefix ? `20${prefix}` : '';
                                if (String(studentFilterBatch) !== batchFromRoll) return false;
                              }
                            }
                            return true;
                          })
                          .sort((a, b) => {
                            // For students, sort by roll number
                            if (selectedUserRole === 'student') {
                              const rollA = parseInt(String(a.roll || '0').replace(/\D/g, ''), 10);
                              const rollB = parseInt(String(b.roll || '0').replace(/\D/g, ''), 10);
                              return rollA - rollB;
                            }
                            // For teachers, sort by: isDepartmentHead (head first), then designation, then by name
                            if (a.isDepartmentHead && !b.isDepartmentHead) return -1;
                            if (!a.isDepartmentHead && b.isDepartmentHead) return 1;
                            
                            const designationOrder = { 'Professor': 3, 'Assistant Professor': 2, 'Lecturer': 1 };
                            const designationA = designationOrder[a.designation] || 0;
                            const designationB = designationOrder[b.designation] || 0;
                            if (designationA !== designationB) {
                              return designationB - designationA;
                            }
                            return (a.name || '').localeCompare(b.name || '');
                          })
                          .reduce((groups, user) => {
                            // For teachers, group by status: department head, professors, assistant professors, lecturers
                            if (selectedUserRole === 'teacher') {
                              let group = 'Lecturer';
                              if (user.isDepartmentHead) {
                                group = 'Head';
                              } else if (user.designation === 'Professor') {
                                group = 'Professor';
                              } else if (user.designation === 'Assistant Professor') {
                                group = 'Assistant Professor';
                              }
                              
                              if (!groups[group]) {
                                groups[group] = [];
                              }
                              groups[group].push(user);
                            } else {
                              // For students, no grouping
                              if (!groups['all']) {
                                groups['all'] = [];
                              }
                              groups['all'].push(user);
                            }
                            return groups;
                          }, {})
                      ).map(([groupKey, usersInGroup]) => (
                          <div key={groupKey}>
                            {selectedUserRole === 'teacher' && (
                              <div style={{
                                fontSize: '18px',
                                fontWeight: '700',
                                color: '#374151',
                                textTransform: 'uppercase',
                                letterSpacing: '1px',
                                marginTop: groupKey === 'Head' ? '0' : '32px',
                                marginBottom: '20px',
                                padding: '16px 20px',
                                backgroundColor: '#e5e7eb',
                                borderRadius: '8px',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                                textAlign: 'center'
                              }}>
                                {groupKey === 'Head' && 'Department Head'}
                                {groupKey === 'Professor' && 'Professors'}
                                {groupKey === 'Assistant Professor' && 'Assistant Professors'}
                                {groupKey === 'Lecturer' && 'Lecturers'}
                              </div>
                            )}
                            <div className="proposals-grid">
                              {usersInGroup.map(user => (
                              <div key={user._id} className="proposal-card">
                                <div className="proposal-header" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                  <div style={{ flex: 1 }}>
                                    <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>
                                      {user.name}
                                    </h4>
                                    <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: '13px' }}>{user.email}</p>
                                    {user.roll && <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: '13px' }}>Roll: {user.roll}</p>}
                                    {user.role === 'teacher' && user.designation && <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: '13px' }}>Designation: {user.designation}{user.isDepartmentHead ? ' (Department Head)' : ''}</p>}
                                  </div>
                                  <span className={`status-badge ${user.isActive ? 'active' : 'inactive'}`}>
                                    {user.isActive ? 'Active' : 'Inactive'}
                                  </span>
                                </div>
                                <div className="proposal-actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                  <button
                                    className="btn btn-sm btn-primary"
                                    onClick={() => openUserProfileModal(user)}
                                    style={{ flex: '1 1 auto' }}
                                  >
                                    <FontAwesomeIcon icon={faUser} /> View Profile
                                  </button>
                                  {selectedUserRole === 'teacher' && user.designation === 'Professor' && (
                                    (() => {
                                      // Check if there's already a department head in this department
                                      const hasAnotherHead = users.some(u => 
                                        u.isDepartmentHead && 
                                        u.department === user.department && 
                                        u._id !== user._id
                                      );
                                      // Show button only if user is the head OR no one is the head yet
                                      if (!user.isDepartmentHead && hasAnotherHead) {
                                        return null; // Don't show the button
                                      }
                                      return (
                                        <button
                                          className={`btn btn-sm ${user.isDepartmentHead ? 'btn-danger' : 'btn-approve'}`}
                                          onClick={async () => {
                                            try {
                                              if (user.isDepartmentHead) {
                                                await removeDepartmentHead(user._id);
                                                setSuccessMessage('Department head status removed');
                                              } else {
                                                await setDepartmentHead(user._id);
                                                setSuccessMessage('Appointed as department head');
                                              }
                                              fetchAllUsers();
                                              setTimeout(() => setSuccessMessage(''), 3000);
                                            } catch (err) {
                                              setUsersError(err.message || 'Failed to update department head');
                                              setTimeout(() => setUsersError(''), 3000);
                                            }
                                          }}
                                        >
                                          {user.isDepartmentHead ? 'Remove as Head' : 'Make Head'}
                                        </button>
                                      );
                                    })()
                                  )}
                                  <button
                                    className={`btn btn-sm ${user.isActive ? 'btn-secondary' : 'btn-approve'}`}
                                    onClick={async () => {
                                      try {
                                        const newStatus = !user.isActive;
                                        await setUserStatus(user._id, newStatus);
                                        setSuccessMessage(`User ${newStatus ? 'activated' : 'deactivated'} successfully`);
                                        setUsers(prev => prev.map(u => u._id === user._id ? { ...u, isActive: newStatus } : u));
                                        setTimeout(() => setSuccessMessage(''), 3000);
                                      } catch (err) {
                                        setUsersError(err.response?.data?.message || 'Failed to update user status');
                                        setTimeout(() => setUsersError(''), 3000);
                                      }
                                    }}
                                  >
                                    {user.isActive ? 'Deactivate' : 'Activate'}
                                  </button>
                                  <button
                                    className="btn btn-sm btn-danger"
                                    onClick={async () => {
                                      const confirmed = window.confirm(
                                        `Delete ${user.name}? This cannot be undone.`
                                      );
                                      if (!confirmed) return;

                                      try {
                                        await deleteUser(user._id);
                                        setSuccessMessage('User deleted successfully');
                                        setUsers(prev => prev.filter(u => u._id !== user._id));
                                        setTimeout(() => setSuccessMessage(''), 3000);
                                      } catch (err) {
                                        setUsersError(err.response?.data?.message || 'Failed to delete user');
                                        setTimeout(() => setUsersError(''), 3000);
                                      }
                                    }}
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                            ))}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              ) : groupedUsers.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon"><FontAwesomeIcon icon={faUsers} /></div>
                  <h3>No Users Found</h3>
                  <p>Users will appear here once registered</p>
                </div>
              ) : (
                <div className="proposals-grid">
                  {groupedUsers.map(group => (
                    <div key={group.role} className="proposal-card">
                      <div className="proposal-header" style={{justifyContent: 'space-between', alignItems: 'center'}}>
                        <span className="proposal-type-badge" style={{textTransform: 'capitalize'}}>{group.role}</span>
                        <span className="status-badge" style={{backgroundColor: '#0d6efd'}}>{group.members.length} user{group.members.length !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="proposal-actions">
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => toggleUserGroup(group.role)}
                          style={{display: 'flex', alignItems: 'center', gap: '6px'}}
                        >
                          View Members
                          <FontAwesomeIcon icon={faChevronRight} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );

      case 'profile':
        return (
          <div className="section-container">
            <div className="section-header">
              <h2>My Profile</h2>
              <p>Manage your account information</p>
            </div>
            <div className="section-body">
              {error && (
                <div className="alert alert-error">
                  {error}
                </div>
              )}

              {successMessage && (
                <div className="alert alert-success">
                  {successMessage}
                </div>
              )}

              <div className="profile-card">
                <div className="profile-view">
                  <div className="profile-images-section">
                    <div className="profile-image-wrapper">
                      <label>Profile Picture</label>
                      <div className="profile-picture-container">
                        {user.profilePicture ? (
                          <img src={user.profilePicture} alt="Profile" />
                        ) : (
                          user.name?.charAt(0).toUpperCase()
                        )}
                      </div>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = async () => {
                              try {
                                const response = await fetch(`${process.env.REACT_APP_API_URL || '/api'}/auth/profile/update`, {
                                  method: 'PUT',
                                  headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                                  },
                                  body: JSON.stringify({ profilePicture: reader.result })
                                });
                                const data = await response.json();
                                if (data.success) {
                                  setUser(data.data);
                                  localStorage.setItem('user', JSON.stringify(data.data));
                                  setSuccessMessage('Profile picture updated successfully');
                                  setTimeout(() => setSuccessMessage(''), 3000);
                                } else {
                                  setError(data.message);
                                  setTimeout(() => setError(''), 3000);
                                }
                              } catch (err) {
                                setError('Failed to update profile picture');
                                setTimeout(() => setError(''), 3000);
                              }
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        style={{display: 'block', margin: '0 auto', fontSize: '12px'}}
                      />
                    </div>

                    <div className="profile-image-wrapper">
                      <label>Signature</label>
                      <div className="signature-container">
                        {user.signature ? (
                          <img src={user.signature} alt="Signature" />
                        ) : (
                          <span style={{color: '#ccc', fontSize: '12px'}}>Upload Signature</span>
                        )}
                      </div>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = async () => {
                              try {
                                const response = await fetch(`${process.env.REACT_APP_API_URL || '/api'}/auth/profile/update`, {
                                  method: 'PUT',
                                  headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                                  },
                                  body: JSON.stringify({ signature: reader.result })
                                });
                                const data = await response.json();
                                if (data.success) {
                                  setUser(data.data);
                                  localStorage.setItem('user', JSON.stringify(data.data));
                                  setSuccessMessage('Signature updated successfully');
                                  setTimeout(() => setSuccessMessage(''), 3000);
                                } else {
                                  setError(data.message);
                                  setTimeout(() => setError(''), 3000);
                                }
                              } catch (err) {
                                setError('Failed to update signature');
                                setTimeout(() => setError(''), 3000);
                              }
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        style={{display: 'block', margin: '0 auto', fontSize: '12px'}}
                      />
                    </div>
                  </div>

                  <div className="profile-grid">
                    <div className="profile-field">
                      <label>Name</label>
                      <input type="text" value={adminProfileForm.name} onChange={(e) => setAdminProfileForm({ ...adminProfileForm, name: e.target.value })} />
                    </div>
                    <div className="profile-field">
                      <label>Email</label>
                      <input type="email" className="readonly-field" value={adminProfileForm.email} disabled readOnly />
                    </div>
                  </div>

                  <div className="profile-field">
                    <label>Account Status</label>
                    <p>
                      <span className="status-badge status-approved">Active</span>
                    </p>
                  </div>

                  <div className="profile-grid">
                    <div className="profile-field">
                      <label>Phone</label>
                      <input type="tel" value={adminProfileForm.phone} onChange={(e) => setAdminProfileForm({ ...adminProfileForm, phone: e.target.value })} />
                    </div>
                    <div className="profile-field">
                      <label>Address</label>
                      <input type="text" value={adminProfileForm.address} onChange={(e) => setAdminProfileForm({ ...adminProfileForm, address: e.target.value })} />
                    </div>
                    <div className="profile-field">
                      <label>Blood Group</label>
                      <select value={adminProfileForm.bloodGroup} onChange={(e) => setAdminProfileForm({ ...adminProfileForm, bloodGroup: e.target.value })}>
                        <option value="">Select Blood Group</option>
                        <option value="A+">A+</option>
                        <option value="A-">A-</option>
                        <option value="B+">B+</option>
                        <option value="B-">B-</option>
                        <option value="O+">O+</option>
                        <option value="O-">O-</option>
                        <option value="AB+">AB+</option>
                        <option value="AB-">AB-</option>
                      </select>
                    </div>
                    <div className="profile-field">
                      <label>Religion</label>
                      <select value={adminProfileForm.religion} onChange={(e) => setAdminProfileForm({ ...adminProfileForm, religion: e.target.value })}>
                        <option value="">Select Religion</option>
                        <option value="Islam">Islam</option>
                        <option value="Hinduism">Hinduism</option>
                        <option value="Buddhism">Buddhism</option>
                        <option value="Christian">Christian</option>
                        <option value="Others">Others</option>
                      </select>
                    </div>
                  </div>

                  <div style={{marginBottom: '20px'}}>
                    <label style={{display: 'block', fontWeight: 700, color: '#2c3e50', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '12px'}}>Gender</label>
                    <div style={{display: 'flex', gap: '16px'}}>
                      <label style={{display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer'}}><input type="radio" name="gender" checked={adminProfileForm.gender === 'male'} onChange={() => setAdminProfileForm({ ...adminProfileForm, gender: 'male' })} /> Male</label>
                      <label style={{display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer'}}><input type="radio" name="gender" checked={adminProfileForm.gender === 'female'} onChange={() => setAdminProfileForm({ ...adminProfileForm, gender: 'female' })} /> Female</label>
                      <label style={{display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer'}}><input type="radio" name="gender" checked={adminProfileForm.gender === 'others'} onChange={() => setAdminProfileForm({ ...adminProfileForm, gender: 'others' })} /> Others</label>
                    </div>
                  </div>

                  <div className="password-change-section">
                    <label>Change Password</label>
                    <div className="password-inputs">
                      <input type="password" placeholder="Current Password" value={adminCurrentPassword} onChange={(e) => setAdminCurrentPassword(e.target.value)} />
                      <input type="password" placeholder="New Password" value={adminNewPassword} onChange={(e) => setAdminNewPassword(e.target.value)} />
                      <input type="password" placeholder="Confirm New Password" value={adminConfirmPassword} onChange={(e) => setAdminConfirmPassword(e.target.value)} />
                    </div>
                  </div>

                  <div style={{display: 'flex', justifyContent: 'space-between', gap: '10px'}}>
                    <button className="btn btn-logout" onClick={handleLogout}>
                      <FontAwesomeIcon icon={faSignOutAlt} style={{marginRight: '8px'}} />
                      Logout
                    </button>
                    <button 
                      className="btn btn-primary" 
                      onClick={async () => {
                        setAdminProfileSaving(true);
                        setAdminProfileMessage('');
                        try {
                          const payload = {
                            name: adminProfileForm.name,
                            email: adminProfileForm.email,
                            father: adminProfileForm.father,
                            mother: adminProfileForm.mother,
                            advisor: adminProfileForm.advisor,
                            phone: adminProfileForm.phone,
                            address: adminProfileForm.address,
                            hall: adminProfileForm.hall,
                            scholarship: adminProfileForm.scholarship,
                            gender: adminProfileForm.gender,
                            bloodGroup: adminProfileForm.bloodGroup,
                            religion: adminProfileForm.religion
                          };

                          // Password change validation
                          if (adminCurrentPassword || adminNewPassword || adminConfirmPassword) {
                            if (!adminCurrentPassword || !adminNewPassword || !adminConfirmPassword) {
                              setAdminProfileMessage('Please fill all password fields');
                              return;
                            }
                            if (adminNewPassword !== adminConfirmPassword) {
                              setAdminProfileMessage('New password and confirm password do not match');
                              return;
                            }
                            payload.currentPassword = adminCurrentPassword;
                            payload.newPassword = adminNewPassword;
                          }

                          const response = await fetch(`${process.env.REACT_APP_API_URL || '/api'}/auth/profile/update`, {
                            method: 'PUT',
                            headers: {
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${localStorage.getItem('token')}`
                            },
                            body: JSON.stringify(payload)
                          });

                          const data = await response.json();
                          if (data.success) {
                            setUser(data.data);
                            localStorage.setItem('user', JSON.stringify(data.data));
                            setAdminProfileMessage('Profile updated successfully');
                            setAdminCurrentPassword('');
                            setAdminNewPassword('');
                            setAdminConfirmPassword('');
                            setTimeout(() => setAdminProfileMessage(''), 3000);
                          } else {
                            setAdminProfileMessage(data.message || 'Failed to update profile');
                          }
                        } catch (err) {
                          setAdminProfileMessage('Error updating profile');
                        } finally {
                          setAdminProfileSaving(false);
                        }
                      }}
                      disabled={adminProfileSaving}
                    >
                      Save Changes
                    </button>
                  </div>

                  {adminProfileMessage && (
                    <div className={`alert alert-${adminProfileMessage.includes('success') || adminProfileMessage.includes('successfully') ? 'success' : 'error'}`} style={{marginTop: '20px'}}>
                      {adminProfileMessage}
                    </div>
                  )}

                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="dashboard-layout">
      {/* Mobile hamburger button */}
      <button 
        className="mobile-menu-btn"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        title="Toggle menu"
      >
        <FontAwesomeIcon icon={sidebarOpen ? faTimes : faBookOpen} />
      </button>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <div className="logo-section">
            <span className="logo-icon">
              <img src="/images/kuet-logo.png" alt="KUET Logo" className="logo-image" />
            </span>
            {sidebarOpen && <h1>KUET Admin</h1>}
          </div>
          <button 
            className="sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {sidebarOpen ? '←' : '→'}
          </button>
        </div>

        <nav className="sidebar-nav">
          <button
            className={`nav-item ${activeSection === 'pending' ? 'active' : ''}`}
            onClick={() => handleSectionChange('pending')}
          >
            <span className="nav-icon"><FontAwesomeIcon icon={faHourglass} /></span>
            {sidebarOpen && <span className="nav-label">Pending Approvals</span>}
            {sidebarOpen && pendingUsers.length > 0 && (
              <span className="badge-count">{pendingUsers.length}</span>
            )}
          </button>

          <button
            className={`nav-item ${activeSection === 'proposals' ? 'active' : ''}`}
            onClick={() => handleSectionChange('proposals')}
          >
            <span className="nav-icon"><FontAwesomeIcon icon={faClipboardList} /></span>
            {sidebarOpen && <span className="nav-label">Course Proposals</span>}
            {sidebarOpen && proposals.filter(p => p.status === 'PENDING').length > 0 && (
              <span className="badge-count">{proposals.filter(p => p.status === 'PENDING').length}</span>
            )}
          </button>

          <button
            className={`nav-item ${activeSection === 'courses' ? 'active' : ''}`}
            onClick={() => handleSectionChange('courses')}
          >
            <span className="nav-icon"><FontAwesomeIcon icon={faBookOpen} /></span>
            {sidebarOpen && <span className="nav-label">Courses</span>}
            {sidebarOpen && courses.length > 0 && (
              <span className="badge-info">{courses.length}</span>
            )}
          </button>

          <button
            className={`nav-item ${activeSection === 'users' ? 'active' : ''}`}
            onClick={() => handleSectionChange('users')}
          >
            <span className="nav-icon"><FontAwesomeIcon icon={faUsers} /></span>
            {sidebarOpen && <span className="nav-label">All Users</span>}
          </button>
        </nav>

        <div className="sidebar-footer">
          {user && (
            <div 
              className="user-profile" 
              onClick={() => handleSectionChange('profile')}
              style={{cursor: 'pointer'}}
              title="View Profile"
            >
              <div className="user-avatar-small" style={user.profilePicture ? {
                backgroundImage: `url(${user.profilePicture})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              } : {}}>
                {!user.profilePicture && user.name?.charAt(0).toUpperCase()}
              </div>
              {sidebarOpen && (
                <div className="user-details-small">
                  <p className="user-name">{user.name}</p>
                  <p className="user-role">{user.role}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>

      <main className="main-content">
        <div className="content-wrapper">
          {renderSection()}
        </div>
      </main>

      {/* Modals */}
      {showCourseForm && (
        <CourseForm 
          onCancel={() => {
            setShowCourseForm(false);
            setEditingCourse(null);
            setCourseFormError('');
          }}
          onSubmit={editingCourse ? handleUpdateCourse : handleCreateCourse}
          loading={courseFormLoading}
          initialData={editingCourse}
          isEditMode={!!editingCourse}
          error={courseFormError}
          onErrorChange={setCourseFormError}
        />
      )}

      {showOBEView && selectedCourse && (
        <CourseOBEView 
          course={selectedCourse}
          viewingSemester={typeof showOBEView === 'number' ? showOBEView : null}
          onClose={() => {
            setShowOBEView(false);
            setSelectedCourse(null);
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && courseToDelete && (
        <div className="modal-overlay" onClick={() => !deleteLoading && setShowDeleteModal(false)}>
          <div className="modal-content delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Confirm Delete</h3>
              <button 
                className="close-btn" 
                onClick={() => setShowDeleteModal(false)}
                disabled={deleteLoading}
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            <div className="modal-body">
              <div className="warning-icon">
                <FontAwesomeIcon icon={faTrash} />
              </div>
              <p className="warning-text">
                Are you sure you want to delete the course <strong>{courseToDelete.courseCode} - {courseToDelete.courseTitle}</strong>?
              </p>
              <p className="warning-subtext">
                This action will permanently delete the course and all associated data including course outcomes and CO-PO mappings. This cannot be undone.
              </p>
            </div>
            <div className="modal-footer">
              <button 
                className="btn btn-outline"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleteLoading}
              >
                Cancel
              </button>
              <button 
                className="btn btn-danger"
                onClick={handleDeleteCourse}
                disabled={deleteLoading}
              >
                {deleteLoading ? (
                  <>
                    <div className="spinner spinner-small"></div>
                    Deleting...
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon={faTrash} /> Delete Course
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Course Teacher Assignment Modal */}
      {showAssignmentModal && selectedCourseForAssignment && (
        <div className="modal-overlay" onClick={() => !assignmentLoading && setShowAssignmentModal(false)}>
          <div className="modal-content assignment-modal" onClick={(e) => e.stopPropagation()} style={{maxWidth: '600px'}}>
            <div className="modal-header">
              <h3>Assign Teachers to Course</h3>
              <button 
                className="close-btn" 
                onClick={() => setShowAssignmentModal(false)}
                disabled={assignmentLoading}
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            <div className="modal-body">
              <div style={{marginBottom: '20px', padding: '12px', backgroundColor: '#f3f4f6', borderRadius: '8px'}}>
                <h4 style={{margin: '0 0 8px 0', fontSize: '16px', color: '#1f2937'}}>
                  {selectedCourseForAssignment.courseCode}
                </h4>
                <p style={{margin: 0, color: '#6b7280', fontSize: '14px'}}>
                  {selectedCourseForAssignment.courseTitle}
                </p>
                <p style={{margin: '4px 0 0 0', color: '#6b7280', fontSize: '12px'}}>
                  Type: <strong>{selectedCourseForAssignment.course_type}</strong>
                </p>
              </div>

              {assignmentSuccess && (
                <div className="alert alert-success" style={{marginBottom: '16px'}}>
                  <span className="alert-icon"><FontAwesomeIcon icon={faCheck} /></span>
                  {assignmentSuccess}
                </div>
              )}

              {assignmentError && (
                <div className="alert alert-error" style={{marginBottom: '16px'}}>
                  <span className="alert-icon"><FontAwesomeIcon icon={faTimes} /></span>
                  {assignmentError}
                </div>
              )}

              {/* Currently Assigned Teachers */}
              <div style={{marginBottom: '24px'}}>
                <h4 style={{fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: '#374151'}}>
                  Currently Assigned Teachers
                </h4>
                {selectedCourseForAssignment.assignedTeachers && selectedCourseForAssignment.assignedTeachers.length > 0 ? (
                  <>
                    {selectedCourseForAssignment.course_type === 'THEORY' && selectedCourseForAssignment.assignedTeachers.some(a => !a.section) && (
                      <div style={{
                        padding: '10px 12px',
                        backgroundColor: '#fef3c7',
                        border: '1px solid #fbbf24',
                        borderRadius: '6px',
                        marginBottom: '12px',
                        fontSize: '13px',
                        color: '#92400e'
                      }}>
                        <strong>⚠️ Warning:</strong> Some teachers don't have a section assigned. For THEORY courses, sections (A or B) are required. Please remove and reassign them with a section.
                      </div>
                    )}
                    <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                    {selectedCourseForAssignment.assignedTeachers.map((assignment, idx) => {
                      const teacher = assignment.teacher || assignment;
                      const section = assignment.section;
                      console.log(`Rendering teacher ${idx}:`, { 
                        assignment: JSON.stringify(assignment), 
                        teacher: teacher?.name, 
                        section: section,
                        sectionType: typeof section
                      });
                      return (
                        <div 
                          key={`${teacher._id}-${section || idx}`}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '10px 12px',
                            backgroundColor: '#fff',
                            border: '1px solid #e5e7eb',
                            borderRadius: '6px'
                          }}
                        >
                          <div style={{flex: 1}}>
                            <div style={{fontWeight: 500, fontSize: '14px', color: '#1f2937'}}>
                              {teacher.name}
                              {section ? (
                                <span style={{
                                  marginLeft: '8px',
                                  padding: '2px 8px',
                                  backgroundColor: '#dbeafe',
                                  color: '#1e40af',
                                  borderRadius: '4px',
                                  fontSize: '12px',
                                  fontWeight: 600
                                }}>
                                  Section {section}
                                </span>
                              ) : selectedCourseForAssignment.course_type === 'THEORY' ? (
                                <span style={{
                                  marginLeft: '8px',
                                  padding: '2px 8px',
                                  backgroundColor: '#fef3c7',
                                  color: '#92400e',
                                  borderRadius: '4px',
                                  fontSize: '12px',
                                  fontWeight: 600
                                }}>
                                  No Section ⚠️
                                </span>
                              ) : null}
                            </div>
                            <div style={{fontSize: '12px', color: '#6b7280', marginTop: '2px'}}>
                              {teacher.email}
                              {teacher.designation && ` • ${teacher.designation}`}
                            </div>
                          </div>
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => handleUnassignTeacher(teacher._id)}
                            disabled={assignmentLoading}
                            style={{fontSize: '12px', padding: '6px 12px'}}
                          >
                            Remove
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  </>
                ) : (
                  <div style={{
                    padding: '16px',
                    backgroundColor: '#fef3c7',
                    border: '1px solid #fbbf24',
                    borderRadius: '6px',
                    textAlign: 'center',
                    color: '#92400e',
                    fontSize: '13px'
                  }}>
                    No teachers assigned yet
                  </div>
                )}
              </div>

              {/* Available Teachers to Assign */}
              {(() => {
                // Check if max 2 teachers already assigned
                const hasReachedMaxTeachers = (selectedCourseForAssignment.assignedTeachers || []).length >= 2;
                
                // Don't show this section if max teachers reached
                if (hasReachedMaxTeachers) return null;
                
                return (
                  <div>
                    <h4 style={{fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: '#374151'}}>
                      Available Teachers
                    </h4>
                    <input
                      type="text"
                      placeholder="Search by name, email, or designation..."
                      value={teacherFilter}
                      onChange={(e) => setTeacherFilter(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px',
                        marginBottom: '12px',
                        outline: 'none',
                        transition: 'border-color 0.2s ease'
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                      onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                    />
                {(() => {
                  const assignedTeacherIds = (selectedCourseForAssignment.assignedTeachers || []).map(a => {
                    const teacher = a.teacher || a;
                    return teacher._id;
                  });
                  
                  // Check if max 2 teachers already assigned
                  const hasReachedMaxTeachers = (selectedCourseForAssignment.assignedTeachers || []).length >= 2;
                  
                  let availableTeachers = users.filter(u => 
                    u.role === 'teacher' && 
                    u.isActive &&
                    !assignedTeacherIds.includes(u._id)
                  );
                  
                  // Apply filter
                  if (teacherFilter.trim()) {
                    const filterLower = teacherFilter.toLowerCase();
                    availableTeachers = availableTeachers.filter(teacher => 
                      teacher.name?.toLowerCase().includes(filterLower) ||
                      teacher.email?.toLowerCase().includes(filterLower) ||
                      teacher.designation?.toLowerCase().includes(filterLower)
                    );
                  }

                  if (availableTeachers.length === 0) {
                    return (
                      <div style={{
                        padding: '16px',
                        backgroundColor: '#f3f4f6',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        textAlign: 'center',
                        color: '#6b7280',
                        fontSize: '13px'
                      }}>
                        {hasReachedMaxTeachers ? 'Maximum 2 teachers already assigned' : 'No available teachers to assign'}
                      </div>
                    );
                  }

                  return (
                    <div style={{
                      maxHeight: '250px',
                      overflowY: 'auto',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}>
                      {hasReachedMaxTeachers && (
                        <div style={{
                          padding: '10px 12px',
                          backgroundColor: '#fef3c7',
                          border: '1px solid #fcd34d',
                          borderRadius: '6px',
                          color: '#92400e',
                          fontSize: '13px',
                          fontWeight: 500
                        }}>
                          <FontAwesomeIcon icon={faExclamationTriangle} /> Maximum 2 teachers reached. Remove one to add another.
                        </div>
                      )}
                      {availableTeachers.map((teacher) => {
                        // Get already assigned sections from database
                        const assignedSections = selectedCourseForAssignment.assignedTeachers
                          .map(a => a.section)
                          .filter(s => s);
                        
                        // Get sections selected by OTHER teachers (not this one)
                        const sectionsSelectedByOthers = Object.entries(teacherSectionSelections)
                          .filter(([tid, section]) => tid !== teacher._id && section)
                          .map(([tid, section]) => section);
                        
                        // Check if Section A is unavailable for this teacher
                        const isSectionAUnavailable = assignedSections.includes('A') || sectionsSelectedByOthers.includes('A');
                        const isSectionBUnavailable = assignedSections.includes('B') || sectionsSelectedByOthers.includes('B');
                        
                        return (
                        <div 
                          key={teacher._id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '10px 12px',
                            backgroundColor: '#fff',
                            border: '1px solid #e5e7eb',
                            borderRadius: '6px'
                          }}
                        >
                          <div style={{flex: 1}}>
                            <div style={{fontWeight: 500, fontSize: '14px', color: '#1f2937'}}>
                              {teacher.name}
                            </div>
                            <div style={{fontSize: '12px', color: '#6b7280'}}>
                              {teacher.email}
                              {teacher.designation && ` • ${teacher.designation}`}
                            </div>
                          </div>
                          
                          {/* Only show section dropdown for THEORY courses */}
                          {selectedCourseForAssignment.course_type === 'THEORY' && (
                            <select
                              value={teacherSectionSelections[teacher._id] || ''}
                              onChange={(e) => {
                                const newSection = e.target.value;
                                // Check if section is already taken by another teacher
                                const isTaken = sectionsSelectedByOthers.includes(newSection) || assignedSections.includes(newSection);
                                if (!isTaken || !newSection) {
                                  setTeacherSectionSelections(prev => ({
                                    ...prev,
                                    [teacher._id]: newSection
                                  }));
                                }
                              }}
                              style={{
                                padding: '6px 10px',
                                fontSize: '12px',
                                borderRadius: '4px',
                                border: '1px solid #d1d5db',
                                backgroundColor: 'white',
                                cursor: 'pointer',
                                minWidth: '120px'
                              }}
                              disabled={assignmentLoading || hasReachedMaxTeachers}
                            >
                              <option value="" disabled>Select Section</option>
                              <option value="A" disabled={isSectionAUnavailable}>Section A {isSectionAUnavailable ? '(Taken)' : ''}</option>
                              <option value="B" disabled={isSectionBUnavailable}>Section B {isSectionBUnavailable ? '(Taken)' : ''}</option>
                            </select>
                          )}
                          
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              // For THEORY courses, use selected section; for others, use null
                              const sectionToAssign = selectedCourseForAssignment.course_type === 'THEORY' 
                                ? teacherSectionSelections[teacher._id] 
                                : null;
                              handleAssignTeacher(teacher._id, sectionToAssign);
                            }}
                            disabled={
                              assignmentLoading || 
                              hasReachedMaxTeachers || 
                              (selectedCourseForAssignment.course_type === 'THEORY' && !teacherSectionSelections[teacher._id])
                            }
                            style={{fontSize: '12px', padding: '6px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center'}}
                            title={
                              hasReachedMaxTeachers 
                                ? 'Maximum 2 teachers reached' 
                                : (selectedCourseForAssignment.course_type === 'THEORY' && !teacherSectionSelections[teacher._id])
                                  ? 'Please select a section first' 
                                  : 'Assign teacher'
                            }
                          >
                            Assign
                          </button>
                        </div>
                        );
                      })}
                    </div>
                  );
                })()}
                  </div>
                );
              })()}
            </div>
            <div className="modal-footer">
              <button 
                className="btn btn-outline"
                onClick={() => setShowAssignmentModal(false)}
                disabled={assignmentLoading}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Profile Modal */}
      {showUserProfileModal && selectedUserProfile && (
        <div className="modal-overlay" onClick={() => !profileSaving && setShowUserProfileModal(false)}>
          <div className="modal-content assignment-modal" onClick={(e) => e.stopPropagation()} style={{maxWidth: '700px', maxHeight: '90vh'}}>
            <div className="modal-header">
              <h3>User Profile - {selectedUserProfile.name}</h3>
              <button 
                className="close-btn" 
                onClick={() => setShowUserProfileModal(false)}
                disabled={profileSaving}
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            <div className="modal-body" style={{maxHeight: 'calc(90vh - 180px)', overflowY: 'auto'}}>
              {profileSuccess && (
                <div className="alert alert-success" style={{marginBottom: '16px'}}>
                  <span className="alert-icon"><FontAwesomeIcon icon={faCheck} /></span>
                  {profileSuccess}
                </div>
              )}

              {profileError && (
                <div className="alert alert-error" style={{marginBottom: '16px'}}>
                  <span className="alert-icon"><FontAwesomeIcon icon={faTimes} /></span>
                  {profileError}
                </div>
              )}

              <div style={{marginBottom: '20px', padding: '12px', backgroundColor: '#f3f4f6', borderRadius: '8px'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                  <div>
                    <span className={`role-badge ${(selectedUserProfile.role || '').toLowerCase()}`} style={{marginRight: '8px'}}>
                      {(selectedUserProfile.role || '').toLowerCase()}
                    </span>
                    <span className={`status-badge ${selectedUserProfile.isActive ? 'active' : 'inactive'}`}>
                      {selectedUserProfile.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div style={{fontSize: '12px', color: '#6b7280'}}>
                    ID: {selectedUserProfile._id}
                  </div>
                </div>
              </div>

              {/* Profile Form */}
              <div style={{display: 'grid', gridTemplateColumns: selectedUserProfile.role === 'teacher' ? '1fr 1fr' : '1fr 1fr', gap: '16px'}}>
                {/* Always show Name and Email */}
                <div>
                  <label style={{display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: '#374151'}}>
                    Full Name <span style={{color: '#dc2626'}}>*</span>
                  </label>
                  <input
                    type="text"
                    value={userProfileForm.name}
                    onChange={(e) => setUserProfileForm({ ...userProfileForm, name: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                    disabled={profileSaving}
                  />
                </div>

                {/* For Teacher: Only show Designation */}
                {selectedUserProfile.role === 'teacher' && (
                  <div>
                    <label style={{display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: '#374151'}}>
                      Designation
                    </label>
                    <select
                      value={userProfileForm.designation}
                      onChange={(e) => setUserProfileForm({ ...userProfileForm, designation: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px'
                      }}
                      disabled={profileSaving}
                    >
                      <option value="">Select Designation</option>
                      <option value="Professor">Professor</option>
                      <option value="Assistant Professor">Assistant Professor</option>
                      <option value="Lecturer">Lecturer</option>
                    </select>
                  </div>
                )}

                {/* For Student: Show Roll Number */}
                {selectedUserProfile.role === 'student' && (
                  <div>
                    <label style={{display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: '#374151'}}>
                      Roll Number
                    </label>
                    <input
                      type="text"
                      value={userProfileForm.roll}
                      onChange={(e) => setUserProfileForm({ ...userProfileForm, roll: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px'
                      }}
                      disabled={profileSaving}
                    />
                  </div>
                )}

                {/* For Student: Advisor */}
                {selectedUserProfile.role === 'student' && (
                  <div>
                    <label style={{display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: '#374151'}}>
                      Advisor
                    </label>
                    <input
                      type="text"
                      value={userProfileForm.advisor}
                      onChange={(e) => setUserProfileForm({ ...userProfileForm, advisor: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px'
                      }}
                      disabled={profileSaving}
                    />
                  </div>
                )}

                {/* For Student: Father's Name */}
                {selectedUserProfile.role === 'student' && (
                  <div>
                    <label style={{display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: '#374151'}}>
                      Father's Name
                    </label>
                    <input
                      type="text"
                      value={userProfileForm.father}
                      onChange={(e) => setUserProfileForm({ ...userProfileForm, father: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px'
                      }}
                      disabled={profileSaving}
                    />
                  </div>
                )}

                {/* For Student: Mother's Name */}
                {selectedUserProfile.role === 'student' && (
                  <div>
                    <label style={{display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: '#374151'}}>
                      Mother's Name
                    </label>
                    <input
                      type="text"
                      value={userProfileForm.mother}
                      onChange={(e) => setUserProfileForm({ ...userProfileForm, mother: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px'
                      }}
                      disabled={profileSaving}
                    />
                  </div>
                )}

                {/* For Student: Hall Name */}
                {selectedUserProfile.role === 'student' && (
                  <div>
                    <label style={{display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: '#374151'}}>
                      Hall Name
                    </label>
                    <input
                      type="text"
                      value={userProfileForm.hall}
                      onChange={(e) => setUserProfileForm({ ...userProfileForm, hall: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px'
                      }}
                      disabled={profileSaving}
                    />
                  </div>
                )}

                {/* For Student: Scholarship */}
                {selectedUserProfile.role === 'student' && (
                  <div>
                    <label style={{display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: '#374151'}}>
                      Scholarship
                    </label>
                    <input
                      type="text"
                      value={userProfileForm.scholarship}
                      onChange={(e) => setUserProfileForm({ ...userProfileForm, scholarship: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px'
                      }}
                      disabled={profileSaving}
                    />
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="btn btn-outline"
                onClick={() => setShowUserProfileModal(false)}
                disabled={profileSaving}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary"
                onClick={handleUpdateUserProfile}
                disabled={profileSaving}
              >
                {profileSaving ? (
                  <>
                    <div className="spinner spinner-small"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon={faCheck} /> Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Assignment Modal */}
      {showBatchAssignmentModal && selectedCourseForBatch && (
        <div className="modal-overlay" onClick={() => !batchAssignmentLoading && setShowBatchAssignmentModal(false)}>
          <div className="modal-content assignment-modal" onClick={(e) => e.stopPropagation()} style={{maxWidth: '600px'}}>
            <div className="modal-header">
              <h3>{selectedCourseForBatch._isGroupAssignment ? `Assign Batch to ${selectedCourseForBatch._groupName}` : 'Assign Batches to Course'}</h3>
              <button 
                className="close-btn" 
                onClick={() => setShowBatchAssignmentModal(false)}
                disabled={batchAssignmentLoading}
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            <div className="modal-body">
              {selectedCourseForBatch._isGroupAssignment ? (
                <div>
                  <div style={{marginBottom: '20px', padding: '12px', backgroundColor: '#f3f4f6', borderRadius: '8px'}}>
                    <h4 style={{margin: '0 0 8px 0', fontSize: '16px', color: '#1f2937'}}>
                      {selectedCourseForBatch._groupName}
                    </h4>
                    <p style={{margin: 0, color: '#6b7280', fontSize: '14px'}}>
                      {selectedCourseForBatch._groupCourses.length} course{selectedCourseForBatch._groupCourses.length !== 1 ? 's' : ''} will be assigned to the selected batch
                    </p>
                  </div>
                  
                  {/* Remove all assignments button for group */}
                  {selectedCourseForBatch._groupCourses.some(c => c.assignedBatches && c.assignedBatches.length > 0) && (
                    <div style={{marginBottom: '20px'}}>
                      <button
                        className="btn btn-sm"
                        onClick={handleRemoveAllBatches}
                        disabled={batchAssignmentLoading}
                        style={{
                          backgroundColor: '#ef4444',
                          color: 'white',
                          border: 'none',
                          width: '100%',
                          padding: '10px',
                          fontSize: '14px'
                        }}
                      >
                        <FontAwesomeIcon icon={faTimes} style={{marginRight: '8px'}} />
                        Clear Batch Assignment from Group
                      </button>
                      <p style={{fontSize: '11px', color: '#6b7280', marginTop: '6px', fontStyle: 'italic'}}>
                        This will remove the assigned batch from all courses in this group
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{marginBottom: '20px', padding: '12px', backgroundColor: '#f3f4f6', borderRadius: '8px'}}>
                  <h4 style={{margin: '0 0 8px 0', fontSize: '16px', color: '#1f2937'}}>
                    {selectedCourseForBatch.courseCode}
                  </h4>
                  <p style={{margin: 0, color: '#6b7280', fontSize: '14px'}}>
                    {selectedCourseForBatch.courseTitle}
                  </p>
                </div>
              )}

              {batchAssignmentSuccess && (
                <div className="alert alert-success" style={{marginBottom: '16px'}}>
                  <span className="alert-icon"><FontAwesomeIcon icon={faCheck} /></span>
                  {batchAssignmentSuccess}
                </div>
              )}

              {batchAssignmentError && (
                <div className="alert alert-error" style={{marginBottom: '16px'}}>
                  <span className="alert-icon"><FontAwesomeIcon icon={faTimes} /></span>
                  {batchAssignmentError}
                </div>
              )}

              {/* Require course yearLevel and semester before assignment */}
              {!selectedCourseForBatch._isGroupAssignment && (
                <div style={{marginBottom: '12px'}}>
                  {(selectedCourseForBatch.yearLevel && selectedCourseForBatch.semester) ? (
                    <div style={{fontSize: '12px', color: '#374151'}}>
                      Year-Semester: {selectedCourseForBatch.yearLevel}-{selectedCourseForBatch.semester}
                    </div>
                  ) : (
                    <div style={{
                      padding: '12px', backgroundColor: '#fee2e2', border: '1px solid #ef4444', borderRadius: '6px', color: '#991b1b', fontSize: '13px'
                    }}>
                      Course must have valid yearLevel and semester set before assigning a batch.
                    </div>
                  )}
                </div>
              )}

              {/* Currently Assigned Batches - Only show for single course assignment */}
              {!selectedCourseForBatch._isGroupAssignment && (
                <div style={{marginBottom: '24px'}}>
                  <h4 style={{fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: '#374151'}}>
                    Currently Assigned Batches
                  </h4>
                  {selectedCourseForBatch.assignedBatches && selectedCourseForBatch.assignedBatches.length > 0 ? (
                  <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                    {selectedCourseForBatch.assignedBatches.map((assignment, idx) => (
                      <div 
                        key={`${assignment.batch}-${assignment.deptCode}`}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '10px 12px',
                          backgroundColor: '#fff',
                          border: '1px solid #e5e7eb',
                          borderRadius: '6px'
                        }}
                      >
                        <div style={{flex: 1}}>
                          <div style={{fontWeight: 500, fontSize: '14px', color: '#1f2937'}}>
                            Batch: {formatBatchYear(assignment.batch)} • {departmentMap[assignment.deptCode]} ({assignment.deptCode})
                          </div>
                          <div style={{fontSize: '12px', color: '#6b7280', marginTop: '2px'}}>
                            Students with roll starting with {assignment.batch}{assignment.deptCode}
                          </div>
                        </div>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleUnassignBatch(assignment.batch, assignment.deptCode)}
                          disabled={batchAssignmentLoading}
                          style={{fontSize: '12px', padding: '6px 12px'}}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{
                    padding: '16px',
                    backgroundColor: '#fef3c7',
                    border: '1px solid #fbbf24',
                    borderRadius: '6px',
                    textAlign: 'center',
                    color: '#92400e',
                    fontSize: '13px'
                  }}>
                    No batches assigned yet
                  </div>
                )}
              </div>
              )}

              {/* Assign New Batch */}
              <div>
                <h4 style={{fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: '#374151'}}>
                  {selectedCourseForBatch.assignedBatches && selectedCourseForBatch.assignedBatches.length > 0 ? 'Change Batch' : 'Assign Batch'}
                </h4>
                {selectedCourseForBatch.assignedBatches && selectedCourseForBatch.assignedBatches.length > 0 && (
                  <>
                    <p style={{fontSize: '12px', color: '#374151', marginBottom: '8px'}}>
                      Currently assigned: {selectedCourseForBatch.assignedBatches
                        .map(ab => `${formatBatchYear(ab.batch)} • ${departmentMap[ab.deptCode]} (${ab.deptCode})`)
                        .join(', ')}
                    </p>
                    <p style={{fontSize: '12px', color: '#dc2626', marginBottom: '12px', fontStyle: 'italic'}}>
                      Note: Assigning a new batch will replace the current assignment
                    </p>
                  </>
                )}
                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '10px', alignItems: 'end'}}>
                  <div>
                    <label style={{display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: '#374151'}}>
                      Batch (2 digits)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., 21"
                      value={batchInput}
                      onChange={(e) => setBatchInput(e.target.value)}
                      maxLength={2}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px'
                      }}
                      disabled={batchAssignmentLoading}
                    />
                  </div>
                  <div>
                    <label style={{display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: '#374151'}}>
                      Department
                    </label>
                    <select
                      value={deptCodeInput}
                      onChange={(e) => setDeptCodeInput(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px'
                      }}
                      disabled={batchAssignmentLoading}
                    >
                      <option value="">Select Dept</option>
                      <option value="07">CSE-07</option>
                      <option value="03">EEE-03</option>
                      <option value="05">ME-05</option>
                      <option value="01">CE-01</option>
                      <option value="09">ECE-09</option>
                      <option value="11">IEM-11</option>
                      <option value="13">ESE-13</option>
                      <option value="15">BME-15</option>
                      <option value="17">URP-17</option>
                      <option value="19">LE-19</option>
                      <option value="27">MSE-27</option>
                      <option value="31">MTE-31</option>
                      <option value="23">BECM-23</option>
                      <option value="25">ARCH-25</option>
                      <option value="21">TE-21</option>
                      <option value="29">CHE-29</option>
                    </select>
                  </div>
                  <button
                    className="btn btn-primary"
                    onClick={handleAssignBatch}
                    disabled={
                      batchAssignmentLoading ||
                      !batchInput ||
                      !deptCodeInput ||
                      (!selectedCourseForBatch?._isGroupAssignment && (
                        !selectedCourseForBatch?.yearLevel ||
                        !selectedCourseForBatch?.semester
                      ))
                    }
                    style={{fontSize: '14px', padding: '8px 16px'}}
                  >
                    {batchAssignmentLoading ? 'Processing...' : (selectedCourseForBatch.assignedBatches && selectedCourseForBatch.assignedBatches.length > 0 ? 'Change' : 'Assign')}
                  </button>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="btn btn-outline"
                onClick={() => setShowBatchAssignmentModal(false)}
                disabled={batchAssignmentLoading}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Proposal Detail Modal */}
      {showProposalDetail && selectedProposal && (
        <div className="modal-overlay" onClick={() => !loading && setShowProposalDetail(false)}>
          <div className="modal-content proposal-detail-modal" onClick={(e) => e.stopPropagation()} style={{maxWidth: '900px', maxHeight: '90vh'}}>
            <div className="modal-header">
              <button 
                className="close-btn" 
                onClick={() => setShowProposalDetail(false)}
                disabled={loading}
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
              <h3>Course Proposal Details</h3>
            </div>
            <div className="modal-body" style={{maxHeight: 'calc(90vh - 200px)', overflowY: 'auto'}}>
              <div className="proposal-info-section">
                <div className="info-row">
                  <span className={`proposal-type-badge ${selectedProposal.proposalType.toLowerCase()}`}>
                    {selectedProposal.proposalType}
                  </span>
                  <span className={`status-badge status-${selectedProposal.status.toLowerCase()}`}>
                    {selectedProposal.status}
                  </span>
                </div>
                <div className="info-row">
                  <strong>Proposed by:</strong> {selectedProposal.proposedBy?.name || 'Unknown'}
                </div>
                <div className="info-row">
                  <strong>Date:</strong> {new Date(selectedProposal.createdAt).toLocaleDateString()}
                </div>
                {selectedProposal.changeDescription && (
                  <div className="info-row">
                    <strong>Change Description:</strong>
                    <p>{selectedProposal.changeDescription}</p>
                  </div>
                )}
              </div>

              <div className="course-details-section" style={{padding: '0 5px'}}>
                <h4>Course Information</h4>
                <div className="details-grid">
                  {selectedProposal.proposalType === 'UPDATE' && selectedProposal.existingCourse ? (
                    <>
                      {renderFieldComparison('Course Code', selectedProposal.existingCourse.courseCode, selectedProposal.proposedData.courseCode)}
                      {renderFieldComparison('Course Title', selectedProposal.existingCourse.courseTitle, selectedProposal.proposedData.courseTitle)}
                      {renderFieldComparison('Course Type', selectedProposal.existingCourse.course_type, selectedProposal.proposedData.course_type)}
                      {renderFieldComparison('Credits', selectedProposal.existingCourse.credit, selectedProposal.proposedData.credit)}
                      {renderFieldComparison('Offered To', selectedProposal.existingCourse.course_offered_to, selectedProposal.proposedData.course_offered_to)}
                      {renderFieldComparison('Category', selectedProposal.existingCourse.category, selectedProposal.proposedData.category)}
                      {(selectedProposal.existingCourse.elective_group || selectedProposal.proposedData.elective_group) &&
                        renderFieldComparison('Elective Group', selectedProposal.existingCourse.elective_group || 'None', selectedProposal.proposedData.elective_group || 'None')}
                      {(selectedProposal.existingCourse.term || selectedProposal.proposedData.term) &&
                        renderFieldComparison('Term', selectedProposal.existingCourse.term, selectedProposal.proposedData.term)}
                      {(selectedProposal.existingCourse.yearLevel || selectedProposal.proposedData.yearLevel) &&
                        renderFieldComparison('Year Level', selectedProposal.existingCourse.yearLevel, selectedProposal.proposedData.yearLevel)}
                      {(selectedProposal.existingCourse.contactHours || selectedProposal.proposedData.contactHours) &&
                        renderFieldComparison('Contact Hours', selectedProposal.existingCourse.contactHours, selectedProposal.proposedData.contactHours, (v) => `${v} hrs/week`)}
                    </>
                  ) : (
                    <>
                      <div className="detail-item">
                        <strong>Course Code:</strong> {selectedProposal.proposedData.courseCode}
                      </div>
                      <div className="detail-item">
                        <strong>Course Title:</strong> {selectedProposal.proposedData.courseTitle}
                      </div>
                      <div className="detail-item">
                        <strong>Course Type:</strong> {selectedProposal.proposedData.course_type}
                      </div>
                      <div className="detail-item">
                        <strong>Credits:</strong> {selectedProposal.proposedData.credit}
                      </div>
                      <div className="detail-item">
                        <strong>Offered To:</strong> {selectedProposal.proposedData.course_offered_to}
                      </div>
                      <div className="detail-item">
                        <strong>Category:</strong> {selectedProposal.proposedData.category}
                      </div>
                      {selectedProposal.proposedData.elective_group && (
                        <div className="detail-item">
                          <strong>Elective Group:</strong> {selectedProposal.proposedData.elective_group}
                        </div>
                      )}
                      {selectedProposal.proposedData.term && (
                        <div className="detail-item">
                          <strong>Term:</strong> {selectedProposal.proposedData.term}
                        </div>
                      )}
                      {selectedProposal.proposedData.yearLevel && (
                        <div className="detail-item">
                          <strong>Year Level:</strong> {selectedProposal.proposedData.yearLevel}
                        </div>
                      )}
                      {selectedProposal.proposedData.contactHours && (
                        <div className="detail-item">
                          <strong>Contact Hours:</strong> {selectedProposal.proposedData.contactHours} hrs/week
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* KPA Mapping */}
                {(selectedProposal.proposedData.kpa_mapping && selectedProposal.proposedData.kpa_mapping.length > 0) && (
                  selectedProposal.proposalType === 'UPDATE' && selectedProposal.existingCourse
                    ? renderArrayComparison(
                        'KPA Mapping',
                        selectedProposal.existingCourse.kpa_mapping || [],
                        selectedProposal.proposedData.kpa_mapping,
                        (kpa, idx, type) => (
                          <span key={idx} style={{
                            padding: '4px 12px',
                            backgroundColor: type === 'removed' ? '#f8d7da' : type === 'added' ? '#d4edda' : '#e3f2fd',
                            color: type === 'removed' ? '#721c24' : type === 'added' ? '#155724' : '#1976d2',
                            border: type === 'removed' ? '1px solid #dc3545' : type === 'added' ? '1px solid #28a745' : 'none',
                            borderRadius: '4px',
                            fontSize: '13px',
                            fontWeight: '500',
                            display: 'inline-block',
                            marginRight: '8px',
                            marginBottom: '8px'
                          }}>
                            {kpa}
                          </span>
                        )
                      )
                    : (
                      <div style={{marginTop: '20px'}}>
                        <h4>KPA Mapping</h4>
                        <div style={{display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px'}}>
                          {selectedProposal.proposedData.kpa_mapping.map((kpa, idx) => (
                            <span key={idx} style={{
                              padding: '4px 12px',
                              backgroundColor: '#e3f2fd',
                              color: '#1976d2',
                              borderRadius: '4px',
                              fontSize: '13px',
                              fontWeight: '500'
                            }}>
                              {kpa}
                            </span>
                          ))}
                        </div>
                      </div>
                    )
                )}

                {/* Prerequisites */}
                {selectedProposal.proposedData.prerequisites && selectedProposal.proposedData.prerequisites.length > 0 && (
                  <div style={{marginTop: '20px'}}>
                    <h4>Prerequisites</h4>
                    <div style={{display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px'}}>
                      {selectedProposal.proposedData.prerequisites.map((prereq, idx) => (
                        <span key={idx} style={{
                          padding: '4px 12px',
                          border: '1px solid #1976d2',
                          color: '#1976d2',
                          borderRadius: '4px',
                          fontSize: '13px'
                        }}>
                          {prereq}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Knowledge Required */}
                {(selectedProposal.proposedData.knowledge_required && selectedProposal.proposedData.knowledge_required.length > 0) && (
                  selectedProposal.proposalType === 'UPDATE' && selectedProposal.existingCourse
                    ? renderArrayComparison(
                        'Knowledge Required',
                        selectedProposal.existingCourse.knowledge_required || [],
                        selectedProposal.proposedData.knowledge_required,
                        (knowledge, idx, type) => (
                          <li key={idx} style={{
                            marginBottom: '8px',
                            color: type === 'removed' ? '#721c24' : type === 'added' ? '#155724' : '#333',
                            backgroundColor: type === 'removed' ? '#f8d7da' : type === 'added' ? '#d4edda' : 'transparent',
                            padding: type !== 'unchanged' ? '6px 10px' : '2px 0',
                            borderRadius: '4px',
                            textDecoration: type === 'removed' ? 'line-through' : 'none'
                          }}>{knowledge}</li>
                        )
                      )
                    : (
                      <div style={{marginTop: '20px'}}>
                        <h4>Knowledge Required</h4>
                        <ul style={{marginTop: '10px', paddingLeft: '20px'}}>
                          {selectedProposal.proposedData.knowledge_required.map((knowledge, idx) => (
                            <li key={idx} style={{marginBottom: '5px'}}>{knowledge}</li>
                          ))}
                        </ul>
                      </div>
                    )
                )}

                {/* Course Objectives */}
                {(selectedProposal.proposedData.course_objectives && selectedProposal.proposedData.course_objectives.length > 0) && (
                  selectedProposal.proposalType === 'UPDATE' && selectedProposal.existingCourse
                    ? renderArrayComparison(
                        'Course Objectives',
                        selectedProposal.existingCourse.course_objectives || [],
                        selectedProposal.proposedData.course_objectives,
                        (objective, idx, type) => (
                          <li key={idx} style={{
                            marginBottom: '8px',
                            color: type === 'removed' ? '#721c24' : type === 'added' ? '#155724' : '#333',
                            backgroundColor: type === 'removed' ? '#f8d7da' : type === 'added' ? '#d4edda' : 'transparent',
                            padding: type !== 'unchanged' ? '8px 10px' : '2px 0',
                            borderRadius: '4px',
                            textDecoration: type === 'removed' ? 'line-through' : 'none'
                          }}>{objective}</li>
                        )
                      )
                    : (
                      <div style={{marginTop: '20px'}}>
                        <h4>Course Objectives</h4>
                        <ol style={{marginTop: '10px', paddingLeft: '20px'}}>
                          {selectedProposal.proposedData.course_objectives.map((objective, idx) => (
                            <li key={idx} style={{marginBottom: '8px'}}>{objective}</li>
                          ))}
                        </ol>
                      </div>
                    )
                )}

                {/* Course Details */}
                {(selectedProposal.proposedData.course_content && selectedProposal.proposedData.course_content.length > 0) && (
                  selectedProposal.proposalType === 'UPDATE' && selectedProposal.existingCourse
                    ? (() => {
                        const oldContent = selectedProposal.existingCourse.course_content || [];
                        const newContent = selectedProposal.proposedData.course_content;
                        
                        // Create a comparison key for each content item
                        const getContentKey = (c) => `${c.concept_name}|||${c.concept_description}`;
                        const oldSet = new Set(oldContent.map(getContentKey));
                        const newSet = new Set(newContent.map(getContentKey));
                        
                        const removed = oldContent.filter(c => !newSet.has(getContentKey(c)));
                        const added = newContent.filter(c => !oldSet.has(getContentKey(c)));
                        const unchanged = newContent.filter(c => oldSet.has(getContentKey(c)));
                        
                        const hasChanges = removed.length > 0 || added.length > 0;

                        return (
                          <div style={{marginTop: '20px'}}>
                            <h4>Course Details {hasChanges && <span style={{color: '#ffc107', fontSize: '14px', marginLeft: '8px'}}>✦ Modified</span>}</h4>
                            {hasChanges && (
                              <div style={{
                                backgroundColor: '#fff3cd',
                                padding: '12px',
                                borderRadius: '6px',
                                border: '2px solid #ffc107',
                                marginTop: '10px'
                              }}>
                                {removed.length > 0 && (
                                  <div style={{marginBottom: removed.length > 0 && added.length > 0 ? '12px' : '0'}}>
                                    <div style={{color: '#dc3545', fontWeight: 600, marginBottom: '6px', fontSize: '14px'}}>🗑 Removed:</div>
                                    {removed.map((content, idx) => (
                                      <div key={idx} style={{
                                        marginBottom: '12px',
                                        padding: '10px',
                                        backgroundColor: '#f8d7da',
                                        border: '1px solid #dc3545',
                                        borderRadius: '4px',
                                        textDecoration: 'line-through'
                                      }}>
                                        <h5 style={{margin: '0 0 5px 0', color: '#721c24'}}>
                                          {content.concept_name}
                                        </h5>
                                        <p style={{margin: '0', fontSize: '14px', color: '#721c24'}}>
                                          {content.concept_description}
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {added.length > 0 && (
                                  <div>
                                    <div style={{color: '#28a745', fontWeight: 600, marginBottom: '6px', fontSize: '14px'}}>✅ Added:</div>
                                    {added.map((content, idx) => (
                                      <div key={idx} style={{
                                        marginBottom: '12px',
                                        padding: '10px',
                                        backgroundColor: '#d4edda',
                                        border: '1px solid #28a745',
                                        borderRadius: '4px'
                                      }}>
                                        <h5 style={{margin: '0 0 5px 0', color: '#155724'}}>
                                          {content.concept_name}
                                        </h5>
                                        <p style={{margin: '0', fontSize: '14px', color: '#155724'}}>
                                          {content.concept_description}
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                            {unchanged.length > 0 && (
                              <div style={{marginTop: hasChanges ? '12px' : '10px'}}>
                                <div style={{color: '#666', fontWeight: 500, marginBottom: '6px', fontSize: '13px'}}>Unchanged:</div>
                                {unchanged.map((content, idx) => (
                                  <div key={idx} style={{marginBottom: '12px', padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '4px'}}>
                                    <h5 style={{margin: '0 0 5px 0', color: '#333'}}>
                                      {content.concept_name}
                                    </h5>
                                    <p style={{margin: '0', fontSize: '14px', color: '#666'}}>
                                      {content.concept_description}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })()
                    : (
                      <div style={{marginTop: '20px'}}>
                        <h4>Course Details</h4>
                        <div style={{marginTop: '10px'}}>
                          {selectedProposal.proposedData.course_content.map((content, idx) => (
                            <div key={idx} style={{marginBottom: '15px', padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '4px'}}>
                              <h5 style={{margin: '0 0 5px 0', color: '#333'}}>{idx + 1}. {content.concept_name}</h5>
                              <p style={{margin: '0', fontSize: '14px', color: '#666'}}>{content.concept_description}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                )}

                {/* Course Outcomes */}
                {(selectedProposal.proposedData.courseOutcomes && selectedProposal.proposedData.courseOutcomes.length > 0) && (
                  selectedProposal.proposalType === 'UPDATE' && selectedProposal.existingCourse
                    ? renderCourseOutcomesComparison(
                        selectedProposal.existingCourse.courseOutcomes || [],
                        selectedProposal.proposedData.courseOutcomes
                      )
                    : (
                      <div style={{marginTop: '20px'}}>
                        <h4>Course Outcomes ({selectedProposal.proposedData.courseOutcomes.length})</h4>
                        <div style={{marginTop: '10px', overflowX: 'auto'}}>
                          <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '13px'}}>
                            <thead>
                              <tr style={{backgroundColor: '#f5f5f5'}}>
                                <th style={{padding: '8px', border: '1px solid #ddd', textAlign: 'left'}}>CO</th>
                                <th style={{padding: '8px', border: '1px solid #ddd', textAlign: 'left'}}>Description</th>
                                <th style={{padding: '8px', border: '1px solid #ddd', textAlign: 'left'}}>PO Mappings</th>
                                <th style={{padding: '8px', border: '1px solid #ddd', textAlign: 'left'}}>Taxonomy</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedProposal.proposedData.courseOutcomes.map((co, idx) => (
                                <tr key={idx}>
                                  <td style={{padding: '8px', border: '1px solid #ddd'}}>{co.co_code}</td>
                                  <td style={{padding: '8px', border: '1px solid #ddd'}}>{co.description}</td>
                                  <td style={{padding: '8px', border: '1px solid #ddd'}}>
                                    {co.po_mappings && co.po_mappings.length > 0 
                                      ? co.po_mappings.map(m => {
                                          const letter = m.program_outcome_code.split('_')[1]?.toLowerCase() || '';
                                          return `PO(${letter})`;
                                        }).join(', ')
                                      : '-'
                                    }
                                  </td>
                                  <td style={{padding: '8px', border: '1px solid #ddd'}}>
                                    {co.taxonomy_levels && co.taxonomy_levels.length > 0 
                                      ? co.taxonomy_levels.join(', ')
                                      : '-'
                                    }
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )
                )}

                {/* Lecture Plan */}
                {(selectedProposal.proposedData.lecture_plan && selectedProposal.proposedData.lecture_plan.length > 0) && (
                  selectedProposal.proposalType === 'UPDATE' && selectedProposal.existingCourse
                    ? renderLecturePlanComparison(
                        selectedProposal.existingCourse.lecture_plan || [],
                        selectedProposal.proposedData.lecture_plan
                      )
                    : (
                      <div style={{marginTop: '20px'}}>
                        <h4>Lecture Plan</h4>
                        <div style={{marginTop: '10px', overflowX: 'auto'}}>
                          <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '13px'}}>
                            <thead>
                              <tr style={{backgroundColor: '#f5f5f5'}}>
                                <th style={{padding: '8px', border: '1px solid #ddd', width: '80px'}}>Week</th>
                                <th style={{padding: '8px', border: '1px solid #ddd', textAlign: 'left'}}>Plan</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedProposal.proposedData.lecture_plan.map((lecture, idx) => (
                                <tr key={idx}>
                                  <td style={{padding: '8px', border: '1px solid #ddd', textAlign: 'center'}}>Week {lecture.week}</td>
                                  <td style={{padding: '8px', border: '1px solid #ddd'}}>{lecture.plan}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )
                )}

                {/* References */}
                {selectedProposal.proposedData.references && selectedProposal.proposedData.references.length > 0 && (
                  <div style={{marginTop: '20px'}}>
                    <h4>References</h4>
                    <ol style={{marginTop: '10px', paddingLeft: '20px'}}>
                      {selectedProposal.proposedData.references.map((reference, idx) => (
                        <li key={idx} style={{marginBottom: '8px', fontSize: '14px'}}>{reference}</li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>

              {selectedProposal.status === 'PENDING' && (
                <div className="review-section">
                  <label htmlFor="reviewComment">
                    <strong>Review Comment {selectedProposal.status === 'PENDING' && '(Optional for approval, required for rejection)'}:</strong>
                  </label>
                  <textarea
                    id="reviewComment"
                    value={reviewComment}
                    onChange={(e) => {
                      setReviewComment(e.target.value);
                      if (reviewError) setReviewError('');
                    }}
                    placeholder="Add a comment about this proposal..."
                    rows={4}
                    disabled={loading}
                  />
                  {reviewError && (
                    <div style={{
                      color: '#dc3545',
                      fontSize: '13px',
                      marginTop: '6px'
                    }}>
                      {reviewError}
                    </div>
                  )}
                </div>
              )}

              {selectedProposal.reviewedBy && selectedProposal.reviewComment && (
                <div className="review-history">
                  <strong>Review by {selectedProposal.reviewedBy.name}:</strong>
                  <p>{selectedProposal.reviewComment}</p>
                  <small>Reviewed on {new Date(selectedProposal.updatedAt).toLocaleDateString()}</small>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button 
                className="btn btn-outline"
                onClick={() => setShowProposalDetail(false)}
                disabled={loading}
              >
                Close
              </button>
              {selectedProposal.status === 'PENDING' && (
                <>
                  <button 
                    className="btn btn-danger"
                    onClick={handleRejectProposal}
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <div className="spinner spinner-small"></div>
                        Rejecting...
                      </>
                    ) : (
                      <>
                        <FontAwesomeIcon icon={faTimes} /> Reject
                      </>
                    )}
                  </button>
                  <button 
                    className="btn btn-approve"
                    onClick={handleApproveProposal}
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <div className="spinner spinner-small"></div>
                        Approving...
                      </>
                    ) : (
                      <>
                        <FontAwesomeIcon icon={faCheck} /> Approve
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
