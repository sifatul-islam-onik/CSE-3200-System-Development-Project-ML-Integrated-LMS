import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || '/api';

// Get auth header with token
const getAuthHeader = () => {
  const token = localStorage.getItem('token');
  return {
    headers: {
      Authorization: `Bearer ${token}`
    }
  };
};

// Get all Program Outcomes (public endpoint)
export const getAllProgramOutcomes = async () => {
  const response = await axios.get(`${API_URL}/program-outcomes`);
  return response.data;
};

// Get single Program Outcome by code
export const getProgramOutcomeByCode = async (poCode) => {
  const response = await axios.get(`${API_URL}/program-outcomes/${poCode}`);
  return response.data;
};

// Update Program Outcome (admin only - title/description)
export const updateProgramOutcome = async (poCode, data) => {
  const response = await axios.put(
    `${API_URL}/program-outcomes/${poCode}`,
    data,
    getAuthHeader()
  );
  return response.data;
};
