const mongoose = require('mongoose');
require('dotenv').config({ path: __dirname + '/../.env' }); // Ensure database connection
const Department = require('../models/Department');

const DEPARTMENTS = [
  { _id: 'CE', name: 'Civil Engineering', numericCode: '01', maxYear: 4 },
  { _id: 'EEE', name: 'Electrical and Electronic Engineering', numericCode: '03', maxYear: 4 },
  { _id: 'ME', name: 'Mechanical Engineering', numericCode: '05', maxYear: 4 },
  { _id: 'CSE', name: 'Computer Science and Engineering', numericCode: '07', maxYear: 4 },
  { _id: 'ECE', name: 'Electronics and Communication Engineering', numericCode: '09', maxYear: 4 },
  { _id: 'IEM', name: 'Industrial Engineering and Management', numericCode: '11', maxYear: 4 },
  { _id: 'ESE', name: 'Energy Science and Engineering', numericCode: '13', maxYear: 4 },
  { _id: 'BME', name: 'Biomedical Engineering', numericCode: '15', maxYear: 4 },
  { _id: 'URP', name: 'Urban and Regional Planning', numericCode: '17', maxYear: 4 },
  { _id: 'LE', name: 'Leather Engineering', numericCode: '19', maxYear: 4 },
  { _id: 'TE', name: 'Textile Engineering', numericCode: '21', maxYear: 4 },
  { _id: 'BECM', name: 'Building Engineering and Construction Management', numericCode: '23', maxYear: 4 },
  { _id: 'ARCH', name: 'Architecture', numericCode: '25', maxYear: 5 },
  { _id: 'MSE', name: 'Materials Science and Engineering', numericCode: '27', maxYear: 4 },
  { _id: 'CHE', name: 'Chemical Engineering', numericCode: '29', maxYear: 4 },
  { _id: 'MTE', name: 'Mechatronics Engineering', numericCode: '31', maxYear: 4 }
];

const seedDepartments = async () => {
  try {
    const mongoURI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/lms';
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoURI);
    console.log('Connected to MongoDB');

    for (const dept of DEPARTMENTS) {
      await Department.findOneAndUpdate(
        { _id: dept._id },
        { ...dept },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }
    
    console.log('Successfully seeded Departments!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding departments:', error);
    process.exit(1);
  }
};

if (require.main === module) {
  seedDepartments();
}

module.exports = seedDepartments;