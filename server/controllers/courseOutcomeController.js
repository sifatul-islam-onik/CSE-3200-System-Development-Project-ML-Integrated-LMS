const CourseOutcome = require('../models/CourseOutcome');
const Course = require('../models/Course');
const { validationResult } = require('express-validator');

function getPairCourseCode(courseCode) {
  const lastDigit = parseInt(courseCode.slice(-1));
  if (isNaN(lastDigit)) return null;
  const baseCode = courseCode.slice(0, -1);
  const pairLastDigit = lastDigit % 2 === 1 ? lastDigit + 1 : lastDigit - 1;
  const pairCode = baseCode + pairLastDigit;
  const firstTwo = (code) => (code.match(/\d+/)?.[0] || '').slice(0, 2);
  if (firstTwo(courseCode) !== firstTwo(pairCode)) return null;
  return pairCode;
}

exports.createCourseOutcomes = async (req, res) => {
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

    const { courseId } = req.params;
    const { outcomes } = req.body; // Array of {co_code, description}

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    if (!Array.isArray(outcomes) || outcomes.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Outcomes must be a non-empty array'
      });
    }

    let pairCourseOutcomes = [];
    let pairCourseCode = null;
    const pairCode = getPairCourseCode(course.courseCode);
    if (pairCode) {
      const pairCourse = await Course.findOne({ courseCode: pairCode });
      if (pairCourse) {
        pairCourseCode = pairCode;
        pairCourseOutcomes = await CourseOutcome.find({
          course: pairCourse._id,
          is_deleted: { $ne: true }
        });
      }
    }

    const createdOutcomes = [];
    
    const coCodes = outcomes.map(o => o.co_code ? o.co_code.toUpperCase() : null).filter(Boolean);
    
    const existingCOs = await CourseOutcome.find({
      course: courseId,
      co_code: { $in: coCodes }
    }).select('co_code').lean();
    
    const existingCOSet = new Set(existingCOs.map(co => co.co_code));
    const processedOutcomes = [];

    for (const outcome of outcomes) {
      const { co_code, description } = outcome;

      if (!co_code || !description) {
        return res.status(400).json({
          success: false,
          message: 'Each outcome must have co_code and description'
        });
      }

      if (existingCOSet.has(co_code.toUpperCase())) {
        return res.status(400).json({
          success: false,
          message: `Duplicate CO code: ${co_code}`
        });
      }

      if (pairCourseOutcomes.length > 0) {
        const pairMatch = pairCourseOutcomes.find(
          p => p.co_code === co_code.toUpperCase()
        );
        if (pairMatch && pairMatch.description.trim() !== description.trim()) {
          return res.status(400).json({
            success: false,
            message: `CO ${co_code.toUpperCase()} already exists in the paired course ${pairCourseCode} with different description. Both paired courses must have identical content for matching CO codes.`
          });
        }
      }

      processedOutcomes.push({
        course: courseId,
        co_code: co_code.toUpperCase(),
        description
      });
    }

    if (processedOutcomes.length > 0) {
      const inserted = await CourseOutcome.insertMany(processedOutcomes);
      createdOutcomes.push(...inserted);
    }

    res.status(201).json({
      success: true,
      message: 'Course outcomes created successfully',
      data: createdOutcomes
    });
  } catch (error) {
    console.error('Create course outcomes error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating course outcomes',
      error: error.message
    });
  }
};

exports.getCourseOutcomes = async (req, res) => {
  try {
    const { courseId } = req.params;

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    let outcomes = await CourseOutcome.find({ course: courseId })
      .sort({ co_code: 1 });

    const courseCode = course.courseCode;
    const codeMatch = courseCode.match(/^([A-Z]+)\s*(\d+)$/i);
    
    if (codeMatch) {
      const prefix = codeMatch[1];
      const number = parseInt(codeMatch[2]);
      
      const isLab = number % 2 === 0;
      const theoryCode = isLab ? `${prefix} ${number - 1}` : courseCode;
      const labCode = `${prefix} ${isLab ? number : number + 1}`;
      
      const relatedCourseCode = isLab ? theoryCode : labCode;
      
      try {
        const relatedCourse = await Course.findOne({ 
          courseCode: { $regex: new RegExp(`^${relatedCourseCode}$`, 'i') }
        });
        
        if (relatedCourse) {
          const relatedOutcomes = await CourseOutcome.find({ 
            course: relatedCourse._id 
          }).sort({ co_code: 1 });
          
          const coMap = new Map();
          
          [...outcomes, ...relatedOutcomes].forEach(co => {
            const coCode = co.co_code.toUpperCase();
            if (!coMap.has(coCode)) {
              coMap.set(coCode, co);
            }
          });
          
          outcomes = Array.from(coMap.values()).sort((a, b) => 
            a.co_code.localeCompare(b.co_code)
          );
        }
      } catch (err) {

      }
    }

    res.status(200).json({
      success: true,
      data: outcomes
    });
  } catch (error) {
    console.error('Get course outcomes error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching course outcomes',
      error: error.message
    });
  }
};

exports.updateCourseOutcome = async (req, res) => {
  try {
    const { courseId, outcomeId } = req.params;
    const { co_code, description, co_po_correlation } = req.body;

    const isTeacher = req.user.role === 'teacher';
    if (isTeacher && (co_code !== undefined || description !== undefined)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Teachers can only update CO-PO correlation.'
      });
    }
    if (!isTeacher && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const outcome = await CourseOutcome.findOne({
      _id: outcomeId,
      course: courseId
    });

    if (!outcome) {
      return res.status(404).json({
        success: false,
        message: 'Course outcome not found'
      });
    }

    if (co_code && co_code.toUpperCase() !== outcome.co_code) {
      const existing = await CourseOutcome.findOne({
        course: courseId,
        co_code: co_code.toUpperCase(),
        _id: { $ne: outcomeId }
      });

      if (existing) {
        return res.status(400).json({
          success: false,
          message: `CO code ${co_code} already exists for this course`
        });
      }
    }

    if (co_code) outcome.co_code = co_code;

    const newDescription = description !== undefined ? description : outcome.description;
    if (description !== undefined && description.trim() !== outcome.description.trim()) {
      const fullCourse = await Course.findById(courseId);
      const pairCode = fullCourse ? getPairCourseCode(fullCourse.courseCode) : null;
      if (pairCode) {
        const pairCourse = await Course.findOne({ courseCode: pairCode });
        if (pairCourse) {
          const effectiveCoCode = co_code ? co_code.toUpperCase() : outcome.co_code;
          const pairMatch = await CourseOutcome.findOne({
            course: pairCourse._id,
            co_code: effectiveCoCode,
            is_deleted: { $ne: true }
          });
          if (pairMatch && pairMatch.description.trim() !== description.trim()) {
            return res.status(400).json({
              success: false,
              message: `CO ${effectiveCoCode} already exists in the paired course ${pairCode} with different description. Both paired courses must have identical content for matching CO codes.`
            });
          }
        }
      }
    }

    if (description) outcome.description = description;
    if (co_po_correlation !== undefined) outcome.co_po_correlation = co_po_correlation;

    await outcome.save();

    res.status(200).json({
      success: true,
      message: 'Course outcome updated successfully',
      data: outcome
    });
  } catch (error) {
    console.error('Update course outcome error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating course outcome',
      error: error.message
    });
  }
};

exports.deleteCourseOutcome = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const { courseId, outcomeId } = req.params;

    const outcome = await CourseOutcome.findOneAndDelete({
      _id: outcomeId,
      course: courseId
    });

    if (!outcome) {
      return res.status(404).json({
        success: false,
        message: 'Course outcome not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Course outcome deleted successfully'
    });
  } catch (error) {
    console.error('Delete course outcome error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting course outcome',
      error: error.message
    });
  }
};

exports.deleteAllCourseOutcomes = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const { courseId } = req.params;

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    const result = await CourseOutcome.deleteMany({ course: courseId });

    res.status(200).json({
      success: true,
      message: `Deleted ${result.deletedCount} course outcome(s)`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Delete all course outcomes error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting course outcomes',
      error: error.message
    });
  }
};

exports.getCourseProfileData = async (req, res) => {
  try {
    const { courseCode } = req.params;
    const COPOMapping = require('../models/COPOMapping');

    const course = await Course.findOne({ courseCode: courseCode.toUpperCase() });
    if (!course) {
      return res.status(404).json({
        success: false,
        error: 'Course not found'
      });
    }

    let courseOutcomes = await CourseOutcome.find({ 
      course: course._id,
      is_deleted: false 
    }).sort({ co_code: 1 });

    const ownOnly = req.query.ownOnly === 'true';

    if (!ownOnly) {
      const codeMatch = courseCode.match(/^([A-Z]+)\s*(\d+)$/i);

      if (codeMatch) {
        const prefix = codeMatch[1];
        const number = parseInt(codeMatch[2]);

        const isLab = number % 2 === 0;
        const relatedCourseCode = isLab
          ? `${prefix} ${number - 1}`
          : `${prefix} ${number + 1}`;

        try {
          const relatedCourse = await Course.findOne({
            courseCode: { $regex: new RegExp(`^${relatedCourseCode}$`, 'i') }
          });

          if (relatedCourse) {
            const relatedOutcomes = await CourseOutcome.find({
              course: relatedCourse._id,
              is_deleted: false
            }).sort({ co_code: 1 });

            const ownCoCodes = new Set(courseOutcomes.map(co => co.co_code.toUpperCase()));
            const relatedCoCodes = new Set(relatedOutcomes.map(co => co.co_code.toUpperCase()));

            const coMap = new Map();
            [...courseOutcomes, ...relatedOutcomes].forEach(co => {
              const coCode = co.co_code.toUpperCase();
              if (!coMap.has(coCode)) {
                coMap.set(coCode, co);
              }
            });

            const currentType = isLab ? 'lab' : 'theory';
            const relatedType = isLab ? 'theory' : 'lab';

            coMap.forEach((co, coCode) => {
              const inOwn = ownCoCodes.has(coCode);
              const inRelated = relatedCoCodes.has(coCode);
              if (inOwn && inRelated) {
                co._sourceType = 'both';
              } else if (inOwn) {
                co._sourceType = currentType;
              } else {
                co._sourceType = relatedType;
              }
            });

            courseOutcomes = Array.from(coMap.values()).sort((a, b) =>
              a.co_code.localeCompare(b.co_code)
            );
          }
        } catch (err) {
        }
      }
    }

    const codeMatchForType = courseCode.match(/^([A-Z]+)\s*(\d+)$/i);
    const currentCourseType = (codeMatchForType && parseInt(codeMatchForType[2]) % 2 === 0) ? 'lab' : 'theory';

    const coIds = courseOutcomes.map(co => co._id);
    const copoMappings = await COPOMapping.find({ 
      course_outcome: { $in: coIds } 
    });

    const poCodeToNumber = {
      'PO_A': 1, 'PO_B': 2, 'PO_C': 3, 'PO_D': 4,
      'PO_E': 5, 'PO_F': 6, 'PO_G': 7, 'PO_H': 8,
      'PO_I': 9, 'PO_J': 10, 'PO_K': 11, 'PO_L': 12
    };

    const profileData = courseOutcomes.map(co => {
      const bloomLevels = {
        cognitive: '',
        affective: '',
        psychomotor: '',
        social: ''
      };

      co.taxonomy_levels.forEach(level => {
        const prefix = level.charAt(0);
        const number = level.substring(1);
        
        if (prefix === 'C') bloomLevels.cognitive = number;
        else if (prefix === 'A') bloomLevels.affective = number;
        else if (prefix === 'P') bloomLevels.psychomotor = number;
        else if (prefix === 'S') bloomLevels.social = number;
      });

      const coMappings = copoMappings.filter(
        m => m.course_outcome.toString() === co._id.toString()
      );

      const mappedPos = coMappings
        .filter(m => m.level === 1)
        .map(m => poCodeToNumber[m.program_outcome_code])
        .filter(n => n !== undefined)
        .sort((a, b) => a - b);

      return {
        _id: co._id,
        co_code: co.co_code,
        cloNumber: co.co_code.replace('CO', 'CLO'),
        description: co.description,
        bloomLevels,
        ploAssessed: mappedPos.join(', '),
        cloPloCorrelation: co.co_po_correlation || '',
        sourceType: co._sourceType || currentCourseType // 'theory', 'lab', or 'both'
      };
    });

    res.json({
      success: true,
      data: profileData
    });
  } catch (error) {
    console.error('Error fetching course profile data:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
