import React from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSignInAlt } from '@fortawesome/free-solid-svg-icons';
import '../styles/Home.css';

const Home = () => {
  const navigate = useNavigate();

  return (
    <div className="home-page">
      <Header />
      
      <main className="home-main">
        <section className="hero-section wrapper-inner">
          <div className="hero-content">
            <h1 className="hero-title">
              Elevate Engineering Education with <span className="highlight-text">COBALT</span>
            </h1>
            <p className="hero-subtitle highlight-subtitle">
              Course Outcome-Based Attainment and Learning Tracker
            </p>
            <p className="hero-description">
              An ML-Integrated Learning Management System designed to bridge the gap between curriculum, exams, and continuous quality improvement in Outcome-Based Education (OBE).
            </p>

            <div className="action-buttons">
              <button 
                className="btn btn-primary btn-lg pulse-btn login-btn"
                onClick={() => navigate('/login')}
              >
                <span className="login-btn__icon" aria-hidden="true">
                  <FontAwesomeIcon icon={faSignInAlt} />
                </span>
                <span className="login-btn__text">Login</span>
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="home-footer">
        <div className="footer-content wrapper-inner">
          <div className="footer-links">
            <p>
              &copy; {new Date().getFullYear()}{' '}
              <a href="https://kuet.ac.bd/" target="_blank" rel="noopener noreferrer">
                Khulna University of Engineering & Technology
              </a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
