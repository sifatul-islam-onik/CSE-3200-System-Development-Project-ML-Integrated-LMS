/**
 * CTMarksSheet.jsx
 * 
 * DATA OWNERSHIP:
 * - Owns 'CTMarks' data (Read/Write)
 * - Reads 'TermExamMarks' (Read-Only visualization)
 * - Reads 'Attendance' (Read-Only visualization)
 * - Reads 'Assignment' (Read-Only visualization aggregation)
 * 
 * BEHAVIOR:
 * - Fetches course data and marks ON MOUNT (via useEffect).
 * - In WorkbookLayout, this component stays mounted, so fetches only occur once per course load.
 * - Save actions trigger backend update followed by local state refresh.
 */

import React, { useState, useEffect } from 'react';
import { useWorkbook } from '../context/WorkbookContext';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  CircularProgress,
  Typography,
  Paper,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  IconButton,
  Tooltip,
  Snackbar,
  Switch,
  FormControlLabel,
  Chip,
} from '@mui/material';
import { 
  Save as SaveIcon, 
  Refresh as RefreshIcon, 
  Calculate as CalculateIcon,
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
  HelpOutline as HelpIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import ExcelGrid from '../components/ExcelGrid';
import KeyboardShortcutsHelp from '../components/KeyboardShortcutsHelp';
import { getCourseCTMarks, bulkSaveCTMarks } from '../services/ctMarksService';
import { getCourseTermExamMarks } from '../services/termExamMarksService';
import { getCourseAttendance } from '../services/attendanceService';
import { exportCTMarks, exportAllMarks, downloadFile } from '../services/exportService';
import { getCourseById, getCourseStudents } from '../services/courseService';

const CTMarksSheet = ({ isActive, courseId: propCourseId, section: propSection, academicYear: propAcademicYear }) => {
  const { courseId: paramCourseId } = useParams();
  const courseId = propCourseId || paramCourseId; // Use prop if provided, fallback to URL param
  const navigate = useNavigate();
  const { markDirty } = useWorkbook();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [students, setStudents] = useState([]);
  const [ctMarks, setCtMarks] = useState({});
  const [termMarks, setTermMarks] = useState({});
  const [attendanceMarks, setAttendanceMarks] = useState({});
  const [course, setCourse] = useState(null);
  const [columns, setColumns] = useState([]);
  const [numberOfCTs, setNumberOfCTs] = useState(3);
  const [totalMarksPerCT, setTotalMarksPerCT] = useState(20);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [editedCells, setEditedCells] = useState({});
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [isFinalized, setIsFinalized] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [section, setSection] = useState(propSection || null); // Use prop section if provided
  const [academicYear, setAcademicYear] = useState(propAcademicYear || new Date().getFullYear().toString());

  /**
   * Handle export to Excel
   */
  const handleExport = async (exportType = 'ct') => {
    try {
      setExporting(true);
      
      const filters = {
        section: section || undefined,
        academicYear: academicYear || new Date().getFullYear().toString(),
      };

      let blob;
      let filename;

      if (exportType === 'all') {
        blob = await exportAllMarks(courseId, filters);
        filename = `${course?.courseCode || 'Course'}_All_Marks_${section || 'All'}_${filters.academicYear}.xlsx`;
      } else {
        blob = await exportCTMarks(courseId, filters);
        filename = `${course?.courseCode || 'Course'}_CT_Marks_${section || 'All'}_${filters.academicYear}.xlsx`;
      }

      downloadFile(blob, filename);
      
      setSnackbar({
        open: true,
        message: '✓ Successfully exported to Excel!',
        severity: 'success',
      });
    } catch (err) {
      console.error('Error exporting:', err);
      setSnackbar({
        open: true,
        message: `✗ Failed to export: ${err.response?.data?.message || err.message}`,
        severity: 'error',
      });
    } finally {
      setExporting(false);
    }
  };

  /**
   * Fetch course details and enrolled students
   */
  useEffect(() => {
    if (!courseId) return;

    const fetchCourseData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch course details
        const courseResponse = await getCourseById(courseId);
        setCourse(courseResponse.data);

        console.log('=== CTMarksSheet Debug ===');
        console.log('Course:', courseResponse.data.courseCode, courseResponse.data.course_type);
        console.log('Props - section:', propSection, 'academicYear:', propAcademicYear);

        // Use prop section if provided, otherwise detect from assignments
        let detectedSection = propSection || null;
        
        if (!detectedSection && courseResponse.data.course_type === 'THEORY') {
          const user = JSON.parse(localStorage.getItem('user'));
          const currentUserId = user?.userId || user?._id;
          console.log('Current User ID:', currentUserId);
          console.log('Assigned Teachers:', courseResponse.data.assignedTeachers);
          
          const assignment = courseResponse.data.assignedTeachers?.find(at => {
            const teacherId = at.teacher?._id || at.teacher;
            const matches = teacherId && teacherId.toString() === currentUserId.toString();
            console.log(`Checking teacher ${teacherId} vs ${currentUserId}: ${matches}, section: ${at.section}`);
            return matches;
          });
          detectedSection = assignment?.section || null;
          console.log('Detected Section:', detectedSection);
        }
        
        setSection(detectedSection);

        // Fetch enrolled students using API
        console.log('Fetching students for section:', detectedSection);
        const studentsResponse = await getCourseStudents(courseId, detectedSection);
        console.log('Students API response:', studentsResponse);
        const enrolledStudents = studentsResponse?.data || [];
        console.log('Enrolled students count:', enrolledStudents.length);
        console.log('=== End Debug ===');

        // Transform students to grid format
        const studentRows = enrolledStudents.map((student, index) => ({
          id: student._id,
          rollNo: student.rollNo || `STU${index + 1}`,
          name: student.name || 'Unknown Student',
          email: student.email || '',
          studentId: student._id,
        }));

        setStudents(studentRows);
      } catch (err) {
        console.error('Error fetching course data:', err);
        setError(err.response?.data?.message || 'Failed to fetch course data');
      } finally {
        setLoading(false);
      }
    };

    fetchCourseData();
  }, [courseId, propSection]); // Re-fetch if courseId or section prop changes

  /**
   * Fetch existing CT marks, Term marks, and Attendance
   */
  useEffect(() => {
    if (!courseId || students.length === 0) return;

    const fetchAllMarks = async () => {
      try {
        const filters = {
          section: section || undefined,
          academicYear: academicYear || new Date().getFullYear().toString(),
        };

        // Fetch all marks in parallel
        const [ctResponse, termResponse, attendanceResponse] = await Promise.all([
          getCourseCTMarks(courseId, filters).catch(err => ({ data: [] })),
          getCourseTermExamMarks(courseId, filters).catch(err => ({ data: [] })),
          getCourseAttendance(courseId, filters).catch(err => ({ data: [] }))
        ]);
        
        console.log('=== Marks Fetch Results ===');
        console.log('CT Marks:', ctResponse.data?.length || 0, 'records');
        console.log('Term Marks:', termResponse.data?.length || 0, 'records', termResponse.data);
        console.log('Attendance:', attendanceResponse.data?.length || 0, 'records');
        
        // Transform CT marks into a map: studentId -> { ct1: marks, ct2: marks, ... }
        const ctMarksMap = {};
        ctResponse.data.forEach((mark) => {
          const studentId = mark.student._id || mark.student;
          if (!ctMarksMap[studentId]) {
            ctMarksMap[studentId] = {};
          }
          ctMarksMap[studentId][`ct${mark.ctNumber}`] = mark.marksObtained;
        });

        // Transform Term marks into a map: studentId -> { term: marks }
        const termMarksMap = {};
        const termData = termResponse?.data; // Access data property from API response
        
        if (Array.isArray(termData)) {
          console.log(`[CTMarksSheet] Processing ${termData.length} term exam records`);
          
          termData.forEach((mark) => {
            if (!mark) return;
            
            const studentId = mark.student?._id || mark.student;
            if (studentId) {
              termMarksMap[studentId] = {
                term: mark.marksObtained,
                totalMarks: mark.totalMarks
              };
            } else {
              console.warn('[CTMarksSheet] Skipping term mark - Missing student ID:', mark);
            }
          });
        } else {
          console.warn('[CTMarksSheet] Unexpected term exam response format:', termResponse);
        }

        // Transform Attendance into a map: studentId -> { attendance: marks, assignments: [...] }
        const attendanceMarksMap = {};
        attendanceResponse.data.forEach((record) => {
          const studentId = record.student._id || record.student;
          attendanceMarksMap[studentId] = {
            attendance: record.marksAwarded,
            attendanceTotal: record.totalMarks,
            assignments: record.assignments || []
          };
        });

        console.log('Term marks map:', termMarksMap);
        console.log('=== End Marks Fetch ===');

        setCtMarks(ctMarksMap);
        setTermMarks(termMarksMap);
        setAttendanceMarks(attendanceMarksMap);
      } catch (err) {
        console.error('Error fetching marks:', err);
        if (err.response?.status !== 404) {
          setError(err.response?.data?.message || 'Failed to fetch marks');
        }
      }
    };

    fetchAllMarks();
  }, [courseId, section, academicYear, students]);

  /**
   * Calculate best N-1 CTs (drops lowest) with detailed info
   */
  const calculateBestCTs = (student) => {
    const ctValues = [];
    const ctData = [];
    
    for (let i = 1; i <= numberOfCTs; i++) {
      const ctField = `ct${i}`;
      const value = student[ctField];
      if (value !== null && value !== undefined && value !== '') {
        const numValue = Number(value);
        ctValues.push(numValue);
        ctData.push({ field: ctField, value: numValue, ctNumber: i });
      }
    }

    if (ctValues.length === 0) {
      return { 
        total: 0, 
        best: 0, 
        dropped: null, 
        droppedField: null,
        allCTs: ctData,
        percentage: 0 
      };
    }

    const total = ctValues.reduce((sum, val) => sum + val, 0);
    
    // Find the lowest CT value and its details
    let minValue = Math.min(...ctValues);
    let droppedCT = ctData.find(ct => ct.value === minValue);
    
    // Calculate best N-1 (total minus lowest)
    const best = numberOfCTs > 1 ? total - minValue : total;
    const maxPossible = numberOfCTs > 1 
      ? totalMarksPerCT * (numberOfCTs - 1) 
      : totalMarksPerCT * numberOfCTs;
    const percentage = (best / maxPossible) * 100;

    return {
      total,
      best,
      dropped: minValue,
      droppedField: droppedCT?.field || null,
      droppedCTNumber: droppedCT?.ctNumber || null,
      allCTs: ctData,
      percentage: Math.min(percentage, 100)
    };
  };

  /**
   * Build dynamic columns based on numberOfCTs
   */
  useEffect(() => {
    const cols = [
      {
        field: 'rollNo',
        headerName: 'Roll No',
        width: 120,
        editable: false,
        pinned: 'left',
      },
      {
        field: 'name',
        headerName: 'Student Name',
        width: 200,
        editable: false,
        pinned: 'left',
      },
    ];

    // Add CT columns dynamically with dropped CT highlighting
    for (let i = 1; i <= numberOfCTs; i++) {
      cols.push({
        field: `ct${i}`,
        headerName: `CT ${i} (${totalMarksPerCT})`,
        type: 'number',
        width: 120,
        editable: !isFinalized, // Disable editing when finalized
        renderCell: (params) => {
          const ctValue = params.value;
          const { droppedField, droppedCTNumber } = calculateBestCTs(params.row);
          
          // Check if this CT is the dropped one
          const isDropped = droppedField === `ct${i}`;
          
          if (ctValue === null || ctValue === undefined || ctValue === '') {
            return (
              <Box sx={{ color: '#999', fontStyle: 'italic' }}>
                -
              </Box>
            );
          }

          return (
            <Box
              sx={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 500,
                color: isDropped ? '#d32f2f' : '#000',
                backgroundColor: isDropped ? '#ffebee' : 'transparent',
                textDecoration: isDropped ? 'line-through' : 'none',
                position: 'relative',
              }}
            >
              {ctValue}
              {isDropped && (
                <Tooltip title="Lowest CT - Dropped from calculation" arrow>
                  <Box
                    component="span"
                    sx={{
                      ml: 0.5,
                      fontSize: '0.75rem',
                      color: '#d32f2f',
                      fontWeight: 700,
                    }}
                  >
                    ✗
                  </Box>
                </Tooltip>
              )}
            </Box>
          );
        },
      });
    }

    // Add calculated columns (auto-update on cell edit)
    cols.push({
      field: 'total',
      headerName: 'Total',
      type: 'number',
      width: 100,
      editable: false,
      renderCell: (params) => {
        const { total } = calculateBestCTs(params.row);
        return (
          <Tooltip title={`Sum of all ${numberOfCTs} CTs`} arrow>
            <Box sx={{ fontWeight: 600, color: '#1976d2' }}>
              {total.toFixed(1)}
            </Box>
          </Tooltip>
        );
      },
    });

    cols.push({
      field: 'best',
      headerName: `Best ${Math.max(numberOfCTs - 1, 1)}`,
      type: 'number',
      width: 120,
      editable: false,
      renderCell: (params) => {
        const { best, dropped, droppedCTNumber } = calculateBestCTs(params.row);
        return (
          <Tooltip 
            title={dropped !== null 
              ? `Dropped CT ${droppedCTNumber}: ${dropped} marks` 
              : 'No CTs dropped'
            } 
            arrow
          >
            <Box 
              sx={{ 
                fontWeight: 700, 
                color: '#2e7d32',
                fontSize: '1rem',
              }}
            >
              {best.toFixed(1)}
            </Box>
          </Tooltip>
        );
      },
    });

    cols.push({
      field: 'percentage',
      headerName: 'CT %',
      type: 'number',
      width: 100,
      editable: false,
      renderCell: (params) => {
        const { percentage } = calculateBestCTs(params.row);
        
        // Color coding based on percentage
        let color = '#000';
        if (percentage >= 80) color = '#2e7d32'; // Green
        else if (percentage >= 60) color = '#1976d2'; // Blue
        else if (percentage >= 40) color = '#ed6c02'; // Orange
        else color = '#d32f2f'; // Red
        
        return (
          <Tooltip 
            title={`Based on Best ${Math.max(numberOfCTs - 1, 1)} CTs`} 
            arrow
          >
            <Box sx={{ fontWeight: 600, color }}>
              {percentage.toFixed(2)}%
            </Box>
          </Tooltip>
        );
      },
    });

    // Add Term Marks column
    cols.push({
      field: 'term',
      headerName: 'Term Exam',
      type: 'number',
      width: 120,
      editable: false,
      renderCell: (params) => {
        const termData = termMarks[params.row.studentId];
        if (!termData || termData.term === null || termData.term === undefined) {
          return <Box sx={{ color: '#999', fontStyle: 'italic' }}>-</Box>;
        }
        return (
          <Tooltip title={`Out of ${termData.totalMarks || 40}`} arrow>
            <Box sx={{ fontWeight: 500 }}>
              {termData.term}
            </Box>
          </Tooltip>
        );
      },
    });

    // Add Attendance column
    cols.push({
      field: 'attendance',
      headerName: 'Attendance',
      type: 'number',
      width: 120,
      editable: false,
      renderCell: (params) => {
        const attData = attendanceMarks[params.row.studentId];
        if (!attData || attData.attendance === null || attData.attendance === undefined) {
          return <Box sx={{ color: '#999', fontStyle: 'italic' }}>-</Box>;
        }
        return (
          <Tooltip title={`Out of ${attData.attendanceTotal || 5}`} arrow>
            <Box sx={{ fontWeight: 500 }}>
              {attData.attendance}
            </Box>
          </Tooltip>
        );
      },
    });

    // Add Assignment columns dynamically (assume max 5 assignments)
    const maxAssignments = Math.max(
      ...Object.values(attendanceMarks).map(a => a.assignments?.length || 0),
      3 // Default to at least 3
    );

    for (let i = 0; i < maxAssignments; i++) {
      cols.push({
        field: `assignment${i + 1}`,
        headerName: `Assign ${i + 1}`,
        type: 'number',
        width: 100,
        editable: false,
        renderCell: (params) => {
          const attData = attendanceMarks[params.row.studentId];
          const assignment = attData?.assignments?.[i];
          if (!assignment || assignment.marksObtained === null || assignment.marksObtained === undefined) {
            return <Box sx={{ color: '#999', fontStyle: 'italic' }}>-</Box>;
          }
          return (
            <Tooltip title={`Out of ${assignment.totalMarks || 10}`} arrow>
              <Box sx={{ fontWeight: 500 }}>
                {assignment.marksObtained}
              </Box>
            </Tooltip>
          );
        },
      });
    }

    // Add Total column (sum of all marks)
    cols.push({
      field: 'totalMarks',
      headerName: 'Total',
      type: 'number',
      width: 100,
      editable: false,
      renderCell: (params) => {
        const { best } = calculateBestCTs(params.row);
        const termData = termMarks[params.row.studentId];
        const attData = attendanceMarks[params.row.studentId];
        
        const termMark = termData?.term || 0;
        const attMark = attData?.attendance || 0;
        const assignmentTotal = attData?.assignments?.reduce((sum, a) => sum + (a.marksObtained || 0), 0) || 0;
        
        const total = best + termMark + attMark + assignmentTotal;
        
        return (
          <Tooltip title="Sum of Best CTs + Term + Attendance + Assignments" arrow>
            <Box sx={{ fontWeight: 700, color: '#1976d2', fontSize: '1rem' }}>
              {total.toFixed(1)}
            </Box>
          </Tooltip>
        );
      },
    });

    console.log('=== Columns Generated ===');
    console.log('Total columns:', cols.length);
    console.log('Column fields:', cols.map(c => c.field));
    console.log('=== End Columns ===');

    setColumns(cols);
  }, [numberOfCTs, totalMarksPerCT, isFinalized, termMarks, attendanceMarks]); // Re-generate columns when marks data changes

  /**
   * Merge students with their CT marks
   */
  const gridRows = students.map((student) => {
    const studentMarks = ctMarks[student.studentId] || {};
    const row = { ...student };
    
    // Add CT marks to row
    for (let i = 1; i <= numberOfCTs; i++) {
      row[`ct${i}`] = studentMarks[`ct${i}`] !== undefined ? studentMarks[`ct${i}`] : null;
    }

    return row;
  });

  console.log('=== CTMarksSheet Render ===');
  console.log('Loading:', loading);
  console.log('Students:', students.length);
  console.log('Columns:', columns.length);
  console.log('Grid Rows:', gridRows.length);
  console.log('=== End Render ===');

  /**
   * Handle cell edit
   */
  const handleCellEdit = ({ field, value, row }) => {
    // Track edited cells
    const cellKey = `${row.studentId}_${field}`;
    setEditedCells((prev) => ({
      ...prev,
      [cellKey]: { studentId: row.studentId, field, value },
    }));

    // Update local CT marks state
    setCtMarks((prev) => ({
      ...prev,
      [row.studentId]: {
        ...prev[row.studentId],
        [field]: value,
      },
    }));
  };

  /** (upsert logic)
   */
  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccessMessage(null);

      // Group edited marks by CT number
      const marksByCT = {};

      Object.values(editedCells).forEach((edit) => {
        const { studentId, field, value } = edit;
        const ctNumber = parseInt(field.replace('ct', ''));

        if (!marksByCT[ctNumber]) {
          marksByCT[ctNumber] = [];
        }

        marksByCT[ctNumber].push({
          studentId,
          marksObtained: value !== null && value !== undefined && value !== '' ? Number(value) : 0,
        });
      });

      if (Object.keys(marksByCT).length === 0) {
        setSnackbar({
          open: true,
          message: 'No changes to save',
          severity: 'warning',
        });
        return;
      }

      // Send separate requests for each CT number
      let totalSaved = 0;
      let totalFailed = 0;

      for (const [ctNumber, studentsMarks] of Object.entries(marksByCT)) {
        const payload = {
          courseId,
          section: section || null,
          academicYear: academicYear || new Date().getFullYear().toString(),
          ctNumber: parseInt(ctNumber),
          totalMarks: totalMarksPerCT,
          studentsMarks,
        };

        const response = await bulkSaveCTMarks(payload);
        totalSaved += response.data?.successful?.length || 0;
        totalFailed += response.data?.failed?.length || 0;
      }
      
      setSnackbar({
        open: true,
        message: `✓ Successfully saved ${totalSaved} CT marks${totalFailed > 0 ? `, ${totalFailed} failed` : ''}!`,
        severity: 'success',
      });

      // Clear edited cells after successful save
      setEditedCells({});
      
      // Mark grades as dirty so GradeSheet recalculates
      markDirty('grades');

      // Refresh CT marks data to show updated values
      const filters = {
        section: section || undefined,
        academicYear: academicYear || new Date().getFullYear().toString(),
      };
      const refreshResponse = await getCourseCTMarks(courseId, filters);
      const marksMap = {};
      refreshResponse.data.forEach((mark) => {
        const studentId = mark.student._id || mark.student;
        if (!marksMap[studentId]) {
          marksMap[studentId] = {};
        }
        marksMap[studentId][`ct${mark.ctNumber}`] = mark.marksObtained;
      });
      setCtMarks(marksMap);

    } catch (err) {
      console.error('Error saving CT marks:', err);
      
      // Show error toast
      const errorMessage = err.response?.data?.message || 'Failed to save CT marks. Please try again.';
      setSnackbar({
        open: true,
        message: `✗ ${errorMessage}`,
        severity: 'error',
      });
      
      // Also set error state for display at top
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  /**
   * Close snackbar
   */
  const handleCloseSnackbar = (event, reason) => {
    if (reason === 'clickaway') {
      return;
    }
    setSnackbar({ ...snackbar, open: false });
  };

  /**
   * Handle finalize toggle
   */
  const handleFinalizeToggle = async () => {
    if (Object.keys(editedCells).length > 0) {
      setError('Please save or discard unsaved changes before finalizing.');
      return;
    }

    setFinalizing(true);
    try {
      // TODO: Call backend API to persist finalize state
      // await finalizeCTMarks(courseId, { section, academicYear, isFinalized: !isFinalized });
      
      setIsFinalized(!isFinalized);
      setSnackbar({
        open: true,
        message: !isFinalized ? '🔒 CT marks have been locked' : '🔓 CT marks have been unlocked',
        severity: 'info',
      });
    } catch (err) {
      console.error('Error toggling finalize:', err);
      setError(err.response?.data?.message || 'Failed to toggle finalize state');
    } finally {
      setFinalizing(false);
    }
  };

  /**
   * Refresh data
   */
  const handleRefresh = () => {
    window.location.reload();
  };

  /**
   * Validation rules
   */
  const validation = {
    maxMarks: {},
  };

  // Set max marks for each CT
  for (let i = 1; i <= numberOfCTs; i++) {
    validation.maxMarks[`ct${i}`] = totalMarksPerCT;
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Back Button */}
      <Button
        onClick={() => navigate('/teacher/marks')}
        sx={{ mb: 2 }}
        variant="outlined"
      >
        ← Back to Courses
      </Button>
      
      <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" gutterBottom>
              Complete Marks Sheet
            </Typography>
            {course && (
              <Typography variant="subtitle1" color="text.secondary">
                {course.courseCode} - {course.courseTitle}
                {section && ` (Section ${section})`}
              </Typography>
            )}
            <Typography variant="body2" color="text.secondary">
              Academic Year: {academicYear || new Date().getFullYear()}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              Showing: CT Marks, Term Exam, Attendance & Assignments
            </Typography>
          </Box>

          {/* Right Side Controls */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {/* Finalized Status Badge */}
            {isFinalized && (
              <Chip
                icon={<LockIcon />}
                label="MARKS FINALIZED"
                color="error"
                size="small"
                sx={{ fontWeight: 700 }}
              />
            )}
            
            {/* Finalize Toggle */}
            <Tooltip title={isFinalized ? "Unlock to enable editing" : "Lock marks to prevent changes"}>
              <FormControlLabel
                control={
                  <Switch
                    checked={isFinalized}
                    onChange={handleFinalizeToggle}
                    disabled={finalizing}
                    color="error"
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {isFinalized ? <LockIcon fontSize="small" /> : <LockOpenIcon fontSize="small" />}
                    <Typography variant="body2" fontWeight={600}>
                      {isFinalized ? 'Locked' : 'Unlocked'}
                    </Typography>
                  </Box>
                }
              />
            </Tooltip>

            <TextField
              label="Number of CTs"
              type="number"
              value={numberOfCTs}
              onChange={(e) => setNumberOfCTs(Math.max(1, parseInt(e.target.value) || 1))}
              size="small"
              sx={{ width: 120 }}
              inputProps={{ min: 1, max: 10 }}
              disabled={isFinalized}
            />
            <TextField
              label="Marks per CT"
              type="number"
              value={totalMarksPerCT}
              onChange={(e) => setTotalMarksPerCT(Math.max(1, parseInt(e.target.value) || 20))}
              size="small"
              sx={{ width: 120 }}
              inputProps={{ min: 1, max: 100 }}
              disabled={isFinalized}
            />
            <Tooltip title="Keyboard Shortcuts">
              <IconButton onClick={() => setShowKeyboardHelp(true)} color="primary">
                <HelpIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Refresh">
              <IconButton onClick={handleRefresh} color="primary">
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Alert Messages */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        {successMessage && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMessage(null)}>
            {successMessage}
          </Alert>
        )}

        {/* Info Box */}
        <Box 
          sx={{ 
            mb: 2, 
            p: 2, 
            bgcolor: isFinalized ? '#ffebee' : '#e3f2fd', 
            borderRadius: 1,
            border: isFinalized ? '2px solid #d32f2f' : 'none',
          }}
        >
          <Typography variant="body2" color="text.secondary">
            <strong>Students Enrolled:</strong> {students.length} | 
            <strong> Edited Cells:</strong> {Object.keys(editedCells).length} |
            <strong> Grading Policy:</strong> Best {Math.max(numberOfCTs - 1, 1)} out of {numberOfCTs} CTs 
            {numberOfCTs > 1 && ' (Drops lowest)'} |
            <strong> Calculation:</strong> Real-time (client-side)
            {isFinalized && (
              <Chip
                icon={<LockIcon fontSize="small" />}
                label="MARKS FINALIZED"
                color="error"
                size="small"
                sx={{ ml: 2, fontWeight: 700 }}
              />
            )}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            {isFinalized ? (
              <>
                🔒 <strong>CT marks are locked.</strong> Toggle the switch above to unlock and enable editing.
              </>
            ) : (
              <>
                💡 Dropped CT is highlighted in red with strikethrough. Changes are saved to backend on "Save".
              </>
            )}
          </Typography>
        </Box>

        {/* Data Grid */}
        {students.length === 0 ? (
          <Alert severity="info">
            No students enrolled in this course
            {section ? ` (Section ${section})` : ''}.
          </Alert>
        ) : (
          <ExcelGrid
            rows={gridRows}
            columns={columns}
            onCellEditCommit={handleCellEdit}
            validation={validation}
            height="500px"
            enableValidation={true}
            hasUnsavedChanges={Object.keys(editedCells).length > 0}
            isSaving={saving}
          />
        )}

        {/* Action Buttons */}
        <Box sx={{ mt: 3, display: 'flex', gap: 2, justifyContent: 'space-between' }}>
          {/* Export Buttons */}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Export CT Marks to Excel">
              <Button
                variant="outlined"
                color="success"
                startIcon={exporting ? <CircularProgress size={20} /> : <DownloadIcon />}
                onClick={() => handleExport('ct')}
                disabled={exporting || students.length === 0}
                size="small"
              >
                Export CT
              </Button>
            </Tooltip>
            <Tooltip title="Export All Marks (CT, Attendance, Assignment, Grades)">
              <Button
                variant="outlined"
                color="info"
                startIcon={exporting ? <CircularProgress size={20} /> : <DownloadIcon />}
                onClick={() => handleExport('all')}
                disabled={exporting || students.length === 0}
                size="small"
              >
                Export All
              </Button>
            </Tooltip>
          </Box>

          {/* Save Buttons */}
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              onClick={() => setEditedCells({})}
              disabled={Object.keys(editedCells).length === 0 || saving}
            >
              Clear Changes
            </Button>
            <Button
              variant="contained"
              startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
              onClick={handleSave}
              disabled={Object.keys(editedCells).length === 0 || saving}
            >
              {saving ? 'Saving...' : `Save ${Object.keys(editedCells).length} Changes`}
            </Button>
          </Box>
        </Box>
      </Paper>

      {/* Toast Notification */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={handleCloseSnackbar} 
          severity={snackbar.severity} 
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* Keyboard Shortcuts Help Dialog */}
      <KeyboardShortcutsHelp 
        open={showKeyboardHelp} 
        onClose={() => setShowKeyboardHelp(false)} 
      />
    </Box>
  );
};

export default CTMarksSheet;
