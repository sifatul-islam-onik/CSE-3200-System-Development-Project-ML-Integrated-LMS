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

// Get CO attainment for a course
export const getCourseCoAttainment = async (courseId, filters = {}) => {
  const params = new URLSearchParams();
  if (filters.section) params.append('section', filters.section);
  if (filters.academicYear) params.append('academicYear', filters.academicYear);
  
  const queryString = params.toString();
  const url = `${API_URL}/co-attainment/course/${courseId}${queryString ? `?${queryString}` : ''}`;
  const response = await axios.get(url, getAuthHeader());
  return response.data;
};

// Calculate CO attainment for a course
export const calculateCourseCoAttainment = async (courseId, data) => {
  const response = await axios.post(
    `${API_URL}/co-attainment/calculate/${courseId}`,
    data,
    getAuthHeader()
  );
  return response.data;
};
