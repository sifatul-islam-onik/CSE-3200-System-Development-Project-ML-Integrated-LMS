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

// Get all course outcomes for a course
export const getCourseOutcomes = async (courseId) => {
  const response = await axios.get(`${API_URL}/courses/${courseId}/outcomes`, getAuthHeader());
  return response.data;
};

// Create course outcomes
export const createCourseOutcomes = async (courseId, outcomeData) => {
  const response = await axios.post(`${API_URL}/courses/${courseId}/outcomes`, outcomeData, getAuthHeader());
  return response.data;
};

// Update course outcome
export const updateCourseOutcome = async (outcomeId, outcomeData) => {
  const response = await axios.put(`${API_URL}/courses/outcomes/${outcomeId}`, outcomeData, getAuthHeader());
  return response.data;
};

// Delete course outcome
export const deleteCourseOutcome = async (outcomeId) => {
  const response = await axios.delete(`${API_URL}/courses/outcomes/${outcomeId}`, getAuthHeader());
  return response.data;
};

// Delete all course outcomes for a course
export const deleteAllCourseOutcomes = async (courseId) => {
  const response = await axios.delete(`${API_URL}/courses/${courseId}/outcomes`, getAuthHeader());
  return response.data;
};
