const ExcelJS = require('exceljs');
const path = require('path');

const EXCEL_FILE_PATH = path.join(__dirname, '../data/attainment.xlsx');
const SHEET_NAME = 'CourseProfile';

async function initializeCourseProfile() {
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(EXCEL_FILE_PATH);
    
    let worksheet = workbook.getWorksheet(SHEET_NAME);
    
    // Create sheet if it doesn't exist
    if (!worksheet) {
      worksheet = workbook.addWorksheet(SHEET_NAME);
    }

    // Set up headers - Row 1
    worksheet.getCell('A1').value = 'CLOs';
    worksheet.getCell('B1').value = 'CLO Description';
    worksheet.getCell('C1').value = "Bloom's Learning Levels";
    
    // Try to merge cells, but skip if already merged
    try {
      worksheet.mergeCells('C1:F1'); // Merge C1 to F1
    } catch (e) {
      // Already merged, skip
    }
    
    worksheet.getCell('G1').value = 'PLO Assessed';
    worksheet.getCell('H1').value = 'CLO-PLO Correlation';

    // Set up sub-headers - Row 2
    worksheet.getCell('C2').value = 'C';
    worksheet.getCell('D2').value = 'A';
    worksheet.getCell('E2').value = 'P';
    worksheet.getCell('F2').value = 'S';

    // Style headers
    const headerStyle = {
      font: { bold: true, size: 11 },
      alignment: { vertical: 'middle', horizontal: 'center' },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } },
      border: {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      }
    };

    ['A1', 'B1', 'C1', 'G1', 'H1'].forEach(cell => {
      Object.assign(worksheet.getCell(cell), headerStyle);
    });

    ['C2', 'D2', 'E2', 'F2'].forEach(cell => {
      Object.assign(worksheet.getCell(cell), headerStyle);
    });

    // Add CLO1-CLO5 in column A (rows 3-7)
    for (let i = 1; i <= 5; i++) {
      const row = 2 + i; // Row 3-7
      const cell = worksheet.getCell(`A${row}`);
      cell.value = `CLO${i}`;
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    }

    // Set column widths
    worksheet.getColumn('A').width = 10;
    worksheet.getColumn('B').width = 50;
    worksheet.getColumn('C').width = 8;
    worksheet.getColumn('D').width = 8;
    worksheet.getColumn('E').width = 8;
    worksheet.getColumn('F').width = 8;
    worksheet.getColumn('G').width = 15;
    worksheet.getColumn('H').width = 20;

    // Add borders to all cells in the table (rows 3-7, columns A-H)
    for (let row = 3; row <= 7; row++) {
      for (let col = 1; col <= 8; col++) {
        const cell = worksheet.getCell(row, col);
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      }
    }

    await workbook.xlsx.writeFile(EXCEL_FILE_PATH);
    console.log('✅ CourseProfile sheet initialized successfully!');
  } catch (error) {
    console.error('❌ Error initializing CourseProfile:', error.message);
  }
}

initializeCourseProfile();
