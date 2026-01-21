const ExcelJS = require('exceljs');
const path = require('path');

const EXCEL_FILE_PATH = path.join(__dirname, 'data/attainment.xlsx');

async function testExcelFile() {
  try {
    console.log('Testing Excel file at:', EXCEL_FILE_PATH);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(EXCEL_FILE_PATH);
    
    console.log('✅ File read successfully!');
    console.log('Number of sheets:', workbook.worksheets.length);
    console.log('Sheet names:', workbook.worksheets.map(ws => ws.name));
  } catch (error) {
    console.error('❌ Error reading file:', error.message);
    console.error('Error stack:', error.stack);
  }
}

testExcelFile();
