const express = require('express');
const router = express.Router();
const {
  getAllProgramOutcomes,
  getProgramOutcomeByCode,
  updateProgramOutcome
} = require('../controllers/programOutcomeController');
const { authenticateUser } = require('../middlewares/authMiddleware');
const { authorizeAdmin } = require('../middlewares/roleMiddleware');

// Public routes
router.get('/', getAllProgramOutcomes);
router.get('/:code', getProgramOutcomeByCode);

// Admin-only routes
router.put('/:code', authenticateUser, authorizeAdmin, updateProgramOutcome);


module.exports = router;
