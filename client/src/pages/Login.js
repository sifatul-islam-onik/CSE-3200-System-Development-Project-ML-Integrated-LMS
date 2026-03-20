import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
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
    <div className="login-page">
      <Header />
      
      <main className="login-main">
        <div className="login-container">
          <div className="login-box">
            <h2>Login</h2>
            <p className="login-subtitle">
              
            </p>

            {error && (
              <div className="alert alert-error">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="login-form">
              <div className="form-group">
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

              <div className="form-group">
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

              <div className="forgot-password-row">
                <button
                  type="button"
                  className="link-button"
                  onClick={() => navigate('/forgot-password')}
                  disabled={loading}
                >
                  Forgot password?
                </button>
              </div>

              <button 
                type="submit" 
                className={`btn-submit ${loading ? 'loading' : ''}`}
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
