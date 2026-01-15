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

// Save or update CT marks for a student
export const saveCTMarks = async (marksData) => {
  const response = await axios.post(`${API_URL}/ct-marks`, marksData, getAuthHeader());
  return response.data;
};

// Bulk save CT marks for multiple students
export const bulkSaveCTMarks = async (payload) => {
  console.log('[ctMarksService] POST Bulk Save:', payload);
  const response = await axios.post(`${API_URL}/ct-marks/bulk`, payload, getAuthHeader());
  console.log('[ctMarksService] POST Response:', response.data);
  return response.data;
};

// Get CT marks for a specific student in a course
export const getStudentCTMarks = async (studentId, courseId, filters = {}) => {
  const params = new URLSearchParams();
  if (filters.section) params.append('section', filters.section);
  if (filters.academicYear) params.append('academicYear', filters.academicYear);
  if (filters.ctNumber) params.append('ctNumber', filters.ctNumber);
  
  const queryString = params.toString();
  const url = `${API_URL}/ct-marks/${studentId}/${courseId}${queryString ? `?${queryString}` : ''}`;
  const response = await axios.get(url, getAuthHeader());
  return response.data;
};

// Get all CT marks for a course
export const getCourseCTMarks = async (courseId, filters = {}) => {
  const params = new URLSearchParams();
  if (filters.section) params.append('section', filters.section);
  if (filters.academicYear) params.append('academicYear', filters.academicYear);
  if (filters.ctNumber) params.append('ctNumber', filters.ctNumber);
  
  const queryString = params.toString();
  const url = `${API_URL}/ct-marks/course/${courseId}${queryString ? `?${queryString}` : ''}`;
  
  console.log('[ctMarksService] GET Request:', url);
  console.log('[ctMarksService] Filters:', filters);
  
  const response = await axios.get(url, getAuthHeader());
  
  console.log('[ctMarksService] GET Response:', response.data);
  
  return response.data;
};

// Calculate best N CTs (drops lowest)
export const calculateBestCTs = async (studentId, courseId, keepCount, filters = {}) => {
  const requestData = {
    studentId,
    courseId,
    keepCount
  };
  if (filters.section) requestData.section = filters.section;
  if (filters.academicYear) requestData.academicYear = filters.academicYear;
  
  const response = await axios.post(`${API_URL}/ct-marks/calculate-best`, requestData, getAuthHeader());
  return response.data;
};

// Get CT marks summary/statistics for a course
export const getCTMarksSummary = async (courseId, filters = {}) => {
  const params = new URLSearchParams();
  if (filters.section) params.append('section', filters.section);
  if (filters.academicYear) params.append('academicYear', filters.academicYear);
  if (filters.ctNumber) params.append('ctNumber', filters.ctNumber);
  
  const queryString = params.toString();
  const url = `${API_URL}/ct-marks/course/${courseId}/summary${queryString ? `?${queryString}` : ''}`;
  const response = await axios.get(url, getAuthHeader());
  return response.data;
};

// Delete CT marks by ID
export const deleteCTMarks = async (marksId) => {
  const response = await axios.delete(`${API_URL}/ct-marks/${marksId}`, getAuthHeader());
  return response.data;
};
