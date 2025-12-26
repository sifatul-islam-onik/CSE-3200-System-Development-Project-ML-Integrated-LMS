import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBook, faPlus, faHourglass, faCheckCircle, faTimesCircle, faEye, faTrash, faEdit, faSignOutAlt, faChevronDown, faChevronRight, faClipboardList } from '@fortawesome/free-solid-svg-icons';
import { getUser, logout } from '../components/ProtectedRoute';
import { getMyProposals, createCourseProposal, deleteProposal } from '../services/courseProposalService';
import { getAllCourses } from '../services/courseService';
import CourseForm from '../components/CourseForm';
import CourseOBEView from '../components/CourseOBEView';
import '../styles/Dashboard.css';
import '../styles/AdminDashboard.css';
import '../styles/spinner.css';

const TeacherDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [activeSection, setActiveSection] = useState('overview');
  const [proposals, setProposals] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [courseFormLoading, setCourseFormLoading] = useState(false);
  const [proposalType, setProposalType] = useState('CREATE');
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [showOBEView, setShowOBEView] = useState(false);
  const [changeDescription, setChangeDescription] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [proposalsOpen, setProposalsOpen] = useState(true);

  useEffect(() => {
    const userData = getUser();
    setUser(userData);
    // Fetch initial data for badge counts
    fetchMyProposals();
  }, []);

  useEffect(() => {
    if (activeSection === 'proposals') {
      fetchMyProposals();
    } else if (activeSection === 'courses') {
      fetchCourses();
    }
  }, [activeSection]);

  const fetchMyProposals = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await getMyProposals();
      setProposals(response.data || []);
    } catch (err) {
      setError(err.message || 'Failed to fetch proposals');
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
      setError(err.message || 'Failed to fetch courses');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProposal = async (courseData) => {
    setCourseFormLoading(true);
    try {
      const proposalData = {
        proposalType,
        existingCourseId: proposalType === 'UPDATE' ? selectedCourse._id : undefined,
        courseData,
        changeDescription
      };
      
      await createCourseProposal(proposalData);
      setSuccessMessage('Course proposal submitted successfully! Waiting for admin approval.');
      setShowCourseForm(false);
      setSelectedCourse(null);
      setChangeDescription('');
      if (activeSection === 'proposals') {
        fetchMyProposals();
      }
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      setError(err.message || 'Failed to submit proposal');
      setTimeout(() => setError(''), 5000);
    } finally {
      setCourseFormLoading(false);
    }
  };

  const handleDeleteProposal = async (proposalId) => {
    if (!window.confirm('Are you sure you want to delete this proposal?')) return;
    
    try {
      await deleteProposal(proposalId);
      setSuccessMessage('Proposal deleted successfully');
      fetchMyProposals();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to delete proposal');
      setTimeout(() => setError(''), 3000);
    }
  };

  const openCreateProposal = () => {
    setProposalType('CREATE');
    setSelectedCourse(null);
    setChangeDescription('');
    setShowCourseForm(true);
  };

  const openEditProposal = (course) => {
    setProposalType('UPDATE');
    setSelectedCourse(course);
    setChangeDescription('');
    setShowCourseForm(true);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getStatusBadge = (status) => {
    const badges = {
      PENDING: { icon: faHourglass, class: 'status-pending', text: 'Pending' },
      APPROVED: { icon: faCheckCircle, class: 'status-approved', text: 'Approved' },
      REJECTED: { icon: faTimesCircle, class: 'status-rejected', text: 'Rejected' }
    };
    const badge = badges[status] || badges.PENDING;
    return (
      <span className={`status-badge ${badge.class}`}>
        <FontAwesomeIcon icon={badge.icon} /> {badge.text}
      </span>
    );
  };

  const renderSection = () => {
    switch (activeSection) {
      case 'overview':
        return (
          <div className="section-container">
            <div className="section-header">
              <h2>Welcome, {user?.name}!</h2>
              <p>Teacher Dashboard - Manage your course proposals</p>
            </div>
            <div className="dashboard-grid" style={{marginTop: '2rem'}}>
              <div className="dashboard-card">
                <div className="card-icon"><FontAwesomeIcon icon={faPlus} /></div>
                <h3>Propose New Course</h3>
                <p>Submit a proposal to create a new course</p>
                <button className="card-btn" onClick={openCreateProposal}>Create Proposal</button>
              </div>

              <div className="dashboard-card">
                <div className="card-icon"><FontAwesomeIcon icon={faEdit} /></div>
                <h3>Edit Course</h3>
                <p>Propose changes to existing courses</p>
                <button className="card-btn" onClick={() => setActiveSection('courses')}>View Courses</button>
              </div>

              <div className="dashboard-card">
                <div className="card-icon"><FontAwesomeIcon icon={faHourglass} /></div>
                <h3>My Proposals</h3>
                <p>Track status of your submitted proposals</p>
                <button className="card-btn" onClick={() => setActiveSection('proposals')}>View Proposals</button>
              </div>
            </div>
          </div>
        );

      case 'proposals':
        return (
          <div className="section-container">
            <div className="section-header">
              <h2>My Course Proposals</h2>
              <p>Track and manage your submitted proposals</p>
            </div>
            <div className="section-body">
              {successMessage && <div className="alert alert-success">{successMessage}</div>}
              {error && <div className="alert alert-error">{error}</div>}

              {loading ? (
                <div className="loading-container"><div className="spinner"></div></div>
              ) : proposals.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon"><FontAwesomeIcon icon={faBook} /></div>
                  <h3>No Proposals Yet</h3>
                  <p>You haven't submitted any course proposals</p>
                  <button className="btn btn-primary" onClick={openCreateProposal}>
                    <FontAwesomeIcon icon={faPlus} /> Create Proposal
                  </button>
                </div>
              ) : (
                <div className="proposals-list">
                  {proposals.map((proposal) => (
                    <div key={proposal._id} className="proposal-card">
                      <div className="proposal-header">
                        <div>
                          <h3>{proposal.proposedData.courseCode} - {proposal.proposedData.courseTitle}</h3>
                          <span className={`proposal-type-badge ${proposal.proposalType.toLowerCase()}`}>
                            {proposal.proposalType === 'CREATE' ? 'New Course' : 'Course Update'}
                          </span>
                        </div>
                        {getStatusBadge(proposal.status)}
                      </div>
                      <div className="proposal-body">
                        <div className="proposal-info">
                          <span><strong>Department:</strong> {proposal.proposedData.course_offered_to}</span>
                          <span><strong>Credits:</strong> {proposal.proposedData.credit}</span>
                          <span><strong>Type:</strong> {proposal.proposedData.course_type}</span>
                        </div>
                        {proposal.changeDescription && (
                          <div className="proposal-description">
                            <strong>Description:</strong> 
                            <span>{proposal.changeDescription}</span>
                          </div>
                        )}
                        <div className="proposal-meta">
                          <small>📅 Submitted: {new Date(proposal.createdAt).toLocaleDateString()}</small>
                          {proposal.status !== 'PENDING' && (
                            <small>✓ Reviewed: {new Date(proposal.updatedAt).toLocaleDateString()}</small>
                          )}
                        </div>
                        {proposal.status === 'REJECTED' && proposal.reviewComment && (
                          <div className="rejection-reason">
                            <strong>❌ Rejection Reason:</strong>
                            <span>{proposal.reviewComment}</span>
                          </div>
                        )}
                        {proposal.status === 'APPROVED' && proposal.reviewComment && (
                          <div className="approval-comment">
                            <strong>✓ Admin Comments:</strong>
                            <span>{proposal.reviewComment}</span>
                          </div>
                        )}
                      </div>
                      <div className="proposal-actions">
                        {proposal.status === 'PENDING' && (
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDeleteProposal(proposal._id)}
                          >
                            <FontAwesomeIcon icon={faTrash} /> Delete
                          </button>
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
              <h2>Existing Courses</h2>
              <p>Select a course to propose modifications</p>
            </div>
            <div className="section-body">
              {error && <div className="alert alert-error">{error}</div>}

              {loading ? (
                <div className="loading-container"><div className="spinner"></div></div>
              ) : courses.length === 0 ? (
                <div className="empty-state">
                  <h3>No Courses Available</h3>
                </div>
              ) : (
                <div className="courses-grid">
                  {courses.map((course) => (
                    <div key={course._id} className="course-card">
                      <div className="course-card-header">
                        <span className="course-code">{course.courseCode}</span>
                      </div>
                      <div className="course-card-body">
                        <h3 className="course-title">{course.courseTitle}</h3>
                        <div className="course-meta">
                          <span>{course.course_type}</span>
                          <span>{course.credit} Credits</span>
                        </div>
                      </div>
                      <div className="course-card-actions">
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => {
                            setSelectedCourse(course);
                            setShowOBEView(true);
                          }}
                        >
                          <FontAwesomeIcon icon={faEye} /> View
                        </button>
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => openEditProposal(course)}
                        >
                          <FontAwesomeIcon icon={faEdit} /> Propose Edit
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
            <span className="logo-icon"><FontAwesomeIcon icon={faBook} /></span>
            {sidebarOpen && <h1>Teacher Panel</h1>}
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
            className={`nav-item ${activeSection === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveSection('overview')}
          >
            <span className="nav-icon"><FontAwesomeIcon icon={faBook} /></span>
            {sidebarOpen && <span className="nav-label">Overview</span>}
          </button>
          
          {/* Collapsible Proposals Section */}
          <div className="nav-group">
            <button
              className={`nav-item nav-group-header ${(activeSection === 'proposals' || activeSection === 'create-proposal') ? 'active' : ''}`}
              onClick={() => setProposalsOpen(!proposalsOpen)}
            >
              <span className="nav-icon"><FontAwesomeIcon icon={faClipboardList} /></span>
              {sidebarOpen && <span className="nav-label">Course Proposals</span>}
              {sidebarOpen && proposals.filter(p => p.status === 'PENDING').length > 0 && (
                <span className="badge-count">{proposals.filter(p => p.status === 'PENDING').length}</span>
              )}
              {sidebarOpen && (
                <span className="nav-chevron">
                  <FontAwesomeIcon icon={proposalsOpen ? faChevronDown : faChevronRight} />
                </span>
              )}
            </button>
            
            {proposalsOpen && (
              <div className="nav-submenu">
                <button
                  className={`nav-item nav-subitem ${activeSection === 'create-proposal' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveSection('create-proposal');
                    openCreateProposal();
                  }}
                >
                  <span className="nav-icon"><FontAwesomeIcon icon={faPlus} /></span>
                  {sidebarOpen && <span className="nav-label">Propose New Course</span>}
                </button>
                <button
                  className={`nav-item nav-subitem ${activeSection === 'proposals' ? 'active' : ''}`}
                  onClick={() => setActiveSection('proposals')}
                >
                  <span className="nav-icon"><FontAwesomeIcon icon={faHourglass} /></span>
                  {sidebarOpen && <span className="nav-label">My Proposals</span>}
                  {sidebarOpen && proposals.filter(p => p.status === 'PENDING').length > 0 && (
                    <span className="badge-count">{proposals.filter(p => p.status === 'PENDING').length}</span>
                  )}
                </button>
              </div>
            )}
          </div>
          
          <button
            className={`nav-item ${activeSection === 'courses' ? 'active' : ''}`}
            onClick={() => setActiveSection('courses')}
          >
            <span className="nav-icon"><FontAwesomeIcon icon={faBook} /></span>
            {sidebarOpen && <span className="nav-label">Browse Courses</span>}
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

      {showCourseForm && (
        <>
          <div className="change-description-wrapper">
            <button
              className="modal-close-button"
              onClick={() => {
                setShowCourseForm(false);
                setSelectedCourse(null);
                setChangeDescription('');
              }}
              aria-label="Close modal"
            >
              ×
            </button>
            <h3 className="proposal-modal-title">
              {proposalType === 'CREATE' ? 'Propose New Course' : 'Propose Course Edit'}
            </h3>
            <div className="change-description-section">
              <label htmlFor="changeDescription">
                Change Description *
              </label>
              <textarea
                id="changeDescription"
                value={changeDescription}
                onChange={(e) => setChangeDescription(e.target.value)}
                placeholder="Explain the reason for this proposal..."
                rows="3"
              />
            </div>
          </div>
          <div className="proposal-modal-wrapper">
            <CourseForm
              onSubmit={handleCreateProposal}
              onCancel={() => {
                setShowCourseForm(false);
                setSelectedCourse(null);
                setChangeDescription('');
              }}
              loading={courseFormLoading}
              initialData={proposalType === 'UPDATE' ? selectedCourse : null}
              isEditMode={proposalType === 'UPDATE'}
            />
          </div>
        </>
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
    </div>
  );
};

export default TeacherDashboard;
