import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import Header from '../components/Header';
import '../styles/VerifyEmail.css';
import '../styles/spinner.css';

const VerifyEmail = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email || '';
  const fromLogin = location.state?.fromLogin || false;

  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [message, setMessage] = useState(
    fromLogin ? 'A new verification code has been sent to your email.' : ''
  );
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    try {
      const response = await axios.post(`${process.env.REACT_APP_API_URL || '/api'}/auth/verify-email`, {
        email,
        otp
      });

      setMessage(response.data.message);
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setResendLoading(true);
    setMessage('');
    setError('');

    try {
      const response = await axios.post(`${process.env.REACT_APP_API_URL || '/api'}/auth/resend-otp`, {
        email
      });

      setMessage(response.data.message);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resend OTP');
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="verify-page">
      <div className="verify-main">
        <div className="verify-container">
          <div className="verify-box">
            <h2>Verify Your Email</h2>
            {fromLogin ? (
              <p className="verify-subtitle">
                Your email is not verified yet. A new 6-digit verification code has been sent to <strong>{email}</strong>
              </p>
            ) : (
              <p className="verify-subtitle">
                We've sent a 6-digit verification code to <strong>{email}</strong>
              </p>
            )}

            {message && <div className="alert alert-success">{message}</div>}
            {error && <div className="alert alert-error">{error}</div>}

            <form onSubmit={handleSubmit} className="verify-form">
              <div className="form-group">
                <label htmlFor="otp">Enter 6-Digit Code</label>
                <input
                  type="text"
                  id="otp"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  maxLength="6"
                  required
                  disabled={loading}
                />
              </div>

              <button type="submit" className={`btn-submit ${loading ? 'loading' : ''}`} disabled={loading || otp.length !== 6}>
                {loading && <span className="spinner"></span>}
                {loading ? 'Verifying...' : 'Verify Email'}
              </button>
            </form>

            <div className="verify-footer">
              <p>Didn't receive the code?</p>
              <button
                type="button"
                onClick={handleResendOTP}
                className={`link-button ${resendLoading ? 'loading' : ''}`}
                disabled={resendLoading || loading}
              >
                {resendLoading && <span className="spinner spinner-dark"></span>}
                {resendLoading ? 'Sending...' : 'Resend OTP'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;
