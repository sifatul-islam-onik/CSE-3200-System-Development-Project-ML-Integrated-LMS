const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// One-time migration: replace the old non-partial unique index on courseoutcomes
// with a partial one so soft-deleted docs don't block re-use of the same co_code.
const migrateCourseOutcomeIndex = async () => {
  try {
    const col = mongoose.connection.collection('courseoutcomes');
    const indexes = await col.indexes();
    const oldIndex = indexes.find(
      ix => ix.name === 'course_1_co_code_1' && !ix.partialFilterExpression
    );
    if (oldIndex) {
      await col.dropIndex('course_1_co_code_1');
      await col.createIndex(
        { course: 1, co_code: 1 },
        {
          unique: true,
          partialFilterExpression: { is_deleted: { $ne: true } },
          name: 'course_1_co_code_1'
        }
      );
      console.log('Migrated courseoutcomes index to partial unique index');
    }
  } catch (err) {
    console.error('courseoutcomes index migration error:', err.message);
  }
};

// Database connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected successfully');
    await migrateCourseOutcomeIndex();
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

connectDB();

// Initialize Worker Registry (before OCR Worker)
const workerRegistry = require('./utils/workerRegistry');
workerRegistry.initializeFromEnv();
console.log('Worker Registry initialized');

// Initialize OCR Worker
const ocrWorker = require('./workers/ocrWorker');
console.log('OCR Worker initialized');

// Initialize OCR Job Store cleanup and monitoring
const ocrJobStore = require('./utils/ocrJobStore');
ocrJobStore.startPeriodicCleanup(); // Clean up old jobs every hour
console.log('OCR Job Store cleanup initialized');

// Periodic check for stuck jobs (every 2 minutes)
setInterval(() => {
  const pendingCount = ocrJobStore.getPendingCount();
  const processingCount = ocrJobStore.getProcessingCount();
  
  if (pendingCount > 0 || processingCount > 0) {
    console.log(`📊 Job Status: ${pendingCount} pending, ${processingCount} processing`);
  }
  
  // Check for jobs that have been pending too long
  ocrJobStore.checkStuckJobs();
}, 2 * 60 * 1000); // Every 2 minutes

// Startup normalization: collapse multiple batch assignments to a single latest entry
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

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'LMS API Server' });
});

// API Routes
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

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/courses', courseOutcomeRoutes);
// Also expose course outcome routes under a distinct base to avoid conflicts
app.use('/api/course-outcomes', courseOutcomeRoutes);
app.use('/api/program-outcomes', programOutcomeRoutes);
app.use('/api', copoMappingRoutes);
app.use('/api/course-proposals', courseProposalRoutes);
app.use('/api/term-exam-marks', termExamMarksRoutes);
app.use('/api/attainment', attainmentRoutes);
app.use('/api/course-profile', courseProfileRoutes);
app.use('/api/ocr', ocrRoutes);
app.use('/api/workers', workerRoutes);

// Error handlers
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

// Start server
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully');
  
  // Stop worker health checks
  workerRegistry.stopHealthChecks();
  
  server.close(() => {
    console.log('Process terminated');
  });
});
