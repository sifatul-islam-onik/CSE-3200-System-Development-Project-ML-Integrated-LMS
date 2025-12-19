import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUser, logout } from '../components/ProtectedRoute';
import { getPendingUsers, approveUser, rejectUser } from '../services/adminService';
import { createCourse, getAllCourses } from '../services/courseService';
import CourseForm from '../components/CourseForm';
import '../styles/Dashboard.css';
import '../styles/AdminDashboard.css';
import '../styles/spinner.css';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [activeSection, setActiveSection] = useState('pending');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [courseFormLoading, setCourseFormLoading] = useState(false);

  useEffect(() => {
    const userData = getUser();
    setUser(userData);
  }, []);

  useEffect(() => {
    if (activeSection === 'pending') {
      fetchPendingUsers();
    } else if (activeSection === 'courses') {
      fetchCourses();
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

  const handleCreateCourse = async (courseData) => {
    setCourseFormLoading(true);
    try {
      await createCourse(courseData);
      setSuccessMessage('Course created successfully');
      setShowCourseForm(false);
      fetchCourses();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create course');
      setTimeout(() => setError(''), 3000);
    } finally {
      setCourseFormLoading(false);
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
                  <div className="empty-icon">✓</div>
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

      case 'courses':
        return (
          <div className="section-container">
            <div className="section-header">
              <h2>Course Management</h2>
              <button 
                className="btn btn-primary"
                onClick={() => setShowCourseForm(true)}
              >
                Create New Course
              </button>
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
                  <p>Loading courses...</p>
                </div>
              ) : courses.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📚</div>
                  <h3>No Courses Yet</h3>
                  <p>Create your first course to get started</p>
                </div>
              ) : (
                <div className="courses-grid">
                  {courses.map((course) => (
                    <div key={course._id} className="course-card">
                      <div className="course-card-header">
                        <div className="course-code">{course.courseCode}</div>
                        <span className={`status-badge ${course.isPublished ? 'published' : 'draft'}`}>
                          {course.isPublished ? 'Published' : 'Draft'}
                        </span>
                      </div>
                      <div className="course-card-body">
                        <h3>{course.courseTitle}</h3>
                        <div className="course-meta">
                          <span>Type: {course.courseType}</span>
                          <span>Credit: {course.credit}</span>
                          <span>Dept: {course.department}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {showCourseForm && (
              <CourseForm 
                onClose={() => setShowCourseForm(false)}
                onSubmit={handleCreateCourse}
                loading={courseFormLoading}
              />
            )}
          </div>
        );

      case 'users':
        return (
          <div className="section-container">
            <div className="section-header">
              <h2>All Users</h2>
              <p>Manage all registered users</p>
            </div>
            <div className="section-body">
              <div className="empty-state">
                <div className="empty-icon">👥</div>
                <h3>User Management</h3>
                <p>This section is under development</p>
              </div>
            </div>
          </div>
        );

      case 'settings':
        return (
          <div className="section-container">
            <div className="section-header">
              <h2>Settings</h2>
              <p>Configure system settings</p>
            </div>
            <div className="section-body">
              <div className="empty-state">
                <div className="empty-icon">⚙️</div>
                <h3>System Settings</h3>
                <p>This section is under development</p>
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
      <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <h1>LMS Admin</h1>
          <button 
            className="sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? '←' : '→'}
          </button>
        </div>

        <nav className="sidebar-nav">
          <button
            className={`nav-item ${activeSection === 'pending' ? 'active' : ''}`}
            onClick={() => setActiveSection('pending')}
          >
            <span className="nav-icon">⏳</span>
            {sidebarOpen && <span className="nav-label">Pending Approvals</span>}
          </button>

          <button
            className={`nav-item ${activeSection === 'courses' ? 'active' : ''}`}
            onClick={() => setActiveSection('courses')}
          >
            <span className="nav-icon">📚</span>
            {sidebarOpen && <span className="nav-label">Course Management</span>}
          </button>

          <button
            className={`nav-item ${activeSection === 'users' ? 'active' : ''}`}
            onClick={() => setActiveSection('users')}
          >
            <span className="nav-icon">👥</span>
            {sidebarOpen && <span className="nav-label">All Users</span>}
          </button>

          <button
            className={`nav-item ${activeSection === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveSection('settings')}
          >
            <span className="nav-icon">⚙️</span>
            {sidebarOpen && <span className="nav-label">Settings</span>}
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            {user && sidebarOpen && (
              <>
                <div className="user-avatar-small">
                  {user.name?.charAt(0).toUpperCase()}
                </div>
                <div className="user-details-small">
                  <p className="user-name">{user.name}</p>
                  <p className="user-role">{user.role}</p>
                </div>
              </>
            )}
          </div>
          <button className="btn btn-logout" onClick={handleLogout}>
            {sidebarOpen ? 'Logout' : '↪'}
          </button>
        </div>
      </aside>

      <main className="main-content">
        <div className="content-wrapper">
          {renderSection()}
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
