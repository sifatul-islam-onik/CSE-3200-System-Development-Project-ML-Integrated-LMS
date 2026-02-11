/**
 * Optimized data loader for attainment page
 * Handles parallel loading and error recovery
 */

import { getCourseStudents } from './courseService';
import { getAttainmentData } from './attainmentService';

/**
 * Load students data with fallback strategies
 * Runs all strategies in parallel for faster loading
 */
export const loadStudentsOptimized = async (selectedCourse, sheetNames = []) => {
  if (!selectedCourse) return [];

  const strategies = [];

  // Strategy 1: Try course API
  if (selectedCourse._id) {
    strategies.push(
      getCourseStudents(selectedCourse._id)
        .then(resp => {
          if (resp.success && Array.isArray(resp.data) && resp.data.length > 0) {
            return resp.data.map(s => ({
              rollNumber: s.roll || s.rollNumber,
              name: s.name
            }));
          }
          return [];
        })
        .catch(() => [])
    );
  }

  // Strategy 2: Try Section sheets in parallel
  const sectionSheets = (sheetNames || []).filter(name => /^Section/i.test(name));
  if (sectionSheets.length > 0) {
    const sectionPromises = sectionSheets.map(sName =>
      getAttainmentData(sName)
        .then(resp => {
          const list = Array.isArray(resp?.data?.students) ? resp.data.students : [];
          return list.map(s => ({
            rollNumber: s.rollNumber || s.roll || s,
            name: s.name
          }));
        })
        .catch(() => [])
    );
    strategies.push(...sectionPromises);
  }

  // Strategy 3: Try Attn_Assign sheet
  if ((sheetNames || []).includes('Attn_Assign')) {
    strategies.push(
      getAttainmentData('Attn_Assign')
        .then(resp => {
          const list = Array.isArray(resp?.data?.students) ? resp.data.students : [];
          return list.map(s => ({
            rollNumber: s.rollNumber || s.roll || s,
            name: s.name
          }));
        })
        .catch(() => [])
    );
  }

  // Execute all strategies in parallel
  const results = await Promise.all(strategies);

  // Flatten and deduplicate
  const allStudents = results.flat();
  const uniqueStudents = [];
  const seen = new Set();

  for (const stu of allStudents) {
    let rn = stu.rollNumber || stu.roll || stu;
    if (!rn) continue;
    rn = String(rn).trim();
    const lower = rn.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      uniqueStudents.push({ rollNumber: rn, name: stu.name });
    }
  }

  return uniqueStudents;
};

/**
 * Load multiple attainment datasets in parallel
 */
export const loadAttainmentDatasets = async (selectedCourse, dataTypes = []) => {
  if (!selectedCourse || !selectedCourse._id) return {};

  const promises = {};

  // Import services dynamically to avoid circular dependencies
  const { getCTData } = await import('./attainmentService');
  const { getAssignmentData } = await import('./attainmentService');
  const { getTermExamMarks } = await import('./attainmentService');

  if (dataTypes.includes('ct')) {
    promises.ct = getCTData(selectedCourse._id)
      .then(resp => (resp.success && resp.data ? resp.data : null))
      .catch(() => null);
  }

  if (dataTypes.includes('assignment')) {
    promises.assignment = getAssignmentData(selectedCourse._id)
      .then(resp => (resp.success && resp.data ? resp.data : null))
      .catch(() => null);
  }

  if (dataTypes.includes('termExam')) {
    promises.termExam = getTermExamMarks(selectedCourse._id, selectedCourse.section)
      .then(resp => (resp.success && resp.data ? resp.data : []))
      .catch(() => []);
  }

  const results = await Promise.all(
    Object.entries(promises).map(async ([key, promise]) => [key, await promise])
  );

  return Object.fromEntries(results);
};
