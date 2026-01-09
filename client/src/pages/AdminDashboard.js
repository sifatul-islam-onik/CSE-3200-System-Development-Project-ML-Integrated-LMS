import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faTimes, faChartBar, faEdit, faBookOpen, faPlus, faHourglass, faUsers, faCog, faSignOutAlt, faTrash, faClipboardList, faChevronRight, faUser, faEye } from '@fortawesome/free-solid-svg-icons';
import { getUser, logout } from '../components/ProtectedRoute';
import { getPendingUsers, approveUser, rejectUser, getAllUsers, importStudentsFromExcel, setUserStatus, deleteUser, exportStudentCredentials, importTeachersFromExcel, exportTeacherCredentials, setUserDesignation, assignTeacherToCourse, unassignTeacherFromCourse, getAssignedTeachers } from '../services/adminService';
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
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [selectedCourseForAssignment, setSelectedCourseForAssignment] = useState(null);
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [assignmentError, setAssignmentError] = useState('');
  const [assignmentSuccess, setAssignmentSuccess] = useState('');
  const [teacherFilter, setTeacherFilter] = useState('');

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
      setAvailableDepartments(Array.from(depts).sort());
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
      setExportError('Please enter batch year and select department');
      setTimeout(() => setExportError(''), 3000);
      return;
    }

    if (!/^\d{4}$/.test(exportBatchYear)) {
      setExportError('Batch year must be 4 digits (e.g., 2019)');
      setTimeout(() => setExportError(''), 3000);
      return;
    }

    const confirmed = window.confirm(
      `Export original credentials for batch ${exportBatchYear} (dept ${exportDeptCode}). Proceed?`
    );
    if (!confirmed) return;

    setExportLoading(true);
    setExportError('');
    setExportMessage('');

    try {
      const blob = await exportStudentCredentials(exportBatchYear, exportDeptCode);
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `students_${exportBatchYear}_${exportDeptCode}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setExportMessage('Credentials exported successfully.');
      setExportBatchYear('');
      setExportDeptCode('');
      setTimeout(() => setExportMessage(''), 5000);
    } catch (err) {
      setExportError(err.response?.data?.message || 'Failed to export credentials');
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
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

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

  const handleAssignTeacher = async (teacherId, section = null) => {
    if (!selectedCourseForAssignment) return;
    
    setAssignmentLoading(true);
    setAssignmentError('');
    setAssignmentSuccess('');
    
    try {
      const response = await assignTeacherToCourse(selectedCourseForAssignment._id, teacherId, section);
      setAssignmentSuccess(`Teacher assigned successfully${section ? ` to section ${section}` : ''}`);
      
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
      setAssignmentError(err.response?.data?.message || 'Failed to assign teacher');
      setTimeout(() => setAssignmentError(''), 3000);
    } finally {
      setAssignmentLoading(false);
    }
  };

  const handleUnassignTeacher = async (teacherId, section = null) => {
    if (!selectedCourseForAssignment) return;
    
    setAssignmentLoading(true);
    setAssignmentError('');
    setAssignmentSuccess('');
    
    try {
      const response = await unassignTeacherFromCourse(selectedCourseForAssignment._id, teacherId, section);
      setAssignmentSuccess(`Teacher unassigned successfully${section ? ` from section ${section}` : ''}`);
      
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
                      return (
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
                                  <span className="course-title">{course.courseTitle}</span>
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
                                  <FontAwesomeIcon icon={faUsers} /> Assign
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

              <div className="proposal-card" style={{ marginBottom: '16px' }}>
                <div className="proposal-header" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '16px' }}>Manage Specific User</h3>
                    <p style={{ margin: '6px 0 0', color: '#6b7280', fontSize: '13px' }}>Search by email, roll number, or user ID to deactivate or delete an account</p>
                  </div>
                </div>
                <div className="proposal-body" style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    placeholder="Email, Roll, or User ID"
                    value={userLookupInput}
                    onChange={(e) => {
                      setUserLookupInput(e.target.value);
                      setLookupError('');
                    }}
                    style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '4px', minWidth: '250px', flex: '1' }}
                  />
                  <button
                    className="btn btn-primary"
                    onClick={handleLookupUser}
                    disabled={lookupLoading}
                  >
                    {lookupLoading ? 'Searching...' : 'Search'}
                  </button>
                </div>
                {lookupUser && (
                  <div style={{ marginTop: '16px' }}>
                    <div className="user-card" style={{ maxWidth: '500px' }}>
                      <div className="user-card-header">
                        <div className="user-avatar">{lookupUser.name?.charAt(0)?.toUpperCase()}</div>
                        <div className="user-info">
                          <h3>{lookupUser.name}</h3>
                          <p className="user-email">{lookupUser.email}</p>
                        </div>
                      </div>
                      <div className="user-card-body">
                        <div className="user-meta">
                          <span className={`role-badge ${(lookupUser.role || '').toLowerCase()}`}>{(lookupUser.role || '').toLowerCase()}</span>
                          {lookupUser.roll && <span className="user-date">Roll: {lookupUser.roll}</span>}
                          {lookupUser.createdAt && (
                            <span className="user-date">Joined {new Date(lookupUser.createdAt).toLocaleDateString()}</span>
                          )}
                        </div>
                        {(lookupUser.role || '').toLowerCase() === 'teacher' && (
                          <div style={{ marginTop: '10px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <label style={{ fontSize: '12px', color: '#6b7280' }}>Designation:</label>
                            <select
                              value={lookupDesignation}
                              onChange={(e) => setLookupDesignation(e.target.value)}
                              style={{ padding: '6px 10px', border: '1px solid #ddd', borderRadius: '4px' }}
                              disabled={lookupDesignationSaving}
                            >
                              <option value="Professor">Professor</option>
                              <option value="Assistant Professor">Assistant Professor</option>
                              <option value="Lecturer">Lecturer</option>
                            </select>
                            <button
                              className="btn btn-sm btn-primary"
                              onClick={async () => {
                                try {
                                  setLookupDesignationSaving(true);
                                  const result = await setUserDesignation(lookupUser._id, lookupDesignation);
                                  // Update local state and users list
                                  const updated = { ...lookupUser, designation: result.data?.designation || lookupDesignation };
                                  setLookupUser(updated);
                                  // Also update users list entry
                                  setUsers(prev => prev.map(u => u._id === updated._id ? { ...u, designation: updated.designation } : u));
                                  setSuccessMessage('Designation updated');
                                  setTimeout(() => setSuccessMessage(''), 3000);
                                } catch (err) {
                                  setLookupError(err.response?.data?.message || 'Failed to update designation');
                                } finally {
                                  setLookupDesignationSaving(false);
                                }
                              }}
                              disabled={lookupDesignationSaving}
                            >
                              {lookupDesignationSaving ? 'Saving...' : 'Save'}
                            </button>
                          </div>
                        )}
                        <div className="user-status">
                          <span className={`status-badge ${lookupUser.isActive ? 'active' : 'inactive'}`}>{lookupUser.isActive ? 'Active' : 'Inactive'}</span>
                        </div>
                      </div>
                      <div className="user-card-actions">
                        <button
                          className={`btn btn-sm ${lookupUser.isActive ? 'btn-secondary' : 'btn-approve'}`}
                          onClick={() => handleLookupUserAction('toggle')}
                          disabled={lookupLoading}
                        >
                          {lookupLoading ? 'Working...' : lookupUser.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleLookupUserAction('delete')}
                          disabled={lookupLoading}
                        >
                          {lookupLoading ? 'Working...' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                {(lookupError) && (
                  <div style={{ marginTop: '10px' }}>
                    <div className="alert alert-error">{lookupError}</div>
                  </div>
                )}
              </div>

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
                            <p style={{ margin: '6px 0 0', color: '#6b7280', fontSize: '13px' }}>Export emails and original passwords for a specific batch and department</p>
                          </div>
                        </div>
                        <div className="proposal-body" style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                          <input
                            type="text"
                            placeholder="Batch Year (e.g., 2019)"
                            value={exportBatchYear}
                            onChange={(e) => {
                              setExportBatchYear(e.target.value);
                              setExportError('');
                              setExportMessage('');
                            }}
                            style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '4px', width: '180px' }}
                          />
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
                            <p style={{ margin: '6px 0 0', color: '#6b7280', fontSize: '13px' }}>Columns: Full Name, Name (for email), and Dept</p>
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
                            <p style={{ margin: '6px 0 0', color: '#6b7280', fontSize: '13px' }}>Select a department and export teacher emails and passwords</p>
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
                    </>
                  )}
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
                                const response = await fetch('http://localhost:5000/api/auth/profile/update', {
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
                                const response = await fetch('http://localhost:5000/api/auth/profile/update', {
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

                  <div style={{display: 'flex', gap: '10px'}}>
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

                          const response = await fetch('http://localhost:5000/api/auth/profile/update', {
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
          <button 
            className="btn btn-logout" 
            onClick={handleLogout}
            title="Logout"
          >
            <span className="logout-icon"><FontAwesomeIcon icon={faSignOutAlt} /></span>
            {sidebarOpen && <span>Logout</span>}
          </button>
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
                  {selectedCourseForAssignment.course_type === 'THEORY' && ' • Requires Section Selection'}
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
                  {selectedCourseForAssignment.course_type === 'THEORY' && (
                    <span style={{fontSize: '12px', fontWeight: 400, color: '#6b7280', marginLeft: '8px'}}>
                      (Sections A & B)
                    </span>
                  )}
                </h4>
                {selectedCourseForAssignment.assignedTeachers && selectedCourseForAssignment.assignedTeachers.length > 0 ? (
                  <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                    {selectedCourseForAssignment.assignedTeachers.map((assignment, idx) => {
                      const teacher = assignment.teacher || assignment;
                      const section = assignment.section;
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
                            <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                              <span style={{fontWeight: 500, fontSize: '14px', color: '#1f2937'}}>
                                {teacher.name}
                              </span>
                              {section && (
                                <span style={{
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  color: '#fff',
                                  backgroundColor: section === 'A' ? '#3b82f6' : '#10b981',
                                  padding: '2px 8px',
                                  borderRadius: '4px'
                                }}>
                                  Section {section}
                                </span>
                              )}
                            </div>
                            <div style={{fontSize: '12px', color: '#6b7280', marginTop: '2px'}}>
                              {teacher.email}
                              {teacher.designation && ` • ${teacher.designation}`}
                            </div>
                          </div>
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => handleUnassignTeacher(teacher._id, section)}
                            disabled={assignmentLoading}
                            style={{fontSize: '12px', padding: '6px 12px'}}
                          >
                            Remove
                          </button>
                        </div>
                      );
                    })}
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
                    No teachers assigned yet
                  </div>
                )}
              </div>

              {/* Available Teachers to Assign */}
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
                  
                  // Get assigned sections for theory courses
                  const assignedSections = selectedCourseForAssignment.course_type === 'THEORY'
                    ? (selectedCourseForAssignment.assignedTeachers || []).map(a => a.section)
                    : [];
                  
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
                        No available teachers to assign
                      </div>
                    );
                  }

                  const isTheory = selectedCourseForAssignment.course_type?.toUpperCase() === 'THEORY';
                  
                  console.log('Course type:', selectedCourseForAssignment.course_type, 'isTheory:', isTheory);

                  return (
                    <div style={{
                      maxHeight: '250px',
                      overflowY: 'auto',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}>
                      {availableTeachers.map((teacher) => (
                        <div 
                          key={teacher._id}
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
                            </div>
                            <div style={{fontSize: '12px', color: '#6b7280'}}>
                              {teacher.email}
                              {teacher.designation && ` • ${teacher.designation}`}
                            </div>
                          </div>
                          {isTheory ? (
                            <div style={{display: 'flex', gap: '6px'}}>
                              <button
                                className="btn btn-sm btn-primary"
                                onClick={() => handleAssignTeacher(teacher._id, 'A')}
                                disabled={assignmentLoading || assignedSections.includes('A')}
                                style={{fontSize: '12px', padding: '6px 10px', minWidth: '65px'}}
                                title={assignedSections.includes('A') ? 'Section A already assigned' : 'Assign to Section A'}
                              >
                                Sec A
                              </button>
                              <button
                                className="btn btn-sm btn-primary"
                                onClick={() => handleAssignTeacher(teacher._id, 'B')}
                                disabled={assignmentLoading || assignedSections.includes('B')}
                                style={{fontSize: '12px', padding: '6px 10px', minWidth: '65px'}}
                                title={assignedSections.includes('B') ? 'Section B already assigned' : 'Assign to Section B'}
                              >
                                Sec B
                              </button>
                            </div>
                          ) : (
                            <button
                              className="btn btn-sm btn-primary"
                              onClick={() => handleAssignTeacher(teacher._id, null)}
                              disabled={assignmentLoading}
                              style={{fontSize: '12px', padding: '6px 12px'}}
                            >
                              Assign
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
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
