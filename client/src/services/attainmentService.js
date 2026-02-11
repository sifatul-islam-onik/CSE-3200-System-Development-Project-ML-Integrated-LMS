import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || '/api';

/**
 * Get list of all sheet names
 */
export const getSheetNames = async () => {
  try {
    const token = localStorage.getItem('token');
    const response = await axios.get(`${API_URL}/attainment/sheets`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

/**
 * Get attainment data for a sheet
 * @param {string} sheetName - Optional sheet name (defaults to first sheet)
 */
export const getAttainmentData = async (sheetName = null) => {
  try {
    const token = localStorage.getItem('token');
    const endpoint = sheetName 
      ? `${API_URL}/attainment/${sheetName}`
      : `${API_URL}/attainment`;
    
    const response = await axios.get(endpoint, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

/**
 * Update single student PO value
 * @param {string} sheetName - Sheet name (optional)
 * @param {string} rollNumber - Student roll number
 * @param {string} poNumber - PO identifier (PO1-PO12)
 * @param {*} value - New value
 */
export const updateStudentPoValue = async (sheetName, rollNumber, poNumber, value) => {
  try {
    const token = localStorage.getItem('token');
    const response = await axios.put(
      `${API_URL}/attainment/update`,
      {
        sheetName,
        rollNumber,
        poNumber,
        value
      },
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

/**
 * Batch update multiple student PO values
 * @param {string} sheetName - Sheet name (optional)
 * @param {Array} updates - Array of {rollNumber, poNumber, value}
 */
export const batchUpdateStudentPoValues = async (sheetName, updates) => {
  try {
    const token = localStorage.getItem('token');
    const response = await axios.put(
      `${API_URL}/attainment/batch-update`,
      {
        sheetName,
        updates
      },
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

/**
 * Save CT attainment data
 * @param {string} courseId - Course ID
 * @param {object} data - CT data to save
 */
export const saveCTData = async (courseId, data) => {
  try {
    const token = localStorage.getItem('token');
    const response = await axios.post(
      `${API_URL}/attainment/ct/${courseId}`,
      data,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

/**
 * Get CT attainment data for a course
 * @param {string} courseId - Course ID
 */
export const getCTData = async (courseId) => {
  try {
    const token = localStorage.getItem('token');
    const response = await axios.get(
      `${API_URL}/attainment/ct/${courseId}`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

/**
 * Save Assignment/Attendance attainment data
 * @param {string} courseId - Course ID
 * @param {object} data - Assignment data to save
 */
export const saveAssignmentData = async (courseId, data) => {
  try {
    const token = localStorage.getItem('token');
    const response = await axios.post(
      `${API_URL}/attainment/assignment/${courseId}`,
      data,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

/**
 * Get Assignment/Attendance attainment data for a course
 * @param {string} courseId - Course ID
 */
export const getAssignmentData = async (courseId) => {
  try {
    const token = localStorage.getItem('token');
    const response = await axios.get(
      `${API_URL}/attainment/assignment/${courseId}`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};
