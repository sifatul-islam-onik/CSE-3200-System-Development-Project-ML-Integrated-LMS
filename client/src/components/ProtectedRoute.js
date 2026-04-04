import React from 'react';
import { Navigate } from 'react-router-dom';

const clearStoredAuth = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};

const safeParseUser = () => {
  const user = localStorage.getItem('user');

  if (!user) {
    return null;
  }

  try {
    return JSON.parse(user);
  } catch (_error) {
    clearStoredAuth();
    return null;
  }
};

// Check if user is authenticated
export const isAuthenticated = () => {
  const token = localStorage.getItem('token');
  const user = safeParseUser();
  return !!token && !!user;
};

// Get user data from localStorage
export const getUser = () => {
  return safeParseUser();
};

// Get user role
export const getUserRole = () => {
  const user = getUser();
  return user ? user.role : null;
};

// Logout function
export const logout = () => {
  clearStoredAuth();
};

// Protected Route Component
export const ProtectedRoute = ({ children }) => {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

// Role-Based Route Component
export const RoleBasedRoute = ({ children, allowedRoles }) => {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  const userRole = getUserRole();

  if (!allowedRoles.includes(userRole)) {
    // Redirect to appropriate dashboard based on actual role
    if (userRole === 'admin') {
      return <Navigate to="/admin/dashboard" replace />;
    } else if (userRole === 'teacher') {
      return <Navigate to="/teacher/dashboard" replace />;
    } else if (userRole === 'student') {
      return <Navigate to="/student/dashboard" replace />;
    }
    return <Navigate to="/login" replace />;
  }

  return children;
};

// Public Route Component (redirect if already logged in)
export const PublicRoute = ({ children }) => {
  if (isAuthenticated()) {
    const userRole = getUserRole();
    
    if (userRole === 'admin') {
      return <Navigate to="/admin/dashboard" replace />;
    } else if (userRole === 'teacher') {
      return <Navigate to="/teacher/dashboard" replace />;
    } else if (userRole === 'student') {
      return <Navigate to="/student/dashboard" replace />;
    }
  }

  return children;
};
