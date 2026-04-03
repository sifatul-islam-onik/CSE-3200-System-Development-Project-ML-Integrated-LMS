const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');

dotenv.config();

const parseAllowedOrigins = (value) =>
  (value || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

const isAllowedOrigin = (origin, allowedOrigins) => {
  if (!origin) {
    return true;
  }

  try {
    const originUrl = new URL(origin);

    if (originUrl.hostname === 'localhost' || originUrl.hostname === '127.0.0.1') {
      return true;
    }

    if (
      /\.ngrok\.io$/.test(originUrl.hostname) ||
      /\.ngrok\.app$/.test(originUrl.hostname) ||
      /\.ngrok\.dev$/.test(originUrl.hostname) ||
      /\.ngrok-free\.app$/.test(originUrl.hostname) ||
      /\.ngrok-free\.dev$/.test(originUrl.hostname)
    ) {
      return true;
    }

    return allowedOrigins.includes(origin);
  } catch (_error) {
    return allowedOrigins.includes(origin);
  }
};

if (process.env.NODE_ENV === 'production') {
  const _consoleError = console.error.bind(console);
  console.error = (...args) =>
    _consoleError(...args.map(a => (a instanceof Error ? `${a.name}: ${a.message}` : a)));
}

const app = express();

app.use(helmet());

const allowedOrigins = [
  ...parseAllowedOrigins(process.env.CLIENT_URLS),
  process.env.CLIENT_URL || 'http://localhost:3000',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

app.use(cors({
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin, allowedOrigins)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked origin: ${origin}`));
  },
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const connectDB = async () => {
  if (process.env.NODE_ENV === 'test') return;
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

connectDB();

const workerRegistry = require('./utils/workerRegistry');
const ocrWorker = require('./workers/ocrWorker');
const ocrJobStore = require('./utils/ocrJobStore');

if (process.env.NODE_ENV !== 'test') {
  workerRegistry.initializeFromEnv();
  console.log('Worker Registry initialized');
  console.log('OCR Worker initialized');
  ocrJobStore.startPeriodicCleanup(); // Clean up old jobs every hour
  console.log('OCR Job Store cleanup initialized');

  setInterval(() => {
    const pendingCount = ocrJobStore.getPendingCount();
    const processingCount = ocrJobStore.getProcessingCount();
    
    if (pendingCount > 0 || processingCount > 0) {
      console.log(`📊 Job Status: ${pendingCount} pending, ${processingCount} processing`);
    }
    
    ocrJobStore.checkStuckJobs();
  }, 2 * 60 * 1000); // Every 2 minutes
}

if (process.env.NODE_ENV !== 'test') {
  (async () => {
    try {
      const Course = require('./models/Course');
      const toFix = await Course.find({ 'assignedBatches.1': { $exists: true } }).select('assignedBatches courseCode');
      if (toFix.length > 0) {
        console.log(`Normalizing batch assignments for ${toFix.length} course(s)...`);
        for (const c of toFix) {
          const latest = c.assignedBatches[c.assignedBatches.length - 1];
          c.assignedBatches = latest ? [latest] : [];
          await c.save();
        }
        console.log('Batch assignment normalization complete.');
      }
    } catch (err) {
      console.error('Batch normalization error (startup):', err.message);
    }
  })();
}

app.get('/', (req, res) => {
  res.json({ message: 'LMS API Server' });
});

const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const courseRoutes = require('./routes/courseRoutes');
const courseOutcomeRoutes = require('./routes/courseOutcomeRoutes');
const programOutcomeRoutes = require('./routes/programOutcomeRoutes');
const copoMappingRoutes = require('./routes/copoMappingRoutes');
const courseProposalRoutes = require('./routes/courseProposalRoutes');
const termExamMarksRoutes = require('./routes/termExamMarksRoutes');
const attainmentRoutes = require('./routes/attainmentRoutes');
const courseProfileRoutes = require('./routes/courseProfileRoutes');
const ocrRoutes = require('./routes/ocrRoutes');
const workerRoutes = require('./routes/workerRoutes');
const resultRoutes = require('./routes/resultRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/courses', courseOutcomeRoutes);
app.use('/api/course-outcomes', courseOutcomeRoutes);
app.use('/api/program-outcomes', programOutcomeRoutes);
app.use('/api', copoMappingRoutes);
app.use('/api/course-proposals', courseProposalRoutes);
app.use('/api/term-exam-marks', termExamMarksRoutes);
app.use('/api/attainment', attainmentRoutes);
app.use('/api/course-profile', courseProfileRoutes);
app.use('/api/ocr', ocrRoutes);
app.use('/api/workers', workerRoutes);
app.use('/api/results', resultRoutes);

process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION! Shutting down...');
  console.error(err.name, err.message);
  console.error(err.stack);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION! Shutting down...');
  console.error(err.name, err.message);
  console.error(err.stack);
  process.exit(1);
});

const PORT = process.env.PORT || 5000;
let server;

if (process.env.NODE_ENV !== 'test') {
  server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully');
  
  workerRegistry.stopHealthChecks();

  if (server) {
    server.close(() => {
      console.log('Process terminated');
    });
  }
});

module.exports = app;
