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

// Save or update attendance for a student
export const saveAttendance = async (attendanceData) => {
  const response = await axios.post(`${API_URL}/attendance`, attendanceData, getAuthHeader());
  return response.data;
};

// Bulk save attendance for multiple students
export const bulkSaveAttendance = async (attendanceArray) => {
  console.log('[attendanceService] POST Bulk Save:', attendanceArray);
  const response = await axios.post(`${API_URL}/attendance/bulk`, { marks: attendanceArray }, getAuthHeader());
  console.log('[attendanceService] POST Response:', response.data);
  return response.data;
};

// Get attendance for a specific student in a course
export const getStudentAttendance = async (studentId, courseId, filters = {}) => {
  const params = new URLSearchParams();
  if (filters.section) params.append('section', filters.section);
  if (filters.academicYear) params.append('academicYear', filters.academicYear);
  
  const queryString = params.toString();
  const url = `${API_URL}/attendance/${studentId}/${courseId}${queryString ? `?${queryString}` : ''}`;
  const response = await axios.get(url, getAuthHeader());
  return response.data;
};

// Get all attendance records for a course
export const getCourseAttendance = async (courseId, filters = {}) => {
  const params = new URLSearchParams();
  if (filters.section) params.append('section', filters.section);
  if (filters.academicYear) params.append('academicYear', filters.academicYear);
  
  const queryString = params.toString();
  const url = `${API_URL}/attendance/course/${courseId}${queryString ? `?${queryString}` : ''}`;
  
  console.log('[attendanceService] GET Request:', url);
  console.log('[attendanceService] Filters:', filters);
  
  const response = await axios.get(url, getAuthHeader());
  
  console.log('[attendanceService] GET Response:', response.data);
  
  return response.data;
};

// Update attendance record
export const updateAttendance = async (attendanceId, attendanceData) => {
  const response = await axios.put(`${API_URL}/attendance/${attendanceId}`, attendanceData, getAuthHeader());
  return response.data;
};

// Delete attendance record
export const deleteAttendance = async (attendanceId) => {
  const response = await axios.delete(`${API_URL}/attendance/${attendanceId}`, getAuthHeader());
  return response.data;
};
