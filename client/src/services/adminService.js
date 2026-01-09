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

// Get pending users (email verified but not approved)
export const getPendingUsers = async () => {
  const response = await axios.get(`${API_URL}/admin/pending-users`, getAuthHeader());
  return response.data;
};

// Approve a user
export const approveUser = async (userId) => {
  const response = await axios.put(`${API_URL}/admin/approve-user/${userId}`, {}, getAuthHeader());
  return response.data;
};

// Reject a user
export const rejectUser = async (userId) => {
  const response = await axios.put(`${API_URL}/admin/reject-user/${userId}`, {}, getAuthHeader());
  return response.data;
};

// Get all users
export const getAllUsers = async () => {
  const response = await axios.get(`${API_URL}/admin/users`, getAuthHeader());
  return response.data;
};

// Toggle user status
export const toggleUserStatus = async (userId) => {
  const response = await axios.put(`${API_URL}/admin/users/${userId}/toggle-status`, {}, getAuthHeader());
  return response.data;
};

// Set user status explicitly
export const setUserStatus = async (userId, isActive) => {
  const response = await axios.put(`${API_URL}/admin/users/${userId}/status`, { isActive }, getAuthHeader());
  return response.data;
};

// Delete a user
export const deleteUser = async (userId) => {
  const response = await axios.delete(`${API_URL}/admin/users/${userId}`, getAuthHeader());
  return response.data;
};

// Set teacher designation
export const setUserDesignation = async (userId, designation) => {
  const response = await axios.put(
    `${API_URL}/admin/users/${userId}/designation`,
    { designation },
    getAuthHeader()
  );
  return response.data;
};

// Import students from Excel
export const importStudentsFromExcel = async (formData) => {
  const token = localStorage.getItem('token');
  const response = await axios.post(`${API_URL}/admin/users/import`, formData, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'multipart/form-data'
    }
  });
  return response.data;
};

// Export student credentials
export const exportStudentCredentials = async (batchYear, deptCode) => {
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
};

// Import teachers from Excel
export const importTeachersFromExcel = async (formData) => {
  const token = localStorage.getItem('token');
  const response = await axios.post(`${API_URL}/admin/teachers/import`, formData, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'multipart/form-data'
    }
  });
  return response.data;
};

// Export teacher credentials by department
export const exportTeacherCredentials = async (dept) => {
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
};

// Course assignment functions

// Assign a teacher to a course
export const assignTeacherToCourse = async (courseId, teacherId, section = null) => {
  const response = await axios.post(
    `${API_URL}/admin/courses/${courseId}/assign-teacher`,
    { teacherId, section },
    getAuthHeader()
  );
  return response.data;
};

// Unassign a teacher from a course
export const unassignTeacherFromCourse = async (courseId, teacherId, section = null) => {
  const params = section ? `?section=${section}` : '';
  const response = await axios.delete(
    `${API_URL}/admin/courses/${courseId}/unassign-teacher/${teacherId}${params}`,
    getAuthHeader()
  );
  return response.data;
};

// Get all teachers assigned to a course
export const getAssignedTeachers = async (courseId) => {
  const response = await axios.get(
    `${API_URL}/admin/courses/${courseId}/assigned-teachers`,
    getAuthHeader()
  );
  return response.data;
};

