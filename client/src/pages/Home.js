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
          <h1 className="hero-title">COBALT</h1>
          <p className="hero-subtitle" style={{ marginBottom: '1rem', fontWeight: 600, fontSize: '1.5rem', color: 'var(--color-primary)' }}>
            Course Outcome-Based Attainment and Learning Tracker
          </p>
          <p className="hero-subtitle">
            An ML-Integrated Learning Management System for Automated CO-PO Attainment Tracking in Outcome-Based Engineering Education
          </p>

          <div className="action-buttons">
            <button 
              className="btn btn-primary"
              onClick={() => navigate('/login')}
            >
              Login
            </button>
          </div>
        </div>
      </main>

      <footer className="home-footer">
        <p>
          &copy; 2026{' '}
          <a
            href="https://kuet.ac.bd/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'inherit', textDecoration: 'none' }}
          >
            Khulna University of Engineering & Technology
          </a>
        </p>
      </footer>
    </div>
  );
};

export default Home;
