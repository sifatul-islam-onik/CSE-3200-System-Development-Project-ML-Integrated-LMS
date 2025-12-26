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

    res.json({
      success: true,
      data: proposal
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

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      if (proposal.proposalType === 'CREATE') {
        // Create new course
        const courseData = {
          ...proposal.proposedData,
          createdBy: proposal.proposedBy
        };

        // Extract courseOutcomes if present
        const courseOutcomes = courseData.courseOutcomes;
        delete courseData.courseOutcomes;

        const [course] = await Course.create([courseData], { session });

        // Create course outcomes if provided
        if (courseOutcomes && courseOutcomes.length > 0) {
          for (const coData of courseOutcomes) {
            const [courseOutcome] = await CourseOutcome.create([{
              course: course._id,
              co_code: coData.co_code,
              description: coData.description,
              taxonomy_levels: coData.taxonomy_levels || []
            }], { session });

            // Create CO-PO mappings
            if (coData.po_mappings && coData.po_mappings.length > 0) {
              const mappingsToCreate = coData.po_mappings.map(mapping => ({
                course_outcome: courseOutcome._id,
                program_outcome_code: mapping.program_outcome_code.toUpperCase(),
                level: Number(mapping.level)
              }));

              await COPOMapping.create(mappingsToCreate, { session });
            }
          }
        }

      } else if (proposal.proposalType === 'UPDATE') {
        // Update existing course
        const course = await Course.findById(proposal.existingCourse).session(session);

        if (!course) {
          throw new Error('Course not found');
        }

        const updateData = { ...proposal.proposedData };
        const courseOutcomes = updateData.courseOutcomes;
        delete updateData.courseOutcomes;

        // Update course fields
        Object.assign(course, updateData);
        course.lastReviewed = Date.now();
        course.reviewedBy = req.user._id;
        await course.save({ session });

        // Handle course outcomes if provided
        if (courseOutcomes && courseOutcomes.length > 0) {
          // Delete existing outcomes and mappings
          const existingCOs = await CourseOutcome.find({ course: course._id }).session(session);
          for (const co of existingCOs) {
            await COPOMapping.deleteMany({ course_outcome: co._id }, { session });
          }
          await CourseOutcome.deleteMany({ course: course._id }, { session });

          // Create new outcomes
          for (const coData of courseOutcomes) {
            const [courseOutcome] = await CourseOutcome.create([{
              course: course._id,
              co_code: coData.co_code,
              description: coData.description,
              taxonomy_levels: coData.taxonomy_levels || []
            }], { session });

            if (coData.po_mappings && coData.po_mappings.length > 0) {
              const mappingsToCreate = coData.po_mappings.map(mapping => ({
                course_outcome: courseOutcome._id,
                program_outcome_code: mapping.program_outcome_code.toUpperCase(),
                level: Number(mapping.level)
              }));

              await COPOMapping.create(mappingsToCreate, { session });
            }
          }
        }
      }

      // Update proposal status
      proposal.status = 'APPROVED';
      proposal.reviewedBy = req.user._id;
      proposal.reviewedAt = Date.now();
      proposal.reviewComment = reviewComments || '';
      await proposal.save({ session });

      await session.commitTransaction();
      session.endSession();

      await proposal.populate('proposedBy', 'name email');
      await proposal.populate('reviewedBy', 'name email');

      res.json({
        success: true,
        message: 'Proposal approved and changes applied successfully',
        data: proposal
      });

    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  } catch (error) {
    console.error('Approve proposal error:', error);
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
