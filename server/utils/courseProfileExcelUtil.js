const ExcelJS = require('exceljs');
const path = require('path');

const EXCEL_FILE_PATH = path.join(__dirname, '../data/attainment.xlsx');
const SHEET_NAME = 'CourseProfile';

// Fixed cell mappings for CourseProfile sheet - EXACT structure from user's table
const CELL_MAP = {
  // Header rows (row 1 and 2)
  HEADER_ROW_1: 1,
  HEADER_ROW_2: 2,
  
  // CLO table starting row (after headers)
  CLO_START_ROW: 3,
  
  // Column mappings
  COLUMNS: {
    CLO_NUMBER: 'A',      // CLO1, CLO2, etc.
    CLO_DESC: 'B',        // CLO Description
    BLOOM_C: 'C',         // Cognitive (C)
    BLOOM_A: 'D',         // Affective (A)
    BLOOM_P: 'E',         // Psychomotor (P)
    BLOOM_S: 'F',         // Social (S)
    PLO_ASSESSED: 'G',    // PLO Assessed
    CLO_PLO_CORR: 'H'     // CLO-PLO Correlation
  }
};

/**
 * Read CourseProfile data - Read exactly 5 CLOs (CLO1-CLO5) as shown in user's table
 */
const readCourseProfile = async () => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(EXCEL_FILE_PATH);
  
  const worksheet = workbook.getWorksheet(SHEET_NAME);
  if (!worksheet) {
    throw new Error(`Sheet "${SHEET_NAME}" not found`);
  }

  const getCellValue = (cell) => {
    if (!cell || cell.value === null || cell.value === undefined) return '';
    if (typeof cell.value === 'object' && cell.value.result !== undefined) {
      return cell.value.result;
    }
    return cell.value.toString();
  };

  const clos = [];
  
  // Read exactly 5 CLOs (CLO1 to CLO5) - matching user's table structure
  for (let i = 0; i < 5; i++) {
    const rowIndex = CELL_MAP.CLO_START_ROW + i;
    const cloNumber = `CLO${i + 1}`;
    
    clos.push({
      cloNumber,
      description: getCellValue(worksheet.getCell(`${CELL_MAP.COLUMNS.CLO_DESC}${rowIndex}`)),
      bloomLevels: {
        cognitive: getCellValue(worksheet.getCell(`${CELL_MAP.COLUMNS.BLOOM_C}${rowIndex}`)),
        affective: getCellValue(worksheet.getCell(`${CELL_MAP.COLUMNS.BLOOM_A}${rowIndex}`)),
        psychomotor: getCellValue(worksheet.getCell(`${CELL_MAP.COLUMNS.BLOOM_P}${rowIndex}`)),
        social: getCellValue(worksheet.getCell(`${CELL_MAP.COLUMNS.BLOOM_S}${rowIndex}`))
      },
      ploAssessed: getCellValue(worksheet.getCell(`${CELL_MAP.COLUMNS.PLO_ASSESSED}${rowIndex}`)),
      cloPloCorrelation: getCellValue(worksheet.getCell(`${CELL_MAP.COLUMNS.CLO_PLO_CORR}${rowIndex}`)),
      rowIndex
    });
  }

  return clos;
};

/**
 * Update a specific CLO field
 */
const updateCLOField = async (cloNumber, field, value) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(EXCEL_FILE_PATH);
  
  const worksheet = workbook.getWorksheet(SHEET_NAME);
  if (!worksheet) {
    throw new Error(`Sheet "${SHEET_NAME}" not found`);
  }

  // Calculate row index directly from CLO number (CLO1->row 3, CLO2->row 4, etc.)
  const cloNum = parseInt(cloNumber.replace('CLO', ''));
  if (isNaN(cloNum) || cloNum < 1 || cloNum > 5) {
    throw new Error(`Invalid CLO number: ${cloNumber}. Must be CLO1-CLO5`);
  }
  
  const rowIndex = CELL_MAP.CLO_START_ROW + (cloNum - 1);

  // Update the appropriate field
  let column;
  switch (field) {
    case 'description':
      column = CELL_MAP.COLUMNS.CLO_DESC;
      break;
    case 'bloomC':
      column = CELL_MAP.COLUMNS.BLOOM_C;
      break;
    case 'bloomA':
      column = CELL_MAP.COLUMNS.BLOOM_A;
      break;
    case 'bloomP':
      column = CELL_MAP.COLUMNS.BLOOM_P;
      break;
    case 'bloomS':
      column = CELL_MAP.COLUMNS.BLOOM_S;
      break;
    case 'ploAssessed':
      column = CELL_MAP.COLUMNS.PLO_ASSESSED;
      break;
    case 'cloPloCorrelation':
      column = CELL_MAP.COLUMNS.CLO_PLO_CORR;
      break;
    default:
      throw new Error(`Invalid field: ${field}`);
  }

  const cell = worksheet.getCell(`${column}${rowIndex}`);
  cell.value = value;

  await workbook.xlsx.writeFile(EXCEL_FILE_PATH);
  return { success: true };
};

module.exports = {
  readCourseProfile,
  updateCLOField,
  CELL_MAP
};
