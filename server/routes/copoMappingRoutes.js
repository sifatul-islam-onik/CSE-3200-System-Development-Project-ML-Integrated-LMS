const express = require('express');
const router = express.Router();
const {
  setCOPOMappings,
  getCOPOMappings,
  getCOPOMatrixForCourse,
  deleteCOPOMapping,
  getPOAttainment
} = require('../controllers/copoMappingController');
const { authenticateUser } = require('../middlewares/authMiddleware');
const { authorizeAdmin } = require('../middlewares/roleMiddleware');

router.post('/course-outcomes/:coId/po-mappings', authenticateUser, authorizeAdmin, setCOPOMappings);
router.get('/course-outcomes/:coId/po-mappings', getCOPOMappings);
router.delete('/course-outcomes/:coId/po-mappings/:poCode', authenticateUser, authorizeAdmin, deleteCOPOMapping);

router.get('/courses/:courseId/co-po-matrix', getCOPOMatrixForCourse);

router.get('/co-po-mappings/po-attainment', getPOAttainment);

module.exports = router;
