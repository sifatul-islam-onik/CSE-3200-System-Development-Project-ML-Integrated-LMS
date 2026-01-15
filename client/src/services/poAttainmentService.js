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
  };
};

/**
 * Get PO attainment for a course
 * @param {string} courseId - Course ID
 * @param {object} filters - Optional filters (section, academicYear)
 * @returns {Promise} - PO attainment data
 */
export const getCoursePOAttainment = async (courseId, filters = {}) => {
  const params = new URLSearchParams();
  if (filters.section) params.append('section', filters.section);
  if (filters.academicYear) params.append('academicYear', filters.academicYear);
  
  const queryString = params.toString();
  const url = `${API_URL}/po-attainment/course/${courseId}${queryString ? `?${queryString}` : ''}`;
  
  const response = await axios.get(url, getAuthHeader());
  return response.data;
};

/**
 * Calculate PO attainment for a course
 * @param {string} courseId - Course ID
 * @param {object} data - Calculation parameters
 * @returns {Promise} - Calculated PO attainment
 */
export const calculateCoursePOAttainment = async (courseId, data) => {
  const response = await axios.post(
    `${API_URL}/po-attainment/calculate/${courseId}`,
    data,
    getAuthHeader()
  );
  return response.data;
};

/**
 * Get PO attainment for a program
 * @param {string} programId - Program ID
 * @param {object} filters - Optional filters (academicYear, batch)
 * @returns {Promise} - Program-level PO attainment data
 */
export const getProgramPOAttainment = async (programId, filters = {}) => {
  const params = new URLSearchParams();
  if (filters.academicYear) params.append('academicYear', filters.academicYear);
  if (filters.batch) params.append('batch', filters.batch);
  
  const queryString = params.toString();
  const url = `${API_URL}/po-attainment/program/${programId}${queryString ? `?${queryString}` : ''}`;
  
  const response = await axios.get(url, getAuthHeader());
  return response.data;
};
