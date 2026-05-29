const axios = require('axios');

class WorkerRegistry {
  constructor() {
    this.workers = new Map();
    this.healthCheckInterval = null;
    this.healthCheckIntervalMs = 20000;
    this.healthCheckTimeout = 5000;
    this.roundRobinIndex = 0;
    this.loadBalanceStrategy = 'round-robin';
  }

  addWorker(workerId, url, metadata = {}) {
    if (this.workers.has(workerId)) {
      throw new Error(`Worker ${workerId} already exists`);
    }

    const worker = {
      id: workerId,
      url: url.replace(/\/$/, ''),
      name: metadata.name || workerId,
      description: metadata.description || '',
      status: 'unknown',
      isActive: true,
      lastHealthCheck: null,
      lastHealthCheckSuccess: null,
      consecutiveFailures: 0,
      totalRequests: 0,
      failedRequests: 0,
      activeRequests: 0,
      averageResponseTime: 0,
      addedAt: new Date(),
      metadata: metadata
    };

    this.workers.set(workerId, worker);
    console.log(`Worker added: ${workerId} (${url})`);

    this.checkWorkerHealth(workerId);

    return worker;
  }

  removeWorker(workerId) {
    const worker = this.workers.get(workerId);
    if (!worker) {
      throw new Error(`Worker ${workerId} not found`);
    }

    this.workers.delete(workerId);
    console.log(`Worker removed: ${workerId}`);
    return true;
  }

  setWorkerActive(workerId, isActive) {
    const worker = this.workers.get(workerId);
    if (!worker) {
      throw new Error(`Worker ${workerId} not found`);
    }

    worker.isActive = isActive;
    console.log(`Worker ${workerId} ${isActive ? 'enabled' : 'disabled'}`);
    return worker;
  }

  getWorkers(activeOnly = false) {
    const workers = Array.from(this.workers.values());
    return activeOnly ? workers.filter(w => w.isActive) : workers;
  }

  getWorker(workerId) {
    return this.workers.get(workerId);
  }

  getHealthyWorkers() {
    const now = Date.now();
    return Array.from(this.workers.values()).filter(w => {
      if (!w.isActive) return false;
      
      if (w.status === 'healthy') return true;
      
      if (w.lastHealthCheckSuccess) {
        const timeSinceSuccess = now - new Date(w.lastHealthCheckSuccess).getTime();
        return timeSinceSuccess < 180000;
      }
      
      return false;
    });
  }

  async checkWorkerHealth(workerId) {
    const worker = this.workers.get(workerId);
    if (!worker) return false;

    if (worker.activeRequests > 0) {
      worker.lastHealthCheck = new Date();
      if (worker.status !== 'healthy') {
        worker.status = 'healthy';
        worker.consecutiveFailures = 0;
      }
      return true;
    }

    const startTime = Date.now();
    worker.lastHealthCheck = new Date();

    try {
      const response = await axios.get(`${worker.url}/health`, {
        timeout: this.healthCheckTimeout,
        headers: {
          'ngrok-skip-browser-warning': 'true'
        }
      });

      const responseTime = Date.now() - startTime;

      const validStatuses = ['ok', 'healthy'];
      if (response.status === 200 && validStatuses.includes(response.data.status)) {
        worker.status = 'healthy';
        worker.consecutiveFailures = 0;
        worker.lastHealthCheckSuccess = new Date();
        
        if (worker.averageResponseTime === 0) {
          worker.averageResponseTime = responseTime;
        } else {
          worker.averageResponseTime = (worker.averageResponseTime * 0.7) + (responseTime * 0.3);
        }

        return true;
      } else {
        throw new Error('Invalid health check response');
      }
    } catch (error) {
      worker.consecutiveFailures++;
      
      if (worker.consecutiveFailures >= 3) {
        worker.status = 'unhealthy';
        console.error(`Health check failed for worker ${workerId}: ${error.message} (${worker.consecutiveFailures} consecutive failures)`);
      } else {
        console.warn(`Health check timeout for worker ${workerId}: ${error.message} (${worker.consecutiveFailures}/3)`);
      }
      
      return worker.status === 'healthy';
    }
  }

  async checkAllWorkersHealth() {
    const workers = Array.from(this.workers.keys());
    const results = await Promise.allSettled(
      workers.map(workerId => this.checkWorkerHealth(workerId))
    );

    const healthy = results.filter(r => r.status === 'fulfilled' && r.value).length;
    const total = workers.length;

    console.log(`Health Check: ${healthy}/${total} workers healthy`);
    return { healthy, total };
  }

  startHealthChecks() {
    if (this.healthCheckInterval) {
      console.log('Health checks already running');
      return;
    }

    console.log(`Starting health checks (every ${this.healthCheckIntervalMs / 1000}s)`);
    
    this.checkAllWorkersHealth();

    this.healthCheckInterval = setInterval(() => {
      this.checkAllWorkersHealth();
    }, this.healthCheckIntervalMs);
  }

  stopHealthChecks() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      console.log('Health checks stopped');
    }
  }

  setLoadBalanceStrategy(strategy) {
    if (!['round-robin', 'least-load'].includes(strategy)) {
      throw new Error('Invalid load balance strategy');
    }
    this.loadBalanceStrategy = strategy;
    console.log(`Load balance strategy set to: ${strategy}`);
  }

  selectWorker() {
    const healthyWorkers = this.getHealthyWorkers();

    if (healthyWorkers.length === 0) {
      console.error('No healthy workers available');
      return null;
    }

    let selectedWorker;

    if (this.loadBalanceStrategy === 'round-robin') {
      selectedWorker = healthyWorkers[this.roundRobinIndex % healthyWorkers.length];
      this.roundRobinIndex++;
    } else if (this.loadBalanceStrategy === 'least-load') {
      selectedWorker = healthyWorkers.reduce((prev, current) => {
        if (prev.activeRequests < current.activeRequests) return prev;
        if (prev.activeRequests > current.activeRequests) return current;
        return prev.averageResponseTime < current.averageResponseTime ? prev : current;
      });
    }

    return selectedWorker;
  }

  requestStart(workerId) {
    const worker = this.workers.get(workerId);
    if (worker) {
      worker.activeRequests++;
      worker.totalRequests++;
    }
  }

  requestComplete(workerId, success = true) {
    const worker = this.workers.get(workerId);
    if (worker) {
      worker.activeRequests = Math.max(0, worker.activeRequests - 1);
      if (!success) {
        worker.failedRequests++;
      }
    }
  }

  getStats() {
    const workers = Array.from(this.workers.values());
    const totalWorkers = workers.length;
    const activeWorkers = workers.filter(w => w.isActive).length;
    const healthyWorkers = workers.filter(w => w.status === 'healthy' && w.isActive).length;
    const unhealthyWorkers = workers.filter(w => w.status === 'unhealthy').length;

    const totalRequests = workers.reduce((sum, w) => sum + w.totalRequests, 0);
    const totalFailedRequests = workers.reduce((sum, w) => sum + w.failedRequests, 0);
    const totalActiveRequests = workers.reduce((sum, w) => sum + w.activeRequests, 0);

    return {
      totalWorkers,
      activeWorkers,
      healthyWorkers,
      unhealthyWorkers,
      loadBalanceStrategy: this.loadBalanceStrategy,
      totalRequests,
      totalFailedRequests,
      totalActiveRequests,
      successRate: totalRequests > 0 ? ((totalRequests - totalFailedRequests) / totalRequests * 100).toFixed(2) : 0
    };
  }

  initializeFromEnv() {
    const defaultWorker = process.env.ML_SERVER_URL || 'http://localhost:8000';
    
    const workerUrls = process.env.ML_WORKER_URLS;
    
    if (workerUrls) {
      const urls = workerUrls.split(',').map(url => url.trim());
      urls.forEach((url, index) => {
        try {
          this.addWorker(`worker-${index + 1}`, url, {
            name: `Worker ${index + 1}`,
            description: `OCR Worker Server ${index + 1}`
          });
        } catch (error) {
          console.error(`Failed to add worker ${url}:`, error.message);
        }
      });
    } else {
      try {
        this.addWorker('worker-1', defaultWorker, {
          name: 'Default Worker',
          description: 'Default OCR Worker Server'
        });
      } catch (error) {
        console.error('Failed to add default worker:', error.message);
      }
    }

    this.startHealthChecks();

    console.log(`Worker Registry initialized with ${this.workers.size} worker(s)`);
  }
}

const workerRegistry = new WorkerRegistry();

module.exports = workerRegistry;
