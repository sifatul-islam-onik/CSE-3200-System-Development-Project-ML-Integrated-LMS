import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

/**
 * Get authentication header with JWT token
 */
const getAuthHeader = () => {
  const token = localStorage.getItem('token');
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    responseType: 'blob', // Important for file downloads
  };
};

/**
 * Export all marks (CT, Attendance, Assignment, Grades) as Excel
 * @param {string} courseId - Course ID
 * @param {object} filters - Optional filters (section, academicYear)
 * @returns {Promise<Blob>} - Excel file blob
 */
export const exportAllMarks = async (courseId, filters = {}) => {
  const params = new URLSearchParams();
  if (filters.section) params.append('section', filters.section);
  if (filters.academicYear) params.append('academicYear', filters.academicYear);
  
  const queryString = params.toString();
  const url = `${API_URL}/export/course/${courseId}/marks${queryString ? `?${queryString}` : ''}`;
  
  const response = await axios.get(url, getAuthHeader());
  return response.data;
};

/**
 * Export individual component (CT, Attendance, Assignment, or Grades)
 * @param {string} courseId - Course ID
 * @param {string} component - Component type: 'ct', 'attendance', 'assignment', 'grades'
 * @param {object} filters - Optional filters (section, academicYear)
 * @returns {Promise<Blob>} - Excel file blob
 */
export const exportComponent = async (courseId, component, filters = {}) => {
  const params = new URLSearchParams();
  if (filters.section) params.append('section', filters.section);
  if (filters.academicYear) params.append('academicYear', filters.academicYear);
  
  const queryString = params.toString();
  const url = `${API_URL}/export/course/${courseId}/${component}${queryString ? `?${queryString}` : ''}`;
  
  const response = await axios.get(url, getAuthHeader());
  return response.data;
};

/**
 * Download file from blob
 * @param {Blob} blob - File blob
 * @param {string} filename - Filename with extension
 */
export const downloadFile = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

/**
 * Export CT marks as Excel
 */
export const exportCTMarks = async (courseId, filters = {}) => {
  return exportComponent(courseId, 'ct', filters);
};

/**
 * Export Attendance as Excel
 */
export const exportAttendance = async (courseId, filters = {}) => {
  return exportComponent(courseId, 'attendance', filters);
};

/**
 * Export Assignments as Excel
 */
export const exportAssignments = async (courseId, filters = {}) => {
  return exportComponent(courseId, 'assignment', filters);
};

/**
 * Export Final Grades as Excel
 */
export const exportGrades = async (courseId, filters = {}) => {
  return exportComponent(courseId, 'grades', filters);
};
