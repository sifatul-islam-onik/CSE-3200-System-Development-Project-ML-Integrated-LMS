const {
  readAttainmentData,
  writeStudentPoValue,
  batchUpdateStudentPoValues,
  getSheetNames
} = require('../utils/attainmentExcelUtil');
const Course = require('../models/Course');
const CTAttainment = require('../models/CTAttainment');
const AssignmentAttainment = require('../models/AssignmentAttainment');
const LabActivityAttainment = require('../models/LabActivityAttainment');
const TermExamMarks = require('../models/TermExamMarks');
const TermExamAttainment = require('../models/TermExamAttainment');

/**
 * Get teacher's assigned courses
 */
const getTeacherCourses = async (teacherId) => {
  const courses = await Course.find({
    'assignedTeachers.teacher': teacherId
  }).select('courseCode courseTitle assignedTeachers assignedBatches').lean();
  
  return courses.map(course => {
    const assignment = course.assignedTeachers.find(
      a => (a.teacher._id || a.teacher).toString() === teacherId.toString()
    );
    return {
      _id: course._id,  // Include the course ID
      courseCode: course.courseCode,
      courseTitle: course.courseTitle,
      section: assignment?.section || null,
      assignedBatches: Array.isArray(course.assignedBatches) ? course.assignedBatches : []
    };
  });
};

/**
 * Get attainment data for a specific sheet
 * GET /api/attainment/:sheetName?
 */
exports.getAttainmentData = async (req, res) => {
  try {
    const { sheetName } = req.params;
    const data = await readAttainmentData(sheetName || null);
    
    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error reading attainment data:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get list of all sheet names
 * GET /api/attainment/sheets
 */
exports.getSheets = async (req, res) => {
  try {
    const allSheets = await getSheetNames();
    
    // For teachers, return all sheets (filtering will happen on the frontend based on course metadata)
    // or admin sees all sheets directly
    if (req.user.role === 'teacher') {
      const teacherCourses = await getTeacherCourses(req.user._id);
      
      res.json({
        success: true,
        sheets: allSheets,  // Return all sheets for now
        courses: teacherCourses // Send course info for reference
      });
    } else {
      // Admins and students see all sheets
      res.json({
        success: true,
        sheets: allSheets
      });
    }
  } catch (error) {
    console.error('Error reading sheet names:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Update single student PO value
 * PUT /api/attainment/update
 * Body: { sheetName, rollNumber, poNumber, value }
 */
exports.updateStudentPoValue = async (req, res) => {
  try {
    const { sheetName, rollNumber, poNumber, value } = req.body;
    
    // Validate required fields
    if (!rollNumber || !poNumber) {
      return res.status(400).json({
        success: false,
        error: 'rollNumber and poNumber are required'
      });
    }
    
    const result = await writeStudentPoValue(
      sheetName || null,
      rollNumber,
      poNumber,
      value
    );
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error updating student PO value:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Batch update multiple student PO values
 * PUT /api/attainment/batch-update
 * Body: { sheetName, updates: [{rollNumber, poNumber, value}] }
 */
exports.batchUpdateStudentPoValues = async (req, res) => {
  try {
    const { sheetName, updates } = req.body;
    
    // Validate required fields
    if (!updates || !Array.isArray(updates)) {
      return res.status(400).json({
        success: false,
        error: 'updates array is required'
      });
    }
    
    const results = await batchUpdateStudentPoValues(
      sheetName || null,
      updates
    );
    
    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('Error batch updating student PO values:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Save CT attainment data
 * POST /api/attainment/ct/:courseId
 */
exports.saveCTData = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { ctRows, ctFactors, ctManualWts, ctEqWts, ctSummary, ctObtainedRows } = req.body;

    // Verify course exists and user has access
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // For teachers, verify they are assigned to this course
    if (req.user.role === 'teacher') {
      const isAssigned = course.assignedTeachers.some(assignment => {
        const teacherId = assignment.teacher?._id || assignment.teacher;
        return teacherId.toString() === req.user._id.toString();
      });

      if (!isAssigned) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You are not assigned to this course.'
        });
      }
    }

    // Update or create CT attainment data
    const ctData = await CTAttainment.findOneAndUpdate(
      { course: courseId },
      {
        course: courseId,
        ctRows,
        ctFactors,
        ctManualWts,
        ctEqWts,
        ctSummary,
        ctObtainedRows,
        updatedBy: req.user._id
      },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      message: 'CT data saved successfully',
      data: ctData
    });
  } catch (error) {
    console.error('Error saving CT data:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get CT attainment data
 * GET /api/attainment/ct/:courseId
 */
exports.getCTData = async (req, res) => {
  try {
    const { courseId } = req.params;

    // Parallel course check and CT data fetch for better performance
    const [course, ctData] = await Promise.all([
      Course.findById(courseId).select('assignedTeachers').lean(),
      CTAttainment.findOne({ course: courseId }).lean()
    ]);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // For teachers, verify they are assigned to this course
    if (req.user.role === 'teacher') {
      const isAssigned = course.assignedTeachers.some(assignment => {
        const teacherId = assignment.teacher?._id || assignment.teacher;
        return teacherId.toString() === req.user._id.toString();
      });

      if (!isAssigned) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You are not assigned to this course.'
        });
      }
    }

    if (!ctData) {
      return res.json({
        success: true,
        message: 'No CT data found',
        data: null
      });
    }

    res.json({
      success: true,
      data: ctData
    });
  } catch (error) {
    console.error('Error getting CT data:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Parse an uploaded CT Excel/CSV file and return structured data
 * POST /api/attainment/ct/:courseId/parse-upload
 * Accepts multipart file upload. File format:
 *   Row 1: "Manual Wt" | <value>
 *   Row 2: "Roll" | "Q1(<total>)" | "Q2(<total>)" | "Q3(<total>)"
 *   Row 3+: rollNumber | q1Val | q2Val | q3Val
 */
exports.parseCTUpload = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const { courseId } = req.params;

    const course = await Course.findById(courseId).select('assignedTeachers').lean();
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    if (req.user.role === 'teacher') {
      const isAssigned = course.assignedTeachers.some(assignment => {
        const teacherId = assignment.teacher?._id || assignment.teacher;
        return teacherId.toString() === req.user._id.toString();
      });
      if (!isAssigned) {
        return res.status(403).json({ success: false, message: 'Access denied.' });
      }
    }

    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();

    const fileName = req.file.originalname.toLowerCase();
    const isCSV = fileName.endsWith('.csv') || req.file.mimetype === 'text/csv' || req.file.mimetype === 'application/csv';

    if (isCSV) {
      const { Readable } = require('stream');
      const stream = Readable.from(req.file.buffer.toString('utf-8'));
      await workbook.csv.read(stream);
    } else {
      await workbook.xlsx.load(req.file.buffer);
    }

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return res.status(400).json({ success: false, message: 'No worksheet found in file' });
    }

    const totalRows = worksheet.rowCount;
    let manualWt = 0;
    let q1Total = 0, q2Total = 0, q3Total = 0;
    let q1CO = null, q2CO = null, q3CO = null;
    let dataStartRow = -1;

    const extractTotal = (cellValue) => {
      const str = (cellValue == null ? '' : cellValue).toString();
      const match = str.match(/\((\d+(?:\.\d+)?)\)/);
      return match ? parseFloat(match[1]) : 0;
    };

    // Extract CO label from format like "Q1(5)(CO1)" or "Q1(5)(CLO1)" → "CO1"
    const extractCO = (cellValue) => {
      const str = (cellValue == null ? '' : cellValue).toString();
      const matches = [...str.matchAll(/\(([^)]+)\)/g)];
      // Second parenthetical group holds the CO/CLO label
      if (matches.length >= 2) {
        const co = matches[1][1].trim();
        if (!co) return null;
        // Normalize CLO → CO so it matches coNumber keys in ctRows
        return co.replace(/^CLO/i, 'CO');
      }
      return null;
    };

    // Scan rows to find Manual Wt row and the header row with "Roll"
    for (let r = 1; r <= totalRows; r++) {
      const row = worksheet.getRow(r);
      const col1 = (row.getCell(1).value == null ? '' : row.getCell(1).value).toString().trim();
      const col2 = row.getCell(2).value;

      if (col1.toLowerCase() === 'manual wt') {
        manualWt = parseFloat(col2) || 0;
        continue;
      }

      // The header row has "Roll" in col A and Q labels in cols 2-4
      if (col1.toLowerCase() === 'roll') {
        q1Total = extractTotal(row.getCell(2).value);
        q2Total = extractTotal(row.getCell(3).value);
        q3Total = extractTotal(row.getCell(4).value);
        q1CO = extractCO(row.getCell(2).value);
        q2CO = extractCO(row.getCell(3).value);
        q3CO = extractCO(row.getCell(4).value);
        dataStartRow = r + 1;
        break;
      }
    }

    if (dataStartRow === -1) {
      return res.status(400).json({ success: false, message: 'Could not find header row with "Roll" column in file' });
    }

    // Data rows - skip empty rows, stop only when we've hit 5 consecutive empty rows
    const rows = [];
    let emptyStreak = 0;
    for (let rowNum = dataStartRow; rowNum <= totalRows; rowNum++) {
      const dataRow = worksheet.getRow(rowNum);
      const rawRoll = dataRow.getCell(1).value;
      if (rawRoll === null || rawRoll === undefined || rawRoll === '') {
        emptyStreak++;
        if (emptyStreak >= 5) break;
        continue;
      }
      emptyStreak = 0;
      const rollStr = rawRoll.toString().trim();
      if (!rollStr || rollStr.toLowerCase() === 'roll') continue;
      const parseCTCellValue = (raw) => {
        if (raw === null || raw === undefined) return 0;
        const str = raw.toString().trim();
        if (str.toLowerCase() === 'a') return 'A';
        return parseFloat(str) || 0;
      };
      rows.push({
        rollNumber: rollStr,
        q1: parseCTCellValue(dataRow.getCell(2).value),
        q2: parseCTCellValue(dataRow.getCell(3).value),
        q3: parseCTCellValue(dataRow.getCell(4).value),
      });
    }

    return res.json({
      success: true,
      data: { manualWt, q1Total, q2Total, q3Total, q1CO, q2CO, q3CO, rows }
    });
  } catch (error) {
    console.error('Error parsing CT upload:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Get term exam marks for attainment calculations
 * GET /api/attainment/term/:courseId
 */
exports.getTermExamMarks = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { section } = req.query;

    // Build query
    const query = { course: courseId };
    if (section) {
      query.section = section;
    }

    // Parallel fetch for better performance
    const [course, termMarks] = await Promise.all([
      Course.findById(courseId).select('assignedTeachers').lean(),
      TermExamMarks.find(query)
        .populate('student', 'name roll email')
        .populate('enteredBy', 'name email')
        .sort({ 'student.roll': 1 })
        .lean()
    ]);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // For teachers, verify they are assigned to this course
    if (req.user.role === 'teacher') {
      const isAssigned = course.assignedTeachers.some(assignment => {
        const teacherId = assignment.teacher?._id || assignment.teacher;
        const matches = teacherId.toString() === req.user._id.toString();
        // If section is provided, also check section match
        if (section && matches) {
          return assignment.section === section;
        }
        return matches;
      });

      if (!isAssigned) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You are not assigned to this course.'
        });
      }
    }

    // Format the data for attainment calculations
    // Convert Map to plain object for Section A/B (only a, b, c, d rows needed, ignore e, f, g)
    const formattedMarks = termMarks.map(mark => {
      // Convert marks Map/Object to plain object - handles nested Maps from .lean()
      const marksObj = {};
      
      // When using .lean(), Maps become plain objects, but we need to ensure proper structure
      const sourceMarks = mark.marks;
      
      if (sourceMarks) {
        // Handle both Map and Object cases
        const marksEntries = sourceMarks instanceof Map ? 
          Array.from(sourceMarks.entries()) : 
          Object.entries(sourceMarks);
        
        for (const [key, value] of marksEntries) {
          // Only include a, b, c, d rows (ignore e, f, g)
          if (['a', 'b', 'c', 'd'].includes(key)) {
            marksObj[key] = {};
            
            // Handle nested Map or Object
            const questionEntries = value instanceof Map ? 
              Array.from(value.entries()) : 
              Object.entries(value || {});
            
            for (const [qKey, qVal] of questionEntries) {
              // Include all questions (1-8: 1-4 for Section A, 5-8 for Section B)
              marksObj[key][qKey] = qVal;
            }
          }
        }
      }
      
      return {
        student: {
          _id: mark.student._id,
          roll: mark.student.roll,
          rollNumber: mark.student.roll,
          name: mark.student.name,
          email: mark.student.email
        },
        rollNumber: mark.student.roll, // Also provide at top level for convenience
        section: mark.section,
        marks: marksObj, // Only a, b, c, d rows (not e, f, g)
        totalMarks: mark.totalMarks,
        imageUrl: mark.imageUrl,
        enteredBy: mark.enteredBy,
        lastModified: mark.lastModified
      };
    });

    console.log('[getTermExamMarks] Returning', formattedMarks.length, 'records');
    if (formattedMarks.length > 0) {
      console.log('[getTermExamMarks] Sample record:', {
        rollNumber: formattedMarks[0].rollNumber,
        marksKeys: Object.keys(formattedMarks[0].marks || {}),
        sampleMarks: JSON.stringify(formattedMarks[0].marks, null, 2),
        aKeys: formattedMarks[0].marks?.a ? Object.keys(formattedMarks[0].marks.a) : 'N/A',
        aValue1: formattedMarks[0].marks?.a?.['1']
      });
    }

    res.json({
      success: true,
      count: formattedMarks.length,
      data: formattedMarks
    });
  } catch (error) {
    console.error('Error getting term exam marks for attainment:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Save Assignment/Attendance attainment data
 * POST /api/attainment/assignment/:courseId
 */
exports.saveAssignmentData = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { assignmentRows, assignmentManualWts, assignmentSummary, attendanceMarks, attnAssignObtainedRows } = req.body;

    // Verify course exists and user has access
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // For teachers, verify they are assigned to this course
    if (req.user.role === 'teacher') {
      const isAssigned = course.assignedTeachers.some(assignment => {
        const teacherId = assignment.teacher?._id || assignment.teacher;
        return teacherId.toString() === req.user._id.toString();
      });

      if (!isAssigned) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You are not assigned to this course.'
        });
      }
    }

    // Update or create Assignment attainment data
    const assignmentData = await AssignmentAttainment.findOneAndUpdate(
      { course: courseId },
      {
        course: courseId,
        assignmentRows,
        assignmentManualWts,
        assignmentSummary,
        attendanceMarks,
        attnAssignObtainedRows,
        updatedBy: req.user._id
      },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      message: 'Assignment/Attendance data saved successfully',
      data: assignmentData
    });
  } catch (error) {
    console.error('Error saving assignment data:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get Assignment/Attendance attainment data
 * GET /api/attainment/assignment/:courseId
 */
exports.getAssignmentData = async (req, res) => {
  try {
    const { courseId } = req.params;

    // Parallel course check and assignment data fetch for better performance
    const [course, assignmentData] = await Promise.all([
      Course.findById(courseId).select('assignedTeachers').lean(),
      AssignmentAttainment.findOne({ course: courseId }).lean()
    ]);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // For teachers, verify they are assigned to this course
    if (req.user.role === 'teacher') {
      const isAssigned = course.assignedTeachers.some(assignment => {
        const teacherId = assignment.teacher?._id || assignment.teacher;
        return teacherId.toString() === req.user._id.toString();
      });

      if (!isAssigned) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You are not assigned to this course.'
        });
      }
    }

    // Return data if found, otherwise return empty structure
    if (!assignmentData) {
      return res.json({
        success: true,
        data: null
      });
    }

    res.json({
      success: true,
      data: assignmentData
    });
  } catch (error) {
    console.error('Error getting assignment data:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Save Lab Activity attainment data
 * POST /api/attainment/labactivity/:courseId
 */
exports.saveLabActivityData = async (req, res) => {
  try {
    const { courseId } = req.params;
    console.log('[saveLabActivityData] Received request for courseId:', courseId);
    console.log('[saveLabActivityData] Request body keys:', Object.keys(req.body));
    console.log('[saveLabActivityData] labActivityObtainedRows count:', req.body.labActivityObtainedRows?.length);
    
    const {
      labActivityRows,
      labActivityFactors,
      labActivityEqWts,
      labActivityManualWts,
      labAttendanceMarks,
      labQuizMarks,
      labVivaMarks,
      activityTaken,
      otherActivityRemaining,
      otherActivityMeasured,
      coMappedActivityMarks,
      useEqWtActivity,
      labActivityObtainedRows
    } = req.body;

    // Verify course exists and user has access
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // For teachers, verify they are assigned to this course
    if (req.user.role === 'teacher') {
      const isAssigned = course.assignedTeachers.some(assignment => {
        const teacherId = assignment.teacher?._id || assignment.teacher;
        return teacherId.toString() === req.user._id.toString();
      });

      if (!isAssigned) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You are not assigned to this course.'
        });
      }
    }

    // Update or create Lab Activity attainment data
    const labActivityData = await LabActivityAttainment.findOneAndUpdate(
      { course: courseId },
      {
        course: courseId,
        labActivityRows,
        labActivityFactors,
        labActivityEqWts,
        labActivityManualWts,
        labAttendanceMarks,
        labQuizMarks,
        labVivaMarks,
        activityTaken,
        otherActivityRemaining,
        otherActivityMeasured,
        coMappedActivityMarks,
        useEqWtActivity,
        labActivityObtainedRows,
        updatedBy: req.user._id
      },
      { upsert: true, new: true }
    );

    console.log('[saveLabActivityData] Successfully saved data for courseId:', courseId);

    res.json({
      success: true,
      message: 'Lab Activity data saved successfully',
      data: labActivityData
    });
  } catch (error) {
    console.error('Error saving lab activity data:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get Lab Activity attainment data
 * GET /api/attainment/labactivity/:courseId
 */
exports.getLabActivityData = async (req, res) => {
  try {
    const { courseId } = req.params;
    console.log('[getLabActivityData] Fetching data for courseId:', courseId);

    // Parallel course check and lab activity data fetch for better performance
    const [course, labActivityData] = await Promise.all([
      Course.findById(courseId).select('assignedTeachers').lean(),
      LabActivityAttainment.findOne({ course: courseId }).lean()
    ]);

    if (!course) {
      console.log('[getLabActivityData] Course not found:', courseId);
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // For teachers, verify they are assigned to this course
    if (req.user.role === 'teacher') {
      const isAssigned = course.assignedTeachers.some(assignment => {
        const teacherId = assignment.teacher?._id || assignment.teacher;
        return teacherId.toString() === req.user._id.toString();
      });

      if (!isAssigned) {
        console.log('[getLabActivityData] Access denied for teacher:', req.user._id);
        return res.status(403).json({
          success: false,
          message: 'Access denied. You are not assigned to this course.'
        });
      }
    }

    // Return data if found, otherwise return empty structure
    if (!labActivityData) {
      console.log('[getLabActivityData] No data found for courseId:', courseId);
      return res.json({
        success: true,
        data: null
      });
    }

    console.log('[getLabActivityData] Found data for courseId:', courseId);
    console.log('[getLabActivityData] labActivityObtainedRows count:', labActivityData.labActivityObtainedRows?.length);
    console.log('[getLabActivityData] First obtained row:', labActivityData.labActivityObtainedRows?.[0]);

    res.json({
      success: true,
      data: labActivityData
    });
  } catch (error) {
    console.error('Error getting lab activity data:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Save Section A attainment data
 * POST /api/attainment/section-a/:courseId
 */
exports.saveSectionAData = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { sectionARows, sectionAObtainedRows, sectionBRows, sectionBObtainedRows } = req.body;

    console.log('[saveSectionAData] Received request for courseId:', courseId);
    console.log('[saveSectionAData] Request body keys:', Object.keys(req.body));
    console.log('[saveSectionAData] Section A rows:', sectionARows?.length);
    console.log('[saveSectionAData] Section B rows:', sectionBRows?.length);

    // Verify course exists and user has access
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // For teachers, verify they are assigned to this course
    if (req.user.role === 'teacher') {
      const isAssigned = course.assignedTeachers.some(assignment => {
        const teacherId = assignment.teacher?._id || assignment.teacher;
        return teacherId.toString() === req.user._id.toString();
      });

      if (!isAssigned) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You are not assigned to this course.'
        });
      }
    }

    // Update or create Section A & B attainment data
    const sectionData = await TermExamAttainment.findOneAndUpdate(
      { course: courseId },
      {
        course: courseId,
        sectionARows,
        sectionAObtainedRows,
        sectionBRows,
        sectionBObtainedRows,
        updatedBy: req.user._id
      },
      { upsert: true, new: true }
    );

    console.log('[saveSectionAData] Successfully saved data for courseId:', courseId);

    res.json({
      success: true,
      message: 'Section A & B data saved successfully',
      data: sectionData
    });
  } catch (error) {
    console.error('Error saving Section A data:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get Section A attainment data for a course
 * GET /api/attainment/section-a/:courseId
 */
exports.getSectionAData = async (req, res) => {
  try {
    const { courseId } = req.params;

    // Parallel course check and section A/B data fetch for better performance
    // IMPORTANT: Section A uses questions 1-4, Section B uses questions 5-8
    const [course, sectionAData, termExamMarksA, termExamMarksB] = await Promise.all([
      Course.findById(courseId).select('assignedTeachers').lean(),
      TermExamAttainment.findOne({ course: courseId }).lean(),
      TermExamMarks.find({ course: courseId, section: 'A' }).populate('student', 'roll name').lean(),
      TermExamMarks.find({ course: courseId, section: 'B' }).populate('student', 'roll name').lean()
    ]);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // For teachers, verify they are assigned to this course
    if (req.user.role === 'teacher') {
      const isAssigned = course.assignedTeachers.some(assignment => {
        const teacherId = assignment.teacher?._id || assignment.teacher;
        return teacherId.toString() === req.user._id.toString();
      });

      if (!isAssigned) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You are not assigned to this course.'
        });
      }
    }

    // Transform TermExamMarks data to sectionAObtainedRows and sectionBObtainedRows format
    // IMPORTANT: Both sections use questions 1-4, differentiated by section field in database
    let sectionAObtainedRows = [];
    let sectionBObtainedRows = [];
    
    // Process Section A records (section='A', questions 1-4)
    if (termExamMarksA && termExamMarksA.length > 0) {
      // Helper function to safely get mark value - handles Maps and Objects
      const getMark = (marksObj, row, question) => {
        try {
          // Convert marksObj to plain object if it's a Map
          let marks = marksObj;
          if (marksObj instanceof Map) {
            marks = {};
            for (const [key, value] of marksObj.entries()) {
              marks[key] = value instanceof Map ? Object.fromEntries(value) : value;
            }
          }
          
          if (!marks || !marks[row]) {
            return 0;
          }
          
          let rowData = marks[row];
          
          // Convert rowData to plain object if it's a Map
          if (rowData instanceof Map) {
            rowData = Object.fromEntries(rowData);
          }
          
          if (!rowData || typeof rowData !== 'object') {
            return 0;
          }
          
          // Try both string and number keys
          const value = rowData[question] !== undefined ? rowData[question] : rowData[String(question)];
          
          if (value === '' || value === null || value === undefined) {
            return 0;
          }
          
          const parsed = parseFloat(value);
          const result = isNaN(parsed) ? 0 : parsed;
          return result;
        } catch (error) {
          console.error(`[getMark] Error getting mark for ${row}${question}:`, error);
          return 0;
        }
      };
      
      // Process Section A records
      termExamMarksA.forEach((examMark) => {
        const student = examMark.student;
        const marks = examMark.marks;
        
        // Build Section A row (Questions 1-4)
        const sectionARow = {
          rollNumber: student?.roll || 'N/A',
          name: student?.name || 'Unknown',
          // Question 1
          Q1a: getMark(marks, 'a', '1'),
          Q1b: getMark(marks, 'b', '1'),
          Q1c: getMark(marks, 'c', '1'),
          Q1d: getMark(marks, 'd', '1'),
          // Question 2
          Q2a: getMark(marks, 'a', '2'),
          Q2b: getMark(marks, 'b', '2'),
          Q2c: getMark(marks, 'c', '2'),
          Q2d: getMark(marks, 'd', '2'),
          // Question 3
          Q3a: getMark(marks, 'a', '3'),
          Q3b: getMark(marks, 'b', '3'),
          Q3c: getMark(marks, 'c', '3'),
          Q3d: getMark(marks, 'd', '3'),
          // Question 4
          Q4a: getMark(marks, 'a', '4'),
          Q4b: getMark(marks, 'b', '4'),
          Q4c: getMark(marks, 'c', '4'),
          Q4d: getMark(marks, 'd', '4')
        };
        
        sectionAObtainedRows.push(sectionARow);
      });
    }
    
    // Process Section B records (section='B', uses questions 5-8 which map to UI Q1-Q4)
    if (termExamMarksB && termExamMarksB.length > 0) {
      // Helper function to safely get mark value - handles Maps and Objects
      const getMark = (marksObj, row, question) => {
        try {
          // Convert marksObj to plain object if it's a Map
          let marks = marksObj;
          if (marksObj instanceof Map) {
            marks = {};
            for (const [key, value] of marksObj.entries()) {
              marks[key] = value instanceof Map ? Object.fromEntries(value) : value;
            }
          }
          
          if (!marks || !marks[row]) {
            return 0;
          }
          
          let rowData = marks[row];
          
          // Convert rowData to plain object if it's a Map
          if (rowData instanceof Map) {
            rowData = Object.fromEntries(rowData);
          }
          
          if (!rowData || typeof rowData !== 'object') {
            return 0;
          }
          
          // Try both string and number keys
          const value = rowData[question] !== undefined ? rowData[question] : rowData[String(question)];
          
          if (value === '' || value === null || value === undefined) {
            return 0;
          }
          
          const parsed = parseFloat(value);
          const result = isNaN(parsed) ? 0 : parsed;
          return result;
        } catch (error) {
          console.error(`[getMark] Error getting mark for ${row}${question}:`, error);
          return 0;
        }
      };
      
      // Process Section B records - use questions 5-8 (map to UI Q1-Q4)
      termExamMarksB.forEach((examMark) => {
        const student = examMark.student;
        const marks = examMark.marks;
        
        // Build Section B row (Questions 5-8 map to UI Q1-Q4)
        const sectionBRow = {
          rollNumber: student?.roll || 'N/A',
          name: student?.name || 'Unknown',
          // Question 5 → UI Q1
          Q1a: getMark(marks, 'a', '5'),
          Q1b: getMark(marks, 'b', '5'),
          Q1c: getMark(marks, 'c', '5'),
          Q1d: getMark(marks, 'd', '5'),
          // Question 6 → UI Q2
          Q2a: getMark(marks, 'a', '6'),
          Q2b: getMark(marks, 'b', '6'),
          Q2c: getMark(marks, 'c', '6'),
          Q2d: getMark(marks, 'd', '6'),
          // Question 7 → UI Q3
          Q3a: getMark(marks, 'a', '7'),
          Q3b: getMark(marks, 'b', '7'),
          Q3c: getMark(marks, 'c', '7'),
          Q3d: getMark(marks, 'd', '7'),
          // Question 8 → UI Q4
          Q4a: getMark(marks, 'a', '8'),
          Q4b: getMark(marks, 'b', '8'),
          Q4c: getMark(marks, 'c', '8'),
          Q4d: getMark(marks, 'd', '8')
        };
        sectionBObtainedRows.push(sectionBRow);
      });
    }

    // Prepare response data
    let responseData = sectionAData || null;
    
    // If we have sectionAData, merge the obtained rows
    // If not, create a minimal structure with obtained rows
    if (responseData) {
      responseData = {
        ...responseData,
        sectionAObtainedRows,
        sectionBObtainedRows
      };
    } else if (sectionAObtainedRows.length > 0 || sectionBObtainedRows.length > 0) {
      // Return at least the obtained rows even if no attainment data exists yet
      responseData = {
        course: courseId,
        sectionARows: [],
        sectionAObtainedRows,
        sectionBRows: [],
        sectionBObtainedRows
      };
    }

    res.json({
      success: true,
      data: responseData
    });
  } catch (error) {
    console.error('Error getting Section A data:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

