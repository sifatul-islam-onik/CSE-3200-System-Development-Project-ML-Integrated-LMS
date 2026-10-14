jest.mock('axios');
const axios = require('axios');
const workerRegistry = require('../../utils/workerRegistry');

const healthyResponse = { status: 200, data: { status: 'ok' } };

describe('workerRegistry', () => {
  beforeEach(() => {
    workerRegistry.stopHealthChecks();
    workerRegistry.workers.clear();
    axios.get.mockReset();
    axios.get.mockResolvedValue(healthyResponse);
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  async function addHealthyWorker(id, url) {
    workerRegistry.addWorker(id, url);
    await workerRegistry.checkWorkerHealth(id);
    expect(workerRegistry.getWorker(id).status).toBe('healthy');
  }

  it('excludes a worker marked unhealthy even though its last health check succeeded recently', async () => {
    await addHealthyWorker('worker-1', 'http://127.0.0.1:8001');
    await addHealthyWorker('worker-2', 'http://127.0.0.1:8002');

    workerRegistry.markUnhealthy('worker-2', 'ECONNREFUSED');

    expect(workerRegistry.getHealthyWorkers().map((w) => w.id)).toEqual(['worker-1']);
  });

  it('readmits a worker after its next successful health check', async () => {
    await addHealthyWorker('worker-1', 'http://127.0.0.1:8001');
    workerRegistry.markUnhealthy('worker-1', 'ECONNREFUSED');
    expect(workerRegistry.getHealthyWorkers()).toHaveLength(0);

    await workerRegistry.checkWorkerHealth('worker-1');

    expect(workerRegistry.getHealthyWorkers().map((w) => w.id)).toEqual(['worker-1']);
  });

  it('keeps a worker out while its health checks keep failing', async () => {
    await addHealthyWorker('worker-1', 'http://127.0.0.1:8001');
    workerRegistry.markUnhealthy('worker-1', 'ECONNREFUSED');
    axios.get.mockRejectedValue(Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }));

    await workerRegistry.checkWorkerHealth('worker-1');

    expect(workerRegistry.getHealthyWorkers()).toHaveLength(0);
  });

  it('treats only request errors without an HTTP response as connection errors', () => {
    const refused = Object.assign(new Error('connect ECONNREFUSED'), { isAxiosError: true, code: 'ECONNREFUSED' });
    const reset = Object.assign(new Error('socket hang up'), { isAxiosError: true, code: 'ECONNRESET' });
    const serverError = Object.assign(new Error('Request failed with status code 500'), {
      isAxiosError: true,
      response: { status: 500 }
    });
    const localError = new Error('Invalid base64 data - missing data after comma');

    expect(workerRegistry.isConnectionError(refused)).toBe(true);
    expect(workerRegistry.isConnectionError(reset)).toBe(true);
    expect(workerRegistry.isConnectionError(serverError)).toBe(false);
    expect(workerRegistry.isConnectionError(localError)).toBe(false);
  });
});
