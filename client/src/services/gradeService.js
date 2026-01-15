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

// Calculate grade for a single student
export const calculateStudentGrade = async (studentId, courseId, data) => {
  const response = await axios.post(
    `${API_URL}/grades/calculate/${studentId}/${courseId}`,
    data,
    getAuthHeader()
  );
  return response.data;
};

// Calculate grades for all students in a course
export const calculateCourseGrades = async (courseId, data) => {
  const response = await axios.post(
    `${API_URL}/grades/calculate/course/${courseId}`,
    data,
    getAuthHeader()
  );
  return response.data;
};

// Get all grades for a course
export const getCourseGrades = async (courseId, filters = {}) => {
  const params = new URLSearchParams();
  if (filters.section) params.append('section', filters.section);
  if (filters.academicYear) params.append('academicYear', filters.academicYear);
  
  const queryString = params.toString();
  const url = `${API_URL}/grades/course/${courseId}${queryString ? `?${queryString}` : ''}`;
  const response = await axios.get(url, getAuthHeader());
  return response.data;
};

// Get grade for a specific student
export const getStudentGrade = async (studentId, courseId, filters = {}) => {
  const params = new URLSearchParams();
  if (filters.section) params.append('section', filters.section);
  if (filters.academicYear) params.append('academicYear', filters.academicYear);
  
  const queryString = params.toString();
  const url = `${API_URL}/grades/${studentId}/${courseId}${queryString ? `?${queryString}` : ''}`;
  const response = await axios.get(url, getAuthHeader());
  return response.data;
};

// Finalize grades for a course
export const finalizeGrades = async (courseId, data) => {
  const response = await axios.post(
    `${API_URL}/grades/finalize/${courseId}`,
    data,
    getAuthHeader()
  );
  return response.data;
};

// Unfinalize a specific grade (admin only)
export const unfinalizeGrade = async (gradeId) => {
  const response = await axios.post(
    `${API_URL}/grades/unfinalize/${gradeId}`,
    {},
    getAuthHeader()
  );
  return response.data;
};
