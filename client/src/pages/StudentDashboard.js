import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBook, faSignOutAlt, faClipboardList, faGraduationCap, faCalendarAlt, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import { getUser, logout } from '../components/ProtectedRoute';
import { getAllCourses } from '../services/courseService';
import CourseOBEView from '../components/CourseOBEView';
import ResultView from '../components/ResultView';
import '../styles/Dashboard.css';
import '../styles/AdminDashboard.css';
import '../styles/Profile.css';

const StudentDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [activeSection, setActiveSection] = useState('courses');
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 1024);
  const [courses, setCourses] = useState([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [coursesError, setCoursesError] = useState('');
  const [showCourseDetail, setShowCourseDetail] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [profileForm, setProfileForm] = useState({
    name: '', father: '', mother: '', advisor: '', phone: '', address: '', hall: '', email: '', scholarship: '', gender: 'others', bloodGroup: '', religion: ''
  });
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [expandedGroups, setExpandedGroups] = useState({});

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
        scholarship: userData.scholarship || '',
        gender: userData.gender || 'others',
        bloodGroup: userData.bloodGroup || '',
        religion: userData.religion || ''
      });
    }
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

  // Fetch courses
  const fetchCourses = async () => {
    setCoursesLoading(true);
    setCoursesError('');
    try {
      const response = await getAllCourses();
      setCourses(response.data || []);
    } catch (err) {
      console.error('Error fetching courses:', err);
      setCoursesError(err.response?.data?.message || 'Failed to load courses');
    } finally {
      setCoursesLoading(false);
    }
  };

  useEffect(() => {
    if (activeSection === 'courses') {
      fetchCourses();
    }
  }, [activeSection]);

  const handleViewCourseDetail = (course) => {
    setSelectedCourse(course);
    setShowCourseDetail(true);
  };

  const toggleGroup = (groupKey) => {
    // Accordion behavior: close other type groups when opening a new one
    const types = ['THEORY', 'SESSIONAL', 'PROJECT/THESIS'];
    
    if (types.includes(groupKey)) {
      // If it's a type group, toggle it (allow closing if already open)
      const isCurrentlyOpen = expandedGroups[groupKey] === true;
      
      if (isCurrentlyOpen) {
        // Close the current group
        setExpandedGroups(prev => ({
          ...prev,
          [groupKey]: false
        }));
      } else {
        // Open this group and close all others
        const newGroups = {};
        types.forEach(type => {
          newGroups[type] = type === groupKey;
        });
        setExpandedGroups(newGroups);
      }
    } else {
      // For other groups (if any in future), just toggle
      setExpandedGroups(prev => ({
        ...prev,
        [groupKey]: !prev[groupKey]
      }));
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleSectionChange = (section) => {
    setActiveSection(section);
    if (window.innerWidth <= 1024) {
      setSidebarOpen(false);
    }
  };

  const renderSection = () => {
    switch (activeSection) {
      case 'courses':
        // Organize courses by type only
        const organizedCourses = {
          'THEORY': [],
          'SESSIONAL': [],
          'PROJECT/THESIS': []
        };
        
        courses.forEach(course => {
          const type = course.course_type || 'THEORY';
          organizedCourses[type].push(course);
        });

        const types = ['THEORY', 'SESSIONAL', 'PROJECT/THESIS'];

        return (
          <div className="section-container">
            <div className="section-header">
              <div className="header-content">
                <h2>My Courses</h2>
                <p>View enrolled courses and materials</p>
              </div>
            </div>
            <div className="section-body">
              {coursesError && (
                <div className="alert alert-error" style={{ marginBottom: '16px' }}>
                  {coursesError}
                </div>
              )}

              {coursesLoading ? (
                <div className="loading-container">
                  <div className="spinner spinner-large"></div>
                  <p>Loading courses...</p>
                </div>
              ) : courses.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📚</div>
                  <h3>No courses assigned yet</h3>
                  <p>Courses assigned to your batch will appear here.</p>
                  {user?.roll && (
                    <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '8px' }}>
                      Your batch: 20{user.roll.substring(0, 2)} • Department: {user.roll.substring(2, 4)}
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  {types.map(type => {
                    const coursesInType = organizedCourses[type] || [];
                    if (coursesInType.length === 0) return null;
                    
                    const typeLabel = type === 'THEORY' ? 'Theory' : type === 'SESSIONAL' ? 'Sessional' : 'Project/Thesis';
                    const isTypeExpanded = expandedGroups[type] === true; // Default to collapsed
                    
                    return (
                      <div key={type} style={{ marginBottom: '32px' }}>
                        <button
                          onClick={() => toggleGroup(type)}
                          style={{
                            fontSize: '20px',
                            fontWeight: 700,
                            marginBottom: '20px',
                            color: '#1f2937',
                            backgroundColor: '#f3f4f6',
                            padding: '15px 16px',
                            borderRadius: '8px',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            transition: 'all 0.2s ease',
                            width: '100%'
                          }}
                        >
                          <FontAwesomeIcon 
                            icon={faChevronRight} 
                            style={{
                              transform: isTypeExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                              transition: 'transform 0.2s ease'
                            }}
                          />
                          {typeLabel} ({coursesInType.length})
                        </button>
                        
                        {isTypeExpanded && (
                          <div className="proposals-grid" style={{ marginTop: '12px' }}>
                            {coursesInType.map(course => (
                                        <div key={course._id} className="proposal-card">
                                  <div className="proposal-header">
                                    <div style={{ flex: 1 }}>
                                      <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1f2937' }}>
                                        {course.courseCode}
                                      </h4>
                                      <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: '14px' }}>
                                        {course.courseTitle}
                                      </p>
                                    </div>
                                    <span 
                                      className="proposal-type-badge" 
                                      style={{ 
                                        backgroundColor: course.course_type === 'THEORY' ? '#3b82f6' : 
                                                         course.course_type === 'SESSIONAL' ? '#10b981' : '#8b5cf6'
                                      }}
                                    >
                                      {course.course_type}
                                    </span>
                                  </div>
                                  <div className="proposal-body">
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
                                      <div>
                                        <span style={{ color: '#6b7280' }}>Credit: </span>
                                        <span style={{ fontWeight: 600, color: '#1f2937' }}>{course.credit}</span>
                                      </div>
                                      <div>
                                        <span style={{ color: '#6b7280' }}>Category: </span>
                                        <span style={{ fontWeight: 600, color: '#1f2937' }}>{course.category}</span>
                                      </div>
                                      {course.contactHours && (
                                        <div>
                                          <span style={{ color: '#6b7280' }}>Contact Hours: </span>
                                          <span style={{ fontWeight: 600, color: '#1f2937' }}>{course.contactHours}</span>
                                        </div>
                                      )}
                                      {course.academicYear && (
                                        <div>
                                          <span style={{ color: '#6b7280' }}>Academic Year: </span>
                                          <span style={{ fontWeight: 600, color: '#1f2937' }}>{course.academicYear}</span>
                                        </div>
                                      )}
                                    </div>
                                    {course.assignedTeachers && course.assignedTeachers.length > 0 && (
                                      <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e5e7eb' }}>
                                        <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: 600 }}>Instructor(s):</span>
                                        <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                          {course.assignedTeachers.map((assignment, idx) => {
                                            const teacher = assignment.teacher || assignment;
                                            return (
                                              <span 
                                                key={idx}
                                                style={{
                                                  fontSize: '12px',
                                                  padding: '4px 8px',
                                                  backgroundColor: '#f3f4f6',
                                                  borderRadius: '4px',
                                                  color: '#374151'
                                                }}
                                              >
                                                {teacher.name}
                                              </span>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                  <div className="proposal-actions">
                                    <button
                                      className="btn btn-sm btn-primary"
                                      onClick={() => handleViewCourseDetail(course)}
                                      style={{ width: '100%' }}
                                    >
                                      <FontAwesomeIcon icon={faBook} /> View Details
                                    </button>
                                  </div>
                                </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      case 'assignments':
        return (
          <div className="section-container">
            <div className="section-header">
              <div className="header-content">
                <h2>Assignments</h2>
                <p>View and submit assignments</p>
              </div>
            </div>
            <div className="section-body">
              <div className="empty-state">
                <div className="empty-icon">📝</div>
                <h3>No assignments found</h3>
                <p>Assigned tasks will show up here.</p>
              </div>
            </div>
          </div>
        );
      case 'grades':
        return (
          <div className="section-container">
            <div className="section-header">
              <div className="header-content">
                <h2>Grades</h2>
                <p>Term-wise result summary</p>
              </div>
            </div>
            <div className="section-body">
              <ResultView />
            </div>
          </div>
        );
      case 'schedule':
        return (
          <div className="section-container">
            <div className="section-header">
              <div className="header-content">
                <h2>Schedule</h2>
                <p>View your class calendar</p>
              </div>
            </div>
            <div className="section-body">
              <div className="empty-state">
                <div className="empty-icon">📅</div>
                <h3>No schedule entries</h3>
                <p>Your timetable will be shown here.</p>
              </div>
            </div>
          </div>
        );
      case 'profile':
        return (() => {
          const updateProfile = async () => {
            try {
              const payload = { ...profileForm };
              // Password change validation
              if (currentPassword || newPassword || confirmPassword) {
                if (!currentPassword || !newPassword || !confirmPassword) {
                  alert('Please fill all password fields');
                  return;
                }
                if (newPassword !== confirmPassword) {
                  alert('New password and confirm password do not match');
                  return;
                }
                payload.currentPassword = currentPassword;
                payload.newPassword = newPassword;
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
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
              } else {
                alert(data.message || 'Failed to update profile');
              }
            } catch (err) {
              alert('Failed to update profile');
            }
          };

          return (
            <div className="section-container">
              <div className="section-header">
                <h2>My Profile</h2>
                <p>Manage your account information</p>
              </div>
            <div className="section-body">
              <div className="profile-card">
                <div className="profile-view">
                  <div className="profile-images-section">
                    <div className="profile-image-wrapper">
                      <label>Profile Picture</label>
                      <div className="profile-picture-container">
                        {user?.profilePicture ? (
                          <img src={user.profilePicture} alt="Profile" />
                        ) : (
                          user?.name?.charAt(0).toUpperCase()
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
                                }
                              } catch (err) {}
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
                        {user?.signature ? (
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
                                }
                              } catch (err) {}
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
                  </div>

                  <div className="profile-grid">
                    <div className="profile-field">
                      <label>Father</label>
                      <input type="text" className="readonly-field" value={profileForm.father} disabled readOnly />
                    </div>
                    <div className="profile-field">
                      <label>Mother</label>
                      <input type="text" className="readonly-field" value={profileForm.mother} disabled readOnly />
                    </div>
                    <div className="profile-field">
                      <label>Advisor</label>
                      <input type="text" className="readonly-field" value={profileForm.advisor} disabled readOnly />
                    </div>
                    <div className="profile-field">
                      <label>Hall</label>
                      <select
                        className="readonly-select"
                        value={profileForm.hall}
                        onChange={() => setProfileForm({ ...profileForm, hall: profileForm.hall })}
                        title="Hall is fixed"
                      >
                        <option value="">Select Hall</option>
                        <option value="Amar Ekushey Hall">Amar Ekushey Hall</option>
                        <option value="Dr. M.A Rashid Hall">Dr. M.A Rashid Hall</option>
                        <option value="Fazlul Haque Hall">Fazlul Haque Hall</option>
                        <option value="Khan Jahan Ali Hall">Khan Jahan Ali Hall</option>
                        <option value="Lalan Shah Hall">Lalan Shah Hall</option>
                        <option value="Rokeya Hall">Rokeya Hall</option>
                        <option value="Shaheed Smrity Hall">Shaheed Smrity Hall</option>
                      </select>
                    </div>
                    <div className="profile-field">
                      <label>Scholarship</label>
                      <input type="text" className="readonly-field" value={profileForm.scholarship} disabled readOnly />
                    </div>
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

                  <div style={{display: 'flex', justifyContent: 'space-between', gap: '10px'}}>
                    <button className="btn btn-logout" onClick={handleLogout}>
                      <FontAwesomeIcon icon={faSignOutAlt} style={{marginRight: '8px'}} />
                      Logout
                    </button>
                    <button className="btn btn-primary" onClick={updateProfile}>Save Changes</button>
                  </div>
                </div>
              </div>
            </div>
            </div>
          );
        })();
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
            {sidebarOpen && <h1>Student Panel</h1>}
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
            className={`nav-item ${activeSection === 'courses' ? 'active' : ''}`}
            onClick={() => handleSectionChange('courses')}
          >
            <span className="nav-icon"><FontAwesomeIcon icon={faBook} /></span>
            {sidebarOpen && <span className="nav-label">My Courses</span>}
          </button>

          <button
            className={`nav-item ${activeSection === 'assignments' ? 'active' : ''}`}
            onClick={() => handleSectionChange('assignments')}
          >
            <span className="nav-icon"><FontAwesomeIcon icon={faClipboardList} /></span>
            {sidebarOpen && <span className="nav-label">Assignments</span>}
          </button>

          <button
            className={`nav-item ${activeSection === 'grades' ? 'active' : ''}`}
            onClick={() => handleSectionChange('grades')}
          >
            <span className="nav-icon"><FontAwesomeIcon icon={faGraduationCap} /></span>
            {sidebarOpen && <span className="nav-label">Grades</span>}
          </button>

          <button
            className={`nav-item ${activeSection === 'schedule' ? 'active' : ''}`}
            onClick={() => handleSectionChange('schedule')}
          >
            <span className="nav-icon"><FontAwesomeIcon icon={faCalendarAlt} /></span>
            {sidebarOpen && <span className="nav-label">Schedule</span>}
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
                  <p className="user-role">Student</p>
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

      {showCourseDetail && selectedCourse && (
        <CourseOBEView
          course={selectedCourse}
          onClose={() => {
            setShowCourseDetail(false);
            setSelectedCourse(null);
          }}
        />
      )}
    </div>
  );
};

export default StudentDashboard;
