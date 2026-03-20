import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { forgotPassword, resetPassword } from '../services/authService';
import '../styles/Login.css';
import '../styles/spinner.css';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleRequestReset = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    setLoading(true);
    try {
      const response = await forgotPassword(email.trim());
      setMessage(response.message || 'Reset code sent to your email');
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to request password reset');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!otp || otp.length !== 6) {
      setError('Please enter a valid 6-digit OTP');
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const response = await resetPassword({
        email: email.trim(),
        otp,
        newPassword
      });
      setMessage(response.message || 'Password reset successful');
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setResendLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await forgotPassword(email.trim());
      setMessage(response.message || 'A new reset code has been sent to your email');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resend reset code');
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="login-page">
      <Header />

      <main className="login-main">
        <div className="login-container">
          <div className="login-box">
            <h2>Reset Password</h2>
            <p className="login-subtitle">
              {step === 1
                ? 'Enter your email to receive a 6-digit reset code'
                : `Enter the reset code sent to ${email}`}
            </p>

            {message && <div className="alert" style={{ backgroundColor: 'rgba(21,128,61,0.12)', color: 'var(--color-success)', border: '1px solid var(--color-success-light)' }}>{message}</div>}
            {error && <div className="alert alert-error">{error}</div>}

            {step === 1 ? (
              <form onSubmit={handleRequestReset} className="login-form">
                <div className="form-group">
                  <label htmlFor="email">Email</label>
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your registered email"
                    disabled={loading}
                  />
                </div>

                <button type="submit" className="btn-submit" disabled={loading}>
                  {loading ? 'Sending...' : 'Send Reset Code'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} className="login-form">
                <div className="form-group">
                  <label htmlFor="otp">6-Digit OTP</label>
                  <input
                    type="text"
                    id="otp"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    maxLength="6"
                    disabled={loading}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="newPassword">New Password</label>
                  <input
                    type="password"
                    id="newPassword"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    disabled={loading}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="confirmPassword">Confirm New Password</label>
                  <input
                    type="password"
                    id="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    disabled={loading}
                  />
                </div>

                <button type="submit" className="btn-submit" disabled={loading}>
                  {loading ? 'Resetting...' : 'Reset Password'}
                </button>

                <div className="login-footer" style={{ marginTop: '0.5rem', paddingTop: '1rem' }}>
                  <p>Didn't receive the code?</p>
                  <button
                    type="button"
                    onClick={handleResendCode}
                    className={`link-button ${resendLoading ? 'loading' : ''}`}
                    disabled={resendLoading || loading}
                  >
                    {resendLoading && <span className="spinner spinner-dark"></span>}
                    {resendLoading ? 'Sending...' : 'Resend code'}
                  </button>
                </div>
              </form>
            )}

            <div className="login-footer">
              <button type="button" className="link-button" onClick={() => navigate('/login')}>
                Back to Login
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ForgotPassword;
