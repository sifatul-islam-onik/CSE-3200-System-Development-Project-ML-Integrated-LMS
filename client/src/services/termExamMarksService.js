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

// Save or update term exam marks for a student
export const saveTermExamMarks = async (marksData) => {
  const response = await axios.post(`${API_URL}/term-exam-marks`, marksData, getAuthHeader());
  return response.data;
};

// Get marks for a specific student in a course
export const getTermExamMarks = async (studentId, courseId, section = null) => {
  const params = section ? `?section=${section}` : '';
  const response = await axios.get(`${API_URL}/term-exam-marks/${studentId}/${courseId}${params}`, getAuthHeader());
  return response.data;
};

// Get all marks for a course
export const getCourseTermExamMarks = async (courseId, section = null) => {
  const params = section ? `?section=${section}` : '';
  const response = await axios.get(`${API_URL}/term-exam-marks/course/${courseId}${params}`, getAuthHeader());
  return response.data;
};

// Delete marks for a student
export const deleteTermExamMarks = async (studentId, courseId, section = null) => {
  const params = section ? `?section=${section}` : '';
  const response = await axios.delete(`${API_URL}/term-exam-marks/${studentId}/${courseId}${params}`, getAuthHeader());
  return response.data;
};
