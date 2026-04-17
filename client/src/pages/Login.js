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
    <div className="login-page OBESynK-login-page">
      <div className="OBESynK-auth-banner">
          <div className="OBESynK-auth-brand-logo">
            <Link to="/" className="OBESynK-auth-logo-text">OBESynK</Link>
          </div>
          <div className="OBESynK-auth-back-nav">
            <Link to="/" className="OBESynK-auth-back-btn">Back to website &rarr;</Link>
          </div>
          <div className="OBESynK-auth-motto">
            <p>Empowering Academic<br />Excellence</p>
          </div>
        </div>
      <main className="login-main OBESynK-login-main">
        <div className="login-container OBESynK-login-container">
          <div className="OBESynK-branding-mobile">
            <h1>
              <Link className="OBESynK-brand-link" to="/">OBESynK</Link>
            </h1>
            <p>Academic Portal</p>
          </div>

          <div className="login-box OBESynK-login-box">
            <header className="OBESynK-login-header">
              <h2>Login</h2>
            </header>

            {error && (
              <div className="alert alert-error">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="login-form OBESynK-login-form">
              <div className="form-group OBESynK-form-group">
                <label htmlFor="identifier">Email or Roll Number</label>
                <input
                  type="text"
                  id="identifier"
                  name="identifier"
                  value={formData.identifier}
                  onChange={handleChange}
                  placeholder="Email or roll number"
                  disabled={loading}
                />
              </div>

              <div className="form-group OBESynK-form-group">
                <label htmlFor="password">Password</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Password"
                  disabled={loading}
                />
              </div>

              <div className="forgot-password-row OBESynK-forgot-row">
                <button
                  type="button"
                  className="link-button OBESynK-link-button"
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
                {loading ? 'Logging in...' : 'Login'}
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Login;
