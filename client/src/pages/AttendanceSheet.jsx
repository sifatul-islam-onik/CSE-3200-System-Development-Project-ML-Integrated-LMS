/**
 * AttendanceSheet.jsx
 * 
 * DATA OWNERSHIP:
 * - Owns 'Attendance' data (Read/Write)
 * - Writes to 'Attendance.assignments' (Simple Entry Mode)
 * 
 * BEHAVIOR:
 * - Fetches data ON MOUNT.
 * - Local state handles temporary edits.
 * - Save commits to backend and updates local "original" state to prevent re-fetch.
 */

import React, { useState, useEffect } from 'react';
import { useWorkbook } from '../context/WorkbookContext';
import {
  Box,
  Button,
  CircularProgress,
  Typography,
  Paper,
  Alert,
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
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import ExcelGrid from '../components/ExcelGrid';
import { getCourseAttendance, bulkSaveAttendance } from '../services/attendanceService';
import { getCourseById, getCourseStudents } from '../services/courseService';

const AttendanceSheet = ({ courseId, section, academicYear }) => {
  const { markDirty } = useWorkbook();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [students, setStudents] = useState([]);
  const [attendanceData, setAttendanceData] = useState({});
  const [course, setCourse] = useState(null);
  const [columns, setColumns] = useState([]);
  const [totalMarks, setTotalMarks] = useState(5); // Default attendance marks
  const [error, setError] = useState(null);
  const [editedCells, setEditedCells] = useState({});
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [isFinalized, setIsFinalized] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  console.log('=== AttendanceSheet Debug ===');
  console.log('Props - courseId:', courseId, 'section:', section, 'academicYear:', academicYear);
  console.log('Students count:', students.length);
  console.log('Loading:', loading);
  console.log('=== End AttendanceSheet Debug ===');

  /**
   * Fetch course details and enrolled students
   */
  useEffect(() => {
    if (!courseId) return;

    const fetchCourseData = async () => {
      try {
        setLoading(true);
        setError(null);

        console.log('[AttendanceSheet] Fetching course and students for section:', section);

        // Fetch course details
        const courseResponse = await getCourseById(courseId);
        setCourse(courseResponse.data);

        // Fetch enrolled students using API (same as CTMarksSheet)
        const studentsResponse = await getCourseStudents(courseId, section);
        const enrolledStudents = studentsResponse?.data || [];
        
        console.log('[AttendanceSheet] Students fetched:', enrolledStudents.length);

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
  }, [courseId, section]);

  /**
   * Fetch existing attendance data
   */
  useEffect(() => {
    if (!courseId || students.length === 0) return;

    const fetchAttendance = async () => {
      try {
        const filters = {
          section: section || undefined,
          academicYear: academicYear || new Date().getFullYear().toString(),
        };

        const response = await getCourseAttendance(courseId, filters);

        console.log('[AttendanceSheet] API Response:', response.data);

        // Transform attendance data into a map: studentId -> marksAwarded
        const attendanceMap = {};
        response.data.forEach((record) => {
          const studentId = record.student._id || record.student;
          attendanceMap[studentId] = {
            marksAwarded: record.marksAwarded || 0,
          };
        });

        console.log('[AttendanceSheet] Attendance Map:', attendanceMap);

        setAttendanceData(attendanceMap);
      } catch (err) {
        console.error('Error fetching attendance:', err);
        // Don't show error if attendance doesn't exist yet
        if (err.response?.status !== 404) {
          setError(err.response?.data?.message || 'Failed to fetch attendance');
        }
      }
    };

    fetchAttendance();
  }, [courseId, section, academicYear, students]);

  /**
   * Generate simple columns - just marks
   */
  useEffect(() => {
    const cols = [
      {
        field: 'rollNo',
        headerName: 'Roll No',
        width: 150,
        editable: false,
        pinned: 'left',
      },
      {
        field: 'name',
        headerName: 'Student Name',
        width: 300,
        editable: false,
        pinned: 'left',
      },
      {
        field: 'marksAwarded',
        headerName: `Attendance Marks (Out of ${totalMarks})`,
        type: 'number',
        width: 250,
        editable: !isFinalized,
        renderCell: (params) => {
          const value = params.value;
          if (value === null || value === undefined) {
            return (
              <Box sx={{ color: '#999', fontStyle: 'italic' }}>
                0
              </Box>
            );
          }

          // Color coding based on marks
          let color = '#000';
          const percentage = (value / totalMarks) * 100;
          if (percentage >= 80) color = '#2e7d32'; // Green
          else if (percentage >= 60) color = '#1976d2'; // Blue
          else if (percentage >= 40) color = '#ed6c02'; // Orange
          else color = '#d32f2f'; // Red

          return (
            <Box
              sx={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 600,
                color,
                fontSize: '1rem',
              }}
            >
              {value}
            </Box>
          );
        },
      },
    ];

    setColumns(cols);
  }, [totalMarks, isFinalized]);

  /**
   * Merge students with their attendance marks
   */
  const gridRows = students.map((student) => {
    const studentAttendance = attendanceData[student.studentId] || {};
    
    return {
      ...student,
      marksAwarded: studentAttendance.marksAwarded !== undefined 
        ? studentAttendance.marksAwarded 
        : 0,
    };
  });

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

    // Update local attendance data
    setAttendanceData((prev) => ({
      ...prev,
      [row.studentId]: {
        ...prev[row.studentId],
        marksAwarded: Number(value) || 0,
      },
    }));
  };

  /**
   * Save attendance to backend (upsert logic)
   */
  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      const attendanceToSave = [];

      // Prepare attendance for bulk save with upsert logic
      Object.values(editedCells).forEach((edit) => {
        const { studentId, value } = edit;
        const marksAwarded = value !== null && value !== undefined && value !== '' 
          ? Number(value) 
          : 0;

        attendanceToSave.push({
          student: studentId,
          course: courseId,
          section: section || null,
          academicYear: academicYear || new Date().getFullYear().toString(),
          totalClasses: 100, // Default value (backend requirement)
          attendedClasses: 0, // Not used in marks-only mode
          marksAwarded: marksAwarded,
          totalMarks: totalMarks,
        });
      });

      if (attendanceToSave.length === 0) {
        setSnackbar({
          open: true,
          message: 'No changes to save',
          severity: 'warning',
        });
        return;
      }

      // Call bulk save API (uses upsert logic on backend)
      const response = await bulkSaveAttendance(attendanceToSave);

      // Show success toast
      const savedCount = response.savedCount || attendanceToSave.length;
      const failedCount = response.data?.failed?.length || 0;

      setSnackbar({
        open: true,
        message: `✓ Successfully saved ${savedCount} attendance records${failedCount > 0 ? `, ${failedCount} failed` : ''}!`,
        severity: 'success',
      });

      // Clear edited cells after successful save
      setEditedCells({});
      
      // Mark grades as dirty so GradeSheet recalculates
      markDirty('grades');

      // Refresh attendance data to show updated values
      const filters = {
        section: section || undefined,
        academicYear: academicYear || new Date().getFullYear().toString(),
      };
      const refreshResponse = await getCourseAttendance(courseId, filters);
      const attendanceMap = {};
      refreshResponse.data.forEach((record) => {
        const studentId = record.student._id || record.student;
        attendanceMap[studentId] = {
          attendedClasses: record.attendedClasses || 0,
          percentage: record.percentage || 0,
          marksAwarded: record.marksAwarded || 0,
        };
      });
      setAttendanceData(attendanceMap);

    } catch (err) {
      console.error('Error saving attendance:', err);

      // Show error toast
      const errorMessage = err.response?.data?.message || 'Failed to save attendance. Please try again.';
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
   * Handle finalize toggle
   */
  const handleFinalizeToggle = async () => {
    try {
      setFinalizing(true);

      // Check if there are unsaved changes
      if (Object.keys(editedCells).length > 0) {
        setSnackbar({
          open: true,
          message: 'Please save all changes before finalizing attendance',
          severity: 'warning',
        });
        return;
      }

      const newFinalizedState = !isFinalized;

      // TODO: Call backend API to persist finalize state
      setIsFinalized(newFinalizedState);

      setSnackbar({
        open: true,
        message: newFinalizedState
          ? '🔒 Attendance finalized. Editing is now locked.'
          : '🔓 Attendance unlocked. You can now edit records.',
        severity: newFinalizedState ? 'success' : 'info',
      });

    } catch (err) {
      console.error('Error finalizing attendance:', err);
      setSnackbar({
        open: true,
        message: 'Failed to finalize attendance',
        severity: 'error',
      });
    } finally {
      setFinalizing(false);
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
   * Refresh data
   */
  const handleRefresh = () => {
    window.location.reload();
  };

  /**
   * Validation rules
   */
  const validation = {
    maxMarks: {
      marksAwarded: totalMarks,
    },
    customValidator: (field, value) => {
      if (field === 'marksAwarded' && value > totalMarks) {
        return {
          valid: false,
          message: `Marks cannot exceed ${totalMarks}`,
        };
      }
      return { valid: true };
    },
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box>
              <Typography variant="h4" gutterBottom>
                Attendance Entry
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
            </Box>

            {/* Finalized Status Badge */}
            {isFinalized && (
              <Chip
                icon={<LockIcon />}
                label="Finalized"
                color="error"
                size="small"
                sx={{ fontWeight: 600 }}
              />
            )}
          </Box>

          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <TextField
              label="Total Marks"
              type="number"
              value={totalMarks}
              onChange={(e) => setTotalMarks(Math.max(1, parseInt(e.target.value) || 5))}
              size="small"
              sx={{ width: 130 }}
              inputProps={{ min: 1, max: 100 }}
              disabled={isFinalized}
            />

            {/* Finalize Toggle */}
            <Tooltip title={isFinalized ? "Unlock to enable editing" : "Lock attendance to prevent changes"}>
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
                sx={{ ml: 1 }}
              />
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

        {/* Info Box */}
        <Box
          sx={{
            mb: 2,
            p: 2,
            bgcolor: isFinalized ? '#ffebee' : '#e8f5e9',
            borderRadius: 1,
            border: isFinalized ? '2px solid #d32f2f' : 'none',
          }}
        >
          <Typography variant="body2" color="text.secondary">
            <strong>Students Enrolled:</strong> {students.length} |
            <strong> Edited Cells:</strong> {Object.keys(editedCells).length} |
            <strong> Calculation:</strong> Auto (Percentage = Attended / Total × 100) |
            <strong> Marks:</strong> Auto (Percentage × {totalMarks} / 100)
            {isFinalized && (
              <Chip
                icon={<LockIcon fontSize="small" />}
                label="ATTENDANCE FINALIZED"
                color="error"
                size="small"
                sx={{ ml: 2, fontWeight: 700 }}
              />
            )}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            {isFinalized ? (
              <>
                🔒 <strong>Attendance is locked.</strong> Toggle the switch above to unlock and enable editing.
              </>
            ) : (
              <>
                💡 Percentage and marks are calculated automatically. Only edit "Classes Attended" column.
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
        <Box sx={{ mt: 3, display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
          <Button
            variant="outlined"
            onClick={() => setEditedCells({})}
            disabled={Object.keys(editedCells).length === 0 || saving || isFinalized}
          >
            Clear Changes
          </Button>
          <Button
            variant="contained"
            color="primary"
            size="large"
            startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
            onClick={handleSave}
            disabled={Object.keys(editedCells).length === 0 || saving || isFinalized}
            sx={{
              minWidth: 200,
              fontWeight: 600,
              boxShadow: 2,
              '&:hover': {
                boxShadow: 4,
              },
            }}
          >
            {saving ? 'Saving...' : `Save ${Object.keys(editedCells).length} Changes`}
          </Button>

          {isFinalized && (
            <Tooltip title="Attendance is locked. Toggle the switch to unlock.">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#d32f2f' }}>
                <LockIcon />
                <Typography variant="body2" fontWeight={600}>
                  Editing Locked
                </Typography>
              </Box>
            </Tooltip>
          )}
        </Box>
      </Paper>

      {/* Toast Notification (Snackbar) */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={snackbar.severity}
          variant="filled"
          sx={{
            width: '100%',
            fontSize: '1rem',
            fontWeight: 500,
            boxShadow: 3,
          }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default AttendanceSheet;
