import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBook, faSignOutAlt, faClipboardList, faGraduationCap, faCalendarAlt, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import { getUser, logout } from '../components/ProtectedRoute';
import '../styles/Dashboard.css';
import '../styles/AdminDashboard.css';
import '../styles/Profile.css';

const StudentDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [activeSection, setActiveSection] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 1024);
  const [profileForm, setProfileForm] = useState({
    name: '', father: '', mother: '', advisor: '', phone: '', address: '', hall: '', email: '', scholarship: '', gender: 'others', bloodGroup: '', religion: ''
  });
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

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
      case 'overview':
        return (
          <div className="section-container">
            <div className="section-header">
              <div className="header-content">
                <h2>Welcome, {user?.name}!</h2>
                <p>Your student dashboard overview</p>
              </div>
            </div>
            <div className="section-body">
              <div className="dashboard-grid">
                <div className="dashboard-card">
                  <h3>My Courses</h3>
                  <p>View enrolled courses and materials</p>
                  <button className="card-btn" onClick={() => handleSectionChange('courses')}>View Courses</button>
                </div>
                <div className="dashboard-card">
                  <h3>Assignments</h3>
                  <p>View and submit assignments</p>
                  <button className="card-btn" onClick={() => handleSectionChange('assignments')}>View Assignments</button>
                </div>
                <div className="dashboard-card">
                  <h3>Grades</h3>
                  <p>Check your grades and performance</p>
                  <button className="card-btn" onClick={() => handleSectionChange('grades')}>View Grades</button>
                </div>
                <div className="dashboard-card">
                  <h3>Schedule</h3>
                  <p>View your class schedule and calendar</p>
                  <button className="card-btn" onClick={() => handleSectionChange('schedule')}>View Schedule</button>
                </div>
              </div>
            </div>
          </div>
        );
      case 'courses':
        return (
          <div className="section-container">
            <div className="section-header">
              <div className="header-content">
                <h2>My Courses</h2>
                <p>View enrolled courses and materials</p>
              </div>
            </div>
            <div className="section-body">
              <div className="empty-state">
                <div className="empty-icon">📚</div>
                <h3>No courses linked yet</h3>
                <p>Your enrolled courses will appear here.</p>
              </div>
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
                <p>Track your performance</p>
              </div>
            </div>
            <div className="section-body">
              <div className="empty-state">
                <div className="empty-icon">🏆</div>
                <h3>No grade records yet</h3>
                <p>Once available, your grades will appear here.</p>
              </div>
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

                  <div style={{display: 'flex', justifyContent: 'flex-end', gap: '10px'}}>
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
            className={`nav-item ${activeSection === 'overview' ? 'active' : ''}`}
            onClick={() => handleSectionChange('overview')}
          >
            <span className="nav-icon"><FontAwesomeIcon icon={faBook} /></span>
            {sidebarOpen && <span className="nav-label">Overview</span>}
          </button>

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
    </div>
  );
};

export default StudentDashboard;
