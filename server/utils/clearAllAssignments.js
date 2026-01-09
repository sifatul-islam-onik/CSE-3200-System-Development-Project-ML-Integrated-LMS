const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

const courseSchema = new mongoose.Schema({}, { strict: false });
const Course = mongoose.model('Course', courseSchema);

async function clearAllAssignments() {
  try {
    console.log('Clearing all teacher assignments from all courses...');

    const result = await Course.updateMany(
      {},
      { $set: { assignedTeachers: [] } }
    );

    console.log(`\nCleared assignments from ${result.modifiedCount} courses`);
    console.log('All courses now have empty assignedTeachers arrays');
    
    process.exit(0);
  } catch (error) {
    console.error('Error clearing assignments:', error);
    process.exit(1);
  }
}

clearAllAssignments();
