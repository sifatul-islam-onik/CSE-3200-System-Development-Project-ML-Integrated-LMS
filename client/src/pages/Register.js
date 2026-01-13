import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Header from '../components/Header';
import { register } from '../services/authService';
import '../styles/Register.css';

const Register = () => {
  const navigate = useNavigate();
  const { role: urlRole } = useParams();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: urlRole || 'student'
  });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
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
    setSuccess('');
    setLoading(true);

    // Validation
    if (!formData.name || !formData.email || !formData.password) {
      setError('All fields are required');
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    try {
      const response = await register(formData);

      if (response.success) {
        // Redirect to verify email page
        navigate('/verify-email', { state: { email: formData.email } });
      }
    } catch (err) {
      if (err.response && err.response.data) {
        setError(err.response.data.message || 'Registration failed');
      } else {
        setError('Network error. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-page">
      <Header />
      
      <main className="register-main">
        <div className="register-container">
          <div className="register-box">
            <h2>Create Your Account</h2>
            <p className="register-subtitle">
              Register to get started
            </p>

            {success && (
              <div className="alert alert-success">
                <p>{success}</p>
                <p className="alert-info">Please verify your email. Admin approval is required before login.</p>
              </div>
            )}

            {error && (
              <div className="alert alert-error">
                {error}
              </div>
            )}

            {!success && (
              <form onSubmit={handleSubmit} className="register-form">
                <div className="form-group">
                  <label htmlFor="name">Full Name</label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Enter your full name"
                    disabled={loading}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="email">Email Address</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="Enter your email"
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
                    placeholder="Enter your password (min 6 characters)"
                    disabled={loading}
                  />
                </div>

                <button 
                  type="submit" 
                  className={`btn-submit ${loading ? 'loading' : ''}`}
                  disabled={loading}
                >
                  {loading && <span className="spinner"></span>}
                  {loading ? 'Registering...' : 'Register'}
                </button>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Register;
