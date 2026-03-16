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

// Error handler wrapper
const handleError = (error) => {
  console.error('API Error:', error);
  
  // Network error - server not reachable
  if (!error.response) {
    const err = new Error(`Network Error: Unable to connect to server. Make sure the backend is running at ${API_URL}`);
    err.success = false;
    err.data = {
      success: false,
      message: `Network Error: Unable to connect to server. Make sure the backend is running at ${API_URL}`
    };
    throw err;
  }
  
  // Server error response
  const err = new Error(error.response?.data?.message || error.message || 'An error occurred');
  err.success = false;
  err.data = error.response?.data || {
    success: false,
    message: error.message || 'An error occurred'
  };
  throw err;
};

// Get pending users (email verified but not approved)
export const getPendingUsers = async () => {
  try {
    const response = await axios.get(`${API_URL}/admin/pending-users`, getAuthHeader());
    return response.data;
  } catch (error) {
    return handleError(error);
  }
};

// Approve a user
export const approveUser = async (userId) => {
  try {
    const response = await axios.put(`${API_URL}/admin/approve-user/${userId}`, {}, getAuthHeader());
    return response.data;
  } catch (error) {
    return handleError(error);
  }
};

// Reject a user
export const rejectUser = async (userId) => {
  try {
    const response = await axios.put(`${API_URL}/admin/reject-user/${userId}`, {}, getAuthHeader());
    return response.data;
  } catch (error) {
    return handleError(error);
  }
};

// Get user metadata
export const getUsersMetadata = async () => {
  try {
    const response = await axios.get(`${API_URL}/admin/users/metadata`, getAuthHeader());
    return response.data;
  } catch (error) {
    return handleError(error);
  }
};

// Get all users
export const getAllUsers = async (params = {}) => {
  try {
    const queryString = new URLSearchParams(params).toString();
    const response = await axios.get(`${API_URL}/admin/users${queryString ? `?${queryString}` : ''}`, getAuthHeader());
    return response.data;
  } catch (error) {
    return handleError(error);
  }
};

// Toggle user status
export const toggleUserStatus = async (userId) => {
  try {
    const response = await axios.put(`${API_URL}/admin/users/${userId}/toggle-status`, {}, getAuthHeader());
    return response.data;
  } catch (error) {
    return handleError(error);
  }
};

// Set user status explicitly
export const setUserStatus = async (userId, isActive) => {
  try {
    const response = await axios.put(`${API_URL}/admin/users/${userId}/status`, { isActive }, getAuthHeader());
    return response.data;
  } catch (error) {
    return handleError(error);
  }
};

// Delete a user
export const deleteUser = async (userId) => {
  try {
    const response = await axios.delete(`${API_URL}/admin/users/${userId}`, getAuthHeader());
    return response.data;
  } catch (error) {
    return handleError(error);
  }
};

// Update user profile
export const updateUserProfile = async (userId, profileData) => {
  try {
    const response = await axios.put(`${API_URL}/admin/users/${userId}/profile`, profileData, getAuthHeader());
    return response.data;
  } catch (error) {
    return handleError(error);
  }
};

// Set teacher designation
export const setUserDesignation = async (userId, designation) => {
  try {
    const response = await axios.put(
      `${API_URL}/admin/users/${userId}/designation`,
      { designation },
      getAuthHeader()
    );
    return response.data;
  } catch (error) {
    return handleError(error);
  }
};

// Set teacher as department head
export const setDepartmentHead = async (userId) => {
  try {
    const response = await axios.put(
      `${API_URL}/admin/users/${userId}/department-head`,
      {},
      getAuthHeader()
    );
    return response.data;
  } catch (error) {
    return handleError(error);
  }
};

// Remove teacher as department head
export const removeDepartmentHead = async (userId) => {
  try {
    const response = await axios.delete(
      `${API_URL}/admin/users/${userId}/department-head`,
      getAuthHeader()
    );
    return response.data;
  } catch (error) {
    return handleError(error);
  }
};

// Get distinct student batches (descending)
export const getStudentBatches = async () => {
  try {
    const response = await axios.get(`${API_URL}/admin/students/batches`, getAuthHeader());
    return response.data;
  } catch (error) {
    return handleError(error);
  }
};

// Import students from Excel
export const importStudentsFromExcel = async (formData) => {
  try {
    const token = localStorage.getItem('token');
    const response = await axios.post(`${API_URL}/admin/users/import`, formData, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  } catch (error) {
    return handleError(error);
  }
};

// Export student credentials
export const exportStudentCredentials = async (batchYear, deptCode) => {
  try {
    const token = localStorage.getItem('token');
    const response = await axios.post(
      `${API_URL}/admin/users/export-credentials`, 
      { batchYear, deptCode },
      {
        headers: {
          Authorization: `Bearer ${token}`
        },
        responseType: 'blob'
      }
    );
    return response.data;
  } catch (error) {
    return handleError(error);
  }
};

// Import teachers from Excel
export const importTeachersFromExcel = async (formData) => {
  try {
    const token = localStorage.getItem('token');
    const response = await axios.post(`${API_URL}/admin/teachers/import`, formData, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  } catch (error) {
    return handleError(error);
  }
};

// Export teacher credentials by department
export const exportTeacherCredentials = async (dept) => {
  try {
    const token = localStorage.getItem('token');
    const response = await axios.post(
      `${API_URL}/admin/teachers/export-credentials`,
      { department: dept },
      {
        headers: {
          Authorization: `Bearer ${token}`
        },
        responseType: 'blob'
      }
    );
    return response.data;
  } catch (error) {
    return handleError(error);
  }
};

// Course assignment functions

// Assign a teacher to a course
export const assignTeacherToCourse = async (courseId, teacherId, section = null) => {
  try {
    const response = await axios.post(
      `${API_URL}/admin/courses/${courseId}/assign-teacher`,
      { teacherId, section },
      getAuthHeader()
    );
    return response.data;
  } catch (error) {
    return handleError(error);
  }
};

// Unassign a teacher from a course
export const unassignTeacherFromCourse = async (courseId, teacherId) => {
  try {
    const response = await axios.delete(
      `${API_URL}/admin/courses/${courseId}/unassign-teacher/${teacherId}`,
      getAuthHeader()
    );
    return response.data;
  } catch (error) {
    return handleError(error);
  }
};

// Get all teachers assigned to a course
export const getAssignedTeachers = async (courseId) => {
  try {
    const response = await axios.get(
      `${API_URL}/admin/courses/${courseId}/assigned-teachers`,
      getAuthHeader()
    );
    return response.data;
  } catch (error) {
    return handleError(error);
  }
};

// Batch assignment functions

// Assign a batch to a course
export const assignBatchToCourse = async (courseId, batch, deptCode, yearLevel, semester, term) => {
  try {
    const response = await axios.post(
      `${API_URL}/admin/courses/${courseId}/assign-batch`,
      // Include optional yearLevel/semester/term to allow backend auto-fill
      { batch, deptCode, yearLevel, semester, term },
      getAuthHeader()
    );
    return response.data;
  } catch (error) {
    return handleError(error);
  }
};

// Unassign a batch from a course
export const unassignBatchFromCourse = async (courseId, batch, deptCode) => {
  try {
    const response = await axios.delete(
      `${API_URL}/admin/courses/${courseId}/unassign-batch`,
      { ...getAuthHeader(), data: { batch, deptCode } }
    );
    return response.data;
  } catch (error) {
    return handleError(error);
  }
};

// Get all batches assigned to a course
export const getAssignedBatches = async (courseId) => {
  try {
    const response = await axios.get(
      `${API_URL}/admin/courses/${courseId}/assigned-batches`,
      getAuthHeader()
    );
    return response.data;
  } catch (error) {
    return handleError(error);
  }
};

// Get students for a course's assigned batch
export const getStudentsForCourse = async (courseId) => {
  try {
    const response = await axios.get(
      `${API_URL}/admin/courses/${courseId}/students`,
      getAuthHeader()
    );
    return response.data;
  } catch (error) {
    return handleError(error);
  }
};

