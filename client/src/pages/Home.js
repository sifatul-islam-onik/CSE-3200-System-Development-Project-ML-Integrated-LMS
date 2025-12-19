import React from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import '../styles/Home.css';

const Home = () => {
  const navigate = useNavigate();

  return (
    <div className="home-page">
      <Header />
      
      <main className="home-main">
        <div className="hero-section">
          <h1 className="hero-title">Welcome to University LMS</h1>
          <p className="hero-subtitle">
            A comprehensive Learning Management System for students, teachers, and administrators
          </p>

          <div className="action-buttons">
            <button 
              className="btn btn-primary"
              onClick={() => navigate('/login')}
            >
              Login
            </button>

            <button 
              className="btn btn-secondary"
              onClick={() => navigate('/register')}
            >
              Register
            </button>
          </div>
        </div>
      </main>

      <footer className="home-footer">
        <p>&copy; 2025 University LMS. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default Home;
