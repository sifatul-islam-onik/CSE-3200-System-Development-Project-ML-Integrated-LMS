import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Get auth header with token
const getAuthHeader = () => {
  const token = localStorage.getItem('token');
  return {
    headers: {
      Authorization: `Bearer ${token}`
    }
  };
};

// Get pending users (email verified but not approved)
export const getPendingUsers = async () => {
  const response = await axios.get(`${API_URL}/admin/pending-users`, getAuthHeader());
  return response.data;
};

// Approve a user
export const approveUser = async (userId) => {
  const response = await axios.put(`${API_URL}/admin/approve-user/${userId}`, {}, getAuthHeader());
  return response.data;
};

// Reject a user
export const rejectUser = async (userId) => {
  const response = await axios.put(`${API_URL}/admin/reject-user/${userId}`, {}, getAuthHeader());
  return response.data;
};

// Get all users
export const getAllUsers = async () => {
  const response = await axios.get(`${API_URL}/admin/users`, getAuthHeader());
  return response.data;
};

// Toggle user status
export const toggleUserStatus = async (userId) => {
  const response = await axios.put(`${API_URL}/admin/users/${userId}/toggle-status`, {}, getAuthHeader());
  return response.data;
};
