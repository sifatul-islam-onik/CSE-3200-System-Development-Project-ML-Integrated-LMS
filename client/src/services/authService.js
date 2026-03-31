import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || '/api';

// Login user
export const login = async (credentials) => {
  const response = await axios.post(`${API_URL}/auth/login`, credentials);
  return response.data;
};

// Request password reset OTP
export const forgotPassword = async (email) => {
  const response = await axios.post(`${API_URL}/auth/forgot-password`, { email });
  return response.data;
};

// Reset password with OTP
export const resetPassword = async (payload) => {
  const response = await axios.post(`${API_URL}/auth/reset-password`, payload);
  return response.data;
};

// Verify email
export const verifyEmail = async (token) => {
  const response = await axios.get(`${API_URL}/auth/verify-email/${token}`);
  return response.data;
};

// Get current user profile
export const getProfile = async () => {
  const token = localStorage.getItem('token');
  const response = await axios.get(`${API_URL}/auth/profile`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};
