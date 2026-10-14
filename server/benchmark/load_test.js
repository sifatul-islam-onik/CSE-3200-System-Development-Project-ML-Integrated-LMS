// OCR load test: submits a burst of jobs through POST /api/ocr/submit and records each job's
// lifecycle from the Redis job store (ocr_job:<jobId>), which the OCR worker updates.
//
// Usage:
//   node benchmark/load_test.js --api http://127.0.0.1:5055 --redis redis://127.0.0.1:6379/7 \
//     --images ../validation_data/benchmark_images --gt ../validation_data/ground_truth.json \
//     --names image_01.jpg,image_02.jpg --out <dir>     (credentials in BENCH_EMAIL / BENCH_PASSWORD)
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const Redis = require('ioredis');

const FIELDS = ['status', 'createdAt', 'queuedAt', 'startedAt', 'completedAt', 'assignedWorker', 'processedBy',
  'attemptNumber', 'maxAttempts', 'isRetry', 'succeededAfterRetry', 'failedWorker', 'lastFailedAt', 'error',
  'sequence', 'confidence', 'marks'];

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 2) args[argv[i].replace(/^--/, '')] = argv[i + 1];
  return args;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function csvCell(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function main() {
  const args = parseArgs(process.argv);
  const api = args.api;
  const pollMs = parseInt(args['poll-ms'] || '1000', 10);
  const timeoutS = parseInt(args['timeout-s'] || '3600', 10);
  const gt = JSON.parse(fs.readFileSync(args.gt, 'utf8'));
  const names = args.names.split(',');
  fs.mkdirSync(args.out, { recursive: true });

  const login = await axios.post(`${api}/api/auth/login`, {
    identifier: process.env.BENCH_EMAIL,
    password: process.env.BENCH_PASSWORD
  });
  const headers = { Authorization: `Bearer ${login.data.token}` };

  const payloads = names.map((name, i) => ({
    name,
    body: {
      studentId: `bench-student-${i + 1}`,
      courseId: 'bench-course',
      section: gt[name].section,
      imageUrl: `data:image/jpeg;base64,${fs.readFileSync(path.join(args.images, name)).toString('base64')}`
    }
  }));

  const t0 = Date.now();
  const submitted = await Promise.all(payloads.map(async ({ name, body }, i) => {
    const sentAt = Date.now();
    try {
      const res = await axios.post(`${api}/api/ocr/submit`, body, {
        headers, maxBodyLength: Infinity, maxContentLength: Infinity
      });
      return { index: i + 1, image: name, jobId: res.data.jobId, submitSentAt: sentAt, submitAckAt: Date.now() };
    } catch (err) {
      return { index: i + 1, image: name, jobId: null, submitSentAt: sentAt, submitAckAt: Date.now(),
        submitError: err.response ? `${err.response.status} ${JSON.stringify(err.response.data)}` : err.message };
    }
  }));
  console.log(`submitted ${submitted.filter((s) => s.jobId).length}/${names.length} jobs in ${Date.now() - t0} ms`);

  const redis = new Redis(args.redis, { maxRetriesPerRequest: null });
  const seen = new Map(submitted.map((s) => [s.jobId, { statuses: [], firstProcessing: null, done: null }]));
  const pending = new Set(submitted.filter((s) => s.jobId).map((s) => s.jobId));
  while (pending.size > 0 && Date.now() - t0 < timeoutS * 1000) {
    const ids = [...pending];
    const pipe = redis.pipeline();
    ids.forEach((id) => pipe.hget(`ocr_job:${id}`, 'status'));
    const results = await pipe.exec();
    const now = Date.now();
    results.forEach(([, status], k) => {
      const s = seen.get(ids[k]);
      if (status && s.statuses[s.statuses.length - 1] !== status) s.statuses.push(status);
      if (status === 'processing' && !s.firstProcessing) s.firstProcessing = now;
      if (status === 'completed' || status === 'failed') {
        s.done = now;
        pending.delete(ids[k]);
      }
    });
    await sleep(pollMs);
  }

  const rows = [];
  for (const s of submitted) {
    const row = { ...s };
    if (s.jobId) {
      const vals = await redis.hmget(`ocr_job:${s.jobId}`, ...FIELDS);
      FIELDS.forEach((f, k) => { row[f] = vals[k]; });
      const obs = seen.get(s.jobId);
      row.observedStatuses = obs.statuses.join('>');
      row.observedFirstProcessingAt = obs.firstProcessing;
      row.observedDoneAt = obs.done;
      row.timedOut = pending.has(s.jobId);
    }
    rows.push(row);
  }
  await redis.quit();

  fs.writeFileSync(path.join(args.out, 'jobs.json'), JSON.stringify({ startedAt: t0, rows }, null, 1));
  const cols = ['index', 'image', 'jobId', 'submitSentAt', 'submitAckAt', 'submitError', ...FIELDS,
    'observedStatuses', 'observedFirstProcessingAt', 'observedDoneAt', 'timedOut'];
  const lines = [cols.join(',')].concat(rows.map((r) => cols.map((c) => csvCell(r[c])).join(',')));
  fs.writeFileSync(path.join(args.out, 'jobs.csv'), lines.join('\n'));
  const done = rows.filter((r) => r.status === 'completed').length;
  const failed = rows.filter((r) => r.status === 'failed').length;
  console.log(`completed ${done}, failed ${failed}, timed out ${pending.size}, wall ${(Date.now() - t0) / 1000}s`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
