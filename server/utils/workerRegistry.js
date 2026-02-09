const axios = require('axios');

/**
 * Worker Registry - Manages multiple OCR ML worker servers
 * Features:
 * - Health checking for all registered workers
 * - Load balancing with round-robin and least-load strategies
 * - Dynamic worker addition/removal
 * - Automatic failover to healthy workers
 */
class WorkerRegistry {
  constructor() {
    this.workers = new Map(); // workerId -> worker data
    this.healthCheckInterval = null;
    this.healthCheckIntervalMs = 20000; // 20 seconds (reduced frequency to avoid conflicts)
    this.healthCheckTimeout = 5000; // 5 seconds
    this.roundRobinIndex = 0;
    this.loadBalanceStrategy = 'round-robin'; // 'round-robin' or 'least-load'
  }

  /**
   * Add a new worker to the registry
   * @param {string} workerId - Unique identifier for the worker
   * @param {string} url - Worker's base URL
   * @param {object} metadata - Optional metadata (name, description, etc.)
   */
  addWorker(workerId, url, metadata = {}) {
    if (this.workers.has(workerId)) {
      throw new Error(`Worker ${workerId} already exists`);
    }

    const worker = {
      id: workerId,
      url: url.replace(/\/$/, ''), // Remove trailing slash
      name: metadata.name || workerId,
      description: metadata.description || '',
      status: 'unknown', // 'healthy', 'unhealthy', 'unknown'
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
    console.log(`✓ Worker added: ${workerId} (${url})`);

    // Perform immediate health check
    this.checkWorkerHealth(workerId);

    return worker;
  }

  /**
   * Remove a worker from the registry
   * @param {string} workerId - Worker ID to remove
   */
  removeWorker(workerId) {
    const worker = this.workers.get(workerId);
    if (!worker) {
      throw new Error(`Worker ${workerId} not found`);
    }

    this.workers.delete(workerId);
    console.log(`✓ Worker removed: ${workerId}`);
    return true;
  }

  /**
   * Enable or disable a worker without removing it
   * @param {string} workerId - Worker ID
   * @param {boolean} isActive - Whether worker should be active
   */
  setWorkerActive(workerId, isActive) {
    const worker = this.workers.get(workerId);
    if (!worker) {
      throw new Error(`Worker ${workerId} not found`);
    }

    worker.isActive = isActive;
    console.log(`✓ Worker ${workerId} ${isActive ? 'enabled' : 'disabled'}`);
    return worker;
  }

  /**
   * Get all workers
   * @param {boolean} activeOnly - Return only active workers
   */
  getWorkers(activeOnly = false) {
    const workers = Array.from(this.workers.values());
    return activeOnly ? workers.filter(w => w.isActive) : workers;
  }

  /**
   * Get a specific worker
   * @param {string} workerId - Worker ID
   */
  getWorker(workerId) {
    return this.workers.get(workerId);
  }

  /**
   * Get all healthy workers (or recently active workers)
   */
  getHealthyWorkers() {
    const now = Date.now();
    return Array.from(this.workers.values()).filter(w => {
      if (!w.isActive) return false;
      
      // Include if explicitly healthy
      if (w.status === 'healthy') return true;
      
      // Also include if recently successful (within last 3 minutes) even if marked unhealthy
      // This handles workers that are busy and can't respond to health checks
      if (w.lastHealthCheckSuccess) {
        const timeSinceSuccess = now - new Date(w.lastHealthCheckSuccess).getTime();
        return timeSinceSuccess < 180000; // 3 minutes
      }
      
      return false;
    });
  }

  /**
   * Check health of a specific worker
   * @param {string} workerId - Worker ID to check
   */
  async checkWorkerHealth(workerId) {
    const worker = this.workers.get(workerId);
    if (!worker) return false;

    // Skip health check if worker is actively processing jobs
    // (busy workers can't respond to health checks but are still functional)
    if (worker.activeRequests > 0) {
      worker.lastHealthCheck = new Date();
      // Keep current status (likely healthy)
      if (worker.status !== 'healthy') {
        worker.status = 'healthy'; // Worker is processing, so it's alive
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

      // Accept both "ok" and "healthy" for backward compatibility
      const validStatuses = ['ok', 'healthy'];
      if (response.status === 200 && validStatuses.includes(response.data.status)) {
        worker.status = 'healthy';
        worker.consecutiveFailures = 0;
        worker.lastHealthCheckSuccess = new Date();
        
        // Update average response time (exponential moving average)
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
      // Only mark unhealthy after multiple consecutive failures
      // (temporary timeouts shouldn't immediately mark worker as unhealthy)
      worker.consecutiveFailures++;
      
      if (worker.consecutiveFailures >= 3) {
        worker.status = 'unhealthy';
        console.error(`✗ Health check failed for worker ${workerId}: ${error.message} (${worker.consecutiveFailures} consecutive failures)`);
      } else {
        // Keep as healthy for first 2 failures (may be temporary)
        console.warn(`⚠ Health check timeout for worker ${workerId}: ${error.message} (${worker.consecutiveFailures}/3)`);
      }
      
      return worker.status === 'healthy';
    }
  }

  /**
   * Check health of all workers
   */
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

  /**
   * Start periodic health checks
   */
  startHealthChecks() {
    if (this.healthCheckInterval) {
      console.log('Health checks already running');
      return;
    }

    console.log(`Starting health checks (every ${this.healthCheckIntervalMs / 1000}s)`);
    
    // Run immediately
    this.checkAllWorkersHealth();

    // Then run periodically
    this.healthCheckInterval = setInterval(() => {
      this.checkAllWorkersHealth();
    }, this.healthCheckIntervalMs);
  }

  /**
   * Stop periodic health checks
   */
  stopHealthChecks() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      console.log('Health checks stopped');
    }
  }

  /**
   * Set load balancing strategy
   * @param {string} strategy - 'round-robin' or 'least-load'
   */
  setLoadBalanceStrategy(strategy) {
    if (!['round-robin', 'least-load'].includes(strategy)) {
      throw new Error('Invalid load balance strategy');
    }
    this.loadBalanceStrategy = strategy;
    console.log(`Load balance strategy set to: ${strategy}`);
  }

  /**
   * Select next worker for processing using load balancing
   * @returns {object|null} Selected worker or null if none available
   */
  selectWorker() {
    const healthyWorkers = this.getHealthyWorkers();

    if (healthyWorkers.length === 0) {
      console.error('No healthy workers available');
      return null;
    }

    let selectedWorker;

    if (this.loadBalanceStrategy === 'round-robin') {
      // Round-robin: cycle through workers
      selectedWorker = healthyWorkers[this.roundRobinIndex % healthyWorkers.length];
      this.roundRobinIndex++;
    } else if (this.loadBalanceStrategy === 'least-load') {
      // Least-load: select worker with fewest active requests
      selectedWorker = healthyWorkers.reduce((prev, current) => {
        if (prev.activeRequests < current.activeRequests) return prev;
        if (prev.activeRequests > current.activeRequests) return current;
        // If equal, prefer faster worker
        return prev.averageResponseTime < current.averageResponseTime ? prev : current;
      });
    }

    return selectedWorker;
  }

  /**
   * Mark request start for a worker
   * @param {string} workerId - Worker ID
   */
  requestStart(workerId) {
    const worker = this.workers.get(workerId);
    if (worker) {
      worker.activeRequests++;
      worker.totalRequests++;
    }
  }

  /**
   * Mark request completion for a worker
   * @param {string} workerId - Worker ID
   * @param {boolean} success - Whether request was successful
   */
  requestComplete(workerId, success = true) {
    const worker = this.workers.get(workerId);
    if (worker) {
      worker.activeRequests = Math.max(0, worker.activeRequests - 1);
      if (!success) {
        worker.failedRequests++;
      }
    }
  }

  /**
   * Get registry statistics
   */
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

  /**
   * Initialize with default workers from environment
   */
  initializeFromEnv() {
    const defaultWorker = process.env.ML_SERVER_URL || 'http://localhost:8000';
    
    // Check if multiple workers are configured
    const workerUrls = process.env.ML_WORKER_URLS;
    
    if (workerUrls) {
      // Multiple workers configured
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
      // Single worker (backward compatibility)
      try {
        this.addWorker('worker-1', defaultWorker, {
          name: 'Default Worker',
          description: 'Default OCR Worker Server'
        });
      } catch (error) {
        console.error('Failed to add default worker:', error.message);
      }
    }

    // Start health checks
    this.startHealthChecks();

    console.log(`Worker Registry initialized with ${this.workers.size} worker(s)`);
  }
}

// Create singleton instance
const workerRegistry = new WorkerRegistry();

module.exports = workerRegistry;
