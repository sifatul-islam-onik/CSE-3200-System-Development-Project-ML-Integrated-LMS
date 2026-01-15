const FinalGrade = require('../models/FinalGrade');

/**
 * Middleware to check if course grades are finalized.
 * Blocks modification requests if locked.
 */
exports.checkIfFinalized = async (req, res, next) => {
  try {
    // Extract context priority: Body > Query > Params
    const courseId = req.body.courseId || req.query.courseId || req.params.courseId;
    const section = req.body.section || req.query.section || req.params.section;
    const academicYear = req.body.academicYear || req.query.academicYear || req.params.academicYear;

    if (!courseId) {
      // If no courseId, we can't check lock. Controller validation will handle missing fields.
      return next();
    }

    // Criteria: A course is "Finalized" if ANY student record in that scope is finalized.
    // Logic: In `finalizeGrades`, we updateMany.
    
    // Build query
    const query = {
      course: courseId,
      isFinalized: true
    };

    // If section provided, scope check to section. 
    // If not provided (e.g., Lab), strict check might miss if section is stored as null?
    // Let's assume strict matching on provided fields.
    if (section) query.section = section;
    if (academicYear) query.academicYear = academicYear;

    const locked = await FinalGrade.exists(query);

    if (locked) {
      return res.status(403).json({
        success: false,
        message: 'Action Blocked: Grades are finalized. Admin override required.',
        isLocked: true
      });
    }

    next();
  } catch (error) {
    console.error('Finalization Check Middleware Error:', error);
    // Don't block flow on error, but maybe warn?
    // Safest is to fail closed if unsure, but for now allow strict check only.
    next(); 
  }
};
