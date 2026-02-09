# OCR Job Status Guide

## Job Status Flow

```
pending → processing → completed ✓
   ↓
   └→ processing → retrying → processing → completed ✓
                      ↓
                      └→ processing → failed ✗ (after all retries exhausted)
```

## Status Values

| Status | Description | UI Action |
|--------|-------------|-----------|
| `pending` | Job queued, waiting to start | Keep polling |
| `processing` | Job currently being processed by a worker | Keep polling |
| `retrying` | Job failed but will be retried (temporary failure) | **Keep polling** - retry in progress |
| `completed` | Job finished successfully | Stop polling, show results |
| `failed` | Job failed permanently (all 3 attempts exhausted) | Stop polling, show error |

## Job Response Fields

### Basic Fields (All Jobs)
```json
{
  "jobId": "uuid",
  "userId": "user-id",
  "studentId": "student-id",
  "courseId": "course-id",
  "status": "processing|retrying|completed|failed",
  "progress": 0-100,
  "createdAt": "ISO date",
  "startedAt": "ISO date or null",
  "completedAt": "ISO date or null"
}
```

### Retry Information
```json
{
  "attemptNumber": 2,
  "isRetry": true,
  "maxAttempts": 3,
  "lastFailedAt": "ISO date"
}
```

### Success Fields (status: 'completed')
```json
{
  "marks": { "Q1": "8.5", "Q2": "7.0" },
  "confidence": 0.95,
  "rawTable": [["Q1", "8.5"], ["Q2", "7.0"]],
  "processedBy": "worker-1",
  "succeededAfterRetry": true
}
```

### Failure Fields (status: 'failed' or 'retrying')
```json
{
  "error": "Error message",
  "failedWorker": "worker-1"
}
```

## UI Polling Logic

### React/JavaScript Example

```javascript
const pollJobStatus = async (jobId) => {
  const maxPolls = 120; // 2 minutes max
  const pollInterval = 1000; // 1 second
  let polls = 0;

  const poll = async () => {
    try {
      const response = await fetch(`/api/ocr/status/${jobId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const { data: job } = await response.json();

      // Update UI with current status
      updateJobUI(job);

      // Determine if should continue polling
      const shouldContinuePolling = 
        job.status === 'pending' || 
        job.status === 'processing' || 
        job.status === 'retrying'; // ← IMPORTANT: Keep polling on retrying

      if (!shouldContinuePolling) {
        // Job finished (completed or failed)
        handleJobComplete(job);
        return;
      }

      polls++;
      if (polls >= maxPolls) {
        console.error('Polling timeout');
        return;
      }

      // Continue polling
      setTimeout(poll, pollInterval);

    } catch (error) {
      console.error('Poll error:', error);
      // Optionally retry the poll itself
    }
  };

  poll();
};

const updateJobUI = (job) => {
  // Show different UI based on status
  if (job.status === 'processing') {
    if (job.isRetry) {
      showStatus(`Processing (Retry ${job.attemptNumber}/${job.maxAttempts})...`);
    } else {
      showStatus('Processing...');
    }
    updateProgressBar(job.progress);
  } 
  else if (job.status === 'retrying') {
    showStatus(`Failed, retrying (${job.attemptNumber}/${job.maxAttempts})...`);
    showWarning(job.error);
  }
  else if (job.status === 'completed') {
    if (job.succeededAfterRetry) {
      showSuccess('Completed successfully (after retry)');
    } else {
      showSuccess('Completed successfully');
    }
    displayResults(job.marks);
  }
  else if (job.status === 'failed') {
    showError(`Failed after ${job.attemptNumber} attempts: ${job.error}`);
  }
};
```

## Key Changes for UI

### ✅ DO:
1. **Continue polling when status is `'retrying'`** - This is the most important change
2. Show retry information to user: `"Processing (Retry 2/3)..."`
3. Display temporary errors as warnings, not final failures
4. Indicate when job succeeded after retry: `"Completed (after retry)"`

### ❌ DON'T:
1. Stop polling when status is `'retrying'`
2. Treat `'retrying'` status as final failure
3. Hide retry information from user
4. Restart polling from scratch on retry - continue same poll loop

## Example UI Messages

### Status: `retrying`
```
⚠️ Processing failed, retrying... (Attempt 1/3)
Error: timeout of 5000ms exceeded
Please wait...
```

### Status: `processing` (after retry)
```
🔄 Processing (Retry 2/3)...
Progress: 50%
```

### Status: `completed` (after retry)
```
✅ Marks extracted successfully (after retry)
Confidence: 95%
[Show Results]
```

### Status: `failed` (final)
```
❌ Failed after 3 attempts
Error: No healthy OCR workers available
[Retry Manually] [Cancel]
```

## Backend Configuration

- **Max Attempts**: 3 (configurable in `server/config/queue.js`)
- **Backoff Strategy**: Exponential with 5-second initial delay
- **Retry Delays**: ~5s, ~10s, ~20s between attempts

## Testing Scenarios

1. **Success on first try**: `pending → processing → completed`
2. **Success after retry**: `pending → processing → retrying → processing → completed`
3. **Final failure**: `pending → processing → retrying → processing → retrying → processing → failed`
