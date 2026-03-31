const express = require('express');
const router = express.Router();
const {
  getAllProgramOutcomes,
  getProgramOutcomeByCode,
  updateProgramOutcome
} = require('../controllers/programOutcomeController');
const { authenticateUser } = require('../middlewares/authMiddleware');
const { authorizeAdmin } = require('../middlewares/roleMiddleware');

router.get('/', getAllProgramOutcomes);
router.get('/:code', getProgramOutcomeByCode);

router.put('/:code', authenticateUser, authorizeAdmin, updateProgramOutcome);


module.exports = router;
