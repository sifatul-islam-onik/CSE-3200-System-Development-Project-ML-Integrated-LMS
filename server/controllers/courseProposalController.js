const CourseProposal = require('../models/CourseProposal');
const Course = require('../models/Course');
const CourseOutcome = require('../models/CourseOutcome');
const COPOMapping = require('../models/COPOMapping');
const mongoose = require('mongoose');

exports.createCourseProposal = async (req, res) => {
  try {
    const {
      proposalType,
      existingCourseId,
      courseData,
      changeDescription
    } = req.body;

    if (!proposalType || !['CREATE', 'UPDATE'].includes(proposalType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid proposal type. Must be CREATE or UPDATE'
      });
    }

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

    if (req.user.role === 'teacher' && proposal.proposedBy._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

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

exports.approveProposal = async (req, res) => {
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

    const normalizeCourseData = (raw) => {
      const data = { ...(raw || {}) };
      if (typeof data.course_type === 'string') data.course_type = data.course_type.toUpperCase();
      if (typeof data.category === 'string') data.category = data.category.toUpperCase();
      if (typeof data.course_offered_to === 'string') data.course_offered_to = data.course_offered_to.toUpperCase();
      if (data.category === 'COMPULSORY') {
        data.elective_group = null;
      }
      if (typeof data.academicYear === 'number') data.academicYear = String(data.academicYear);
      const trimArray = (arr) => Array.isArray(arr) ? arr.map(v => (typeof v === 'string' ? v.trim() : v)).filter(v => !(typeof v === 'string' && v === '')) : arr;
      data.prerequisites = trimArray(data.prerequisites);
      data.knowledge_required = trimArray(data.knowledge_required);
      data.course_objectives = trimArray(data.course_objectives);
      data.references = trimArray(data.references);
      if (Array.isArray(data.course_content)) {
        data.course_content = data.course_content.map(item => ({
          concept_name: item?.concept_name?.trim(),
          concept_description: item?.concept_description?.trim()
        }));
      }
      if (Array.isArray(data.lecture_plan)) {
        data.lecture_plan = data.lecture_plan.map(lp => ({
          week: typeof lp.week === 'string' ? parseInt(lp.week, 10) : lp.week,
          plan: lp?.plan?.trim()
        })).sort((a, b) => (a.week || 0) - (b.week || 0));
      }
      if (Array.isArray(data.kpa_mapping)) {
        data.kpa_mapping = data.kpa_mapping.map(k => (typeof k === 'string' ? k.toUpperCase() : k));
      }
      return data;
    };

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
      if (proposal.proposalType === 'CREATE') {
        const courseData = {
          ...normalizeCourseData(proposal.proposedData),
          createdBy: proposal.proposedBy
        };

        const courseOutcomes = courseData.courseOutcomes;
        delete courseData.courseOutcomes;

        let course;
        if (useSession) {
          const created = await Course.create([courseData], { session });
          course = created[0];
        } else {
          course = await Course.create(courseData);
        }

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

        Object.assign(course, updateData);
        course.lastReviewed = Date.now();
        course.reviewedBy = req.user._id;
        if (useSession) {
          await course.save({ session });
        } else {
          await course.save();
        }

        if (hasCourseOutcomes) {
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

exports.deleteProposal = async (req, res) => {
  try {
    const proposal = await CourseProposal.findById(req.params.id);

    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: 'Proposal not found'
      });
    }

    const isAdmin = req.user.role === 'admin';
    const isOwner = proposal.proposedBy.toString() === req.user._id.toString();
    const isResponded = ['APPROVED', 'REJECTED'].includes(proposal.status);

    if (isAdmin) {
      if (!isResponded) {
        return res.status(400).json({
          success: false,
          message: 'Admin can only delete proposals that have already been responded to (approved or rejected)'
        });
      }
    } else {
      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
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
