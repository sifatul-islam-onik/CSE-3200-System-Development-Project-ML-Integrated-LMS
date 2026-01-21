const ExcelJS = require('exceljs');
const path = require('path');

async function checkSheets() {
  const filePath = path.join(__dirname, 'data', 'attainment.xlsx');
  const workbook = new ExcelJS.Workbook();
  
  try {
    await workbook.xlsx.readFile(filePath);
    console.log('\n=== Sheets in attainment.xlsx ===');
    workbook.eachSheet((sheet, id) => {
      console.log(`  Sheet ${id}: "${sheet.name}"`);
    });
    console.log('\n');
  } catch (err) {
    console.error('Error:', err.message);
  }
}

checkSheets();
