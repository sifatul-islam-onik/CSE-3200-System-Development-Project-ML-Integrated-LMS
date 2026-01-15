import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import CTMarksSheet from '../pages/CTMarksSheet';
import AttendanceSheet from '../pages/AttendanceSheet';
import AssignmentSheet from '../pages/AssignmentSheet';
import GradeSheet from '../pages/GradeSheet';
import COAttainmentSheet from '../pages/COAttainmentSheet';
import POAttainmentSheet from '../pages/POAttainmentSheet';
import { WorkbookProvider, useWorkbook } from '../context/WorkbookContext';
import { getCourseById } from '../services/courseService';
import '../styles/WorkbookLayout.css';

const WorkbookInternal = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { isLocked, setIsLocked } = useWorkbook();
  
  // Initialize from localStorage or default to 'ct'
  const savedTab = localStorage.getItem(`workbook_tab_${courseId}`);
  const [activeTab, setActiveTab] = useState(savedTab || 'ct');
  
  // Track which tabs have been initialized to avoid mounting all at once
  const [visitedTabs, setVisitedTabs] = useState(new Set([savedTab || 'ct']));
  
  // Get current academic year
  const currentAcademicYear = new Date().getFullYear().toString();
  
  // Detect section for teacher
  const [section, setSection] = useState(null);
  const [sectionLoading, setSectionLoading] = useState(true);

  // Detect teacher's section on mount
  useEffect(() => {
    const detectSection = async () => {
      try {
        const courseResponse = await getCourseById(courseId);
        const user = JSON.parse(localStorage.getItem('user'));
        const currentUserId = user?.userId || user?._id;
        
        let detectedSection = null;
        
        if (courseResponse.data.course_type === 'THEORY' && currentUserId) {
          const assignment = courseResponse.data.assignedTeachers?.find(at => {
            const teacherId = at.teacher?._id || at.teacher;
            return teacherId && teacherId.toString() === currentUserId.toString();
          });
          detectedSection = assignment?.section || null;
        }
        
        setSection(detectedSection);
      } catch (error) {
        console.error('Failed to detect section:', error);
      } finally {
        setSectionLoading(false);
      }
    };
    
    detectSection();
  }, [courseId]);

  // Check Lock Status on Mount/Course Change
  useEffect(() => {
    const fetchLockStatus = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`http://localhost:5000/api/grades/status/${courseId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (response.data.success) {
          setIsLocked(response.data.isLocked);
        }
      } catch (error) {
        console.error('Failed to fetch lock status', error);
      }
    };
    fetchLockStatus();
  }, [courseId, setIsLocked]);

  // Tab definitions
  const tabs = [
    { id: 'ct', label: 'CT Marks', component: CTMarksSheet },
    { id: 'attendance', label: 'Attendance', component: AttendanceSheet },
    { id: 'assignment', label: 'Assignments', component: AssignmentSheet },
    { id: 'grade', label: 'Final Grade', component: GradeSheet },
    { id: 'co', label: 'CO Attainment', component: COAttainmentSheet },
    { id: 'po', label: 'PO Attainment', component: POAttainmentSheet },
  ];

  // Handle tab switching
  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setVisitedTabs(prev => {
      const newSet = new Set(prev);
      newSet.add(tabId);
      return newSet;
    });
    localStorage.setItem(`workbook_tab_${courseId}`, tabId);
  };

  return (
    <div className="workbook-container">
      {/* Visual Lock Indicator */}
      {isLocked && (
        <div className="workbook-lock-banner" style={{
            background: '#fff3cd', 
            color: '#856404', 
            padding: '5px 10px', 
            textAlign: 'center',
            fontSize: '0.9em',
            borderBottom: '1px solid #ffeeba'
        }}>
          🔒 <strong>Read-Only Mode:</strong> Grades are finalized. Contact Admin to unlock.
        </div>
      )}

      {/* Content Area - Render all visited tabs with display toggling */}
      <div className="workbook-content">
        {tabs.map((tab) => {
          const Component = tab.component;
          const isVisited = visitedTabs.has(tab.id);
          const isActive = activeTab === tab.id;

          // Only render if visited at least once
          if (!isVisited) return null;

          return (
            <div 
              key={tab.id} 
              className="workbook-sheet"
              style={{ display: isActive ? 'block' : 'none' }}
            >
              <Component 
                isActive={isActive} 
                readOnly={isLocked} 
                courseId={courseId}
                section={section}
                academicYear={currentAcademicYear}
              />
            </div>
          );
        })}
      </div>

      {/* Excel-like Tab Bar */}
      <div className="workbook-tabs">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`workbook-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => handleTabChange(tab.id)}
            role="button"
            tabIndex={0}
          >
            {tab.label}
          </div>
        ))}
      </div>
    </div>
  );
};

const WorkbookLayout = () => {
  return (
    <WorkbookProvider>
      <WorkbookInternal />
    </WorkbookProvider>
  );
};

export default WorkbookLayout;
