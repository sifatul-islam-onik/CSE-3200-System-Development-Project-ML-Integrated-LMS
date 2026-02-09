# OCR Worker Load Balancing System

## Overview

This system provides scalable OCR processing with multiple ML worker servers, automatic load balancing, health checking, and dynamic worker management.

## Features

- ✅ **Multiple Workers**: Support for multiple OCR ML server instances
- ✅ **Load Balancing**: Round-robin and least-load distribution strategies
- ✅ **Health Checks**: Automatic health monitoring (every 30 seconds)
- ✅ **Dynamic Management**: Add/remove workers without downtime
- ✅ **Failover**: Automatic routing to healthy workers only
- ✅ **Statistics**: Real-time worker performance metrics
- ✅ **Admin API**: Complete REST API for worker management

## Architecture

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────┐
│   Express Server (Main)      │
│  ┌─────────────────────┐    │
│  │  Worker Registry    │    │
│  │  - Health Checks    │    │
│  │  - Load Balancer    │    │
│  └─────────────────────┘    │
└──────┬───────┬──────┬────────┘
       │       │      │
       ▼       ▼      ▼
    ┌────┐ ┌────┐ ┌────┐
    │ML-1│ │ML-2│ │ML-3│  (OCR Workers)
    └────┘ └────┘ └────┘
```

## Quick Start

### 1. Environment Configuration

Add worker URLs to your `.env` file:

```env
# Single worker (backward compatible)
ML_SERVER_URL=http://localhost:8000

# Or multiple workers (comma-separated)
ML_WORKER_URLS=http://localhost:8001,http://localhost:8002,http://localhost:8003

# Redis for queue management
REDIS_URL=redis://127.0.0.1:6379
```

### 2. Start Multiple ML Servers

**Option A: Local Development**
```bash
# Terminal 1 - Worker 1
cd ml_server
PORT=8001 python app.py

# Terminal 2 - Worker 2
PORT=8002 python app.py

# Terminal 3 - Worker 3
PORT=8003 python app.py
```

**Option B: Docker**
```bash
# Use docker-compose to start multiple instances
docker-compose up --scale ml-server=3
```

**Option C: Cloud Deployment**
Deploy to different servers/containers and configure URLs:
```env
ML_WORKER_URLS=https://ml-worker-1.example.com,https://ml-worker-2.example.com,https://ml-worker-3.example.com
```

### 3. Start the Main Server

```bash
cd server
npm install
npm start
```

The Worker Registry will automatically:
- Register all configured workers
- Start health checks
- Begin load balancing OCR jobs

## API Endpoints

All worker management endpoints require **Admin** authentication.

### Get All Workers
```http
GET /api/workers
GET /api/workers?activeOnly=true
```

**Response:**
```json
{
  "success": true,
  "count": 3,
  "data": [
    {
      "id": "worker-1",
      "url": "http://localhost:8001",
      "name": "Worker 1",
      "status": "healthy",
      "isActive": true,
      "lastHealthCheck": "2026-02-09T10:30:00Z",
      "consecutiveFailures": 0,
      "totalRequests": 150,
      "failedRequests": 2,
      "activeRequests": 3,
      "averageResponseTime": 1250
    }
  ]
}
```

### Get Worker Statistics
```http
GET /api/workers/stats
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalWorkers": 3,
    "activeWorkers": 3,
    "healthyWorkers": 2,
    "unhealthyWorkers": 1,
    "loadBalanceStrategy": "round-robin",
    "totalRequests": 500,
    "totalFailedRequests": 5,
    "totalActiveRequests": 8,
    "successRate": "99.00"
  }
}
```

### Add Worker
```http
POST /api/workers
Content-Type: application/json

{
  "workerId": "worker-4",
  "url": "http://localhost:8004",
  "name": "Worker 4",
  "description": "New OCR Worker"
}
```

### Remove Worker
```http
DELETE /api/workers/:workerId
```

### Enable/Disable Worker
```http
PATCH /api/workers/:workerId/status
Content-Type: application/json

{
  "isActive": false
}
```

### Check Worker Health
```http
POST /api/workers/:workerId/health-check
```

### Check All Workers Health
```http
POST /api/workers/health-check-all
```

### Set Load Balance Strategy
```http
PATCH /api/workers/config/load-balance-strategy
Content-Type: application/json

{
  "strategy": "least-load"
}
```

**Available Strategies:**
- `round-robin`: Distributes jobs evenly in rotation
- `least-load`: Routes to worker with fewest active requests

## Load Balancing Strategies

### Round-Robin
Jobs are distributed sequentially across all healthy workers.

**Best for:**
- Uniform job complexity
- Workers with identical hardware
- Simple setup

### Least-Load
Jobs are routed to the worker with the fewest active requests.

**Best for:**
- Variable job complexity
- Mixed worker hardware
- Optimal resource utilization

## Health Checking

### Automatic Health Checks
- **Interval**: Every 30 seconds (configurable)
- **Timeout**: 5 seconds per check
- **Endpoint**: `GET /health` on each worker
- **Expected Response**: `{"status": "ok"}`

### Health States
- **healthy**: Worker passed recent health check
- **unhealthy**: Worker failed health check
- **unknown**: Worker not yet checked

### Failover Behavior
- Only **healthy** workers receive jobs
- Unhealthy workers are automatically excluded
- Workers return to rotation when healthy again
- No manual intervention required

## Monitoring

### Worker Metrics

Each worker tracks:
- **Status**: Current health state
- **activeRequests**: Jobs currently processing
- **totalRequests**: Lifetime request count
- **failedRequests**: Failed request count
- **averageResponseTime**: Moving average (ms)
- **consecutiveFailures**: Health check failures
- **lastHealthCheck**: Last check timestamp
- **lastHealthCheckSuccess**: Last successful check

### View Real-Time Stats

```bash
# Using curl
curl -H "Authorization: Bearer <admin-token>" \
  http://localhost:5000/api/workers/stats

# Check specific worker
curl -H "Authorization: Bearer <admin-token>" \
  http://localhost:5000/api/workers/worker-1
```

## Scaling Guide

### Adding Capacity

**Step 1**: Deploy new ML server
```bash
# Start on new port/server
PORT=8004 python ml_server/app.py
```

**Step 2**: Register worker via API
```bash
curl -X POST http://localhost:5000/api/workers \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "workerId": "worker-4",
    "url": "http://localhost:8004",
    "name": "Worker 4"
  }'
```

**Step 3**: Verify health
```bash
curl -X POST http://localhost:5000/api/workers/worker-4/health-check \
  -H "Authorization: Bearer <admin-token>"
```

### Removing Worker

**Step 1**: Disable worker (graceful)
```bash
curl -X PATCH http://localhost:5000/api/workers/worker-4/status \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"isActive": false}'
```

**Step 2**: Wait for active jobs to complete
```bash
# Check active requests
curl -H "Authorization: Bearer <admin-token>" \
  http://localhost:5000/api/workers/worker-4
```

**Step 3**: Remove worker
```bash
curl -X DELETE http://localhost:5000/api/workers/worker-4 \
  -H "Authorization: Bearer <admin-token>"
```

## Configuration Options

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ML_SERVER_URL` | Single worker URL (legacy) | `http://localhost:8000` |
| `ML_WORKER_URLS` | Comma-separated worker URLs | - |
| `REDIS_URL` | Redis connection string | `redis://127.0.0.1:6379` |
| `OCR_CONCURRENCY` | Max parallel jobs to process | `10` |

**Concurrency Setting:**
- The `OCR_CONCURRENCY` determines how many jobs can be processed simultaneously
- With 2 workers and concurrency=10, both workers can process jobs in parallel
- Higher values = more throughput, but requires adequate worker capacity
- Formula: Set to at least `number_of_workers * 2` for good parallelism

### Health Check Settings

Modify in `server/utils/workerRegistry.js`:
```javascript
this.healthCheckIntervalMs = 30000; // 30 seconds
this.healthCheckTimeout = 5000; // 5 seconds  
```

## Docker Compose Example

```yaml
version: '3.8'

services:
  redis:
    image: redis:alpine
    ports:
      - "6379:6379"

  ml-server:
    build: ./ml_server
    environment:
      - PORT=8000
    ports:
      - "8001-8003:8000"
    deploy:
      replicas: 3

  server:
    build: ./server
    environment:
      - ML_WORKER_URLS=http://ml-server:8000
      - REDIS_URL=redis://redis:6379
    ports:
      - "5000:5000"
    depends_on:
      - redis
      - ml-server
```

## Troubleshooting

### No Healthy Workers

**Problem**: Jobs fail with "No healthy workers available"

**Solutions**:
1. Check worker processes are running
2. Verify network connectivity
3. Check worker health endpoint manually:
   ```bash
   curl http://localhost:8001/health
   ```
4. Review worker logs for errors
5. Manually trigger health check:
   ```bash
   curl -X POST http://localhost:5000/api/workers/health-check-all \
     -H "Authorization: Bearer <admin-token>"
   ```

### Worker Stuck Unhealthy

**Problem**: Worker shows unhealthy but is running

**Solutions**:
1. Check if health endpoint returns correct format:
   ```json
   {"status": "ok"}
   ```
2. Verify health check timeout is adequate
3. Check for network issues
4. Restart worker if necessary

### Uneven Load Distribution

**Problem**: Some workers getting more jobs

**Solutions**:
1. Switch to `least-load` strategy:
   ```bash
   curl -X PATCH http://localhost:5000/api/workers/config/load-balance-strategy \
     -H "Authorization: Bearer <admin-token>" \
     -H "Content-Type: application/json" \
     -d '{"strategy": "least-load"}'
   ```
2. Check if all workers have same status (healthy)
3. Verify workers have similar hardware capabilities

### Jobs Processing One at a Time

**Problem**: Jobs are processed sequentially instead of in parallel

**Cause**: Low concurrency setting (default changed from 1 to 10)

**Solutions**:
1. Set `OCR_CONCURRENCY` environment variable:
   ```env
   OCR_CONCURRENCY=20
   ```
2. Restart the server
3. Recommended values:
   - 2 workers: concurrency = 10-20
   - 3 workers: concurrency = 15-30
   - N workers: concurrency = N × 5 to N × 10
4. Check server status:
   ```bash
   curl -H "Authorization: Bearer <admin-token>" \
     http://localhost:5000/api/ocr/queue-status
   ```
   Response: `{"success": true, "data": {"status": "free", "healthyWorkers": 2, "totalWorkers": 2}}`
   - `status`: "free" (at least one worker available) or "busy" (all workers at capacity)

## Best Practices

1. **Always start with health checks**: Wait for workers to be healthy before processing jobs
2. **Monitor metrics regularly**: Check `/api/workers/stats` for performance insights
3. **Graceful scaling**: Disable workers before removal to avoid job failures
4. **Use appropriate strategy**: Choose load balancing strategy based on your workload
5. **Set up alerts**: Monitor for unhealthy workers in production
6. **Test failover**: Periodically disable workers to verify failover works
7. **Keep workers identical**: Same ML models and dependencies across all workers

## Performance Tips

1. **Worker Count**: Start with 2-3 workers, scale based on queue depth
2. **Hardware**: Each worker needs adequate GPU/CPU for OCR processing
3. **Network**: Minimize latency between main server and workers
4. **Redis**: Use persistent Redis for production queues
5. **Health Interval**: Adjust based on worker stability (shorter for unstable networks)

## Security Considerations

1. **Authentication**: All worker API endpoints require admin authentication
2. **Network**: Place workers behind firewall, expose only to main server
3. **HTTPS**: Use HTTPS for worker communication in production
4. **API Keys**: Consider adding API key authentication between server and workers

## Migration from Single Worker

The system is **backward compatible**. Existing `.env` with `ML_SERVER_URL` will work:

```env
# Old configuration (still works)
ML_SERVER_URL=http://localhost:8000

# Upgrade to (add this line)
ML_WORKER_URLS=http://localhost:8001,http://localhost:8002
```

Or use the API to add workers dynamically after deployment.
