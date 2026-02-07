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

// Database connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

connectDB();

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
  server.close(() => {
    console.log('Process terminated');
  });
});
