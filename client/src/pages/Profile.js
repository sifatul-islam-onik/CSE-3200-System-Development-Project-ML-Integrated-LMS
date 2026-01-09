import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUser, faEdit, faSave, faTimes, faArrowLeft, faHome } from '@fortawesome/free-solid-svg-icons';
import { getUser } from '../components/ProtectedRoute';
import '../styles/Profile.css';

const Profile = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    const userData = getUser();
    if (!userData) {
      navigate('/login');
      return;
    }
    setUser(userData);
    setEditData(userData);
  }, [navigate]);

  const getDashboardPath = () => {
    if (!user) return '/';
    switch(user.role) {
      case 'admin':
        return '/admin/dashboard';
      case 'teacher':
        return '/teacher/dashboard';
      case 'student':
        return '/student/dashboard';
      default:
        return '/';
    }
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditData({
      ...editData,
      [name]: value
    });
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    
    if (!editData.name || !editData.name.trim()) {
      setError('Name is required');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const token = localStorage.getItem('token');
      const payload = {
        name: editData.name.trim(),
        email: editData.email,
        father: editData.father,
        mother: editData.mother,
        advisor: editData.advisor,
        phone: editData.phone,
        address: editData.address,
        hall: editData.hall,
        scholarship: editData.scholarship,
        gender: editData.gender,
        bloodGroup: editData.bloodGroup,
        religion: editData.religion
      };
      // Password change validation
      if (editData.currentPassword || editData.newPassword || editData.confirmPassword) {
        if (!editData.currentPassword || !editData.newPassword || !editData.confirmPassword) {
          setError('Please fill all password fields');
          setLoading(false);
          return;
        }
        if (editData.newPassword !== editData.confirmPassword) {
          setError('New password and confirm password do not match');
          setLoading(false);
          return;
        }
        payload.currentPassword = editData.currentPassword;
        payload.newPassword = editData.newPassword;
      }

      const response = await fetch(
        `${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/auth/profile/update`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        }
      );

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || 'Failed to update profile');
      }

      setUser(data.data);
      localStorage.setItem('user', JSON.stringify(data.data));
      setIsEditing(false);
      setSuccessMessage('Profile updated successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setEditData(user);
    setIsEditing(false);
    setError('');
  };

  if (!user) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="profile-container">
      <div className="profile-nav">
        <button 
          className="btn btn-back"
          onClick={() => navigate(getDashboardPath())}
          title="Back to Dashboard"
        >
          <FontAwesomeIcon icon={faArrowLeft} /> Back to Dashboard
        </button>
        <button 
          className="btn btn-secondary"
          onClick={() => navigate(getDashboardPath())}
          title="Home"
        >
          <FontAwesomeIcon icon={faHome} />
        </button>
      </div>

      <div className="profile-header">
        <div className="profile-icon">
          <FontAwesomeIcon icon={faUser} />
        </div>
        {isEditing ? (
          <>
            <h1>Edit Profile</h1>
            <p>Update your account information</p>
          </>
        ) : (
          <>
            <h1>My Profile</h1>
            <p>Manage your account information</p>
          </>
        )}
      </div>

      <div className="profile-content">
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
          <div className="profile-card-header">
            {isEditing && (
              <h2>Edit Profile</h2>
            )}
            {!isEditing && (
              <button
                className="btn btn-secondary"
                onClick={() => setIsEditing(true)}
              >
                <FontAwesomeIcon icon={faEdit} /> Edit Profile
              </button>
            )}
          </div>

          {isEditing ? (
            <form onSubmit={handleSaveProfile} className="profile-form">
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
                            const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/auth/profile/update`, {
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
                              setError(data.message || 'Failed to update profile picture');
                            }
                          } catch (err) {
                            setError('Failed to update profile picture');
                          }
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
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
                            const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/auth/profile/update`, {
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
                              setError(data.message || 'Failed to update signature');
                            }
                          } catch (err) {
                            setError('Failed to update signature');
                          }
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </div>
              </div>

              {/* Editable fields */}
              <div className="profile-grid">
                <div className="form-group">
                  <label htmlFor="name">Name *</label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={editData.name || ''}
                    onChange={handleEditChange}
                    placeholder="Enter your full name"
                    disabled={loading}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input type="email" name="email" className="readonly-field" value={editData.email || ''} disabled readOnly />
                </div>
              </div>

              <div className="form-grid" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px'}}>
                {user.role === 'student' && (
                  <>
                    <div className="form-group">
                      <label>Father</label>
                      <input name="father" value={editData.father || ''} onChange={handleEditChange} />
                    </div>
                    <div className="form-group">
                      <label>Mother</label>
                      <input name="mother" value={editData.mother || ''} onChange={handleEditChange} />
                    </div>
                    <div className="form-group">
                      <label>Advisor</label>
                      <input name="advisor" className="readonly-field" value={editData.advisor || ''} disabled readOnly />
                    </div>
                  </>
                )}
                {user.role === 'teacher' && (
                  <div className="form-group">
                    <label>Designation</label>
                    <input name="designation" className="readonly-field" value={editData.designation || 'Lecturer'} disabled readOnly />
                  </div>
                )}
                <div className="form-group">
                  <label>Phone</label>
                  <input name="phone" value={editData.phone || ''} onChange={handleEditChange} />
                </div>
                <div className="form-group">
                  <label>Address</label>
                  <input name="address" value={editData.address || ''} onChange={handleEditChange} />
                </div>
                {user.role === 'student' && (
                  <div className="form-group">
                    <label>Hall</label>
                    <select name="hall" value={editData.hall || ''} onChange={handleEditChange}>
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
                )}
                <div className="form-group">
                  <label>Email</label>
                  <input type="email" name="email" className="readonly-field" value={editData.email || ''} disabled readOnly />
                </div>
                {user.role === 'student' && (
                  <div className="form-group">
                    <label>Scholarship</label>
                    <input name="scholarship" value={editData.scholarship || ''} onChange={handleEditChange} />
                  </div>
                )}
                <div className="form-group">
                  <label>Blood Group</label>
                  <select name="bloodGroup" value={editData.bloodGroup || ''} onChange={handleEditChange}>
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
                <div className="form-group">
                  <label>Religion</label>
                  <input name="religion" value={editData.religion || ''} onChange={handleEditChange} />
                </div>
              </div>

              <div className="form-group">
                <label>Gender</label>
                <div style={{display: 'flex', gap: '16px'}}>
                  <label><input type="radio" name="gender" checked={(editData.gender || 'others') === 'male'} onChange={() => setEditData({ ...editData, gender: 'male' })} /> Male</label>
                  <label><input type="radio" name="gender" checked={(editData.gender || 'others') === 'female'} onChange={() => setEditData({ ...editData, gender: 'female' })} /> Female</label>
                  <label><input type="radio" name="gender" checked={(editData.gender || 'others') === 'others'} onChange={() => setEditData({ ...editData, gender: 'others' })} /> Others</label>
                </div>
              </div>

              {/* Change Password */}
              <div className="form-group">
                <label>Change Password</label>
                <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px'}}>
                  <div>
                    <label style={{fontSize: '12px'}}>Current Password</label>
                    <input type="password" name="currentPassword" value={editData.currentPassword || ''} onChange={handleEditChange} />
                  </div>
                  <div>
                    <label style={{fontSize: '12px'}}>New Password</label>
                    <input type="password" name="newPassword" value={editData.newPassword || ''} onChange={handleEditChange} />
                  </div>
                  <div>
                    <label style={{fontSize: '12px'}}>Confirm New Password</label>
                    <input type="password" name="confirmPassword" value={editData.confirmPassword || ''} onChange={handleEditChange} />
                  </div>
                </div>
              </div>

              <div className="form-actions">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                >
                  <FontAwesomeIcon icon={faSave} /> {loading ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleCancel}
                  disabled={loading}
                >
                  <FontAwesomeIcon icon={faTimes} /> Cancel
                </button>
              </div>
            </form>
          ) : (
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
                </div>
              </div>

              <div className="profile-field">
                <label>Name</label>
                <p>{user.name}</p>
              </div>

              <div className="profile-field">
                <label>Email</label>
                <p>{user.email}</p>
              </div>

              

              <div className="profile-grid">
                {user.role === 'student' && (
                  <>
                    <div className="profile-field"><label>Father</label><p>{user.father || '-'}</p></div>
                    <div className="profile-field"><label>Mother</label><p>{user.mother || '-'}</p></div>
                    <div className="profile-field"><label>Advisor</label><p>{user.advisor || '-'}</p></div>
                    <div className="profile-field"><label>Hall</label><p>{user.hall || '-'}</p></div>
                    <div className="profile-field"><label>Scholarship</label><p>{user.scholarship || '-'}</p></div>
                  </>
                )}
                {user.role === 'teacher' && (
                  <div className="profile-field"><label>Designation</label><p>{user.designation || 'Lecturer'}</p></div>
                )}
                <div className="profile-field"><label>Phone</label><p>{user.phone || '-'}</p></div>
                <div className="profile-field"><label>Address</label><p>{user.address || '-'}</p></div>
                <div className="profile-field"><label>Blood Group</label><p>{user.bloodGroup || '-'}</p></div>
                <div className="profile-field"><label>Religion</label><p>{user.religion || '-'}</p></div>
                <div className="profile-field"><label>Gender</label><p>{(user.gender || 'others').charAt(0).toUpperCase() + (user.gender || 'others').slice(1)}</p></div>
              </div>

              <div className="profile-field">
                <label>Email Verified</label>
                <p>
                  {user.isEmailVerified ? (
                    <span className="status-badge status-approved">Verified</span>
                  ) : (
                    <span className="status-badge status-rejected">Not Verified</span>
                  )}
                </p>
              </div>

              {user.role !== 'admin' && (
                <div className="profile-field">
                  <label>Approval Status</label>
                  <p>
                    {user.isApprovedByAdmin ? (
                      <span className="status-badge status-approved">Approved</span>
                    ) : (
                      <span className="status-badge status-rejected">Pending Approval</span>
                    )}
                  </p>
                </div>
              )}

              <div className="profile-field">
                <label>Account Status</label>
                <p>
                  {user.isActive ? (
                    <span className="status-badge status-approved">Active</span>
                  ) : (
                    <span className="status-badge status-rejected">Inactive</span>
                  )}
                </p>
              </div>

              <div className="profile-field">
                <label>Member Since</label>
                <p>{new Date(user.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;
