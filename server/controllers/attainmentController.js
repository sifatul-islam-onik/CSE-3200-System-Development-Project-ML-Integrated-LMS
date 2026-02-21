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

    console.log('[getSectionAData] Received request for courseId:', courseId);

    // Parallel course check and section A data fetch for better performance
    const [course, sectionAData, termExamMarks] = await Promise.all([
      Course.findById(courseId).select('assignedTeachers').lean(),
      TermExamAttainment.findOne({ course: courseId }).lean(),
      TermExamMarks.find({ course: courseId }).populate('student', 'roll name').lean()
    ]);

    if (!course) {
      console.log('[getSectionAData] Course not found:', courseId);
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
        console.log('[getSectionAData] Access denied for teacher:', req.user._id);
        return res.status(403).json({
          success: false,
          message: 'Access denied. You are not assigned to this course.'
        });
      }
    }

    // Transform TermExamMarks data to sectionAObtainedRows and sectionBObtainedRows format
    let sectionAObtainedRows = [];
    let sectionBObtainedRows = [];
    
    if (termExamMarks && termExamMarks.length > 0) {
      console.log('[getSectionAData] Processing', termExamMarks.length, 'term exam marks records');
      
      // Log the structure of the first record for debugging
      if (termExamMarks[0]) {
        console.log('[getSectionAData] Sample marks structure:', JSON.stringify(termExamMarks[0].marks, null, 2));
        console.log('[getSectionAData] marks type:', typeof termExamMarks[0].marks);
        console.log('[getSectionAData] marks is Map?:', termExamMarks[0].marks instanceof Map);
        if (termExamMarks[0].marks) {
          const firstKey = Object.keys(termExamMarks[0].marks)[0];
          console.log('[getSectionAData] First key:', firstKey);
          console.log('[getSectionAData] First value type:', typeof termExamMarks[0].marks[firstKey]);
          console.log('[getSectionAData] First value is Map?:', termExamMarks[0].marks[firstKey] instanceof Map);
          console.log('[getSectionAData] First value:', termExamMarks[0].marks[firstKey]);
        }
      }
      
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
            console.log(`[getMark] No data for row ${row}`);
            return 0;
          }
          
          let rowData = marks[row];
          
          // Convert rowData to plain object if it's a Map
          if (rowData instanceof Map) {
            rowData = Object.fromEntries(rowData);
          }
          
          if (!rowData || typeof rowData !== 'object') {
            console.log(`[getMark] Invalid rowData for row ${row}`);
            return 0;
          }
          
          // Try both string and number keys
          const value = rowData[question] !== undefined ? rowData[question] : rowData[String(question)];
          console.log(`[getMark] row=${row}, question=${question}, raw value="${value}"`);
          
          if (value === '' || value === null || value === undefined) {
            return 0;
          }
          
          const parsed = parseFloat(value);
          const result = isNaN(parsed) ? 0 : parsed;
          console.log(`[getMark] Parsed to: ${result}`);
          return result;
        } catch (error) {
          console.error(`[getMark] Error getting mark for ${row}${question}:`, error);
          return 0;
        }
      };
      
      termExamMarks.forEach((examMark, index) => {
        const student = examMark.student;
        const marks = examMark.marks;
        
        console.log(`[getSectionAData] Processing student ${index + 1}:`, student?.roll);
        
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
        
        console.log(`[getSectionAData] Section A row for ${student?.roll}:`, sectionARow);
        sectionAObtainedRows.push(sectionARow);
        
        // Build Section B row (Questions 5-8, mapped to Q1-Q4 in the schema)
        sectionBObtainedRows.push({
          rollNumber: student?.roll || 'N/A',
          name: student?.name || 'Unknown',
          // Question 5 (mapped as Q1 in Section B)
          Q1a: getMark(marks, 'a', '5'),
          Q1b: getMark(marks, 'b', '5'),
          Q1c: getMark(marks, 'c', '5'),
          Q1d: getMark(marks, 'd', '5'),
          // Question 6 (mapped as Q2 in Section B)
          Q2a: getMark(marks, 'a', '6'),
          Q2b: getMark(marks, 'b', '6'),
          Q2c: getMark(marks, 'c', '6'),
          Q2d: getMark(marks, 'd', '6'),
          // Question 7 (mapped as Q3 in Section B)
          Q3a: getMark(marks, 'a', '7'),
          Q3b: getMark(marks, 'b', '7'),
          Q3c: getMark(marks, 'c', '7'),
          Q3d: getMark(marks, 'd', '7'),
          // Question 8 (mapped as Q4 in Section B)
          Q4a: getMark(marks, 'a', '8'),
          Q4b: getMark(marks, 'b', '8'),
          Q4c: getMark(marks, 'c', '8'),
          Q4d: getMark(marks, 'd', '8')
        });
      });
      
      console.log('[getSectionAData] Generated', sectionAObtainedRows.length, 'Section A obtained rows');
      console.log('[getSectionAData] Generated', sectionBObtainedRows.length, 'Section B obtained rows');
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

    console.log('[getSectionAData] Returning data with', sectionAObtainedRows.length, 'Section A obtained rows and', sectionBObtainedRows.length, 'Section B obtained rows');

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

