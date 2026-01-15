const mongoose = require('mongoose');
const dotenv = require('dotenv');
const CTMarks = require('./models/CTMarks');
const Attendance = require('./models/Attendance');
const Assignment = require('./models/Assignment');
const FinalGrade = require('./models/FinalGrade');
const TermExamMarks = require('./models/TermExamMarks');
const Course = require('./models/Course');

dotenv.config();

const resetData = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB connected successfully');

        console.log('Starting data reset...');

        // 1. Delete all mark-related data
        const ctDelete = await CTMarks.deleteMany({});
        console.log(`Deleted ${ctDelete.deletedCount} CT Marks records`);

        const attendanceDelete = await Attendance.deleteMany({});
        console.log(`Deleted ${attendanceDelete.deletedCount} Attendance records`);

        const assignmentDelete = await Assignment.deleteMany({});
        console.log(`Deleted ${assignmentDelete.deletedCount} Assignment records`);

        const gradeDelete = await FinalGrade.deleteMany({});
        console.log(`Deleted ${gradeDelete.deletedCount} Final Grade records`);

        const termDelete = await TermExamMarks.deleteMany({});
        console.log(`Deleted ${termDelete.deletedCount} Term Exam Marks records`);

        // 2. Clear Course assignments (Teachers and Batches)
        const courseUpdate = await Course.updateMany(
            {}, 
            { 
                $set: { 
                    assignedTeachers: [], 
                    assignedBatches: [] 
                } 
            }
        );
        console.log(`Cleared teachers and batches from ${courseUpdate.modifiedCount} Courses`);

        console.log('Data reset complete. Fresh start ready!');
        process.exit(0);
    } catch (error) {
        console.error('Error resetting data:', error);
        process.exit(1);
    }
};

resetData();
