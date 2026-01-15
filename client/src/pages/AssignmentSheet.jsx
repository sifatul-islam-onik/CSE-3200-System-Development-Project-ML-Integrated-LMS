/**
 * AssignmentSheet.jsx
 * 
 * DATA OWNERSHIP:
 * - Owns 'Assignment' data (LMS Mode - Read/Write)
 * - Manages detailed assignment submissions and CO mappings.
 * 
 * BEHAVIOR:
 * - Fetches data ON MOUNT.
 * - Updates local state immediately on save.
 * - Distinct from "Simple Entry" mode in AttendanceSheet.
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  OutlinedInput,
  Checkbox,
  ListItemText,
} from '@mui/material';
import {
  Save as SaveIcon,
  Refresh as RefreshIcon,
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
  Assignment as AssignmentIcon,
  Settings as SettingsIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import ExcelGrid from '../components/ExcelGrid';
import { updateAssignment, createAssignment } from '../services/assignmentService';
import { getCourseById, getCourseStudents } from '../services/courseService';
import { getCourseOutcomes } from '../services/courseOutcomeService';
import { getCourseAttendance, bulkSaveAttendance } from '../services/attendanceService';

const AssignmentSheet = ({ courseId, section, academicYear }) => {
  const { markDirty } = useWorkbook();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [students, setStudents] = useState([]);
  const [assignmentMarks, setAssignmentMarks] = useState({});
  const [assignments, setAssignments] = useState([]);
  const [numberOfAssignments, setNumberOfAssignments] = useState(3); // Track max assignments from data
  const [course, setCourse] = useState(null);
  const [columns, setColumns] = useState([]);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [editedCells, setEditedCells] = useState({});
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [isFinalized, setIsFinalized] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [courseOutcomes, setCourseOutcomes] = useState([]);
  const [coMappingModal, setCoMappingModal] = useState({ open: false, assignmentNumber: null });
  const [selectedCOs, setSelectedCOs] = useState([]);
  const [assignmentCOMap, setAssignmentCOMap] = useState({}); // { assignmentNumber: [coIds] }
  const [createAssignmentModal, setCreateAssignmentModal] = useState({ open: false });
  const [newAssignment, setNewAssignment] = useState({
    numberOfAssignments: 3,
    totalMarksPerAssignment: 10,
  });
  const [creating, setCreating] = useState(false);

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

        // Fetch enrolled students using API (same as CTMarksSheet)
        const studentsResponse = await getCourseStudents(courseId, section);
        const enrolledStudents = studentsResponse?.data || [];

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
   * Fetch course outcomes for CO mapping
   */
  useEffect(() => {
    if (!courseId) return;

    const fetchCOs = async () => {
      try {
        const response = await getCourseOutcomes(courseId);
        setCourseOutcomes(response.data || []);
      } catch (err) {
        console.error('Error fetching course outcomes:', err);
        // Don't show error if COs don't exist yet
      }
    };

    fetchCOs();
  }, [courseId]);

  /**
   * Fetch existing assignment marks (extracted as reusable function)
   * Assignment marks are stored in Attendance records with an assignments array
   */
  const fetchAssignmentMarks = async () => {
    try {
      const filters = {
        section: section || undefined,
        academicYear: academicYear || new Date().getFullYear().toString(),
      };

      console.log('[AssignmentSheet] Fetching attendance records with filters:', filters);
      const response = await getCourseAttendance(courseId, filters);
      console.log('[AssignmentSheet] Attendance response:', response);
      
      // Extract assignment marks from attendance records
      const marksMap = {};
      let maxAssignments = 0;
      const assignmentTotals = {}; // Track total marks for each assignment position
      
      response.data.forEach((record) => {
        const studentId = record.student._id || record.student;
        console.log('[AssignmentSheet] Processing record for student:', studentId);
        console.log('[AssignmentSheet] Assignments array:', record.assignments);
        
        if (record.assignments && record.assignments.length > 0) {
          maxAssignments = Math.max(maxAssignments, record.assignments.length);
          
          marksMap[studentId] = {};
          record.assignments.forEach((assignment, index) => {
            const assignmentNumber = index + 1;
            marksMap[studentId][`assignment${assignmentNumber}`] = assignment.marksObtained;
            
            // Track total marks for this assignment position
            if (!assignmentTotals[assignmentNumber]) {
              assignmentTotals[assignmentNumber] = assignment.totalMarks;
            }
          });
        }
      });

      console.log('[AssignmentSheet] Max assignments found:', maxAssignments);
      console.log('[AssignmentSheet] Assignment totals:', assignmentTotals);
      console.log('[AssignmentSheet] Marks map:', marksMap);
      
      // Build assignments array from totals
      const assignmentsArray = [];
      for (let i = 1; i <= maxAssignments; i++) {
        assignmentsArray.push({
          assignmentNumber: i,
          title: `Assignment ${i}`,
          totalMarks: assignmentTotals[i] || 10,
          _id: `assignment-${i}` // Dummy ID for UI purposes
        });
      }
      
      setNumberOfAssignments(maxAssignments);
      setAssignments(assignmentsArray);
      setAssignmentMarks(marksMap);
    } catch (err) {
      console.error('Error fetching assignment marks:', err);
      // Don't show error if no attendance records exist yet
      if (err.response?.status !== 404) {
        setError(err.response?.data?.message || 'Failed to fetch assignment marks');
      }
    }
  };

  /**
   * Effect to fetch assignment marks when dependencies change
   */
  useEffect(() => {
    if (!courseId || students.length === 0) return;
    fetchAssignmentMarks();
  }, [courseId, section, academicYear, students]);

  /**
   * Calculate total assignment marks for a student
   */
  const calculateTotal = (student) => {
    let total = 0;
    assignments.forEach((assignment) => {
      const assignmentField = `assignment${assignment.assignmentNumber}`;
      const value = student[assignmentField];
      if (value !== null && value !== undefined && value !== '') {
        total += Number(value);
      }
    });
    return total;
  };

  /**
   * Build dynamic columns based on numberOfAssignments
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

    // Add assignment columns based on actual assignments
    assignments.forEach((assignment) => {
      cols.push({
        field: `assignment${assignment.assignmentNumber}`,
        headerName: `${assignment.title || `Assignment ${assignment.assignmentNumber}`} (/${assignment.totalMarks})`,
        type: 'number',
        width: 200,
        editable: !isFinalized,
        renderCell: (params) => {
          const value = params.value;
          if (value === null || value === undefined || value === '') {
            return (
              <Box sx={{ color: '#999', fontStyle: 'italic' }}>
                -
              </Box>
            );
          }

          return (
            <Box
              sx={{
                fontWeight: 500,
                color: value >= assignment.totalMarks * 0.8 ? '#2e7d32' : '#000',
              }}
            >
              {value} / {assignment.totalMarks}
            </Box>
          );
        },
      });
    });

    // Add total column if there are assignments
    if (assignments.length > 0) {
      const totalPossible = assignments.reduce((sum, a) => sum + a.totalMarks, 0);
      
      cols.push({
        field: 'total',
        headerName: `Total (/${totalPossible})`,
        type: 'number',
        width: 150,
        editable: false,
        renderCell: (params) => {
          const total = calculateTotal(params.row);
          const percentage = totalPossible > 0 ? (total / totalPossible) * 100 : 0;

          let color = '#1976d2';
          if (percentage >= 80) color = '#2e7d32';
          else if (percentage < 50) color = '#d32f2f';

          return (
            <Tooltip title={`${percentage.toFixed(1)}%`} arrow>
              <Box sx={{ fontWeight: 700, color, fontSize: '1rem' }}>
                {total.toFixed(1)}
              </Box>
            </Tooltip>
          );
        },
      });
    }

    setColumns(cols);
  }, [assignments, isFinalized]);

  /**
   * Merge students with their assignment marks
   */
  const gridRows = students.map((student) => {
    const studentMarks = assignmentMarks[student.studentId] || {};
    const row = { ...student };

    // Add assignment marks to row based on actual assignments
    assignments.forEach((assignment) => {
      const assignmentField = `assignment${assignment.assignmentNumber}`;
      row[assignmentField] = studentMarks[assignmentField] !== undefined 
        ? studentMarks[assignmentField] 
        : null;
    });

    return row;
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

    // Update local assignment marks (triggers recalculation)
    setAssignmentMarks((prev) => ({
      ...prev,
      [row.studentId]: {
        ...prev[row.studentId],
        [field]: value,
      },
    }));
  };

  /**
   * Save assignment marks to backend (save to Attendance collection)
   */
  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      // Group edited cells by student
      const studentGroups = {};
      Object.values(editedCells).forEach((edit) => {
        const { studentId, field, value } = edit;
        const assignmentNumber = parseInt(field.replace('assignment', ''));
        
        if (!studentGroups[studentId]) {
          studentGroups[studentId] = {};
        }

        studentGroups[studentId][assignmentNumber] = value !== null && value !== undefined && value !== '' 
          ? Number(value) 
          : 0;
      });

      console.log('[AssignmentSheet] Student groups to save:', studentGroups);

      // Build attendance records array
      const attendanceRecords = [];
      
      for (const [studentId, marksChanges] of Object.entries(studentGroups)) {
        // Get existing marks for this student
        const existingMarks = assignmentMarks[studentId] || {};
        
        // Build complete assignments array (merge existing with changes)
        const assignmentsArray = [];
        for (let i = 1; i <= numberOfAssignments; i++) {
          const assignment = assignments.find(a => a.assignmentNumber === i);
          const totalMarks = assignment ? assignment.totalMarks : 10;
          
          // Use changed value if exists, otherwise use existing value
          const marksObtained = marksChanges[i] !== undefined 
            ? marksChanges[i]
            : (existingMarks[`assignment${i}`] || 0);
          
          assignmentsArray.push({
            marksObtained: Number(marksObtained),
            totalMarks: totalMarks
          });
        }

        console.log('[AssignmentSheet] Building record for student:', studentId);
        console.log('[AssignmentSheet] Assignments array:', assignmentsArray);

        attendanceRecords.push({
          student: studentId,
          course: courseId,
          section: section,
          academicYear: academicYear,
          totalClasses: 100, // Default for percentage calculation
          attendedClasses: 0, // Not updating attendance here
          marksAwarded: 0, // Not updating attendance marks here
          totalMarks: 5, // Default attendance total
          assignments: assignmentsArray
        });
      }

      console.log('[AssignmentSheet] Attendance records to save:', attendanceRecords);

      if (attendanceRecords.length === 0) {
        setError('No assignment marks to save.');
        setSaving(false);
        return;
      }

      const response = await bulkSaveAttendance(attendanceRecords);
      console.log('[AssignmentSheet] Save response:', response);

      // Show success toast
      setSnackbar({
        open: true,
        message: `✓ Successfully saved assignment marks for ${attendanceRecords.length} students!`,
        severity: 'success',
      });

      // Clear edited cells after successful save
      setEditedCells({});

      // Refresh assignment marks data to show updated values
      await fetchAssignmentMarks();
      
      // Mark grades as dirty so GradeSheet recalculates
      markDirty('grades');
      markDirty('co'); // Assignment marks also affect CO attainment

    } catch (err) {
      console.error('Error saving assignment marks:', err);
      
      // Show error toast
      const errorMessage = err.response?.data?.message || 'Failed to save assignment marks. Please try again.';
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
   * Open CO mapping modal
   */
  const handleOpenCOMapping = (assignmentNumber) => {
    const currentCOs = assignmentCOMap[assignmentNumber] || [];
    setSelectedCOs(currentCOs);
    setCoMappingModal({ open: true, assignmentNumber });
  };

  /**
   * Close CO mapping modal
   */
  const handleCloseCOMapping = () => {
    setCoMappingModal({ open: false, assignmentNumber: null });
    setSelectedCOs([]);
  };

  /**
   * Save CO mapping to assignment
   */
  const handleSaveCOMapping = async () => {
    try {
      const assignmentNumber = coMappingModal.assignmentNumber;
      
      // Find the assignment by number
      let assignment = assignments.find(a => a.assignmentNumber === assignmentNumber);
      
      if (!assignment) {
        // If assignment doesn't exist, we need to show a message
        setSnackbar({
          open: true,
          message: 'Assignment must be created before mapping COs. Please save marks first.',
          severity: 'warning',
        });
        handleCloseCOMapping();
        return;
      }

      // Update assignment with CO mapping
      await updateAssignment(assignment._id, {
        courseOutcomes: selectedCOs,
      });

      // Update local CO map
      setAssignmentCOMap(prev => ({
        ...prev,
        [assignmentNumber]: selectedCOs,
      }));
      
      // Mark CO attainment as dirty
      markDirty('co');

      setSnackbar({
        open: true,
        message: `✓ Successfully mapped ${selectedCOs.length} COs to Assignment ${assignmentNumber}`,
        severity: 'success',
      });

      handleCloseCOMapping();
    } catch (err) {
      console.error('Error saving CO mapping:', err);
      setSnackbar({
        open: true,
        message: `✗ Failed to save CO mapping: ${err.response?.data?.message || err.message}`,
        severity: 'error',
      });
    }
  };

  /**
   * Handle CO selection change
   */
  const handleCOSelectionChange = (event) => {
    const value = event.target.value;
    setSelectedCOs(typeof value === 'string' ? value.split(',') : value);
  };

  /**
   * Open assignment configuration modal
   */
  const handleOpenCreateAssignment = () => {
    // Set current values
    setNewAssignment({
      numberOfAssignments: numberOfAssignments || 3,
      totalMarksPerAssignment: assignments[0]?.totalMarks || 10
    });
    setCreateAssignmentModal({ open: true });
  };

  /**
   * Close assignment configuration modal
   */
  const handleCloseCreateAssignment = () => {
    setCreateAssignmentModal({ open: false });
  };

  /**
   * Handle assignment config field change
   */
  const handleNewAssignmentChange = (field, value) => {
    setNewAssignment(prev => ({
      ...prev,
      [field]: value
    }));
  };

  /**
   * Apply assignment configuration
   */
  const handleCreateAssignment = async () => {
    try {
      setCreating(true);
      setError(null);

      const numAssignments = parseInt(newAssignment.numberOfAssignments) || 3;
      const totalMarks = parseInt(newAssignment.totalMarksPerAssignment) || 10;

      // Build assignments array
      const assignmentsArray = [];
      for (let i = 1; i <= numAssignments; i++) {
        assignmentsArray.push({
          assignmentNumber: i,
          title: `Assignment ${i}`,
          totalMarks: totalMarks,
          _id: `assignment-${i}`
        });
      }

      setNumberOfAssignments(numAssignments);
      setAssignments(assignmentsArray);

      setSnackbar({
        open: true,
        message: `✓ Configured ${numAssignments} assignments with ${totalMarks} marks each`,
        severity: 'success',
      });

      handleCloseCreateAssignment();
    } catch (err) {
      console.error('Error configuring assignments:', err);
      setError('Failed to configure assignments');
      setSnackbar({
        open: true,
        message: `✗ Failed to configure assignments`,
        severity: 'error',
      });
    } finally {
      setCreating(false);
    }
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
      // await finalizeAssignments(courseId, { section, academicYear, isFinalized: !isFinalized });
      
      setIsFinalized(!isFinalized);
      setSnackbar({
        open: true,
        message: !isFinalized ? '🔒 Assignment marks have been locked' : '🔓 Assignment marks have been unlocked',
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
   * Validation rules - build from actual assignments
   */
  const validation = {
    maxMarks: {},
  };

  // Set max marks for each assignment based on actual data
  assignments.forEach((assignment) => {
    validation.maxMarks[`assignment${assignment.assignmentNumber}`] = assignment.totalMarks;
  });

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
          <Box>
            <Typography variant="h4" gutterBottom>
              <AssignmentIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Assignment Marks Entry
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
            {/* Create Assignment Button - Opens config modal */}
            <Button
              variant="contained"
              color="primary"
              startIcon={<SettingsIcon />}
              onClick={handleOpenCreateAssignment}
              disabled={isFinalized || loading}
            >
              Configure Assignments
            </Button>

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
            bgcolor: isFinalized ? '#ffebee' : '#fff3e0', 
            borderRadius: 1,
            border: isFinalized ? '2px solid #d32f2f' : '1px solid #ed6c02',
          }}
        >
          <Typography variant="body2" color="text.secondary">
            <strong>Students Enrolled:</strong> {students.length} | 
            <strong> Assignments Created:</strong> {assignments.length} |
            <strong> Edited Cells:</strong> {Object.keys(editedCells).length}
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
                🔒 <strong>Assignment marks are locked.</strong> Toggle the switch above to unlock and enable editing.
              </>
            ) : assignments.length === 0 ? (
              <>
                ℹ️ No assignments created yet. Click "Create Assignment" to add a new assignment.
              </>
            ) : (
              <>
                💡 Enter marks for each assignment. Changes are saved to backend on "Save".
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
        ) : assignments.length === 0 ? (
          <Alert severity="info" icon={<AssignmentIcon />}>
            <strong>No assignments created yet.</strong> Click the "Create Assignment" button above to add your first assignment.
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
            startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
            onClick={handleSave}
            disabled={Object.keys(editedCells).length === 0 || saving || isFinalized}
          >
            {saving ? 'Saving...' : `Save ${Object.keys(editedCells).length} Changes`}
          </Button>
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

      {/* CO Mapping Modal */}
      <Dialog 
        open={coMappingModal.open} 
        onClose={handleCloseCOMapping}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Map Course Outcomes to Assignment {coMappingModal.assignmentNumber}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            {courseOutcomes.length === 0 ? (
              <Alert severity="info">
                No Course Outcomes defined for this course yet. Please create COs first.
              </Alert>
            ) : (
              <FormControl fullWidth>
                <InputLabel id="co-select-label">Select Course Outcomes</InputLabel>
                <Select
                  labelId="co-select-label"
                  multiple
                  value={selectedCOs}
                  onChange={handleCOSelectionChange}
                  input={<OutlinedInput label="Select Course Outcomes" />}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selected.map((coId) => {
                        const co = courseOutcomes.find(c => c._id === coId);
                        return (
                          <Chip 
                            key={coId} 
                            label={co?.co_code || coId} 
                            size="small"
                            color="primary"
                          />
                        );
                      })}
                    </Box>
                  )}
                >
                  {courseOutcomes.map((co) => (
                    <MenuItem key={co._id} value={co._id}>
                      <Checkbox checked={selectedCOs.indexOf(co._id) > -1} />
                      <ListItemText 
                        primary={co.co_code}
                        secondary={co.description}
                      />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
              💡 Select one or more Course Outcomes that this assignment assesses. CO tags will appear in the column header.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseCOMapping}>Cancel</Button>
          <Button 
            onClick={handleSaveCOMapping} 
            variant="contained"
            disabled={courseOutcomes.length === 0}
          >
            Save Mapping
          </Button>
        </DialogActions>
      </Dialog>

      {/* Configure Assignments Modal */}
      <Dialog 
        open={createAssignmentModal.open} 
        onClose={handleCloseCreateAssignment}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Configure Assignments
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {error && (
              <Alert severity="error" onClose={() => setError(null)}>
                {error}
              </Alert>
            )}
            
            <Alert severity="info">
              Configure the number of assignments and total marks per assignment. 
              Assignment marks are saved along with attendance records.
            </Alert>

            <TextField
              label="Number of Assignments"
              type="number"
              value={newAssignment.numberOfAssignments}
              onChange={(e) => handleNewAssignmentChange('numberOfAssignments', parseInt(e.target.value) || 3)}
              fullWidth
              required
              inputProps={{ min: 1, max: 10 }}
              helperText="How many assignments for this course (1-10)"
            />

            <TextField
              label="Total Marks Per Assignment"
              type="number"
              value={newAssignment.totalMarksPerAssignment}
              onChange={(e) => handleNewAssignmentChange('totalMarksPerAssignment', parseInt(e.target.value) || 10)}
              fullWidth
              required
              inputProps={{ min: 1, max: 100 }}
              helperText="Maximum marks for each assignment (will apply to all)"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseCreateAssignment} disabled={creating}>
            Cancel
          </Button>
          <Button 
            onClick={handleCreateAssignment} 
            variant="contained"
            disabled={creating}
            startIcon={creating ? <CircularProgress size={20} /> : <SettingsIcon />}
          >
            {creating ? 'Applying...' : 'Apply Configuration'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AssignmentSheet;
