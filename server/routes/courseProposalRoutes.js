const express = require('express');
const router = express.Router();
const {
  createCourseProposal,
  getAllProposals,
  getMyProposals,
  getProposalById,
  approveProposal,
  rejectProposal,
  deleteProposal
} = require('../controllers/courseProposalController');
const { authenticateUser } = require('../middlewares/authMiddleware');
const { teacherOrAdmin, adminOnly } = require('../middlewares/roleMiddleware');

router.post('/', authenticateUser, teacherOrAdmin, createCourseProposal);
router.get('/my-proposals', authenticateUser, teacherOrAdmin, getMyProposals);
router.delete('/:id', authenticateUser, teacherOrAdmin, deleteProposal);

router.get('/', authenticateUser, adminOnly, getAllProposals);
router.get('/:id', authenticateUser, teacherOrAdmin, getProposalById);
router.put('/:id/approve', authenticateUser, adminOnly, approveProposal);
router.put('/:id/reject', authenticateUser, adminOnly, rejectProposal);

module.exports = router;
