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

// Create a new course
export const createCourse = async (courseData) => {
  const response = await axios.post(`${API_URL}/courses`, courseData, getAuthHeader());
  return response.data;
};

// Get all courses
export const getAllCourses = async (filters = {}) => {
  const params = new URLSearchParams(filters);
  const response = await axios.get(`${API_URL}/courses?${params}`, getAuthHeader());
  return response.data;
};

// Get single course
export const getCourse = async (courseId) => {
  const response = await axios.get(`${API_URL}/courses/${courseId}`, getAuthHeader());
  return response.data;
};

// Update course
export const updateCourse = async (courseId, courseData) => {
  const response = await axios.put(`${API_URL}/courses/${courseId}`, courseData, getAuthHeader());
  return response.data;
};

// Delete course
export const deleteCourse = async (courseId) => {
  const response = await axios.delete(`${API_URL}/courses/${courseId}`, getAuthHeader());
  return response.data;
};

// Toggle publish status
export const togglePublishStatus = async (courseId) => {
  const response = await axios.put(`${API_URL}/courses/${courseId}/toggle-publish`, {}, getAuthHeader());
  return response.data;
};
