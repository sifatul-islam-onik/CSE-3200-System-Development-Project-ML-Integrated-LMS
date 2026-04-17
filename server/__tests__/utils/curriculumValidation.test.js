const {
  validateCourseOutcomes,
  validatePOCoverage,
  validateSemesterYear,
  validateAssessmentPlan,
  validateOBECompliance,
  generateCOPOMatrix,
} = require('../../utils/curriculumValidation');

describe('curriculumValidation utils', () => {
  describe('validateCourseOutcomes', () => {
    it('returns warning when no course outcomes are provided', () => {
      const result = validateCourseOutcomes([]);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings[0]).toMatch(/No course outcomes defined/i);
    });

    it('returns errors for missing required fields and invalid bloom level', () => {
      const result = validateCourseOutcomes([
        {
          coNumber: 'CO1',
          description: 'Understand basics',
          bloomLevel: 'UnknownLevel',
          poMapping: { PO1: 1 },
        },
        {
          description: 'Missing coNumber',
          bloomLevel: 'Apply',
          poMapping: {},
        },
      ]);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => /Invalid Bloom/i.test(e))).toBe(true);
      expect(result.errors.some((e) => /Missing required fields/i.test(e))).toBe(true);
    });
  });

  describe('validatePOCoverage', () => {
    it('aggregates PO coverage and warns for narrow mapping', () => {
      const outcomes = [
        { coNumber: 'CO1', poMapping: { PO1: 2, PO2: 1 } },
        { coNumber: 'CO2', poMapping: { PO1: 1 } },
      ];

      const result = validatePOCoverage(outcomes);

      expect(result.valid).toBe(true);
      expect(result.coverage.PO1).toBe(3);
      expect(result.coverage.PO2).toBe(1);
      expect(result.mappedPOs).toEqual(expect.arrayContaining(['PO1', 'PO2']));
      expect(result.warnings[0]).toMatch(/only 2 POs/i);
    });
  });

  describe('validateSemesterYear', () => {
    it('returns invalid for inconsistent semester-year mapping', () => {
      const result = validateSemesterYear(5, 2);

      expect(result.valid).toBe(false);
      expect(result.message).toMatch(/Semester 5 should be in year 3/i);
    });

    it('returns valid when semester-year mapping is consistent', () => {
      const result = validateSemesterYear(4, 2);

      expect(result.valid).toBe(true);
    });
  });

  describe('validateAssessmentPlan', () => {
    it('returns invalid when assessment percentages do not total 100', () => {
      const result = validateAssessmentPlan({ continuous: 30, midterm: 20, final: 40 });

      expect(result.valid).toBe(false);
      expect(result.total).toBe(90);
    });

    it('returns valid when assessment percentages total 100', () => {
      const result = validateAssessmentPlan({ continuous: 30, midterm: 20, final: 50 });

      expect(result.valid).toBe(true);
      expect(result.total).toBe(100);
    });
  });

  describe('validateOBECompliance', () => {
    it('aggregates validation issues from multiple checks', () => {
      const result = validateOBECompliance({
        semester: 5,
        yearLevel: 2,
        assessmentPlan: { continuous: 30, midterm: 20, final: 40 },
        courseOutcomes: [
          {
            coNumber: 'CO1',
            description: 'Valid CO',
            bloomLevel: 'Apply',
            poMapping: { PO1: 1 },
          },
        ],
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => /Semester 5 should be in year 3/i.test(e))).toBe(true);
      expect(result.errors.some((e) => /must total 100/i.test(e))).toBe(true);
      expect(result.details).toHaveProperty('courseOutcomes');
      expect(result.details).toHaveProperty('poCoverage');
      expect(result.details).toHaveProperty('semesterYear');
      expect(result.details).toHaveProperty('assessmentPlan');
    });
  });

  describe('generateCOPOMatrix', () => {
    it('returns null when no course outcomes are provided', () => {
      expect(generateCOPOMatrix([])).toBeNull();
    });

    it('builds matrix rows, totals, and averages for PO mappings', () => {
      const result = generateCOPOMatrix([
        {
          coNumber: 'CO1',
          description: 'CO 1',
          bloomLevel: 'Apply',
          poMapping: { PO1: 2, PO2: 1 },
        },
        {
          coNumber: 'CO2',
          description: 'CO 2',
          bloomLevel: 'Analyze',
          poMapping: { PO1: 1 },
        },
      ]);

      expect(result.matrix).toHaveLength(2);
      expect(result.poTotals.PO1).toBe(3);
      expect(result.poTotals.PO2).toBe(1);
      expect(result.averages.PO1).toBe('1.50');
      expect(result.averages.PO2).toBe('0.50');
    });
  });
});