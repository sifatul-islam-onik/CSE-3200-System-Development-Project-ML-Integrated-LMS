import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || '/api';

/**
 * Get course profile data from database (COs with CO-PO mappings)
 * Returns only the course's own COs (no theory/lab merging) — used for the Course Profile tab.
 */
export const getCourseProfile = async (courseCode) => {
  try {
    const token = localStorage.getItem('token');
    const response = await axios.get(`${API_URL}/course-outcomes/profile/${encodeURIComponent(courseCode)}?ownOnly=true`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

/**
 * Get combined course profile data (theory + lab merged COs with CO-PO mappings)
 * Used for calculation sheets: CO Attainment, CO Calc, CO-PO Map, Charts.
 */
export const getCombinedCourseProfile = async (courseCode) => {
  try {
    const token = localStorage.getItem('token');
    const response = await axios.get(`${API_URL}/course-outcomes/profile/${encodeURIComponent(courseCode)}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

/**
 * Update CLO field
 */
export const updateCLOField = async (cloNumber, field, value) => {
  try {
    const token = localStorage.getItem('token');
    const response = await axios.put(
      `${API_URL}/course-profile/update`,
      { cloNumber, field, value },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};
