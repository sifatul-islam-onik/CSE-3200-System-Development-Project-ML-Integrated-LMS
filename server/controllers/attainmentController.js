const {
  readAttainmentData,
  writeStudentPoValue,
  batchUpdateStudentPoValues,
  getSheetNames
} = require('../utils/attainmentExcelUtil');
const Course = require('../models/Course');
const CTAttainment = require('../models/CTAttainment');
const TermExamMarks = require('../models/TermExamMarks');

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
    const formattedMarks = termMarks.map(mark => ({
      studentId: mark.student._id,
      rollNumber: mark.student.roll,
      name: mark.student.name,
      section: mark.section,
      marks: mark.marks,
      totalMarks: mark.totalMarks,
      imageUrl: mark.imageUrl,
      enteredBy: mark.enteredBy,
      lastModified: mark.lastModified
    }));

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
