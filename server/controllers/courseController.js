const Course = require('../models/Course');
const CourseOutcome = require('../models/CourseOutcome');
const COPOMapping = require('../models/COPOMapping');
const ProgramOutcome = require('../models/ProgramOutcome');
const mongoose = require('mongoose');
const { validationResult } = require('express-validator');
const { validateOBECompliance, generateCOPOMatrix } = require('../utils/curriculumValidation');

// @desc    Create a new course
// @route   POST /api/courses
// @access  Admin only
exports.createCourse = async (req, res) => {
  try {
    // Security check - verify admin role
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }

    const { 
      courseCode, 
      courseTitle, 
      course_type,
      credit, 
      course_offered_to, 
      // OBE classification fields
      category,
      elective_group,
      kpa_mapping,
      term,
      status,
      // OBE fields
      contactHours,
      academicYear,
      semester,
      yearLevel,
      prerequisites,
      knowledge_required,
      course_objectives,
      course_content,
      lecture_plan,
      references,
      // New OBE data (optional)
      courseOutcomes,  // Array of { co_code, description, po_mappings }
      withOBEData      // Flag to enable transaction mode
    } = req.body;

    // Check if course code already exists
    const existingCourse = await Course.findOne({ courseCode: courseCode.toUpperCase() });
    if (existingCourse) {
      return res.status(400).json({
        success: false,
        message: 'Course with this course code already exists'
      });
    }

    // Validate all required fields
    const validationErrors = [];

    if (!courseCode || !courseCode.trim()) {
      validationErrors.push({ field: 'courseCode', message: 'Course code is required' });
    }
    if (!courseTitle || !courseTitle.trim()) {
      validationErrors.push({ field: 'courseTitle', message: 'Course title is required' });
    }
    if (!course_type) {
      validationErrors.push({ field: 'course_type', message: 'Course type is required' });
    }
    if (credit === undefined || credit === null) {
      validationErrors.push({ field: 'credit', message: 'Credit is required' });
    }
    if (!course_offered_to || !course_offered_to.trim()) {
      validationErrors.push({ field: 'course_offered_to', message: 'Department (course_offered_to) is required' });
    }
    if (!category || !category.trim()) {
      validationErrors.push({ field: 'category', message: 'Category is required' });
    }
    if (!kpa_mapping || !Array.isArray(kpa_mapping) || kpa_mapping.length === 0) {
      validationErrors.push({ field: 'kpa_mapping', message: 'KPA mapping is required (at least one value)' });
    }
    if (!knowledge_required || !Array.isArray(knowledge_required) || knowledge_required.length === 0) {
      validationErrors.push({ field: 'knowledge_required', message: 'Knowledge required is required (at least one item)' });
    }
    if (!course_objectives || !Array.isArray(course_objectives) || course_objectives.length === 0) {
      validationErrors.push({ field: 'course_objectives', message: 'Course objectives are required (at least one objective)' });
    }
    if (!course_content || !Array.isArray(course_content) || course_content.length === 0) {
      validationErrors.push({ field: 'course_content', message: 'Course content is required (at least one concept)' });
    } else {
      // Validate course_content structure
      course_content.forEach((concept, index) => {
        if (!concept.concept_description || !concept.concept_description.trim()) {
          validationErrors.push({ field: `course_content[${index}].concept_description`, message: 'Concept description is required' });
        }
      });
    }

    // Parity rule for course code last digit vs course type
    if (courseCode && course_type) {
      const digits = (courseCode.match(/\d+/g) || []).join('');
      if (digits.length > 0) {
        const last = parseInt(digits[digits.length - 1], 10);
        if (course_type === 'THEORY' && last % 2 === 0) {
          validationErrors.push({ field: 'courseCode', message: 'Theory course code must end with an odd digit' });
        } else if ((course_type === 'SESSIONAL' || course_type === 'PROJECT/THESIS') && last % 2 !== 0) {
          validationErrors.push({ field: 'courseCode', message: 'Sessional/Project/Thesis course code must end with an even digit' });
        }
      }
    }

    // Validate lecture_plan
    if (!lecture_plan || !Array.isArray(lecture_plan) || lecture_plan.length === 0) {
      validationErrors.push({ field: 'lecture_plan', message: 'Lecture plan is required (at least one entry)' });
    } else {
      if (lecture_plan.length > 13) {
        validationErrors.push({ field: 'lecture_plan', message: 'Maximum 13 lecture plan entries allowed' });
      }
      
      // Track weeks to find duplicates
      const weeksSeen = new Set();
      const duplicateWeeks = [];
      
      // Week is only required if there are multiple entries
      const isWeekRequired = lecture_plan.length > 1;
      
      // Validate each lecture plan entry
      lecture_plan.forEach((item, index) => {
        // Check if week field exists (only required for multiple entries)
        if (isWeekRequired) {
          if (item.week === undefined || item.week === null) {
            validationErrors.push({ field: `lecture_plan[${index}].week`, message: 'Week is missing' });
          } else if (!Number.isInteger(item.week)) {
            validationErrors.push({ field: `lecture_plan[${index}].week`, message: 'Week must be an integer' });
          } else if (item.week < 1 || item.week > 13) {
            validationErrors.push({ field: `lecture_plan[${index}].week`, message: 'Week must be between 1 and 13' });
          } else {
            // Check for duplicate weeks
            if (weeksSeen.has(item.week)) {
              duplicateWeeks.push(item.week);
            }
            weeksSeen.add(item.week);
          }
        } else if (item.week !== undefined && item.week !== null) {
          // If week is provided for single entry, still validate it
          if (!Number.isInteger(item.week)) {
            validationErrors.push({ field: `lecture_plan[${index}].week`, message: 'Week must be an integer' });
          } else if (item.week < 1 || item.week > 13) {
            validationErrors.push({ field: `lecture_plan[${index}].week`, message: 'Week must be between 1 and 13' });
          }
        }
        
        // Check if plan field exists
        if (item.plan === undefined || item.plan === null) {
          validationErrors.push({ field: `lecture_plan[${index}].plan`, message: 'Plan description is missing' });
        } else if (typeof item.plan !== 'string' || !item.plan.trim()) {
          validationErrors.push({ field: `lecture_plan[${index}].plan`, message: 'Plan description is required' });
        }
      });
      
      // Report duplicate weeks (only relevant for multiple entries)
      if (isWeekRequired && duplicateWeeks.length > 0) {
        const uniqueDuplicates = [...new Set(duplicateWeeks)];
        validationErrors.push({ 
          field: 'lecture_plan', 
          message: `Duplicate week numbers found: ${uniqueDuplicates.join(', ')}` 
        });
      }
    }

    // Validate references (optional, but if provided should not be empty)
    if (references !== undefined && references !== null) {
      if (!Array.isArray(references)) {
        validationErrors.push({ field: 'references', message: 'References must be an array' });
      } else if (references.length > 0) {
        // Filter out empty or whitespace-only entries
        const cleanedReferences = references
          .filter(ref => ref && typeof ref === 'string' && ref.trim())
          .map(ref => ref.trim());
        
        // Update the references array with cleaned values
        req.body.references = cleanedReferences;
      }
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed: required fields are missing or invalid',
        errors: validationErrors
      });
    }

    // Validate category and elective_group relationship
    if (category === 'OPTIONAL' && !elective_group) {
      return res.status(400).json({
        success: false,
        message: 'Elective group is required when category is OPTIONAL'
      });
    }

    // Validate semester if provided
    if (semester !== undefined) {
      const semesterNum = Number(semester);
      if (!Number.isInteger(semesterNum) || semesterNum < 1 || semesterNum > 8) {
        return res.status(400).json({
          success: false,
          message: 'Semester must be an integer between 1 and 8'
        });
      }
    }

    // Validate yearLevel if provided (conditional based on department)
    if (yearLevel !== undefined) {
      const yearLevelNum = Number(yearLevel);
      const maxYear = course_offered_to === 'ARCH' ? 5 : 4;
      if (!Number.isInteger(yearLevelNum) || yearLevelNum < 1 || yearLevelNum > maxYear) {
        return res.status(400).json({
          success: false,
          message: `Year level must be an integer between 1 and ${maxYear} for ${course_offered_to || 'this department'}`
        });
      }
    }

    // Validate OBE data if provided
    if (courseOutcomes && Array.isArray(courseOutcomes) && courseOutcomes.length > 0) {
      // Validate CO structure
      for (const co of courseOutcomes) {
        if (!co.co_code || !co.description) {
          return res.status(400).json({
            success: false,
            message: 'Each course outcome must have co_code and description'
          });
        }

        // Validate PO mappings if provided
        if (co.po_mappings && Array.isArray(co.po_mappings)) {
          if (co.po_mappings.length === 0) {
            return res.status(400).json({
              success: false,
              message: `Course outcome ${co.co_code} must have at least one PO mapping`
            });
          }

          const validPOCodes = ['PO_A', 'PO_B', 'PO_C', 'PO_D', 'PO_E', 'PO_F', 'PO_G', 'PO_H', 'PO_I', 'PO_J', 'PO_K', 'PO_L'];
          const seenPOs = new Set();

          for (const mapping of co.po_mappings) {
            const { program_outcome_code, level } = mapping;

            // Validate PO code
            if (!program_outcome_code || !validPOCodes.includes(program_outcome_code.toUpperCase())) {
              return res.status(400).json({
                success: false,
                message: `Invalid program outcome code in ${co.co_code}: ${program_outcome_code}`
              });
            }

            // Validate level
            const levelNum = Number(level);
            if (isNaN(levelNum) || levelNum < 1 || levelNum > 3) {
              return res.status(400).json({
                success: false,
                message: `Invalid mapping level in ${co.co_code}: must be 1, 2, or 3`
              });
            }

            // Check for duplicate POs
            const poCodeUpper = program_outcome_code.toUpperCase();
            if (seenPOs.has(poCodeUpper)) {
              return res.status(400).json({
                success: false,
                message: `Duplicate PO mapping in ${co.co_code}: ${poCodeUpper}`
              });
            }
            seenPOs.add(poCodeUpper);
          }
        }
      }
    }

    // Prepare course data
    const courseData = {
      courseCode,
      courseTitle,
      course_type,
      credit,
      course_offered_to,
      category,
      kpa_mapping,
      knowledge_required,
      course_objectives,
      course_content,
      lecture_plan,
      references,
      createdBy: req.user._id
    };

    // Add optional classification fields if provided
    if (elective_group !== undefined) courseData.elective_group = elective_group;
    if (term !== undefined) courseData.term = term;
    if (status) courseData.status = status;

    // Add OBE fields if provided
    if (contactHours !== undefined) courseData.contactHours = contactHours;
    if (academicYear) {
      // Accept year as number, schema will format to YYYY-YY
      courseData.academicYear = academicYear.toString();
    }
    if (semester !== undefined) courseData.semester = semester;
    if (yearLevel !== undefined) courseData.yearLevel = yearLevel;
    if (prerequisites) courseData.prerequisites = prerequisites;

    console.log('=== CREATE COURSE DEBUG ===');
    console.log('courseOutcomes:', courseOutcomes);
    console.log('courseOutcomes type:', typeof courseOutcomes);
    console.log('courseOutcomes is array:', Array.isArray(courseOutcomes));
    console.log('courseOutcomes length:', courseOutcomes ? courseOutcomes.length : 'N/A');

    // Use transaction if OBE data is provided
    if (courseOutcomes && Array.isArray(courseOutcomes) && courseOutcomes.length > 0) {
      console.log('=== CREATING COURSE WITH TRANSACTION ===');
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        console.log('=== Creating course document ===');
        // Step 1: Create course
        const [course] = await Course.create([courseData], { session });

        // Step 2: Create course outcomes
        const createdCOs = [];
        for (const coData of courseOutcomes) {
          console.log(`=== Creating CO: ${coData.co_code} ===`);
          console.log('CO Data:', JSON.stringify(coData, null, 2));
          console.log('Taxonomy levels being saved:', coData.taxonomy_levels);
          
          const [courseOutcome] = await CourseOutcome.create([{
            course: course._id,
            co_code: coData.co_code,
            description: coData.description,
            taxonomy_levels: coData.taxonomy_levels || []
          }], { session });

          createdCOs.push({
            ...courseOutcome.toObject(),
            po_mappings: coData.po_mappings || []
          });
        }
        console.log('=== Created COs:', createdCOs.length);

        // Step 3: Create CO-PO mappings
        let totalMappings = 0;
        for (const co of createdCOs) {
          if (co.po_mappings && Array.isArray(co.po_mappings) && co.po_mappings.length > 0) {
            const mappingsToCreate = co.po_mappings.map(mapping => ({
              course_outcome: co._id,
              program_outcome_code: mapping.program_outcome_code.toUpperCase(),
              level: Number(mapping.level)
            }));

            await COPOMapping.create(mappingsToCreate, { session, ordered: true });
            totalMappings += mappingsToCreate.length;
          }
        }
        console.log('=== Created PO mappings:', totalMappings);

        // Commit transaction
        console.log('=== Committing transaction...');
        await session.commitTransaction();
        session.endSession();
        console.log('=== Transaction committed successfully!');

        // Populate creator details
        await course.populate('createdBy', 'name email');

        res.status(201).json({
          success: true,
          message: `Course created successfully with ${createdCOs.length} course outcomes and ${totalMappings} PO mappings`,
          data: {
            course,
            course_outcomes_count: createdCOs.length,
            po_mappings_count: totalMappings
          }
        });

      } catch (error) {
        // Rollback transaction on error
        await session.abortTransaction();
        session.endSession();

        console.error('Transaction error:', error);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        
        // Extract validation errors if available
        let errorDetails = [];
        if (error.errors) {
          errorDetails = Object.entries(error.errors).map(([key, err]) => {
            return `${key}: ${err.message}`;
          });
        }
        
        // If it's a validation error with specific field info
        let userFriendlyMessage = error.message;
        if (error.errors) {
          userFriendlyMessage = Object.values(error.errors)
            .map(e => e.message)
            .join('; ');
        }
        
        return res.status(500).json({
          success: false,
          message: 'Failed to create course with OBE data. Transaction rolled back.',
          error: userFriendlyMessage,
          details: errorDetails
        });
      }
    } else {
      // No OBE data - use existing simple creation (backward compatible)
      const course = await Course.create(courseData);

      // Populate creator details
      await course.populate('createdBy', 'name email');

      res.status(201).json({
        success: true,
        message: 'Course created successfully',
        data: course
      });
    }

  } catch (error) {
    console.error('Create course error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error creating course'
    });
  }
};

// @desc    Get all courses
// @route   GET /api/courses
// @access  Admin only
exports.getAllCourses = async (req, res) => {
  try {
    const { 
      course_offered_to, 
      course_type,
      category,
      elective_group,
      term,
      status
    } = req.query;

    // Build filter
    const filter = {};
    if (course_offered_to) filter.course_offered_to = course_offered_to.toUpperCase();
    if (course_type) filter.course_type = course_type;
    if (category) filter.category = category.toUpperCase();
    if (elective_group) filter.elective_group = elective_group.toUpperCase();
    if (term) filter.term = parseInt(term);
    if (status) filter.status = status;

    // If user is a teacher, filter by assigned courses only
    if (req.user && req.user.role === 'teacher') {
      filter['assignedTeachers.teacher'] = req.user._id;
    }

    // If user is a student, filter by assigned batches
    if (req.user && req.user.role === 'student') {
      // Extract batch and deptCode from student's roll number
      // Format: BBDDRRR (e.g., 2107016 -> batch: 21, deptCode: 07)
      if (req.user.roll && req.user.roll.length >= 4) {
        const batch = req.user.roll.substring(0, 2);
        const deptCode = req.user.roll.substring(2, 4);
        
        // Filter courses where assignedBatches contains this batch+dept combination
        filter['assignedBatches'] = {
          $elemMatch: {
            batch: batch,
            deptCode: deptCode
          }
        };
      } else {
        // If roll format is invalid, return no courses
        return res.status(200).json({
          success: true,
          count: 0,
          data: []
        });
      }
    }

    const courses = await Course.find(filter)
      .populate('createdBy', 'name email')
      .populate('assignedTeachers.teacher', 'name email designation')
      .sort({ createdAt: -1 });

    // Populate course outcomes with their PO mappings for each course
    const coursesWithOutcomes = await Promise.all(
      courses.map(async (course) => {
        // Exclude soft-deleted COs so removals are reflected in the UI
        const courseOutcomes = await CourseOutcome.find({ 
          course: course._id, 
          is_deleted: { $ne: true }
        });
        
        // For each CO, fetch its PO mappings
        const outcomesWithMappings = await Promise.all(
          courseOutcomes.map(async (co) => {
            const poMappings = await COPOMapping.find({ course_outcome: co._id });
            return {
              ...co.toObject(),
              po_mappings: poMappings.map(m => ({
                program_outcome_code: m.program_outcome_code,
                level: m.level,
                _id: m._id
              }))
            };
          })
        );
        
        return {
          ...course.toObject(),
          courseOutcomes: outcomesWithMappings
        };
      })
    );

    res.status(200).json({
      success: true,
      count: coursesWithOutcomes.length,
      data: coursesWithOutcomes
    });

  } catch (error) {
    console.error('Get courses error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching courses'
    });
  }
};

// @desc    Get single course
// @route   GET /api/courses/:id
// @access  Admin only
exports.getCourse = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id)
      .populate('createdBy', 'name email');

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    res.status(200).json({
      success: true,
      data: course
    });

  } catch (error) {
    console.error('Get course error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching course'
    });
  }
};

// @desc    Update course
// @route   PUT /api/courses/:id
// @access  Admin only
exports.updateCourse = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map(e => `${e.path}: ${e.msg}`).join('; ');
      return res.status(400).json({ 
        success: false,
        message: 'Validation failed',
        error: errorMessages,
        errors: errors.array()
      });
    }

    const { 
      courseCode, 
      courseTitle, 
      course_type,
      credit, 
      course_offered_to, 
      // OBE classification fields
      category,
      elective_group,
      kpa_mapping,
      term,
      status,
      // OBE fields
      contactHours,
      academicYear,
      semester,
      yearLevel,
      prerequisites,
      course_content,
      lecture_plan,
      references,
      knowledge_required,
      course_objectives,
      // New OBE update fields
      courseOutcomes,  // Array of { _id?, co_code, description, po_mappings, _action? }
      deletedCOIds     // Array of CO IDs to delete/soft-delete
    } = req.body;

    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Check if new course code conflicts with existing course
    if (courseCode && courseCode.toUpperCase() !== course.courseCode) {
      const existingCourse = await Course.findOne({ courseCode: courseCode.toUpperCase() });
      if (existingCourse) {
        return res.status(400).json({
          success: false,
          message: 'Course code already in use'
        });
      }
      course.courseCode = courseCode;
    }

    // Parity rule: validate last digit of course code against course type
    {
      const effectiveCode = courseCode || course.courseCode;
      const effectiveType = (course_type !== undefined && course_type !== null) ? course_type : course.course_type;
      if (effectiveCode && effectiveType) {
        const digits = (effectiveCode.match(/\d+/g) || []).join('');
        if (digits.length > 0) {
          const last = parseInt(digits[digits.length - 1], 10);
          const errorsArr = [];
          if (effectiveType === 'THEORY' && last % 2 === 0) {
            errorsArr.push({ field: 'courseCode', message: 'Theory course code must end with an odd digit' });
          } else if ((effectiveType === 'SESSIONAL' || effectiveType === 'PROJECT/THESIS') && last % 2 !== 0) {
            errorsArr.push({ field: 'courseCode', message: 'Sessional/Project/Thesis course code must end with an even digit' });
          }
          if (errorsArr.length > 0) {
            return res.status(400).json({
              success: false,
              message: 'Validation failed',
              errors: errorsArr
            });
          }
        }
      }
    }

    // Validate category and elective_group relationship
    const finalCategory = category !== undefined ? category : course.category;
    const finalElectiveGroup = elective_group !== undefined ? elective_group : course.elective_group;
    
    if (finalCategory === 'OPTIONAL' && !finalElectiveGroup) {
      return res.status(400).json({
        success: false,
        message: 'Elective group is required when category is OPTIONAL'
      });
    }

    // Validate semester if provided
    if (semester !== undefined) {
      const semesterNum = Number(semester);
      if (!Number.isInteger(semesterNum) || semesterNum < 1 || semesterNum > 8) {
        return res.status(400).json({
          success: false,
          message: 'Semester must be an integer between 1 and 8'
        });
      }
    }

    // Validate yearLevel if provided (conditional based on department)
    if (yearLevel !== undefined) {
      const yearLevelNum = Number(yearLevel);
      const finalDepartment = course_offered_to || course.course_offered_to;
      const maxYear = finalDepartment === 'ARCH' ? 5 : 4;
      if (!Number.isInteger(yearLevelNum) || yearLevelNum < 1 || yearLevelNum > maxYear) {
        return res.status(400).json({
          success: false,
          message: `Year level must be an integer between 1 and ${maxYear} for ${finalDepartment || 'this department'}`
        });
      }
    }

    // Validate lecture_plan if provided
    if (lecture_plan !== undefined) {
      const validationErrors = [];
      
      if (!Array.isArray(lecture_plan) || lecture_plan.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Lecture plan must be an array with at least one entry'
        });
      }
      
      if (lecture_plan.length > 13) {
        validationErrors.push({ field: 'lecture_plan', message: 'Maximum 13 lecture plan entries allowed' });
      }
      
      // Track weeks to find duplicates
      const weeksSeen = new Set();
      const duplicateWeeks = [];
      
      // Week is only required if there are multiple entries
      const isWeekRequired = lecture_plan.length > 1;
      
      // Validate each lecture plan entry
      lecture_plan.forEach((item, index) => {
        // Check if week field exists (only required for multiple entries)
        if (isWeekRequired) {
          if (item.week === undefined || item.week === null) {
            validationErrors.push({ field: `lecture_plan[${index}].week`, message: 'Week is missing' });
          } else if (!Number.isInteger(item.week)) {
            validationErrors.push({ field: `lecture_plan[${index}].week`, message: 'Week must be an integer' });
          } else if (item.week < 1 || item.week > 13) {
            validationErrors.push({ field: `lecture_plan[${index}].week`, message: 'Week must be between 1 and 13' });
          } else {
            // Check for duplicate weeks
            if (weeksSeen.has(item.week)) {
              duplicateWeeks.push(item.week);
            }
            weeksSeen.add(item.week);
          }
        } else if (item.week !== undefined && item.week !== null) {
          // If week is provided for single entry, still validate it
          if (!Number.isInteger(item.week)) {
            validationErrors.push({ field: `lecture_plan[${index}].week`, message: 'Week must be an integer' });
          } else if (item.week < 1 || item.week > 13) {
            validationErrors.push({ field: `lecture_plan[${index}].week`, message: 'Week must be between 1 and 13' });
          }
        }
        
        // Check if plan field exists
        if (item.plan === undefined || item.plan === null) {
          validationErrors.push({ field: `lecture_plan[${index}].plan`, message: 'Plan description is missing' });
        } else if (typeof item.plan !== 'string' || !item.plan.trim()) {
          validationErrors.push({ field: `lecture_plan[${index}].plan`, message: 'Plan description is required' });
        }
      });
      
      // Report duplicate weeks (only relevant for multiple entries)
      if (isWeekRequired && duplicateWeeks.length > 0) {
        const uniqueDuplicates = [...new Set(duplicateWeeks)];
        validationErrors.push({ 
          field: 'lecture_plan', 
          message: `Duplicate week numbers found: ${uniqueDuplicates.join(', ')}` 
        });
      }
      
      if (validationErrors.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Lecture plan validation failed',
          errors: validationErrors
        });
      }
    }

    // Validate references if provided (optional)
    if (references !== undefined && references !== null) {
      if (!Array.isArray(references)) {
        return res.status(400).json({
          success: false,
          message: 'References must be an array'
        });
      }
      
      if (references.length > 0) {
        // Filter out empty or whitespace-only entries
        const cleanedReferences = references
          .filter(ref => ref && typeof ref === 'string' && ref.trim())
          .map(ref => ref.trim());
        
        // Update the references array with cleaned values
        req.body.references = cleanedReferences;
      }
    }

    // Validate OBE data if provided
    if (courseOutcomes && Array.isArray(courseOutcomes) && courseOutcomes.length > 0) {
      for (const co of courseOutcomes) {
        if (!co.co_code || !co.description) {
          return res.status(400).json({
            success: false,
            message: 'Each course outcome must have co_code and description'
          });
        }

        // Validate PO mappings if provided
        if (co.po_mappings && Array.isArray(co.po_mappings) && co.po_mappings.length > 0) {
          const validPOCodes = ['PO_A', 'PO_B', 'PO_C', 'PO_D', 'PO_E', 'PO_F', 'PO_G', 'PO_H', 'PO_I', 'PO_J', 'PO_K', 'PO_L'];
          const seenPOs = new Set();

          for (const mapping of co.po_mappings) {
            const { program_outcome_code, level } = mapping;

            if (!program_outcome_code || !validPOCodes.includes(program_outcome_code.toUpperCase())) {
              return res.status(400).json({
                success: false,
                message: `Invalid program outcome code in ${co.co_code}: ${program_outcome_code}`
              });
            }

            const levelNum = Number(level);
            if (isNaN(levelNum) || levelNum < 1 || levelNum > 3) {
              return res.status(400).json({
                success: false,
                message: `Invalid mapping level in ${co.co_code}: must be 1, 2, or 3`
              });
            }

            const poCodeUpper = program_outcome_code.toUpperCase();
            if (seenPOs.has(poCodeUpper)) {
              return res.status(400).json({
                success: false,
                message: `Duplicate PO mapping in ${co.co_code}: ${poCodeUpper}`
              });
            }
            seenPOs.add(poCodeUpper);
          }
        }
      }
    }

    console.log('=== UPDATE COURSE DEBUG ===');
    console.log('courseOutcomes:', courseOutcomes);
    console.log('courseOutcomes type:', typeof courseOutcomes);
    console.log('courseOutcomes is array:', Array.isArray(courseOutcomes));
    console.log('courseOutcomes length:', courseOutcomes ? courseOutcomes.length : 'N/A');

    // Use transaction if OBE data is being updated
    if ((courseOutcomes && courseOutcomes.length > 0) || (deletedCOIds && deletedCOIds.length > 0)) {
      console.log('=== ENTERING TRANSACTION MODE ===');
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        // Update basic course fields
        if (courseCode) course.courseCode = courseCode;
        if (courseTitle) course.courseTitle = courseTitle;
        if (course_type !== undefined) course.course_type = course_type;
        if (credit !== undefined) course.credit = credit;
        if (course_offered_to) course.course_offered_to = course_offered_to;

        // Update optional classification fields
        if (category !== undefined) course.category = category;
        if (elective_group !== undefined) course.elective_group = elective_group;
        if (kpa_mapping !== undefined) course.kpa_mapping = kpa_mapping;
        if (term !== undefined) course.term = term;
        if (status !== undefined) course.status = status;

        // Update OBE fields
        if (contactHours !== undefined) course.contactHours = contactHours;
        if (academicYear !== undefined) {
          // Accept year as number, schema will format to YYYY-YY
          course.academicYear = academicYear.toString();
        }
        if (semester !== undefined) course.semester = semester;
        if (yearLevel !== undefined) course.yearLevel = yearLevel;
        if (prerequisites !== undefined) course.prerequisites = prerequisites;
        if (knowledge_required !== undefined) course.knowledge_required = knowledge_required;
        if (course_objectives !== undefined) course.course_objectives = course_objectives;
        if (course_content !== undefined) course.course_content = course_content;
        if (lecture_plan !== undefined) course.lecture_plan = lecture_plan;
        if (references !== undefined) course.references = references;

        // Track review
        course.lastReviewed = Date.now();
        course.reviewedBy = req.user._id;

        await course.save({ session });

        let coStats = { added: 0, updated: 0, deleted: 0, softDeleted: 0 };
        let mappingStats = { added: 0, updated: 0, deleted: 0 };

        // Handle deleted COs (soft-delete if has historical data)
        if (deletedCOIds && Array.isArray(deletedCOIds) && deletedCOIds.length > 0) {
          for (const coId of deletedCOIds) {
            const co = await CourseOutcome.findById(coId).session(session);
            if (co) {
              // Check if CO has mappings (historical data)
              const mappingCount = await COPOMapping.countDocuments({ 
                course_outcome: coId 
              }).session(session);

              if (mappingCount > 0) {
                // Soft delete - preserve historical data
                co.is_deleted = true;
                co.deleted_at = new Date();
                co.deleted_reason = 'Removed during course update';
                await co.save({ session });
                coStats.softDeleted++;
              } else {
                // Hard delete - no historical data
                await CourseOutcome.findByIdAndDelete(coId, { session });
                await COPOMapping.deleteMany({ course_outcome: coId }, { session });
                coStats.deleted++;
              }
            }
          }
        }

        // Handle course outcomes updates/additions
        if (courseOutcomes && Array.isArray(courseOutcomes)) {
          for (const coData of courseOutcomes) {
            if (coData._id) {
              // Update existing CO
              const existingCO = await CourseOutcome.findById(coData._id).session(session);
              if (existingCO) {
                existingCO.co_code = coData.co_code;
                existingCO.description = coData.description;
                existingCO.taxonomy_levels = coData.taxonomy_levels || [];
                await existingCO.save({ session });
                coStats.updated++;

                // Update PO mappings
                if (coData.po_mappings && Array.isArray(coData.po_mappings)) {
                  // Delete existing mappings
                  const deletedMappings = await COPOMapping.deleteMany({ 
                    course_outcome: coData._id 
                  }, { session });
                  mappingStats.deleted += deletedMappings.deletedCount;

                  // Create new mappings
                  if (coData.po_mappings.length > 0) {
                    const mappingsToCreate = coData.po_mappings.map(mapping => ({
                      course_outcome: coData._id,
                      program_outcome_code: mapping.program_outcome_code.toUpperCase(),
                      level: Number(mapping.level)
                    }));

                    await COPOMapping.create(mappingsToCreate, { session, ordered: true });
                    mappingStats.added += mappingsToCreate.length;
                  }
                }
              }
            } else {
              // Add new CO
              const [newCO] = await CourseOutcome.create([{
                course: course._id,
                co_code: coData.co_code,
                description: coData.description,
                taxonomy_levels: coData.taxonomy_levels || []
              }], { session });
              coStats.added++;

              // Create PO mappings for new CO
              if (coData.po_mappings && Array.isArray(coData.po_mappings) && coData.po_mappings.length > 0) {
                const mappingsToCreate = coData.po_mappings.map(mapping => ({
                  course_outcome: newCO._id,
                  program_outcome_code: mapping.program_outcome_code.toUpperCase(),
                  level: Number(mapping.level)
                }));

                await COPOMapping.create(mappingsToCreate, { session, ordered: true });
                mappingStats.added += mappingsToCreate.length;
              }
            }
          }
        }

        // Commit transaction
        await session.commitTransaction();
        session.endSession();

        // Populate creator details
        await course.populate('createdBy', 'name email');

        res.status(200).json({
          success: true,
          message: 'Course and OBE data updated successfully',
          data: {
            course,
            co_stats: coStats,
            mapping_stats: mappingStats
          }
        });

      } catch (error) {
        await session.abortTransaction();
        session.endSession();

        console.error('Transaction error:', error);
        return res.status(500).json({
          success: false,
          message: 'Failed to update course with OBE data. Transaction rolled back.',
          error: error.message
        });
      }
    } else {
      // No OBE data updates - simple course update (backward compatible)
      
      if (courseTitle) course.courseTitle = courseTitle;
      if (course_type !== undefined) course.course_type = course_type;
      if (credit !== undefined) course.credit = credit;
      if (course_offered_to) course.course_offered_to = course_offered_to;

      // Update optional classification fields
      if (category !== undefined) course.category = category;
      if (elective_group !== undefined) course.elective_group = elective_group;
      if (kpa_mapping !== undefined) course.kpa_mapping = kpa_mapping;
      if (term !== undefined) course.term = term;
      if (status !== undefined) course.status = status;

      // Update OBE fields
      if (contactHours !== undefined) course.contactHours = contactHours;
      if (academicYear !== undefined) {
        // Accept year as number, schema will format to YYYY-YY
        course.academicYear = academicYear.toString();
      }
      if (semester !== undefined) course.semester = semester;
      if (yearLevel !== undefined) course.yearLevel = yearLevel;
      if (prerequisites !== undefined) course.prerequisites = prerequisites;
      if (knowledge_required !== undefined) course.knowledge_required = knowledge_required;
      if (course_objectives !== undefined) course.course_objectives = course_objectives;
      if (course_content !== undefined) course.course_content = course_content;
      if (lecture_plan !== undefined) course.lecture_plan = lecture_plan;
      if (references !== undefined) course.references = references;

      // Track review
      course.lastReviewed = Date.now();
      course.reviewedBy = req.user._id;

      await course.save();
      await course.populate('createdBy', 'name email');

      res.status(200).json({
        success: true,
        message: 'Course updated successfully',
        data: course
      });
    }

  } catch (error) {
    console.error('Update course error:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    // Extract validation errors if available
    let errorDetails = [];
    if (error.errors) {
      errorDetails = Object.entries(error.errors).map(([key, err]) => {
        return `${key}: ${err.message}`;
      });
    }
    
    // If it's a validation error with specific field info
    let userFriendlyMessage = error.message;
    if (error.errors) {
      userFriendlyMessage = Object.values(error.errors)
        .map(e => e.message)
        .join('; ');
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error updating course',
      error: userFriendlyMessage,
      details: errorDetails
    });
  }
};

// @desc    Delete course
// @route   DELETE /api/courses/:id
// @access  Admin only
exports.deleteCourse = async (req, res) => {
  try {
    console.log('=== DELETE COURSE DEBUG ===');
    console.log('Course ID:', req.params.id);
    
    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    console.log('Found course:', course.courseCode);

    // First, find all course outcomes for this course
    const courseOutcomes = await CourseOutcome.find({ course: course._id });
    const coIds = courseOutcomes.map(co => co._id);
    
    console.log('Found course outcomes:', courseOutcomes.length);
    console.log('CO IDs:', coIds);

    // Delete all CO-PO mappings for these course outcomes
    if (coIds.length > 0) {
      const deleteResult = await COPOMapping.deleteMany({ course_outcome: { $in: coIds } });
      console.log(`Deleted ${deleteResult.deletedCount} CO-PO mappings for ${coIds.length} course outcomes`);
    } else {
      console.log('No course outcomes found, skipping CO-PO mapping deletion');
    }

    // Delete all course outcomes
    const coDeleteResult = await CourseOutcome.deleteMany({ course: course._id });
    console.log(`Deleted ${coDeleteResult.deletedCount} course outcomes`);

    // Finally, delete the course
    await Course.findByIdAndDelete(req.params.id);
    console.log(`Deleted course: ${course.courseCode}`);

    res.status(200).json({
      success: true,
      message: 'Course and all related data deleted successfully'
    });

  } catch (error) {
    console.error('Delete course error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting course',
      error: error.message
    });
  }
};

// Note: CO-PO matrix and OBE validation endpoints removed
// These features can be reimplemented using the separate CourseOutcome model

// @desc    Validate course OBE compliance
// @route   GET /api/courses/:id/validate-obe
// @access  Admin/Teacher
exports.validateCourseOBE = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Fetch course outcomes with their PO mappings
    const courseOutcomes = await CourseOutcome.find({ course: course._id });
    
    // For each CO, fetch its PO mappings
    const outcomesWithMappings = await Promise.all(
      courseOutcomes.map(async (co) => {
        const poMappings = await COPOMapping.find({ course_outcome: co._id });
        return {
          ...co.toObject(),
          po_mappings: poMappings.map(m => ({
            program_outcome_code: m.program_outcome_code,
            level: m.level,
            _id: m._id
          }))
        };
      })
    );
    
    // Transform courseOutcomes to match validation function format
    const transformedOutcomes = outcomesWithMappings.map(co => {
      // Convert po_mappings array to poMapping object
      const poMapping = {};
      if (co.po_mappings && co.po_mappings.length > 0) {
        co.po_mappings.forEach(mapping => {
          // Convert PO_A to PO1, PO_B to PO2, etc.
          const poNumber = mapping.program_outcome_code.replace('PO_', 'PO');
          const poIndex = mapping.program_outcome_code.charCodeAt(3) - 64; // A=1, B=2, etc.
          poMapping[`PO${poIndex}`] = mapping.level;
        });
      }
      
      return {
        coNumber: co.co_code,
        description: co.description,
        poMapping: poMapping
      };
    });
    
    // Add courseOutcomes to course object for validation
    const courseWithOutcomes = {
      ...course.toObject(),
      courseOutcomes: transformedOutcomes
    };

    const validation = validateOBECompliance(courseWithOutcomes);

    res.status(200).json({
      success: true,
      data: {
        courseCode: course.courseCode,
        courseTitle: course.courseTitle,
        validation
      }
    });

  } catch (error) {
    console.error('Validate OBE error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error validating OBE compliance'
    });
  }
};

// @desc    Get curriculum summary by semester
// @route   GET /api/courses/curriculum/semester/:semester
// @access  Admin
exports.getCurriculumBySemester = async (req, res) => {
  try {
    const semester = parseInt(req.params.semester);
    
    if (isNaN(semester) || semester < 1 || semester > 8) {
      return res.status(400).json({
        success: false,
        message: 'Invalid semester number (must be 1-8)'
      });
    }

    const courses = await Course.find({ 
      semester
    })
      .populate('createdBy', 'name email')
      .sort({ courseCode: 1 });

    // Calculate semester statistics
    const stats = {
      totalCourses: courses.length,
      totalCredits: courses.reduce((sum, c) => sum + c.credit, 0),
      courseTypes: {
        THEORY: courses.filter(c => c.course_type === 'THEORY').length,
        SESSIONAL: courses.filter(c => c.course_type === 'SESSIONAL').length,
        'PROJECT/THESIS': courses.filter(c => c.course_type === 'PROJECT/THESIS').length
      }
    };

    res.status(200).json({
      success: true,
      semester,
      stats,
      data: courses
    });

  } catch (error) {
    console.error('Get curriculum by semester error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching curriculum'
    });
  }
};

// Note: PO attainment summary removed - can be reimplemented using CourseOutcome model


