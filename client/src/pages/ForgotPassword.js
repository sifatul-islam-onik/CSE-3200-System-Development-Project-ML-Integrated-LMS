import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { forgotPassword, resetPassword } from '../services/authService';
import '../styles/ForgotPassword.css';
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
    <div className="reset-page cobalt-reset-page">
      <main className="cobalt-reset-main">
        <div className="cobalt-reset-container">
          <div className="cobalt-reset-branding">
            <h1>
              <Link className="cobalt-reset-logo-link" to="/">COBALT</Link>
            </h1>
            <p>Academic Portal</p>
          </div>

          <div className="cobalt-reset-card">
            <div className="cobalt-reset-header">
              <h1>{step === 1 ? 'Reset Your Password' : 'Set New Password'}</h1>
              <p>
                {step === 1
                  ? 'Enter your registered institutional email to receive a 6-digit verification code.'
                  : `Enter the code sent to ${email} and choose a new password.`}
              </p>
            </div>

            {message && <div className="reset-alert reset-alert-success">{message}</div>}
            {error && <div className="reset-alert reset-alert-error">{error}</div>}

            {step === 1 ? (
              <form onSubmit={handleRequestReset} className="cobalt-reset-form">
                <div className="cobalt-reset-field">
                  <label htmlFor="email">Email</label>
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@institution.edu"
                    disabled={loading}
                  />
                </div>

                <button type="submit" className="cobalt-reset-btn" disabled={loading}>
                  {loading ? 'Sending...' : 'Send Reset Code'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} className="cobalt-reset-form">
                <div className="cobalt-reset-field">
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

                <div className="cobalt-reset-field">
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

                <div className="cobalt-reset-field">
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

                <button type="submit" className="cobalt-reset-btn" disabled={loading}>
                  {loading ? 'Resetting...' : 'Reset Password'}
                </button>

                <div className="cobalt-reset-meta">
                  <p>Didn't receive the code?</p>
                  <button
                    type="button"
                    onClick={handleResendCode}
                    className="cobalt-reset-link"
                    disabled={resendLoading || loading}
                  >
                    {resendLoading && <span className="spinner spinner-dark"></span>}
                    {resendLoading ? 'Sending...' : 'Resend code'}
                  </button>
                </div>
              </form>
            )}

            <div className="cobalt-reset-nav">
              <button type="button" className="cobalt-reset-link" onClick={() => navigate('/login')}>
                Back to Login
              </button>
            </div>

            <div className="cobalt-reset-prism">
              <p>Verification codes are valid for 15 minutes. Please check your institutional spam folder.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ForgotPassword;
