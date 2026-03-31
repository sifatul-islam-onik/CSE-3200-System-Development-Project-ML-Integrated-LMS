const express = require('express');
const router = express.Router();
const {
  getAllWorkers,
  getWorker,
  addWorker,
  removeWorker,
  setWorkerStatus,
  checkWorkerHealth,
  checkAllWorkersHealth,
  getWorkerStats,
  setLoadBalanceStrategy
} = require('../controllers/workerController');
const { authenticateUser } = require('../middlewares/authMiddleware');
const { authorizeAdmin } = require('../middlewares/roleMiddleware');

router.use(authenticateUser);
router.use(authorizeAdmin);

router.route('/')
  .get(getAllWorkers)
  .post(addWorker);

router.route('/stats')
  .get(getWorkerStats);

router.route('/health-check-all')
  .post(checkAllWorkersHealth);

router.route('/config/load-balance-strategy')
  .patch(setLoadBalanceStrategy);

router.route('/:workerId')
  .get(getWorker)
  .delete(removeWorker);

router.route('/:workerId/status')
  .patch(setWorkerStatus);

router.route('/:workerId/health-check')
  .post(checkWorkerHealth);

module.exports = router;
