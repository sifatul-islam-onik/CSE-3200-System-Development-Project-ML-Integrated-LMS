# Quick Reference: Worker Management Commands

## Prerequisites
```bash
# Set your admin token
export ADMIN_TOKEN="your-jwt-token-here"
```

## View Workers

### List all workers
```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:5000/api/workers
```

### List only active workers
```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:5000/api/workers?activeOnly=true
```

### Get specific worker
```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:5000/api/workers/worker-1
```

### Get statistics
```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:5000/api/workers/stats
```

## Add/Remove Workers

### Add new worker
```bash
curl -X POST http://localhost:5000/api/workers \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "workerId": "worker-4",
    "url": "http://localhost:8004",
    "name": "Worker 4",
    "description": "Additional OCR Worker"
  }'
```

### Remove worker
```bash
curl -X DELETE http://localhost:5000/api/workers/worker-4 \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

## Health Checks

### Check single worker health
```bash
curl -X POST http://localhost:5000/api/workers/worker-1/health-check \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Check all workers health
```bash
curl -X POST http://localhost:5000/api/workers/health-check-all \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

## Enable/Disable Workers

### Disable worker (stop sending jobs)
```bash
curl -X PATCH http://localhost:5000/api/workers/worker-1/status \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"isActive": false}'
```

### Enable worker
```bash
curl -X PATCH http://localhost:5000/api/workers/worker-1/status \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"isActive": true}'
```

## Load Balancing

### Set round-robin strategy
```bash
curl -X PATCH http://localhost:5000/api/workers/config/load-balance-strategy \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"strategy": "round-robin"}'
```

### Set least-load strategy
```bash
curl -X PATCH http://localhost:5000/api/workers/config/load-balance-strategy \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"strategy": "least-load"}'
```

## OCR Server Status

### Check if OCR server is free or busy
```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:5000/api/ocr/queue-status
```

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "free",
    "healthyWorkers": 2,
    "totalWorkers": 2
  }
}
```

- **status**: `"free"` (at least one worker available) or `"busy"` (all workers at capacity)
- **healthyWorkers**: Number of healthy workers
- **totalWorkers**: Total active workers

## Common Workflows

### Adding a new worker during runtime
```bash
# 1. Start new ML server
PORT=8004 python ml_server/app.py &

# 2. Register with main server
curl -X POST http://localhost:5000/api/workers \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "workerId": "worker-4",
    "url": "http://localhost:8004",
    "name": "Worker 4"
  }'

# 3. Verify health
curl -X POST http://localhost:5000/api/workers/worker-4/health-check \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Gracefully removing a worker
```bash
# 1. Disable worker (stops new jobs)
curl -X PATCH http://localhost:5000/api/workers/worker-4/status \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"isActive": false}'

# 2. Wait for active jobs to complete (check until activeRequests = 0)
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:5000/api/workers/worker-4

# 3. Remove worker
curl -X DELETE http://localhost:5000/api/workers/worker-4 \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 4. Stop ML server process
kill <pid>
```

### Monitoring system health
```bash
# Watch worker stats in real-time
watch -n 5 'curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:5000/api/workers/stats | jq'

# Monitor OCR server availability (free/busy)
watch -n 5 'curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:5000/api/ocr/queue-status | jq'
```

## Using with jq (formatted output)

```bash
# Pretty print all workers
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:5000/api/workers | jq

# Get only worker IDs and status
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:5000/api/workers | jq '.data[] | {id, status, isActive}'

# Count healthy workers
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:5000/api/workers/stats | jq '.data.healthyWorkers'
```

## PowerShell (Windows)

```powershell
# Set admin token
$ADMIN_TOKEN = "your-jwt-token-here"
$headers = @{
    "Authorization" = "Bearer $ADMIN_TOKEN"
    "Content-Type" = "application/json"
}

# Get all workers
Invoke-RestMethod -Uri "http://localhost:5000/api/workers" -Headers $headers

# Add worker
$body = @{
    workerId = "worker-4"
    url = "http://localhost:8004"
    name = "Worker 4"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:5000/api/workers" `
  -Method Post -Headers $headers -Body $body

# Check health
Invoke-RestMethod -Uri "http://localhost:5000/api/workers/health-check-all" `
  -Method Post -Headers $headers
```
