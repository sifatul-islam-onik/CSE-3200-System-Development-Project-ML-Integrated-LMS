import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUser, logout } from '../components/ProtectedRoute';
import '../styles/Dashboard.css';

const TeacherDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const userData = getUser();
    setUser(userData);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="dashboard-header-content">
          <h1>Teacher Dashboard</h1>
          <div className="user-info">
            <span className="user-name">{user?.name}</span>
            <span className="user-role">Teacher</span>
            <button className="btn-logout" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="dashboard-main">
        <div className="dashboard-container">
          <div className="welcome-section">
            <h2>Welcome, {user?.name}!</h2>
            <p>You are logged in as a Teacher</p>
          </div>

          <div className="dashboard-grid">
            <div className="dashboard-card">
              <h3>My Courses</h3>
              <p>View and manage courses you teach</p>
              <button className="card-btn">View Courses</button>
            </div>

            <div className="dashboard-card">
              <h3>Assignments</h3>
              <p>Create and grade student assignments</p>
              <button className="card-btn">Manage Assignments</button>
            </div>

            <div className="dashboard-card">
              <h3>Students</h3>
              <p>View enrolled students and their progress</p>
              <button className="card-btn">View Students</button>
            </div>

            <div className="dashboard-card">
              <h3>Resources</h3>
              <p>Upload and manage course materials</p>
              <button className="card-btn">Manage Resources</button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default TeacherDashboard;
