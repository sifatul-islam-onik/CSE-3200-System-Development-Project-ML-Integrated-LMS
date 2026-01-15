import React, { useState } from 'react';
import ExcelGrid from './ExcelGrid';
import { Box, Button, Typography } from '@mui/material';

/**
 * Example usage of ExcelGrid component for CT Marks entry
 */
const ExcelGridExample = () => {
  const [students] = useState([
    { id: 1, rollNo: '2020001', name: 'Alice Johnson', ct1: 18, ct2: 17, ct3: 19 },
    { id: 2, rollNo: '2020002', name: 'Bob Smith', ct1: 16, ct2: 19, ct3: 18 },
    { id: 3, rollNo: '2020003', name: 'Charlie Brown', ct1: 20, ct2: 15, ct3: 17 },
    { id: 4, rollNo: '2020004', name: 'Diana Prince', ct1: 19, ct2: 20, ct3: 20 },
  ]);

  const [editedData, setEditedData] = useState({});

  // Define columns for CT marks
  const columns = [
    {
      field: 'rollNo',
      headerName: 'Roll No',
      width: 120,
      editable: false,
    },
    {
      field: 'name',
      headerName: 'Student Name',
      width: 200,
      editable: false,
    },
    {
      field: 'ct1',
      headerName: 'CT 1 (20)',
      type: 'number',
      width: 120,
      editable: true,
    },
    {
      field: 'ct2',
      headerName: 'CT 2 (20)',
      type: 'number',
      width: 120,
      editable: true,
    },
    {
      field: 'ct3',
      headerName: 'CT 3 (20)',
      type: 'number',
      width: 120,
      editable: true,
    },
  ];

  // Validation rules
  const validation = {
    maxMarks: {
      ct1: 20,
      ct2: 20,
      ct3: 20,
    },
  };

  // Handle cell edit
  const handleCellEdit = ({ field, value, row, allRows }) => {
    console.log('Cell edited:', { field, value, row });
    
    // Track edited data
    setEditedData((prev) => ({
      ...prev,
      [row.id]: {
        ...prev[row.id],
        [field]: value,
      },
    }));
  };

  // Handle save button click
  const handleSave = () => {
    console.log('Saving edited data:', editedData);
    // Call API to save marks
    alert('Marks saved! Check console for data.');
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        CT Marks Entry - Example
      </Typography>
      
      <ExcelGrid
        rows={students}
        columns={columns}
        onCellEditCommit={handleCellEdit}
        validation={validation}
        height="400px"
        enableValidation={true}
      />

      <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
        <Button
          variant="contained"
          color="primary"
          onClick={handleSave}
          disabled={Object.keys(editedData).length === 0}
        >
          Save Changes
        </Button>
        <Button
          variant="outlined"
          onClick={() => setEditedData({})}
          disabled={Object.keys(editedData).length === 0}
        >
          Clear Changes
        </Button>
      </Box>

      {Object.keys(editedData).length > 0 && (
        <Box sx={{ mt: 2, p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            Pending Changes:
          </Typography>
          <pre>{JSON.stringify(editedData, null, 2)}</pre>
        </Box>
      )}
    </Box>
  );
};

export default ExcelGridExample;


/**
 * Example 2: Attendance Marks Entry
 */
export const AttendanceGridExample = () => {
  const [students] = useState([
    { id: 1, rollNo: '2020001', name: 'Alice Johnson', attendance: 95, marks: 9.5 },
    { id: 2, rollNo: '2020002', name: 'Bob Smith', attendance: 88, marks: 8.8 },
    { id: 3, rollNo: '2020003', name: 'Charlie Brown', attendance: 92, marks: 9.2 },
  ]);

  const columns = [
    { field: 'rollNo', headerName: 'Roll No', width: 120, editable: false },
    { field: 'name', headerName: 'Student Name', width: 200, editable: false },
    { field: 'attendance', headerName: 'Attendance %', type: 'number', width: 150 },
    {
      field: 'marks',
      headerName: 'Marks (10)',
      type: 'number',
      width: 120,
      renderCell: (params) => {
        // Auto-calculate marks from attendance
        const attendancePercent = params.row.attendance || 0;
        const calculatedMarks = (attendancePercent / 100) * 10;
        return calculatedMarks.toFixed(1);
      },
    },
  ];

  const validation = {
    maxMarks: { attendance: 100 },
    customValidator: (field, value) => {
      if (field === 'attendance' && value > 100) {
        return { valid: false, message: 'Attendance cannot exceed 100%' };
      }
      return { valid: true };
    },
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Attendance Marks Entry - Example
      </Typography>
      
      <ExcelGrid
        rows={students}
        columns={columns}
        onCellEditCommit={(data) => console.log('Attendance edited:', data)}
        validation={validation}
        height="350px"
      />
    </Box>
  );
};


/**
 * Example 3: Assignment Marks with Checkbox Selection
 */
export const AssignmentGridExample = () => {
  const [students] = useState([
    { id: 1, rollNo: '2020001', name: 'Alice Johnson', assignment1: 18, assignment2: 19 },
    { id: 2, rollNo: '2020002', name: 'Bob Smith', assignment1: 16, assignment2: 17 },
    { id: 3, rollNo: '2020003', name: 'Charlie Brown', assignment1: 20, assignment2: 18 },
  ]);

  const [selectedStudents, setSelectedStudents] = useState([]);

  const columns = [
    { field: 'rollNo', headerName: 'Roll No', width: 120, editable: false },
    { field: 'name', headerName: 'Student Name', width: 200, editable: false },
    { field: 'assignment1', headerName: 'Assignment 1 (20)', type: 'number', width: 150 },
    { field: 'assignment2', headerName: 'Assignment 2 (20)', type: 'number', width: 150 },
  ];

  const validation = {
    maxMarks: {
      assignment1: 20,
      assignment2: 20,
    },
  };

  const handleSelectionChange = (selectedRows) => {
    setSelectedStudents(selectedRows);
    console.log('Selected students:', selectedRows);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Assignment Marks Entry - Example (with Selection)
      </Typography>
      
      <ExcelGrid
        rows={students}
        columns={columns}
        onCellEditCommit={(data) => console.log('Assignment edited:', data)}
        validation={validation}
        height="350px"
        checkboxSelection={true}
        onSelectionChange={handleSelectionChange}
      />

      {selectedStudents.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle1">
            Selected: {selectedStudents.length} student(s)
          </Typography>
          <Button variant="contained" color="secondary" sx={{ mt: 1 }}>
            Bulk Update Selected
          </Button>
        </Box>
      )}
    </Box>
  );
};
