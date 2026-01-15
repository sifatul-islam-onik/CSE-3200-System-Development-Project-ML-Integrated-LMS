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
  // Normalize section: convert empty string to null
  const normalizedData = {
    ...marksData,
    section: marksData.section || null
  };
  
  console.log('[termExamMarksService] POST Save:', normalizedData);
  
  const response = await axios.post(`${API_URL}/term-exam-marks`, normalizedData, getAuthHeader());
  
  console.log('[termExamMarksService] POST Response:', response.data);
  
  return response.data;
};

// Get marks for a specific student in a course
export const getTermExamMarks = async (studentId, courseId, section = null) => {
  // Only add section param if it's a truthy value
  const params = section ? `?section=${section}` : '';
  const url = `${API_URL}/term-exam-marks/${studentId}/${courseId}${params}`;
  
  console.log('[termExamMarksService] GET Request:', url);
  console.log('[termExamMarksService] Section:', section);
  
  const response = await axios.get(url, getAuthHeader());
  
  console.log('[termExamMarksService] GET Response:', response.data);
  
  return response.data;
};

// Get all marks for a course
export const getCourseTermExamMarks = async (courseId, filters = {}) => {
  // Support both old signature (section string) and new (filters object) for backward compatibility
  let section = null;
  let academicYear = null;

  if (typeof filters === 'string') {
    section = filters;
  } else if (typeof filters === 'object' && filters !== null) {
    section = filters.section;
    academicYear = filters.academicYear;
  }

  const params = new URLSearchParams();
  if (section) params.append('section', section);
  if (academicYear) params.append('academicYear', academicYear);
  
  const queryString = params.toString();
  const url = `${API_URL}/term-exam-marks/course/${courseId}${queryString ? `?${queryString}` : ''}`;

  console.log('[termExamMarksService] GET Request:', url);
  console.log('[termExamMarksService] Filters:', filters);

  const response = await axios.get(url, getAuthHeader());
  return response.data;
};

// Delete marks for a student
export const deleteTermExamMarks = async (studentId, courseId, section = null) => {
  const params = section ? `?section=${section}` : '';
  const response = await axios.delete(`${API_URL}/term-exam-marks/${studentId}/${courseId}${params}`, getAuthHeader());
  return response.data;
};
