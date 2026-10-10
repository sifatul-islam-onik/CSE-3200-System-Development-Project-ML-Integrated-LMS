const {
  calculateCourseCOAttainment,
  calculateTheoryCoAttainmentByStudent,
} = require('../../utils/coAttainmentCalc');

const emptySection = { sectionARows: [], sectionAObtainedRows: [] };
const emptySectionB = { sectionBRows: [], sectionBObtainedRows: [] };

const buildTheoryData = ({ sectionA = emptySection, sectionB = emptySectionB } = {}) => ({
  sectionAData: sectionA,
  sectionBData: sectionB,
  ctData: {},
  assignData: {},
});

const statFor = (stats, coNumber) => stats.find(s => s.coNumber === coNumber);

describe('coAttainmentCalc', () => {
  describe('calculateCourseCOAttainment (theory)', () => {
    it('counts Section B allocations, which are stored as Q1a-Q4d', () => {
      const data = buildTheoryData({
        sectionB: {
          sectionBRows: [{ coNumber: 'CO1', Q1a: 10, Q2a: 10, Q3a: 10, Q4a: 10 }],
          sectionBObtainedRows: [{ rollNumber: '2007001', Q1a: 6, Q2a: 6, Q3a: 6 }],
        },
      });

      const stats = calculateCourseCOAttainment('THEORY', [{ roll: '2007001' }], ['CO1'], data);
      const co1 = statFor(stats, 'CO1');

      // 18 obtained out of 30 allocated on the three attempted questions = 60%
      expect(co1.studentsAttempted).toBe(1);
      expect(co1.studentsPassed).toBe(1);
      expect(co1.passPercentage).toBe(100);
      expect(co1.attainmentLevel).toBe(3);
    });

    it('does not inflate attainment when a CO is assessed in both sections', () => {
      const data = buildTheoryData({
        sectionA: {
          sectionARows: [{ coNumber: 'CO1', Q1a: 10 }],
          sectionAObtainedRows: [{ rollNumber: '2007001', Q1a: 6 }],
        },
        sectionB: {
          sectionBRows: [{ coNumber: 'CO1', Q1a: 10 }],
          sectionBObtainedRows: [{ rollNumber: '2007001', Q1a: 4 }],
        },
      });

      const stats = calculateCourseCOAttainment('THEORY', [{ roll: '2007001' }], ['CO1'], data);
      const co1 = statFor(stats, 'CO1');

      // 10 obtained out of 20 allocated = 50%, below the 55% threshold
      expect(co1.studentsAttempted).toBe(1);
      expect(co1.studentsPassed).toBe(0);
      expect(co1.attainmentLevel).toBe(0);
    });

    it('uses only the questions a student attempted as the allocation', () => {
      const data = buildTheoryData({
        sectionA: {
          sectionARows: [{ coNumber: 'CO1', Q1a: 10, Q2a: 10, Q3a: 10, Q4a: 10 }],
          sectionAObtainedRows: [
            { rollNumber: '2007001', Q1a: 6, Q2a: 6, Q3a: 6 },
            { rollNumber: '2007002', Q2a: 4, Q3a: 4, Q4a: 4 },
          ],
        },
      });

      const students = [{ roll: '2007001' }, { roll: '2007002' }];
      const stats = calculateCourseCOAttainment('THEORY', students, ['CO1'], data);
      const co1 = statFor(stats, 'CO1');

      // 18/30 = 60% passes; 12/30 = 40% does not
      expect(co1.studentsAttempted).toBe(2);
      expect(co1.studentsPassed).toBe(1);
      expect(co1.passPercentage).toBe(50);
      expect(co1.attainmentLevel).toBe(2);
    });

    it('agrees with the per-student values shown in the CO Attainment sheet', () => {
      const data = buildTheoryData({
        sectionA: {
          sectionARows: [{ coNumber: 'CO1', Q1a: 5, Q1b: 5, Q2a: 10 }, { coNumber: 'CO2', Q3a: 10, Q4a: 10 }],
          sectionAObtainedRows: [
            { rollNumber: '2007001', Q1a: 5, Q1b: 2, Q2a: 7, Q3a: 3 },
            { rollNumber: '2007002', Q1a: 1, Q3a: 9, Q4a: 8 },
          ],
        },
        sectionB: {
          sectionBRows: [{ coNumber: 'CO2', Q1a: 10 }],
          sectionBObtainedRows: [
            { rollNumber: '2007001', Q1a: 9 },
            { rollNumber: '2007002', Q1a: 2 },
          ],
        },
      });

      const students = [{ roll: '2007001' }, { roll: '2007002' }];
      const coNumbers = ['CO1', 'CO2'];
      const stats = calculateCourseCOAttainment('THEORY', students, coNumbers, data);
      const byStudent = calculateTheoryCoAttainmentByStudent(students, coNumbers, data);

      coNumbers.forEach(coNumber => {
        const expectedPassed = byStudent.filter(r => r.coValues[coNumber] >= 55).length;
        expect(statFor(stats, coNumber).studentsPassed).toBe(expectedPassed);
      });
    });
  });
});
