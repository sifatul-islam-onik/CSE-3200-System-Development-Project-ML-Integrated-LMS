import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faTimes, faBook, faStar, faUniversity, faChartBar, faEdit, faBookOpen, faPlus, faGraduationCap, faHourglass, faUsers, faCog, faSignOutAlt, faTrash, faClipboardList } from '@fortawesome/free-solid-svg-icons';
import { getUser, logout } from '../components/ProtectedRoute';
import { getPendingUsers, approveUser, rejectUser } from '../services/adminService';
import { createCourse, getAllCourses, updateCourse, deleteCourse } from '../services/courseService';
import { getAllProposals, getProposalById, approveProposal, rejectProposal } from '../services/courseProposalService';
import CourseForm from '../components/CourseForm';
import CourseOBEView from '../components/CourseOBEView';
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

  useEffect(() => {
    const userData = getUser();
    setUser(userData);
    // Fetch initial data for badge counts
    fetchPendingUsers();
    fetchProposals();
  }, []);

  useEffect(() => {
    if (activeSection === 'pending') {
      fetchPendingUsers();
    } else if (activeSection === 'courses') {
      fetchCourses();
    } else if (activeSection === 'proposals') {
      fetchProposals();
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
      setProposals(response.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch proposals');
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
      setError(err.response?.data?.message || 'Failed to create course');
      setTimeout(() => setError(''), 3000);
    } finally {
      setCourseFormLoading(false);
    }
  };

  const handleUpdateCourse = async (courseData) => {
    setCourseFormLoading(true);
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
      if (err.response?.data?.errors) {
        console.error('Validation Errors:', JSON.stringify(err.response.data.errors, null, 2));
      }
      setError(err.response?.data?.message || 'Failed to update course');
      setTimeout(() => setError(''), 3000);
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

  const handleViewProposal = async (proposalId) => {
    setLoading(true);
    try {
      const response = await getProposalById(proposalId);
      setSelectedProposal(response.data);
      setShowProposalDetail(true);
      setReviewComment('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch proposal details');
      setTimeout(() => setError(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveProposal = async () => {
    if (!selectedProposal) return;
    
    setLoading(true);
    try {
      await approveProposal(selectedProposal._id, reviewComment);
      setSuccessMessage('Course proposal approved successfully');
      setShowProposalDetail(false);
      setSelectedProposal(null);
      fetchProposals();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to approve proposal');
      setTimeout(() => setError(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleRejectProposal = async () => {
    if (!selectedProposal || !reviewComment.trim()) {
      setError('Please provide a reason for rejection');
      setTimeout(() => setError(''), 3000);
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
      setError(err.response?.data?.message || 'Failed to reject proposal');
      setTimeout(() => setError(''), 3000);
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
                  <h3>No Course Proposals</h3>
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
                <div className="courses-grid">
                  {courses.map((course) => (
                    <div key={course._id} className="course-card">
                      <div className="course-card-header">
                        <div className="course-code-wrapper">
                          <span className="course-code">{course.courseCode}</span>
                        </div>
                      </div>
                      <div className="course-card-body">
                        <h3 className="course-title">{course.courseTitle}</h3>
                        <div className="course-meta">
                          <span className="meta-item">
                            <span className="meta-icon"><FontAwesomeIcon icon={faBook} /></span>
                            {course.course_type || 'N/A'}
                          </span>
                          <span className="meta-item">
                            <span className="meta-icon"><FontAwesomeIcon icon={faStar} /></span>
                            {course.credit} Credits
                          </span>
                          <span className="meta-item">
                            <span className="meta-icon"><FontAwesomeIcon icon={faUniversity} /></span>
                            {course.course_offered_to || 'N/A'}
                          </span>
                        </div>
                        {course.semester && (
                          <div className="course-extra-info">
                            <span>Semester {course.semester}</span>
                            {course.yearLevel && <span>• Year {course.yearLevel}</span>}
                          </div>
                        )}
                        {course.courseOutcomes && course.courseOutcomes.length > 0 && (
                          <div className="course-obe-indicator">
                            <span className="obe-badge">
                              <span className="obe-icon"><FontAwesomeIcon icon={faCheck} /></span>
                              {course.courseOutcomes.length} Course Outcomes
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="course-card-actions">
                        <button 
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setSelectedCourse(course);
                            setShowOBEView(true);
                          }}
                        >
                          <FontAwesomeIcon icon={faChartBar} /> View Details
                        </button>
                        <button 
                          className="btn btn-outline btn-sm"
                          onClick={() => {
                            setEditingCourse(course);
                            setShowCourseForm(true);
                          }}
                        >
                          <FontAwesomeIcon icon={faEdit} /> Edit
                        </button>
                        <button 
                          className="btn btn-danger btn-sm"
                          onClick={() => openDeleteModal(course)}
                        >
                          <FontAwesomeIcon icon={faTrash} /> Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
                <div className="empty-icon"><FontAwesomeIcon icon={faUsers} /></div>
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
          <div className="logo-section">
            <span className="logo-icon"><FontAwesomeIcon icon={faGraduationCap} /></span>
            {sidebarOpen && <h1>LMS Admin</h1>}
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
            onClick={() => setActiveSection('pending')}
          >
            <span className="nav-icon"><FontAwesomeIcon icon={faHourglass} /></span>
            {sidebarOpen && <span className="nav-label">Pending Approvals</span>}
            {sidebarOpen && pendingUsers.length > 0 && (
              <span className="badge-count">{pendingUsers.length}</span>
            )}
          </button>

          <button
            className={`nav-item ${activeSection === 'proposals' ? 'active' : ''}`}
            onClick={() => setActiveSection('proposals')}
          >
            <span className="nav-icon"><FontAwesomeIcon icon={faClipboardList} /></span>
            {sidebarOpen && <span className="nav-label">Course Proposals</span>}
            {sidebarOpen && proposals.filter(p => p.status === 'PENDING').length > 0 && (
              <span className="badge-count">{proposals.filter(p => p.status === 'PENDING').length}</span>
            )}
          </button>

          <button
            className={`nav-item ${activeSection === 'courses' ? 'active' : ''}`}
            onClick={() => setActiveSection('courses')}
          >
            <span className="nav-icon"><FontAwesomeIcon icon={faBookOpen} /></span>
            {sidebarOpen && <span className="nav-label">Courses</span>}
            {sidebarOpen && courses.length > 0 && (
              <span className="badge-info">{courses.length}</span>
            )}
          </button>

          <button
            className={`nav-item ${activeSection === 'users' ? 'active' : ''}`}
            onClick={() => setActiveSection('users')}
          >
            <span className="nav-icon"><FontAwesomeIcon icon={faUsers} /></span>
            {sidebarOpen && <span className="nav-label">All Users</span>}
          </button>

          <button
            className={`nav-item ${activeSection === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveSection('settings')}
          >
            <span className="nav-icon"><FontAwesomeIcon icon={faCog} /></span>
            {sidebarOpen && <span className="nav-label">Settings</span>}
          </button>
        </nav>

        <div className="sidebar-footer">
          {user && (
            <div className="user-profile">
              <div className="user-avatar-small">
                {user.name?.charAt(0).toUpperCase()}
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
          }}
          onSubmit={editingCourse ? handleUpdateCourse : handleCreateCourse}
          loading={courseFormLoading}
          initialData={editingCourse}
          isEditMode={!!editingCourse}
        />
      )}

      {showOBEView && selectedCourse && (
        <CourseOBEView 
          course={selectedCourse}
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

      {/* Proposal Detail Modal */}
      {showProposalDetail && selectedProposal && (
        <div className="modal-overlay" onClick={() => !loading && setShowProposalDetail(false)}>
          <div className="modal-content proposal-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Course Proposal Details</h3>
              <button 
                className="close-btn" 
                onClick={() => setShowProposalDetail(false)}
                disabled={loading}
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            <div className="modal-body">
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

              <div className="course-details-section">
                <h4>Course Information</h4>
                <div className="details-grid">
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
                    <strong>Semester:</strong> {selectedProposal.proposedData.semester || 'N/A'}
                  </div>
                  {selectedProposal.proposedData.courseOutcomes && selectedProposal.proposedData.courseOutcomes.length > 0 && (
                    <div className="detail-item full-width">
                      <strong>Course Outcomes:</strong> {selectedProposal.proposedData.courseOutcomes.length} COs defined
                    </div>
                  )}
                </div>
              </div>

              {selectedProposal.status === 'PENDING' && (
                <div className="review-section">
                  <label htmlFor="reviewComment">
                    <strong>Review Comment {selectedProposal.status === 'PENDING' && '(Optional for approval, required for rejection)'}:</strong>
                  </label>
                  <textarea
                    id="reviewComment"
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder="Add a comment about this proposal..."
                    rows={4}
                    disabled={loading}
                  />
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
