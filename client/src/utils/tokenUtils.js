import axios from 'axios';

/**
 * Setup axios interceptor for handling token errors and network issues
 * Automatically redirects to login if token is invalid or expired
 * Provides better error messages for network failures
 */
export const setupTokenInterceptor = () => {
  axios.interceptors.response.use(
    (response) => response,
    (error) => {
      // Log error details for debugging
      console.error('API Error:', {
        status: error.response?.status,
        message: error.response?.data?.message,
        errorMsg: error.message,
        url: error.config?.url
      });

      // Handle network errors (failed to fetch, timeout, etc.)
      if (!error.response) {
        if (error.message === 'Network Error' || error.message.includes('fetch')) {
          // Network/CORS issue
          const enhancedError = new Error(
            'Network error: Unable to reach server. Make sure the backend is running on http://localhost:5000'
          );
          enhancedError.originalError = error;
          return Promise.reject(enhancedError);
        }
      }

      // Check if error is due to invalid or expired token
      if (error.response?.status === 401) {
        const message = error.response?.data?.message || '';
        
        // If it's a token issue, clear storage and redirect to login
        if (
          message.includes('Invalid or expired token') ||
          message.includes('Not authorized') ||
          message.includes('token')
        ) {
          // Clear all auth data
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          
          // Show alert to user
          alert('Your session has expired. Please log in again.');
          
          // Redirect to login
          window.location.href = '/login';
        }
      }
      
      return Promise.reject(error);
    }
  );
};

/**
 * Get stored JWT token from localStorage
 */
export const getToken = () => {
  return localStorage.getItem('token');
};

/**
 * Save JWT token to localStorage
 */
export const saveToken = (token) => {
  if (token) {
    localStorage.setItem('token', token);
  }
};

/**
 * Clear JWT token from localStorage
 */
export const clearToken = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};

/**
 * Check if token exists
 */
export const hasToken = () => {
  return !!localStorage.getItem('token');
};
