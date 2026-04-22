import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { login } from '../services/authService';
import '../styles/Login.css';

const Login = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    identifier: '',
    password: ''
  });

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Validation
    if (!formData.identifier || !formData.password) {
      setError('All fields are required');
      setLoading(false);
      return;
    }

    try {
      const response = await login(formData);

      if (response.success) {
        // Store JWT and user data in localStorage
        localStorage.setItem('token', response.token);
        localStorage.setItem('user', JSON.stringify(response.data));

        // Redirect based on role
        const role = response.data.role;
        if (role === 'admin') {
          navigate('/admin/dashboard');
        } else if (role === 'teacher') {
          navigate('/teacher/dashboard');
        } else if (role === 'student') {
          navigate('/student/dashboard');
        } else {
          navigate('/');
        }
      }
    } catch (err) {
      if (err.response && err.response.data) {
        const errorData = err.response.data;
        
        // Check if user needs email verification
        if (errorData.requiresVerification && errorData.email) {
          // Redirect to verification page with email
          navigate('/verify-email', { state: { email: errorData.email, fromLogin: true } });
          return;
        }
        
        setError(errorData.message || 'Invalid credentials. Please verify your email/roll number and password.');
      } else {
        setError('Unable to connect to the server. Please check your internet connection.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="OBESynK-login-page">
      <div className="OBESynK-auth-banner" style={{ background: "linear-gradient(135deg, rgba(4, 120, 87, 0.4), rgba(2, 44, 34, 0.6)), url('/login-background.jpg') center/cover no-repeat" }}>
          <div className="OBESynK-auth-brand-logo">
            <Link to="/" className="OBESynK-auth-logo-text">OBESynK</Link>
          </div>
          <div className="OBESynK-auth-back-nav">
            <Link to="/" className="OBESynK-auth-back-btn">&larr; Back to website</Link>
          </div>

        </div>
      <main className="OBESynK-login-main">
        <div className="OBESynK-login-container">

          <div className="OBESynK-login-box">
            <header className="OBESynK-login-header">
              <h2>Sign In</h2>
            </header>

            {error && (
              <div className="alert alert-error">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="OBESynK-login-form">
              <div className="OBESynK-form-group">

                <input
                  type="text"
                  id="identifier"
                  name="identifier"
                  value={formData.identifier}
                  onChange={handleChange}
                  placeholder="Email or Username"
                  disabled={loading}
                />
              </div>

              <div className="OBESynK-form-group">
                <div className="OBESynK-password-input-wrapper">
                  <input
                    type={showPassword ? "text" : "password"}
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Password"
                    disabled={loading}
                  />
                  <button 
                    type="button" 
                    className="OBESynK-password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex="-1"
                  >
                    {showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="OBESynK-forgot-row">
                <button
                  type="button"
                  className="OBESynK-link-button"
                  onClick={() => navigate('/forgot-password')}
                  disabled={loading}
                >
                  Forgot password?
                </button>
              </div>

              <button
                type="submit"
                className={`btn-submit OBESynK-btn-submit ${loading ? 'loading' : ''}`}
                disabled={loading}
              >
                {loading && <span className="spinner"></span>}
                              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="OBESynK-sign-in-icon">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                  <polyline points="10 17 15 12 10 7"/>
                  <line x1="15" y1="12" x2="3" y2="12"/>
                </svg>
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Login;
