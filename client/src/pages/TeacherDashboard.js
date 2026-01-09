import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBook, faPlus, faHourglass, faCheckCircle, faTimesCircle, faEye, faTrash, faEdit, faSignOutAlt, faChevronDown, faChevronRight, faClipboardList } from '@fortawesome/free-solid-svg-icons';
import { getUser, logout } from '../components/ProtectedRoute';
import { getProfile } from '../services/authService';
import { getMyProposals, createCourseProposal, deleteProposal } from '../services/courseProposalService';
import { getAllCourses, getCourseStudents } from '../services/courseService';
import CourseForm from '../components/CourseForm';
import CourseOBEView from '../components/CourseOBEView';
import MarkEntry from '../components/MarkEntry';
import '../styles/Dashboard.css';
import '../styles/AdminDashboard.css';
import '../styles/spinner.css';
import '../styles/Profile.css';

const TeacherDashboard = () => {
  // Helper: sort courses by courseCode ascending (numeric + case-insensitive)
  const sortCoursesByCode = (list = []) => {
    const normalize = (code = '') => {
      const trimmed = code.trim();
      const match = trimmed.match(/^([A-Za-z]+)\s*(\d+)/);
      if (!match) return { prefix: trimmed.toUpperCase(), num: Number.MAX_SAFE_INTEGER, raw: trimmed };
      return { prefix: match[1].toUpperCase(), num: parseInt(match[2], 10), raw: trimmed };
    };

    return [...list].sort((a, b) => {
      const aNorm = normalize(a.courseCode || '');
      const bNorm = normalize(b.courseCode || '');

      if (aNorm.prefix !== bNorm.prefix) {
        return aNorm.prefix.localeCompare(bNorm.prefix);
      }
      if (aNorm.num !== bNorm.num) {
        return aNorm.num - bNorm.num;
      }
      return (aNorm.raw || '').localeCompare(bNorm.raw || '', undefined, { sensitivity: 'base' });
    });
  };

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
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 1024);
  const [proposalsOpen, setProposalsOpen] = useState(true);
  const [courseGroupPath, setCourseGroupPath] = useState(null); // null = root, 'year-X' = year view, 'sem-X-Y' = semester view, 'type-X-Y-Z' = type view
  const [profileForm, setProfileForm] = useState({
    name: '', father: '', mother: '', advisor: '', phone: '', address: '', hall: '', email: '', scholarship: '', gender: 'others', bloodGroup: '', religion: ''
  });
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showMarkEntry, setShowMarkEntry] = useState(false);
  const [markEntryCourse, setMarkEntryCourse] = useState(null);
  const [markEntrySection, setMarkEntrySection] = useState(null);
  const [courseStudents, setCourseStudents] = useState([]);

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

    // Sort each type bucket by course code ascending to ensure consistent order in the UI
    Object.keys(organized).forEach((yearSemKey) => {
      Object.keys(organized[yearSemKey]).forEach((type) => {
        organized[yearSemKey][type] = sortCoursesByCode(organized[yearSemKey][type]);
      });
    });
    return organized;
  };

  useEffect(() => {
    const userData = getUser();
    setUser(userData);
    if (userData) {
      setProfileForm({
        name: userData.name || '',
        father: userData.father || '',
        mother: userData.mother || '',
        advisor: userData.advisor || '',
        phone: userData.phone || '',
        address: userData.address || '',
        hall: userData.hall || '',
        email: userData.email || '',
        designation: userData.designation || 'Lecturer',
        scholarship: userData.scholarship || '',
        gender: userData.gender || 'others',
        bloodGroup: userData.bloodGroup || '',
        religion: userData.religion || ''
      });
    }
    // Fetch initial data for badge counts
    fetchMyProposals();

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

  // Refresh user profile when opening Profile section to reflect admin changes
  useEffect(() => {
    const refreshProfile = async () => {
      if (activeSection === 'profile') {
        try {
          const resp = await getProfile();
          if (resp?.success && resp.data) {
            setUser(resp.data);
            localStorage.setItem('user', JSON.stringify(resp.data));
            setProfileForm((prev) => ({
              ...prev,
              name: resp.data.name || '',
              father: resp.data.father || '',
              mother: resp.data.mother || '',
              advisor: resp.data.advisor || '',
              phone: resp.data.phone || '',
              address: resp.data.address || '',
              hall: resp.data.hall || '',
              email: resp.data.email || '',
              designation: resp.data.designation || 'Lecturer',
              scholarship: resp.data.scholarship || '',
              gender: resp.data.gender || 'others',
              bloodGroup: resp.data.bloodGroup || '',
              religion: resp.data.religion || ''
            }));
          }
        } catch (e) {
          // silently ignore; keep local state
        }
      }
    };
    refreshProfile();
  }, [activeSection]);

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
      setCourses(sortCoursesByCode(response.data || []));
    } catch (err) {
      setError(err.message || 'Failed to fetch courses');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProposal = async (courseData) => {
    // Validate that changeDescription is provided for UPDATE proposals
    if (proposalType === 'UPDATE' && !changeDescription.trim()) {
      setError('Please provide a description of changes for your update proposal');
      setTimeout(() => setError(''), 5000);
      return;
    }
    
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

  const handleSectionChange = (section) => {
    setActiveSection(section);
    // Close sidebar on mobile after selecting a section
    if (window.innerWidth <= 1024) {
      setSidebarOpen(false);
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
    handleSectionChange('create-proposal');
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
                <div className="courses-tree">
                  {/* Breadcrumb Navigation */}
                  {courseGroupPath && (
                    <div className="breadcrumb-nav">
                      <button className="breadcrumb-btn" onClick={goBackGroup}>← Back</button>
                    </div>
                  )}

                  {!courseGroupPath ? (
                    // Root view: Show all year-semester combinations
                    <div className="tree-group">
                      {yearSemKeys.map((yearSemKey) => {
                        return (
                          <button
                            key={yearSemKey}
                            className="tree-header tree-year-header"
                            onClick={() => navigateToGroup(yearSemKey)}
                          >
                            <FontAwesomeIcon icon={faChevronRight} />
                            <span>{yearSemKey}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : organizedCourses[courseGroupPath] ? (
                    // Year-Semester view: Show all course types
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
                    // Type view: Show all courses in selected type
                    (() => {
                      const parts = courseGroupPath.split('-');
                      const yearSem = `${parts[0]}-${parts[1]}`;
                      const type = parts[2];
                      const typeCourses = organizedCourses[yearSem]?.[type] || [];
                      const sortedTypeCourses = sortCoursesByCode(typeCourses);
                      return (
                        <div className="tree-content">
                          {sortedTypeCourses.map((course) => (
                            <div key={course._id} className="course-item">
                              <div className="course-item-header">
                                <div className="course-info">
                                  <span className="course-code">{course.courseCode}</span>
                                  <span className="course-title">{course.courseTitle}</span>
                                  <span className="course-credit">{course.credit} Cr</span>
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
                                  className="btn btn-sm btn-success"
                                  onClick={async () => {
                                    // Find teacher's section for this course
                                    const assignment = course.assignedTeachers?.find(at => {
                                      const teacherId = at.teacher?._id || at.teacher;
                                      return teacherId.toString() === user._id;
                                    });
                                    const section = assignment?.section || null;
                                    
                                    // Fetch students
                                    try {
                                      setLoading(true);
                                      const response = await getCourseStudents(course._id, section);
                                      if (response.success && response.data.length > 0) {
                                        setCourseStudents(response.data);
                                        setMarkEntryCourse(course);
                                        setMarkEntrySection(section);
                                        setShowMarkEntry(true);
                                      } else {
                                        setError('No students enrolled in this course');
                                        setTimeout(() => setError(''), 3000);
                                      }
                                    } catch (err) {
                                      console.error('Error fetching students:', err);
                                      setError('Failed to fetch students');
                                      setTimeout(() => setError(''), 3000);
                                    } finally {
                                      setLoading(false);
                                    }
                                  }}
                                >
                                  <FontAwesomeIcon icon={faClipboardList} /> Enter Marks
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
                      );
                    })()
                  ) : null}
                </div>
              )}
            </div>
          </div>
        );

      case 'profile':
        const updateProfile = async () => {
          setError('');
          try {
            const payload = { ...profileForm };
            // Password change validation
            if (currentPassword || newPassword || confirmPassword) {
              if (!currentPassword || !newPassword || !confirmPassword) {
                setError('Please fill all password fields');
                setTimeout(() => setError(''), 4000);
                return;
              }
              if (newPassword !== confirmPassword) {
                setError('New password and confirm password do not match');
                setTimeout(() => setError(''), 4000);
                return;
              }
              payload.currentPassword = currentPassword;
              payload.newPassword = newPassword;
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
              setSuccessMessage('Profile updated successfully');
              setTimeout(() => setSuccessMessage(''), 3000);
              setCurrentPassword('');
              setNewPassword('');
              setConfirmPassword('');
            } else {
              setError(data.message || 'Failed to update profile');
              setTimeout(() => setError(''), 4000);
            }
          } catch (err) {
            setError('Failed to update profile');
            setTimeout(() => setError(''), 4000);
          }
        };

        return (
          <div className="section-container">
            <div className="section-header">
              <h2>My Profile</h2>
              <p>Manage your account information</p>
            </div>
            <div className="section-body">
              {error && (
                <div className="alert alert-error">{error}</div>
              )}
              {successMessage && (
                <div className="alert alert-success">{successMessage}</div>
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
                                }
                              } catch (err) {
                                console.error('Failed to update profile picture:', err);
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
                                }
                              } catch (err) {
                                console.error('Failed to update signature:', err);
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
                      <input type="text" className="readonly-field" value={profileForm.name} disabled readOnly />
                    </div>
                    <div className="profile-field">
                      <label>Email</label>
                      <input type="email" className="readonly-field" value={profileForm.email} disabled readOnly />
                    </div>
                    <div className="profile-field">
                      <label>Designation</label>
                      <input type="text" className="readonly-field" value={profileForm.designation || 'Lecturer'} disabled readOnly />
                    </div>
                  </div>

                  <div className="profile-grid">
                    <div className="profile-field">
                      <label>Phone</label>
                      <input type="tel" value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} />
                    </div>
                    <div className="profile-field">
                      <label>Address</label>
                      <input type="text" value={profileForm.address} onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })} />
                    </div>
                    <div className="profile-field">
                      <label>Blood Group</label>
                      <select value={profileForm.bloodGroup} onChange={(e) => setProfileForm({ ...profileForm, bloodGroup: e.target.value })}>
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
                      <select value={profileForm.religion} onChange={(e) => setProfileForm({ ...profileForm, religion: e.target.value })}>
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
                      <label style={{display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer'}}><input type="radio" name="gender" checked={profileForm.gender === 'male'} onChange={() => setProfileForm({ ...profileForm, gender: 'male' })} /> Male</label>
                      <label style={{display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer'}}><input type="radio" name="gender" checked={profileForm.gender === 'female'} onChange={() => setProfileForm({ ...profileForm, gender: 'female' })} /> Female</label>
                      <label style={{display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer'}}><input type="radio" name="gender" checked={profileForm.gender === 'others'} onChange={() => setProfileForm({ ...profileForm, gender: 'others' })} /> Others</label>
                    </div>
                  </div>

                  <div className="password-change-section">
                    <label>Change Password</label>
                    <div className="password-inputs">
                      <input type="password" placeholder="Current Password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
                      <input type="password" placeholder="New Password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                      <input type="password" placeholder="Confirm New Password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                    </div>
                  </div>

                  <div className="profile-actions" style={{display: 'flex', justifyContent: 'flex-end', gap: '10px'}}>
                    <button className="btn btn-primary" onClick={updateProfile}>Save Changes</button>
                  </div>
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
        {sidebarOpen ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" clipRule="evenodd" d="M5.29289 5.29289C5.68342 4.90237 6.31658 4.90237 6.70711 5.29289L12 10.5858L17.2929 5.29289C17.6834 4.90237 18.3166 4.90237 18.7071 5.29289C19.0976 5.68342 19.0976 6.31658 18.7071 6.70711L13.4142 12L18.7071 17.2929C19.0976 17.6834 19.0976 18.3166 18.7071 18.7071C18.3166 19.0976 17.6834 19.0976 17.2929 18.7071L12 13.4142L6.70711 18.7071C6.31658 19.0976 5.68342 19.0976 5.29289 18.7071C4.90237 18.3166 4.90237 17.6834 5.29289 17.2929L10.5858 12L5.29289 6.70711C4.90237 6.31658 4.90237 5.68342 5.29289 5.29289Z" fill="currentColor"/>
          </svg>
        ) : (
          <FontAwesomeIcon icon={faBook} />
        )}
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
            onClick={() => handleSectionChange('overview')}
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
                  onClick={() => handleSectionChange('proposals')}
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
            onClick={() => handleSectionChange('courses')}
          >
            <span className="nav-icon"><FontAwesomeIcon icon={faBook} /></span>
            {sidebarOpen && <span className="nav-label">Browse Courses</span>}
          </button>
        </nav>
        <div className="sidebar-footer">
          {user && (
            <div 
              className="user-profile" 
              onClick={() => setActiveSection('profile')}
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
          viewingSemester={typeof showOBEView === 'number' ? showOBEView : null}
          onClose={() => {
            setShowOBEView(false);
            setSelectedCourse(null);
          }}
        />
      )}

      {showMarkEntry && markEntryCourse && courseStudents.length > 0 && (
        <MarkEntry
          course={markEntryCourse}
          students={courseStudents}
          section={markEntrySection}
          onClose={() => {
            setShowMarkEntry(false);
            setMarkEntryCourse(null);
            setMarkEntrySection(null);
            setCourseStudents([]);
          }}
        />
      )}
    </div>
  );
};

export default TeacherDashboard;
