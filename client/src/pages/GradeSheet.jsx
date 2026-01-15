/**
 * GradeSheet.jsx
 * 
 * DATA OWNERSHIP:
 * - Owns 'FinalGrade' data (Read/Write)
 * - Triggers calculation engine in backend.
 * 
 * BEHAVIOR:
 * - Fetches grades ON MOUNT.
 * - 'Calculate Grades' triggers backend process + refetch.
 * - 'Finalize' updates lock state.
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
  Chip,
  Tooltip,
  IconButton,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Calculate as CalculateIcon,
  Lock as LockIcon,
  CheckCircle as CheckCircleIcon,
  Grade as GradeIcon,
} from '@mui/icons-material';
import { DataGrid } from '@mui/x-data-grid';
import { getCourseGrades, calculateCourseGrades, finalizeGrades } from '../services/gradeService';
import { getCourseById } from '../services/courseService';

const GradeSheet = ({ courseId, section, academicYear, isActive }) => {
  const { dirtyStates, markClean } = useWorkbook();
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [grades, setGrades] = useState([]);
  const [course, setCourse] = useState(null);
  const [error, setError] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [confirmDialog, setConfirmDialog] = useState({ open: false });
  const [allFinalized, setAllFinalized] = useState(false);

  /**
   * Fetch course details
   */
  useEffect(() => {
    if (!courseId) return;

    const fetchCourse = async () => {
      try {
        const response = await getCourseById(courseId);
        setCourse(response.data);
      } catch (err) {
        console.error('Error fetching course:', err);
        setError(err.response?.data?.message || 'Failed to fetch course data');
      }
    };

    fetchCourse();
  }, [courseId]);

  /**
   * Auto-recalculation Trigger
   */
  useEffect(() => {
    // Only trigger if active and dirty flag is set
    if (isActive && dirtyStates.grades) {
      console.log('Detected stale grades. Triggering auto-recalculation...');
      handleCalculateGrades(true); // true = silent mode (optional, implementation dependent)
      markClean('grades');
    }
  }, [isActive, dirtyStates.grades]);

  /**
   * Fetch grades
   */
  useEffect(() => {
    if (!courseId) return;

    // Initial fetch
    fetchGrades();
  }, [courseId, section, academicYear]);

  const fetchGrades = async () => {
    try {
      setLoading(true);
      setError(null);

      const filters = {
        section: section || undefined,
        academicYear: academicYear || new Date().getFullYear().toString(),
      };

      const response = await getCourseGrades(courseId, filters);
      setGrades(response.data || []);
      
      // Check if all grades are finalized
      const allFinalizedStatus = response.data?.length > 0 && 
        response.data.every(grade => grade.isFinalized);
      setAllFinalized(allFinalizedStatus);
    } catch (err) {
      console.error('Error fetching grades:', err);
      // Don't show error if grades don't exist yet
      if (err.response?.status !== 404) {
        setError(err.response?.data?.message || 'Failed to fetch grades');
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * Calculate grades for all students
   * @param {boolean} silent - If true, minimal UI feedback
   */
  const handleCalculateGrades = async (silent = false) => {
    try {
      setCalculating(true);
      setError(null);

      const data = {
        section: section || null,
        academicYear: academicYear || new Date().getFullYear().toString(),
        coursePolicy: {
          ctWeightage: 40,
          attendanceWeightage: 10,
          assignmentWeightage: 10,
          termExamWeightage: 40,
        },
      };

      const response = await calculateCourseGrades(courseId, data);

      if (!silent) {
        setSnackbar({
          open: true,
          message: `✓ Successfully calculated grades for ${response.successCount || 0} students!`,
          severity: 'success',
        });
      } else {
        setSnackbar({
          open: true,
          message: `✓ Grades auto-updated successfully`,
          severity: 'info',
        });
      }

      // Refresh grades
      await fetchGrades();
    } catch (err) {
      console.error('Error calculating grades:', err);
      setSnackbar({
        open: true,
        message: `✗ ${err.response?.data?.message || 'Failed to calculate grades'}`,
        severity: 'error',
      });
      setError(err.response?.data?.message || 'Failed to calculate grades');
    } finally {
      setCalculating(false);
    }
  };

  /**
   * Open finalize confirmation dialog
   */
  const handleOpenFinalizeDialog = () => {
    if (grades.length === 0) {
      setSnackbar({
        open: true,
        message: 'No grades to finalize. Calculate grades first.',
        severity: 'warning',
      });
      return;
    }
    setConfirmDialog({ open: true });
  };

  /**
   * Close finalize confirmation dialog
   */
  const handleCloseFinalizeDialog = () => {
    setConfirmDialog({ open: false });
  };

  /**
   * Finalize all grades for the course
   */
  const handleFinalizeGrades = async () => {
    try {
      setFinalizing(true);
      setError(null);
      handleCloseFinalizeDialog();

      const data = {
        section: section || null,
        academicYear: academicYear || new Date().getFullYear().toString(),
      };

      const response = await finalizeGrades(courseId, data);

      setSnackbar({
        open: true,
        message: `✓ Successfully finalized grades for ${response.finalizedCount || 0} students! All related sheets are now locked.`,
        severity: 'success',
      });

      // Refresh grades to update finalized status
      await fetchGrades();
    } catch (err) {
      console.error('Error finalizing grades:', err);
      setSnackbar({
        open: true,
        message: `✗ ${err.response?.data?.message || 'Failed to finalize grades'}`,
        severity: 'error',
      });
      setError(err.response?.data?.message || 'Failed to finalize grades');
    } finally {
      setFinalizing(false);
    }
  };

  /**
   * Get color for grade (Excel conditional formatting style)
   */
  const getGradeColor = (letterGrade) => {
    const colorMap = {
      'A+': { bg: '#c8e6c9', text: '#1b5e20' },  // Light green
      'A': { bg: '#a5d6a7', text: '#2e7d32' },
      'A-': { bg: '#81c784', text: '#388e3c' },
      'B+': { bg: '#bbdefb', text: '#0d47a1' },  // Light blue
      'B': { bg: '#90caf9', text: '#1565c0' },
      'B-': { bg: '#64b5f6', text: '#1976d2' },
      'C+': { bg: '#fff9c4', text: '#f57f17' },  // Light yellow
      'C': { bg: '#fff59d', text: '#f9a825' },
      'C-': { bg: '#fff176', text: '#fbc02d' },
      'D': { bg: '#ffccbc', text: '#d84315' },   // Light orange
      'F': { bg: '#ffcdd2', text: '#c62828' },   // Light red
    };
    return colorMap[letterGrade] || { bg: '#e0e0e0', text: '#000' };
  };

  /**
   * Get color for percentage
   */
  const getPercentageColor = (percentage) => {
    if (percentage >= 90) return { bg: '#c8e6c9', text: '#1b5e20' };
    if (percentage >= 80) return { bg: '#a5d6a7', text: '#2e7d32' };
    if (percentage >= 70) return { bg: '#bbdefb', text: '#0d47a1' };
    if (percentage >= 60) return { bg: '#fff9c4', text: '#f57f17' };
    if (percentage >= 50) return { bg: '#ffccbc', text: '#d84315' };
    return { bg: '#ffcdd2', text: '#c62828' };
  };

  /**
   * DataGrid columns
   */
  const columns = [
    {
      field: 'rollNo',
      headerName: 'Roll No',
      width: 120,
      valueGetter: (params) => params?.row?.student?.rollNo || params?.row?.student?.roll || 'N/A',
    },
    {
      field: 'name',
      headerName: 'Student Name',
      width: 200,
      valueGetter: (params) => params?.row?.student?.name || 'Unknown',
    },
    {
      field: 'ctMarks',
      headerName: 'CT Marks',
      width: 130,
      renderCell: (params) => {
        if (!params?.row) return <Box sx={{ color: '#999', fontStyle: 'italic' }}>-</Box>;
        const ct = params.row.breakdown?.ctWeightedMarks;
        if (ct === null || ct === undefined) {
          return <Box sx={{ color: '#999', fontStyle: 'italic' }}>-</Box>;
        }
        const policy = 40; // Default CT weightage
        const percentage = (ct / policy) * 100;
        const color = percentage >= 80 ? '#2e7d32' : percentage >= 60 ? '#1976d2' : '#d32f2f';
        return (
          <Tooltip title={`${ct.toFixed(2)} / ${policy} (Best CTs: ${params.row.breakdown?.bestCTsTotal?.toFixed(2) || 0})`}>
            <Box sx={{ fontWeight: 500, color }}>
              {ct.toFixed(2)}
            </Box>
          </Tooltip>
        );
      },
    },
    {
      field: 'attendance',
      headerName: 'Attendance',
      width: 130,
      renderCell: (params) => {
        if (!params?.row) return <Box sx={{ color: '#999', fontStyle: 'italic' }}>-</Box>;
        const attendance = params.row.breakdown?.attendance;
        if (!attendance) {
          return <Box sx={{ color: '#999', fontStyle: 'italic' }}>-</Box>;
        }
        const percentage = attendance.percentage || 0;
        const color = percentage >= 90 ? '#2e7d32' : percentage >= 75 ? '#1976d2' : '#d32f2f';
        return (
          <Tooltip title={`${attendance.attended || 0} / ${attendance.classes || 0} classes (${percentage.toFixed(1)}%)`}>
            <Box sx={{ fontWeight: 500, color }}>
              {attendance.marks?.toFixed(2) || 0}
            </Box>
          </Tooltip>
        );
      },
    },
    {
      field: 'assignments',
      headerName: 'Assignments',
      width: 130,
      renderCell: (params) => {
        if (!params?.row) return <Box sx={{ color: '#999', fontStyle: 'italic' }}>-</Box>;
        const total = params.row.breakdown?.assignmentTotal;
        if (total === null || total === undefined) {
          return <Box sx={{ color: '#999', fontStyle: 'italic' }}>-</Box>;
        }
        const policy = 10; // Default assignment weightage
        const percentage = (total / policy) * 100;
        const color = percentage >= 80 ? '#2e7d32' : percentage >= 60 ? '#1976d2' : '#d32f2f';
        return (
          <Tooltip title={`${params.row.breakdown?.assignments?.length || 0} assignment(s)`}>
            <Box sx={{ fontWeight: 500, color }}>
              {total.toFixed(2)}
            </Box>
          </Tooltip>
        );
      },
    },
    {
      field: 'termExam',
      headerName: 'Term Exam',
      width: 130,
      renderCell: (params) => {
        if (!params?.row) return <Box sx={{ color: '#999', fontStyle: 'italic' }}>-</Box>;
        const termExam = params.row.breakdown?.termExam?.weightedMarks;
        if (termExam === null || termExam === undefined) {
          return <Box sx={{ color: '#999', fontStyle: 'italic' }}>-</Box>;
        }
        const policy = 40; // Default term exam weightage
        const percentage = (termExam / policy) * 100;
        const color = percentage >= 80 ? '#2e7d32' : percentage >= 60 ? '#1976d2' : '#d32f2f';
        return (
          <Tooltip title={`${params.row.breakdown?.termExam?.marks || 0} / ${params.row.breakdown?.termExam?.totalMarks || 0}`}>
            <Box sx={{ fontWeight: 500, color }}>
              {termExam.toFixed(2)}
            </Box>
          </Tooltip>
        );
      },
    },
    {
      field: 'totalMarks',
      headerName: 'Total',
      width: 120,
      renderCell: (params) => {
        if (!params?.row) return <Box sx={{ color: '#999', fontStyle: 'italic' }}>-</Box>;
        const total = params.row.totalMarks;
        if (total === null || total === undefined) {
          return <Box sx={{ color: '#999', fontStyle: 'italic' }}>-</Box>;
        }
        return (
          <Box sx={{ fontWeight: 700, color: '#1976d2', fontSize: '1rem' }}>
            {total.toFixed(2)}
          </Box>
        );
      },
    },
    {
      field: 'percentage',
      headerName: 'Percentage',
      width: 130,
      renderCell: (params) => {
        if (!params?.row) return <Box sx={{ color: '#999', fontStyle: 'italic' }}>-</Box>;
        const percentage = params.row.percentage;
        if (percentage === null || percentage === undefined) {
          return <Box sx={{ color: '#999', fontStyle: 'italic' }}>-</Box>;
        }
        const colors = getPercentageColor(percentage);
        return (
          <Box
            sx={{
              fontWeight: 700,
              color: colors.text,
              backgroundColor: colors.bg,
              px: 1.5,
              py: 0.5,
              borderRadius: 1,
              textAlign: 'center',
            }}
          >
            {percentage.toFixed(2)}%
          </Box>
        );
      },
    },
    {
      field: 'letterGrade',
      headerName: 'Letter Grade',
      width: 130,
      renderCell: (params) => {
        if (!params?.row) return <Box sx={{ color: '#999', fontStyle: 'italic' }}>-</Box>;
        const grade = params.row.letterGrade;
        if (!grade) {
          return <Box sx={{ color: '#999', fontStyle: 'italic' }}>-</Box>;
        }
        const colors = getGradeColor(grade);
        return (
          <Chip
            label={grade}
            sx={{
              backgroundColor: colors.bg,
              color: colors.text,
              fontWeight: 700,
              fontSize: '0.9rem',
              minWidth: 60,
            }}
          />
        );
      },
    },
    {
      field: 'gradePoint',
      headerName: 'GPA',
      width: 100,
      renderCell: (params) => {
        if (!params?.row) return <Box sx={{ color: '#999', fontStyle: 'italic' }}>-</Box>;
        const gpa = params.row.gradePoint;
        if (gpa === null || gpa === undefined) {
          return <Box sx={{ color: '#999', fontStyle: 'italic' }}>-</Box>;
        }
        const color = gpa >= 3.5 ? '#2e7d32' : gpa >= 3.0 ? '#1976d2' : gpa >= 2.0 ? '#ed6c02' : '#d32f2f';
        return (
          <Box sx={{ fontWeight: 700, color, fontSize: '1rem' }}>
            {gpa.toFixed(2)}
          </Box>
        );
      },
    },
    {
      field: 'isFinalized',
      headerName: 'Status',
      width: 120,
      renderCell: (params) => {
        if (!params?.row) return <Chip label="N/A" size="small" />;
        const isFinalized = params.row.isFinalized;
        return isFinalized ? (
          <Chip
            icon={<LockIcon fontSize="small" />}
            label="Finalized"
            color="success"
            size="small"
            sx={{ fontWeight: 600 }}
          />
        ) : (
          <Chip
            label="Draft"
            color="warning"
            size="small"
            sx={{ fontWeight: 600 }}
          />
        );
      },
    },
  ];

  /**
   * Transform grades to DataGrid rows
   */
  const rows = grades.map((grade) => ({
    id: grade._id,
    ...grade,
  }));

  /**
   * Close snackbar
   */
  const handleCloseSnackbar = (event, reason) => {
    if (reason === 'clickaway') return;
    setSnackbar({ ...snackbar, open: false });
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
      <Paper elevation={3} sx={{ p: 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" gutterBottom>
              <GradeIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Final Grades
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

          {/* Right Side Controls */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {allFinalized && (
              <Chip
                icon={<LockIcon />}
                label="ALL GRADES FINALIZED"
                color="success"
                sx={{ fontWeight: 700, px: 1 }}
              />
            )}
            <Tooltip title={allFinalized ? "All grades are already finalized" : "Calculate/Recalculate Grades"}>
              <span>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={calculating ? <CircularProgress size={20} /> : <CalculateIcon />}
                  onClick={handleCalculateGrades}
                  disabled={calculating || allFinalized}
                >
                  {calculating ? 'Calculating...' : 'Calculate Grades'}
                </Button>
              </span>
            </Tooltip>
            <Tooltip title={allFinalized ? "Grades already finalized" : "Finalize all grades and lock sheets"}>
              <span>
                <Button
                  variant="contained"
                  color="success"
                  startIcon={finalizing ? <CircularProgress size={20} /> : <LockIcon />}
                  onClick={handleOpenFinalizeDialog}
                  disabled={finalizing || allFinalized || grades.length === 0}
                >
                  {finalizing ? 'Finalizing...' : 'Finalize Grades'}
                </Button>
              </span>
            </Tooltip>
            <Tooltip title="Refresh">
              <IconButton onClick={fetchGrades} color="primary" disabled={loading}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Alert Messages */}
        {allFinalized && (
          <Alert severity="success" sx={{ mb: 2 }}>
            <strong>All grades have been finalized.</strong> CT Marks, Attendance, Assignments, and Term Exam sheets are now locked. 
            Grades cannot be recalculated unless unfinalized by an administrator.
          </Alert>
        )}
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
            bgcolor: allFinalized ? '#e8f5e9' : '#e3f2fd', 
            borderRadius: 1,
            border: allFinalized ? '2px solid #4caf50' : '1px solid #2196f3',
          }}
        >
          <Typography variant="body2" color="text.secondary">
            <strong>Total Students:</strong> {grades.length} | 
            <strong> Finalized:</strong> {grades.filter(g => g.isFinalized).length} |
            <strong> Draft:</strong> {grades.filter(g => !g.isFinalized).length}
            {allFinalized && (
              <Chip
                icon={<CheckCircleIcon fontSize="small" />}
                label="ALL FINALIZED"
                color="success"
                size="small"
                sx={{ ml: 2, fontWeight: 700 }}
              />
            )}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            💡 <strong>Grade Policy:</strong> CT (40%) + Attendance (10%) + Assignments (10%) + Term Exam (40%) = Total (100%)
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            📊 Grades are color-coded: Green (Excellent), Blue (Good), Yellow (Fair), Orange (Below Average), Red (Fail)
          </Typography>
          {allFinalized && (
            <Typography variant="caption" sx={{ display: 'block', mt: 1, color: '#2e7d32', fontWeight: 600 }}>
              🔒 All mark entry sheets (CT, Attendance, Assignments, Term Exam) are locked and cannot be modified.
            </Typography>
          )}
        </Box>

        {/* Data Grid */}
        {grades.length === 0 ? (
          <Alert severity="info">
            No grades calculated yet. Click "Calculate Grades" to generate grades for all students.
          </Alert>
        ) : (
          <Box sx={{ height: 600, width: '100%' }}>
            <DataGrid
              rows={rows}
              columns={columns}
              pageSize={10}
              rowsPerPageOptions={[10, 25, 50, 100]}
              disableSelectionOnClick
              sx={{
                '& .MuiDataGrid-cell': {
                  borderRight: '1px solid #e0e0e0',
                },
                '& .MuiDataGrid-columnHeaders': {
                  backgroundColor: '#f5f5f5',
                  fontWeight: 600,
                },
                '& .MuiDataGrid-row:hover': {
                  backgroundColor: '#f9f9f9',
                },
              }}
            />
          </Box>
        )}
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

      {/* Finalize Confirmation Dialog */}
      <Dialog
        open={confirmDialog.open}
        onClose={handleCloseFinalizeDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ color: '#d32f2f', fontWeight: 700 }}>
          <LockIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
          Finalize Grades - Confirmation Required
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            <strong>Warning:</strong> This action will finalize all grades for this course
            {section && ` (Section ${section})`} and <strong>lock all related mark entry sheets</strong>:
          </DialogContentText>
          <Box sx={{ mt: 2, mb: 2, pl: 2 }}>
            <Typography variant="body2" color="text.secondary">
              • <strong>CT Marks Sheet</strong> - Locked for editing
            </Typography>
            <Typography variant="body2" color="text.secondary">
              • <strong>Attendance Sheet</strong> - Locked for editing
            </Typography>
            <Typography variant="body2" color="text.secondary">
              • <strong>Assignment Sheet</strong> - Locked for editing
            </Typography>
            <Typography variant="body2" color="text.secondary">
              • <strong>Term Exam Marks</strong> - Locked for editing
            </Typography>
          </Box>
          <DialogContentText sx={{ mt: 2 }}>
            <strong>After finalization:</strong>
          </DialogContentText>
          <Box sx={{ mt: 1, mb: 2, pl: 2 }}>
            <Typography variant="body2" color="text.secondary">
              ✓ Grades will be visible to students
            </Typography>
            <Typography variant="body2" color="text.secondary">
              ✓ All mark entry sheets will be read-only
            </Typography>
            <Typography variant="body2" color="text.secondary">
              ✓ Grade recalculation will be disabled
            </Typography>
            <Typography variant="body2" color="error.main" sx={{ mt: 1, fontWeight: 600 }}>
              ⚠ Only administrators can unfinalize grades
            </Typography>
          </Box>
          <DialogContentText>
            Are you sure you want to finalize <strong>{grades.length} student grades</strong>?
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCloseFinalizeDialog} color="inherit">
            Cancel
          </Button>
          <Button 
            onClick={handleFinalizeGrades} 
            variant="contained"
            color="success"
            startIcon={<LockIcon />}
            autoFocus
          >
            Yes, Finalize All Grades
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default GradeSheet;
