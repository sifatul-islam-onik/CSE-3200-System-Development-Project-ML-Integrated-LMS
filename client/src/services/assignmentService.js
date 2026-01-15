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

// Create a new assignment
export const createAssignment = async (assignmentData) => {
  const response = await axios.post(`${API_URL}/assignments`, assignmentData, getAuthHeader());
  return response.data;
};

// Update assignment details
export const updateAssignment = async (assignmentId, assignmentData) => {
  const response = await axios.put(`${API_URL}/assignments/${assignmentId}`, assignmentData, getAuthHeader());
  return response.data;
};

// Delete assignment
export const deleteAssignment = async (assignmentId) => {
  const response = await axios.delete(`${API_URL}/assignments/${assignmentId}`, getAuthHeader());
  return response.data;
};

// Submit/grade assignment for a student
export const submitAssignmentMarks = async (assignmentId, submissionData) => {
  const response = await axios.post(`${API_URL}/assignments/${assignmentId}/submit`, submissionData, getAuthHeader());
  return response.data;
};

// Bulk grade assignments for multiple students
export const bulkGradeAssignments = async (assignmentId, submissions) => {
  const response = await axios.post(`${API_URL}/assignments/${assignmentId}/bulk-grade`, { submissions }, getAuthHeader());
  return response.data;
};

// Get all assignments for a course
export const getCourseAssignments = async (courseId, filters = {}) => {
  const params = new URLSearchParams();
  if (filters.section) params.append('section', filters.section);
  if (filters.academicYear) params.append('academicYear', filters.academicYear);
  
  const queryString = params.toString();
  const url = `${API_URL}/assignments/course/${courseId}${queryString ? `?${queryString}` : ''}`;
  const response = await axios.get(url, getAuthHeader());
  return response.data;
};

// Get all assignments for a student
export const getStudentAssignments = async (studentId, filters = {}) => {
  const params = new URLSearchParams();
  if (filters.courseId) params.append('courseId', filters.courseId);
  if (filters.section) params.append('section', filters.section);
  if (filters.academicYear) params.append('academicYear', filters.academicYear);
  
  const queryString = params.toString();
  const url = `${API_URL}/assignments/student/${studentId}${queryString ? `?${queryString}` : ''}`;
  const response = await axios.get(url, getAuthHeader());
  return response.data;
};
