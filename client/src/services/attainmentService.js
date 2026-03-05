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
 * Parse a CT Excel/CSV file uploaded from the teacher dashboard
 * @param {string} courseId - Course ID
 * @param {File} file - The uploaded Excel/CSV file
 * @param {string} ctKey - 'CT1', 'CT2', or 'CT3'
 */
export const parseCTUpload = async (courseId, file, ctKey) => {
  try {
    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('ctKey', ctKey);
    const response = await axios.post(
      `${API_URL}/attainment/ct/${courseId}/parse-upload`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        }
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

/**
 * Get term exam marks for attainment calculations
 * @param {string} courseId - Course ID
 * @param {string} section - Section (A or B) for theory courses
 */
export const getTermExamMarks = async (courseId, section = null) => {
  try {
    const token = localStorage.getItem('token');
    const params = section ? `?section=${section}` : '';
    const response = await axios.get(
      `${API_URL}/attainment/term/${courseId}${params}`,
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
 * Save Lab Activity attainment data
 * @param {string} courseId - Course ID
 * @param {object} data - Lab Activity data to save
 */
export const saveLabActivityData = async (courseId, data) => {
  try {
    const token = localStorage.getItem('token');
    const response = await axios.post(
      `${API_URL}/attainment/labactivity/${courseId}`,
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
 * Get Lab Activity attainment data for a course
 * @param {string} courseId - Course ID
 */
export const getLabActivityData = async (courseId) => {
  try {
    const token = localStorage.getItem('token');
    const response = await axios.get(
      `${API_URL}/attainment/labactivity/${courseId}`,
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
 * Save Section A attainment data
 * @param {string} courseId - Course ID
 * @param {object} data - Section A data to save
 */
export const saveSectionAData = async (courseId, data) => {
  try {
    const token = localStorage.getItem('token');
    const response = await axios.post(
      `${API_URL}/attainment/section-a/${courseId}`,
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
 * Get Section A attainment data for a course
 * @param {string} courseId - Course ID
 */
export const getSectionAData = async (courseId) => {
  try {
    const token = localStorage.getItem('token');
    const response = await axios.get(
      `${API_URL}/attainment/section-a/${courseId}`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

