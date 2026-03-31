const workerRegistry = require('../utils/workerRegistry');

exports.getAllWorkers = async (req, res) => {
  try {
    const activeOnly = req.query.activeOnly === 'true';
    const workers = workerRegistry.getWorkers(activeOnly);

    res.status(200).json({
      success: true,
      count: workers.length,
      data: workers
    });
  } catch (error) {
    console.error('Get workers error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching workers'
    });
  }
};

exports.getWorker = async (req, res) => {
  try {
    const { workerId } = req.params;
    const worker = workerRegistry.getWorker(workerId);

    if (!worker) {
      return res.status(404).json({
        success: false,
        message: 'Worker not found'
      });
    }

    res.status(200).json({
      success: true,
      data: worker
    });
  } catch (error) {
    console.error('Get worker error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching worker'
    });
  }
};

exports.addWorker = async (req, res) => {
  try {
    const { workerId, url, name, description } = req.body;

    if (!workerId || !url) {
      return res.status(400).json({
        success: false,
        message: 'Worker ID and URL are required'
      });
    }

    try {
      new URL(url);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid URL format'
      });
    }

    const worker = workerRegistry.addWorker(workerId, url, {
      name: name || workerId,
      description: description || ''
    });

    res.status(201).json({
      success: true,
      message: 'Worker added successfully',
      data: worker
    });
  } catch (error) {
    console.error('Add worker error:', error);
    
    if (error.message.includes('already exists')) {
      return res.status(409).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error adding worker'
    });
  }
};

exports.removeWorker = async (req, res) => {
  try {
    const { workerId } = req.params;

    workerRegistry.removeWorker(workerId);

    res.status(200).json({
      success: true,
      message: 'Worker removed successfully'
    });
  } catch (error) {
    console.error('Remove worker error:', error);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error removing worker'
    });
  }
};

exports.setWorkerStatus = async (req, res) => {
  try {
    const { workerId } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isActive must be a boolean'
      });
    }

    const worker = workerRegistry.setWorkerActive(workerId, isActive);

    res.status(200).json({
      success: true,
      message: `Worker ${isActive ? 'enabled' : 'disabled'} successfully`,
      data: worker
    });
  } catch (error) {
    console.error('Set worker status error:', error);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error updating worker status'
    });
  }
};

exports.checkWorkerHealth = async (req, res) => {
  try {
    const { workerId } = req.params;

    const worker = workerRegistry.getWorker(workerId);
    if (!worker) {
      return res.status(404).json({
        success: false,
        message: 'Worker not found'
      });
    }

    const isHealthy = await workerRegistry.checkWorkerHealth(workerId);
    const updatedWorker = workerRegistry.getWorker(workerId);

    res.status(200).json({
      success: true,
      message: `Worker is ${isHealthy ? 'healthy' : 'unhealthy'}`,
      data: {
        workerId,
        isHealthy,
        status: updatedWorker.status,
        lastHealthCheck: updatedWorker.lastHealthCheck
      }
    });
  } catch (error) {
    console.error('Check worker health error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error checking worker health'
    });
  }
};

exports.checkAllWorkersHealth = async (req, res) => {
  try {
    const result = await workerRegistry.checkAllWorkersHealth();
    const workers = workerRegistry.getWorkers();

    res.status(200).json({
      success: true,
      message: `${result.healthy}/${result.total} workers healthy`,
      data: {
        healthy: result.healthy,
        total: result.total,
        workers: workers.map(w => ({
          id: w.id,
          name: w.name,
          url: w.url,
          status: w.status,
          isActive: w.isActive,
          lastHealthCheck: w.lastHealthCheck
        }))
      }
    });
  } catch (error) {
    console.error('Check all workers health error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error checking workers health'
    });
  }
};

exports.getWorkerStats = async (req, res) => {
  try {
    const stats = workerRegistry.getStats();

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get worker stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching worker statistics'
    });
  }
};

exports.setLoadBalanceStrategy = async (req, res) => {
  try {
    const { strategy } = req.body;

    if (!['round-robin', 'least-load'].includes(strategy)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid strategy. Must be "round-robin" or "least-load"'
      });
    }

    workerRegistry.setLoadBalanceStrategy(strategy);

    res.status(200).json({
      success: true,
      message: `Load balance strategy set to ${strategy}`,
      data: { strategy }
    });
  } catch (error) {
    console.error('Set load balance strategy error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error setting load balance strategy'
    });
  }
};
