const XLSX = require('xlsx');
const CTMarks = require('../models/CTMarks');
const Attendance = require('../models/Attendance');
const Assignment = require('../models/Assignment');
const FinalGrade = require('../models/FinalGrade');
const Course = require('../models/Course');
const User = require('../models/User');

/**
 * Export course marks to Excel (Accreditation Format)
 * GET /api/export/course/:courseId/marks
 * Query params: section, academicYear
 */
exports.exportCourseMarks = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { section, academicYear } = req.query;

    // Fetch course details
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    // Get enrolled students
    let students = [];
    if (section) {
      const sectionData = course.enrolledStudents?.find(s => s.section === section);
      students = sectionData?.students || [];
    } else {
      students = course.enrolledStudents?.[0]?.students || [];
    }

    // Populate student details
    const studentIds = students.map(s => s._id || s);
    const studentDetails = await User.find({ _id: { $in: studentIds } }).sort({ rollNo: 1 });

    // Fetch all marks data
    const filters = {
      course: courseId,
      academicYear: academicYear || new Date().getFullYear().toString(),
    };
    if (section) filters.section = section;

    const [ctMarks, attendance, assignments, grades] = await Promise.all([
      CTMarks.find(filters).populate('student', 'rollNo name email'),
      Attendance.find(filters).populate('student', 'rollNo name email'),
      Assignment.find({ course: courseId }),
      FinalGrade.find(filters).populate('student', 'rollNo name email'),
    ]);

    // Create workbook
    const workbook = XLSX.utils.book_new();

    // ==================== CT MARKS SHEET ====================
    const ctData = [];
    
    // Header Row 1 - Course Info
    ctData.push([
      'CT MARKS SHEET',
      '',
      '',
      `Course: ${course.courseCode} - ${course.courseTitle}`,
      '',
      '',
      section ? `Section: ${section}` : '',
      `Academic Year: ${academicYear || new Date().getFullYear()}`,
    ]);
    ctData.push([]); // Empty row

    // Determine number of CTs
    const ctNumbers = [...new Set(ctMarks.map(m => m.ctNumber))].sort((a, b) => a - b);
    const numCTs = ctNumbers.length || 5;

    // Header Row - Column Names
    const ctHeaders = ['S.No', 'Roll No', 'Student Name'];
    for (let i = 1; i <= numCTs; i++) {
      ctHeaders.push(`CT ${i}`);
    }
    ctHeaders.push('Total', 'Best ' + Math.max(numCTs - 1, 1), 'Percentage (%)');
    ctData.push(ctHeaders);

    // Data Rows
    studentDetails.forEach((student, index) => {
      const studentCTMarks = ctMarks.filter(
        m => m.student._id.toString() === student._id.toString()
      );

      const row = [
        index + 1,
        student.rollNo || 'N/A',
        student.name || 'N/A',
      ];

      // CT marks
      const ctValues = [];
      for (let i = 1; i <= numCTs; i++) {
        const mark = studentCTMarks.find(m => m.ctNumber === i);
        const value = mark ? mark.marksObtained : 0;
        row.push(value);
        if (value > 0) ctValues.push(value);
      }

      // Calculate Total, Best N-1, Percentage
      const total = ctValues.reduce((sum, v) => sum + v, 0);
      const best = ctValues.length > 1 ? total - Math.min(...ctValues) : total;
      const maxMarks = studentCTMarks[0]?.totalMarks || 20;
      const maxPossible = Math.max(numCTs - 1, 1) * maxMarks;
      const percentage = maxPossible > 0 ? (best / maxPossible) * 100 : 0;

      row.push(total, best, percentage.toFixed(2));
      ctData.push(row);
    });

    // Summary Row
    ctData.push([]);
    ctData.push(['Summary', '', `Total Students: ${studentDetails.length}`]);

    const ctSheet = XLSX.utils.aoa_to_sheet(ctData);
    
    // Set column widths
    ctSheet['!cols'] = [
      { wch: 6 },  // S.No
      { wch: 12 }, // Roll No
      { wch: 25 }, // Name
      ...Array(numCTs).fill({ wch: 10 }), // CTs
      { wch: 10 }, // Total
      { wch: 12 }, // Best
      { wch: 15 }, // Percentage
    ];

    XLSX.utils.book_append_sheet(workbook, ctSheet, 'CT Marks');

    // ==================== ATTENDANCE SHEET ====================
    const attData = [];
    
    // Header Row 1 - Course Info
    attData.push([
      'ATTENDANCE SHEET',
      '',
      '',
      `Course: ${course.courseCode} - ${course.courseTitle}`,
      '',
      section ? `Section: ${section}` : '',
      `Academic Year: ${academicYear || new Date().getFullYear()}`,
    ]);
    attData.push([]);

    // Header Row - Column Names
    attData.push(['S.No', 'Roll No', 'Student Name', 'Total Classes', 'Classes Attended', 'Attendance %', 'Marks Obtained', 'Max Marks', 'Status']);

    // Data Rows
    studentDetails.forEach((student, index) => {
      const attRecord = attendance.find(
        a => a.student._id.toString() === student._id.toString()
      );

      const totalClasses = attRecord?.totalClasses || 0;
      const attended = attRecord?.classesAttended || 0;
      const percentage = totalClasses > 0 ? (attended / totalClasses) * 100 : 0;
      const maxMarks = attRecord?.totalMarks || 10;
      const marks = (percentage * maxMarks) / 100;
      
      let status = 'Poor';
      if (percentage >= 90) status = 'Excellent';
      else if (percentage >= 75) status = 'Good';
      else if (percentage >= 60) status = 'Fair';

      attData.push([
        index + 1,
        student.rollNo || 'N/A',
        student.name || 'N/A',
        totalClasses,
        attended,
        percentage.toFixed(2),
        marks.toFixed(2),
        maxMarks,
        status,
      ]);
    });

    // Summary Row
    attData.push([]);
    const avgAttendance = studentDetails.length > 0
      ? attendance.reduce((sum, a) => {
          const pct = a.totalClasses > 0 ? (a.classesAttended / a.totalClasses) * 100 : 0;
          return sum + pct;
        }, 0) / studentDetails.length
      : 0;
    attData.push(['Summary', '', `Total Students: ${studentDetails.length}`, '', '', `Avg Attendance: ${avgAttendance.toFixed(2)}%`]);

    const attSheet = XLSX.utils.aoa_to_sheet(attData);
    attSheet['!cols'] = [
      { wch: 6 },  // S.No
      { wch: 12 }, // Roll No
      { wch: 25 }, // Name
      { wch: 14 }, // Total Classes
      { wch: 16 }, // Attended
      { wch: 14 }, // Percentage
      { wch: 16 }, // Marks
      { wch: 12 }, // Max Marks
      { wch: 12 }, // Status
    ];

    XLSX.utils.book_append_sheet(workbook, attSheet, 'Attendance');

    // ==================== ASSIGNMENTS SHEET ====================
    const asgData = [];
    
    // Header Row 1 - Course Info
    asgData.push([
      'ASSIGNMENTS SHEET',
      '',
      '',
      `Course: ${course.courseCode} - ${course.courseTitle}`,
      '',
      section ? `Section: ${section}` : '',
      `Academic Year: ${academicYear || new Date().getFullYear()}`,
    ]);
    asgData.push([]);

    // Get all assignments for this course
    const assignmentHeaders = ['S.No', 'Roll No', 'Student Name'];
    assignments.forEach((asg, idx) => {
      assignmentHeaders.push(`${asg.title} (${asg.totalMarks})`);
    });
    assignmentHeaders.push('Total Marks', 'Percentage (%)');
    asgData.push(assignmentHeaders);

    // Data Rows
    studentDetails.forEach((student, index) => {
      const row = [
        index + 1,
        student.rollNo || 'N/A',
        student.name || 'N/A',
      ];

      let totalObtained = 0;
      let totalPossible = 0;

      assignments.forEach(asg => {
        const grade = asg.grades?.find(
          g => g.student.toString() === student._id.toString()
        );
        const marks = grade?.marksObtained || 0;
        row.push(marks);
        totalObtained += marks;
        totalPossible += asg.totalMarks;
      });

      const percentage = totalPossible > 0 ? (totalObtained / totalPossible) * 100 : 0;
      row.push(totalObtained, percentage.toFixed(2));
      asgData.push(row);
    });

    // Summary Row
    asgData.push([]);
    asgData.push(['Summary', '', `Total Students: ${studentDetails.length}`, '', `Total Assignments: ${assignments.length}`]);

    const asgSheet = XLSX.utils.aoa_to_sheet(asgData);
    asgSheet['!cols'] = [
      { wch: 6 },  // S.No
      { wch: 12 }, // Roll No
      { wch: 25 }, // Name
      ...Array(assignments.length).fill({ wch: 15 }), // Assignments
      { wch: 12 }, // Total
      { wch: 15 }, // Percentage
    ];

    XLSX.utils.book_append_sheet(workbook, asgSheet, 'Assignments');

    // ==================== FINAL GRADES SHEET ====================
    const gradeData = [];
    
    // Header Row 1 - Course Info
    gradeData.push([
      'FINAL GRADES SHEET',
      '',
      '',
      `Course: ${course.courseCode} - ${course.courseTitle}`,
      '',
      section ? `Section: ${section}` : '',
      `Academic Year: ${academicYear || new Date().getFullYear()}`,
    ]);
    gradeData.push([]);

    // Header Row - Column Names
    gradeData.push([
      'S.No',
      'Roll No',
      'Student Name',
      'CT Marks',
      'Attendance',
      'Assignment',
      'Term Exam',
      'Total (100)',
      'Percentage (%)',
      'Letter Grade',
      'GPA (4.0)',
      'Status',
    ]);

    // Data Rows
    studentDetails.forEach((student, index) => {
      const gradeRecord = grades.find(
        g => g.student._id.toString() === student._id.toString()
      );

      const ctMarks = gradeRecord?.ctMarks || 0;
      const attMarks = gradeRecord?.attendanceMarks || 0;
      const asgMarks = gradeRecord?.assignmentMarks || 0;
      const termMarks = gradeRecord?.termExamMarks || 0;
      const total = gradeRecord?.totalMarks || 0;
      const percentage = gradeRecord?.percentage || 0;
      const letterGrade = gradeRecord?.letterGrade || 'F';
      const gpa = gradeRecord?.gpa || 0;
      const status = gradeRecord?.isFinalized ? 'Finalized' : 'Draft';

      gradeData.push([
        index + 1,
        student.rollNo || 'N/A',
        student.name || 'N/A',
        ctMarks,
        attMarks,
        asgMarks,
        termMarks,
        total,
        percentage.toFixed(2),
        letterGrade,
        gpa.toFixed(2),
        status,
      ]);
    });

    // Summary Row
    gradeData.push([]);
    const avgGPA = grades.length > 0
      ? grades.reduce((sum, g) => sum + (g.gpa || 0), 0) / grades.length
      : 0;
    gradeData.push([
      'Summary',
      '',
      `Total Students: ${studentDetails.length}`,
      '',
      '',
      '',
      '',
      '',
      '',
      `Avg GPA: ${avgGPA.toFixed(2)}`,
    ]);

    // Grade Distribution
    gradeData.push([]);
    gradeData.push(['Grade Distribution']);
    const gradeDistribution = {};
    grades.forEach(g => {
      const grade = g.letterGrade || 'F';
      gradeDistribution[grade] = (gradeDistribution[grade] || 0) + 1;
    });
    Object.entries(gradeDistribution).forEach(([grade, count]) => {
      gradeData.push(['', grade, count]);
    });

    const gradeSheet = XLSX.utils.aoa_to_sheet(gradeData);
    gradeSheet['!cols'] = [
      { wch: 6 },  // S.No
      { wch: 12 }, // Roll No
      { wch: 25 }, // Name
      { wch: 10 }, // CT
      { wch: 12 }, // Attendance
      { wch: 12 }, // Assignment
      { wch: 12 }, // Term Exam
      { wch: 12 }, // Total
      { wch: 14 }, // Percentage
      { wch: 14 }, // Letter Grade
      { wch: 12 }, // GPA
      { wch: 12 }, // Status
    ];

    XLSX.utils.book_append_sheet(workbook, gradeSheet, 'Final Grades');

    // ==================== WRITE TO BUFFER AND SEND ====================
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // Set headers for download
    const filename = `${course.courseCode}_${section || 'All'}_Marks_${academicYear || new Date().getFullYear()}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);

    res.send(buffer);
  } catch (error) {
    console.error('Error exporting marks:', error);
    res.status(500).json({
      message: 'Failed to export marks',
      error: error.message,
    });
  }
};

/**
 * Export individual component (CT, Attendance, Assignment, or Grades)
 * GET /api/export/course/:courseId/:component
 * Query params: section, academicYear
 * Component: ct | attendance | assignment | grades
 */
exports.exportComponent = async (req, res) => {
  try {
    const { courseId, component } = req.params;
    const { section, academicYear } = req.query;

    // Validate component
    const validComponents = ['ct', 'attendance', 'assignment', 'grades'];
    if (!validComponents.includes(component)) {
      return res.status(400).json({ message: 'Invalid component. Use: ct, attendance, assignment, or grades' });
    }

    // Fetch course details
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    // Get enrolled students
    let students = [];
    if (section) {
      const sectionData = course.enrolledStudents?.find(s => s.section === section);
      students = sectionData?.students || [];
    } else {
      students = course.enrolledStudents?.[0]?.students || [];
    }

    const studentIds = students.map(s => s._id || s);
    const studentDetails = await User.find({ _id: { $in: studentIds } }).sort({ rollNo: 1 });

    const filters = {
      course: courseId,
      academicYear: academicYear || new Date().getFullYear().toString(),
    };
    if (section) filters.section = section;

    const workbook = XLSX.utils.book_new();
    let data = [];
    let sheetName = '';

    switch (component) {
      case 'ct':
        const ctMarks = await CTMarks.find(filters).populate('student', 'rollNo name email');
        const ctNumbers = [...new Set(ctMarks.map(m => m.ctNumber))].sort((a, b) => a - b);
        const numCTs = ctNumbers.length || 5;

        data.push(['CT MARKS SHEET', '', `Course: ${course.courseCode}`, section ? `Section: ${section}` : '']);
        data.push([]);
        
        const ctHeaders = ['S.No', 'Roll No', 'Student Name'];
        for (let i = 1; i <= numCTs; i++) ctHeaders.push(`CT ${i}`);
        ctHeaders.push('Total', 'Best', 'Percentage (%)');
        data.push(ctHeaders);

        studentDetails.forEach((student, index) => {
          const studentCTMarks = ctMarks.filter(m => m.student._id.toString() === student._id.toString());
          const row = [index + 1, student.rollNo, student.name];
          
          const ctValues = [];
          for (let i = 1; i <= numCTs; i++) {
            const mark = studentCTMarks.find(m => m.ctNumber === i);
            const value = mark ? mark.marksObtained : 0;
            row.push(value);
            if (value > 0) ctValues.push(value);
          }

          const total = ctValues.reduce((sum, v) => sum + v, 0);
          const best = ctValues.length > 1 ? total - Math.min(...ctValues) : total;
          const maxMarks = studentCTMarks[0]?.totalMarks || 20;
          const maxPossible = Math.max(numCTs - 1, 1) * maxMarks;
          const percentage = maxPossible > 0 ? (best / maxPossible) * 100 : 0;

          row.push(total, best, percentage.toFixed(2));
          data.push(row);
        });

        sheetName = 'CT Marks';
        break;

      case 'attendance':
        const attendance = await Attendance.find(filters).populate('student', 'rollNo name email');
        
        data.push(['ATTENDANCE SHEET', '', `Course: ${course.courseCode}`, section ? `Section: ${section}` : '']);
        data.push([]);
        data.push(['S.No', 'Roll No', 'Student Name', 'Total Classes', 'Attended', 'Percentage', 'Marks', 'Status']);

        studentDetails.forEach((student, index) => {
          const attRecord = attendance.find(a => a.student._id.toString() === student._id.toString());
          const totalClasses = attRecord?.totalClasses || 0;
          const attended = attRecord?.classesAttended || 0;
          const percentage = totalClasses > 0 ? (attended / totalClasses) * 100 : 0;
          const maxMarks = attRecord?.totalMarks || 10;
          const marks = (percentage * maxMarks) / 100;
          let status = percentage >= 90 ? 'Excellent' : percentage >= 75 ? 'Good' : percentage >= 60 ? 'Fair' : 'Poor';

          data.push([index + 1, student.rollNo, student.name, totalClasses, attended, percentage.toFixed(2), marks.toFixed(2), status]);
        });

        sheetName = 'Attendance';
        break;

      case 'assignment':
        const assignments = await Assignment.find({ course: courseId });
        
        data.push(['ASSIGNMENTS SHEET', '', `Course: ${course.courseCode}`, section ? `Section: ${section}` : '']);
        data.push([]);
        
        const asgHeaders = ['S.No', 'Roll No', 'Student Name'];
        assignments.forEach(asg => asgHeaders.push(`${asg.title} (${asg.totalMarks})`));
        asgHeaders.push('Total', 'Percentage');
        data.push(asgHeaders);

        studentDetails.forEach((student, index) => {
          const row = [index + 1, student.rollNo, student.name];
          let totalObtained = 0, totalPossible = 0;

          assignments.forEach(asg => {
            const grade = asg.grades?.find(g => g.student.toString() === student._id.toString());
            const marks = grade?.marksObtained || 0;
            row.push(marks);
            totalObtained += marks;
            totalPossible += asg.totalMarks;
          });

          const percentage = totalPossible > 0 ? (totalObtained / totalPossible) * 100 : 0;
          row.push(totalObtained, percentage.toFixed(2));
          data.push(row);
        });

        sheetName = 'Assignments';
        break;

      case 'grades':
        const grades = await FinalGrade.find(filters).populate('student', 'rollNo name email');
        
        data.push(['FINAL GRADES SHEET', '', `Course: ${course.courseCode}`, section ? `Section: ${section}` : '']);
        data.push([]);
        data.push(['S.No', 'Roll No', 'Student Name', 'CT', 'Attendance', 'Assignment', 'Term Exam', 'Total', 'Percentage', 'Grade', 'GPA']);

        studentDetails.forEach((student, index) => {
          const gradeRecord = grades.find(g => g.student._id.toString() === student._id.toString());
          data.push([
            index + 1,
            student.rollNo,
            student.name,
            gradeRecord?.ctMarks || 0,
            gradeRecord?.attendanceMarks || 0,
            gradeRecord?.assignmentMarks || 0,
            gradeRecord?.termExamMarks || 0,
            gradeRecord?.totalMarks || 0,
            (gradeRecord?.percentage || 0).toFixed(2),
            gradeRecord?.letterGrade || 'F',
            (gradeRecord?.gpa || 0).toFixed(2),
          ]);
        });

        sheetName = 'Final Grades';
        break;
    }

    const sheet = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, sheet, sheetName);

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const filename = `${course.courseCode}_${component}_${section || 'All'}_${academicYear || new Date().getFullYear()}.xlsx`;
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    console.error('Error exporting component:', error);
    res.status(500).json({ message: 'Failed to export', error: error.message });
  }
};
