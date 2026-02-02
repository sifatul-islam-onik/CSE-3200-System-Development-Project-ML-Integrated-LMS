import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || '/api';

const getAuthHeader = () => {
  const token = localStorage.getItem('token');
  return {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  };
};

// Create a new course proposal (teacher)
export const createCourseProposal = async (proposalData) => {
  try {
    const response = await axios.post(
      `${API_URL}/course-proposals`,
      proposalData,
      getAuthHeader()
    );
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Failed to create course proposal' };
  }
};

// Get teacher's own proposals
export const getMyProposals = async (status = null) => {
  try {
    const url = status 
      ? `${API_URL}/course-proposals/my-proposals?status=${status}`
      : `${API_URL}/course-proposals/my-proposals`;
    
    const response = await axios.get(url, getAuthHeader());
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Failed to fetch proposals' };
  }
};

// Get all proposals (admin)
export const getAllProposals = async (filters = {}) => {
  try {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.proposalType) params.append('proposalType', filters.proposalType);
    if (filters.proposedBy) params.append('proposedBy', filters.proposedBy);

    const url = params.toString() 
      ? `${API_URL}/course-proposals?${params.toString()}`
      : `${API_URL}/course-proposals`;
    
    const response = await axios.get(url, getAuthHeader());
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Failed to fetch proposals' };
  }
};

// Get single proposal by ID
export const getProposalById = async (proposalId) => {
  try {
    const response = await axios.get(
      `${API_URL}/course-proposals/${proposalId}`,
      getAuthHeader()
    );
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Failed to fetch proposal' };
  }
};

// Approve proposal (admin)
export const approveProposal = async (proposalId, reviewComments = '') => {
  try {
    const response = await axios.put(
      `${API_URL}/course-proposals/${proposalId}/approve`,
      { reviewComments },
      getAuthHeader()
    );
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Failed to approve proposal' };
  }
};

// Reject proposal (admin)
export const rejectProposal = async (proposalId, reviewComments = '') => {
  try {
    const response = await axios.put(
      `${API_URL}/course-proposals/${proposalId}/reject`,
      { reviewComments },
      getAuthHeader()
    );
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Failed to reject proposal' };
  }
};

// Delete proposal (teacher - only pending)
export const deleteProposal = async (proposalId) => {
  try {
    const response = await axios.delete(
      `${API_URL}/course-proposals/${proposalId}`,
      getAuthHeader()
    );
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Failed to delete proposal' };
  }
};

const courseProposalService = {
  createCourseProposal,
  getMyProposals,
  getAllProposals,
  getProposalById,
  approveProposal,
  rejectProposal,
  deleteProposal
};

export default courseProposalService;
