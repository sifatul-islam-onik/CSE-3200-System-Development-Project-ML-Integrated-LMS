# CO Attainment Excel Integration

## Overview
This implementation provides a complete system for reading and editing the Course Outcome (CO) attainment Excel file with strict adherence to a fixed cell layout.

## Files Created

### Backend
1. **`server/utils/attainmentExcelUtil.js`** - Excel utility with fixed cell mappings
2. **`server/controllers/attainmentController.js`** - API controller for attainment operations
3. **`server/routes/attainmentRoutes.js`** - API routes for attainment endpoints
4. **`server/server.js`** - Updated to include attainment routes

### Frontend
1. **`client/src/services/attainmentService.js`** - API service for frontend
2. **`client/src/components/AttainmentView.js`** - React component for viewing/editing
3. **`client/src/styles/AttainmentView.css`** - Component styling
4. **`client/src/App.js`** - Updated to include attainment route
5. **`client/src/pages/TeacherDashboard.js`** - Updated to add navigation link

## Excel Structure (Fixed Cell Mappings)

### ZONE 1: METADATA (Read-only)
- **B2**: Course Code
- **D2**: Course Name
- **B3**: Semester/Term
- **D3**: Session
- **B5**: Threshold Text

### ZONE 2: CO-PO MATRIX (Read-only)
- **CO Labels**: A8-A13 (CO1-CO6)
- **PO Labels**: B7-M7 (PO1-PO12)
- **Matrix Values**: B8:M13 (6 rows × 12 columns)
- **Allowed values**: 1, 0, Y, N, --, blank

### ZONE 3: STUDENT ATTAINMENT (Editable)
- **Header Row**: 15 (PO1-PO12 in B15:M15)
- **Data Start Row**: 16
- **Column A**: Roll Number (read-only)
- **Columns B-M**: PO1-PO12 values (editable)
- **Iteration**: Continues until blank roll number

### ZONE 4: SUMMARY (Read-only)
- **Start Row**: 40
- Contains CO-wise and PO-wise achievement statistics
- All cells are read-only (formula-driven)

## API Endpoints

### GET `/api/attainment/sheets`
Get list of all sheet names in the Excel file.

**Response:**
```json
{
  "success": true,
  "sheets": ["Sheet1", "Sheet2", ...]
}
```

### GET `/api/attainment/:sheetName?`
Get complete attainment data for a sheet (defaults to first sheet).

**Response:**
```json
{
  "success": true,
  "data": {
    "sheetName": "Sheet1",
    "metadata": {
      "courseCode": "CSE101",
      "courseName": "Programming Fundamentals",
      "semesterTerm": "Fall 2025",
      "session": "2024-2025",
      "thresholdText": "Binary Achieve >= 55%"
    },
    "coPoMatrix": {
      "coLabels": ["CO1", "CO2", "CO3", "CO4", "CO5", "CO6"],
      "poLabels": ["PO1", "PO2", ..., "PO12"],
      "values": [
        {"co": "CO1", "values": {"PO1": 1, "PO2": 0, ...}},
        ...
      ]
    },
    "students": [
      {
        "rollNumber": "2021-1-60-001",
        "row": 16,
        "poValues": {"PO1": "Y", "PO2": "N", ...}
      },
      ...
    ],
    "summary": {
      "CO1 Achievement": "75%",
      ...
    }
  }
}
```

### PUT `/api/attainment/update` (Teacher/Admin only)
Update a single student PO value.

**Request Body:**
```json
{
  "sheetName": "Sheet1",
  "rollNumber": "2021-1-60-001",
  "poNumber": "PO1",
  "value": "Y"
}
```

### PUT `/api/attainment/batch-update` (Teacher/Admin only)
Batch update multiple student PO values.

**Request Body:**
```json
{
  "sheetName": "Sheet1",
  "updates": [
    {"rollNumber": "2021-1-60-001", "poNumber": "PO1", "value": "Y"},
    {"rollNumber": "2021-1-60-002", "poNumber": "PO2", "value": "N"},
    ...
  ]
}
```

## Frontend Components

### AttainmentView Component
Located at `/attainment` route, accessible to teachers, admins, and students.

**Features:**
- Sheet selector (if multiple sheets exist)
- Read-only metadata display
- Read-only CO-PO matrix grid
- Editable student attainment table (teachers/admins only)
- Read-only summary statistics
- Inline cell editing with save/cancel
- Real-time data refresh after updates

**Permissions:**
- **Students**: View-only access
- **Teachers/Admins**: View and edit student PO values

## Key Design Principles

1. **No Structure Inference**: All cell addresses are hardcoded
2. **Read-Only Zones**: Metadata, CO-PO matrix, and summary cannot be modified
3. **Fixed Layout**: No row/column insertion or deletion
4. **Formula Preservation**: Excel formulas remain intact
5. **Explicit Cell Mapping**: PO1→B, PO2→C, ..., PO12→M
6. **Immediate Save**: Changes are written to Excel file immediately

## Usage Flow

1. Teacher/Admin navigates to "CO Attainment" from dashboard
2. System loads and displays Excel data using fixed cell mappings
3. User views metadata, CO-PO matrix, and student data
4. Teacher/Admin clicks on a PO value cell to edit
5. Inline editor appears with save/cancel buttons
6. On save, backend writes to exact cell (e.g., B16 for PO1 of first student)
7. Excel file is saved immediately
8. Frontend reloads data to show updated summary statistics

## Security

- All routes protected with JWT authentication
- Write operations restricted to teachers and admins
- Input validation on PO numbers and roll numbers
- Row lookup prevents writing to wrong cells

## Error Handling

- Invalid sheet names → 404 error
- Invalid roll numbers → Not found error
- Invalid PO numbers → Validation error
- File access errors → 500 error with message

## Notes

- Excel file must exist at `/server/data/attainment.xlsx`
- File is read and written using ExcelJS library
- All formulas in Zone 4 (Summary) are preserved
- Multiple sheets are supported (selectable from UI)
