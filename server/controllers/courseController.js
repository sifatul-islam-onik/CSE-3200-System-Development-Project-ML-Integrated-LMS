const Course = require('../models/Course');
const CourseOutcome = require('../models/CourseOutcome');
const COPOMapping = require('../models/COPOMapping');
const ProgramOutcome = require('../models/ProgramOutcome');
const mongoose = require('mongoose');
const { validationResult } = require('express-validator');
const { validateOBECompliance, generateCOPOMatrix } = require('../utils/curriculumValidation');

exports.createCourse = async (req, res) => {
  try {
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
      category,
      elective_group,
      kpa_mapping,
      term,
      status,
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
      courseOutcomes,  // Array of { co_code, description, po_mappings }
      withOBEData      // Flag to enable transaction mode
    } = req.body;

    const existingCourse = await Course.findOne({ courseCode: courseCode.toUpperCase() });
    if (existingCourse) {
      return res.status(400).json({
        success: false,
        message: 'Course with this course code already exists'
      });
    }

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
      course_content.forEach((concept, index) => {
        if (!concept.concept_description || !concept.concept_description.trim()) {
          validationErrors.push({ field: `course_content[${index}].concept_description`, message: 'Concept description is required' });
        }
      });
    }

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

    if (!lecture_plan || !Array.isArray(lecture_plan) || lecture_plan.length === 0) {
      validationErrors.push({ field: 'lecture_plan', message: 'Lecture plan is required (at least one entry)' });
    } else {
      if (lecture_plan.length > 13) {
        validationErrors.push({ field: 'lecture_plan', message: 'Maximum 13 lecture plan entries allowed' });
      }
      
      const weeksSeen = new Set();
      const duplicateWeeks = [];
      
      const isWeekRequired = lecture_plan.length > 1;
      
      lecture_plan.forEach((item, index) => {
        if (isWeekRequired) {
          if (item.week === undefined || item.week === null) {
            validationErrors.push({ field: `lecture_plan[${index}].week`, message: 'Week is missing' });
          } else if (!Number.isInteger(item.week)) {
            validationErrors.push({ field: `lecture_plan[${index}].week`, message: 'Week must be an integer' });
          } else if (item.week < 1 || item.week > 13) {
            validationErrors.push({ field: `lecture_plan[${index}].week`, message: 'Week must be between 1 and 13' });
          } else {
            if (weeksSeen.has(item.week)) {
              duplicateWeeks.push(item.week);
            }
            weeksSeen.add(item.week);
          }
        } else if (item.week !== undefined && item.week !== null) {
          if (!Number.isInteger(item.week)) {
            validationErrors.push({ field: `lecture_plan[${index}].week`, message: 'Week must be an integer' });
          } else if (item.week < 1 || item.week > 13) {
            validationErrors.push({ field: `lecture_plan[${index}].week`, message: 'Week must be between 1 and 13' });
          }
        }
        
        if (item.plan === undefined || item.plan === null) {
          validationErrors.push({ field: `lecture_plan[${index}].plan`, message: 'Plan description is missing' });
        } else if (typeof item.plan !== 'string' || !item.plan.trim()) {
          validationErrors.push({ field: `lecture_plan[${index}].plan`, message: 'Plan description is required' });
        }
      });
      
      if (isWeekRequired && duplicateWeeks.length > 0) {
        const uniqueDuplicates = [...new Set(duplicateWeeks)];
        validationErrors.push({ 
          field: 'lecture_plan', 
          message: `Duplicate week numbers found: ${uniqueDuplicates.join(', ')}` 
        });
      }
    }

    if (references !== undefined && references !== null) {
      if (!Array.isArray(references)) {
        validationErrors.push({ field: 'references', message: 'References must be an array' });
      } else if (references.length > 0) {
        const cleanedReferences = references
          .filter(ref => ref && typeof ref === 'string' && ref.trim())
          .map(ref => ref.trim());
        
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

    if (category === 'OPTIONAL' && !elective_group) {
      return res.status(400).json({
        success: false,
        message: 'Elective group is required when category is OPTIONAL'
      });
    }

    if (semester !== undefined) {
      const semesterNum = Number(semester);
      if (!Number.isInteger(semesterNum) || semesterNum < 1 || semesterNum > 8) {
        return res.status(400).json({
          success: false,
          message: 'Semester must be an integer between 1 and 8'
        });
      }
    }

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

    if (courseOutcomes && Array.isArray(courseOutcomes) && courseOutcomes.length > 0) {
      for (const co of courseOutcomes) {
        if (!co.co_code || !co.description) {
          return res.status(400).json({
            success: false,
            message: 'Each course outcome must have co_code and description'
          });
        }

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

    if (elective_group !== undefined) courseData.elective_group = elective_group;
    if (term !== undefined) courseData.term = term;
    if (status) courseData.status = status;

    if (contactHours !== undefined) courseData.contactHours = contactHours;
    if (academicYear) {
      courseData.academicYear = academicYear.toString();
    }
    if (semester !== undefined) courseData.semester = semester;
    if (yearLevel !== undefined) courseData.yearLevel = yearLevel;
    if (prerequisites) courseData.prerequisites = prerequisites;

    if (courseOutcomes && Array.isArray(courseOutcomes) && courseOutcomes.length > 0) {
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        const [course] = await Course.create([courseData], { session });

        const createdCOs = [];
        const seenCOCodes = new Set();
        for (const coData of courseOutcomes) {
          const coCodeNorm = (coData.co_code || '').toUpperCase();
          if (seenCOCodes.has(coCodeNorm)) {
            continue;
          }
          seenCOCodes.add(coCodeNorm);
          const [courseOutcome] = await CourseOutcome.create([{
            course: course._id,
            co_code: coData.co_code,
            description: coData.description,
            co_po_correlation: coData.co_po_correlation || '',
            taxonomy_levels: coData.taxonomy_levels || []
          }], { session });

          createdCOs.push({
            ...courseOutcome.toObject(),
            po_mappings: coData.po_mappings || []
          });
        }

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

        await session.commitTransaction();
        session.endSession();

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
        await session.abortTransaction();
        session.endSession();

        console.error('Transaction error:', error);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        
        let errorDetails = [];
        if (error.errors) {
          errorDetails = Object.entries(error.errors).map(([key, err]) => {
            return `${key}: ${err.message}`;
          });
        }
        
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
      const course = await Course.create(courseData);

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

    const filter = {};
    if (course_offered_to) filter.course_offered_to = course_offered_to.toUpperCase();
    if (course_type) filter.course_type = course_type;
    if (category) filter.category = category.toUpperCase();
    if (elective_group) filter.elective_group = elective_group.toUpperCase();
    if (term) filter.term = parseInt(term);
    if (status) filter.status = status;

    if (req.user && req.user.role === 'teacher') {
      filter['assignedTeachers.teacher'] = req.user._id;
    }

    if (req.user && req.user.role === 'student') {
      if (req.user.roll && req.user.roll.length >= 4) {
        const batch = req.user.roll.substring(0, 2);
        const deptCode = req.user.roll.substring(2, 4);
        
        filter['assignedBatches'] = {
          $elemMatch: {
            batch: batch,
            deptCode: deptCode
          }
        };
      } else {
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

    if (req.query.lean === 'true') {
      const leanData = courses.map(course => {
        const obj = course.toObject();
        if (Array.isArray(obj.assignedBatches) && obj.assignedBatches.length > 1) {
          obj.assignedBatches = [obj.assignedBatches[obj.assignedBatches.length - 1]];
        }
        if (obj.assignedTeachers) {
          obj.assignedTeachers = obj.assignedTeachers.map(a => ({
            teacher: a.teacher,
            section: a.section,
            _id: a._id
          }));
        }
        return obj;
      });
      return res.status(200).json({ success: true, count: leanData.length, data: leanData });
    }

    const coursesWithOutcomes = await Promise.all(
      courses.map(async (course) => {
        const courseOutcomes = await CourseOutcome.find({ 
          course: course._id, 
          is_deleted: { $ne: true }
        });

        const outcomesWithMappings = await Promise.all(
          courseOutcomes.map(async (co) => {
            const poMappings = await COPOMapping.find({ course_outcome: co._id });
            return {
              ...co.toObject(),
              co_po_correlation: co.co_po_correlation || '',
              po_mappings: poMappings.map(m => ({
                program_outcome_code: m.program_outcome_code,
                level: m.level,
                _id: m._id
              }))
            };
          })
        );
        
        const courseObj = course.toObject();
        if (Array.isArray(courseObj.assignedBatches) && courseObj.assignedBatches.length > 1) {
          courseObj.assignedBatches = [courseObj.assignedBatches[courseObj.assignedBatches.length - 1]];
        }
        
        if (courseObj.assignedTeachers) {
          courseObj.assignedTeachers = courseObj.assignedTeachers.map(assignment => ({
            teacher: assignment.teacher,
            section: assignment.section,
            _id: assignment._id
          }));
        }
        
        return {
          ...courseObj,
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

exports.getCourse = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('assignedTeachers.teacher', 'name email designation');

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    const courseObj = course.toObject();
    if (Array.isArray(courseObj.assignedBatches) && courseObj.assignedBatches.length > 1) {
      courseObj.assignedBatches = [courseObj.assignedBatches[courseObj.assignedBatches.length - 1]];
    }
    
    if (courseObj.assignedTeachers) {
      courseObj.assignedTeachers = courseObj.assignedTeachers.map(assignment => ({
        teacher: assignment.teacher,
        section: assignment.section,
        _id: assignment._id
      }));
    }

    const courseOutcomes = await CourseOutcome.find({
      course: course._id,
      is_deleted: { $ne: true }
    });
    const outcomesWithMappings = await Promise.all(
      courseOutcomes.map(async (co) => {
        const poMappings = await COPOMapping.find({ course_outcome: co._id });
        return {
          ...co.toObject(),
          co_po_correlation: co.co_po_correlation || '',
          po_mappings: poMappings.map(m => ({
            program_outcome_code: m.program_outcome_code,
            level: m.level,
            _id: m._id
          }))
        };
      })
    );

    res.status(200).json({
      success: true,
      data: { ...courseObj, courseOutcomes: outcomesWithMappings }
    });

  } catch (error) {
    console.error('Get course error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching course'
    });
  }
};

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
      category,
      elective_group,
      kpa_mapping,
      term,
      status,
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

    const finalCategory = category !== undefined ? category : course.category;
    const finalElectiveGroup = elective_group !== undefined ? elective_group : course.elective_group;
    
    if (finalCategory === 'OPTIONAL' && !finalElectiveGroup) {
      return res.status(400).json({
        success: false,
        message: 'Elective group is required when category is OPTIONAL'
      });
    }

    if (semester !== undefined) {
      const semesterNum = Number(semester);
      if (!Number.isInteger(semesterNum) || semesterNum < 1 || semesterNum > 8) {
        return res.status(400).json({
          success: false,
          message: 'Semester must be an integer between 1 and 8'
        });
      }
    }

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
      
      const weeksSeen = new Set();
      const duplicateWeeks = [];
      
      const isWeekRequired = lecture_plan.length > 1;
      
      lecture_plan.forEach((item, index) => {
        if (isWeekRequired) {
          if (item.week === undefined || item.week === null) {
            validationErrors.push({ field: `lecture_plan[${index}].week`, message: 'Week is missing' });
          } else if (!Number.isInteger(item.week)) {
            validationErrors.push({ field: `lecture_plan[${index}].week`, message: 'Week must be an integer' });
          } else if (item.week < 1 || item.week > 13) {
            validationErrors.push({ field: `lecture_plan[${index}].week`, message: 'Week must be between 1 and 13' });
          } else {
            if (weeksSeen.has(item.week)) {
              duplicateWeeks.push(item.week);
            }
            weeksSeen.add(item.week);
          }
        } else if (item.week !== undefined && item.week !== null) {
          if (!Number.isInteger(item.week)) {
            validationErrors.push({ field: `lecture_plan[${index}].week`, message: 'Week must be an integer' });
          } else if (item.week < 1 || item.week > 13) {
            validationErrors.push({ field: `lecture_plan[${index}].week`, message: 'Week must be between 1 and 13' });
          }
        }
        
        if (item.plan === undefined || item.plan === null) {
          validationErrors.push({ field: `lecture_plan[${index}].plan`, message: 'Plan description is missing' });
        } else if (typeof item.plan !== 'string' || !item.plan.trim()) {
          validationErrors.push({ field: `lecture_plan[${index}].plan`, message: 'Plan description is required' });
        }
      });
      
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

    if (references !== undefined && references !== null) {
      if (!Array.isArray(references)) {
        return res.status(400).json({
          success: false,
          message: 'References must be an array'
        });
      }
      
      if (references.length > 0) {
        const cleanedReferences = references
          .filter(ref => ref && typeof ref === 'string' && ref.trim())
          .map(ref => ref.trim());
        
        req.body.references = cleanedReferences;
      }
    }

    if (courseOutcomes && Array.isArray(courseOutcomes) && courseOutcomes.length > 0) {
      for (const co of courseOutcomes) {
        if (!co.co_code || !co.description) {
          return res.status(400).json({
            success: false,
            message: 'Each course outcome must have co_code and description'
          });
        }

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

    if ((courseOutcomes && courseOutcomes.length > 0) || (deletedCOIds && deletedCOIds.length > 0)) {
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        if (courseCode) course.courseCode = courseCode;
        if (courseTitle) course.courseTitle = courseTitle;
        if (course_type !== undefined) course.course_type = course_type;
        if (credit !== undefined) course.credit = credit;
        if (course_offered_to) course.course_offered_to = course_offered_to;

        if (category !== undefined) course.category = category;
        if (elective_group !== undefined) course.elective_group = elective_group;
        if (kpa_mapping !== undefined) course.kpa_mapping = kpa_mapping;
        if (term !== undefined) course.term = term;
        if (status !== undefined) course.status = status;

        if (contactHours !== undefined) course.contactHours = contactHours;
        if (academicYear !== undefined) {
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

        course.lastReviewed = Date.now();
        course.reviewedBy = req.user._id;

        await course.save({ session });

        let coStats = { added: 0, updated: 0, deleted: 0, softDeleted: 0 };
        let mappingStats = { added: 0, updated: 0, deleted: 0 };

        if (deletedCOIds && Array.isArray(deletedCOIds) && deletedCOIds.length > 0) {
          for (const coId of deletedCOIds) {
            const co = await CourseOutcome.findById(coId).session(session);
            if (co) {
              const mappingCount = await COPOMapping.countDocuments({ 
                course_outcome: coId 
              }).session(session);

              if (mappingCount > 0) {
                co.is_deleted = true;
                co.deleted_at = new Date();
                co.deleted_reason = 'Removed during course update';
                await co.save({ session });
                coStats.softDeleted++;
              } else {
                await CourseOutcome.findByIdAndDelete(coId, { session });
                await COPOMapping.deleteMany({ course_outcome: coId }, { session });
                coStats.deleted++;
              }
            }
          }
        }

        if (courseOutcomes && Array.isArray(courseOutcomes)) {
          for (const coData of courseOutcomes) {
            let targetCO = null;

            if (coData._id) {
              targetCO = await CourseOutcome.findById(coData._id).session(session);
              if (targetCO) {
                const newCode = (coData.co_code || '').toUpperCase();
                if (targetCO.co_code !== newCode) {
                  await CourseOutcome.deleteOne({
                    course: course._id,
                    co_code: newCode,
                    is_deleted: true
                  }, { session });
                }
                targetCO.co_code = newCode;
                targetCO.description = coData.description;
                targetCO.co_po_correlation = coData.co_po_correlation || '';
                targetCO.taxonomy_levels = coData.taxonomy_levels || [];
                targetCO.is_deleted = false;
                await targetCO.save({ session });
                coStats.updated++;
              }
            }

            if (!targetCO) {
              const coCodeNorm = (coData.co_code || '').toUpperCase();

              await CourseOutcome.deleteOne({
                course: course._id,
                co_code: coCodeNorm,
                is_deleted: true
              }, { session });

              targetCO = await CourseOutcome.findOne({
                course: course._id,
                co_code: coCodeNorm,
                is_deleted: { $ne: true }
              }).session(session);

              if (targetCO) {
                targetCO.description = coData.description;
                targetCO.co_po_correlation = coData.co_po_correlation || '';
                targetCO.taxonomy_levels = coData.taxonomy_levels || [];
                await targetCO.save({ session });
                coStats.updated++;
              } else {
                const [newCO] = await CourseOutcome.create([{
                  course: course._id,
                  co_code: coCodeNorm,
                  description: coData.description,
                  co_po_correlation: coData.co_po_correlation || '',
                  taxonomy_levels: coData.taxonomy_levels || []
                }], { session });
                targetCO = newCO;
                coStats.added++;
              }
            }

            if (targetCO && coData.po_mappings && Array.isArray(coData.po_mappings)) {
              const deletedMappings = await COPOMapping.deleteMany({
                course_outcome: targetCO._id
              }, { session });
              mappingStats.deleted += deletedMappings.deletedCount;

              if (coData.po_mappings.length > 0) {
                const mappingsToCreate = coData.po_mappings.map(mapping => ({
                  course_outcome: targetCO._id,
                  program_outcome_code: mapping.program_outcome_code.toUpperCase(),
                  level: Number(mapping.level)
                }));
                await COPOMapping.create(mappingsToCreate, { session, ordered: true });
                mappingStats.added += mappingsToCreate.length;
              }
            }
          }
        }

        await session.commitTransaction();
        session.endSession();

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
      
      if (courseTitle) course.courseTitle = courseTitle;
      if (course_type !== undefined) course.course_type = course_type;
      if (credit !== undefined) course.credit = credit;
      if (course_offered_to) course.course_offered_to = course_offered_to;

      if (category !== undefined) course.category = category;
      if (elective_group !== undefined) course.elective_group = elective_group;
      if (kpa_mapping !== undefined) course.kpa_mapping = kpa_mapping;
      if (term !== undefined) course.term = term;
      if (status !== undefined) course.status = status;

      if (contactHours !== undefined) course.contactHours = contactHours;
      if (academicYear !== undefined) {
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
    
    let errorDetails = [];
    if (error.errors) {
      errorDetails = Object.entries(error.errors).map(([key, err]) => {
        return `${key}: ${err.message}`;
      });
    }
    
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

exports.deleteCourse = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    const courseOutcomes = await CourseOutcome.find({ course: course._id });
    const coIds = courseOutcomes.map(co => co._id);
    
    if (coIds.length > 0) {
      await COPOMapping.deleteMany({ course_outcome: { $in: coIds } });
    }

    await CourseOutcome.deleteMany({ course: course._id });

    await Course.findByIdAndDelete(req.params.id);

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


exports.validateCourseOBE = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    let courseOutcomes = await CourseOutcome.find({
      course: course._id,
      is_deleted: { $ne: true }
    });
    
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
    
    const transformedOutcomes = outcomesWithMappings.map(co => {
      const poMapping = {};
      if (co.po_mappings && co.po_mappings.length > 0) {
        co.po_mappings.forEach(mapping => {
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


exports.getCourseStudents = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { section } = req.query; // Optional section filter for theory courses

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    if (req.user.role === 'teacher') {
      const isAssigned = course.assignedTeachers.some(assignment => {
        const teacherId = assignment.teacher?._id || assignment.teacher;
        const matches = teacherId.toString() === req.user._id.toString();
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

    const User = require('../models/User');
    const assignedBatches = course.assignedBatches || [];
    
    if (assignedBatches.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No batches assigned to this course yet',
        data: []
      });
    }

    const students = await User.find({
      role: 'student',
      isActive: true,
      isEmailVerified: true,
      isApprovedByAdmin: true
    }).select('name roll email department');
    
    const enrolledStudents = students.filter(student => {
      let roll = student.roll;
      if (!roll && student.email) {
        const match = student.email.match(/^(\d+)/);
        if (match) {
          roll = match[1];
        }
      }
      
      if (!roll || roll.length < 4) {
        return false;
      }
      
      const batch = roll.substring(0, 2);
      const deptCode = roll.substring(2, 4);
      
      const matches = assignedBatches.some(assignment => 
        assignment.batch === batch && assignment.deptCode === deptCode
      );
      
      return matches;
    });

    const studentsWithRoll = enrolledStudents.map(student => {
      let roll = student.roll;
      if (!roll && student.email) {
        const match = student.email.match(/^(\d+)/);
        if (match) {
          roll = match[1];
        }
      }
      return {
        ...student.toObject(),
        roll: roll
      };
    });

    studentsWithRoll.sort((a, b) => {
      if (!a.roll) return 1;
      if (!b.roll) return -1;
      return a.roll.localeCompare(b.roll);
    });

    res.status(200).json({
      success: true,
      count: studentsWithRoll.length,
      courseInfo: {
        courseCode: course.courseCode,
        courseTitle: course.courseTitle,
        course_type: course.course_type
      },
      data: studentsWithRoll
    });

  } catch (error) {
    console.error('Get course students error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching students'
    });
  }
};


