import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || '/api';

const getAuthHeader = () => {
  const token = localStorage.getItem('token');
  return { headers: { Authorization: `Bearer ${token}` } };
};

/**
 * Admin: compute (or recompute) draft results for a batch+term.
 * @param {{ batch, deptCode, yearLevel, term }} params
 */
export const computeResults = async (params) => {
  const response = await axios.post(
    `${API_URL}/results/compute`,
    params,
    getAuthHeader()
  );
  return response.data;
};

/**
 * Admin: publish all computed results for a batch+term.
 * @param {{ batch, deptCode, yearLevel, term }} params
 */
export const publishResults = async (params) => {
  const response = await axios.post(
    `${API_URL}/results/publish`,
    params,
    getAuthHeader()
  );
  return response.data;
};

/**
 * Admin: unpublish results for a batch+term.
 * @param {{ batch, deptCode, yearLevel, term }} params
 */
export const unpublishResults = async (params) => {
  const response = await axios.post(
    `${API_URL}/results/unpublish`,
    params,
    getAuthHeader()
  );
  return response.data;
};

/**
 * Admin: get all results (including drafts) for a batch+term.
 * @param {{ batch, deptCode, yearLevel, term, publishedOnly? }} params
 */
export const getBatchResults = async ({ batch, deptCode, yearLevel, term, publishedOnly = false }) => {
  const response = await axios.get(`${API_URL}/results/batch`, {
    params: { batch, deptCode, yearLevel, term, publishedOnly },
    ...getAuthHeader(),
  });
  return response.data;
};

/**
 * Student: get own published results.
 */
export const getStudentResults = async () => {
  const response = await axios.get(`${API_URL}/results/student`, getAuthHeader());
  return response.data;
};

/**
 * Admin: get any student's results (includes unpublished).
 * @param {string} studentId
 */
export const getStudentResultsByAdmin = async (studentId) => {
  const response = await axios.get(
    `${API_URL}/results/student/${studentId}`,
    getAuthHeader()
  );
  return response.data;
};
