const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

const courseSchema = new mongoose.Schema({}, { strict: false });
const Course = mongoose.model('Course', courseSchema);

async function migrateAssignments() {
  try {
    console.log('Starting migration of course assignments...');

    // Find all courses
    const courses = await Course.find({});
    console.log(`Found ${courses.length} courses`);

    let migratedCount = 0;
    let clearedCount = 0;

    for (const course of courses) {
      let needsUpdate = false;
      
      if (course.assignedTeachers && course.assignedTeachers.length > 0) {
        const firstItem = course.assignedTeachers[0];
        
        // Check if it's in old format (just ObjectIds)
        if (!firstItem.teacher && !firstItem.section) {
          console.log(`Course ${course.courseCode}: Clearing old format assignments`);
          course.assignedTeachers = [];
          needsUpdate = true;
          clearedCount++;
        } else {
          console.log(`Course ${course.courseCode}: Already in new format`);
          migratedCount++;
        }
      }

      if (needsUpdate) {
        await course.save();
      }
    }

    console.log('\nMigration complete!');
    console.log(`- Courses with new format: ${migratedCount}`);
    console.log(`- Courses cleared (old format): ${clearedCount}`);
    console.log(`- Courses without assignments: ${courses.length - migratedCount - clearedCount}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
}

migrateAssignments();
