const CourseProposal = require('../models/CourseProposal');
const Course = require('../models/Course');
const CourseOutcome = require('../models/CourseOutcome');
const COPOMapping = require('../models/COPOMapping');
const mongoose = require('mongoose');

// @desc    Create a new course proposal
// @route   POST /api/course-proposals
// @access  Teacher
exports.createCourseProposal = async (req, res) => {
  try {
    const {
      proposalType,
      existingCourseId,
      courseData,
      changeDescription
    } = req.body;

    // Validate proposal type
    if (!proposalType || !['CREATE', 'UPDATE'].includes(proposalType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid proposal type. Must be CREATE or UPDATE'
      });
    }

    // If UPDATE, validate existing course
    if (proposalType === 'UPDATE') {
      if (!existingCourseId) {
        return res.status(400).json({
          success: false,
          message: 'Existing course ID is required for UPDATE proposals'
        });
      }

      const existingCourse = await Course.findById(existingCourseId);
      if (!existingCourse) {
        return res.status(404).json({
          success: false,
          message: 'Course not found'
        });
      }
    }

    // Check for duplicate course code in CREATE proposals
    if (proposalType === 'CREATE') {
      const existingCourse = await Course.findOne({ 
        courseCode: courseData.courseCode.toUpperCase() 
      });
      if (existingCourse) {
        return res.status(400).json({
          success: false,
          message: 'Course with this code already exists'
        });
      }

      // Check for pending proposals with same course code
      const pendingProposal = await CourseProposal.findOne({
        'proposedData.courseCode': courseData.courseCode.toUpperCase(),
        status: 'PENDING',
        proposalType: 'CREATE'
      });
      if (pendingProposal) {
        return res.status(400).json({
          success: false,
          message: 'A pending proposal with this course code already exists'
        });
      }
    }

    // Check for existing pending proposal for UPDATE
    if (proposalType === 'UPDATE') {
      const pendingProposal = await CourseProposal.findOne({
        existingCourse: existingCourseId,
        status: 'PENDING',
        proposalType: 'UPDATE'
      });
      if (pendingProposal) {
        return res.status(400).json({
          success: false,
          message: 'A pending update proposal already exists for this course'
        });
      }
    }

    // Create proposal
    const proposal = await CourseProposal.create({
      proposalType,
      existingCourse: proposalType === 'UPDATE' ? existingCourseId : undefined,
      proposedData: courseData,
      proposedBy: req.user._id,
      changeDescription
    });

    await proposal.populate('proposedBy', 'name email');
    if (proposalType === 'UPDATE') {
      await proposal.populate('existingCourse', 'courseCode courseTitle');
    }

    res.status(201).json({
      success: true,
      message: 'Course proposal submitted successfully. Waiting for admin approval.',
      data: proposal
    });
  } catch (error) {
    console.error('Create proposal error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create course proposal',
      error: error.message
    });
  }
};

// @desc    Get all course proposals
// @route   GET /api/course-proposals
// @access  Admin
exports.getAllProposals = async (req, res) => {
  try {
    const { status, proposalType, proposedBy } = req.query;

    const filter = {};
    if (status) filter.status = status.toUpperCase();
    if (proposalType) filter.proposalType = proposalType.toUpperCase();
    if (proposedBy) filter.proposedBy = proposedBy;

    const proposals = await CourseProposal.find(filter)
      .populate('proposedBy', 'name email role')
      .populate('existingCourse', 'courseCode courseTitle')
      .populate('reviewedBy', 'name email')
      .sort({ proposedAt: -1 });

    res.json({
      success: true,
      count: proposals.length,
      data: proposals
    });
  } catch (error) {
    console.error('Get proposals error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch proposals',
      error: error.message
    });
  }
};

// @desc    Get teacher's own proposals
// @route   GET /api/course-proposals/my-proposals
// @access  Teacher
exports.getMyProposals = async (req, res) => {
  try {
    const { status } = req.query;

    const filter = { proposedBy: req.user._id };
    if (status) filter.status = status.toUpperCase();

    const proposals = await CourseProposal.find(filter)
      .populate('existingCourse', 'courseCode courseTitle')
      .populate('reviewedBy', 'name email')
      .sort({ proposedAt: -1 });

    res.json({
      success: true,
      count: proposals.length,
      data: proposals
    });
  } catch (error) {
    console.error('Get my proposals error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch proposals',
      error: error.message
    });
  }
};

// @desc    Get single proposal
// @route   GET /api/course-proposals/:id
// @access  Admin/Teacher (own)
exports.getProposalById = async (req, res) => {
  try {
    const proposal = await CourseProposal.findById(req.params.id)
      .populate('proposedBy', 'name email role')
      .populate('existingCourse')
      .populate('reviewedBy', 'name email');

    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: 'Proposal not found'
      });
    }

    // Teachers can only view their own proposals
    if (req.user.role === 'teacher' && proposal.proposedBy._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // For UPDATE proposals, attach courseOutcomes to existingCourse (they are in a separate collection)
    let proposalData = proposal.toObject();
    if (proposalData.proposalType === 'UPDATE' && proposalData.existingCourse && proposalData.existingCourse._id) {
      const existingCourseId = proposalData.existingCourse._id;
      const courseOutcomes = await CourseOutcome.find({ course: existingCourseId, is_deleted: { $ne: true } }).lean();
      const outcomesWithMappings = await Promise.all(
        courseOutcomes.map(async (co) => {
          const mappings = await COPOMapping.find({ course_outcome: co._id }).lean();
          return { ...co, po_mappings: mappings };
        })
      );
      proposalData.existingCourse = { ...proposalData.existingCourse, courseOutcomes: outcomesWithMappings };
    }

    res.json({
      success: true,
      data: proposalData
    });
  } catch (error) {
    console.error('Get proposal error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch proposal',
      error: error.message
    });
  }
};

// @desc    Approve course proposal
// @route   PUT /api/course-proposals/:id/approve
// @access  Admin only
exports.approveProposal = async (req, res) => {
  console.log('=== Approve Proposal Started ===');
  console.log('Proposal ID:', req.params.id);
  console.log('Review Comments:', req.body.reviewComments);
  try {
    const { reviewComments } = req.body;

    const proposal = await CourseProposal.findById(req.params.id);
    console.log('Proposal found:', proposal ? 'YES' : 'NO');

    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: 'Proposal not found'
      });
    }

    if (proposal.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: `Proposal has already been ${proposal.status.toLowerCase()}`
      });
    }

    // Normalize helper to align proposed data with Course schema expectations
    const normalizeCourseData = (raw) => {
      const data = { ...(raw || {}) };
      // Ensure uppercase enums/strings where applicable
      if (typeof data.course_type === 'string') data.course_type = data.course_type.toUpperCase();
      if (typeof data.category === 'string') data.category = data.category.toUpperCase();
      if (typeof data.course_offered_to === 'string') data.course_offered_to = data.course_offered_to.toUpperCase();
      // Elective group should be null for COMPULSORY
      if (data.category === 'COMPULSORY') {
        data.elective_group = null;
      }
      // Academic year should be a string; Course model will format YYYY -> YYYY-YY
      if (typeof data.academicYear === 'number') data.academicYear = String(data.academicYear);
      // Trim arrays of strings
      const trimArray = (arr) => Array.isArray(arr) ? arr.map(v => (typeof v === 'string' ? v.trim() : v)).filter(v => !(typeof v === 'string' && v === '')) : arr;
      data.prerequisites = trimArray(data.prerequisites);
      data.knowledge_required = trimArray(data.knowledge_required);
      data.course_objectives = trimArray(data.course_objectives);
      data.references = trimArray(data.references);
      // Ensure course_content items have trimmed strings
      if (Array.isArray(data.course_content)) {
        data.course_content = data.course_content.map(item => ({
          concept_name: item?.concept_name?.trim(),
          concept_description: item?.concept_description?.trim()
        }));
      }
      // Sort lecture_plan by week and coerce week to number
      if (Array.isArray(data.lecture_plan)) {
        data.lecture_plan = data.lecture_plan.map(lp => ({
          week: typeof lp.week === 'string' ? parseInt(lp.week, 10) : lp.week,
          plan: lp?.plan?.trim()
        })).sort((a, b) => (a.week || 0) - (b.week || 0));
      }
      // Uppercase kpa_mapping entries
      if (Array.isArray(data.kpa_mapping)) {
        data.kpa_mapping = data.kpa_mapping.map(k => (typeof k === 'string' ? k.toUpperCase() : k));
      }
      return data;
    };

    // Attempt to start a transaction (optional)
    let session = null;
    let useSession = false;
    try {
      session = await mongoose.startSession();
      session.startTransaction();
      useSession = true;
    } catch (txnErr) {
      console.warn('Transactions unavailable, proceeding without session:', txnErr.message);
    }

    try {
      console.log('Proposal Type:', proposal.proposalType);
      if (proposal.proposalType === 'CREATE') {
        console.log('Creating new course...');
        // Create new course
        const courseData = {
          ...normalizeCourseData(proposal.proposedData),
          createdBy: proposal.proposedBy
        };
        console.log('Normalized course data:', JSON.stringify(courseData, null, 2));

        // Extract courseOutcomes if present
        const courseOutcomes = courseData.courseOutcomes;
        delete courseData.courseOutcomes;

        let course;
        if (useSession) {
          const created = await Course.create([courseData], { session });
          course = created[0];
        } else {
          course = await Course.create(courseData);
        }

        // Create course outcomes if provided
        if (courseOutcomes && courseOutcomes.length > 0) {
          for (const coData of courseOutcomes) {
            let courseOutcome;
            if (useSession) {
              const createdCO = await CourseOutcome.create([{
                course: course._id,
                co_code: coData.co_code,
                description: coData.description,
                taxonomy_levels: coData.taxonomy_levels || []
              }], { session });
              courseOutcome = createdCO[0];
            } else {
              courseOutcome = await CourseOutcome.create({
                course: course._id,
                co_code: coData.co_code,
                description: coData.description,
                taxonomy_levels: coData.taxonomy_levels || []
              });
            }

            // Create CO-PO mappings
            if (coData.po_mappings && coData.po_mappings.length > 0) {
              const mappingsToCreate = coData.po_mappings.map(mapping => ({
                course_outcome: courseOutcome._id,
                program_outcome_code: mapping.program_outcome_code.toUpperCase(),
                level: Number(mapping.level)
              }));

              if (useSession) {
                await COPOMapping.create(mappingsToCreate, { session, ordered: true });
              } else {
                await COPOMapping.create(mappingsToCreate);
              }
            }
          }
        }

      } else if (proposal.proposalType === 'UPDATE') {
        // Update existing course
        const course = useSession
          ? await Course.findById(proposal.existingCourse).session(session)
          : await Course.findById(proposal.existingCourse);

        if (!course) {
          throw new Error('Course not found');
        }

        const updateData = { ...normalizeCourseData(proposal.proposedData) };
        const hasCourseOutcomes = Object.prototype.hasOwnProperty.call(updateData, 'courseOutcomes');
        const courseOutcomes = updateData.courseOutcomes;
        delete updateData.courseOutcomes;

        // Update course fields
        Object.assign(course, updateData);
        course.lastReviewed = Date.now();
        course.reviewedBy = req.user._id;
        if (useSession) {
          await course.save({ session });
        } else {
          await course.save();
        }

        // Handle course outcomes if the field was provided (including empty array to clear)
        if (hasCourseOutcomes) {
          // Delete existing outcomes and mappings
          const existingCOs = useSession
            ? await CourseOutcome.find({ course: course._id }).session(session)
            : await CourseOutcome.find({ course: course._id });
          for (const co of existingCOs) {
            if (useSession) {
              await COPOMapping.deleteMany({ course_outcome: co._id }, { session });
            } else {
              await COPOMapping.deleteMany({ course_outcome: co._id });
            }
          }
          if (useSession) {
            await CourseOutcome.deleteMany({ course: course._id }, { session });
          } else {
            await CourseOutcome.deleteMany({ course: course._id });
          }

          // Re-create outcomes only when the array is non-empty
          if (Array.isArray(courseOutcomes) && courseOutcomes.length > 0) {
            for (const coData of courseOutcomes) {
              let courseOutcome;
              if (useSession) {
                const createdCO = await CourseOutcome.create([{
                  course: course._id,
                  co_code: coData.co_code,
                  description: coData.description,
                  taxonomy_levels: coData.taxonomy_levels || []
                }], { session });
                courseOutcome = createdCO[0];
              } else {
                courseOutcome = await CourseOutcome.create({
                  course: course._id,
                  co_code: coData.co_code,
                  description: coData.description,
                  taxonomy_levels: coData.taxonomy_levels || []
                });
              }

              if (coData.po_mappings && coData.po_mappings.length > 0) {
                const mappingsToCreate = coData.po_mappings.map(mapping => ({
                  course_outcome: courseOutcome._id,
                  program_outcome_code: mapping.program_outcome_code.toUpperCase(),
                  level: Number(mapping.level)
                }));
                if (useSession) {
                  await COPOMapping.create(mappingsToCreate, { session, ordered: true });
                } else {
                  await COPOMapping.create(mappingsToCreate);
                }
              }
            }
          }
        }
      }

      // Update proposal status
      proposal.status = 'APPROVED';
      proposal.reviewedBy = req.user._id;
      proposal.reviewedAt = Date.now();
      proposal.reviewComment = reviewComments || '';
      if (useSession) {
        await proposal.save({ session });
      } else {
        await proposal.save();
      }

      if (useSession) {
        await session.commitTransaction();
        session.endSession();
      }

      await proposal.populate('proposedBy', 'name email');
      await proposal.populate('reviewedBy', 'name email');

      res.json({
        success: true,
        message: 'Proposal approved and changes applied successfully',
        data: proposal
      });

    } catch (error) {
      if (useSession && session) {
        try { await session.abortTransaction(); } catch {}
        try { session.endSession(); } catch {}
      }
      throw error;
    }
  } catch (error) {
    console.error('=== Approve proposal error ===');
    console.error('Error type:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Full error:', error);
    // Surface validation and duplicate key errors clearly to client
    if (error && (error.name === 'ValidationError' || error.errors)) {
      const errors = {};
      for (const key in (error.errors || {})) {
        errors[key] = error.errors[key].message || 'Invalid value';
      }
      return res.status(400).json({
        success: false,
        message: 'Validation failed while approving proposal',
        errors
      });
    }
    if (error && error.code === 11000) {
      // Duplicate key (likely courseCode unique index)
      return res.status(400).json({
        success: false,
        message: 'Duplicate value detected. A course with this code may already exist.',
        error: error.message
      });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to approve proposal',
      error: error.message
    });
  }
};

// @desc    Reject course proposal
// @route   PUT /api/course-proposals/:id/reject
// @access  Admin only
exports.rejectProposal = async (req, res) => {
  try {
    const { reviewComments } = req.body;

    const proposal = await CourseProposal.findById(req.params.id);

    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: 'Proposal not found'
      });
    }

    if (proposal.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: `Proposal has already been ${proposal.status.toLowerCase()}`
      });
    }

    proposal.status = 'REJECTED';
    proposal.reviewedBy = req.user._id;
    proposal.reviewedAt = Date.now();
    proposal.reviewComment = reviewComments || '';
    await proposal.save();

    await proposal.populate('proposedBy', 'name email');
    await proposal.populate('reviewedBy', 'name email');

    res.json({
      success: true,
      message: 'Proposal rejected',
      data: proposal
    });
  } catch (error) {
    console.error('Reject proposal error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject proposal',
      error: error.message
    });
  }
};

// @desc    Delete proposal (only pending proposals by owner)
// @route   DELETE /api/course-proposals/:id
// @access  Teacher (own pending proposals)
exports.deleteProposal = async (req, res) => {
  try {
    const proposal = await CourseProposal.findById(req.params.id);

    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: 'Proposal not found'
      });
    }

    // Only owner can delete
    if (proposal.proposedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Only pending proposals can be deleted
    if (proposal.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: 'Only pending proposals can be deleted'
      });
    }

    await proposal.deleteOne();

    res.json({
      success: true,
      message: 'Proposal deleted successfully'
    });
  } catch (error) {
    console.error('Delete proposal error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete proposal',
      error: error.message
    });
  }
};
