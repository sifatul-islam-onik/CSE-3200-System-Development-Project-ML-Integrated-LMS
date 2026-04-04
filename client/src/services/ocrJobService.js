import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL ? `${process.env.REACT_APP_API_URL}/ocr` : '/api/ocr';

// Submit OCR job
export const submitOCRJob = async (studentId, courseId, section, imageUrl, student = null) => {
  const response = await axios.post(`${API_URL}/submit`, {
    studentId,
    courseId,
    section,
    imageUrl,
    student // Include student info (name, roll) for UI display
  }, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
  });
  return response.data;
};

// Get all user's OCR jobs
export const getUserOCRJobs = async (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.courseId) params.append('courseId', filters.courseId);
  if (filters.studentId) params.append('studentId', filters.studentId);
  if (filters.status) params.append('status', filters.status);

  const response = await axios.get(`${API_URL}/jobs?${params.toString()}`, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
  });
  return response.data;
};

// Get specific job status
export const getOCRJobStatus = async (jobId) => {
  const response = await axios.get(`${API_URL}/status/${jobId}`, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
  });
  return response.data;
};

// Delete job
export const deleteOCRJob = async (jobId) => {
  const response = await axios.delete(`${API_URL}/jobs/${jobId}`, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
  });
  return response.data;
};

// Get queue status
export const getQueueStatus = async () => {
  const response = await axios.get(`${API_URL}/queue-status`, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
  });
  return response.data;
};
