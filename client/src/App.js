import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './styles/App.css';
import Home from './pages/Home';
import Register from './pages/Register';
import Login from './pages/Login';
import VerifyEmail from './pages/VerifyEmail';
import Profile from './pages/Profile';
import AdminDashboard from './pages/AdminDashboard';
import TeacherDashboard from './pages/TeacherDashboard';
import StudentDashboard from './pages/StudentDashboard';
import WorkbookLayout from './components/WorkbookLayout';
import MarksNavigator from './pages/MarksNavigator';
import { PublicRoute, RoleBasedRoute, ProtectedRoute } from './components/ProtectedRoute';
import { setupTokenInterceptor } from './utils/tokenUtils';

function App() {
  useEffect(() => {
    // Setup axios interceptor for token errors
    setupTokenInterceptor();
  }, []);

  return (
    <Router>
      <div className="app">
        <Routes>
          {/* Public routes - redirect to dashboard if logged in */}
          <Route path="/" element={<PublicRoute><Home /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
          <Route path="/register/:role" element={<PublicRoute><Register /></PublicRoute>} />
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/verify-email" element={<VerifyEmail />} />

          {/* Protected routes - accessible to all authenticated users */}
          <Route 
            path="/profile" 
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            } 
          />

          {/* Role-based protected routes */}
          <Route 
            path="/admin/dashboard" 
            element={
              <RoleBasedRoute allowedRoles={['admin']}>
                <AdminDashboard />
              </RoleBasedRoute>
            } 
          />
          <Route 
            path="/teacher/dashboard" 
            element={
              <RoleBasedRoute allowedRoles={['teacher']}>
                <TeacherDashboard />
              </RoleBasedRoute>
            } 
          />
          <Route 
            path="/teacher/marks" 
            element={
              <RoleBasedRoute allowedRoles={['teacher', 'admin']}>
                <MarksNavigator />
              </RoleBasedRoute>
            } 
          />
          <Route 
            path="/teacher/course/:courseId/marks" 
            element={
              <RoleBasedRoute allowedRoles={['teacher', 'admin']}>
                <WorkbookLayout />
              </RoleBasedRoute>
            } 
          />
          <Route 
            path="/student/dashboard" 
            element={
              <RoleBasedRoute allowedRoles={['student']}>
                <StudentDashboard />
              </RoleBasedRoute>
            } 
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
