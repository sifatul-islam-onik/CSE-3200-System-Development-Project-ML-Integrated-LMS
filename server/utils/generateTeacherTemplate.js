const XLSX = require('xlsx');
const path = require('path');

// Generate sample teacher template Excel file
const generateTeacherTemplate = () => {
  const workbook = XLSX.utils.book_new();
  
  // Sample data
  const data = [
    {
      'Full Name': 'Dr. Ahmed Hassan Khan',
      'Name': 'Ahmed',
      'Dept': 'CSE'
    },
    {
      'Full Name': 'Prof. Fatima Amin',
      'Name': 'Fatima',
      'Dept': 'EEE'
    },
    {
      'Full Name': 'Mr. Bilal Ahmed Malik',
      'Name': 'Bilal',
      'Dept': 'ME'
    },
    {
      'Full Name': 'Dr. Sara Khan',
      'Name': 'Sara',
      'Dept': 'BTE'
    },
    {
      'Full Name': 'Prof. Muhammad Hasan',
      'Name': 'Hasan',
      'Dept': 'IPE'
    },
    {
      'Full Name': 'Dr. Aisha Ahmed',
      'Name': 'Aisha',
      'Dept': 'CE'
    }
  ];

  // Create worksheet
  const worksheet = XLSX.utils.json_to_sheet(data);

  // Set column widths
  worksheet['!cols'] = [
    { wch: 25 },  // Full Name
    { wch: 15 },  // Name
    { wch: 10 }   // Dept
  ];

  // Set header background color and bold font
  const headerCellStyle = {
    font: { bold: true, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '1e40af' } },
    alignment: { horizontal: 'center', vertical: 'center' }
  };

  // Apply header styles
  for (let i = 0; i < 3; i++) {
    const cellAddress = XLSX.utils.encode_cell({ r: 0, c: i });
    worksheet[cellAddress].s = headerCellStyle;
  }

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Teachers');

  // Save file
  const filePath = path.join(__dirname, '../../TEACHER_IMPORT_SAMPLE.xlsx');
  XLSX.write(workbook, { bookType: 'xlsx', type: 'file', cellFormula: false, file: filePath });
  
  console.log(`✅ Sample template created: ${filePath}`);
  return filePath;
};

// Run if executed directly
if (require.main === module) {
  try {
    generateTeacherTemplate();
  } catch (error) {
    console.error('Error generating template:', error);
    process.exit(1);
  }
}

module.exports = { generateTeacherTemplate };
