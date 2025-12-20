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

// Note: No DELETE routes - Program Outcomes are reference data

module.exports = router;
