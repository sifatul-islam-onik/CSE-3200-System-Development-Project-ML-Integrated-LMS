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

// CO-PO Mapping routes for individual COs
router.post('/course-outcomes/:coId/po-mappings', authenticateUser, authorizeAdmin, setCOPOMappings);
router.get('/course-outcomes/:coId/po-mappings', getCOPOMappings);
router.delete('/course-outcomes/:coId/po-mappings/:poCode', authenticateUser, authorizeAdmin, deleteCOPOMapping);

// Course-level CO-PO matrix
router.get('/courses/:courseId/co-po-matrix', getCOPOMatrixForCourse);

// Program-level PO attainment
router.get('/co-po-mappings/po-attainment', getPOAttainment);

module.exports = router;
