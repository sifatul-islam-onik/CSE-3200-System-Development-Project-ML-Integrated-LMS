import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUser, logout } from '../components/ProtectedRoute';
import '../styles/Dashboard.css';

const StudentDashboard = () => {
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
          <h1>Student Dashboard</h1>
          <div className="user-info">
            <span className="user-name">{user?.name}</span>
            <span className="user-role">Student</span>
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
            <p>You are logged in as a Student</p>
          </div>

          <div className="dashboard-grid">
            <div className="dashboard-card">
              <h3>My Courses</h3>
              <p>View enrolled courses and materials</p>
              <button className="card-btn">View Courses</button>
            </div>

            <div className="dashboard-card">
              <h3>Assignments</h3>
              <p>View and submit assignments</p>
              <button className="card-btn">View Assignments</button>
            </div>

            <div className="dashboard-card">
              <h3>Grades</h3>
              <p>Check your grades and performance</p>
              <button className="card-btn">View Grades</button>
            </div>

            <div className="dashboard-card">
              <h3>Schedule</h3>
              <p>View your class schedule and calendar</p>
              <button className="card-btn">View Schedule</button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default StudentDashboard;
