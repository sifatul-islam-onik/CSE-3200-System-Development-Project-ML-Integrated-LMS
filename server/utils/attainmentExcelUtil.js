const ExcelJS = require('exceljs');
const path = require('path');

// Fixed cell mappings - NEVER infer or scan
const CELL_MAP = {
  // ZONE 1: METADATA (Read-only)
  METADATA: {
    COURSE_CODE: 'B2',
    COURSE_NAME: 'D2',
    SEMESTER_TERM: 'B3',
    SESSION: 'D3',
    THRESHOLD_TEXT: 'B5'
  },

  // ZONE 2: CO-PO MATRIX (Read-only)
  CO_LABELS: ['A8', 'A9', 'A10', 'A11', 'A12', 'A13'], // CO1-CO6
  PO_LABELS: ['B7', 'C7', 'D7', 'E7', 'F7', 'G7', 'H7', 'I7', 'J7', 'K7', 'L7', 'M7'], // PO1-PO12
  
  // CO-PO Matrix ranges (Read-only)
  CO_PO_MATRIX_ROWS: [
    { co: 'CO1', range: 'B8:M8', row: 8 },
    { co: 'CO2', range: 'B9:M9', row: 9 },
    { co: 'CO3', range: 'B10:M10', row: 10 },
    { co: 'CO4', range: 'B11:M11', row: 11 },
    { co: 'CO5', range: 'B12:M12', row: 12 },
    { co: 'CO6', range: 'B13:M13', row: 13 }
  ],

  // ZONE 3: STUDENT ATTAINMENT
  STUDENT_TABLE: {
    HEADER_ROW: 15,
    START_ROW: 16,
    ROLL_COLUMN: 'A',
    PO_COLUMNS: ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M'] // PO1-PO12
  },

  // ZONE 4: SUMMARY (Read-only)
  SUMMARY_START_ROW: 40
};

// PO number to column mapping
const PO_TO_COLUMN = {
  'PO1': 'B', 'PO2': 'C', 'PO3': 'D', 'PO4': 'E',
  'PO5': 'F', 'PO6': 'G', 'PO7': 'H', 'PO8': 'I',
  'PO9': 'J', 'PO10': 'K', 'PO11': 'L', 'PO12': 'M'
};

const EXCEL_FILE_PATH = path.join(__dirname, '../data/attainment.xlsx');

/**
 * Get cell value, handling formula objects
 */
const getCellValue = (cell) => {
  if (!cell || cell.value === null || cell.value === undefined) {
    return null;
  }
  
  // If value is an object (formula), try to get the result
  if (typeof cell.value === 'object') {
    // Handle formula cells - return the cached result
    if (cell.value.result !== undefined) {
      return cell.value.result;
    }
    // Handle other object types (like dates, rich text, etc)
    if (cell.value.richText) {
      return cell.value.richText.map(t => t.text).join('');
    }
    // Default to null for unknown object types
    return null;
  }
  
  return cell.value;
};

/**
 * Read metadata from fixed cells
 */
const readMetadata = (worksheet) => {
  return {
    courseCode: getCellValue(worksheet.getCell(CELL_MAP.METADATA.COURSE_CODE)),
    courseName: getCellValue(worksheet.getCell(CELL_MAP.METADATA.COURSE_NAME)),
    semesterTerm: getCellValue(worksheet.getCell(CELL_MAP.METADATA.SEMESTER_TERM)),
    session: getCellValue(worksheet.getCell(CELL_MAP.METADATA.SESSION)),
    thresholdText: getCellValue(worksheet.getCell(CELL_MAP.METADATA.THRESHOLD_TEXT))
  };
};

/**
 * Read CO-PO matrix from fixed cells
 */
const readCoPoMatrix = (worksheet) => {
  // Read CO labels
  const coLabels = CELL_MAP.CO_LABELS.map(cell => getCellValue(worksheet.getCell(cell)));
  
  // Read PO labels
  const poLabels = CELL_MAP.PO_LABELS.map(cell => getCellValue(worksheet.getCell(cell)));
  
  // Read matrix values
  const values = CELL_MAP.CO_PO_MATRIX_ROWS.map(({ co, row }) => {
    const rowValues = {};
    CELL_MAP.STUDENT_TABLE.PO_COLUMNS.forEach((col, idx) => {
      const cellAddress = `${col}${row}`;
      const cellValue = getCellValue(worksheet.getCell(cellAddress));
      rowValues[`PO${idx + 1}`] = cellValue;
    });
    return { co, values: rowValues };
  });

  return { coLabels, poLabels, values };
};

/**
 * Read student attainment data from fixed table structure
 */
const readStudentData = (worksheet) => {
  const students = [];
  let currentRow = CELL_MAP.STUDENT_TABLE.START_ROW;
  
  // Read until blank roll number
  while (true) {
    const rollCell = `${CELL_MAP.STUDENT_TABLE.ROLL_COLUMN}${currentRow}`;
    const rollNumber = getCellValue(worksheet.getCell(rollCell));
    
    // Stop if roll number is blank
    if (!rollNumber) break;
    
    // Read PO values for this student
    const poValues = {};
    CELL_MAP.STUDENT_TABLE.PO_COLUMNS.forEach((col, idx) => {
      const cellAddress = `${col}${currentRow}`;
      const cellValue = getCellValue(worksheet.getCell(cellAddress));
      poValues[`PO${idx + 1}`] = cellValue;
    });
    
    students.push({
      rollNumber,
      row: currentRow, // Store row number for write-back
      poValues
    });
    
    currentRow++;
  }
  
  return students;
};

/**
 * Read summary data from row 40 onwards
 */
const readSummary = (worksheet) => {
  const summary = {};
  let currentRow = CELL_MAP.SUMMARY_START_ROW;
  
  // Read up to 20 rows for summary section
  for (let i = 0; i < 20; i++) {
    const labelCell = worksheet.getCell(`A${currentRow + i}`);
    const valueCell = worksheet.getCell(`B${currentRow + i}`);
    
    const label = getCellValue(labelCell);
    const value = getCellValue(valueCell);
    
    if (label) {
      summary[label] = value;
    }
  }
  
  return summary;
};

/**
 * Read complete attainment data from Excel file
 */
const readAttainmentData = async (sheetName = null) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(EXCEL_FILE_PATH);
  
  // Get first sheet if no sheet name provided
  const worksheet = sheetName 
    ? workbook.getWorksheet(sheetName) 
    : workbook.worksheets[0];
  
  if (!worksheet) {
    // Worksheet not found - return empty data instead of crashing the server
    console.warn(`[readAttainmentData] Worksheet "${sheetName || '(first)'}" not found in Excel file, returning empty data`);
    return [];
  }
  
  return {
    sheetName: worksheet.name,
    metadata: readMetadata(worksheet),
    coPoMatrix: readCoPoMatrix(worksheet),
    students: readStudentData(worksheet),
    summary: readSummary(worksheet)
  };
};

/**
 * Write single cell value for student PO attainment
 * @param {string} sheetName - Sheet name
 * @param {string} rollNumber - Student roll number
 * @param {string} poNumber - PO identifier (PO1-PO12)
 * @param {*} newValue - New value to write
 */
const writeStudentPoValue = async (sheetName, rollNumber, poNumber, newValue) => {
  // Validate PO number
  const columnLetter = PO_TO_COLUMN[poNumber];
  if (!columnLetter) {
    throw new Error(`Invalid PO number: ${poNumber}`);
  }
  
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(EXCEL_FILE_PATH);
  
  const worksheet = sheetName 
    ? workbook.getWorksheet(sheetName) 
    : workbook.worksheets[0];
  
  if (!worksheet) {
    throw new Error('Worksheet not found');
  }
  
  // Find row with matching roll number
  let targetRow = null;
  let currentRow = CELL_MAP.STUDENT_TABLE.START_ROW;
  
  while (true) {
    const rollCell = `${CELL_MAP.STUDENT_TABLE.ROLL_COLUMN}${currentRow}`;
    const cellValue = getCellValue(worksheet.getCell(rollCell));
    
    if (!cellValue) break; // No more students
    
    if (cellValue.toString() === rollNumber.toString()) {
      targetRow = currentRow;
      break;
    }
    
    currentRow++;
  }
  
  if (!targetRow) {
    throw new Error(`Roll number not found: ${rollNumber}`);
  }
  
  // Write value to target cell
  const targetCell = `${columnLetter}${targetRow}`;
  worksheet.getCell(targetCell).value = newValue;
  
  // Save Excel file
  await workbook.xlsx.writeFile(EXCEL_FILE_PATH);
  
  return { success: true, cell: targetCell, value: newValue };
};

/**
 * Batch update multiple student PO values
 * @param {string} sheetName - Sheet name
 * @param {Array} updates - Array of {rollNumber, poNumber, value}
 */
const batchUpdateStudentPoValues = async (sheetName, updates) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(EXCEL_FILE_PATH);
  
  const worksheet = sheetName 
    ? workbook.getWorksheet(sheetName) 
    : workbook.worksheets[0];
  
  if (!worksheet) {
    throw new Error('Worksheet not found');
  }
  
  // Build roll number to row mapping
  const rollToRow = {};
  let currentRow = CELL_MAP.STUDENT_TABLE.START_ROW;
  
  while (true) {
    const rollCell = `${CELL_MAP.STUDENT_TABLE.ROLL_COLUMN}${currentRow}`;
    const cellValue = getCellValue(worksheet.getCell(rollCell));
    
    if (!cellValue) break;
    
    rollToRow[cellValue.toString()] = currentRow;
    currentRow++;
  }
  
  // Apply all updates
  const results = [];
  for (const update of updates) {
    const { rollNumber, poNumber, value } = update;
    
    // Validate PO number
    const columnLetter = PO_TO_COLUMN[poNumber];
    if (!columnLetter) {
      results.push({ success: false, error: `Invalid PO: ${poNumber}` });
      continue;
    }
    
    // Find row
    const targetRow = rollToRow[rollNumber.toString()];
    if (!targetRow) {
      results.push({ success: false, error: `Roll not found: ${rollNumber}` });
      continue;
    }
    
    // Write value
    const targetCell = `${columnLetter}${targetRow}`;
    worksheet.getCell(targetCell).value = value;
    results.push({ success: true, cell: targetCell, value });
  }
  
  // Save Excel file
  await workbook.xlsx.writeFile(EXCEL_FILE_PATH);
  
  return results;
};

/**
 * Get list of all sheet names
 */
const getSheetNames = async () => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(EXCEL_FILE_PATH);
  return workbook.worksheets.map(ws => ws.name);
};

module.exports = {
  readAttainmentData,
  writeStudentPoValue,
  batchUpdateStudentPoValues,
  getSheetNames,
  CELL_MAP,
  PO_TO_COLUMN
};
