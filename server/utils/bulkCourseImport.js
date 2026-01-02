const mongoose = require('mongoose');
const fs = require('fs').promises;
const path = require('path');
const Course = require('../models/Course');
const CourseOutcome = require('../models/CourseOutcome');
const COPOMapping = require('../models/COPOMapping');
const ProgramOutcome = require('../models/ProgramOutcome');
const User = require('../models/User');
require('dotenv').config();

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

// Validation functions
const validateCourseData = (course, index) => {
  const errors = [];
  const courseRef = `Course #${index + 1} (${course.courseCode || 'UNKNOWN'})`;

  // Required fields validation
  if (!course.courseCode || !course.courseCode.trim()) {
    errors.push(`${courseRef}: courseCode is required`);
  }
  if (!course.courseTitle || !course.courseTitle.trim()) {
    errors.push(`${courseRef}: courseTitle is required`);
  }
  if (course.credit === undefined || course.credit === null) {
    errors.push(`${courseRef}: credit is required`);
  }
  if (!course.course_type) {
    errors.push(`${courseRef}: course_type is required`);
  } else if (!['THEORY', 'SESSIONAL', 'LABORATORY', 'LAB', 'PROJECT/THESIS'].includes(course.course_type)) {
    errors.push(`${courseRef}: course_type must be THEORY, SESSIONAL, LABORATORY, or PROJECT/THESIS`);
  }
  if (!course.course_offered_to) {
    errors.push(`${courseRef}: course_offered_to is required`);
  }
  if (!course.category) {
    errors.push(`${courseRef}: category is required`);
  } else if (!['COMPULSORY', 'OPTIONAL'].includes(course.category)) {
    errors.push(`${courseRef}: category must be COMPULSORY or OPTIONAL`);
  }
  if (!course.kpa_mapping || !Array.isArray(course.kpa_mapping) || course.kpa_mapping.length === 0) {
    errors.push(`${courseRef}: kpa_mapping is required and must be a non-empty array`);
  }
  if (!course.knowledge_required || !Array.isArray(course.knowledge_required) || course.knowledge_required.length === 0) {
    errors.push(`${courseRef}: knowledge_required is required and must be a non-empty array`);
  }
  if (!course.course_objectives || !Array.isArray(course.course_objectives) || course.course_objectives.length === 0) {
    errors.push(`${courseRef}: course_objectives is required and must be a non-empty array`);
  }
  if (!course.course_content || !Array.isArray(course.course_content) || course.course_content.length === 0) {
    errors.push(`${courseRef}: course_content is required and must be a non-empty array`);
  }

  // Validate course_content structure
  if (course.course_content && Array.isArray(course.course_content)) {
    course.course_content.forEach((content, idx) => {
      if (!content.concept_description || !content.concept_description.trim()) {
        errors.push(`${courseRef}: course_content[${idx}] must have concept_description`);
      }
    });
  }

  // Validate course outcomes if present
  if (course.courseOutcomes && Array.isArray(course.courseOutcomes)) {
    course.courseOutcomes.forEach((co, idx) => {
      if (!co.co_code || !co.co_code.trim()) {
        errors.push(`${courseRef}: courseOutcomes[${idx}] must have co_code`);
      }
      if (!co.description || !co.description.trim()) {
        errors.push(`${courseRef}: courseOutcomes[${idx}] must have description`);
      }
      if (co.po_mappings && Array.isArray(co.po_mappings)) {
        co.po_mappings.forEach((mapping, mapIdx) => {
          if (!mapping.program_outcome_code) {
            errors.push(`${courseRef}: courseOutcomes[${idx}].po_mappings[${mapIdx}] must have program_outcome_code`);
          }
          if (mapping.level !== 0 && mapping.level !== 1) {
            errors.push(`${courseRef}: courseOutcomes[${idx}].po_mappings[${mapIdx}] level must be 0 or 1`);
          }
        });
      }
    });
  }

  return errors;
};

// Progress tracking
const logProgress = (message, type = 'info') => {
  const timestamp = new Date().toISOString().substring(11, 19);
  let color = colors.reset;
  let prefix = 'ℹ';

  switch (type) {
    case 'success':
      color = colors.green;
      prefix = '✓';
      break;
    case 'error':
      color = colors.red;
      prefix = '✗';
      break;
    case 'warning':
      color = colors.yellow;
      prefix = '⚠';
      break;
    case 'info':
      color = colors.cyan;
      prefix = 'ℹ';
      break;
    case 'progress':
      color = colors.blue;
      prefix = '➜';
      break;
  }

  console.log(`${colors.bright}[${timestamp}]${colors.reset} ${color}${prefix} ${message}${colors.reset}`);
};

// Main import function
const bulkImportCourses = async (jsonFilePath, dryRun = false) => {
  let session = null;
  const stats = {
    total: 0,
    successful: 0,
    failed: 0,
    skipped: 0,
    coursesCreated: 0,
    cosCreated: 0,
    copoMappingsCreated: 0
  };

  try {
    // Connect to MongoDB
    logProgress('Connecting to MongoDB...', 'info');
    await mongoose.connect(process.env.MONGO_URI);
    logProgress('MongoDB connected successfully', 'success');

    // Read JSON file
    logProgress(`Reading course data from: ${jsonFilePath}`, 'info');
    const fileContent = await fs.readFile(jsonFilePath, 'utf-8');
    const data = JSON.parse(fileContent);

    if (!data.courses || !Array.isArray(data.courses)) {
      throw new Error('Invalid JSON format. Expected { "courses": [...] }');
    }

    stats.total = data.courses.length;
    logProgress(`Found ${stats.total} courses to import`, 'info');

    // Verify Program Outcomes exist
    logProgress('Verifying Program Outcomes...', 'info');
    const poCount = await ProgramOutcome.countDocuments();
    if (poCount === 0) {
      throw new Error('No Program Outcomes found. Please run seedProgramOutcomes.js first');
    }
    logProgress(`Found ${poCount} Program Outcomes`, 'success');

    // Find an admin user to use as createdBy
    logProgress('Finding admin user...', 'info');
    const adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser) {
      throw new Error('No admin user found. Please create an admin user first (run utils/createAdmin.js or utils/createTestAdmin.js)');
    }
    logProgress(`Using admin user: ${adminUser.email}`, 'success');

    // Validate all courses first
    logProgress('Validating course data...', 'progress');
    const allValidationErrors = [];
    const validCourses = [];
    const existingCourseCodes = new Set();
    const seenCourseCodes = new Set(); // Track codes from input file

    // Check for existing courses in database
    const existingCourses = await Course.find({}, 'courseCode');
    existingCourses.forEach(c => existingCourseCodes.add(c.courseCode.toUpperCase().trim()));

    for (let i = 0; i < data.courses.length; i++) {
      const course = data.courses[i];
      const courseCodeNormalized = course.courseCode?.toUpperCase().trim();
      const errors = validateCourseData(course, i);

      if (errors.length > 0) {
        allValidationErrors.push(...errors);
        stats.failed++;
      } else if (existingCourseCodes.has(courseCodeNormalized)) {
        logProgress(`Course ${course.courseCode} already exists in database - SKIPPING`, 'warning');
        stats.skipped++;
      } else if (seenCourseCodes.has(courseCodeNormalized)) {
        logProgress(`Duplicate course ${course.courseCode} found in input file - SKIPPING`, 'warning');
        stats.skipped++;
      } else {
        seenCourseCodes.add(courseCodeNormalized);
        validCourses.push(course);
      }
    }

    // Report validation errors
    if (allValidationErrors.length > 0) {
      logProgress(`Found ${allValidationErrors.length} validation errors:`, 'error');
      allValidationErrors.forEach(err => {
        // Extract course code for highlighting
        const match = err.match(/\(([^)]+)\):/);
        if (match) {
          const courseCode = match[1];
          const message = err.replace(`(${courseCode}): `, '');
          const prefix = err.substring(0, err.indexOf('('));
          console.log(`  ${colors.red}• ${colors.reset}${prefix}${colors.yellow}${colors.bright}[${courseCode}]${colors.reset}${colors.red}: ${message}${colors.reset}`);
        } else {
          console.log(`  ${colors.red}• ${err}${colors.reset}`);
        }
      });
      throw new Error('Validation failed. Please fix the errors above.');
    }

    if (validCourses.length === 0) {
      logProgress('No new courses to import (all already exist)', 'warning');
      return stats;
    }

    logProgress(`Validation passed! ${validCourses.length} courses ready to import`, 'success');

    if (dryRun) {
      logProgress('DRY RUN MODE - No data will be inserted', 'warning');
      logProgress(`Would import ${validCourses.length} courses`, 'info');
      return stats;
    }

    // Start transaction
    logProgress('Starting MongoDB transaction...', 'progress');
    session = await mongoose.startSession();
    session.startTransaction();

    // Import courses
    logProgress('Importing courses with CO and CO-PO mappings...', 'progress');
    console.log(''); // Empty line for progress display

    for (let i = 0; i < validCourses.length; i++) {
      const courseData = validCourses[i];
      const progress = `[${i + 1}/${validCourses.length}]`;

      try {
        // Normalize course_type (handle LAB/LABORATORY -> SESSIONAL)
        if (courseData.course_type === 'LAB' || courseData.course_type === 'LABORATORY') {
          courseData.course_type = 'SESSIONAL';
        }

        // Normalize courseCode to always have a space (CSE3217 -> CSE 3217)
        if (courseData.courseCode) {
          courseData.courseCode = courseData.courseCode.replace(/^([A-Z]+)(\d{4})$/, '$1 $2');
        }

        // Extract yearLevel and term from courseCode if not set (e.g., CSE 3217 -> year: 3, term: 2)
        const courseCodeMatch = courseData.courseCode?.match(/^[A-Z]+\s*(\d)(\d)\d{2}$/);
        if (courseCodeMatch) {
          const extractedYear = parseInt(courseCodeMatch[1]);
          const extractedTerm = parseInt(courseCodeMatch[2]);
          
          // Set yearLevel if not already set or invalid
          if (!courseData.yearLevel || courseData.yearLevel < 1) {
            courseData.yearLevel = extractedYear;
          }
          
          // Set term if not already set or invalid (convert 0 to 1, and ensure 1-2 range)
          if (!courseData.term || courseData.term < 1 || courseData.term > 2) {
            courseData.term = (extractedTerm === 0 || extractedTerm > 2) ? 1 : extractedTerm;
          }
        } else {
          // Fallback: Normalize term (only 1 or 2 allowed, set to 1 for invalid values)
          if (!courseData.term || courseData.term < 1 || courseData.term > 2) {
            courseData.term = 1;
          }
        }

        // Set elective_group to OPTIONAL_I if category is OPTIONAL and elective_group is missing
        if (courseData.category === 'OPTIONAL' && !courseData.elective_group) {
          courseData.elective_group = 'OPTIONAL_I';
        }

        // Filter out lecture plans with empty plan descriptions
        if (courseData.lecture_plan && Array.isArray(courseData.lecture_plan)) {
          courseData.lecture_plan = courseData.lecture_plan.filter(item => 
            item.plan && item.plan.trim() !== ''
          );
        }

        // Extract courseOutcomes before creating course
        const courseOutcomesData = courseData.courseOutcomes || [];
        delete courseData.courseOutcomes; // Remove from course data

        // Create course
        process.stdout.write(`\r${colors.blue}${progress}${colors.reset} Creating course: ${colors.bright}${courseData.courseCode}${colors.reset}...`);
        
        // Add createdBy field
        courseData.createdBy = adminUser._id;
        
        const course = new Course(courseData);
        await course.save({ session });
        stats.coursesCreated++;

        // Create course outcomes if present
        if (courseOutcomesData.length > 0) {
          for (const coData of courseOutcomesData) {
            const poMappingsData = coData.po_mappings || [];
            delete coData.po_mappings; // Remove from CO data

            // Create course outcome
            const courseOutcome = new CourseOutcome({
              ...coData,
              course: course._id
            });
            await courseOutcome.save({ session });
            stats.cosCreated++;

            // Create CO-PO mappings
            if (poMappingsData.length > 0) {
              const copoMappings = poMappingsData.map(mapping => ({
                course_outcome: courseOutcome._id,
                program_outcome_code: mapping.program_outcome_code.toUpperCase(),
                level: mapping.level
              }));

              await COPOMapping.insertMany(copoMappings, { session });
              stats.copoMappingsCreated += copoMappings.length;
            }
          }
        }

        stats.successful++;
        process.stdout.write(`\r${colors.green}${progress} ✓ ${courseData.courseCode}${colors.reset} - Course + ${courseOutcomesData.length} COs imported\n`);

      } catch (error) {
        stats.failed++;
        process.stdout.write(`\r${colors.red}${progress} ✗ ${courseData.courseCode}${colors.reset} - ERROR: ${error.message}\n`);
        throw error; // Rollback transaction
      }
    }

    // Commit transaction
    logProgress('\nCommitting transaction...', 'progress');
    await session.commitTransaction();
    logProgress('Transaction committed successfully!', 'success');

  } catch (error) {
    if (session && session.inTransaction()) {
      logProgress('Error occurred! Rolling back transaction...', 'error');
      await session.abortTransaction();
      logProgress('Transaction rolled back', 'warning');
    }
    logProgress(`Fatal Error: ${error.message}`, 'error');
    throw error;
  } finally {
    if (session) {
      session.endSession();
    }
  }

  return stats;
};

// CLI execution
const main = async () => {
  console.log(`\n${colors.bright}${colors.magenta}═══════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}${colors.magenta}    BULK COURSE IMPORT UTILITY${colors.reset}`);
  console.log(`${colors.bright}${colors.magenta}═══════════════════════════════════════════════════════${colors.reset}\n`);

  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const jsonFilePath = args.find(arg => !arg.startsWith('--')) || path.join(__dirname, '../../data.json');

  if (dryRun) {
    logProgress('Running in DRY RUN mode (no changes will be made)', 'warning');
  }

  const startTime = Date.now();

  try {
    const stats = await bulkImportCourses(jsonFilePath, dryRun);

    // Display summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n${colors.bright}${colors.magenta}═══════════════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}IMPORT SUMMARY${colors.reset}`);
    console.log(`${colors.bright}${colors.magenta}═══════════════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.bright}Total courses in file:${colors.reset}     ${stats.total}`);
    console.log(`${colors.green}${colors.bright}Successfully imported:${colors.reset}     ${stats.successful}`);
    console.log(`${colors.yellow}${colors.bright}Skipped (already exist):${colors.reset}   ${stats.skipped}`);
    console.log(`${colors.red}${colors.bright}Failed:${colors.reset}                    ${stats.failed}`);
    console.log(`${colors.cyan}${colors.bright}Courses created:${colors.reset}           ${stats.coursesCreated}`);
    console.log(`${colors.cyan}${colors.bright}Course Outcomes created:${colors.reset}   ${stats.cosCreated}`);
    console.log(`${colors.cyan}${colors.bright}CO-PO Mappings created:${colors.reset}    ${stats.copoMappingsCreated}`);
    console.log(`${colors.bright}Time elapsed:${colors.reset}              ${duration}s`);
    console.log(`${colors.bright}${colors.magenta}═══════════════════════════════════════════════════════${colors.reset}\n`);

    if (stats.successful > 0) {
      logProgress('Bulk import completed successfully! 🎉', 'success');
    } else {
      logProgress('No courses were imported', 'warning');
    }

    process.exit(0);
  } catch (error) {
    logProgress(`Import failed: ${error.message}`, 'error');
    console.error(error.stack);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    logProgress('MongoDB connection closed', 'info');
  }
};

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = { bulkImportCourses, validateCourseData };
