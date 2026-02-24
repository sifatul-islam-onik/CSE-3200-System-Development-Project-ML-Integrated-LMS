import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  getAttainmentData,
  getSheetNames,
  saveCTData,
  getCTData,
  saveAssignmentData,
  getAssignmentData,
  getTermExamMarks,
  saveLabActivityData,
  getLabActivityData,
  saveSectionAData,
  getSectionAData,
} from '../services/attainmentService';
import { getCourseProfile } from '../services/courseProfileService';
import { getCourseStudents } from '../services/courseService';
import { getAllCourses } from '../services/courseService';
import { getAllProgramOutcomes } from '../services/programOutcomeService';
import { loadStudentsOptimized, loadAttainmentDatasets } from '../services/dataLoader';
import logger from '../utils/logger';
import '../styles/AttainmentView.css';

// Helper function to format numbers - show as integer if no decimal part, otherwise remove trailing zeros
const formatNumber = (num) => {
  if (num === 0) return '0';
  const str = num.toString();
  if (str.includes('.')) {
    return parseFloat(str).toString();
  }
  return str;
};

const AttainmentView = () => {
  const [sheetNames, setSheetNames] = useState([]);
  const [teacherCourses, setTeacherCourses] = useState([]);
  const [selectedSheet, setSelectedSheet] = useState(null);
  const [attainmentData, setAttainmentData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [userRole, setUserRole] = useState('');
  const [clos, setClos] = useState([]);
  const [programOutcomes, setProgramOutcomes] = useState([]);
  const [combinedCOPOMatrix, setCombinedCOPOMatrix] = useState(null);
  const [matchingCourseCode, setMatchingCourseCode] = useState(null);
  const [poCalcStudents, setPoCalcStudents] = useState([]);
  const [editingCLOCell, setEditingCLOCell] = useState(null);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [filteredSheets, setFilteredSheets] = useState([]);
  const [ctRows, setCtRows] = useState([]);
  const [ctFactors, setCtFactors] = useState({});
  const [ctManualWts, setCtManualWts] = useState({});
  const [ctEqWts, setCtEqWts] = useState({});
  const [ctSummary, setCtSummary] = useState({ ctTaken: 0, coMappedMarks60: 0, useEqWt: 0 });
  const [ctObtainedRows, setCtObtainedRows] = useState([]);
  const [attnAssignObtainedRows, setAttnAssignObtainedRows] = useState([]);
  const [sectionAObtainedRows, setSectionAObtainedRows] = useState([]);
  const [sectionBObtainedRows, setSectionBObtainedRows] = useState([]);
  const [saveStatus, setSaveStatus] = useState(''); // 'saving', 'saved', 'error'
  const [labActivitySaveStatus, setLabActivitySaveStatus] = useState(''); // 'saving', 'saved', 'error' for Lab Activity section
  const [sectionASaveStatus, setSectionASaveStatus] = useState(''); // 'saving', 'saved', 'error' for Section A section
  const [sectionBSaveStatus, setSectionBSaveStatus] = useState(''); // 'saving', 'saved', 'error' for Section B section
  const saveTimeoutRef = useRef(null);
  const assignmentDataLoadedRef = useRef(false);
  const ctDataLoadedRef = useRef(false);
  const labActivityDataLoadedRef = useRef(false);
  const sectionADataLoadedRef = useRef(false);
  const previousCourseIdRef = useRef(null);
  const previousCourseIdForAssignmentRef = useRef(null);
  const previousCourseIdForLabActivityRef = useRef(null);
  const previousCourseIdForSectionARef = useRef(null);

  // Assignment & Attendance states
  const [assignmentRows, setAssignmentRows] = useState([]);
  const [assignmentManualWts, setAssignmentManualWts] = useState({});
  const [attendanceMarks, setAttendanceMarks] = useState(0);
  const [assignmentSummary, setAssignmentSummary] = useState({ assignTaken: 0, assignmentMarks30: 0, useEqWt: 0 });

  // Section A states
  const [sectionARows, setSectionARows] = useState([]);

  // Section B states
  const [sectionBRows, setSectionBRows] = useState([]);

  // LabActivity states
  const [labActivityRows, setLabActivityRows] = useState([]);
  const [labActivityFactors, setLabActivityFactors] = useState({});
  const [labActivityEqWts, setLabActivityEqWts] = useState({});
  const [labActivityManualWts, setLabActivityManualWts] = useState({});
  const [labAttendanceMarks, setLabAttendanceMarks] = useState(0);
  const [labQuizMarks, setLabQuizMarks] = useState(0);
  const [labVivaMarks, setLabVivaMarks] = useState(0);

  // LabActivity summary table states
  const [activityTaken, setActivityTaken] = useState(0);
  const [otherActivityRemaining, setOtherActivityRemaining] = useState(0);
  const [otherActivityMeasured, setOtherActivityMeasured] = useState(0);
  const [coMappedActivityMarks, setCoMappedActivityMarks] = useState(0);
  const [useEqWtActivity, setUseEqWtActivity] = useState(0);

  // LabActivity obtained marks table state
  const [labActivityObtainedRows, setLabActivityObtainedRows] = useState([]);

  // Modal state for generated table
  const [showGeneratedTableModal, setShowGeneratedTableModal] = useState(false);

  // Modal state for obtained generated table
  const [showObtainedGeneratedModal, setShowObtainedGeneratedModal] = useState(false);

  // Modal state for Section A generated table
  const [showSectionAGeneratedModal, setShowSectionAGeneratedModal] = useState(false);

  // Modal state for Section A Obtained generated table
  const [showSectionAObtainedModal, setShowSectionAObtainedModal] = useState(false);

  // Modal state for Section B generated table
  const [showSectionBGeneratedModal, setShowSectionBGeneratedModal] = useState(false);

  // Modal state for Section B Obtained generated table
  const [showSectionBObtainedModal, setShowSectionBObtainedModal] = useState(false);

  // Modal state for LabActivity generated table
  const [showLabActivityGeneratedModal, setShowLabActivityGeneratedModal] = useState(false);

  // Modal state for LabActivity obtained table
  const [showLabActivityObtainedModal, setShowLabActivityObtainedModal] = useState(false);

  // Term exam marks state
  const [termExamMarks, setTermExamMarks] = useState([]);
  const [termExamLoading, setTermExamLoading] = useState(false);

  // Navigation state for LabActivity generated modal (0 = factored values, 1 = multiplication factor)
  const [labActivityGeneratedView, setLabActivityGeneratedView] = useState(0);

  // Navigation state for LabActivity obtained modal (0 = CO wise marks, 1 = CO attainment)
  const [labActivityObtainedView, setLabActivityObtainedView] = useState(0);

  // Navigation state for obtained generated modal (0 = original view, 1 = factored view)
  const [obtainedModalView, setObtainedModalView] = useState(0);

  // CO Attainment state
  const [coAttainmentData, setCoAttainmentData] = useState([]);

  // COCalc state
  const [coCalcData, setCoCalcData] = useState([]);

  // Load user role
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    setUserRole(user.role || '');
  }, []);

  // Load sheet names on mount
  useEffect(() => {
    loadSheetNames();
  }, []);

  // Load course profile function - memoized for better performance
  const loadCourseProfile = useCallback(async () => {
    if (!selectedCourse) return;
    try {
      const response = await getCourseProfile(selectedCourse.courseCode);
      if (response.success && response.data) {
        setClos(response.data);
      } else {
        setClos([]);
      }
    } catch (err) {
      logger.error('Failed to load course profile:', err);
      setClos([]);
    }
  }, [selectedCourse]);

  // Memoize sheets that require CLOs to avoid repeated string checks
  const cloDependentSheets = useMemo(() =>
    ['CourseProfile', 'CT', 'Attn_Assign', 'SectionA', 'SectionB', 'LabActivity', 'COAttainment', 'COCalc', 'COCalc_LabUnnorm', 'COPOMap', 'Charts'],
    []
  );

  // Load/clear course outcomes - optimized with memoization
  useEffect(() => {
    if (selectedCourse && cloDependentSheets.includes(selectedSheet)) {
      loadCourseProfile();
    } else {
      // Only clear if not already empty to avoid creating new array references
      if (clos.length > 0) {
        setClos([]);
      }
    }
  }, [selectedCourse, selectedSheet, loadCourseProfile, cloDependentSheets, clos.length]);

  // Initialize CT matrix rows when clos is available and CT is selected
  useEffect(() => {
    if (selectedSheet === 'CT' && clos.length > 0) {
      // Only initialize if we haven't loaded saved data and ctRows is empty or doesn't match the expected CO structure
      const shouldInitialize = !ctDataLoadedRef.current && (
        ctRows.length === 0 ||
        ctRows.length !== clos.length ||
        ctRows.some((row, idx) => {
          const expectedCoNumber = (clos[idx].cloNumber || '').toString().replace('CLO', 'CO');
          return row.coNumber !== expectedCoNumber;
        })
      );

      if (shouldInitialize) {
        const initial = clos.map(clo => ({
          coNumber: (clo.cloNumber || '').toString().replace('CLO', 'CO'),
          CT1_Q1: 0, CT1_Q2: 0, CT1_Q3: 0,
          CT2_Q1: 0, CT2_Q2: 0, CT2_Q3: 0,
          CT3_Q1: 0, CT3_Q2: 0, CT3_Q3: 0,
        }));
        setCtRows(initial);
        // initialize factors (default 1) and manual weights (default 0)
        const fields = ['CT1_Q1', 'CT1_Q2', 'CT1_Q3', 'CT2_Q1', 'CT2_Q2', 'CT2_Q3', 'CT3_Q1', 'CT3_Q2', 'CT3_Q3'];
        const manualInit = {};
        fields.forEach(f => { manualInit[f] = 0; });
        setCtFactors({ CT1: 1, CT2: 1, CT3: 1 });
        setCtEqWts({ CT1: 0, CT2: 0, CT3: 0 });
        setCtManualWts(manualInit);
        setCtSummary({ ctTaken: 0, coMappedMarks60: 0, useEqWt: 0 });
      }
    }
    // Don't clear CT data when on COCalc sheets (they need CT data for calculations)
    if (selectedSheet !== 'CT' && selectedSheet !== 'COCalc' && selectedSheet !== 'COCalc_LabUnnorm') {
      setCtRows([]);
      setCtFactors({});
      setCtEqWts({});
      setCtManualWts({});
      setCtSummary({ ctTaken: 0, coMappedMarks60: 0, useEqWt: 0 });
      ctDataLoadedRef.current = false; // Reset when leaving the sheet
    }
  }, [selectedSheet, clos]);

  // Initialize Assignment matrix rows when clos is available and Attn_Assign is selected
  useEffect(() => {
    if (selectedSheet === 'Attn_Assign' && clos.length > 0) {
      // Only initialize if we haven't loaded saved data and assignmentRows is empty or doesn't match the expected CO structure
      // This prevents overwriting saved data when clos updates
      const shouldInitialize = !assignmentDataLoadedRef.current && (
        assignmentRows.length === 0 ||
        assignmentRows.length !== clos.length ||
        assignmentRows.some((row, idx) => {
          const expectedCoNumber = (clos[idx].cloNumber || '').toString().replace('CLO', 'CO');
          return row.coNumber !== expectedCoNumber;
        })
      );

      if (shouldInitialize) {
        const initial = clos.map(clo => ({
          coNumber: (clo.cloNumber || '').toString().replace('CLO', 'CO'),
          attendance: 0,
          Assgn1_Q1: 0, Assgn1_Q2: 0, Assgn1_Q3: 0,
          Assgn2_Q1: 0, Assgn2_Q2: 0, Assgn2_Q3: 0,
          Assgn3_Q1: 0, Assgn3_Q2: 0, Assgn3_Q3: 0,
        }));
        setAssignmentRows(initial);

        // Initialize manual wt
        const manualInit = {};
        ['Assgn1_Q1', 'Assgn1_Q2', 'Assgn1_Q3', 'Assgn2_Q1', 'Assgn2_Q2', 'Assgn2_Q3', 'Assgn3_Q1', 'Assgn3_Q2', 'Assgn3_Q3'].forEach(f => {
          manualInit[f] = 0;
        });
        setAssignmentManualWts(manualInit);

        // Get attendance marks from course
        if (selectedCourse && selectedCourse.attendanceMarks) {
          setAttendanceMarks(selectedCourse.attendanceMarks);
        } else {
          setAttendanceMarks(0);
        }
      }
    }
    // Don't clear Assignment data when on COCalc sheets (they need Assignment data for calculations)
    if (selectedSheet !== 'Attn_Assign' && selectedSheet !== 'COCalc' && selectedSheet !== 'COCalc_LabUnnorm') {
      setAssignmentRows([]);
      setAssignmentManualWts({});
      setAttendanceMarks(0);
      assignmentDataLoadedRef.current = false; // Reset when leaving the sheet
    }
  }, [selectedSheet, clos, selectedCourse]);

  // Initialize SectionA matrix rows when clos is available and SectionA is selected
  useEffect(() => {
    if (selectedSheet === 'SectionA' && clos.length > 0 && !sectionADataLoadedRef.current) {
      // Only initialize if we don't already have rows
      if (sectionARows.length === 0) {
        const initial = clos.map(clo => ({
          coNumber: (clo.cloNumber || '').toString().replace('CLO', 'CO'),
          Q1a: 0, Q1b: 0, Q1c: 0, Q1d: 0,
          Q2a: 0, Q2b: 0, Q2c: 0, Q2d: 0,
          Q3a: 0, Q3b: 0, Q3c: 0, Q3d: 0,
          Q4a: 0, Q4b: 0, Q4c: 0, Q4d: 0,
          // Generated table combinations
          q123: 0, q124: 0, q134: 0, q234: 0,
          q12: 0, q13: 0, q14: 0, q23: 0, q24: 0, q34: 0,
          q1: 0, q2: 0, q3: 0, q4: 0, none: 0
        }));
        setSectionARows(initial);
      }
    }
    if (selectedSheet !== 'SectionA' && !sectionADataLoadedRef.current) {
      setSectionARows([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSheet, clos]);

  // Initialize SectionB matrix rows when clos is available and SectionB is selected
  useEffect(() => {
    if (selectedSheet === 'SectionB' && clos.length > 0) {
      // Only initialize if we don't already have rows
      if (sectionBRows.length === 0) {
        const initial = clos.map(clo => ({
          coNumber: (clo.cloNumber || '').toString().replace('CLO', 'CO'),
          Q1a: 0, Q1b: 0, Q1c: 0, Q1d: 0,
          Q2a: 0, Q2b: 0, Q2c: 0, Q2d: 0,
          Q3a: 0, Q3b: 0, Q3c: 0, Q3d: 0,
          Q4a: 0, Q4b: 0, Q4c: 0, Q4d: 0,
          // Add combination fields
          q123: 0, q124: 0, q134: 0, q234: 0,
          q12: 0, q13: 0, q14: 0, q23: 0, q24: 0, q34: 0,
          q1: 0, q2: 0, q3: 0, q4: 0, none: 0
        }));
        setSectionBRows(initial);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSheet, clos]);

  // Initialize LabActivity matrix rows when clos is available and LabActivity is selected
  useEffect(() => {
    if (selectedSheet === 'LabActivity' && clos.length > 0) {
      // Only initialize if no saved data has been loaded
      if (!labActivityDataLoadedRef.current) {
        const initial = clos.map(clo => ({
          coNumber: (clo.cloNumber || '').toString().replace('CLO', 'CO'),
          attn: 0,
          quiz: 0,
          viva: 0,
          Activity1_Q1: 0, Activity1_Q2: 0, Activity1_Q3: 0,
          Activity2_Q1: 0, Activity2_Q2: 0, Activity2_Q3: 0,
          Activity3_Q1: 0, Activity3_Q2: 0, Activity3_Q3: 0,
          Activity4_Q1: 0, Activity4_Q2: 0, Activity4_Q3: 0,
          Activity5_Q1: 0, Activity5_Q2: 0, Activity5_Q3: 0,
          measuredTotal: 0,
          coTotal: 0
        }));
        setLabActivityRows(initial);
        setLabActivityFactors({});
        setLabActivityEqWts({});
        setLabActivityManualWts({});
        setLabAttendanceMarks(0);
        setLabQuizMarks(0);
        setLabVivaMarks(0);
      }
    }
    // Don't clear Lab Activity data when on COCalc (it needs Lab Activity data for calculations)
    if (selectedSheet !== 'LabActivity' && selectedSheet !== 'COCalc') {
      setLabActivityRows([]);
    }
  }, [selectedSheet, clos]);

  // Initialize CO Attainment data when COAttainment sheet is selected - OPTIMIZED
  useEffect(() => {
    const calculateCOAttainment = async () => {
      if (selectedSheet === 'COAttainment' && selectedCourse && clos.length > 0) {

        // Use optimized parallel loader
        const uniqueStudents = await loadStudentsOptimized(selectedCourse, sheetNames);


        if (uniqueStudents.length === 0) {
          setCoAttainmentData([]);
          return;
        }

        // Load all required datasets in parallel
        const datasets = await loadAttainmentDatasets(selectedCourse, ['ct', 'assignment', 'termExam']);

        // Extract CT obtained marks
        const ctData = datasets.ct?.ctObtainedRows || [];

        // Calculate CO attainment for each student
        const attainmentRows = uniqueStudents.map(student => {
          const row = {
            rollNumber: student.rollNumber,
            coValues: {}
          };

          // Find student's obtained marks from CT data
          const studentCTData = ctData.find(s =>
            String(s.rollNumber || '').trim().toLowerCase() ===
            String(student.rollNumber || '').trim().toLowerCase()
          );

          // For each CO, calculate attainment percentage
          clos.forEach(clo => {
            const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
            let totalObtained = 0;
            let totalAllocated = 0;

            // Calculate from CT data if available
            if (studentCTData && studentCTData.coMarks) {
              const coMarks = studentCTData.coMarks[coNumber];
              if (coMarks) {
                totalObtained += coMarks.obtained || 0;
                totalAllocated += coMarks.allocated || 0;
              }
            }

            // Calculate percentage
            const percentage = totalAllocated > 0
              ? (totalObtained / totalAllocated) * 100
              : 0;

            row.coValues[coNumber] = Math.round(percentage * 100) / 100;
          });

          return row;
        });

        setCoAttainmentData(attainmentRows);
      } else {
        setCoAttainmentData([]);
      }
    };

    calculateCOAttainment();
  }, [selectedSheet, selectedCourse, clos, sheetNames]);

  // Initialize COCalc data when COCalc or COCalc_LabUnnorm sheet is selected
  useEffect(() => {
    const loadCOCalcData = async () => {
      if ((selectedSheet === 'COCalc' || selectedSheet === 'COCalc_LabUnnorm') && selectedCourse && clos.length > 0) {

        // Get students list
        let allStudents = [];

        if (selectedCourse._id) {
          try {
            const resp = await getCourseStudents(selectedCourse._id);
            if (resp.success && Array.isArray(resp.data) && resp.data.length > 0) {
              allStudents = resp.data.map(s => ({
                rollNumber: s.roll || s.rollNumber
              }));
            }
          } catch (err) {
          }
        }

        // Fallback: try Section sheets
        if (allStudents.length === 0 && sheetNames.includes('Section A')) {
          try {
            const sectAData = await getAttainmentData(selectedCourse._id, 'Section A');
            if (sectAData.success && Array.isArray(sectAData.data)) {
              allStudents = sectAData.data.map(s => ({ rollNumber: s.rollNumber }));
            }
          } catch (err) {
          }
        }

        // Deduplicate students
        const uniqueStudents = [];
        const seenRolls = new Set();
        allStudents.forEach(student => {
          const rollLower = String(student.rollNumber || '').trim().toLowerCase();
          if (rollLower && !seenRolls.has(rollLower)) {
            seenRolls.add(rollLower);
            uniqueStudents.push(student);
          }
        });

        // Get CT and Assignment data
        let ctData = [];
        let assignData = [];

        if (sheetNames.includes('CT')) {
          try {
            const ctResp = await getCTData(selectedCourse._id);
            if (ctResp.success && Array.isArray(ctResp.data)) {
              ctData = ctResp.data;
            }
          } catch (err) {
          }
        }

        // Fetch term exam marks for this course
        let termMarksData = [];
        try {
          setTermExamLoading(true);

          const termResp = await getTermExamMarks(selectedCourse._id, selectedCourse.section);

          if (termResp.success && Array.isArray(termResp.data)) {
            setTermExamMarks(termResp.data);
            termMarksData = termResp.data;
          } else {
            setTermExamMarks([]);
          }
        } catch (err) {
          console.error('Error loading term exam marks:', err);
          setTermExamMarks([]);
        } finally {
          setTermExamLoading(false);
        }

        // Transform term exam marks into sectionA and sectionB format
        // Term marks structure: { marks: { a: {1,2,3,4,5,6,7,8}, b: {...}, ... } }
        // Questions 1-4 are Section A, Questions 5-8 are Section B
        // But we need format: { rollNumber, obtained_CO1, allocated_CO1, obtained_CO2, allocated_CO2, ... }

        // For now, use the existing sectionA/B data fetch
        // TODO: Calculate CO-wise marks from term exam marks based on question-CO mapping
        if (termMarksData.length > 0 && !sheetNames.includes('Section A') && !sheetNames.includes('Section B')) {
          // If we have term marks but no Section A/B sheets, we need to process term marks
          // This requires knowing which questions map to which COs
          // For now, just note that term marks are available
          // The actual CO mapping would need to come from course profile or CO definitions
        }

        if (sheetNames.includes('Attn_Assign')) {
          try {
            const assignResp = await getAttainmentData(selectedCourse._id, 'Attn_Assign');
            if (assignResp.success && Array.isArray(assignResp.data)) {
              assignData = assignResp.data;
            }
          } catch (err) {
          }
        }

        // Build COCalc rows
        const calcRows = uniqueStudents.map(student => {
          const row = {
            rollNumber: student.rollNumber,
            sectionA: {
              marksObtained: {},
              marksDistribution: {}
            },
            sectionB: {
              marksObtained: {},
              marksDistribution: {}
            },
            ct: {
              marksObtained: {},
              marksDistribution: {}
            },
            assignment: {
              marksObtained: {},
              marksDistribution: {}
            },
            attendance: 0,
            total: {
              marksObtained: {},
              marksDistribution: {}
            }
          };

          // Find student data in CT
          const studentCT = ctData.find(s =>
            String(s.rollNumber || '').trim().toLowerCase() ===
            String(student.rollNumber || '').trim().toLowerCase()
          );

          // Find student data in Assignment
          const studentAssign = assignData.find(s =>
            String(s.rollNumber || '').trim().toLowerCase() ===
            String(student.rollNumber || '').trim().toLowerCase()
          );

          // Populate CO marks for Section A
          clos.forEach(clo => {
            const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');

            // Find student in sectionAObtainedRows for real-time calculation
            const studentObtainedA = sectionAObtainedRows.find(s =>
              String(s.rollNumber || '').trim().toLowerCase() ===
              String(student.rollNumber || '').trim().toLowerCase()
            );

            // Calculate marks obtained using the same logic as getStudentCOTotal
            let marksObtained = 0;
            if (studentObtainedA) {
              const coRow = sectionARows.find(r => r.coNumber === coNumber);
              if (coRow) {
                const parts = ['a', 'b', 'c', 'd'];
                marksObtained = [1, 2, 3, 4].reduce((total, qNum) => {
                  return total + parts.reduce((qSum, part) => {
                    const field = `Q${qNum}${part}`;
                    const allocated = parseFloat(coRow[field]) || 0;
                    const obtained = parseFloat(studentObtainedA[field]) || 0;
                    return qSum + (allocated > 0 ? obtained : 0);
                  }, 0);
                }, 0);
              }
            }

            row.sectionA.marksObtained[coNumber] = marksObtained;

            // Calculate marks distribution using HLOOKUP logic (same as getStudentCODistribution)
            let marksDistribution = 0;
            if (studentObtainedA) {
              const coRow = sectionARows.find(r => r.coNumber === coNumber);
              if (coRow) {
                // Get the student's answer combination
                const answeredQuestions = [];
                for (let qNum = 1; qNum <= 4; qNum++) {
                  const parts = ['a', 'b', 'c', 'd'];
                  const questionTotal = parts.reduce((sum, part) => {
                    const field = `Q${qNum}${part}`;
                    return sum + (parseFloat(studentObtainedA[field]) || 0);
                  }, 0);
                  if (questionTotal > 0) {
                    answeredQuestions.push(qNum);
                  }
                }
                const answerCombination = answeredQuestions.length > 0 ? answeredQuestions.join(',') : 'None';

                // Convert to combination key
                const combinationMap = {
                  '1,2,3': 'q123', '1,2,4': 'q124', '1,3,4': 'q134', '2,3,4': 'q234',
                  '1,2': 'q12', '1,3': 'q13', '1,4': 'q14', '2,3': 'q23', '2,4': 'q24', '3,4': 'q34',
                  '1': 'q1', '2': 'q2', '3': 'q3', '4': 'q4'
                };
                const combinationKey = answerCombination === 'None' ? 'none' : (combinationMap[answerCombination] || 'none');

                // Calculate auto-generated combination value
                const q1Total = (coRow.Q1a || 0) + (coRow.Q1b || 0) + (coRow.Q1c || 0) + (coRow.Q1d || 0);
                const q2Total = (coRow.Q2a || 0) + (coRow.Q2b || 0) + (coRow.Q2c || 0) + (coRow.Q2d || 0);
                const q3Total = (coRow.Q3a || 0) + (coRow.Q3b || 0) + (coRow.Q3c || 0) + (coRow.Q3d || 0);
                const q4Total = (coRow.Q4a || 0) + (coRow.Q4b || 0) + (coRow.Q4c || 0) + (coRow.Q4d || 0);

                switch (combinationKey) {
                  case 'q123': marksDistribution = q1Total + q2Total + q3Total; break;
                  case 'q124': marksDistribution = q1Total + q2Total + q4Total; break;
                  case 'q134': marksDistribution = q1Total + q3Total + q4Total; break;
                  case 'q234': marksDistribution = q2Total + q3Total + q4Total; break;
                  case 'q12': marksDistribution = q1Total + q2Total; break;
                  case 'q13': marksDistribution = q1Total + q3Total; break;
                  case 'q14': marksDistribution = q1Total + q4Total; break;
                  case 'q23': marksDistribution = q2Total + q3Total; break;
                  case 'q24': marksDistribution = q2Total + q4Total; break;
                  case 'q34': marksDistribution = q3Total + q4Total; break;
                  case 'q1': marksDistribution = q1Total; break;
                  case 'q2': marksDistribution = q2Total; break;
                  case 'q3': marksDistribution = q3Total; break;
                  case 'q4': marksDistribution = q4Total; break;
                  default: marksDistribution = 0;
                }
              }
            }
            row.sectionA.marksDistribution[coNumber] = marksDistribution;
          });

          // Populate CO marks for Section B
          clos.forEach(clo => {
            const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');

            // Find student in sectionBObtainedRows for real-time calculation
            const studentObtainedB = sectionBObtainedRows.find(s =>
              String(s.rollNumber || '').trim().toLowerCase() ===
              String(student.rollNumber || '').trim().toLowerCase()
            );

            // Calculate marks obtained using the same logic as getStudentCOTotalB
            let marksObtained = 0;
            if (studentObtainedB) {
              const coRow = sectionBRows.find(r => r.coNumber === coNumber);
              if (coRow) {
                const parts = ['a', 'b', 'c', 'd'];
                marksObtained = [1, 2, 3, 4].reduce((total, qNum) => {
                  return total + parts.reduce((qSum, part) => {
                    const field = `Q${qNum}${part}`;
                    const allocated = parseFloat(coRow[field]) || 0;
                    const obtained = parseFloat(studentObtainedB[field]) || 0;
                    return qSum + (allocated > 0 ? obtained : 0);
                  }, 0);
                }, 0);
              }
            }

            row.sectionB.marksObtained[coNumber] = marksObtained;

            // Calculate marks distribution using HLOOKUP logic (same as getStudentCODistributionB)
            let marksDistributionB = 0;
            if (studentObtainedB) {
              const coRow = sectionBRows.find(r => r.coNumber === coNumber);
              if (coRow) {
                // Get the student's answer combination (questions 5-8 displayed, stored as 1-4)
                const answeredQuestions = [];
                for (let qNum = 1; qNum <= 4; qNum++) {
                  const parts = ['a', 'b', 'c', 'd'];
                  const questionTotal = parts.reduce((sum, part) => {
                    const field = `Q${qNum}${part}`;
                    return sum + (parseFloat(studentObtainedB[field]) || 0);
                  }, 0);
                  if (questionTotal > 0) {
                    answeredQuestions.push(qNum + 4); // Map 1-4 to 5-8 for display
                  }
                }
                const answerCombination = answeredQuestions.length > 0 ? answeredQuestions.join(',') : 'None';

                // Convert to combination key (5,6,7,8 map to q1,q2,q3,q4 internally)
                const combinationMap = {
                  '5,6,7': 'q123', '5,6,8': 'q124', '5,7,8': 'q134', '6,7,8': 'q234',
                  '5,6': 'q12', '5,7': 'q13', '5,8': 'q14', '6,7': 'q23', '6,8': 'q24', '7,8': 'q34',
                  '5': 'q1', '6': 'q2', '7': 'q3', '8': 'q4'
                };
                const combinationKey = answerCombination === 'None' ? 'none' : (combinationMap[answerCombination] || 'none');

                // Calculate auto-generated combination value
                const q1Total = (coRow.Q1a || 0) + (coRow.Q1b || 0) + (coRow.Q1c || 0) + (coRow.Q1d || 0);
                const q2Total = (coRow.Q2a || 0) + (coRow.Q2b || 0) + (coRow.Q2c || 0) + (coRow.Q2d || 0);
                const q3Total = (coRow.Q3a || 0) + (coRow.Q3b || 0) + (coRow.Q3c || 0) + (coRow.Q3d || 0);
                const q4Total = (coRow.Q4a || 0) + (coRow.Q4b || 0) + (coRow.Q4c || 0) + (coRow.Q4d || 0);

                switch (combinationKey) {
                  case 'q123': marksDistributionB = q1Total + q2Total + q3Total; break;
                  case 'q124': marksDistributionB = q1Total + q2Total + q4Total; break;
                  case 'q134': marksDistributionB = q1Total + q3Total + q4Total; break;
                  case 'q234': marksDistributionB = q2Total + q3Total + q4Total; break;
                  case 'q12': marksDistributionB = q1Total + q2Total; break;
                  case 'q13': marksDistributionB = q1Total + q3Total; break;
                  case 'q14': marksDistributionB = q1Total + q4Total; break;
                  case 'q23': marksDistributionB = q2Total + q3Total; break;
                  case 'q24': marksDistributionB = q2Total + q4Total; break;
                  case 'q34': marksDistributionB = q3Total + q4Total; break;
                  case 'q1': marksDistributionB = q1Total; break;
                  case 'q2': marksDistributionB = q2Total; break;
                  case 'q3': marksDistributionB = q3Total; break;
                  case 'q4': marksDistributionB = q4Total; break;
                  default: marksDistributionB = 0;
                }
              }
            }
            row.sectionB.marksDistribution[coNumber] = marksDistributionB;
          });

          // Populate CO marks for CT
          clos.forEach(clo => {
            const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
            if (studentCT) {
              row.ct.marksObtained[coNumber] = studentCT[`obtained_${coNumber}`] || 0;
              row.ct.marksDistribution[coNumber] = studentCT[`allocated_${coNumber}`] || 0;
            } else {
              row.ct.marksObtained[coNumber] = 0;
              row.ct.marksDistribution[coNumber] = 0;
            }
          });

          // Populate CO marks for Assignment
          clos.forEach(clo => {
            const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
            if (studentAssign) {
              row.assignment.marksObtained[coNumber] = studentAssign[`obtained_${coNumber}`] || 0;
              row.assignment.marksDistribution[coNumber] = studentAssign[`allocated_${coNumber}`] || 0;
            } else {
              row.assignment.marksObtained[coNumber] = 0;
              row.assignment.marksDistribution[coNumber] = 0;
            }
          });

          // Populate attendance marks
          if (studentAssign) {
            row.attendance = studentAssign.attendanceMark || studentAssign.attendance || 0;
          } else {
            row.attendance = 0;
          }

          // Calculate total marks (CT + Assign + Section A + Section B)
          clos.forEach(clo => {
            const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');

            let totalObtained = 0;
            let totalAllocated = 0;

            // Add CT marks
            if (studentCT) {
              totalObtained += studentCT[`obtained_${coNumber}`] || 0;
              totalAllocated += studentCT[`allocated_${coNumber}`] || 0;
            }

            // Add Assignment marks
            if (studentAssign) {
              totalObtained += studentAssign[`obtained_${coNumber}`] || 0;
              totalAllocated += studentAssign[`allocated_${coNumber}`] || 0;
            }

            // Add Section A marks
            totalObtained += row.sectionA.marksObtained[coNumber];
            totalAllocated += row.sectionA.marksDistribution[coNumber];

            // Add Section B marks
            totalObtained += row.sectionB.marksObtained[coNumber];
            totalAllocated += row.sectionB.marksDistribution[coNumber];

            row.total.marksObtained[coNumber] = totalObtained;
            row.total.marksDistribution[coNumber] = totalAllocated;
          });

          return row;
        });

        setCoCalcData(calcRows);
      } else {
        setCoCalcData([]);
      }
    };

    loadCOCalcData();
  }, [selectedSheet, selectedCourse, clos, sheetNames, sectionAObtainedRows, sectionARows, sectionBObtainedRows, sectionBRows]);

  // Initialize Obtained Marks table rows from student list when CT, Attn_Assign, SectionA or SectionB selected
  const initObtainedRows = useCallback(async (forSheet) => {
    // Don't initialize if we already have saved data for this sheet type
    // Only check the ref (not state length) because setState is async
    if (forSheet === 'CT' && ctDataLoadedRef.current) {
      return;
    }
    if (forSheet === 'Attn_Assign' && assignmentDataLoadedRef.current) {
      return;
    }
    if (forSheet === 'LabActivity' && labActivityDataLoadedRef.current) {
      return;
    }
    // For Section A/B: Check if data has already been loaded from backend
    if ((forSheet === 'SectionA' || forSheet === 'SectionB') && sectionADataLoadedRef.current) {
      return;
    }


    let allStudents = [];
    if (selectedCourse && selectedCourse._id) {
      try {
        const resp = await getCourseStudents(selectedCourse._id);
        if (resp.success && Array.isArray(resp.data) && resp.data.length > 0) {
          allStudents = resp.data.map(s => ({ rollNumber: s.roll || s.rollNumber, name: s.name }));
        } else {
        }
      } catch (error) {
      }
    } else {
    }
    if (allStudents.length === 0) {
      const sectionSheets = (sheetNames || []).filter(name => /^Section/i.test(name));
      for (const sName of sectionSheets) {
        try {
          const resp = await getAttainmentData(sName);
          const list = Array.isArray(resp?.data?.students) ? resp.data.students : [];
          if (list.length) allStudents = allStudents.concat(list);
        } catch (error) {
        }
      }
    }
    if (allStudents.length === 0 && (sheetNames || []).includes('Attn_Assign')) {
      try {
        const resp = await getAttainmentData('Attn_Assign');
        const list = Array.isArray(resp?.data?.students) ? resp.data.students : [];
        if (list.length) allStudents = allStudents.concat(list);
      } catch (error) {
      }
    }
    if (allStudents.length === 0 && Array.isArray(attainmentData?.students)) {
      allStudents = attainmentData.students;
    }

    let uniqueByRoll = [];
    const seen = new Set();
    for (const stu of allStudents) {
      let rn = stu.rollNumber || stu.roll || stu.roll_no || stu.Roll || stu.ROLL;
      if (!rn && typeof stu === 'string') rn = stu;
      if (!rn) continue;
      rn = String(rn).trim();
      const lower = rn.toLowerCase();
      if (lower === 'roll' || lower === 'roll no' || lower === 'roll number') continue;
      const rollPattern = /^[0-9]{4,}$/;
      if (!rollPattern.test(rn)) continue;
      if (!seen.has(rn)) {
        seen.add(rn);
        uniqueByRoll.push({ rollNumber: rn, name: stu.name || '' });
      }
    }

    uniqueByRoll.sort((a, b) => {
      const aNum = String(a.rollNumber).replace(/\D/g, '');
      const bNum = String(b.rollNumber).replace(/\D/g, '');
      return aNum.localeCompare(bNum, undefined, { numeric: true });
    });

    // If no valid students found after processing, don't add sample students
    if (uniqueByRoll.length === 0) {
    }
    if (uniqueByRoll.length > 0) {
      // Don't initialize CT if saved data has been loaded
      if (!ctDataLoadedRef.current) {
        const initial = uniqueByRoll.map(stu => ({
          rollNumber: stu.rollNumber,
          name: stu.name,
          CT1_Q1: 0, CT1_Q2: 0, CT1_Q3: 0,
          CT2_Q1: 0, CT2_Q2: 0, CT2_Q3: 0,
          CT3_Q1: 0, CT3_Q2: 0, CT3_Q3: 0,
        }));
        setCtObtainedRows(initial);
      }
      // Don't initialize Attn_Assign if saved data has been loaded
      if (!assignmentDataLoadedRef.current) {
        const initial = uniqueByRoll.map(stu => ({
          rollNumber: stu.rollNumber,
          name: stu.name,
          attendance: 0,
          Assgn1_Q1: 0, Assgn1_Q2: 0, Assgn1_Q3: 0,
          Assgn2_Q1: 0, Assgn2_Q2: 0, Assgn2_Q3: 0,
          Assgn3_Q1: 0, Assgn3_Q2: 0, Assgn3_Q3: 0,
        }));
        setAttnAssignObtainedRows(initial);
      }
      // Section A
      const initialSectionA = uniqueByRoll.map(stu => {
        // Check if we have term marks for this student
        let studentData = {
          rollNumber: stu.rollNumber,
          name: stu.name,
          Q1a: 0, Q1b: 0, Q1c: 0, Q1d: 0,
          Q2a: 0, Q2b: 0, Q2c: 0, Q2d: 0,
          Q3a: 0, Q3b: 0, Q3c: 0, Q3d: 0,
          Q4a: 0, Q4b: 0, Q4c: 0, Q4d: 0,
        };

        // Try to populate from term marks if available
        if (termExamMarks && termExamMarks.length > 0) {
          const studentTermMarks = termExamMarks.find(tm => {
            if (!tm.student) return false;
            const termRoll = tm.student.roll || tm.student.rollNumber;
            return termRoll && String(termRoll).trim() === String(stu.rollNumber).trim();
          });

          if (studentTermMarks && studentTermMarks.marks) {
            const marks = studentTermMarks.marks;

            // Helper function to safely get numeric value
            const getValue = (row, question) => {
              const val = marks[row]?.[question] || marks[row]?.[String(question)];
              if (val === null || val === undefined || val === '') return 0;
              const num = parseFloat(val);
              return isNaN(num) ? 0 : num;
            };

            studentData = {
              ...studentData,
              Q1a: getValue('a', '1'),
              Q1b: getValue('b', '1'),
              Q1c: getValue('c', '1'),
              Q1d: getValue('d', '1'),
              Q2a: getValue('a', '2'),
              Q2b: getValue('b', '2'),
              Q2c: getValue('c', '2'),
              Q2d: getValue('d', '2'),
              Q3a: getValue('a', '3'),
              Q3b: getValue('b', '3'),
              Q3c: getValue('c', '3'),
              Q3d: getValue('d', '3'),
              Q4a: getValue('a', '4'),
              Q4b: getValue('b', '4'),
              Q4c: getValue('c', '4'),
              Q4d: getValue('d', '4'),
            };
          } else {
          }
        } else {
        }

        return studentData;
      });
      setSectionAObtainedRows(initialSectionA);
      // Section B

      const initialSectionB = uniqueByRoll.map(stu => {
        // Check if we have term marks for this student
        let studentData = {
          rollNumber: stu.rollNumber,
          name: stu.name,
          Q1a: 0, Q1b: 0, Q1c: 0, Q1d: 0,
          Q2a: 0, Q2b: 0, Q2c: 0, Q2d: 0,
          Q3a: 0, Q3b: 0, Q3c: 0, Q3d: 0,
          Q4a: 0, Q4b: 0, Q4c: 0, Q4d: 0,
        };

        // Try to populate from term marks if available
        if (termExamMarks && termExamMarks.length > 0) {
          const studentTermMarks = termExamMarks.find(tm => {
            if (!tm.student) return false;
            const termRoll = tm.student.roll || tm.student.rollNumber;
            return termRoll && String(termRoll).trim() === String(stu.rollNumber).trim();
          });

          if (studentTermMarks && studentTermMarks.marks) {
            const marks = studentTermMarks.marks;

            // Helper function to safely get numeric value
            const getValue = (row, question) => {
              const val = marks[row]?.[question] || marks[row]?.[String(question)];
              if (val === null || val === undefined || val === '') return 0;
              const num = parseFloat(val);
              return isNaN(num) ? 0 : num;
            };

            studentData = {
              ...studentData,
              // Section B uses questions 5-8 from term marks
              Q1a: getValue('a', '5'),
              Q1b: getValue('b', '5'),
              Q1c: getValue('c', '5'),
              Q1d: getValue('d', '5'),
              Q2a: getValue('a', '6'),
              Q2b: getValue('b', '6'),
              Q2c: getValue('c', '6'),
              Q2d: getValue('d', '6'),
              Q3a: getValue('a', '7'),
              Q3b: getValue('b', '7'),
              Q3c: getValue('c', '7'),
              Q3d: getValue('d', '7'),
              Q4a: getValue('a', '8'),
              Q4b: getValue('b', '8'),
              Q4c: getValue('c', '8'),
              Q4d: getValue('d', '8'),
            };
          }
        }

        return studentData;
      });
      setSectionBObtainedRows(initialSectionB);
      // Don't initialize LabActivity if saved data has been loaded
      if (!labActivityDataLoadedRef.current) {
        const initial = uniqueByRoll.map(stu => ({
          rollNumber: stu.rollNumber,
          name: stu.name,
          attn: 0,
          quiz: 0,
          viva: 0,
          Activity1_Q1: 0, Activity1_Q2: 0, Activity1_Q3: 0,
          Activity2_Q1: 0, Activity2_Q2: 0, Activity2_Q3: 0,
          Activity3_Q1: 0, Activity3_Q2: 0, Activity3_Q3: 0,
          Activity4_Q1: 0, Activity4_Q2: 0, Activity4_Q3: 0,
          Activity5_Q1: 0, Activity5_Q2: 0, Activity5_Q3: 0,
          otherMeasured: 0,
          other: 0,
        }));
        setLabActivityObtainedRows(initial);
      } else {
      }
    } else {
      // Don't clear if saved data has been loaded
      if (!ctDataLoadedRef.current) {
        setCtObtainedRows([]);
      }
      if (!assignmentDataLoadedRef.current) {
        setAttnAssignObtainedRows([]);
      }
      if (!sectionADataLoadedRef.current) {
        setSectionAObtainedRows([]);
        setSectionBObtainedRows([]);
      }
      if (!labActivityDataLoadedRef.current) {
        setLabActivityObtainedRows([]);
      }
    }
  }, [selectedCourse, sheetNames, attainmentData, termExamMarks]);

  // Effect to trigger initialization when sheet changes
  useEffect(() => {
    if (selectedSheet === 'CT') initObtainedRows('CT');
    else if (selectedSheet === 'Attn_Assign') initObtainedRows('Attn_Assign');
    else if (selectedSheet === 'SectionA') initObtainedRows('SectionA');
    else if (selectedSheet === 'SectionB') initObtainedRows('SectionB');
    else if (selectedSheet === 'LabActivity') initObtainedRows('LabActivity');
  }, [selectedSheet, initObtainedRows]);

  // Load Program Outcomes when COPOMap, POCalcMax, Charts, CheckPO, or POCalc is selected
  useEffect(() => {
    const loadProgramOutcomes = async () => {
      if (selectedSheet === 'COPOMap' || selectedSheet === 'POCalcMax' || selectedSheet === 'Charts' || selectedSheet === 'CheckPO' || selectedSheet === 'POCalc') {
        try {
          const poResponse = await getAllProgramOutcomes();
          if (poResponse.success && poResponse.data) {
            setProgramOutcomes(poResponse.data);
          }
        } catch (err) {
          logger.error('Failed to load program outcomes:', err);
        }
      }
    };
    loadProgramOutcomes();
  }, [selectedSheet]);

  // Load students when POCalcMax, CheckPO, or POCalc is selected
  useEffect(() => {
    const loadStudents = async () => {
      if ((selectedSheet === 'POCalcMax' || selectedSheet === 'CheckPO' || selectedSheet === 'POCalc') && selectedCourse && selectedCourse._id) {
        try {
          const resp = await getCourseStudents(selectedCourse._id);
          if (resp.success && Array.isArray(resp.data)) {
            const students = resp.data.map(s => ({
              rollNumber: s.roll || s.rollNumber,
              name: s.name
            }));
            setPoCalcStudents(students);
          }
        } catch (err) {
          logger.error('Failed to load students:', err);
          setPoCalcStudents([]);
        }
      }
    };
    loadStudents();
  }, [selectedSheet, selectedCourse]);

  // Load combined CO-PO matrix for theory and lab courses
  useEffect(() => {
    const loadCombinedCOPOMatrix = async () => {
      if (selectedSheet === 'COPOMap' && selectedCourse && selectedCourse.courseCode) {
        try {
          const courseCode = selectedCourse.courseCode;
          const lastDigit = parseInt(courseCode.slice(-1));

          if (isNaN(lastDigit)) return;

          // Determine if current course is theory (odd) or lab (even)
          const isTheory = lastDigit % 2 === 1;

          // Generate matching course code
          const baseCode = courseCode.slice(0, -1);
          const matchingLastDigit = isTheory ? lastDigit + 1 : lastDigit - 1;
          const matchingCode = baseCode + matchingLastDigit;

          setMatchingCourseCode(matchingCode);

          // Load both course profiles
          const [currentProfile, matchingProfile] = await Promise.all([
            getCourseProfile(courseCode),
            getCourseProfile(matchingCode).catch(() => ({ success: false, data: [] }))
          ]);

          if (!currentProfile.success || !currentProfile.data) {
            setCombinedCOPOMatrix(null);
            return;
          }

          const currentCLOs = currentProfile.data;
          const matchingCLOs = matchingProfile.success ? matchingProfile.data : [];

          // Create combined matrix
          const combined = {};

          // Process current course CLOs
          currentCLOs.forEach(clo => {
            const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
            const ploAssessed = clo.ploAssessed || '';
            const mappedPOs = new Set();

            if (ploAssessed && ploAssessed.trim()) {
              const parts = ploAssessed.split(',').map(p => p.trim());
              parts.forEach(part => {
                const poNum = parseInt(part);
                if (!isNaN(poNum) && poNum > 0) {
                  mappedPOs.add(poNum);
                }
              });
            }

            combined[coNumber] = Array.from(mappedPOs);
          });

          // Merge matching course CLOs (OR logic)
          matchingCLOs.forEach(clo => {
            const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
            const ploAssessed = clo.ploAssessed || '';

            if (ploAssessed && ploAssessed.trim()) {
              const parts = ploAssessed.split(',').map(p => p.trim());
              parts.forEach(part => {
                const poNum = parseInt(part);
                if (!isNaN(poNum) && poNum > 0) {
                  if (!combined[coNumber]) {
                    combined[coNumber] = [];
                  }
                  if (!combined[coNumber].includes(poNum)) {
                    combined[coNumber].push(poNum);
                  }
                }
              });
            }
          });

          // Sort PO numbers for each CO
          Object.keys(combined).forEach(co => {
            combined[co].sort((a, b) => a - b);
          });

          setCombinedCOPOMatrix(combined);

        } catch (err) {
          logger.error('Failed to load combined CO-PO matrix:', err);
          setCombinedCOPOMatrix(null);
        }
      }
    };
    loadCombinedCOPOMatrix();
  }, [selectedSheet, selectedCourse]);

  // Calculate CO totals from CT table (sum of all CO Total values)
  const calculateCOTotals = () => {
    const coTotals = {};
    ctRows.forEach((row, idx) => {
      const coKey = row.coNumber || `CO${idx + 1}`;
      const coTotal = computeCOTotal(row);
      coTotals[coKey] = (coTotals[coKey] || 0) + coTotal;
    });
    return coTotals;
  };

  // Calculate factored CO totals from generated table (View Generated Table)
  const calculateFactoredCOTotals = () => {
    const coTotals = {};
    ctRows.forEach((row, idx) => {
      const coKey = row.coNumber || `CO${idx + 1}`;
      const factoredTotal = getActiveCTFields().reduce((sum, field) => {
        const ctKey = field.replace(/(_Q[123])$/, '');
        const factor = calculateAutoFactor()[ctKey] || 0;
        const originalValue = row[field] || 0;
        return sum + (factor * originalValue);
      }, 0);
      coTotals[coKey] = factoredTotal;
    });
    return coTotals;
  };

  // Calculate assignment CO totals (original)
  const calculateAssignmentCOTotals = () => {
    const coTotals = {};
    assignmentRows.forEach((row, idx) => {
      const coKey = row.coNumber || `CO${idx + 1}`;
      const coTotal = computeAssignmentCOTotal(row);
      coTotals[coKey] = (coTotals[coKey] || 0) + coTotal;
    });
    return coTotals;
  };

  // Calculate assignment CO totals excluding attendance (for Generated Obtained Table)
  const calculateAssignmentCOTotalsNoAttendance = () => {
    const coTotals = {};
    assignmentRows.forEach((row, idx) => {
      const coKey = row.coNumber || `CO${idx + 1}`;
      // Only sum assignment marks that are allocated to this CO, exclude attendance
      const coTotal = getActiveAssignmentFields().reduce((sum, field) => {
        const allocatedMarks = row[field] || 0;
        if (allocatedMarks === 0) return sum; // Skip if no allocation for this field in this CO
        return sum + allocatedMarks;
      }, 0);
      coTotals[coKey] = coTotal;
    });
    return coTotals;
  };

  // Calculate factored assignment CO totals
  const calculateFactoredAssignmentCOTotals = () => {
    const coTotals = {};
    assignmentRows.forEach((row, idx) => {
      const coKey = row.coNumber || `CO${idx + 1}`;
      const factoredTotal = getActiveAssignmentFields().reduce((sum, field) => {
        const allocatedMarks = row[field] || 0;
        if (allocatedMarks === 0) return sum; // Skip if no allocation for this field in this CO
        const assignmentKey = field.replace(/(_Q[123])$/, '');
        const factor = calculateAutoAssignmentFactor()[assignmentKey] || 0;
        return sum + (factor * allocatedMarks);
      }, 0);
      coTotals[coKey] = factoredTotal;
    });
    return coTotals;
  };

  // Helper to get dynamic CT field names based on ctTaken
  const getActiveCTFields = () => {
    const ctTaken = ctSummary.ctTaken || 3;
    const allFields = ['CT1_Q1', 'CT1_Q2', 'CT1_Q3', 'CT2_Q1', 'CT2_Q2', 'CT2_Q3', 'CT3_Q1', 'CT3_Q2', 'CT3_Q3'];
    return allFields.slice(0, ctTaken * 3);
  };

  // Helper to get CT keys based on ctTaken
  const getActiveCTs = () => {
    const ctTaken = ctSummary.ctTaken || 3;
    return ['CT1', 'CT2', 'CT3'].slice(0, ctTaken);
  };

  // Helper to get Assignment keys based on assignTaken
  const getActiveAssignments = () => {
    const assignTaken = assignmentSummary.assignTaken || 3;
    return ['Assgn1', 'Assgn2', 'Assgn3'].slice(0, assignTaken);
  };

  // Helper to get dynamic Assignment field names based on assignTaken
  const getActiveAssignmentFields = () => {
    const assignTaken = assignmentSummary.assignTaken || 3;
    const allFields = ['Assgn1_Q1', 'Assgn1_Q2', 'Assgn1_Q3', 'Assgn2_Q1', 'Assgn2_Q2', 'Assgn2_Q3', 'Assgn3_Q1', 'Assgn3_Q2', 'Assgn3_Q3'];
    return allFields.slice(0, assignTaken * 3);
  };

  // Helper to get factored CT marks for a student and CO
  const getStudentCTFactoredMarks = (rollNumber, coNumber) => {
    const studentRow = ctObtainedRows.find(r =>
      String(r.rollNumber || '').trim().toLowerCase() === String(rollNumber || '').trim().toLowerCase()
    );
    if (!studentRow) return 0;

    // Find the CO row to check which fields are allocated to this CO
    const coIdx = ctRows.findIndex(row => {
      const rowCoNumber = (row.coNumber || '').toString().replace('CLO', 'CO');
      return rowCoNumber === coNumber;
    });

    if (coIdx === -1) return 0; // CO not found

    const coRow = ctRows[coIdx];

    return getActiveCTFields().reduce((sum, field) => {
      // Only include fields allocated to this CO
      const allocatedMarks = coRow[field] || 0;
      if (allocatedMarks === 0) return sum;

      const ctKey = field.replace(/(_Q[123])$/, '');
      const factor = calculateAutoFactor()[ctKey] || 0;
      const studentMark = studentRow[field] || 0;
      return sum + (factor * studentMark);
    }, 0);
  };

  // Helper to get factored Assignment marks for a student and CO
  const getStudentAssignmentFactoredMarks = (rollNumber, coNumber) => {
    const studentRow = attnAssignObtainedRows.find(r =>
      String(r.rollNumber || '').trim().toLowerCase() === String(rollNumber || '').trim().toLowerCase()
    );
    if (!studentRow) return 0;

    // Find the CO row in assignmentRows to check fields
    const coIdx = assignmentRows.findIndex(row => {
      const rowCoNumber = (row.coNumber || '').toString().replace('CLO', 'CO');
      return rowCoNumber === coNumber;
    });

    if (coIdx === -1) return 0;

    const coRow = assignmentRows[coIdx];

    return getActiveAssignmentFields().reduce((sum, field) => {
      // Only include fields allocated to this CO
      const allocatedMarks = coRow[field] || 0;
      if (allocatedMarks === 0) return sum;

      const assignmentKey = field.replace(/(_Q[123])$/, '');
      const factor = calculateAutoAssignmentFactor()[assignmentKey] || 0;
      const studentMark = studentRow[field] || 0;
      return sum + (factor * studentMark);
    }, 0);
  };

  // Autosave function disabled - using manual save only
  const triggerAutosave = useCallback(() => {
    // Autosave disabled for CT - users must click Save buttons
    return;
  }, []);

  // Manual save function (saves immediately without debounce)
  const handleManualSave = async () => {
    if (!selectedCourse || !selectedCourse._id) {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(''), 3000);
      return;
    }

    // Clear any pending autosave
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    setSaveStatus('saving');

    try {
      const dataToSave = {
        ctRows,
        ctFactors,
        ctManualWts,
        ctEqWts,
        ctSummary,
        ctObtainedRows
      };

      const response = await saveCTData(selectedCourse._id, dataToSave);

      setSaveStatus('saved');

      // Clear saved status after 2 seconds
      setTimeout(() => setSaveStatus(''), 2000);
    } catch (error) {
      console.error('[handleManualSave] Error:', error);
      logger.error('[Manual Save] Error:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(''), 3000);
    }
  };

  // Manual save function for Assignment/Attendance (saves immediately without debounce)
  const handleManualSaveAssignment = async () => {
    if (!selectedCourse || !selectedCourse._id) {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(''), 3000);
      return;
    }

    // Clear any pending autosave
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    setSaveStatus('saving');

    try {
      const dataToSave = {
        assignmentRows,
        assignmentManualWts,
        assignmentSummary,
        attendanceMarks,
        attnAssignObtainedRows
      };

      const response = await saveAssignmentData(selectedCourse._id, dataToSave);

      setSaveStatus('saved');

      // Clear saved status after 2 seconds
      setTimeout(() => setSaveStatus(''), 2000);
    } catch (error) {
      console.error('[handleManualSaveAssignment] Error:', error);
      logger.error('[Manual Save Assignment] Error:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(''), 3000);
    }
  };

  // Manual save function for Lab Activity (saves immediately without debounce)
  const handleManualSaveLabActivity = async () => {
    if (!selectedCourse || !selectedCourse._id) {
      console.warn('Lab Activity Save: Please select a course first');
      setLabActivitySaveStatus('error');
      setTimeout(() => setLabActivitySaveStatus(''), 3000);
      return;
    }

    // Clear any pending autosave
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    setLabActivitySaveStatus('saving');

    try {
      // Calculate the 'other' field for each student row before saving
      const totals = labActivityActivityTotals();
      let totalMeasuredTotal = (labAttendanceMarks || 0) + (labQuizMarks || 0) + (labVivaMarks || 0);
      for (let i = 1; i <= (activityTaken || 5); i++) {
        totalMeasuredTotal += totals[`activity${i}`] || 0;
      }

      const rowsWithCalculatedOther = labActivityObtainedRows.map(row => {
        if (totalMeasuredTotal === 0) {
          return { ...row, other: 0 };
        }
        const factor = (otherActivityRemaining || 0) / totalMeasuredTotal;
        const studentMeasuredTotal = row.otherMeasured || 0;
        const calculatedOther = studentMeasuredTotal * factor;
        // Round to 4 decimal places to avoid floating point precision issues
        const rounded = Math.round(calculatedOther * 10000) / 10000;
        return { ...row, other: rounded };
      });

      const dataToSave = {
        labActivityRows,
        labActivityFactors,
        labActivityEqWts,
        labActivityManualWts,
        labAttendanceMarks,
        labQuizMarks,
        labVivaMarks,
        activityTaken,
        otherActivityRemaining,
        otherActivityMeasured,
        coMappedActivityMarks,
        useEqWtActivity,
        labActivityObtainedRows: rowsWithCalculatedOther
      };

      const response = await saveLabActivityData(selectedCourse._id, dataToSave);

      console.log('Lab Activity data saved successfully!');
      setLabActivitySaveStatus('saved');

      // Clear saved status after 2 seconds
      setTimeout(() => setLabActivitySaveStatus(''), 2000);
    } catch (error) {
      console.error('[handleManualSaveLabActivity] Error:', error);
      console.error('[handleManualSaveLabActivity] Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      console.error(`Error saving data: ${error.response?.data?.message || error.message}`);
      logger.error('[Manual Save Lab Activity] Error:', error);
      setLabActivitySaveStatus('error');
      setTimeout(() => setLabActivitySaveStatus(''), 3000);
    }
  };

  // Manual save function for Section A allocated marks
  const handleManualSaveSectionA = async () => {
    if (!selectedCourse || !selectedCourse._id) {
      console.warn('Section A Save: Please select a course first');
      return;
    }

    try {
      setSectionASaveStatus('saving');

      const dataToSave = {
        sectionARows,
        sectionAObtainedRows,
        sectionBRows,
        sectionBObtainedRows
      };

      await saveSectionAData(selectedCourse._id, dataToSave);

      console.log('Section A & B data saved successfully!');
      setSectionASaveStatus('saved');

      // Clear saved status after 2 seconds
      setTimeout(() => setSectionASaveStatus(''), 2000);
    } catch (error) {
      console.error('[handleManualSaveSectionA] Error:', error);
      console.error('[handleManualSaveSectionA] Error details:', {
        message: error.message,
        error: error.error,
        response: error.response?.data,
        status: error.response?.status,
        fullError: JSON.stringify(error)
      });
      const errorMessage = error.message || error.error || (typeof error === 'string' ? error : 'Unknown error occurred');
      console.error(`Error saving Section A data: ${errorMessage}`);
      logger.error('[Manual Save Section A] Error:', error);
      setSectionASaveStatus('error');
      setTimeout(() => setSectionASaveStatus(''), 3000);
    }
  };

  // Manual save function for Section B allocated marks
  const handleManualSaveSectionB = async () => {
    if (!selectedCourse || !selectedCourse._id) {
      console.warn('Section B Save: Please select a course first');
      return;
    }

    try {
      setSectionBSaveStatus('saving');

      const dataToSave = {
        sectionARows,
        sectionAObtainedRows,
        sectionBRows,
        sectionBObtainedRows
      };

      await saveSectionAData(selectedCourse._id, dataToSave);

      console.log('Section A & B data saved successfully!');
      setSectionBSaveStatus('saved');

      // Clear saved status after 2 seconds
      setTimeout(() => setSectionBSaveStatus(''), 2000);
    } catch (error) {
      console.error('[handleManualSaveSectionB] Error:', error);
      console.error('[handleManualSaveSectionB] Error details:', {
        message: error.message,
        error: error.error,
        response: error.response?.data,
        status: error.response?.status,
        fullError: JSON.stringify(error)
      });
      const errorMessage = error.message || error.error || (typeof error === 'string' ? error : 'Unknown error occurred');
      console.error(`Error saving Section B data: ${errorMessage}`);
      logger.error('[Manual Save Section B] Error:', error);
      setSectionBSaveStatus('error');
      setTimeout(() => setSectionBSaveStatus(''), 3000);
    }
  };

  // Load saved CT data when course and CT sheet selected (also load for COCalc sheets)
  useEffect(() => {
    const loadCTData = async () => {
      // Only reset the flag when course actually changes (not on every render)
      const currentCourseId = selectedCourse?._id;
      if (currentCourseId !== previousCourseIdRef.current) {
        ctDataLoadedRef.current = false;
        previousCourseIdRef.current = currentCourseId;
      }

      if (selectedCourse && selectedCourse._id && (selectedSheet === 'CT' || selectedSheet === 'COCalc' || selectedSheet === 'COCalc_LabUnnorm')) {
        // Set the flag immediately to prevent initialization from running during load
        ctDataLoadedRef.current = true;
        try {
          const response = await getCTData(selectedCourse._id);
          if (response.success && response.data) {
            const { ctRows: savedRows, ctFactors: savedFactors, ctManualWts: savedManual,
              ctEqWts: savedEq, ctSummary: savedSummary, ctObtainedRows: savedObtained } = response.data;

            if (savedRows && savedRows.length > 0) {
              setCtRows(savedRows);
            }
            if (savedFactors) setCtFactors(savedFactors);
            if (savedManual) setCtManualWts(savedManual);
            if (savedEq) setCtEqWts(savedEq);
            if (savedSummary) setCtSummary(savedSummary);
            if (savedObtained && savedObtained.length > 0) {
              setCtObtainedRows(savedObtained);
            } else {
              // No saved obtained rows - allow initialization
              ctDataLoadedRef.current = false;
            }
          } else {
            // No data found - allow initialization and trigger it immediately
            ctDataLoadedRef.current = false;
            initObtainedRows('CT');
          }
        } catch (error) {
          console.error('[loadCTData] Error loading saved data:', error);
          // Error loading - allow initialization and trigger it immediately
          ctDataLoadedRef.current = false;
          initObtainedRows('CT');
        }
      }
    };
    loadCTData();
  }, [selectedCourse, selectedSheet, initObtainedRows]);

  // Load saved Assignment/Attendance data when course and Attn_Assign sheet selected (also load for COCalc sheets)
  useEffect(() => {
    const loadAssignmentData = async () => {
      // Only reset the flag when course actually changes (not on every render)
      const currentCourseId = selectedCourse?._id;
      if (currentCourseId !== previousCourseIdForAssignmentRef.current) {
        assignmentDataLoadedRef.current = false;
        previousCourseIdForAssignmentRef.current = currentCourseId;
      }

      if (selectedCourse && selectedCourse._id && (selectedSheet === 'Attn_Assign' || selectedSheet === 'COCalc' || selectedSheet === 'COCalc_LabUnnorm')) {
        // Set the flag immediately to prevent initialization from running during load
        assignmentDataLoadedRef.current = true;
        try {
          const response = await getAssignmentData(selectedCourse._id);
          if (response.success && response.data) {
            const { assignmentRows: savedRows, assignmentManualWts: savedManual,
              assignmentSummary: savedSummary, attendanceMarks: savedAttendance,
              attnAssignObtainedRows: savedObtained } = response.data;

            if (savedRows && savedRows.length > 0) {
              setAssignmentRows(savedRows);
            }
            if (savedManual) setAssignmentManualWts(savedManual);
            if (savedSummary) setAssignmentSummary(savedSummary);
            if (savedAttendance !== undefined) setAttendanceMarks(savedAttendance);
            if (savedObtained && savedObtained.length > 0) {
              setAttnAssignObtainedRows(savedObtained);
            } else {
              // No saved obtained rows - allow initialization
              assignmentDataLoadedRef.current = false;
            }
          } else {
            // No data found - allow initialization and trigger it immediately
            assignmentDataLoadedRef.current = false;
            initObtainedRows('Attn_Assign');
          }
        } catch (error) {
          console.error('[loadAssignmentData] Error loading saved data:', error);
          // Error loading - allow initialization and trigger it immediately
          assignmentDataLoadedRef.current = false;
          initObtainedRows('Attn_Assign');
        }
      }
    };
    loadAssignmentData();
  }, [selectedCourse, selectedSheet, initObtainedRows]);

  // Load saved Lab Activity data when course and LabActivity sheet selected (also load for COCalc sheets)
  useEffect(() => {
    const loadLabActivityData = async () => {
      // Only reset the flag when course actually changes (not on every render)
      const currentCourseId = selectedCourse?._id;
      if (currentCourseId !== previousCourseIdForLabActivityRef.current) {
        labActivityDataLoadedRef.current = false;
        previousCourseIdForLabActivityRef.current = currentCourseId;
      }

      if (selectedCourse && selectedCourse._id && (selectedSheet === 'LabActivity' || selectedSheet === 'COCalc' || selectedSheet === 'COCalc_LabUnnorm')) {
        // Set the flag immediately to prevent initialization from running during load
        labActivityDataLoadedRef.current = true;
        try {
          const response = await getLabActivityData(selectedCourse._id);
          if (response.success && response.data) {
            const {
              labActivityRows: savedRows,
              labActivityFactors: savedFactors,
              labActivityEqWts: savedEqWts,
              labActivityManualWts: savedManualWts,
              labAttendanceMarks: savedLabAttendance,
              labQuizMarks: savedLabQuiz,
              labVivaMarks: savedLabViva,
              activityTaken: savedActivityTaken,
              otherActivityRemaining: savedOtherRemaining,
              otherActivityMeasured: savedOtherMeasured,
              coMappedActivityMarks: savedCoMapped,
              useEqWtActivity: savedUseEqWt,
              labActivityObtainedRows: savedObtained
            } = response.data;

            if (savedRows && savedRows.length > 0) {
              setLabActivityRows(savedRows);
            }
            if (savedFactors) setLabActivityFactors(savedFactors);
            if (savedEqWts) setLabActivityEqWts(savedEqWts);
            if (savedManualWts) setLabActivityManualWts(savedManualWts);
            if (savedLabAttendance !== undefined) setLabAttendanceMarks(savedLabAttendance);
            if (savedLabQuiz !== undefined) setLabQuizMarks(savedLabQuiz);
            if (savedLabViva !== undefined) setLabVivaMarks(savedLabViva);
            if (savedActivityTaken !== undefined) setActivityTaken(savedActivityTaken);
            if (savedOtherRemaining !== undefined) setOtherActivityRemaining(savedOtherRemaining);
            if (savedOtherMeasured !== undefined) setOtherActivityMeasured(savedOtherMeasured);
            if (savedCoMapped !== undefined) setCoMappedActivityMarks(savedCoMapped);
            if (savedUseEqWt !== undefined) setUseEqWtActivity(savedUseEqWt);
            if (savedObtained && savedObtained.length > 0) {
              setLabActivityObtainedRows(savedObtained);
            } else {
            }
          } else {
            // No data found - allow initialization
            labActivityDataLoadedRef.current = false;
          }
        } catch (error) {
          console.error('[loadLabActivityData] Error loading saved data:', error);
          // Error loading - allow initialization
          labActivityDataLoadedRef.current = false;
        }
      }
    };
    loadLabActivityData();
  }, [selectedCourse, selectedSheet]);

  // Load saved Section A data when course is selected
  useEffect(() => {
    const loadSectionAData = async () => {
      // Only reset the flag when course actually changes (not on every render)
      const currentCourseId = selectedCourse?._id;
      if (currentCourseId !== previousCourseIdForSectionARef.current) {
        sectionADataLoadedRef.current = false;
        previousCourseIdForSectionARef.current = currentCourseId;
      }

      if (selectedCourse && selectedCourse._id) {
        try {
          const response = await getSectionAData(selectedCourse._id);

          if (response.success && response.data) {
            const {
              sectionARows: savedSectionARows,
              sectionAObtainedRows: savedSectionAObtainedRows,
              sectionBRows: savedSectionBRows,
              sectionBObtainedRows: savedSectionBObtainedRows
            } = response.data;

            // Check if we have allocated rows data (CO mappings)
            const hasAllocatedData = (savedSectionARows && savedSectionARows.length > 0) ||
              (savedSectionBRows && savedSectionBRows.length > 0);

            if (!hasAllocatedData) {

              // Initialize with COs if available
              if (clos.length > 0) {
                const initialRows = clos.map(clo => ({
                  coNumber: (clo.cloNumber || '').toString().replace('CLO', 'CO'),
                  Q1a: 0, Q1b: 0, Q1c: 0, Q1d: 0,
                  Q2a: 0, Q2b: 0, Q2c: 0, Q2d: 0,
                  Q3a: 0, Q3b: 0, Q3c: 0, Q3d: 0,
                  Q4a: 0, Q4b: 0, Q4c: 0, Q4d: 0,
                  q123: 0, q124: 0, q134: 0, q234: 0,
                  q12: 0, q13: 0, q14: 0, q23: 0, q24: 0, q34: 0,
                  q1: 0, q2: 0, q3: 0, q4: 0, none: 0
                }));
                setSectionARows(initialRows);
                setSectionBRows(initialRows);
              }

              // Get all enrolled students and merge with saved data
              let allStudents = [];
              try {
                const resp = await getCourseStudents(selectedCourse._id);
                if (resp.success && Array.isArray(resp.data) && resp.data.length > 0) {
                  allStudents = resp.data.map(s => ({
                    rollNumber: s.roll || s.rollNumber,
                    name: s.name
                  }));
                }
              } catch (error) {
                console.error('[loadSectionAData] Error fetching students:', error);
              }

              // Filter and sort students by roll number
              const uniqueByRoll = [];
              const seen = new Set();
              for (const stu of allStudents) {
                let rn = String(stu.rollNumber || '').trim();
                if (!rn || seen.has(rn)) continue;
                const rollPattern = /^[0-9]{4,}$/;
                if (!rollPattern.test(rn)) continue;
                seen.add(rn);
                uniqueByRoll.push({ rollNumber: rn, name: stu.name || '' });
              }

              uniqueByRoll.sort((a, b) => {
                const aNum = String(a.rollNumber).replace(/\D/g, '');
                const bNum = String(b.rollNumber).replace(/\D/g, '');
                return aNum.localeCompare(bNum, undefined, { numeric: true });
              });

              // Merge saved Section A data with all students
              // Deduplicate saved data - keep last occurrence of each roll number
              const dedupedSectionA = [];
              const seenRollsA = new Set();
              if (savedSectionAObtainedRows) {
                for (let i = savedSectionAObtainedRows.length - 1; i >= 0; i--) {
                  const row = savedSectionAObtainedRows[i];
                  const roll = String(row.rollNumber);
                  if (!seenRollsA.has(roll)) {
                    seenRollsA.add(roll);
                    dedupedSectionA.unshift(row);
                  }
                }
              }

              const mergedSectionA = uniqueByRoll.map(stu => {
                const savedRow = dedupedSectionA?.find(r => String(r.rollNumber) === String(stu.rollNumber));
                if (savedRow) {
                  return { ...savedRow };
                }
                return {
                  rollNumber: stu.rollNumber,
                  name: stu.name,
                  Q1a: 0, Q1b: 0, Q1c: 0, Q1d: 0,
                  Q2a: 0, Q2b: 0, Q2c: 0, Q2d: 0,
                  Q3a: 0, Q3b: 0, Q3c: 0, Q3d: 0,
                  Q4a: 0, Q4b: 0, Q4c: 0, Q4d: 0,
                };
              });

              // Merge saved Section B data with all students

              // Deduplicate saved data - keep last occurrence of each roll number
              const dedupedSectionB = [];
              const seenRolls = new Set();
              if (savedSectionBObtainedRows) {
                // Process in reverse to keep last occurrence
                for (let i = savedSectionBObtainedRows.length - 1; i >= 0; i--) {
                  const row = savedSectionBObtainedRows[i];
                  const roll = String(row.rollNumber);
                  if (!seenRolls.has(roll)) {
                    seenRolls.add(roll);
                    dedupedSectionB.unshift(row);
                  }
                }
              }

              const mergedSectionB = uniqueByRoll.map(stu => {
                const savedRow = dedupedSectionB?.find(r => String(r.rollNumber) === String(stu.rollNumber));
                if (savedRow) {
                  return { ...savedRow };
                }
                return {
                  rollNumber: stu.rollNumber,
                  name: stu.name,
                  Q1a: 0, Q1b: 0, Q1c: 0, Q1d: 0,
                  Q2a: 0, Q2b: 0, Q2c: 0, Q2d: 0,
                  Q3a: 0, Q3b: 0, Q3c: 0, Q3d: 0,
                  Q4a: 0, Q4b: 0, Q4c: 0, Q4d: 0,
                };
              });

              setSectionAObtainedRows(mergedSectionA);

              setSectionBObtainedRows(mergedSectionB);

              sectionADataLoadedRef.current = true;
              return; // Exit early
            }

            // We have saved allocated rows, load them
            // Also load the obtained rows from the backend (they are now fetched from TermExamMarks)
            sectionADataLoadedRef.current = true; // Mark as loaded to prevent re-initialization

            if (savedSectionARows && savedSectionARows.length > 0) {
              setSectionARows(savedSectionARows);
            }
            if (savedSectionBRows && savedSectionBRows.length > 0) {
              setSectionBRows(savedSectionBRows);
            }

            // Get all enrolled students and merge with saved obtained rows data
            let allStudents = [];
            try {
              const resp = await getCourseStudents(selectedCourse._id);
              if (resp.success && Array.isArray(resp.data) && resp.data.length > 0) {
                allStudents = resp.data.map(s => ({
                  rollNumber: s.roll || s.rollNumber,
                  name: s.name
                }));
              }
            } catch (error) {
              console.error('[loadSectionAData] Error fetching students:', error);
            }

            // Filter and sort students by roll number
            const uniqueByRoll = [];
            const seen = new Set();
            for (const stu of allStudents) {
              let rn = String(stu.rollNumber || '').trim();
              if (!rn || seen.has(rn)) continue;
              const rollPattern = /^[0-9]{4,}$/;
              if (!rollPattern.test(rn)) continue;
              seen.add(rn);
              uniqueByRoll.push({ rollNumber: rn, name: stu.name || '' });
            }

            uniqueByRoll.sort((a, b) => {
              const aNum = String(a.rollNumber).replace(/\D/g, '');
              const bNum = String(b.rollNumber).replace(/\D/g, '');
              return aNum.localeCompare(bNum, undefined, { numeric: true });
            });

            // Merge saved Section A data with all students
            // Deduplicate saved data - keep last occurrence of each roll number
            const dedupedSectionA = [];
            const seenRollsA = new Set();
            if (savedSectionAObtainedRows) {
              for (let i = savedSectionAObtainedRows.length - 1; i >= 0; i--) {
                const row = savedSectionAObtainedRows[i];
                const roll = String(row.rollNumber);
                if (!seenRollsA.has(roll)) {
                  seenRollsA.add(roll);
                  dedupedSectionA.unshift(row);
                }
              }
            }

            const mergedSectionA = uniqueByRoll.map(stu => {
              const savedRow = dedupedSectionA?.find(r => String(r.rollNumber) === String(stu.rollNumber));
              if (savedRow) {
                return { ...savedRow };
              }
              return {
                rollNumber: stu.rollNumber,
                name: stu.name,
                Q1a: 0, Q1b: 0, Q1c: 0, Q1d: 0,
                Q2a: 0, Q2b: 0, Q2c: 0, Q2d: 0,
                Q3a: 0, Q3b: 0, Q3c: 0, Q3d: 0,
                Q4a: 0, Q4b: 0, Q4c: 0, Q4d: 0,
              };
            });

            // Merge saved Section B data with all students

            // Deduplicate saved data - keep last occurrence of each roll number
            const dedupedSectionB = [];
            const seenRolls = new Set();
            if (savedSectionBObtainedRows) {
              // Process in reverse to keep last occurrence
              for (let i = savedSectionBObtainedRows.length - 1; i >= 0; i--) {
                const row = savedSectionBObtainedRows[i];
                const roll = String(row.rollNumber);
                if (!seenRolls.has(roll)) {
                  seenRolls.add(roll);
                  dedupedSectionB.unshift(row);
                }
              }
            }

            const mergedSectionB = uniqueByRoll.map(stu => {
              const savedRow = dedupedSectionB?.find(r => String(r.rollNumber) === String(stu.rollNumber));
              if (savedRow) {
                return { ...savedRow };
              }
              return {
                rollNumber: stu.rollNumber,
                name: stu.name,
                Q1a: 0, Q1b: 0, Q1c: 0, Q1d: 0,
                Q2a: 0, Q2b: 0, Q2c: 0, Q2d: 0,
                Q3a: 0, Q3b: 0, Q3c: 0, Q3d: 0,
                Q4a: 0, Q4b: 0, Q4c: 0, Q4d: 0,
              };
            });

            setSectionAObtainedRows(mergedSectionA);

            setSectionBObtainedRows(mergedSectionB);
          } else {
            // No data found - allow initialization
            sectionADataLoadedRef.current = false;

            // Initialize with COs if available
            if (clos.length > 0) {
              const initialRows = clos.map(clo => ({
                coNumber: (clo.cloNumber || '').toString().replace('CLO', 'CO'),
                Q1a: 0, Q1b: 0, Q1c: 0, Q1d: 0,
                Q2a: 0, Q2b: 0, Q2c: 0, Q2d: 0,
                Q3a: 0, Q3b: 0, Q3c: 0, Q3d: 0,
                Q4a: 0, Q4b: 0, Q4c: 0, Q4d: 0,
                q123: 0, q124: 0, q134: 0, q234: 0,
                q12: 0, q13: 0, q14: 0, q23: 0, q24: 0, q34: 0,
                q1: 0, q2: 0, q3: 0, q4: 0, none: 0
              }));
              setSectionARows(initialRows);
              setSectionBRows(initialRows);
            }
          }
        } catch (error) {
          console.error('[loadSectionAData] Error loading saved data:', error);
          // Error loading - allow initialization
          sectionADataLoadedRef.current = false;

          // Initialize with COs if available
          if (clos.length > 0) {
            const initialRows = clos.map(clo => ({
              coNumber: (clo.cloNumber || '').toString().replace('CLO', 'CO'),
              Q1a: 0, Q1b: 0, Q1c: 0, Q1d: 0,
              Q2a: 0, Q2b: 0, Q2c: 0, Q2d: 0,
              Q3a: 0, Q3b: 0, Q3c: 0, Q3d: 0,
              Q4a: 0, Q4b: 0, Q4c: 0, Q4d: 0,
              q123: 0, q124: 0, q134: 0, q234: 0,
              q12: 0, q13: 0, q14: 0, q23: 0, q24: 0, q34: 0,
              q1: 0, q2: 0, q3: 0, q4: 0, none: 0
            }));
            setSectionARows(initialRows);
            setSectionBRows(initialRows);
          }
        }
      }
    };
    loadSectionAData();
  }, [selectedCourse, clos]);

  const handleCTCellChange = (index, field, value) => {
    const num = Number(value);
    const updated = [...ctRows];
    updated[index] = { ...updated[index], [field]: isNaN(num) ? 0 : num };
    setCtRows(updated);
  };

  const computeCOTotal = (row) => {
    return (
      (row.CT1_Q1 || 0) + (row.CT1_Q2 || 0) + (row.CT1_Q3 || 0) +
      (row.CT2_Q1 || 0) + (row.CT2_Q2 || 0) + (row.CT2_Q3 || 0) +
      (row.CT3_Q1 || 0) + (row.CT3_Q2 || 0) + (row.CT3_Q3 || 0)
    );
  };

  // Assignment handlers
  const handleAssignmentCellChange = (index, field, value) => {
    const num = Number(value);
    const updated = [...assignmentRows];
    updated[index] = { ...updated[index], [field]: isNaN(num) ? 0 : num };
    setAssignmentRows(updated);
  };

  const computeAssignmentCOTotal = (row) => {
    return (
      (row.attendance || 0) +
      (row.Assgn1_Q1 || 0) + (row.Assgn1_Q2 || 0) + (row.Assgn1_Q3 || 0) +
      (row.Assgn2_Q1 || 0) + (row.Assgn2_Q2 || 0) + (row.Assgn2_Q3 || 0) +
      (row.Assgn3_Q1 || 0) + (row.Assgn3_Q2 || 0) + (row.Assgn3_Q3 || 0)
    );
  };

  const assignmentSums = () => {
    let assgn1 = 0, assgn2 = 0, assgn3 = 0;
    assignmentRows.forEach(r => {
      assgn1 += (r.Assgn1_Q1 || 0) + (r.Assgn1_Q2 || 0) + (r.Assgn1_Q3 || 0);
      assgn2 += (r.Assgn2_Q1 || 0) + (r.Assgn2_Q2 || 0) + (r.Assgn2_Q3 || 0);
      assgn3 += (r.Assgn3_Q1 || 0) + (r.Assgn3_Q2 || 0) + (r.Assgn3_Q3 || 0);
    });
    return { assgn1, assgn2, assgn3 };
  };

  // Calculate assignment totals grouped by assignment (Assgn1, Assgn2, Assgn3)
  const assignmentColumnGroupTotals = () => {
    const sums = assignmentSums();
    return {
      Assgn1: sums.assgn1,
      Assgn2: sums.assgn2,
      Assgn3: sums.assgn3
    };
  };

  // Calculate automatic Eq. Wt for each Assignment
  const calculateAssignmentAutoEqWt = () => {
    const sums = assignmentSums();
    const assignmentMarks = assignmentSummary.assignmentMarks30 || 0;
    const assignTaken = assignmentSummary.assignTaken || 1; // Avoid division by zero

    const result = {};

    // Assignment 1
    if (sums.assgn1 > 0) {
      result.Assgn1 = assignmentMarks / assignTaken;
    } else {
      result.Assgn1 = 0;
    }

    // Assignment 2  
    if (sums.assgn2 > 0) {
      result.Assgn2 = assignmentMarks / assignTaken;
    } else {
      result.Assgn2 = 0;
    }

    // Assignment 3
    if (sums.assgn3 > 0) {
      result.Assgn3 = assignmentMarks / assignTaken;
    } else {
      result.Assgn3 = 0;
    }

    return result;
  };

  // Calculate automatic Factor for each Assignment
  const calculateAutoAssignmentFactor = () => {
    const assignmentTotals = assignmentColumnGroupTotals();
    const autoEqWt = calculateAssignmentAutoEqWt();
    const useEqWt = assignmentSummary.useEqWt || 0;
    const result = {};

    // Assignment 1
    try {
      const totalMarks = assignmentTotals.Assgn1 || 0;
      if (totalMarks > 0) {
        if (useEqWt !== 0) {
          result.Assgn1 = autoEqWt.Assgn1 / totalMarks;
        } else {
          result.Assgn1 = (assignmentManualWts.Assgn1 || 0) / totalMarks;
        }
      } else {
        result.Assgn1 = 0;
      }
    } catch (error) {
      result.Assgn1 = 0;
    }

    // Assignment 2
    try {
      const totalMarks = assignmentTotals.Assgn2 || 0;
      if (totalMarks > 0) {
        if (useEqWt !== 0) {
          result.Assgn2 = autoEqWt.Assgn2 / totalMarks;
        } else {
          result.Assgn2 = (assignmentManualWts.Assgn2 || 0) / totalMarks;
        }
      } else {
        result.Assgn2 = 0;
      }
    } catch (error) {
      result.Assgn2 = 0;
    }

    // Assignment 3
    try {
      const totalMarks = assignmentTotals.Assgn3 || 0;
      if (totalMarks > 0) {
        if (useEqWt !== 0) {
          result.Assgn3 = autoEqWt.Assgn3 / totalMarks;
        } else {
          result.Assgn3 = (assignmentManualWts.Assgn3 || 0) / totalMarks;
        }
      } else {
        result.Assgn3 = 0;
      }
    } catch (error) {
      result.Assgn3 = 0;
    }

    return result;
  };

  const handleAssignmentManualWtChange = (assignmentKey, value) => {
    const num = Number(value);
    setAssignmentManualWts(prev => ({ ...prev, [assignmentKey]: isNaN(num) ? 0 : num }));
    triggerAutosave();
  };

  const sumAssignmentEqWtTotal = () => {
    const autoEqWt = calculateAssignmentAutoEqWt();
    return (autoEqWt.Assgn1 + autoEqWt.Assgn2 + autoEqWt.Assgn3);
  };

  const sumAssignmentManualWtTotal = () => {
    const { Assgn1 = 0, Assgn2 = 0, Assgn3 = 0 } = assignmentManualWts || {};
    return (Assgn1 + Assgn2 + Assgn3);
  };

  // SectionA handlers
  const handleSectionACellChange = (index, field, value) => {
    const num = Number(value);
    const updated = [...sectionARows];
    updated[index] = { ...updated[index], [field]: isNaN(num) ? 0 : num };
    setSectionARows(updated);
  };

  const computeSectionACOTotal = (row) => {
    return (
      (row.Q1a || 0) + (row.Q1b || 0) + (row.Q1c || 0) + (row.Q1d || 0) +
      (row.Q2a || 0) + (row.Q2b || 0) + (row.Q2c || 0) + (row.Q2d || 0) +
      (row.Q3a || 0) + (row.Q3b || 0) + (row.Q3c || 0) + (row.Q3d || 0) +
      (row.Q4a || 0) + (row.Q4b || 0) + (row.Q4c || 0) + (row.Q4d || 0)
    );
  };

  // SectionA Generated Table handler
  const handleSectionAGeneratedCellChange = (index, field, value) => {
    const num = Number(value);
    const updated = [...sectionARows];
    updated[index] = { ...updated[index], [field]: isNaN(num) ? 0 : num };
    setSectionARows(updated);
  };

  // Auto-calculate combination values from allocated marks
  const calculateQ1Total = (row) => (row.Q1a || 0) + (row.Q1b || 0) + (row.Q1c || 0) + (row.Q1d || 0);
  const calculateQ2Total = (row) => (row.Q2a || 0) + (row.Q2b || 0) + (row.Q2c || 0) + (row.Q2d || 0);
  const calculateQ3Total = (row) => (row.Q3a || 0) + (row.Q3b || 0) + (row.Q3c || 0) + (row.Q3d || 0);
  const calculateQ4Total = (row) => (row.Q4a || 0) + (row.Q4b || 0) + (row.Q4c || 0) + (row.Q4d || 0);

  const getAutoGeneratedCombination = (row, combination) => {
    switch (combination) {
      case 'q123': return calculateQ1Total(row) + calculateQ2Total(row) + calculateQ3Total(row);
      case 'q124': return calculateQ1Total(row) + calculateQ2Total(row) + calculateQ4Total(row);
      case 'q134': return calculateQ1Total(row) + calculateQ3Total(row) + calculateQ4Total(row);
      case 'q234': return calculateQ2Total(row) + calculateQ3Total(row) + calculateQ4Total(row);
      case 'q12': return calculateQ1Total(row) + calculateQ2Total(row);
      case 'q13': return calculateQ1Total(row) + calculateQ3Total(row);
      case 'q14': return calculateQ1Total(row) + calculateQ4Total(row);
      case 'q23': return calculateQ2Total(row) + calculateQ3Total(row);
      case 'q24': return calculateQ2Total(row) + calculateQ4Total(row);
      case 'q34': return calculateQ3Total(row) + calculateQ4Total(row);
      case 'q1': return calculateQ1Total(row);
      case 'q2': return calculateQ2Total(row);
      case 'q3': return calculateQ3Total(row);
      case 'q4': return calculateQ4Total(row);
      case 'none': return 0;
      default: return 0;
    }
  };

  // Section A Generated Table calculations
  const calculateSectionACOMsrd = (row) => {
    const sum3Combo = getAutoGeneratedCombination(row, 'q123') +
      getAutoGeneratedCombination(row, 'q124') +
      getAutoGeneratedCombination(row, 'q134') +
      getAutoGeneratedCombination(row, 'q234');
    return sum3Combo > 0 ? 1 : 0;
  };

  const calculateTotalCOMsrd = () => {
    return sectionARows.reduce((sum, row) => sum + calculateSectionACOMsrd(row), 0);
  };

  const calculateUnitV = (row) => {
    const totalMsrd = calculateTotalCOMsrd();
    if (totalMsrd === 0) return 0;
    return calculateSectionACOMsrd(row) / totalMsrd;
  };

  const calculateCombinationRatio = (row, combination) => {
    const rowValue = getAutoGeneratedCombination(row, combination);
    const totalForAllCOs = sectionARows.reduce((sum, r) => sum + getAutoGeneratedCombination(r, combination), 0);
    if (totalForAllCOs === 0) return 0;
    return rowValue / totalForAllCOs;
  };

  // Calculate population standard deviation for a 3-combination column
  const calculateStDevP = (combination) => {
    const values = sectionARows.map(row => calculateCombinationRatio(row, combination));
    const n = values.length;
    if (n === 0) return 0;
    const mean = values.reduce((sum, val) => sum + val, 0) / n;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
    return Math.sqrt(variance);
  };

  // Calculate Dist: SUM of (Unit V - combination ratio)² for each 3-combination
  const calculateDist = (combination) => {
    return sectionARows.reduce((sum, row) => {
      const unitV = calculateUnitV(row);
      const combinationValue = calculateCombinationRatio(row, combination);
      return sum + Math.pow(unitV - combinationValue, 2);
    }, 0);
  };

  // Helper: Get marks obtained for a specific question (Q1, Q2, Q3, Q4) for a student
  const getStudentQuestionTotal = (studentRow, questionNum) => {
    const parts = ['a', 'b', 'c', 'd'];
    return parts.reduce((sum, part) => {
      const field = `Q${questionNum}${part}`;
      return sum + (parseFloat(studentRow[field]) || 0);
    }, 0);
  };

  // Helper: Get total marks obtained per CO for a student
  const getStudentCOTotal = (studentRow, coNumber) => {
    const coRow = sectionARows.find(r => r.coNumber === coNumber);
    if (!coRow) return 0;

    // Sum across all questions for this CO
    const parts = ['a', 'b', 'c', 'd'];
    return [1, 2, 3, 4].reduce((total, qNum) => {
      return total + parts.reduce((qSum, part) => {
        const field = `Q${qNum}${part}`;
        const allocated = parseFloat(coRow[field]) || 0;
        const obtained = parseFloat(studentRow[field]) || 0;
        // Only count if this question part is allocated to this CO
        return qSum + (allocated > 0 ? obtained : 0);
      }, 0);
    }, 0);
  };

  // Helper: Count how many questions have zero marks for a student
  const getStudentZeroCount = (studentRow) => {
    let zeroCount = 0;
    for (let qNum = 1; qNum <= 4; qNum++) {
      if (getStudentQuestionTotal(studentRow, qNum) === 0) {
        zeroCount++;
      }
    }
    return zeroCount;
  };

  // Helper: Determine which combination the student answered
  const getStudentAnswerCombination = (studentRow) => {
    const answeredQuestions = [];
    for (let qNum = 1; qNum <= 4; qNum++) {
      if (getStudentQuestionTotal(studentRow, qNum) > 0) {
        answeredQuestions.push(qNum);
      }
    }
    return answeredQuestions.length > 0 ? answeredQuestions.join(',') : 'None';
  };

  // Helper: Convert answer combination string to combination key
  const answerCombinationToKey = (answerCombination) => {
    if (!answerCombination || answerCombination === 'None') return 'none';

    // Map answer combinations to their keys
    const combinationMap = {
      '1,2,3': 'q123',
      '1,2,4': 'q124',
      '1,3,4': 'q134',
      '2,3,4': 'q234',
      '1,2': 'q12',
      '1,3': 'q13',
      '1,4': 'q14',
      '2,3': 'q23',
      '2,4': 'q24',
      '3,4': 'q34',
      '1': 'q1',
      '2': 'q2',
      '3': 'q3',
      '4': 'q4'
    };

    return combinationMap[answerCombination] || 'none';
  };

  // Helper: Get CO marks distribution - HLOOKUP equivalent
  // Returns the allocated marks for the specific answer combination the student chose
  const getStudentCODistribution = (studentRow, coNumber) => {
    const coRow = sectionARows.find(r => r.coNumber === coNumber);
    if (!coRow) return 0;

    // Get the student's answer combination (e.g., "1,2,3")
    const answerCombination = getStudentAnswerCombination(studentRow);

    // Convert to combination key (e.g., "q123")
    const combinationKey = answerCombinationToKey(answerCombination);

    // Look up the value in the Possible Answer Combinations table
    // This is equivalent to HLOOKUP in Excel
    return getAutoGeneratedCombination(coRow, combinationKey);
  };

  // ========== Section B Calculation Functions ==========

  // Calculate totals for each question in Section B
  const calculateQ1TotalB = (row) => (row.Q1a || 0) + (row.Q1b || 0) + (row.Q1c || 0) + (row.Q1d || 0);
  const calculateQ2TotalB = (row) => (row.Q2a || 0) + (row.Q2b || 0) + (row.Q2c || 0) + (row.Q2d || 0);
  const calculateQ3TotalB = (row) => (row.Q3a || 0) + (row.Q3b || 0) + (row.Q3c || 0) + (row.Q3d || 0);
  const calculateQ4TotalB = (row) => (row.Q4a || 0) + (row.Q4b || 0) + (row.Q4c || 0) + (row.Q4d || 0);

  // Auto-generate combination values for Section B
  const getAutoGeneratedCombinationB = (row, combination) => {
    const q1 = calculateQ1TotalB(row);
    const q2 = calculateQ2TotalB(row);
    const q3 = calculateQ3TotalB(row);
    const q4 = calculateQ4TotalB(row);

    switch (combination) {
      case 'q123': return q1 + q2 + q3;
      case 'q124': return q1 + q2 + q4;
      case 'q134': return q1 + q3 + q4;
      case 'q234': return q2 + q3 + q4;
      case 'q12': return q1 + q2;
      case 'q13': return q1 + q3;
      case 'q14': return q1 + q4;
      case 'q23': return q2 + q3;
      case 'q24': return q2 + q4;
      case 'q34': return q3 + q4;
      case 'q1': return q1;
      case 'q2': return q2;
      case 'q3': return q3;
      case 'q4': return q4;
      case 'none': return 0;
      default: return 0;
    }
  };

  // Calculate CO measured for Section B (1 if any 3-combo > 0, else 0)
  const calculateSectionBCOMsrd = (row) => {
    const sum3combos = getAutoGeneratedCombinationB(row, 'q123') +
      getAutoGeneratedCombinationB(row, 'q124') +
      getAutoGeneratedCombinationB(row, 'q134') +
      getAutoGeneratedCombinationB(row, 'q234');
    return sum3combos > 0 ? 1 : 0;
  };

  // Calculate total CO measured across all COs for Section B
  const calculateTotalCOMsrdB = () => {
    return sectionBRows.reduce((sum, row) => sum + calculateSectionBCOMsrd(row), 0);
  };

  // Calculate Unit V for Section B
  const calculateUnitVB = (row) => {
    const totalCOMsrd = calculateTotalCOMsrdB();
    if (totalCOMsrd === 0) return 0;
    return calculateSectionBCOMsrd(row) / totalCOMsrd;
  };

  // Calculate combination ratio for Section B
  const calculateCombinationRatioB = (row, combination) => {
    const totalForAllCOs = sectionBRows.reduce((sum, r) => sum + getAutoGeneratedCombinationB(r, combination), 0);
    if (totalForAllCOs === 0) return 0;
    return getAutoGeneratedCombinationB(row, combination) / totalForAllCOs;
  };

  // Calculate standard deviation (population) for Section B
  const calculateStDevPB = (combination) => {
    const values = sectionBRows.map(row => calculateCombinationRatioB(row, combination));
    const n = values.length;
    if (n === 0) return 0;
    const mean = values.reduce((sum, val) => sum + val, 0) / n;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
    return Math.sqrt(variance);
  };

  // Calculate distance for Section B
  const calculateDistB = (combination) => {
    return sectionBRows.reduce((sum, row) => {
      const unitV = calculateUnitVB(row);
      const combinationValue = calculateCombinationRatioB(row, combination);
      return sum + Math.pow(unitV - combinationValue, 2);
    }, 0);
  };

  // Helper: Get marks obtained for a specific question (Q1, Q2, Q3, Q4) for a student in Section B
  const getStudentQuestionTotalB = (studentRow, questionNum) => {
    const parts = ['a', 'b', 'c', 'd'];
    return parts.reduce((sum, part) => {
      const field = `Q${questionNum}${part}`;
      return sum + (parseFloat(studentRow[field]) || 0);
    }, 0);
  };

  // Helper: Get total marks obtained per CO for a student in Section B
  const getStudentCOTotalB = (studentRow, coNumber) => {
    const coRow = sectionBRows.find(r => r.coNumber === coNumber);
    if (!coRow) return 0;

    const parts = ['a', 'b', 'c', 'd'];
    return [1, 2, 3, 4].reduce((total, qNum) => {
      return total + parts.reduce((qSum, part) => {
        const field = `Q${qNum}${part}`;
        const allocated = parseFloat(coRow[field]) || 0;
        const obtained = parseFloat(studentRow[field]) || 0;
        return qSum + (allocated > 0 ? obtained : 0);
      }, 0);
    }, 0);
  };

  // Helper: Count how many questions have zero marks for a student in Section B
  const getStudentZeroCountB = (studentRow) => {
    let zeroCount = 0;
    for (let qNum = 1; qNum <= 4; qNum++) {
      if (getStudentQuestionTotalB(studentRow, qNum) === 0) {
        zeroCount++;
      }
    }
    return zeroCount;
  };

  // Helper: Determine which combination the student answered in Section B
  const getStudentAnswerCombinationB = (studentRow) => {
    const answeredQuestions = [];
    for (let qNum = 1; qNum <= 4; qNum++) {
      if (getStudentQuestionTotalB(studentRow, qNum) > 0) {
        answeredQuestions.push(qNum + 4); // Map 1-4 to 5-8 for Section B display
      }
    }
    return answeredQuestions.length > 0 ? answeredQuestions.join(',') : 'None';
  };

  // Helper: Convert answer combination string to combination key (Section B)
  const answerCombinationToKeyB = (answerCombination) => {
    if (!answerCombination || answerCombination === 'None') return 'none';

    // Map answer combinations (5,6,7,8) to their keys (which use q1,q2,q3,q4 internally)
    const combinationMap = {
      '5,6,7': 'q123',
      '5,6,8': 'q124',
      '5,7,8': 'q134',
      '6,7,8': 'q234',
      '5,6': 'q12',
      '5,7': 'q13',
      '5,8': 'q14',
      '6,7': 'q23',
      '6,8': 'q24',
      '7,8': 'q34',
      '5': 'q1',
      '6': 'q2',
      '7': 'q3',
      '8': 'q4'
    };

    return combinationMap[answerCombination] || 'none';
  };

  // Helper: Get CO marks distribution for Section B - HLOOKUP equivalent
  // Returns the allocated marks for the specific answer combination the student chose
  const getStudentCODistributionB = (studentRow, coNumber) => {
    const coRow = sectionBRows.find(r => r.coNumber === coNumber);
    if (!coRow) return 0;

    // Get the student's answer combination (e.g., "1,2,3")
    const answerCombination = getStudentAnswerCombinationB(studentRow);

    // Convert to combination key (e.g., "q123")
    const combinationKey = answerCombinationToKeyB(answerCombination);

    // Look up the value in the Possible Answer Combinations table
    // This is equivalent to HLOOKUP in Excel
    return getAutoGeneratedCombinationB(coRow, combinationKey);
  };

  const sectionAColumnTotals = () => {
    const fields = ['Q1a', 'Q1b', 'Q1c', 'Q1d', 'Q2a', 'Q2b', 'Q2c', 'Q2d', 'Q3a', 'Q3b', 'Q3c', 'Q3d', 'Q4a', 'Q4b', 'Q4c', 'Q4d'];
    const totals = {};
    fields.forEach(f => totals[f] = 0);
    sectionARows.forEach(r => fields.forEach(f => totals[f] += (r[f] || 0)));
    return totals;
  };

  const sectionAQuestionTotals = () => {
    const totals = sectionAColumnTotals();
    const q1 = (totals.Q1a || 0) + (totals.Q1b || 0) + (totals.Q1c || 0) + (totals.Q1d || 0);
    const q2 = (totals.Q2a || 0) + (totals.Q2b || 0) + (totals.Q2c || 0) + (totals.Q2d || 0);
    const q3 = (totals.Q3a || 0) + (totals.Q3b || 0) + (totals.Q3c || 0) + (totals.Q3d || 0);
    const q4 = (totals.Q4a || 0) + (totals.Q4b || 0) + (totals.Q4c || 0) + (totals.Q4d || 0);
    return { q1, q2, q3, q4 };
  };

  // SectionA Obtained Marks handlers
  const handleSectionAObtainedCellChange = (index, field, value) => {
    const num = Number(value);
    const updated = [...sectionAObtainedRows];
    updated[index] = { ...updated[index], [field]: isNaN(num) ? 0 : num };
    setSectionAObtainedRows(updated);
  };

  const computeSectionAObtainedTotal = (row) => {
    return (
      (row.Q1a || 0) + (row.Q1b || 0) + (row.Q1c || 0) + (row.Q1d || 0) +
      (row.Q2a || 0) + (row.Q2b || 0) + (row.Q2c || 0) + (row.Q2d || 0) +
      (row.Q3a || 0) + (row.Q3b || 0) + (row.Q3c || 0) + (row.Q3d || 0) +
      (row.Q4a || 0) + (row.Q4b || 0) + (row.Q4c || 0) + (row.Q4d || 0)
    );
  };

  // SectionB handlers
  const handleSectionBCellChange = (index, field, value) => {
    const num = Number(value);
    const updated = [...sectionBRows];
    updated[index] = { ...updated[index], [field]: isNaN(num) ? 0 : num };
    setSectionBRows(updated);
  };

  const computeSectionBCOTotal = (row) => {
    return (
      (row.Q1a || 0) + (row.Q1b || 0) + (row.Q1c || 0) + (row.Q1d || 0) +
      (row.Q2a || 0) + (row.Q2b || 0) + (row.Q2c || 0) + (row.Q2d || 0) +
      (row.Q3a || 0) + (row.Q3b || 0) + (row.Q3c || 0) + (row.Q3d || 0) +
      (row.Q4a || 0) + (row.Q4b || 0) + (row.Q4c || 0) + (row.Q4d || 0)
    );
  };

  const sectionBColumnTotals = () => {
    const fields = ['Q1a', 'Q1b', 'Q1c', 'Q1d', 'Q2a', 'Q2b', 'Q2c', 'Q2d', 'Q3a', 'Q3b', 'Q3c', 'Q3d', 'Q4a', 'Q4b', 'Q4c', 'Q4d'];
    const totals = {};
    fields.forEach(f => totals[f] = 0);
    sectionBRows.forEach(r => fields.forEach(f => totals[f] += (r[f] || 0)));
    return totals;
  };

  const sectionBQuestionTotals = () => {
    const totals = sectionBColumnTotals();
    const q1 = (totals.Q1a || 0) + (totals.Q1b || 0) + (totals.Q1c || 0) + (totals.Q1d || 0);
    const q2 = (totals.Q2a || 0) + (totals.Q2b || 0) + (totals.Q2c || 0) + (totals.Q2d || 0);
    const q3 = (totals.Q3a || 0) + (totals.Q3b || 0) + (totals.Q3c || 0) + (totals.Q3d || 0);
    const q4 = (totals.Q4a || 0) + (totals.Q4b || 0) + (totals.Q4c || 0) + (totals.Q4d || 0);
    return { q1, q2, q3, q4 };
  };

  // SectionB Obtained Marks handlers
  const handleSectionBObtainedCellChange = (index, field, value) => {
    const num = Number(value);
    const updated = [...sectionBObtainedRows];
    updated[index] = { ...updated[index], [field]: isNaN(num) ? 0 : num };
    setSectionBObtainedRows(updated);
  };

  const computeSectionBObtainedTotal = (row) => {
    return (
      (row.Q1a || 0) + (row.Q1b || 0) + (row.Q1c || 0) + (row.Q1d || 0) +
      (row.Q2a || 0) + (row.Q2b || 0) + (row.Q2c || 0) + (row.Q2d || 0) +
      (row.Q3a || 0) + (row.Q3b || 0) + (row.Q3c || 0) + (row.Q3d || 0) +
      (row.Q4a || 0) + (row.Q4b || 0) + (row.Q4c || 0) + (row.Q4d || 0)
    );
  };

  // LabActivity handlers
  const handleLabActivityCellChange = (index, field, value) => {
    const num = Number(value);
    const updated = [...labActivityRows];
    updated[index] = { ...updated[index], [field]: isNaN(num) ? 0 : num };
    setLabActivityRows(updated);
  };

  const handleLabActivityFactorChange = (activity, value) => {
    const num = Number(value);
    setLabActivityFactors(prev => ({ ...prev, [activity]: isNaN(num) ? 0 : num }));
  };

  const handleLabActivityEqWtChange = (activity, value) => {
    const num = Number(value);
    setLabActivityEqWts(prev => ({ ...prev, [activity]: isNaN(num) ? 0 : num }));
  };

  const handleLabActivityManualWtChange = (activity, value) => {
    const num = Number(value);
    setLabActivityManualWts(prev => ({ ...prev, [activity]: isNaN(num) ? 0 : num }));
  };

  const computeLabActivityCOTotal = (row) => {
    let sum = (row.attn || 0) + (row.quiz || 0) + (row.viva || 0);
    for (let i = 1; i <= (activityTaken || 5); i++) {
      sum += (row[`Activity${i}_Q1`] || 0) + (row[`Activity${i}_Q2`] || 0) + (row[`Activity${i}_Q3`] || 0);
    }
    return sum;
  };

  // Helper function to calculate activity totals only (excluding attn, quiz, viva)
  const computeLabActivityMeasuredTotal = (row) => {
    let sum = 0;
    for (let i = 1; i <= (activityTaken || 5); i++) {
      sum += (row[`Activity${i}_Q1`] || 0) + (row[`Activity${i}_Q2`] || 0) + (row[`Activity${i}_Q3`] || 0);
    }
    return sum;
  };

  // Helper function to calculate factored value for LabActivity generated table
  const getLabActivityFactoredValue = (row, field, activityKey) => {
    try {
      const cellValue = parseFloat(row[field]) || 0;
      if (cellValue === 0) return 0;

      // Calculate factor dynamically
      const totals = labActivityActivityTotals();
      const activityTotal = totals[activityKey] || 0;
      let calculatedFactor = 0;

      if (activityTotal > 0) {
        if (useEqWtActivity) {
          // Use Eq. Wt: calculate Eq. Wt value / Activity Total
          const eqWtValue = (coMappedActivityMarks || 0) / (activityTaken || 1);
          calculatedFactor = eqWtValue / activityTotal;
        } else {
          // Use Manual Wt: calculate Manual Wt value / Activity Total
          const manualWtValue = labActivityManualWts[activityKey] || 0;
          calculatedFactor = manualWtValue / activityTotal;
        }
      }

      return cellValue * calculatedFactor;
    } catch (error) {
      return 0;
    }
  };

  // Helper function to calculate multiplication factor (generated/allocated) for LabActivity
  const getLabActivityMultiplicationFactor = (row, field, activityKey) => {
    try {
      const generatedValue = getLabActivityFactoredValue(row, field, activityKey);
      const allocatedValue = parseFloat(row[field]) || 0;
      if (allocatedValue === 0) return 0;
      return generatedValue / allocatedValue;
    } catch (error) {
      return 0;
    }
  };

  // Helper function to calculate CO total for generated table (multiplication factor view)
  const getLabActivityMultiplicationCOTotal = (row) => {
    try {
      let sum = 0;
      for (let i = 1; i <= (activityTaken || 5); i++) {
        const activityKey = `activity${i}`;
        sum += getLabActivityMultiplicationFactor(row, `Activity${i}_Q1`, activityKey);
        sum += getLabActivityMultiplicationFactor(row, `Activity${i}_Q2`, activityKey);
        sum += getLabActivityMultiplicationFactor(row, `Activity${i}_Q3`, activityKey);
      }
      return sum;
    } catch (error) {
      return 0;
    }
  };

  // Helper function to get CO-wise obtained marks for a student (out of CO Total from allocated table)
  const getLabActivityStudentCOMarks = (studentRow, coNumber) => {
    try {
      // Find the CO row in labActivityRows to see which activities have this CO allocated
      const coRow = labActivityRows.find(r => r.coNumber === coNumber);
      if (!coRow) return 0;

      let studentTotal = 0;

      // Add marks from attendance, quiz, and viva if CO has them allocated
      if ((coRow.attn || 0) > 0) {
        studentTotal += (parseFloat(studentRow.attn) || 0);
      }
      if ((coRow.quiz || 0) > 0) {
        studentTotal += (parseFloat(studentRow.quiz) || 0);
      }
      if ((coRow.viva || 0) > 0) {
        studentTotal += (parseFloat(studentRow.viva) || 0);
      }

      // Calculate for each activity - only include if this CO has marks allocated
      for (let i = 1; i <= (activityTaken || 5); i++) {
        const q1Field = `Activity${i}_Q1`;
        const q2Field = `Activity${i}_Q2`;
        const q3Field = `Activity${i}_Q3`;

        // Only add student marks for questions where CO has allocated marks
        if ((coRow[q1Field] || 0) > 0) {
          studentTotal += (parseFloat(studentRow[q1Field]) || 0);
        }
        if ((coRow[q2Field] || 0) > 0) {
          studentTotal += (parseFloat(studentRow[q2Field]) || 0);
        }
        if ((coRow[q3Field] || 0) > 0) {
          studentTotal += (parseFloat(studentRow[q3Field]) || 0);
        }
      }

      return studentTotal;
    } catch (error) {
      return 0;
    }
  };

  // Helper function to get CO-wise obtained marks (out of CO Mapped Activity Marks)
  const getLabActivityStudentCOMappedMarks = (studentRow, coNumber) => {
    try {
      const coRow = labActivityRows.find(r => r.coNumber === coNumber);
      if (!coRow) return 0;

      let total = 0;
      const totals = labActivityActivityTotals();

      // Only process activities (not attn/quiz/viva) for CO Mapped Activity Marks
      for (let i = 1; i <= (activityTaken || 5); i++) {
        const activityKey = `activity${i}`;
        const q1Field = `Activity${i}_Q1`;
        const q2Field = `Activity${i}_Q2`;
        const q3Field = `Activity${i}_Q3`;

        // Calculate factor dynamically for this activity
        const activityTotal = totals[activityKey] || 0;
        let calculatedFactor = 0;

        if (activityTotal > 0) {
          if (useEqWtActivity) {
            // Use Eq. Wt: calculate Eq. Wt value / Activity Total
            const eqWtValue = (coMappedActivityMarks || 0) / (activityTaken || 1);
            calculatedFactor = eqWtValue / activityTotal;
          } else {
            // Use Manual Wt: calculate Manual Wt value / Activity Total
            const manualWtValue = labActivityManualWts[activityKey] || 0;
            calculatedFactor = manualWtValue / activityTotal;
          }
        }

        // Only add student marks if CO has allocated marks for this question
        if ((coRow[q1Field] || 0) > 0) {
          const studentQ1 = parseFloat(studentRow[q1Field]) || 0;
          total += studentQ1 * calculatedFactor;
        }
        if ((coRow[q2Field] || 0) > 0) {
          const studentQ2 = parseFloat(studentRow[q2Field]) || 0;
          total += studentQ2 * calculatedFactor;
        }
        if ((coRow[q3Field] || 0) > 0) {
          const studentQ3 = parseFloat(studentRow[q3Field]) || 0;
          total += studentQ3 * calculatedFactor;
        }
      }

      return total;
    } catch (error) {
      return 0;
    }
  };

  // Helper function to calculate CO attainment (obtained/allocated)
  const getLabActivityCOAttainment = (studentRow, coNumber) => {
    try {
      // If row is empty (no roll number), return null to keep cell blank
      if (!studentRow.rollNumber) {
        return null;
      }

      const obtainedMarks = getLabActivityStudentCOMappedMarks(studentRow, coNumber);
      const coRow = labActivityRows.find(r => r.coNumber === coNumber);
      if (!coRow) return 0;

      const allocatedMarks = getLabActivityGeneratedCOTotal(coRow);

      // If division fails (allocated marks is 0), return 0
      if (allocatedMarks === 0) return 0;

      // Calculate the ratio
      return obtainedMarks / allocatedMarks;
    } catch (error) {
      return 0;
    }
  };

  // Helper function to calculate total marks for a student (sum of all CO attainments)
  const getLabActivityStudentTotalMarks = (studentRow) => {
    try {
      // Sum of Attn, Quiz, C. Viva, Other, and CO wise mapped marks
      let total = 0;

      // Add Attn, Quiz, Viva, and Other
      total += parseFloat(studentRow.attn || 0);
      total += parseFloat(studentRow.quiz || 0);
      total += parseFloat(studentRow.viva || 0);
      total += parseFloat(studentRow.other || 0);

      // Add all CO mapped marks (2nd CO wise obtained marks column)
      labActivityRows.forEach(coRow => {
        total += getLabActivityStudentCOMappedMarks(studentRow, coRow.coNumber);
      });

      return total;
    } catch (error) {
      return 0;
    }
  };

  // Helper function to get letter grade based on marks
  const getLetterGrade = (marks) => {
    if (marks >= 80) return 'A+';
    if (marks >= 75) return 'A';
    if (marks >= 70) return 'A-';
    if (marks >= 65) return 'B+';
    if (marks >= 60) return 'B';
    if (marks >= 55) return 'B-';
    if (marks >= 50) return 'C+';
    if (marks >= 45) return 'C';
    if (marks >= 40) return 'D';
    return 'F';
  };

  // Helper function to get grade color
  const getGradeColor = (grade) => {
    switch (grade) {
      case 'A+':
      case 'A':
      case 'A-':
        return '#27ae60'; // Green
      case 'B+':
      case 'B':
      case 'B-':
        return '#3498db'; // Blue
      case 'C+':
      case 'C':
        return '#138d75'; // Orange
      case 'D':
        return '#e67e22'; // Dark Orange
      case 'F':
        return '#e74c3c'; // Red
      default:
        return '#2c3e50'; // Default dark
    }
  };

  // Helper function to calculate CO total for generated table
  const getLabActivityGeneratedCOTotal = (row) => {
    try {
      let total = 0;
      // Only process configured number of activities
      for (let i = 1; i <= (activityTaken || 5); i++) {
        const activityKey = `activity${i}`;
        total += getLabActivityFactoredValue(row, `Activity${i}_Q1`, activityKey);
        total += getLabActivityFactoredValue(row, `Activity${i}_Q2`, activityKey);
        total += getLabActivityFactoredValue(row, `Activity${i}_Q3`, activityKey);
      }
      return total;
    } catch (error) {
      return 0;
    }
  };

  const labActivityColumnTotals = () => {
    const fields = [];
    for (let i = 1; i <= (activityTaken || 5); i++) {
      fields.push(`Activity${i}_Q1`, `Activity${i}_Q2`, `Activity${i}_Q3`);
    }
    const totals = {};
    fields.forEach(f => totals[f] = 0);
    labActivityRows.forEach(r => fields.forEach(f => totals[f] += (r[f] || 0)));
    return totals;
  };

  const labActivityActivityTotals = () => {
    const totals = labActivityColumnTotals();
    const result = {};
    for (let i = 1; i <= (activityTaken || 5); i++) {
      const activityKey = `activity${i}`;
      const q1 = totals[`Activity${i}_Q1`] || 0;
      const q2 = totals[`Activity${i}_Q2`] || 0;
      const q3 = totals[`Activity${i}_Q3`] || 0;
      result[activityKey] = q1 + q2 + q3;
    }
    return result;
  };

  const columnTotals = () => {
    const fields = ['CT1_Q1', 'CT1_Q2', 'CT1_Q3', 'CT2_Q1', 'CT2_Q2', 'CT2_Q3', 'CT3_Q1', 'CT3_Q2', 'CT3_Q3'];
    const totals = {};
    fields.forEach(f => totals[f] = 0);
    ctRows.forEach(r => fields.forEach(f => totals[f] += (r[f] || 0)));
    return totals;
  };

  // Calculate CT totals grouped by CT (CT1, CT2, CT3)
  const ctColumnTotals = () => {
    const sums = ctSums();
    return {
      CT1: sums.ct1,
      CT2: sums.ct2,
      CT3: sums.ct3
    };
  };

  const ctSums = () => {
    let ct1 = 0, ct2 = 0, ct3 = 0;
    ctRows.forEach(r => {
      ct1 += (r.CT1_Q1 || 0) + (r.CT1_Q2 || 0) + (r.CT1_Q3 || 0);
      ct2 += (r.CT2_Q1 || 0) + (r.CT2_Q2 || 0) + (r.CT2_Q3 || 0);
      ct3 += (r.CT3_Q1 || 0) + (r.CT3_Q2 || 0) + (r.CT3_Q3 || 0);
    });
    return { ct1, ct2, ct3 };
  };

  const handleManualWtChange = (ctKey, value) => {
    const num = Number(value);
    setCtManualWts(prev => ({ ...prev, [ctKey]: isNaN(num) ? 0 : num }));
    triggerAutosave();
  };

  // Calculate automatic Eq. Wt for each CT column
  const calculateAutoEqWt = () => {
    const sums = ctSums();
    const coMappedMarks = ctSummary.coMappedMarks60 || 0;
    const ctTaken = ctSummary.ctTaken || 1; // Avoid division by zero

    const result = {};

    // CT1
    if (sums.ct1 > 0) {
      result.CT1 = coMappedMarks / ctTaken;
    } else {
      result.CT1 = 0;
    }

    // CT2  
    if (sums.ct2 > 0) {
      result.CT2 = coMappedMarks / ctTaken;
    } else {
      result.CT2 = 0;
    }

    // CT3
    if (sums.ct3 > 0) {
      result.CT3 = coMappedMarks / ctTaken;
    } else {
      result.CT3 = 0;
    }

    return result;
  };

  // Calculate automatic Factor for each CT column
  const calculateAutoFactor = () => {
    const ctTotals = ctColumnTotals();
    const autoEqWt = calculateAutoEqWt();
    const useEqWt = ctSummary.useEqWt || 0;
    const result = {};

    // CT1
    try {
      const totalMarks = ctTotals.CT1 || 0;
      if (totalMarks > 0) {
        if (useEqWt !== 0) {
          result.CT1 = autoEqWt.CT1 / totalMarks;
        } else {
          result.CT1 = (ctManualWts.CT1 || 0) / totalMarks;
        }
      } else {
        result.CT1 = 0;
      }
    } catch (error) {
      result.CT1 = 0;
    }

    // CT2
    try {
      const totalMarks = ctTotals.CT2 || 0;
      if (totalMarks > 0) {
        if (useEqWt !== 0) {
          result.CT2 = autoEqWt.CT2 / totalMarks;
        } else {
          result.CT2 = (ctManualWts.CT2 || 0) / totalMarks;
        }
      } else {
        result.CT2 = 0;
      }
    } catch (error) {
      result.CT2 = 0;
    }

    // CT3
    try {
      const totalMarks = ctTotals.CT3 || 0;
      if (totalMarks > 0) {
        if (useEqWt !== 0) {
          result.CT3 = autoEqWt.CT3 / totalMarks;
        } else {
          result.CT3 = (ctManualWts.CT3 || 0) / totalMarks;
        }
      } else {
        result.CT3 = 0;
      }
    } catch (error) {
      result.CT3 = 0;
    }

    return result;
  };

  const sumEqWtTotal = () => {
    const autoEqWt = calculateAutoEqWt();
    return (autoEqWt.CT1 + autoEqWt.CT2 + autoEqWt.CT3);
  };

  const sumManualWtTotal = () => {
    const { CT1 = 0, CT2 = 0, CT3 = 0 } = ctManualWts || {};
    return (CT1 + CT2 + CT3);
  };

  // CT group totals for header: calculate from column totals
  const ctGroupTotals = () => {
    const totals = columnTotals();
    const ct1 = (totals.CT1_Q1 || 0) + (totals.CT1_Q2 || 0) + (totals.CT1_Q3 || 0);
    const ct2 = (totals.CT2_Q1 || 0) + (totals.CT2_Q2 || 0) + (totals.CT2_Q3 || 0);
    const ct3 = (totals.CT3_Q1 || 0) + (totals.CT3_Q2 || 0) + (totals.CT3_Q3 || 0);
    const combined = ct1 + ct2 + ct3;
    return { ct1, ct2, ct3, combined };
  };

  const handleObtainedCellChange = (index, field, value) => {
    const num = Number(value);
    const updated = [...ctObtainedRows];
    updated[index] = { ...updated[index], [field]: isNaN(num) ? 0 : num };
    setCtObtainedRows(updated);
  };

  const computeObtainedTotal = (row) => {
    return (
      (row.CT1_Q1 || 0) + (row.CT1_Q2 || 0) + (row.CT1_Q3 || 0) +
      (row.CT2_Q1 || 0) + (row.CT2_Q2 || 0) + (row.CT2_Q3 || 0) +
      (row.CT3_Q1 || 0) + (row.CT3_Q2 || 0) + (row.CT3_Q3 || 0)
    );
  };

  // Filter sheets when course is selected
  useEffect(() => {
    if (selectedCourse && sheetNames.length > 0) {
      // Get course info for detection
      const courseCode = (selectedCourse.courseCode || '').toLowerCase();
      const courseTitle = (selectedCourse.courseTitle || '').toLowerCase();
      const courseInfo = `${courseCode} ${courseTitle}`;

      // Determine course type from course code and title
      const isLabCourse = /\d*[02468]$/.test(courseCode) || // Course codes ending with even digits
        courseInfo.includes('lab');

      const isSessionalCourse = courseInfo.includes('sessional') ||
        courseInfo.includes('viva') ||
        courseInfo.includes('presentation');

      const isProjectCourse = courseInfo.includes('project') ||
        courseInfo.includes('thesis') ||
        courseInfo.includes('research') ||
        courseInfo.includes('dissertation');

      // Define sheets for each course type
      const theorySheets = [
        'CourseProfile', 'CT', 'Attn_Assign', 'SectionA', 'SectionB', 'COAttainment', 'COCalc', 'COCalc_LabUnnorm', 'COPOMap', 'POCalcMax', 'Charts', 'POCalc', 'CheckPO'
      ];

      const labSheets = [
        'CourseProfile', 'LabActivity', 'COAttainment', 'COCalc_LabUnnorm',
        'COCalc', 'COPOMap', 'POCalcMax', 'Charts', 'POCalc', 'CheckPO'
      ];

      const sessionalSheets = [
        'CourseProfile', 'LabActivity', 'COAttainment', 'COCalc', 'COPOMap', 'POCalcMax', 'Charts', 'POCalc', 'CheckPO'
      ];

      const projectSheets = [
        'CourseProfile', 'LabActivity', 'COAttainment', 'COCalc', 'COPOMap', 'POCalcMax', 'Charts', 'POCalc', 'CheckPO'
      ];

      // Select appropriate sheet list - order matters for priority
      let allowedSheets;
      if (isLabCourse) {
        allowedSheets = labSheets;
      } else if (isSessionalCourse) {
        allowedSheets = sessionalSheets;
      } else if (isProjectCourse) {
        allowedSheets = projectSheets;
      } else {
        // Default to theory courses
        allowedSheets = theorySheets;
      }

      // Filter sheets to only show allowed ones
      let filtered = sheetNames.filter(sheet => allowedSheets.includes(sheet));

      // Always include default sheets even if not in Excel file
      let defaultSheets;
      if (isLabCourse) {
        defaultSheets = ['CourseProfile', 'LabActivity'];
      } else if (isSessionalCourse || isProjectCourse) {
        defaultSheets = ['CourseProfile', 'LabActivity'];
      } else {
        // Theory courses - no LabActivity
        defaultSheets = ['CourseProfile'];
      }

      defaultSheets.forEach(sheet => {
        if (!filtered.includes(sheet)) {
          filtered.unshift(sheet);
        }
      });

      // For theory courses with specific section assignment, filter section sheets
      if (!isLabCourse && !isSessionalCourse && !isProjectCourse && selectedCourse.section) {
        const teacherSection = `Section${selectedCourse.section}`;
        filtered = filtered.filter(sheet => {
          // Keep all non-section sheets, and only the teacher's section sheet
          if (sheet.startsWith('Section')) {
            return sheet === teacherSection;
          }
          return true;
        });
      }

      setFilteredSheets(filtered);
      setSelectedSheet(null); // Reset sheet selection when course changes
    } else {
      setFilteredSheets([]);
    }
  }, [selectedCourse, sheetNames]);

  // Load attainment data when sheet selected (skip CourseProfile)
  useEffect(() => {
    if (selectedSheet && selectedSheet !== 'CourseProfile') {
      loadAttainmentData(selectedSheet);
    }
  }, [selectedSheet]);

  const loadSheetNames = async () => {
    try {
      setLoading(true);
      const response = await getSheetNames();
      setSheetNames(response.sheets || []);

      // Get current user's ID to find their section assignment
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const userId = user._id || user.id;

      // Extract the section for the logged-in teacher from assignedTeachers array
      const courseList = response.courses || [];
      const coursesWithSection = courseList.map(course => {
        if (course.assignedTeachers && Array.isArray(course.assignedTeachers)) {
          const teacherAssignment = course.assignedTeachers.find(
            assignedTeacher => assignedTeacher.teacher &&
              (assignedTeacher.teacher._id === userId || assignedTeacher.teacher === userId)
          );
          if (teacherAssignment && teacherAssignment.section) {
            return { ...course, section: teacherAssignment.section };
          }
        }
        return course;
      });

      setTeacherCourses(coursesWithSection);

      // Auto-select first sheet
      if (response.sheets && response.sheets.length > 0) {
        setSelectedSheet(response.sheets[0]);
      } else if (coursesWithSection && coursesWithSection.length > 0) {
        setError('No attainment sheets found for your assigned courses');
      }
    } catch (err) {
      setError(err.error || 'Failed to load sheet names');
    } finally {
      setLoading(false);
    }
  };

  const loadAttainmentData = async (sheetName) => {
    try {
      setLoading(true);
      setError(null);
      const response = await getAttainmentData(sheetName);
      setAttainmentData(response.data);
    } catch (err) {
      setError(err.error || 'Failed to load attainment data');
    } finally {
      setLoading(false);
    }
  };

  const handleCLOCellEdit = (cloNumber, field, currentValue) => {
    // Only allow editing CLO-PLO correlation field
    if (field !== 'cloPloCorrelation') return;
    if (userRole !== 'teacher' && userRole !== 'admin') return;
    setEditingCLOCell({ cloNumber, field, value: currentValue });
  };

  const handleCLOCellSave = async () => {
    if (!editingCLOCell) return;
    try {
      setSaving(true);
      // TODO: Save CLO-PLO correlation to database
      // For now, just update local state
      const updatedClos = clos.map(clo =>
        clo.cloNumber === editingCLOCell.cloNumber
          ? { ...clo, cloPloCorrelation: editingCLOCell.value }
          : clo
      );
      setClos(updatedClos);
      setEditingCLOCell(null);
    } catch (err) {
      console.error(err.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleCLOCellCancel = () => {
    setEditingCLOCell(null);
  };

  const renderCLOCell = (clo, field, value) => {
    const isEditing = editingCLOCell?.cloNumber === clo.cloNumber && editingCLOCell?.field === field;
    const isEditable = field === 'cloPloCorrelation' && canEdit; // Only correlation is editable

    if (isEditing) {
      return (
        <input
          type="text"
          value={editingCLOCell.value || ''}
          onChange={(e) => setEditingCLOCell({ ...editingCLOCell, value: e.target.value })}
          onBlur={handleCLOCellSave}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleCLOCellSave();
            if (e.key === 'Escape') handleCLOCellCancel();
          }}
          autoFocus
          disabled={saving}
          className="edit-input"
        />
      );
    }

    return (
      <div
        className={`cell-content ${isEditable ? 'editable' : ''}`}
        onClick={() => isEditable && handleCLOCellEdit(clo.cloNumber, field, value)}
        title={isEditable ? 'Click to edit' : ''}
      >
        {value || '-'}
      </div>
    );
  };

  const canEdit = userRole === 'teacher' || userRole === 'admin';

  // Refresh teacher courses (force reload from backend)
  const refreshTeacherCourses = useCallback(async () => {
    try {
      const data = await getAllCourses();
      const courseList = Array.isArray(data) ? data : (data.courses || []);

      // Get current user's ID to find their section assignment
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const userId = user._id || user.id;

      // Extract the section for the logged-in teacher from assignedTeachers array
      const coursesWithSection = courseList.map(course => {
        if (course.assignedTeachers && Array.isArray(course.assignedTeachers)) {
          const teacherAssignment = course.assignedTeachers.find(
            assignedTeacher => assignedTeacher.teacher &&
              (assignedTeacher.teacher._id === userId || assignedTeacher.teacher === userId)
          );
          if (teacherAssignment && teacherAssignment.section) {
            return { ...course, section: teacherAssignment.section };
          }
        }
        return course;
      });

      // Only update if we get a valid course list
      if (coursesWithSection && coursesWithSection.length > 0) {
        setTeacherCourses(coursesWithSection);
        // If a course is already selected, update it with the latest info
        if (selectedCourse) {
          const updated = coursesWithSection.find(c => c._id === selectedCourse._id);
          if (updated) {
            setSelectedCourse(updated);
          }
        }
      } else {
      }
    } catch (err) {
      logger.error('🚨 refreshTeacherCourses error:', err);
      // Don't clear existing courses on error, just log it
    }
  }, [selectedCourse]);

  // Load courses for teachers on mount
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.role === 'teacher') {
      refreshTeacherCourses();
    }
  }, [refreshTeacherCourses]);

  // Auto-refresh courses when AttainmentView mounts and when sheet changes to Attn_Assign
  useEffect(() => {
    if (selectedSheet === 'Attn_Assign') {
      refreshTeacherCourses();
    }
  }, [selectedSheet, refreshTeacherCourses]);

  if (loading && !attainmentData) {
    return <div className="attainment-loading">Loading...</div>;
  }

  return (
    <div className="attainment-container">
      <h1>Course Outcome Attainment</h1>

      {error && (
        <div className="attainment-error" style={{ marginBottom: '20px' }}>
          Error: {error}
        </div>
      )}

      {/* Course Selector - First Step - Always shown for teachers */}
      {userRole === 'teacher' && (
        <div className="course-selector" style={{ marginBottom: '20px' }}>
          <label htmlFor="course-select" style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
            Select Course:
          </label>
          <select
            id="course-select"
            value={selectedCourse ? `${selectedCourse.courseCode}-${selectedCourse.section || 'null'}` : ''}
            onChange={(e) => {
              const [code, section] = e.target.value.split('-');
              const course = teacherCourses.find(c =>
                c.courseCode === code && (c.section || 'null') === section
              );
              setSelectedCourse(course);
            }}
            style={{ width: '100%', padding: '10px', fontSize: '14px', borderRadius: '4px', border: '1px solid #ddd' }}
            disabled={teacherCourses.length === 0}
          >
            <option value="">
              {teacherCourses.length === 0 ? '-- Loading courses... --' : '-- Select a Course --'}
            </option>
            {teacherCourses.map((course, idx) => (
              <option key={idx} value={`${course.courseCode}-${course.section || 'null'}`}>
                {course.courseCode} - {course.courseTitle}
                {course.section && ` (Section ${course.section})`}
              </option>
            ))}
          </select>
        </div>
      )}


      {/* Evaluation Selector - Second Step (shown only after course selection) */}
      {selectedCourse && (
        <>
          {/* Show message when no sheets found */}
          {filteredSheets.length === 0 && !loading && (
            <div className="attainment-empty" style={{ textAlign: 'center', padding: '20px', backgroundColor: '#fff3cd', borderRadius: '4px', marginTop: '10px', marginBottom: '20px' }}>
              <p style={{ margin: 0 }}>No evaluation sheets found for {selectedCourse.courseCode}.</p>
            </div>
          )}

          {filteredSheets.length > 0 && (
            <div className="sheet-selector" style={{ marginBottom: '20px' }}>
              <label htmlFor="sheet-select" style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                Evaluations:
              </label>
              <select
                id="sheet-select"
                value={selectedSheet || ''}
                onChange={(e) => setSelectedSheet(e.target.value)}
                style={{ width: '100%', padding: '10px', fontSize: '14px', borderRadius: '4px', border: '1px solid #ddd' }}
              >
                <option value="">-- Select an Evaluation Sheet --</option>
                {filteredSheets.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Course Profile - shown only when selected */}
          {selectedSheet === 'CourseProfile' && clos.length > 0 && (
            <section className="course-profile-section" style={{ marginTop: '30px' }}>
              <h2>Course Profile</h2>
              <div className="table-wrapper">
                <table className="clo-table">
                  <thead>
                    <tr>
                      <th rowSpan="2">CLOs</th>
                      <th rowSpan="2">CLO Description</th>
                      <th colSpan="4">Bloom's Learning Levels</th>
                      <th rowSpan="2">PLOs Assessed</th>
                      <th rowSpan="2">CLO-PLO Correlation</th>
                    </tr>
                    <tr>
                      <th>C</th>
                      <th>A</th>
                      <th>P</th>
                      <th>S</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clos.map((clo) => (
                      <tr key={clo.cloNumber}>
                        <td className="clo-number">{clo.cloNumber}</td>
                        <td className="clo-description">
                          {renderCLOCell(clo, 'description', clo.description)}
                        </td>
                        <td className="bloom-level">
                          {renderCLOCell(clo, 'bloomC', clo.bloomLevels.cognitive)}
                        </td>
                        <td className="bloom-level">
                          {renderCLOCell(clo, 'bloomA', clo.bloomLevels.affective)}
                        </td>
                        <td className="bloom-level">
                          {renderCLOCell(clo, 'bloomP', clo.bloomLevels.psychomotor)}
                        </td>
                        <td className="bloom-level">
                          {renderCLOCell(clo, 'bloomS', clo.bloomLevels.social)}
                        </td>
                        <td className="plo-assessed">
                          {renderCLOCell(clo, 'ploAssessed', clo.ploAssessed)}
                        </td>
                        <td className="clo-plo-corr">
                          {renderCLOCell(clo, 'cloPloCorrelation', clo.cloPloCorrelation)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* CT Matrix - shown when CT is selected */}
          {selectedSheet === 'CT' && (
            <section className="ct-section" style={{ marginTop: '30px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
                <h2 style={{ margin: 0 }}>CO mapping of Class Test Marks</h2>
                <div className="action-buttons-container">
                  {saveStatus && (
                    <div className={`save-status-badge ${saveStatus}`}>
                      {saveStatus === 'saving' && '💾 Saving...'}
                      {saveStatus === 'saved' && '✓ Saved'}
                      {saveStatus === 'error' && '✗ Error saving'}
                    </div>
                  )}
                  <button
                    onClick={handleManualSave}
                    disabled={saveStatus === 'saving'}
                    className="btn-professional btn-save"
                  >
                    {saveStatus === 'saving' ? 'Saving...' : 'Save Table'}
                  </button>
                  <button
                    onClick={() => setShowGeneratedTableModal(true)}
                    className="btn-professional btn-primary"
                  >
                    View Generated Table
                  </button>
                </div>
              </div>
              {/* CO mapping table */}
              <div className="table-wrapper">
                <table className="ct-table">
                  <thead>
                    <tr>
                      <th rowSpan="2">CO No.</th>
                      {getActiveCTs().map(ct => (
                        <th key={ct} colSpan="3">{ct}</th>
                      ))}
                      <th rowSpan="2">CO Total</th>
                    </tr>
                    <tr>
                      {getActiveCTs().map(ct => (
                        <React.Fragment key={`${ct}-questions`}>
                          <th>Q1</th><th>Q2</th><th>Q3</th>
                        </React.Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ctRows.map((row, idx) => (
                      <tr key={row.coNumber || idx}>
                        <td className="co-label">{row.coNumber || '-'}</td>
                        {getActiveCTFields().map(field => (
                          <td key={field}>
                            <input
                              type="number"
                              min="0"
                              value={row[field]}
                              onChange={(e) => handleCTCellChange(idx, field, e.target.value)}
                              style={{ width: '80px' }}
                            />
                          </td>
                        ))}
                        <td className="co-total">{computeCOTotal(row)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td className="footer-label">CT Total</td>
                      {(() => {
                        const ctTotals = ctColumnTotals(); return (
                          <>
                            {getActiveCTs().map(ct => (
                              <td key={ct} colSpan={3} style={{ textAlign: 'center', fontWeight: 'bold' }}>
                                {ctTotals[ct] || 0}
                              </td>
                            ))}
                          </>
                        );
                      })()}
                      <td>{ctRows.reduce((sum, r) => sum + computeCOTotal(r), 0)}</td>
                    </tr>
                    <tr>
                      <td className="footer-label">Factor</td>
                      {getActiveCTs().map(ct => {
                        const autoFactor = calculateAutoFactor();
                        return (
                          <td key={ct} colSpan={3} style={{ textAlign: 'center' }}>
                            {formatNumber(autoFactor[ct] || 0)}
                          </td>
                        );
                      })}
                      <td></td>
                    </tr>
                    <tr>
                      <td className="footer-label">Eq. Wt</td>
                      {getActiveCTs().map(ct => {
                        const autoEqWt = calculateAutoEqWt();
                        return (
                          <td key={ct} colSpan={3} style={{ textAlign: 'center' }}>
                            {formatNumber(autoEqWt[ct] || 0)}
                          </td>
                        );
                      })}
                      <td><strong>{formatNumber(sumEqWtTotal())}</strong></td>
                    </tr>
                    <tr>
                      <td className="footer-label">Manual Wt</td>
                      {getActiveCTs().map(ct => (
                        <td key={ct} colSpan={3}>
                          <input
                            type="number"
                            step="0.01"
                            value={ctManualWts[ct] ?? 0}
                            onChange={(e) => handleManualWtChange(ct, e.target.value)}
                            style={{ width: '80px' }}
                          />
                        </td>
                      ))}
                      <td><strong>{formatNumber(sumManualWtTotal())}</strong></td>
                    </tr>
                    <tr>
                      <td className="footer-label" style={{ fontWeight: 'bold', color: '#2c3e50' }}>Status</td>
                      {(() => {
                        const manualTotal = sumManualWtTotal();
                        const coMappedMarks = ctSummary.coMappedMarks60 || 0;
                        const useEqWt = ctSummary.useEqWt || 0;

                        let message = '';
                        let messageColor = '#27ae60'; // green for OK

                        if (manualTotal === coMappedMarks) {
                          message = 'OK';
                        } else {
                          if (useEqWt === 0) {
                            message = `Sum should be ${coMappedMarks}`;
                            messageColor = '#e74c3c'; // red for error
                          } else {
                            message = `Sum should be ${coMappedMarks}, you can ignore as Eq. wt=1`;
                            messageColor = '#138d75'; // orange for warning
                          }
                        }

                        return (
                          <>
                            <td colSpan={getActiveCTs().length * 3} style={{ textAlign: 'center', fontWeight: 'bold', color: messageColor }}>
                              {message}
                            </td>
                            <td></td>
                          </>
                        );
                      })()}
                    </tr>
                  </tfoot>
                </table>
              </div>
              {/* CT summary table */}
              <div className="table-wrapper" style={{ marginTop: '20px' }}>
                <table className="ct-table">
                  <tbody>
                    <tr>
                      <td style={{ backgroundColor: '#f8f9fa', fontWeight: 600 }}>CTs Taken</td>
                      <td><input type="number" min={0} max={3} style={{ width: '80px' }} value={ctSummary.ctTaken} onChange={e => setCtSummary(prev => ({ ...prev, ctTaken: Math.max(0, Math.min(3, Number(e.target.value) || 0)) }))} /></td>
                    </tr>
                    <tr>
                      <td style={{ backgroundColor: '#f8f9fa', fontWeight: 600 }}>CT Marks out of 60</td>
                      <td><input type="number" min={0} max={60} style={{ width: '80px' }} value={ctSummary.coMappedMarks60} onChange={e => setCtSummary(prev => ({ ...prev, coMappedMarks60: Math.max(0, Math.min(60, Number(e.target.value) || 0)) }))} /></td>
                    </tr>
                    <tr>
                      <td style={{ backgroundColor: '#f8f9fa', fontWeight: 600 }}>Use Eq. Wt</td>
                      <td><input type="number" step="0.01" style={{ width: '80px' }} value={ctSummary.useEqWt} onChange={e => setCtSummary(prev => ({ ...prev, useEqWt: Number(e.target.value) || 0 }))} /></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Save Summary Button */}
              <div className="action-buttons-container" style={{ marginTop: '10px', justifyContent: 'flex-end' }}>
                {saveStatus && (
                  <div className={`save-status-badge ${saveStatus}`}>
                    {saveStatus === 'saving' && '💾 Saving...'}
                    {saveStatus === 'saved' && '✓ Saved'}
                    {saveStatus === 'error' && '✗ Error saving'}
                  </div>
                )}
                <button
                  onClick={handleManualSave}
                  disabled={saveStatus === 'saving'}
                  className="btn-professional btn-save"
                >
                  {saveStatus === 'saving' ? 'Saving...' : 'Save Summary'}
                </button>
              </div>


              {/* Obtained Marks for Class Tests */}
              {(() => {
                const g = ctGroupTotals(); const ctTaken = ctSummary.ctTaken || 3; return (
                  <section style={{ marginTop: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
                      <h3 style={{ margin: 0 }}>Obtained Marks for Class Tests</h3>
                      <div className="action-buttons-container">
                        {saveStatus && (
                          <div className={`save-status-badge ${saveStatus}`}>
                            {saveStatus === 'saving' && '💾 Saving...'}
                            {saveStatus === 'saved' && '✓ Saved'}
                            {saveStatus === 'error' && '✗ Error saving'}
                          </div>
                        )}
                        <button
                          onClick={handleManualSave}
                          disabled={saveStatus === 'saving'}
                          className="btn-professional btn-save"
                        >
                          {saveStatus === 'saving' ? 'Saving...' : 'Save Table'}
                        </button>
                        <button
                          onClick={() => setShowObtainedGeneratedModal(true)}
                          className="btn-professional btn-primary"
                        >
                          View Generated Obtained Table
                        </button>
                      </div>
                    </div>
                    <div className="table-wrapper">
                      <table className="ct-obtained-table">
                        <thead>
                          <tr>
                            <th rowSpan={3}>Roll</th>
                            <th colSpan={ctTaken * 3}>Class Test marks obtained out of {g.combined}</th>
                            <th rowSpan={3}>Total ({g.combined})</th>
                          </tr>
                          <tr>
                            {getActiveCTs().map((ct, i) => (
                              <th key={ct} colSpan={3}>{ct} ({[g.ct1, g.ct2, g.ct3][i]})</th>
                            ))}
                          </tr>
                          <tr>
                            {getActiveCTs().map(ct => (
                              <React.Fragment key={`${ct}-q`}>
                                <th>Q1</th><th>Q2</th><th>Q3</th>
                              </React.Fragment>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {ctObtainedRows.map((row, idx) => (
                            <tr key={`ct-${row.rollNumber}-${idx}`}>
                              <td className="roll-cell" title={row.name || row.rollNumber}>{row.rollNumber || '-'}</td>
                              {getActiveCTFields().map(field => (
                                <td key={`obt_${field}_${idx}`}>
                                  <input
                                    type="number"
                                    min="0"
                                    value={row[field]}
                                    onChange={(e) => handleObtainedCellChange(idx, field, e.target.value)}
                                    style={{ width: '80px' }}
                                  />
                                </td>
                              ))}
                              <td className="row-total">{computeObtainedTotal(row)}</td>
                            </tr>
                          ))}
                          {ctObtainedRows.length === 0 && (
                            <tr><td colSpan={ctTaken * 3 + 2} style={{ textAlign: 'center', color: '#7f8c8d', padding: '20px' }}>
                              <div>Sample students should be loaded. If not, check browser console for errors.</div>
                            </td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>
                );
              })()}

            </section>
          )}

          {/* Section A Section */}
          {selectedSheet === 'SectionA' && (
            <section className="section-a-section" style={{ marginTop: '30px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ borderBottom: 'none', marginBottom: 0, paddingBottom: 0 }}>Allocated marks for Section-A in final question</h2>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <button
                    onClick={handleManualSaveSectionA}
                    disabled={sectionASaveStatus === 'saving'}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: sectionASaveStatus === 'saving' ? '#95a5a6' : '#27ae60',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: sectionASaveStatus === 'saving' ? 'not-allowed' : 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    {sectionASaveStatus === 'saving' ? 'Saving...' : 'Save Table'}
                  </button>
                  {sectionASaveStatus === 'saved' && (
                    <span style={{ color: '#27ae60', fontSize: '14px', fontWeight: 'bold' }}>✓ Saved</span>
                  )}
                  {sectionASaveStatus === 'error' && (
                    <span style={{ color: '#e74c3c', fontSize: '14px', fontWeight: 'bold' }}>✗ Error</span>
                  )}
                  <button
                    onClick={() => setShowSectionAGeneratedModal(true)}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#3498db',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    View Generated Table
                  </button>
                </div>
              </div>

              {clos.length === 0 && (
                <p style={{ padding: '20px', color: '#7f8c8d' }}>Loading course outcomes...</p>
              )}
              {clos.length > 0 && (
                <>
                  <div className="table-wrapper">
                    <table className="section-a-table">
                      <thead>
                        <tr>
                          <th rowSpan="2">CO No.</th>
                          <th colSpan="4">1</th>
                          <th style={{ borderLeft: '2px solid #d5d5d5' }} colSpan="4">2</th>
                          <th style={{ borderLeft: '2px solid #d5d5d5' }} colSpan="4">3</th>
                          <th style={{ borderLeft: '2px solid #d5d5d5' }} colSpan="4">4</th>
                        </tr>
                        <tr>
                          <th>1(a)</th><th>1(b)</th><th>1(c)</th><th>1(d)</th>
                          <th style={{ borderLeft: '2px solid #d5d5d5' }}>2(a)</th><th>2(b)</th><th>2(c)</th><th>2(d)</th>
                          <th style={{ borderLeft: '2px solid #d5d5d5' }}>3(a)</th><th>3(b)</th><th>3(c)</th><th>3(d)</th>
                          <th style={{ borderLeft: '2px solid #d5d5d5' }}>4(a)</th><th>4(b)</th><th>4(c)</th><th>4(d)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sectionARows.map((row, idx) => (
                          <tr key={row.coNumber || idx}>
                            <td className="co-label">{row.coNumber || '-'}</td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                value={row.Q1a}
                                onChange={(e) => handleSectionACellChange(idx, 'Q1a', e.target.value)}
                                style={{ width: '80px' }}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                value={row.Q1b}
                                onChange={(e) => handleSectionACellChange(idx, 'Q1b', e.target.value)}
                                style={{ width: '80px' }}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                value={row.Q1c}
                                onChange={(e) => handleSectionACellChange(idx, 'Q1c', e.target.value)}
                                style={{ width: '80px' }}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                value={row.Q1d}
                                onChange={(e) => handleSectionACellChange(idx, 'Q1d', e.target.value)}
                                style={{ width: '80px' }}
                              />
                            </td>
                            <td style={{ borderLeft: '2px solid #d5d5d5' }}>
                              <input
                                type="number"
                                min="0"
                                value={row.Q2a}
                                onChange={(e) => handleSectionACellChange(idx, 'Q2a', e.target.value)}
                                style={{ width: '80px' }}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                value={row.Q2b}
                                onChange={(e) => handleSectionACellChange(idx, 'Q2b', e.target.value)}
                                style={{ width: '80px' }}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                value={row.Q2c}
                                onChange={(e) => handleSectionACellChange(idx, 'Q2c', e.target.value)}
                                style={{ width: '80px' }}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                value={row.Q2d}
                                onChange={(e) => handleSectionACellChange(idx, 'Q2d', e.target.value)}
                                style={{ width: '80px' }}
                              />
                            </td>
                            <td style={{ borderLeft: '2px solid #d5d5d5' }}>
                              <input
                                type="number"
                                min="0"
                                value={row.Q3a}
                                onChange={(e) => handleSectionACellChange(idx, 'Q3a', e.target.value)}
                                style={{ width: '80px' }}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                value={row.Q3b}
                                onChange={(e) => handleSectionACellChange(idx, 'Q3b', e.target.value)}
                                style={{ width: '80px' }}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                value={row.Q3c}
                                onChange={(e) => handleSectionACellChange(idx, 'Q3c', e.target.value)}
                                style={{ width: '80px' }}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                value={row.Q3d}
                                onChange={(e) => handleSectionACellChange(idx, 'Q3d', e.target.value)}
                                style={{ width: '80px' }}
                              />
                            </td>
                            <td style={{ borderLeft: '2px solid #d5d5d5' }}>
                              <input
                                type="number"
                                min="0"
                                value={row.Q4a}
                                onChange={(e) => handleSectionACellChange(idx, 'Q4a', e.target.value)}
                                style={{ width: '80px' }}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                value={row.Q4b}
                                onChange={(e) => handleSectionACellChange(idx, 'Q4b', e.target.value)}
                                style={{ width: '80px' }}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                value={row.Q4c}
                                onChange={(e) => handleSectionACellChange(idx, 'Q4c', e.target.value)}
                                style={{ width: '80px' }}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                value={row.Q4d}
                                onChange={(e) => handleSectionACellChange(idx, 'Q4d', e.target.value)}
                                style={{ width: '80px' }}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td className="footer-label">Total</td>
                          {(() => {
                            const questionTotals = sectionAQuestionTotals();
                            return (
                              <>
                                <td colSpan="4" style={{ textAlign: 'center', fontWeight: 'bold' }}>{questionTotals.q1}</td>
                                <td colSpan="4" style={{ borderLeft: '2px solid #d5d5d5', textAlign: 'center', fontWeight: 'bold' }}>{questionTotals.q2}</td>
                                <td colSpan="4" style={{ borderLeft: '2px solid #d5d5d5', textAlign: 'center', fontWeight: 'bold' }}>{questionTotals.q3}</td>
                                <td colSpan="4" style={{ borderLeft: '2px solid #d5d5d5', textAlign: 'center', fontWeight: 'bold' }}>{questionTotals.q4}</td>
                              </>
                            );
                          })()}
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Obtained Marks for Section-A */}
                  <section style={{ marginTop: '30px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                      <h3 style={{ margin: 0 }}>Obtained marks for Section-A</h3>
                      <button
                        onClick={() => setShowSectionAObtainedModal(true)}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: '#3498db',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '14px'
                        }}
                      >
                        View Generated Table
                      </button>
                    </div>
                    <div className="table-wrapper">
                      <table className="section-a-table">
                        <thead>
                          <tr>
                            <th rowSpan="2">Roll</th>
                            <th colSpan="4">1</th>
                            <th style={{ borderLeft: '2px solid #d5d5d5' }} colSpan="4">2</th>
                            <th style={{ borderLeft: '2px solid #d5d5d5' }} colSpan="4">3</th>
                            <th style={{ borderLeft: '2px solid #d5d5d5' }} colSpan="4">4</th>
                            <th rowSpan="2">Total</th>
                          </tr>
                          <tr>
                            <th>1(a)</th><th>1(b)</th><th>1(c)</th><th>1(d)</th>
                            <th style={{ borderLeft: '2px solid #d5d5d5' }}>2(a)</th><th>2(b)</th><th>2(c)</th><th>2(d)</th>
                            <th style={{ borderLeft: '2px solid #d5d5d5' }}>3(a)</th><th>3(b)</th><th>3(c)</th><th>3(d)</th>
                            <th style={{ borderLeft: '2px solid #d5d5d5' }}>4(a)</th><th>4(b)</th><th>4(c)</th><th>4(d)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sectionAObtainedRows.length > 0 ? sectionAObtainedRows.map((row, idx) => (
                            <tr key={`sectA-${row.rollNumber}-${idx}`}>
                              <td className="roll-cell" title={row.name || row.rollNumber}>{row.rollNumber || '-'}</td>
                              <td style={{ textAlign: 'center' }}>{row.Q1a || 0}</td>
                              <td style={{ textAlign: 'center' }}>{row.Q1b || 0}</td>
                              <td style={{ textAlign: 'center' }}>{row.Q1c || 0}</td>
                              <td style={{ textAlign: 'center' }}>{row.Q1d || 0}</td>
                              <td style={{ borderLeft: '2px solid #d5d5d5', textAlign: 'center' }}>{row.Q2a || 0}</td>
                              <td style={{ textAlign: 'center' }}>{row.Q2b || 0}</td>
                              <td style={{ textAlign: 'center' }}>{row.Q2c || 0}</td>
                              <td style={{ textAlign: 'center' }}>{row.Q2d || 0}</td>
                              <td style={{ borderLeft: '2px solid #d5d5d5', textAlign: 'center' }}>{row.Q3a || 0}</td>
                              <td style={{ textAlign: 'center' }}>{row.Q3b || 0}</td>
                              <td style={{ textAlign: 'center' }}>{row.Q3c || 0}</td>
                              <td style={{ textAlign: 'center' }}>{row.Q3d || 0}</td>
                              <td style={{ borderLeft: '2px solid #d5d5d5', textAlign: 'center' }}>{row.Q4a || 0}</td>
                              <td style={{ textAlign: 'center' }}>{row.Q4b || 0}</td>
                              <td style={{ textAlign: 'center' }}>{row.Q4c || 0}</td>
                              <td style={{ textAlign: 'center' }}>{row.Q4d || 0}</td>
                              <td className="co-total">{computeSectionAObtainedTotal(row)}</td>
                            </tr>
                          )) : (
                            <tr>
                              <td colSpan={18} style={{ textAlign: 'center', color: '#7f8c8d', padding: '20px' }}>
                                <div style={{ marginBottom: '10px' }}>
                                  <strong>No students found for this course.</strong>
                                </div>
                                <div style={{ fontSize: '14px', lineHeight: '1.4' }}>
                                  To view student marks, you need to:
                                  <br />• Ensure students are enrolled in this course
                                  <br />• Enter marks in "Enter Term Marks" section
                                </div>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>

                </>
              )}
            </section>
          )}

          {/* Section B Section */}
          {selectedSheet === 'SectionB' && (
            <section className="section-b-section" style={{ marginTop: '30px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ borderBottom: 'none', marginBottom: 0, paddingBottom: 0 }}>Allocated marks for Section-B in final question</h2>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <button
                    onClick={handleManualSaveSectionB}
                    disabled={sectionBSaveStatus === 'saving'}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: sectionBSaveStatus === 'saving' ? '#95a5a6' : '#27ae60',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: sectionBSaveStatus === 'saving' ? 'not-allowed' : 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    {sectionBSaveStatus === 'saving' ? 'Saving...' : 'Save Table'}
                  </button>
                  {sectionBSaveStatus === 'saved' && (
                    <span style={{ color: '#27ae60', fontSize: '14px', fontWeight: 'bold' }}>✓ Saved</span>
                  )}
                  {sectionBSaveStatus === 'error' && (
                    <span style={{ color: '#e74c3c', fontSize: '14px', fontWeight: 'bold' }}>✗ Error</span>
                  )}
                  <button
                    onClick={() => setShowSectionBGeneratedModal(true)}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#3498db',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    View Generated Table
                  </button>
                </div>
              </div>

              {clos.length === 0 && (
                <p style={{ padding: '20px', color: '#7f8c8d' }}>Loading course outcomes...</p>
              )}
              {clos.length > 0 && (
                <>
                  <div className="table-wrapper">
                    <table className="section-a-table">
                      <thead>
                        <tr>
                          <th rowSpan="2">CO No.</th>
                          <th colSpan="4">5</th>
                          <th style={{ borderLeft: '2px solid #d5d5d5' }} colSpan="4">6</th>
                          <th style={{ borderLeft: '2px solid #d5d5d5' }} colSpan="4">7</th>
                          <th style={{ borderLeft: '2px solid #d5d5d5' }} colSpan="4">8</th>
                        </tr>
                        <tr>
                          <th>5(a)</th><th>5(b)</th><th>5(c)</th><th>5(d)</th>
                          <th style={{ borderLeft: '2px solid #d5d5d5' }}>6(a)</th><th>6(b)</th><th>6(c)</th><th>6(d)</th>
                          <th style={{ borderLeft: '2px solid #d5d5d5' }}>7(a)</th><th>7(b)</th><th>7(c)</th><th>7(d)</th>
                          <th style={{ borderLeft: '2px solid #d5d5d5' }}>8(a)</th><th>8(b)</th><th>8(c)</th><th>8(d)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sectionBRows.map((row, idx) => (
                          <tr key={row.coNumber || idx}>
                            <td className="co-label">{row.coNumber || '-'}</td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                value={row.Q1a}
                                onChange={(e) => handleSectionBCellChange(idx, 'Q1a', e.target.value)}
                                style={{ width: '80px' }}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                value={row.Q1b}
                                onChange={(e) => handleSectionBCellChange(idx, 'Q1b', e.target.value)}
                                style={{ width: '80px' }}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                value={row.Q1c}
                                onChange={(e) => handleSectionBCellChange(idx, 'Q1c', e.target.value)}
                                style={{ width: '80px' }}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                value={row.Q1d}
                                onChange={(e) => handleSectionBCellChange(idx, 'Q1d', e.target.value)}
                                style={{ width: '80px' }}
                              />
                            </td>
                            <td style={{ borderLeft: '2px solid #d5d5d5' }}>
                              <input
                                type="number"
                                min="0"
                                value={row.Q2a}
                                onChange={(e) => handleSectionBCellChange(idx, 'Q2a', e.target.value)}
                                style={{ width: '80px' }}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                value={row.Q2b}
                                onChange={(e) => handleSectionBCellChange(idx, 'Q2b', e.target.value)}
                                style={{ width: '80px' }}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                value={row.Q2c}
                                onChange={(e) => handleSectionBCellChange(idx, 'Q2c', e.target.value)}
                                style={{ width: '80px' }}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                value={row.Q2d}
                                onChange={(e) => handleSectionBCellChange(idx, 'Q2d', e.target.value)}
                                style={{ width: '80px' }}
                              />
                            </td>
                            <td style={{ borderLeft: '2px solid #d5d5d5' }}>
                              <input
                                type="number"
                                min="0"
                                value={row.Q3a}
                                onChange={(e) => handleSectionBCellChange(idx, 'Q3a', e.target.value)}
                                style={{ width: '80px' }}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                value={row.Q3b}
                                onChange={(e) => handleSectionBCellChange(idx, 'Q3b', e.target.value)}
                                style={{ width: '80px' }}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                value={row.Q3c}
                                onChange={(e) => handleSectionBCellChange(idx, 'Q3c', e.target.value)}
                                style={{ width: '80px' }}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                value={row.Q3d}
                                onChange={(e) => handleSectionBCellChange(idx, 'Q3d', e.target.value)}
                                style={{ width: '80px' }}
                              />
                            </td>
                            <td style={{ borderLeft: '2px solid #d5d5d5' }}>
                              <input
                                type="number"
                                min="0"
                                value={row.Q4a}
                                onChange={(e) => handleSectionBCellChange(idx, 'Q4a', e.target.value)}
                                style={{ width: '80px' }}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                value={row.Q4b}
                                onChange={(e) => handleSectionBCellChange(idx, 'Q4b', e.target.value)}
                                style={{ width: '80px' }}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                value={row.Q4c}
                                onChange={(e) => handleSectionBCellChange(idx, 'Q4c', e.target.value)}
                                style={{ width: '80px' }}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                value={row.Q4d}
                                onChange={(e) => handleSectionBCellChange(idx, 'Q4d', e.target.value)}
                                style={{ width: '80px' }}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td className="footer-label">Total</td>
                          {(() => {
                            const questionTotals = sectionBQuestionTotals();
                            return (
                              <>
                                <td colSpan="4" style={{ textAlign: 'center', fontWeight: 'bold' }}>{questionTotals.q1}</td>
                                <td colSpan="4" style={{ borderLeft: '2px solid #d5d5d5', textAlign: 'center', fontWeight: 'bold' }}>{questionTotals.q2}</td>
                                <td colSpan="4" style={{ borderLeft: '2px solid #d5d5d5', textAlign: 'center', fontWeight: 'bold' }}>{questionTotals.q3}</td>
                                <td colSpan="4" style={{ borderLeft: '2px solid #d5d5d5', textAlign: 'center', fontWeight: 'bold' }}>{questionTotals.q4}</td>
                              </>
                            );
                          })()}
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Obtained Marks for Section-B */}
                  <section style={{ marginTop: '30px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                      <h3 style={{ margin: 0 }}>Obtained marks for Section-B</h3>
                      <button
                        onClick={() => setShowSectionBObtainedModal(true)}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: '#3498db',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '14px'
                        }}
                      >
                        View Generated Table
                      </button>
                    </div>
                    <div className="table-wrapper">
                      <table className="section-a-table">
                        <thead>
                          <tr>
                            <th rowSpan="2">Roll</th>
                            <th colSpan="4">5</th>
                            <th style={{ borderLeft: '2px solid #d5d5d5' }} colSpan="4">6</th>
                            <th style={{ borderLeft: '2px solid #d5d5d5' }} colSpan="4">7</th>
                            <th style={{ borderLeft: '2px solid #d5d5d5' }} colSpan="4">8</th>
                            <th rowSpan="2">Total</th>
                          </tr>
                          <tr>
                            <th>5(a)</th><th>5(b)</th><th>5(c)</th><th>5(d)</th>
                            <th style={{ borderLeft: '2px solid #d5d5d5' }}>6(a)</th><th>6(b)</th><th>6(c)</th><th>6(d)</th>
                            <th style={{ borderLeft: '2px solid #d5d5d5' }}>7(a)</th><th>7(b)</th><th>7(c)</th><th>7(d)</th>
                            <th style={{ borderLeft: '2px solid #d5d5d5' }}>8(a)</th><th>8(b)</th><th>8(c)</th><th>8(d)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sectionBObtainedRows.length > 0 ? sectionBObtainedRows.map((row, idx) => (
                            <tr key={`sectB-${row.rollNumber}-${idx}`}>
                              <td className="roll-cell" title={row.name || row.rollNumber}>{row.rollNumber || '-'}</td>
                              <td style={{ textAlign: 'center' }}>{row.Q1a || 0}</td>
                              <td style={{ textAlign: 'center' }}>{row.Q1b || 0}</td>
                              <td style={{ textAlign: 'center' }}>{row.Q1c || 0}</td>
                              <td style={{ textAlign: 'center' }}>{row.Q1d || 0}</td>
                              <td style={{ borderLeft: '2px solid #d5d5d5', textAlign: 'center' }}>{row.Q2a || 0}</td>
                              <td style={{ textAlign: 'center' }}>{row.Q2b || 0}</td>
                              <td style={{ textAlign: 'center' }}>{row.Q2c || 0}</td>
                              <td style={{ textAlign: 'center' }}>{row.Q2d || 0}</td>
                              <td style={{ borderLeft: '2px solid #d5d5d5', textAlign: 'center' }}>{row.Q3a || 0}</td>
                              <td style={{ textAlign: 'center' }}>{row.Q3b || 0}</td>
                              <td style={{ textAlign: 'center' }}>{row.Q3c || 0}</td>
                              <td style={{ textAlign: 'center' }}>{row.Q3d || 0}</td>
                              <td style={{ borderLeft: '2px solid #d5d5d5', textAlign: 'center' }}>{row.Q4a || 0}</td>
                              <td style={{ textAlign: 'center' }}>{row.Q4b || 0}</td>
                              <td style={{ textAlign: 'center' }}>{row.Q4c || 0}</td>
                              <td style={{ textAlign: 'center' }}>{row.Q4d || 0}</td>
                              <td className="co-total">{computeSectionBObtainedTotal(row)}</td>
                            </tr>
                          )) : (
                            <tr>
                              <td colSpan={18} style={{ textAlign: 'center', color: '#7f8c8d', padding: '20px' }}>
                                <div style={{ marginBottom: '10px' }}>
                                  <strong>No students found for this course.</strong>
                                </div>
                                <div style={{ fontSize: '14px', lineHeight: '1.4' }}>
                                  To view student marks, you need to:
                                  <br />• Ensure students are enrolled in this course
                                  <br />• Enter marks in "Enter Term Marks" section
                                </div>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>

                </>
              )}
            </section>
          )}

          {/* LabActivity Section */}
          {selectedSheet === 'LabActivity' && (
            <section className="ct-section" style={{ marginTop: '30px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
                <h2 style={{ margin: 0 }}>Allocated Marks for Lab activity</h2>
                <div className="action-buttons-container">
                  {labActivitySaveStatus && (
                    <div className={`save-status-badge ${labActivitySaveStatus}`}>
                      {labActivitySaveStatus === 'saving' && '💾 Saving...'}
                      {labActivitySaveStatus === 'saved' && '✓ Saved'}
                      {labActivitySaveStatus === 'error' && '✗ Error saving'}
                    </div>
                  )}
                  <button
                    onClick={() => {
                      handleManualSaveLabActivity();
                    }}
                    disabled={labActivitySaveStatus === 'saving'}
                    className="btn-professional btn-save"
                  >
                    {labActivitySaveStatus === 'saving' ? 'Saving...' : 'Save Table'}
                  </button>
                  <button
                    onClick={() => setShowLabActivityGeneratedModal(true)}
                    className="btn-professional btn-primary"
                  >
                    View Generated Table
                  </button>
                </div>
              </div>
              {clos.length === 0 && (
                <p style={{ padding: '20px', color: '#7f8c8d' }}>Loading course outcomes...</p>
              )}
              {clos.length > 0 && (
                <>
                  <div className="table-wrapper">
                    <table className="section-a-table">
                      <thead>
                        <tr>
                          <th rowSpan="3">CO No.</th>
                          <th rowSpan="2">Attn.</th>
                          <th rowSpan="2">Quiz</th>
                          <th rowSpan="2">C. Viva</th>
                          <th colSpan={(activityTaken || 5) * 3}>CO Mapping of Lab Activity Marks</th>
                          <th colSpan="1">Other</th>
                          <th rowSpan="3">CO Total</th>
                        </tr>
                        <tr>
                          {Array.from({ length: activityTaken || 5 }, (_, i) => (
                            <th key={`activity-header-${i + 1}`} colSpan="3">Activity{i + 1}</th>
                          ))}
                          <th rowSpan="2">Measured Total</th>
                        </tr>
                        <tr>
                          <th>
                            <input
                              type="number"
                              min="0"
                              value={labAttendanceMarks}
                              onChange={(e) => setLabAttendanceMarks(Number(e.target.value))}
                              style={{ width: '50px' }}
                            />
                          </th>
                          <th>
                            <input
                              type="number"
                              min="0"
                              value={labQuizMarks}
                              onChange={(e) => setLabQuizMarks(Number(e.target.value))}
                              style={{ width: '50px' }}
                            />
                          </th>
                          <th>
                            <input
                              type="number"
                              min="0"
                              value={labVivaMarks}
                              onChange={(e) => setLabVivaMarks(Number(e.target.value))}
                              style={{ width: '50px' }}
                            />
                          </th>
                          {Array.from({ length: activityTaken || 5 }, (_, i) => (
                            <React.Fragment key={`q-headers-${i + 1}`}>
                              <th>Q1</th>
                              <th>Q2</th>
                              <th>Q3</th>
                            </React.Fragment>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {labActivityRows.map((row, idx) => (
                          <tr key={idx}>
                            <td className="co-column">{row.coNumber}</td>
                            <td style={{ textAlign: 'center' }}>-</td>
                            <td style={{ textAlign: 'center' }}>-</td>
                            <td style={{ textAlign: 'center' }}>-</td>
                            {Array.from({ length: activityTaken || 5 }, (_, activityIndex) => {
                              const activityNum = activityIndex + 1;
                              return (
                                <React.Fragment key={`activity-inputs-${activityNum}`}>
                                  <td>
                                    <input
                                      type="number"
                                      min="0"
                                      value={row[`Activity${activityNum}_Q1`]}
                                      onChange={(e) => handleLabActivityCellChange(idx, `Activity${activityNum}_Q1`, e.target.value)}
                                      style={{ width: '60px' }}
                                    />
                                  </td>
                                  <td>
                                    <input
                                      type="number"
                                      min="0"
                                      value={row[`Activity${activityNum}_Q2`]}
                                      onChange={(e) => handleLabActivityCellChange(idx, `Activity${activityNum}_Q2`, e.target.value)}
                                      style={{ width: '60px' }}
                                    />
                                  </td>
                                  <td>
                                    <input
                                      type="number"
                                      min="0"
                                      value={row[`Activity${activityNum}_Q3`]}
                                      onChange={(e) => handleLabActivityCellChange(idx, `Activity${activityNum}_Q3`, e.target.value)}
                                      style={{ width: '60px' }}
                                    />
                                  </td>
                                </React.Fragment>
                              );
                            })}
                            {idx === 0 && (
                              <td rowSpan={labActivityRows.length} style={{ verticalAlign: 'middle', fontWeight: 'bold' }}>
                                {(() => {
                                  let grandTotal = 0;
                                  // Add Attn, Quiz, Viva marks from header
                                  grandTotal += (labAttendanceMarks || 0) + (labQuizMarks || 0) + (labVivaMarks || 0);
                                  // Add all activity totals from CO rows
                                  labActivityRows.forEach(r => {
                                    grandTotal += computeLabActivityMeasuredTotal(r);
                                  });
                                  return grandTotal;
                                })()}
                              </td>
                            )}
                            <td className="co-total">{computeLabActivityCOTotal(row)}</td>
                          </tr>
                        ))}

                        {/* Total Factor Row */}
                        <tr className="factor-row">
                          <td colSpan="4"><strong>Total</strong></td>
                          {Array.from({ length: activityTaken || 5 }, (_, activityIndex) => {
                            const activityNum = activityIndex + 1;
                            const activityKey = `activity${activityNum}`;
                            const totals = labActivityActivityTotals();
                            return (
                              <td key={`factor-${activityKey}`} colSpan="3" style={{ textAlign: 'center', fontWeight: 'bold' }}>
                                {totals[activityKey] || 0}
                              </td>
                            );
                          })}
                          <td>
                            {(() => {
                              const totals = labActivityActivityTotals();
                              let sum = (labAttendanceMarks || 0) + (labQuizMarks || 0) + (labVivaMarks || 0);
                              for (let i = 1; i <= (activityTaken || 5); i++) {
                                sum += totals[`activity${i}`] || 0;
                              }
                              return sum;
                            })()}
                          </td>
                          <td className="co-total">
                            {(() => {
                              const totals = labActivityActivityTotals();
                              let sum = 0;
                              for (let i = 1; i <= (activityTaken || 5); i++) {
                                sum += totals[`activity${i}`] || 0;
                              }
                              return sum;
                            })()}
                          </td>
                        </tr>

                        {/* Factor Row */}
                        <tr className="factor-row">
                          <td colSpan="4"><strong>Factor</strong></td>
                          {Array.from({ length: activityTaken || 5 }, (_, activityIndex) => {
                            const activityNum = activityIndex + 1;
                            const activityKey = `activity${activityNum}`;
                            const totals = labActivityActivityTotals();
                            const activityTotal = totals[activityKey] || 0;

                            let calculatedFactor = 0;
                            try {
                              if (activityTotal === 0) {
                                calculatedFactor = 0;
                              } else if (useEqWtActivity) {
                                // Use Eq. Wt: calculate Eq. Wt value / Activity Total
                                const eqWtValue = activityTotal > 0
                                  ? (coMappedActivityMarks || 0) / (activityTaken || 1)
                                  : 0;
                                calculatedFactor = eqWtValue / activityTotal;
                              } else {
                                // Use Manual Wt: calculate Manual Wt value / Activity Total
                                const manualWtValue = labActivityManualWts[activityKey] || 0;
                                calculatedFactor = manualWtValue / activityTotal;
                              }
                            } catch (error) {
                              calculatedFactor = 0;
                            }

                            return (
                              <td key={`factor-${activityKey}`} colSpan="3" style={{ textAlign: 'center', fontWeight: 'bold' }}>
                                {formatNumber(calculatedFactor)}
                              </td>
                            );
                          })}
                          <td>
                            {(() => {
                              try {
                                const totals = labActivityActivityTotals();
                                // Calculate T12: Measured Total from Total row
                                let measuredTotal = (labAttendanceMarks || 0) + (labQuizMarks || 0) + (labVivaMarks || 0);
                                for (let i = 1; i <= (activityTaken || 5); i++) {
                                  measuredTotal += totals[`activity${i}`] || 0;
                                }

                                // Calculate Factor: AB6 / T12
                                if (measuredTotal === 0) {
                                  return '0';
                                }
                                const factor = (otherActivityRemaining || 0) / measuredTotal;
                                return formatNumber(factor);
                              } catch (error) {
                                return '0';
                              }
                            })()}
                          </td>
                          <td className="co-total">
                            {(() => {
                              try {
                                const totals = labActivityActivityTotals();
                                // Calculate T12: Measured Total from Total row
                                let measuredTotal = (labAttendanceMarks || 0) + (labQuizMarks || 0) + (labVivaMarks || 0);
                                for (let i = 1; i <= (activityTaken || 5); i++) {
                                  measuredTotal += totals[`activity${i}`] || 0;
                                }

                                // Calculate T14: Factor for Measured Total (AB6 / T12)
                                const t14 = measuredTotal === 0 ? 0 : (otherActivityRemaining || 0) / measuredTotal;

                                // Calculate CO Total: T14 * T12
                                const coTotal = t14 * measuredTotal;
                                return formatNumber(coTotal);
                              } catch (error) {
                                return '0';
                              }
                            })()}
                          </td>
                        </tr>

                        {/* Eq. Wt Row */}
                        <tr className="eq-wt-row">
                          <td colSpan="4"><strong>Eq. Wt</strong></td>
                          {Array.from({ length: activityTaken || 5 }, (_, activityIndex) => {
                            const activityNum = activityIndex + 1;
                            const activityKey = `activity${activityNum}`;
                            const totals = labActivityActivityTotals();
                            const activityTotal = totals[activityKey] || 0;
                            const calculatedEqWt = activityTotal > 0
                              ? (coMappedActivityMarks || 0) / (activityTaken || 1)
                              : 0;
                            return (
                              <td key={`eqwt-${activityKey}`} colSpan="3" style={{ textAlign: 'center', fontWeight: 'bold' }}>
                                {formatNumber(calculatedEqWt)}
                              </td>
                            );
                          })}
                          <td></td>
                          <td className="co-total">
                            {(() => {
                              const totals = labActivityActivityTotals();
                              let sum = 0;
                              for (let i = 1; i <= (activityTaken || 5); i++) {
                                const activityKey = `activity${i}`;
                                const activityTotal = totals[activityKey] || 0;
                                const calculatedEqWt = activityTotal > 0
                                  ? (coMappedActivityMarks || 0) / (activityTaken || 1)
                                  : 0;
                                sum += calculatedEqWt;
                              }
                              return formatNumber(sum);
                            })()}
                          </td>
                        </tr>

                        {/* Manual Wt Row */}
                        <tr className="manual-wt-row">
                          <td colSpan="4"><strong>Manual Wt</strong></td>
                          {Array.from({ length: activityTaken || 5 }, (_, activityIndex) => {
                            const activityNum = activityIndex + 1;
                            const activityKey = `activity${activityNum}`;
                            return (
                              <td key={`manualwt-${activityKey}`} colSpan="3">
                                <input
                                  type="number"
                                  min="0"
                                  value={labActivityManualWts[activityKey] || 0}
                                  onChange={(e) => handleLabActivityManualWtChange(activityKey, e.target.value)}
                                  style={{ width: '80px' }}
                                />
                              </td>
                            );
                          })}
                          <td></td>
                          <td className="co-total">
                            {(() => {
                              const manualWts = labActivityManualWts;
                              let sum = 0;
                              for (let i = 1; i <= (activityTaken || 5); i++) {
                                const activityKey = `activity${i}`;
                                sum += (manualWts[activityKey] || 0);
                              }
                              return formatNumber(sum);
                            })()}
                          </td>
                        </tr>

                        {/* Validation Message Row */}
                        <tr style={{ backgroundColor: '#f8f9fa' }}>
                          <td colSpan="4"></td>
                          <td colSpan={(activityTaken || 5) * 3} style={{ textAlign: 'center', fontWeight: 'bold' }}>
                            {(() => {
                              const manualWts = labActivityManualWts;
                              let u16 = 0;
                              for (let i = 1; i <= (activityTaken || 5); i++) {
                                const activityKey = `activity${i}`;
                                u16 += (manualWts[activityKey] || 0);
                              }

                              const ab8 = coMappedActivityMarks || 0;
                              const ab9 = useEqWtActivity;

                              if (u16 === ab8) {
                                return <span style={{ color: '#27ae60' }}>ok</span>;
                              } else if (!ab9) {
                                return <span style={{ color: '#e74c3c' }}>Sum should be {ab8}</span>;
                              } else {
                                return <span style={{ color: '#138d75' }}>Sum should be {ab8}, you can ignore as Eq. wt=1</span>;
                              }
                            })()}
                          </td>
                          <td colSpan="2"></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* LabActivity Summary Table */}
                  <div className="table-wrapper" style={{ marginTop: '20px' }}>
                    <table className="ct-table">
                      <tbody>
                        <tr>
                          <td>Activity Taken</td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              value={activityTaken}
                              onChange={(e) => setActivityTaken(Number(e.target.value))}
                              style={{ width: '80px' }}
                            />
                          </td>
                        </tr>
                        <tr>
                          <td>Other Activity remaining marks /50</td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              value={otherActivityRemaining}
                              onChange={(e) => setOtherActivityRemaining(Number(e.target.value))}
                              style={{ width: '80px' }}
                            />
                          </td>
                        </tr>
                        <tr>
                          <td>Other Activity Measured in</td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              value={otherActivityMeasured}
                              onChange={(e) => setOtherActivityMeasured(Number(e.target.value))}
                              style={{ width: '80px' }}
                            />
                          </td>
                        </tr>
                        <tr>
                          <td>CO Mapped Activity Marks out of 50</td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              value={coMappedActivityMarks}
                              onChange={(e) => setCoMappedActivityMarks(Number(e.target.value))}
                              style={{ width: '80px' }}
                            />
                          </td>
                        </tr>
                        <tr>
                          <td>Use Eq. Wt for each activity</td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              value={useEqWtActivity}
                              onChange={(e) => setUseEqWtActivity(Number(e.target.value))}
                              style={{ width: '80px' }}
                            />
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Summary Table Save Button */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: '15px', gap: '15px' }}>
                    {labActivitySaveStatus && (
                      <div className={`save-status-badge ${labActivitySaveStatus}`}>
                        {labActivitySaveStatus === 'saving' && '💾 Saving...'}
                        {labActivitySaveStatus === 'saved' && '✓ Saved'}
                        {labActivitySaveStatus === 'error' && '✗ Error saving'}
                      </div>
                    )}
                    <button
                      onClick={() => {
                        handleManualSaveLabActivity();
                      }}
                      disabled={labActivitySaveStatus === 'saving'}
                      className="btn-professional btn-save"
                    >
                      {labActivitySaveStatus === 'saving' ? 'Saving...' : 'Save Table'}
                    </button>
                  </div>

                  {/* LabActivity Obtained Marks Table */}
                  <section style={{ marginTop: '30px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '15px' }}>
                      <h3>Obtained Marks</h3>
                      <div className="action-buttons-container">
                        {labActivitySaveStatus && (
                          <div className={`save-status-badge ${labActivitySaveStatus}`}>
                            {labActivitySaveStatus === 'saving' && '💾 Saving...'}
                            {labActivitySaveStatus === 'saved' && '✓ Saved'}
                            {labActivitySaveStatus === 'error' && '✗ Error saving'}
                          </div>
                        )}
                        <button
                          onClick={() => {
                            handleManualSaveLabActivity();
                          }}
                          disabled={labActivitySaveStatus === 'saving'}
                          className="btn-professional btn-save"
                        >
                          {labActivitySaveStatus === 'saving' ? 'Saving...' : 'Save Table'}
                        </button>
                        <button
                          onClick={() => setShowLabActivityObtainedModal(true)}
                          className="btn-professional btn-primary"
                        >
                          Generated Tables
                        </button>
                      </div>
                    </div>
                    <div className="table-wrapper">
                      <table className="ct-obtained-table">
                        <thead>
                          <tr>
                            <th rowSpan="3">Roll</th>
                            <th rowSpan="1">Attn.</th>
                            <th rowSpan="1">Quiz</th>
                            <th rowSpan="1">C. Viva</th>
                            <th colSpan={(activityTaken || 5) * 3}>Lab Activity marks obtained out of {coMappedActivityMarks}</th>
                            <th rowSpan="3">
                              Other<br />
                              ({(() => {
                                const totals = labActivityActivityTotals();
                                let measuredTotal = (labAttendanceMarks || 0) + (labQuizMarks || 0) + (labVivaMarks || 0);
                                for (let i = 1; i <= (activityTaken || 5); i++) {
                                  measuredTotal += totals[`activity${i}`] || 0;
                                }
                                return measuredTotal;
                              })()})
                            </th>
                            <th rowSpan="3">Other<br />({otherActivityRemaining || 0})</th>
                          </tr>
                          <tr>
                            <th rowSpan="2">Out of {labAttendanceMarks}</th>
                            <th rowSpan="2">Out of {labQuizMarks}</th>
                            <th rowSpan="2">Out of {labVivaMarks}</th>
                            {Array.from({ length: activityTaken || 5 }, (_, i) => (
                              <th key={`activity-${i + 1}`} colSpan="3">Activity{i + 1}</th>
                            ))}
                          </tr>
                          <tr>
                            {Array.from({ length: activityTaken || 5 }, (_, i) => (
                              <React.Fragment key={`qs-${i + 1}`}>
                                <th>Q1</th><th>Q2</th><th>Q3</th>
                              </React.Fragment>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {labActivityObtainedRows.length > 0 ? labActivityObtainedRows.map((row, idx) => (
                            <tr key={`lab-${row.rollNumber}-${idx}`}>
                              <td>{row.rollNumber || '-'}</td>
                              <td>
                                <input
                                  type="number"
                                  min="0"
                                  value={row.attn || 0}
                                  onChange={e => {
                                    const updatedRows = [...labActivityObtainedRows];
                                    updatedRows[idx] = { ...row, attn: Number(e.target.value) };
                                    setLabActivityObtainedRows(updatedRows);
                                  }}
                                  style={{ width: '80px' }}
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  min="0"
                                  value={row.quiz || 0}
                                  onChange={e => {
                                    const updatedRows = [...labActivityObtainedRows];
                                    updatedRows[idx] = { ...row, quiz: Number(e.target.value) };
                                    setLabActivityObtainedRows(updatedRows);
                                  }}
                                  style={{ width: '80px' }}
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  min="0"
                                  value={row.viva || 0}
                                  onChange={e => {
                                    const updatedRows = [...labActivityObtainedRows];
                                    updatedRows[idx] = { ...row, viva: Number(e.target.value) };
                                    setLabActivityObtainedRows(updatedRows);
                                  }}
                                  style={{ width: '80px' }}
                                />
                              </td>
                              {Array.from({ length: activityTaken || 5 }, (_, activityIndex) => {
                                const activityNum = activityIndex + 1;
                                return (
                                  <React.Fragment key={`activity-${activityNum}`}>
                                    <td>
                                      <input
                                        type="number"
                                        min="0"
                                        value={row[`Activity${activityNum}_Q1`] || 0}
                                        onChange={e => {
                                          const updatedRows = [...labActivityObtainedRows];
                                          updatedRows[idx] = { ...row, [`Activity${activityNum}_Q1`]: Number(e.target.value) };
                                          setLabActivityObtainedRows(updatedRows);
                                        }}
                                        style={{ width: '80px' }}
                                      />
                                    </td>
                                    <td>
                                      <input
                                        type="number"
                                        min="0"
                                        value={row[`Activity${activityNum}_Q2`] || 0}
                                        onChange={e => {
                                          const updatedRows = [...labActivityObtainedRows];
                                          updatedRows[idx] = { ...row, [`Activity${activityNum}_Q2`]: Number(e.target.value) };
                                          setLabActivityObtainedRows(updatedRows);
                                        }}
                                        style={{ width: '80px' }}
                                      />
                                    </td>
                                    <td>
                                      <input
                                        type="number"
                                        min="0"
                                        value={row[`Activity${activityNum}_Q3`] || 0}
                                        onChange={e => {
                                          const updatedRows = [...labActivityObtainedRows];
                                          updatedRows[idx] = { ...row, [`Activity${activityNum}_Q3`]: Number(e.target.value) };
                                          setLabActivityObtainedRows(updatedRows);
                                        }}
                                        style={{ width: '80px' }}
                                      />
                                    </td>
                                  </React.Fragment>
                                );
                              })}
                              <td>
                                <input
                                  type="number"
                                  min="0"
                                  value={row.otherMeasured || 0}
                                  onChange={e => {
                                    const updatedRows = [...labActivityObtainedRows];
                                    updatedRows[idx] = { ...row, otherMeasured: Number(e.target.value) };
                                    setLabActivityObtainedRows(updatedRows);
                                  }}
                                  style={{ width: '80px' }}
                                />
                              </td>
                              <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                                {(() => {
                                  const totals = labActivityActivityTotals();
                                  let totalMeasuredTotal = (labAttendanceMarks || 0) + (labQuizMarks || 0) + (labVivaMarks || 0);
                                  for (let i = 1; i <= (activityTaken || 5); i++) {
                                    totalMeasuredTotal += totals[`activity${i}`] || 0;
                                  }

                                  if (totalMeasuredTotal === 0) return 0;

                                  const factor = (otherActivityRemaining || 0) / totalMeasuredTotal;
                                  const studentMeasuredTotal = row.otherMeasured || 0;
                                  const calculatedValue = studentMeasuredTotal * factor;

                                  // Round to 4 decimal places to avoid floating point precision issues
                                  const rounded = Math.round(calculatedValue * 10000) / 10000;
                                  return formatNumber(rounded);
                                })()}
                              </td>
                            </tr>
                          )) : (
                            <tr><td colSpan={6 + ((activityTaken || 5) * 3)} style={{ textAlign: 'center', color: '#7f8c8d' }}>No students found for this sheet.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>

                </>
              )}
            </section>
          )}

          {/* Assignment & Attendance Section */}
          {selectedSheet === 'Attn_Assign' && (
            <section className="ct-section" style={{ marginTop: '30px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
                <h2 style={{ margin: 0 }}>Allocated Marks for Attendance and Assignment (if taken)</h2>
                <div className="action-buttons-container">
                  {saveStatus && (
                    <div className={`save-status-badge ${saveStatus}`}>
                      {saveStatus === 'saving' && '💾 Saving...'}
                      {saveStatus === 'saved' && '✓ Saved'}
                      {saveStatus === 'error' && '✗ Error saving'}
                    </div>
                  )}
                  <button
                    onClick={() => {
                      handleManualSaveAssignment();
                    }}
                    disabled={saveStatus === 'saving'}
                    className="btn-professional btn-save"
                  >
                    {saveStatus === 'saving' ? 'Saving...' : 'Save Table'}
                  </button>
                  <button
                    onClick={() => setShowGeneratedTableModal(true)}
                    className="btn-professional btn-primary"
                  >
                    View Generated Table
                  </button>
                </div>
              </div>
              {clos.length === 0 && (
                <p style={{ padding: '20px', color: '#7f8c8d' }}>Loading course outcomes...</p>
              )}
              {clos.length > 0 && (
                <>
                  <div className="table-wrapper">
                    <table className="ct-table">
                      <thead>
                        <tr>
                          <th rowSpan="3">CO No.</th>
                          <th rowSpan="2">Attendance Performance</th>
                          <th colSpan={getActiveAssignments().length * 3}>CO mapping of Assignment Marks</th>
                          <th rowSpan="3">CO Total</th>
                        </tr>
                        <tr>
                          {getActiveAssignments().map(assignment => (
                            <th key={assignment} colSpan="3">{assignment.replace('Assgn', 'Assignment ')}</th>
                          ))}
                        </tr>
                        <tr>
                          <th>
                            <input
                              type="number"
                              min={0}
                              value={attendanceMarks}
                              onChange={e => setAttendanceMarks(Number(e.target.value))}
                              style={{ width: '80px' }}
                            />
                          </th>
                          {getActiveAssignments().map((assignment) => (
                            <React.Fragment key={assignment}>
                              <th>Q1</th>
                              <th>Q2</th>
                              <th>Q3</th>
                            </React.Fragment>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {assignmentRows.map((row, idx) => (
                          <tr key={row.coNumber || idx}>
                            <td className="co-label">{row.coNumber || '-'}</td>
                            <td>-</td>
                            {getActiveAssignmentFields().map(field => (
                              <td key={field}>
                                <input
                                  type="number"
                                  min="0"
                                  value={row[field]}
                                  onChange={(e) => handleAssignmentCellChange(idx, field, e.target.value)}
                                  style={{ width: '80px' }}
                                />
                              </td>
                            ))}
                            <td className="co-total">{computeAssignmentCOTotal(row)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td className="footer-label" colSpan={2}>Assignment Total</td>
                          {(() => {
                            const assignmentTotals = assignmentColumnGroupTotals(); return (
                              <>
                                {getActiveAssignments().map(assignment => (
                                  <td key={assignment} colSpan={3} style={{ textAlign: 'center', fontWeight: 'bold' }}>
                                    {assignmentTotals[assignment] || 0}
                                  </td>
                                ))}
                              </>
                            );
                          })()}
                          <td>{assignmentRows.reduce((sum, r) => sum + computeAssignmentCOTotal(r), 0)}</td>
                        </tr>
                        <tr>
                          <td className="footer-label" colSpan={2}>Factor</td>
                          {getActiveAssignments().map(assignment => {
                            const autoFactor = calculateAutoAssignmentFactor();
                            return (
                              <td key={assignment} colSpan={3} style={{ textAlign: 'center' }}>
                                {formatNumber(autoFactor[assignment] || 0)}
                              </td>
                            );
                          })}
                          <td></td>
                        </tr>
                        <tr>
                          <td className="footer-label" colSpan={2}>Eq. Wt</td>
                          {getActiveAssignments().map(assignment => {
                            const autoEqWt = calculateAssignmentAutoEqWt();
                            return (
                              <td key={assignment} colSpan={3} style={{ textAlign: 'center' }}>
                                {formatNumber(autoEqWt[assignment] || 0)}
                              </td>
                            );
                          })}
                          <td><strong>{formatNumber(sumAssignmentEqWtTotal())}</strong></td>
                        </tr>
                        <tr>
                          <td className="footer-label" colSpan={2}>Manual Wt</td>
                          {getActiveAssignments().map(assignment => (
                            <td key={assignment} colSpan={3}>
                              <input
                                type="number"
                                step="0.01"
                                value={assignmentManualWts[assignment] ?? 0}
                                onChange={(e) => handleAssignmentManualWtChange(assignment, e.target.value)}
                                style={{ width: '80px' }}
                              />
                            </td>
                          ))}
                          <td><strong>{formatNumber(sumAssignmentManualWtTotal())}</strong></td>
                        </tr>
                        <tr>
                          <td className="footer-label" style={{ fontWeight: 'bold', color: '#2c3e50' }}>Status</td>
                          {(() => {
                            const manualTotal = sumAssignmentManualWtTotal();
                            const assignmentMarks = assignmentSummary.assignmentMarks30 || 0;
                            const useEqWt = assignmentSummary.useEqWt || 0;

                            let message = '';
                            let messageColor = '#27ae60'; // green for OK

                            if (manualTotal === assignmentMarks) {
                              message = 'OK';
                            } else {
                              if (useEqWt === 0) {
                                message = `Sum should be ${assignmentMarks}`;
                                messageColor = '#e74c3c'; // red for error
                              } else {
                                message = `Sum should be ${assignmentMarks}, you can ignore as Eq. wt=1`;
                                messageColor = '#138d75'; // orange for warning
                              }
                            }

                            return (
                              <td colSpan={1 + getActiveAssignments().length * 3 + 1} style={{ textAlign: 'center', fontWeight: 'bold', color: messageColor }}>
                                {message}
                              </td>
                            );
                          })()}
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  {/* 1st new table: summary below allocated marks */}
                  <div className="table-wrapper" style={{ marginTop: '20px' }}>
                    <table className="ct-table">
                      <tbody>
                        <tr>
                          <td style={{ backgroundColor: '#f8f9fa', fontWeight: 600 }}>Assign. Taken</td>
                          <td><input type="number" min={0} max={3} style={{ width: '80px' }} value={assignmentSummary.assignTaken} onChange={e => setAssignmentSummary(prev => ({ ...prev, assignTaken: Math.max(0, Math.min(3, Number(e.target.value) || 0)) }))} /></td>
                        </tr>
                        <tr>
                          <td style={{ backgroundColor: '#f8f9fa', fontWeight: 600 }}>Assignment Marks out of 30</td>
                          <td><input type="number" min={0} max={30} style={{ width: '80px' }} value={assignmentSummary.assignmentMarks30} onChange={e => setAssignmentSummary(prev => ({ ...prev, assignmentMarks30: Math.max(0, Math.min(30, Number(e.target.value) || 0)) }))} /></td>
                        </tr>
                        <tr>
                          <td style={{ backgroundColor: '#f8f9fa', fontWeight: 600 }}>Use Eq. Wt</td>
                          <td><input type="number" step="0.01" style={{ width: '80px' }} value={assignmentSummary.useEqWt} onChange={e => setAssignmentSummary(prev => ({ ...prev, useEqWt: Number(e.target.value) || 0 }))} /></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="action-buttons-container" style={{ marginTop: '10px', justifyContent: 'flex-end' }}>
                    {saveStatus && (
                      <div className={`save-status-badge ${saveStatus}`}>
                        {saveStatus === 'saving' && '💾 Saving...'}
                        {saveStatus === 'saved' && '✓ Saved'}
                        {saveStatus === 'error' && '✗ Error saving'}
                      </div>
                    )}
                    <button
                      onClick={handleManualSaveAssignment}
                      disabled={saveStatus === 'saving'}
                      className="btn-professional btn-save"
                    >
                      {saveStatus === 'saving' ? 'Saving...' : 'Save Summary'}
                    </button>
                  </div>

                  {/* 2nd new table: Obtained Marks for Attendance, Performance and Assignment */}
                  <section style={{ marginTop: '30px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
                      <h3 style={{ margin: 0 }}>Obtained Marks for Attendance, Performance and Assignment</h3>
                      <div className="action-buttons-container">
                        {saveStatus && (
                          <div className={`save-status-badge ${saveStatus}`}>
                            {saveStatus === 'saving' && '💾 Saving...'}
                            {saveStatus === 'saved' && '✓ Saved'}
                            {saveStatus === 'error' && '✗ Error saving'}
                          </div>
                        )}
                        <button
                          onClick={() => {
                            handleManualSaveAssignment();
                          }}
                          disabled={saveStatus === 'saving'}
                          className="btn-professional btn-save"
                        >
                          {saveStatus === 'saving' ? 'Saving...' : 'Save Table'}
                        </button>
                        <button
                          onClick={() => setShowObtainedGeneratedModal(true)}
                          className="btn-professional btn-primary"
                        >
                          View Generated Obtained Table
                        </button>
                      </div>
                    </div>
                    <div className="table-wrapper">
                      <table className="ct-obtained-table">
                        <thead>
                          <tr>
                            <th rowSpan={3}>Roll</th>
                            <th rowSpan={3}>Attendance Performance ({attendanceMarks})</th>
                            <th colSpan={getActiveAssignments().length * 3}>Assignment marks obtained out of {/* TODO: replace with total assignment marks variable */}30</th>
                            <th rowSpan={3}>Total (30)</th>
                          </tr>
                          <tr>
                            {getActiveAssignments().map((assignment, index) => {
                              const assignmentNumber = index + 1;
                              const totalMarks = attnAssignObtainedRows.reduce((sum, row) => {
                                const q1 = row[`${assignment}_Q1`] || 0;
                                const q2 = row[`${assignment}_Q2`] || 0;
                                const q3 = row[`${assignment}_Q3`] || 0;
                                return sum + q1 + q2 + q3;
                              }, 0);
                              return (
                                <th key={assignment} colSpan={3}>
                                  Assignment {assignmentNumber} ({totalMarks})
                                </th>
                              );
                            })}
                          </tr>
                          <tr>
                            {getActiveAssignments().map((assignment) => (
                              <React.Fragment key={assignment}>
                                <th>Q1</th>
                                <th>Q2</th>
                                <th>Q3</th>
                              </React.Fragment>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {attnAssignObtainedRows.length > 0 ? attnAssignObtainedRows.map((row, idx) => (
                            <tr key={`assign-${row.rollNumber}-${idx}`}>
                              <td>{row.rollNumber || '-'}</td>
                              <td>
                                <input
                                  type="number"
                                  min={0}
                                  value={row.attendance || 0}
                                  onChange={e => {
                                    const updatedRows = [...attnAssignObtainedRows];
                                    updatedRows[idx] = { ...row, attendance: Number(e.target.value) };
                                    setAttnAssignObtainedRows(updatedRows);
                                  }}
                                  style={{ width: '80px' }}
                                />
                              </td>
                              {getActiveAssignmentFields().map(field => (
                                <td key={field}>
                                  <input
                                    type="number"
                                    min={0}
                                    value={row[field] || 0}
                                    onChange={e => {
                                      const updatedRows = [...attnAssignObtainedRows];
                                      updatedRows[idx] = { ...row, [field]: Number(e.target.value) };
                                      setAttnAssignObtainedRows(updatedRows);
                                    }}
                                    style={{ width: '80px' }}
                                  />
                                </td>
                              ))}
                              <td>{
                                getActiveAssignmentFields().reduce((sum, field) => sum + (row[field] || 0), 0)
                              }</td>
                            </tr>
                          )) : (
                            <tr>
                              <td colSpan={2 + getActiveAssignments().length * 3 + 1} style={{ textAlign: 'center', color: '#7f8c8d', padding: '20px' }}>
                                <div style={{ marginBottom: '10px' }}>
                                  <strong>No students found for this course.</strong>
                                </div>
                                <div style={{ fontSize: '14px', lineHeight: '1.4' }}>
                                  To enter student marks, you need to:
                                  <br />• Ensure students are enrolled in this course, or
                                  <br />• Import student data from existing evaluation sheets
                                </div>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </>
              )}
            </section>
          )}
        </>
      )}

      {/* Show message if no data loaded yet */}
      {!attainmentData && !loading && selectedSheet && (
        <div className="attainment-empty" style={{ textAlign: 'center', padding: '40px' }}>
          Loading data for {selectedSheet}...
        </div>
      )}

      {/* Generated Table Modal */}
      {showGeneratedTableModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '16px',
            maxWidth: '90%',
            maxHeight: '90%',
            overflow: 'auto',
            position: 'relative'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3>
                {selectedSheet === 'CT'
                  ? 'Generated Table - CO mapping of Class Test Marks'
                  : selectedSheet === 'Attn_Assign'
                    ? 'Generated Table - CO mapping of Attendance and Assignment Marks'
                    : 'Generated Table'
                }
              </h3>
              <button
                onClick={() => setShowGeneratedTableModal(false)}
                style={{
                  padding: '4px 8px',
                  backgroundColor: '#e74c3c',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                ✕
              </button>
            </div>

            <div className="table-wrapper">
              <table className="ct-table">
                {selectedSheet === 'CT' ? (
                  <>
                    <thead>
                      <tr>
                        <th rowSpan="2">CO No.</th>
                        {getActiveCTs().map(ct => (
                          <th key={ct} colSpan="3">{ct}</th>
                        ))}
                        <th rowSpan="2">CO Total</th>
                      </tr>
                      <tr>
                        {getActiveCTs().map(ct => (
                          <React.Fragment key={`${ct}-questions`}>
                            <th>Q1</th><th>Q2</th><th>Q3</th>
                          </React.Fragment>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ctRows.map((row, idx) => (
                        <tr key={row.coNumber || idx}>
                          <td className="co-label">{row.coNumber || '-'}</td>
                          {getActiveCTFields().map(field => {
                            // Calculate factor * original value
                            const ctKey = field.replace(/(_Q[123])$/, ''); // Extract CT key (CT1, CT2, CT3)
                            const factor = calculateAutoFactor()[ctKey] || 0;
                            const originalValue = row[field] || 0;
                            const calculatedValue = factor * originalValue;

                            return (
                              <td key={field} style={{ textAlign: 'center' }}>
                                {formatNumber(calculatedValue)}
                              </td>
                            );
                          })}
                          <td className="co-total">
                            {formatNumber(getActiveCTFields().reduce((sum, field) => {
                              const ctKey = field.replace(/(_Q[123])$/, '');
                              const factor = calculateAutoFactor()[ctKey] || 0;
                              const originalValue = row[field] || 0;
                              return sum + (factor * originalValue);
                            }, 0))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td className="footer-label" style={{ fontWeight: 'bold' }}>Total</td>
                        <td colSpan={getActiveCTs().length * 3} style={{ textAlign: 'center' }}></td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                          {formatNumber(ctRows.reduce((totalSum, row) => {
                            return totalSum + getActiveCTFields().reduce((sum, field) => {
                              const ctKey = field.replace(/(_Q[123])$/, '');
                              const factor = calculateAutoFactor()[ctKey] || 0;
                              const originalValue = row[field] || 0;
                              return sum + (factor * originalValue);
                            }, 0);
                          }, 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </>
                ) : selectedSheet === 'Attn_Assign' ? (
                  <>
                    <thead>
                      <tr>
                        <th rowSpan="2">CO No.</th>
                        <th rowSpan="2">Attendance</th>
                        {getActiveAssignments().map(assignment => (
                          <th key={assignment} colSpan="3">{assignment.replace('Assgn', 'Assignment ')}</th>
                        ))}
                        <th rowSpan="2">CO Total</th>
                      </tr>
                      <tr>
                        {getActiveAssignments().map(assignment => (
                          <React.Fragment key={`${assignment}-questions`}>
                            <th>Q1</th><th>Q2</th><th>Q3</th>
                          </React.Fragment>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {assignmentRows.map((row, idx) => (
                        <tr key={row.coNumber || idx}>
                          <td className="co-label">{row.coNumber || '-'}</td>
                          <td style={{ textAlign: 'center' }}>-</td>
                          {getActiveAssignmentFields().map(field => {
                            // Calculate factor * original value
                            const assignmentKey = field.replace(/(_Q[123])$/, ''); // Extract assignment key (Assgn1, Assgn2, etc.)
                            const factor = calculateAutoAssignmentFactor()[assignmentKey] || 0;
                            const originalValue = row[field] || 0;
                            const calculatedValue = factor * originalValue;

                            return (
                              <td key={field} style={{ textAlign: 'center' }}>
                                {formatNumber(calculatedValue)}
                              </td>
                            );
                          })}
                          <td className="co-total">
                            {formatNumber(getActiveAssignmentFields().reduce((sum, field) => {
                              const assignmentKey = field.replace(/(_Q[123])$/, '');
                              const factor = calculateAutoAssignmentFactor()[assignmentKey] || 0;
                              const originalValue = row[field] || 0;
                              return sum + (factor * originalValue);
                            }, 0))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td className="footer-label" style={{ fontWeight: 'bold' }}>Total</td>
                        <td style={{ textAlign: 'center' }}></td>
                        <td colSpan={getActiveAssignments().length * 3} style={{ textAlign: 'center' }}></td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                          {formatNumber(assignmentRows.reduce((totalSum, row) => {
                            return totalSum + getActiveAssignmentFields().reduce((sum, field) => {
                              const assignmentKey = field.replace(/(_Q[123])$/, '');
                              const factor = calculateAutoAssignmentFactor()[assignmentKey] || 0;
                              const originalValue = row[field] || 0;
                              return sum + (factor * originalValue);
                            }, 0);
                          }, 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </>
                ) : null}
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Obtained Generated Table Modal */}
      {showObtainedGeneratedModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '16px',
            maxWidth: '90%',
            maxHeight: '90%',
            overflow: 'auto',
            position: 'relative'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  onClick={() => setObtainedModalView(prev => Math.max(0, prev - 1))}
                  disabled={obtainedModalView === 0}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: obtainedModalView === 0 ? '#ccc' : '#3498db',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: obtainedModalView === 0 ? 'not-allowed' : 'pointer',
                    fontSize: '14px'
                  }}
                >
                  ← Previous
                </button>
                <h3>
                  Generated Obtained Table - CO-wise Marks
                  {obtainedModalView === 0 ? '(Original)' : '(Factored)'}
                </h3>
                <button
                  onClick={() => setObtainedModalView(prev => Math.min(1, prev + 1))}
                  disabled={obtainedModalView === 1}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: obtainedModalView === 1 ? '#ccc' : '#3498db',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: obtainedModalView === 1 ? 'not-allowed' : 'pointer',
                    fontSize: '14px'
                  }}
                >
                  Next →
                </button>
              </div>
              <button
                onClick={() => {
                  setShowObtainedGeneratedModal(false);
                  setObtainedModalView(0);
                }}
                style={{
                  padding: '4px 8px',
                  backgroundColor: '#e74c3c',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                ✕
              </button>
            </div>

            <div className="table-wrapper">
              <table className="ct-obtained-table">
                {selectedSheet === 'CT' ? (
                  <>
                    <thead>
                      <tr>
                        <th>Roll</th>
                        {ctRows.map((row, idx) => {
                          const coKey = row.coNumber || `CO${idx + 1}`;
                          const coTotals = obtainedModalView === 0 ? calculateCOTotals() : calculateFactoredCOTotals();
                          const totalMarks = coTotals[coKey] || 0;
                          return (
                            <th key={`co-${idx}`}>
                              {row.coNumber}<br />
                              <small style={{ fontWeight: 'normal', color: '#666' }}>({formatNumber(totalMarks)})</small>
                            </th>
                          );
                        })}
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ctObtainedRows.map((studentRow, studentIdx) => (
                        <tr key={`ct-co-${studentRow.rollNumber}-${studentIdx}`}>
                          <td className="roll-cell" title={studentRow.name || studentRow.rollNumber}>
                            {studentRow.rollNumber || '-'}
                          </td>
                          {ctRows.map((coRow, coIdx) => {
                            // Calculate total marks for this CO across all CTs for this student
                            // Only count fields that are allocated to this CO (where coRow[field] > 0)
                            const coTotal = getActiveCTFields().reduce((sum, field) => {
                              const allocatedMarks = coRow[field] || 0;
                              if (allocatedMarks === 0) return sum; // Skip if no allocation for this field in this CO
                              const ctKey = field.replace(/(_Q[123])$/, '');
                              const factor = obtainedModalView === 0 ? 1 : (calculateAutoFactor()[ctKey] || 0);
                              const studentMark = studentRow[field] || 0;
                              return sum + (factor * studentMark);
                            }, 0);

                            return (
                              <td key={`co-${coIdx}-student-${studentIdx}`} style={{ textAlign: 'center' }}>
                                {formatNumber(coTotal)}
                              </td>
                            );
                          })}
                          <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                            {formatNumber(ctRows.reduce((total, coRow, coIdx) => {
                              const coTotal = getActiveCTFields().reduce((sum, field) => {
                                const allocatedMarks = coRow[field] || 0;
                                if (allocatedMarks === 0) return sum;
                                const ctKey = field.replace(/(_Q[123])$/, '');
                                const factor = obtainedModalView === 0 ? 1 : (calculateAutoFactor()[ctKey] || 0);
                                const studentMark = studentRow[field] || 0;
                                return sum + (factor * studentMark);
                              }, 0);
                              return total + coTotal;
                            }, 0))}
                          </td>
                        </tr>
                      ))}
                      {ctObtainedRows.length === 0 && (
                        <tr>
                          <td colSpan={ctRows.length + 2} style={{ textAlign: 'center', color: '#7f8c8d', padding: '20px' }}>
                            <div style={{ marginBottom: '10px' }}>
                              <strong>No students found for this course.</strong>
                            </div>
                            <div style={{ fontSize: '14px', lineHeight: '1.4' }}>
                              Sample students have been loaded for demonstration. In a real scenario:
                              <br />• Ensure students are enrolled in this course
                              <br />• Check that evaluation sheets contain student data
                              <br />• Verify course and sheet selection
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td style={{ fontWeight: 'bold' }}>Total</td>
                        {ctRows.map((coRow, coIdx) => {
                          const coGrandTotal = ctObtainedRows.reduce((sum, studentRow) => {
                            const coTotal = getActiveCTFields().reduce((coSum, field) => {
                              const allocatedMarks = coRow[field] || 0;
                              if (allocatedMarks === 0) return coSum;
                              const ctKey = field.replace(/(_Q[123])$/, '');
                              const factor = obtainedModalView === 0 ? 1 : (calculateAutoFactor()[ctKey] || 0);
                              const studentMark = studentRow[field] || 0;
                              return coSum + (factor * studentMark);
                            }, 0);
                            return sum + coTotal;
                          }, 0);

                          return (
                            <td key={`total-co-${coIdx}`} style={{ textAlign: 'center', fontWeight: 'bold' }}>
                              {formatNumber(coGrandTotal)}
                            </td>
                          );
                        })}
                        <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                          {formatNumber(ctRows.reduce((grandTotal, coRow, coIdx) => {
                            const coGrandTotal = ctObtainedRows.reduce((sum, studentRow) => {
                              const coTotal = getActiveCTFields().reduce((coSum, field) => {
                                const allocatedMarks = coRow[field] || 0;
                                if (allocatedMarks === 0) return coSum;
                                const ctKey = field.replace(/(_Q[123])$/, '');
                                const factor = obtainedModalView === 0 ? 1 : (calculateAutoFactor()[ctKey] || 0);
                                const studentMark = studentRow[field] || 0;
                                return coSum + (factor * studentMark);
                              }, 0);
                              return sum + coTotal;
                            }, 0);
                            return grandTotal + coGrandTotal;
                          }, 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </>
                ) : selectedSheet === 'Attn_Assign' ? (
                  <>
                    <thead>
                      <tr>
                        <th>Roll</th>
                        {assignmentRows.map((row, idx) => {
                          const coKey = row.coNumber || `CO${idx + 1}`;
                          const coTotals = obtainedModalView === 0 ? calculateAssignmentCOTotalsNoAttendance() : calculateFactoredAssignmentCOTotals();
                          const totalMarks = coTotals[coKey] || 0;
                          return (
                            <th key={`co-${idx}`}>
                              {row.coNumber}<br />
                              <small style={{ fontWeight: 'normal', color: '#666' }}>({formatNumber(totalMarks)})</small>
                            </th>
                          );
                        })}
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attnAssignObtainedRows.map((studentRow, studentIdx) => (
                        <tr key={`assign-co-${studentRow.rollNumber}-${studentIdx}`}>
                          <td className="roll-cell" title={studentRow.name || studentRow.rollNumber}>
                            {studentRow.rollNumber || '-'}
                          </td>
                          {assignmentRows.map((coRow, coIdx) => {
                            // Calculate total marks for this CO across all assignments for this student (exclude attendance)
                            // Only count fields that are allocated to this CO (where coRow[field] > 0)
                            const assignmentTotal = getActiveAssignmentFields().reduce((sum, field) => {
                              const allocatedMarks = coRow[field] || 0;
                              if (allocatedMarks === 0) return sum; // Skip if no allocation for this field in this CO
                              const assignmentKey = field.replace(/(_Q[123])$/, '');
                              const factor = obtainedModalView === 0 ? 1 : (calculateAutoAssignmentFactor()[assignmentKey] || 0);
                              const studentMark = studentRow[field] || 0;
                              return sum + (factor * studentMark);
                            }, 0);
                            const coTotal = assignmentTotal;

                            return (
                              <td key={`co-${coIdx}-student-${studentIdx}`} style={{ textAlign: 'center' }}>
                                {formatNumber(coTotal)}
                              </td>
                            );
                          })}
                          <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                            {formatNumber(assignmentRows.reduce((total, coRow, coIdx) => {
                              const assignmentTotal = getActiveAssignmentFields().reduce((sum, field) => {
                                const allocatedMarks = coRow[field] || 0;
                                if (allocatedMarks === 0) return sum; // Skip if no allocation for this field in this CO
                                const assignmentKey = field.replace(/(_Q[123])$/, '');
                                const factor = obtainedModalView === 0 ? 1 : (calculateAutoAssignmentFactor()[assignmentKey] || 0);
                                const studentMark = studentRow[field] || 0;
                                return sum + (factor * studentMark);
                              }, 0);
                              const coTotal = assignmentTotal;
                              return total + coTotal;
                            }, 0))}
                          </td>
                        </tr>
                      ))}
                      {attnAssignObtainedRows.length === 0 && (
                        <tr>
                          <td colSpan={assignmentRows.length + 2} style={{ textAlign: 'center', color: '#7f8c8d', padding: '20px' }}>
                            <div style={{ marginBottom: '10px' }}>
                              <strong>No students found for this course.</strong>
                            </div>
                            <div style={{ fontSize: '14px', lineHeight: '1.4' }}>
                              Sample students have been loaded for demonstration. In a real scenario:
                              <br />• Ensure students are enrolled in this course
                              <br />• Check that evaluation sheets contain student data
                              <br />• Verify course and sheet selection
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td style={{ fontWeight: 'bold' }}>Total</td>
                        {assignmentRows.map((coRow, coIdx) => {
                          const coGrandTotal = attnAssignObtainedRows.reduce((sum, studentRow) => {
                            const assignmentTotal = getActiveAssignmentFields().reduce((coSum, field) => {
                              const allocatedMarks = coRow[field] || 0;
                              if (allocatedMarks === 0) return coSum; // Skip if no allocation for this field in this CO
                              const assignmentKey = field.replace(/(_Q[123])$/, '');
                              const factor = obtainedModalView === 0 ? 1 : (calculateAutoAssignmentFactor()[assignmentKey] || 0);
                              const studentMark = studentRow[field] || 0;
                              return coSum + (factor * studentMark);
                            }, 0);
                            const coTotal = assignmentTotal;
                            return sum + coTotal;
                          }, 0);

                          return (
                            <td key={`total-co-${coIdx}`} style={{ textAlign: 'center', fontWeight: 'bold' }}>
                              {formatNumber(coGrandTotal)}
                            </td>
                          );
                        })}
                        <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                          {formatNumber(assignmentRows.reduce((grandTotal, coRow, coIdx) => {
                            const coGrandTotal = attnAssignObtainedRows.reduce((sum, studentRow) => {
                              const assignmentTotal = getActiveAssignmentFields().reduce((coSum, field) => {
                                const allocatedMarks = coRow[field] || 0;
                                if (allocatedMarks === 0) return coSum; // Skip if no allocation for this field in this CO
                                const assignmentKey = field.replace(/(_Q[123])$/, '');
                                const factor = obtainedModalView === 0 ? 1 : (calculateAutoAssignmentFactor()[assignmentKey] || 0);
                                const studentMark = studentRow[field] || 0;
                                return coSum + (factor * studentMark);
                              }, 0);
                              const coTotal = assignmentTotal;
                              return sum + coTotal;
                            }, 0);
                            return grandTotal + coGrandTotal;
                          }, 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </>
                ) : null}
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Section A Generated Table Modal */}
      {showSectionAGeneratedModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '16px',
            maxWidth: '90%',
            maxHeight: '90%',
            overflow: 'auto',
            position: 'relative'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3>Generated Table - Section A Possible Answer Combinations</h3>
              <button
                onClick={() => setShowSectionAGeneratedModal(false)}
                style={{
                  padding: '4px 8px',
                  backgroundColor: '#e74c3c',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                ✕
              </button>
            </div>

            <div className="table-wrapper">
              <table className="section-a-table">
                <thead>
                  <tr>
                    <th rowSpan="2">CO No.</th>
                    <th colSpan="15">Possible ans comb.</th>
                    <th rowSpan="2">CO msrd</th>
                    <th rowSpan="2">Unit V</th>
                    <th rowSpan="2">(1,2,3)</th>
                    <th rowSpan="2">(1,2,4)</th>
                    <th rowSpan="2">(1,3,4)</th>
                    <th rowSpan="2">(2,3,4)</th>
                  </tr>
                  <tr>
                    <th>1,2,3</th>
                    <th>1,2,4</th>
                    <th>1,3,4</th>
                    <th>2,3,4</th>
                    <th>1,2</th>
                    <th>1,3</th>
                    <th>1,4</th>
                    <th>2,3</th>
                    <th>2,4</th>
                    <th>3,4</th>
                    <th>1</th>
                    <th>2</th>
                    <th>3</th>
                    <th>4</th>
                    <th>None</th>
                  </tr>
                </thead>
                <tbody>
                  {sectionARows.map((row, idx) => (
                    <tr key={row.coNumber || idx}>
                      <td className="co-label">{row.coNumber || '-'}</td>
                      <td style={{ backgroundColor: '#f8f9fa' }}>
                        {getAutoGeneratedCombination(row, 'q123')}
                      </td>
                      <td style={{ backgroundColor: '#f8f9fa' }}>
                        {getAutoGeneratedCombination(row, 'q124')}
                      </td>
                      <td style={{ backgroundColor: '#f8f9fa' }}>
                        {getAutoGeneratedCombination(row, 'q134')}
                      </td>
                      <td style={{ backgroundColor: '#f8f9fa' }}>
                        {getAutoGeneratedCombination(row, 'q234')}
                      </td>
                      <td style={{ backgroundColor: '#f8f9fa' }}>
                        {getAutoGeneratedCombination(row, 'q12')}
                      </td>
                      <td style={{ backgroundColor: '#f8f9fa' }}>
                        {getAutoGeneratedCombination(row, 'q13')}
                      </td>
                      <td style={{ backgroundColor: '#f8f9fa' }}>
                        {getAutoGeneratedCombination(row, 'q14')}
                      </td>
                      <td style={{ backgroundColor: '#f8f9fa' }}>
                        {getAutoGeneratedCombination(row, 'q23')}
                      </td>
                      <td style={{ backgroundColor: '#f8f9fa' }}>
                        {getAutoGeneratedCombination(row, 'q24')}
                      </td>
                      <td style={{ backgroundColor: '#f8f9fa' }}>
                        {getAutoGeneratedCombination(row, 'q34')}
                      </td>
                      <td style={{ backgroundColor: '#f8f9fa' }}>
                        {getAutoGeneratedCombination(row, 'q1')}
                      </td>
                      <td style={{ backgroundColor: '#f8f9fa' }}>
                        {getAutoGeneratedCombination(row, 'q2')}
                      </td>
                      <td style={{ backgroundColor: '#f8f9fa' }}>
                        {getAutoGeneratedCombination(row, 'q3')}
                      </td>
                      <td style={{ backgroundColor: '#f8f9fa' }}>
                        {getAutoGeneratedCombination(row, 'q4')}
                      </td>
                      <td style={{ backgroundColor: '#f8f9fa' }}>
                        {getAutoGeneratedCombination(row, 'none')}
                      </td>
                      <td style={{ backgroundColor: '#f8f9fa', fontWeight: 'bold' }}>
                        {calculateSectionACOMsrd(row)}
                      </td>
                      <td style={{ backgroundColor: '#f8f9fa' }}>
                        {formatNumber(calculateUnitV(row))}
                      </td>
                      <td style={{ backgroundColor: '#fff3cd' }}>
                        {formatNumber(calculateCombinationRatio(row, 'q123'))}
                      </td>
                      <td style={{ backgroundColor: '#fff3cd' }}>
                        {formatNumber(calculateCombinationRatio(row, 'q124'))}
                      </td>
                      <td style={{ backgroundColor: '#fff3cd' }}>
                        {formatNumber(calculateCombinationRatio(row, 'q134'))}
                      </td>
                      <td style={{ backgroundColor: '#fff3cd' }}>
                        {formatNumber(calculateCombinationRatio(row, 'q234'))}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="footer-label">Total</td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                      {sectionARows.reduce((sum, row) => sum + getAutoGeneratedCombination(row, 'q123'), 0)}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                      {sectionARows.reduce((sum, row) => sum + getAutoGeneratedCombination(row, 'q124'), 0)}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                      {sectionARows.reduce((sum, row) => sum + getAutoGeneratedCombination(row, 'q134'), 0)}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                      {sectionARows.reduce((sum, row) => sum + getAutoGeneratedCombination(row, 'q234'), 0)}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                      {sectionARows.reduce((sum, row) => sum + getAutoGeneratedCombination(row, 'q12'), 0)}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                      {sectionARows.reduce((sum, row) => sum + getAutoGeneratedCombination(row, 'q13'), 0)}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                      {sectionARows.reduce((sum, row) => sum + getAutoGeneratedCombination(row, 'q14'), 0)}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                      {sectionARows.reduce((sum, row) => sum + getAutoGeneratedCombination(row, 'q23'), 0)}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                      {sectionARows.reduce((sum, row) => sum + getAutoGeneratedCombination(row, 'q24'), 0)}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                      {sectionARows.reduce((sum, row) => sum + getAutoGeneratedCombination(row, 'q34'), 0)}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                      {sectionARows.reduce((sum, row) => sum + getAutoGeneratedCombination(row, 'q1'), 0)}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                      {sectionARows.reduce((sum, row) => sum + getAutoGeneratedCombination(row, 'q2'), 0)}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                      {sectionARows.reduce((sum, row) => sum + getAutoGeneratedCombination(row, 'q3'), 0)}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                      {sectionARows.reduce((sum, row) => sum + getAutoGeneratedCombination(row, 'q4'), 0)}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                      {sectionARows.reduce((sum, row) => sum + getAutoGeneratedCombination(row, 'none'), 0)}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#f8f9fa' }}>
                      {calculateTotalCOMsrd()}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#f8f9fa' }}>
                      {formatNumber(sectionARows.reduce((sum, row) => sum + calculateUnitV(row), 0))}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#fff3cd' }}>
                      {formatNumber(sectionARows.reduce((sum, row) => sum + calculateCombinationRatio(row, 'q123'), 0))}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#fff3cd' }}>
                      {formatNumber(sectionARows.reduce((sum, row) => sum + calculateCombinationRatio(row, 'q124'), 0))}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#fff3cd' }}>
                      {formatNumber(sectionARows.reduce((sum, row) => sum + calculateCombinationRatio(row, 'q134'), 0))}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#fff3cd' }}>
                      {formatNumber(sectionARows.reduce((sum, row) => sum + calculateCombinationRatio(row, 'q234'), 0))}
                    </td>
                  </tr>
                  <tr>
                    <td colSpan="16" style={{ textAlign: 'center', border: 'none' }}></td>
                    <td className="footer-label" colSpan="2" style={{ textAlign: 'center' }}>StDev</td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#e3f2fd' }}>
                      {formatNumber(calculateStDevP('q123'))}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#e3f2fd' }}>
                      {formatNumber(calculateStDevP('q124'))}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#e3f2fd' }}>
                      {formatNumber(calculateStDevP('q134'))}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#e3f2fd' }}>
                      {formatNumber(calculateStDevP('q234'))}
                    </td>
                  </tr>
                  <tr style={{ borderTop: 'none' }}>
                    <td colSpan="16" style={{ textAlign: 'center', border: 'none' }}></td>
                    <td className="footer-label" colSpan="2" style={{ textAlign: 'center', borderTop: 'none' }}>Dist</td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#e3f2fd', borderTop: 'none' }}>
                      {formatNumber(Math.sqrt(calculateDist('q123')))}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#e3f2fd', borderTop: 'none' }}>
                      {formatNumber(Math.sqrt(calculateDist('q124')))}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#e3f2fd', borderTop: 'none' }}>
                      {formatNumber(Math.sqrt(calculateDist('q134')))}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#e3f2fd', borderTop: 'none' }}>
                      {formatNumber(Math.sqrt(calculateDist('q234')))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Section A Obtained Generated Table Modal */}
      {showSectionAObtainedModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '16px',
            maxWidth: '90%',
            maxHeight: '90%',
            overflow: 'auto',
            position: 'relative'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3>Generated Table - Student Analysis</h3>
              <button
                onClick={() => setShowSectionAObtainedModal(false)}
                style={{
                  padding: '4px 8px',
                  backgroundColor: '#e74c3c',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                ✕
              </button>
            </div>

            <div className="table-wrapper">
              <table className="section-a-table">
                <thead>
                  <tr>
                    <th rowSpan="2">Roll</th>
                    <th colSpan={sectionARows.length}>Total Marks Obtained Per CO</th>
                    <th colSpan="4">Q No.</th>
                    <th rowSpan="2">Zero Count</th>
                    <th rowSpan="2">Ans Combination</th>
                    <th colSpan={sectionARows.length}>CO Marks Distribution Per Student</th>
                    <th rowSpan="2">Total</th>
                  </tr>
                  <tr>
                    {sectionARows.map((row, idx) => (
                      <th key={`co-header-${idx}`}>{row.coNumber}</th>
                    ))}
                    <th>1</th>
                    <th>2</th>
                    <th>3</th>
                    <th>4</th>
                    {sectionARows.map((row, idx) => (
                      <th key={`co-dist-header-${idx}`}>{row.coNumber}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sectionAObtainedRows.length > 0 ? sectionAObtainedRows.map((studentRow, idx) => (
                    <tr key={`sectA-co-${studentRow.rollNumber}-${idx}`}>
                      <td className="roll-cell" title={studentRow.name || studentRow.rollNumber}>
                        {studentRow.rollNumber || '-'}
                      </td>
                      {/* Total Marks Obtained Per CO */}
                      {sectionARows.map((coRow, coIdx) => (
                        <td key={`co-total-${coIdx}`} style={{ textAlign: 'center', backgroundColor: '#f8f9fa' }}>
                          {formatNumber(getStudentCOTotal(studentRow, coRow.coNumber))}
                        </td>
                      ))}
                      {/* Q No. (marks for each question) */}
                      <td style={{ textAlign: 'center', backgroundColor: '#e3f2fd' }}>
                        {formatNumber(getStudentQuestionTotal(studentRow, 1))}
                      </td>
                      <td style={{ textAlign: 'center', backgroundColor: '#e3f2fd' }}>
                        {formatNumber(getStudentQuestionTotal(studentRow, 2))}
                      </td>
                      <td style={{ textAlign: 'center', backgroundColor: '#e3f2fd' }}>
                        {formatNumber(getStudentQuestionTotal(studentRow, 3))}
                      </td>
                      <td style={{ textAlign: 'center', backgroundColor: '#e3f2fd' }}>
                        {formatNumber(getStudentQuestionTotal(studentRow, 4))}
                      </td>
                      {/* Zero Count */}
                      <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#fff3cd' }}>
                        {getStudentZeroCount(studentRow)}
                      </td>
                      {/* Ans Combination */}
                      <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#d4edda' }}>
                        {getStudentAnswerCombination(studentRow)}
                      </td>
                      {/* CO Marks Distribution Per Student */}
                      {sectionARows.map((coRow, coIdx) => (
                        <td key={`co-dist-${coIdx}`} style={{ textAlign: 'center', backgroundColor: '#f8f9fa' }}>
                          {formatNumber(getStudentCODistribution(studentRow, coRow.coNumber))}
                        </td>
                      ))}
                      {/* Total */}
                      <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#fff' }}>
                        {formatNumber(sectionARows.reduce((sum, coRow) => sum + getStudentCODistribution(studentRow, coRow.coNumber), 0))}
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={3 + sectionARows.length * 2 + 6} style={{ textAlign: 'center', padding: '20px', color: '#7f8c8d' }}>
                        No student data available. Please ensure obtained marks are entered.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Section B Generated Table Modal */}
      {showSectionBGeneratedModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '16px',
            maxWidth: '90%',
            maxHeight: '90%',
            overflow: 'auto',
            position: 'relative'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3>Generated Table - Section B Possible Answer Combinations</h3>
              <button
                onClick={() => setShowSectionBGeneratedModal(false)}
                style={{
                  padding: '4px 8px',
                  backgroundColor: '#e74c3c',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                ✕
              </button>
            </div>

            <div className="table-wrapper">
              <table className="section-a-table">
                <thead>
                  <tr>
                    <th rowSpan="2">CO No.</th>
                    <th colSpan="15">Possible ans comb.</th>
                    <th rowSpan="2">CO msrd</th>
                    <th rowSpan="2">Unit V</th>
                    <th rowSpan="2">(5,6,7)</th>
                    <th rowSpan="2">(5,6,8)</th>
                    <th rowSpan="2">(5,7,8)</th>
                    <th rowSpan="2">(6,7,8)</th>
                  </tr>
                  <tr>
                    <th>5,6,7</th>
                    <th>5,6,8</th>
                    <th>5,7,8</th>
                    <th>6,7,8</th>
                    <th>5,6</th>
                    <th>5,7</th>
                    <th>5,8</th>
                    <th>6,7</th>
                    <th>6,8</th>
                    <th>7,8</th>
                    <th>5</th>
                    <th>6</th>
                    <th>7</th>
                    <th>8</th>
                    <th>None</th>
                  </tr>
                </thead>
                <tbody>
                  {sectionBRows.map((row, idx) => (
                    <tr key={row.coNumber || idx}>
                      <td className="co-label">{row.coNumber || '-'}</td>
                      <td style={{ backgroundColor: '#f8f9fa' }}>
                        {getAutoGeneratedCombinationB(row, 'q123')}
                      </td>
                      <td style={{ backgroundColor: '#f8f9fa' }}>
                        {getAutoGeneratedCombinationB(row, 'q124')}
                      </td>
                      <td style={{ backgroundColor: '#f8f9fa' }}>
                        {getAutoGeneratedCombinationB(row, 'q134')}
                      </td>
                      <td style={{ backgroundColor: '#f8f9fa' }}>
                        {getAutoGeneratedCombinationB(row, 'q234')}
                      </td>
                      <td style={{ backgroundColor: '#f8f9fa' }}>
                        {getAutoGeneratedCombinationB(row, 'q12')}
                      </td>
                      <td style={{ backgroundColor: '#f8f9fa' }}>
                        {getAutoGeneratedCombinationB(row, 'q13')}
                      </td>
                      <td style={{ backgroundColor: '#f8f9fa' }}>
                        {getAutoGeneratedCombinationB(row, 'q14')}
                      </td>
                      <td style={{ backgroundColor: '#f8f9fa' }}>
                        {getAutoGeneratedCombinationB(row, 'q23')}
                      </td>
                      <td style={{ backgroundColor: '#f8f9fa' }}>
                        {getAutoGeneratedCombinationB(row, 'q24')}
                      </td>
                      <td style={{ backgroundColor: '#f8f9fa' }}>
                        {getAutoGeneratedCombinationB(row, 'q34')}
                      </td>
                      <td style={{ backgroundColor: '#f8f9fa' }}>
                        {getAutoGeneratedCombinationB(row, 'q1')}
                      </td>
                      <td style={{ backgroundColor: '#f8f9fa' }}>
                        {getAutoGeneratedCombinationB(row, 'q2')}
                      </td>
                      <td style={{ backgroundColor: '#f8f9fa' }}>
                        {getAutoGeneratedCombinationB(row, 'q3')}
                      </td>
                      <td style={{ backgroundColor: '#f8f9fa' }}>
                        {getAutoGeneratedCombinationB(row, 'q4')}
                      </td>
                      <td style={{ backgroundColor: '#f8f9fa' }}>
                        {getAutoGeneratedCombinationB(row, 'none')}
                      </td>
                      <td style={{ backgroundColor: '#f8f9fa', fontWeight: 'bold' }}>
                        {calculateSectionBCOMsrd(row)}
                      </td>
                      <td style={{ backgroundColor: '#f8f9fa' }}>
                        {formatNumber(calculateUnitVB(row))}
                      </td>
                      <td style={{ backgroundColor: '#fff3cd' }}>
                        {formatNumber(calculateCombinationRatioB(row, 'q123'))}
                      </td>
                      <td style={{ backgroundColor: '#fff3cd' }}>
                        {formatNumber(calculateCombinationRatioB(row, 'q124'))}
                      </td>
                      <td style={{ backgroundColor: '#fff3cd' }}>
                        {formatNumber(calculateCombinationRatioB(row, 'q134'))}
                      </td>
                      <td style={{ backgroundColor: '#fff3cd' }}>
                        {formatNumber(calculateCombinationRatioB(row, 'q234'))}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="footer-label">Total</td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                      {sectionBRows.reduce((sum, row) => sum + getAutoGeneratedCombinationB(row, 'q123'), 0)}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                      {sectionBRows.reduce((sum, row) => sum + getAutoGeneratedCombinationB(row, 'q124'), 0)}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                      {sectionBRows.reduce((sum, row) => sum + getAutoGeneratedCombinationB(row, 'q134'), 0)}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                      {sectionBRows.reduce((sum, row) => sum + getAutoGeneratedCombinationB(row, 'q234'), 0)}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                      {sectionBRows.reduce((sum, row) => sum + getAutoGeneratedCombinationB(row, 'q12'), 0)}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                      {sectionBRows.reduce((sum, row) => sum + getAutoGeneratedCombinationB(row, 'q13'), 0)}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                      {sectionBRows.reduce((sum, row) => sum + getAutoGeneratedCombinationB(row, 'q14'), 0)}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                      {sectionBRows.reduce((sum, row) => sum + getAutoGeneratedCombinationB(row, 'q23'), 0)}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                      {sectionBRows.reduce((sum, row) => sum + getAutoGeneratedCombinationB(row, 'q24'), 0)}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                      {sectionBRows.reduce((sum, row) => sum + getAutoGeneratedCombinationB(row, 'q34'), 0)}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                      {sectionBRows.reduce((sum, row) => sum + getAutoGeneratedCombinationB(row, 'q1'), 0)}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                      {sectionBRows.reduce((sum, row) => sum + getAutoGeneratedCombinationB(row, 'q2'), 0)}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                      {sectionBRows.reduce((sum, row) => sum + getAutoGeneratedCombinationB(row, 'q3'), 0)}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                      {sectionBRows.reduce((sum, row) => sum + getAutoGeneratedCombinationB(row, 'q4'), 0)}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                      {sectionBRows.reduce((sum, row) => sum + getAutoGeneratedCombinationB(row, 'none'), 0)}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#f8f9fa' }}>
                      {calculateTotalCOMsrdB()}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#f8f9fa' }}>
                      {formatNumber(sectionBRows.reduce((sum, row) => sum + calculateUnitVB(row), 0))}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#fff3cd' }}>
                      {formatNumber(sectionBRows.reduce((sum, row) => sum + calculateCombinationRatioB(row, 'q123'), 0))}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#fff3cd' }}>
                      {formatNumber(sectionBRows.reduce((sum, row) => sum + calculateCombinationRatioB(row, 'q124'), 0))}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#fff3cd' }}>
                      {formatNumber(sectionBRows.reduce((sum, row) => sum + calculateCombinationRatioB(row, 'q134'), 0))}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#fff3cd' }}>
                      {formatNumber(sectionBRows.reduce((sum, row) => sum + calculateCombinationRatioB(row, 'q234'), 0))}
                    </td>
                  </tr>
                  <tr>
                    <td colSpan="16" style={{ textAlign: 'center', border: 'none' }}></td>
                    <td className="footer-label" colSpan="2" style={{ textAlign: 'center' }}>StDev</td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#e3f2fd' }}>
                      {formatNumber(calculateStDevPB('q123'))}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#e3f2fd' }}>
                      {formatNumber(calculateStDevPB('q124'))}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#e3f2fd' }}>
                      {formatNumber(calculateStDevPB('q134'))}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#e3f2fd' }}>
                      {formatNumber(calculateStDevPB('q234'))}
                    </td>
                  </tr>
                  <tr style={{ borderTop: 'none' }}>
                    <td colSpan="16" style={{ textAlign: 'center', border: 'none' }}></td>
                    <td className="footer-label" colSpan="2" style={{ textAlign: 'center', borderTop: 'none' }}>Dist</td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#e3f2fd', borderTop: 'none' }}>
                      {formatNumber(Math.sqrt(calculateDistB('q123')))}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#e3f2fd', borderTop: 'none' }}>
                      {formatNumber(Math.sqrt(calculateDistB('q124')))}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#e3f2fd', borderTop: 'none' }}>
                      {formatNumber(Math.sqrt(calculateDistB('q134')))}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#e3f2fd', borderTop: 'none' }}>
                      {formatNumber(Math.sqrt(calculateDistB('q234')))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Section B Obtained Generated Table Modal */}
      {showSectionBObtainedModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '16px',
            maxWidth: '90%',
            maxHeight: '90%',
            overflow: 'auto',
            position: 'relative'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3>Generated Table - Student Analysis (Section B)</h3>
              <button
                onClick={() => setShowSectionBObtainedModal(false)}
                style={{
                  padding: '4px 8px',
                  backgroundColor: '#e74c3c',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                ✕
              </button>
            </div>

            <div className="table-wrapper">
              <table className="section-a-table">
                <thead>
                  <tr>
                    <th rowSpan="2">Roll</th>
                    <th colSpan={sectionBRows.length}>Total Marks Obtained Per CO</th>
                    <th colSpan="4">Q No.</th>
                    <th rowSpan="2">Zero Count</th>
                    <th rowSpan="2">Ans Combination</th>
                    <th colSpan={sectionBRows.length}>CO Marks Distribution Per Student</th>
                    <th rowSpan="2">Total</th>
                  </tr>
                  <tr>
                    {sectionBRows.map((row, idx) => (
                      <th key={`co-header-${idx}`}>{row.coNumber}</th>
                    ))}
                    <th>5</th>
                    <th>6</th>
                    <th>7</th>
                    <th>8</th>
                    {sectionBRows.map((row, idx) => (
                      <th key={`co-dist-header-${idx}`}>{row.coNumber}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sectionBObtainedRows.length > 0 ? sectionBObtainedRows.map((studentRow, idx) => (
                    <tr key={`sectB-co-${studentRow.rollNumber}-${idx}`}>
                      <td className="roll-cell" title={studentRow.name || studentRow.rollNumber}>
                        {studentRow.rollNumber || '-'}
                      </td>
                      {/* Total Marks Obtained Per CO */}
                      {sectionBRows.map((coRow, coIdx) => (
                        <td key={`co-total-${coIdx}`} style={{ textAlign: 'center', backgroundColor: '#f8f9fa' }}>
                          {formatNumber(getStudentCOTotalB(studentRow, coRow.coNumber))}
                        </td>
                      ))}
                      {/* Q No. (marks for each question) */}
                      <td style={{ textAlign: 'center', backgroundColor: '#e3f2fd' }}>
                        {formatNumber(getStudentQuestionTotalB(studentRow, 1))}
                      </td>
                      <td style={{ textAlign: 'center', backgroundColor: '#e3f2fd' }}>
                        {formatNumber(getStudentQuestionTotalB(studentRow, 2))}
                      </td>
                      <td style={{ textAlign: 'center', backgroundColor: '#e3f2fd' }}>
                        {formatNumber(getStudentQuestionTotalB(studentRow, 3))}
                      </td>
                      <td style={{ textAlign: 'center', backgroundColor: '#e3f2fd' }}>
                        {formatNumber(getStudentQuestionTotalB(studentRow, 4))}
                      </td>
                      {/* Zero Count */}
                      <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#fff3cd' }}>
                        {getStudentZeroCountB(studentRow)}
                      </td>
                      {/* Ans Combination */}
                      <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#d4edda' }}>
                        {getStudentAnswerCombinationB(studentRow)}
                      </td>
                      {/* CO Marks Distribution Per Student */}
                      {sectionBRows.map((coRow, coIdx) => (
                        <td key={`co-dist-${coIdx}`} style={{ textAlign: 'center', backgroundColor: '#f8f9fa' }}>
                          {formatNumber(getStudentCODistributionB(studentRow, coRow.coNumber))}
                        </td>
                      ))}
                      {/* Total */}
                      <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#fff' }}>
                        {formatNumber(sectionBRows.reduce((sum, coRow) => sum + getStudentCODistributionB(studentRow, coRow.coNumber), 0))}
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={3 + sectionBRows.length * 2 + 6} style={{ textAlign: 'center', padding: '20px', color: '#7f8c8d' }}>
                        No student data available. Please ensure obtained marks are entered.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* LabActivity Generated Table Modal */}
      {showLabActivityGeneratedModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '16px',
            maxWidth: '90%',
            maxHeight: '90%',
            overflow: 'auto',
            position: 'relative'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3>Generated Table - Lab Activity</h3>
              <button
                onClick={() => setShowLabActivityGeneratedModal(false)}
                style={{
                  padding: '4px 8px',
                  backgroundColor: '#e74c3c',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                ✕
              </button>
            </div>

            {/* Tab Navigation */}
            <div style={{ display: 'flex', marginBottom: '20px', borderBottom: '2px solid #e0e0e0' }}>
              <button
                onClick={() => setLabActivityGeneratedView(0)}
                style={{
                  padding: '12px 24px',
                  backgroundColor: 'transparent',
                  color: labActivityGeneratedView === 0 ? '#2c3e50' : '#7f8c8d',
                  border: 'none',
                  borderBottom: labActivityGeneratedView === 0 ? '3px solid #3498db' : '3px solid transparent',
                  cursor: 'pointer',
                  fontWeight: labActivityGeneratedView === 0 ? '600' : 'normal',
                  fontSize: '14px',
                  transition: 'all 0.2s ease',
                  marginBottom: '-2px'
                }}
                onMouseEnter={(e) => {
                  if (labActivityGeneratedView !== 0) {
                    e.target.style.color = '#2c3e50';
                    e.target.style.borderBottom = '3px solid #bdc3c7';
                  }
                }}
                onMouseLeave={(e) => {
                  if (labActivityGeneratedView !== 0) {
                    e.target.style.color = '#7f8c8d';
                    e.target.style.borderBottom = '3px solid transparent';
                  }
                }}
              >
                CO Mapping of Lab Activity Marks
              </button>
              <button
                onClick={() => setLabActivityGeneratedView(1)}
                style={{
                  padding: '12px 24px',
                  backgroundColor: 'transparent',
                  color: labActivityGeneratedView === 1 ? '#2c3e50' : '#7f8c8d',
                  border: 'none',
                  borderBottom: labActivityGeneratedView === 1 ? '3px solid #3498db' : '3px solid transparent',
                  cursor: 'pointer',
                  fontWeight: labActivityGeneratedView === 1 ? '600' : 'normal',
                  fontSize: '14px',
                  transition: 'all 0.2s ease',
                  marginBottom: '-2px'
                }}
                onMouseEnter={(e) => {
                  if (labActivityGeneratedView !== 1) {
                    e.target.style.color = '#2c3e50';
                    e.target.style.borderBottom = '3px solid #bdc3c7';
                  }
                }}
                onMouseLeave={(e) => {
                  if (labActivityGeneratedView !== 1) {
                    e.target.style.color = '#7f8c8d';
                    e.target.style.borderBottom = '3px solid transparent';
                  }
                }}
              >
                CO wise multiplication factor
              </button>
            </div>

            {/* Table 1: CO Mapping of Lab Activity Marks */}
            {labActivityGeneratedView === 0 && (
              <div className="table-wrapper">
                <h4 style={{ marginBottom: '15px' }}>CO Mapping of Lab Activity Marks out of {coMappedActivityMarks}</h4>
                <table className="ct-table">
                  <thead>
                    <tr>
                      <th rowSpan="2">CO No.</th>
                      {Array.from({ length: activityTaken || 5 }, (_, i) => (
                        <th key={`activity-${i + 1}`} colSpan="3">Activity{i + 1}</th>
                      ))}
                      <th rowSpan="2">CO Total</th>
                    </tr>
                    <tr>
                      {Array.from({ length: activityTaken || 5 }, (_, i) => (
                        <React.Fragment key={`qs-${i + 1}`}>
                          <th>Q1</th>
                          <th>Q2</th>
                          <th>Q3</th>
                        </React.Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {labActivityRows.map((row, idx) => (
                      <tr key={idx}>
                        <td className="co-label">{row.coNumber}</td>
                        {Array.from({ length: activityTaken || 5 }, (_, activityIndex) => {
                          const activityNum = activityIndex + 1;
                          const eqWt = (coMappedActivityMarks || 0) / (activityTaken || 1);

                          return (
                            <React.Fragment key={`activity-${activityNum}`}>
                              <td style={{ textAlign: 'center' }}>
                                {formatNumber((row[`Activity${activityNum}_Q1`] || 0) !== 0 ? eqWt : 0)}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                {formatNumber((row[`Activity${activityNum}_Q2`] || 0) !== 0 ? eqWt : 0)}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                {formatNumber((row[`Activity${activityNum}_Q3`] || 0) !== 0 ? eqWt : 0)}
                              </td>
                            </React.Fragment>
                          );
                        })}
                        <td style={{ textAlign: 'center', fontWeight: '600' }}>
                          {(() => {
                            let total = 0;
                            const eqWt = (coMappedActivityMarks || 0) / (activityTaken || 1);
                            Array.from({ length: activityTaken || 5 }, (_, activityIndex) => {
                              const activityNum = activityIndex + 1;
                              if ((row[`Activity${activityNum}_Q1`] || 0) !== 0) total += eqWt;
                              if ((row[`Activity${activityNum}_Q2`] || 0) !== 0) total += eqWt;
                              if ((row[`Activity${activityNum}_Q3`] || 0) !== 0) total += eqWt;
                              return null;
                            });
                            return formatNumber(total);
                          })()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Table 2: CO wise multiplication factor */}
            {labActivityGeneratedView === 1 && (
              <div className="table-wrapper">
                <h4 style={{ marginBottom: '15px' }}>CO wise multiplication factor out of {coMappedActivityMarks}</h4>
                <table className="ct-table">
                  <thead>
                    <tr>
                      <th rowSpan="2">CO No.</th>
                      {Array.from({ length: activityTaken || 5 }, (_, i) => (
                        <th key={`activity-${i + 1}`} colSpan="3">Activity{i + 1}</th>
                      ))}
                    </tr>
                    <tr>
                      {Array.from({ length: activityTaken || 5 }, (_, i) => (
                        <React.Fragment key={`qs-${i + 1}`}>
                          <th>Q1</th>
                          <th>Q2</th>
                          <th>Q3</th>
                        </React.Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {labActivityRows.map((row, idx) => (
                      <tr key={idx}>
                        <td className="co-label">{row.coNumber}</td>
                        {Array.from({ length: activityTaken || 5 }, (_, activityIndex) => {
                          const activityNum = activityIndex + 1;
                          const activityKey = `activity${activityNum}`;
                          const totals = labActivityActivityTotals();
                          const activityTotal = totals[activityKey] || 0;

                          // Calculate the Factor for this activity
                          let calculatedFactor = 0;
                          try {
                            if (activityTotal === 0) {
                              calculatedFactor = 0;
                            } else if (useEqWtActivity) {
                              const eqWtValue = activityTotal > 0
                                ? (coMappedActivityMarks || 0) / (activityTaken || 1)
                                : 0;
                              calculatedFactor = eqWtValue / activityTotal;
                            } else {
                              const manualWtValue = labActivityManualWts[activityKey] || 0;
                              calculatedFactor = manualWtValue / activityTotal;
                            }
                          } catch (error) {
                            calculatedFactor = 0;
                          }

                          return (
                            <React.Fragment key={`activity-${activityNum}`}>
                              <td style={{ textAlign: 'center' }}>
                                {formatNumber((row[`Activity${activityNum}_Q1`] || 0) !== 0 ? calculatedFactor : 0)}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                {formatNumber((row[`Activity${activityNum}_Q2`] || 0) !== 0 ? calculatedFactor : 0)}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                {formatNumber((row[`Activity${activityNum}_Q3`] || 0) !== 0 ? calculatedFactor : 0)}
                              </td>
                            </React.Fragment>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* LabActivity Obtained Marks Generated Modal */}
      {showLabActivityObtainedModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '16px',
            maxWidth: '95%',
            maxHeight: '90%',
            overflow: 'auto',
            position: 'relative'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3>Generated Table - Lab Activity Obtained Marks</h3>
              <button
                onClick={() => setShowLabActivityObtainedModal(false)}
                style={{
                  padding: '4px 8px',
                  backgroundColor: '#e74c3c',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                ✕
              </button>
            </div>

            {/* Tab Navigation */}
            <div style={{ display: 'flex', marginBottom: '20px', borderBottom: '2px solid #e0e0e0' }}>
              <button
                onClick={() => setLabActivityObtainedView(0)}
                style={{
                  padding: '12px 24px',
                  backgroundColor: 'transparent',
                  color: labActivityObtainedView === 0 ? '#2c3e50' : '#7f8c8d',
                  border: 'none',
                  borderBottom: labActivityObtainedView === 0 ? '3px solid #3498db' : '3px solid transparent',
                  cursor: 'pointer',
                  fontWeight: labActivityObtainedView === 0 ? '600' : 'normal',
                  fontSize: '14px',
                  transition: 'all 0.2s ease',
                  marginBottom: '-2px'
                }}
                onMouseEnter={(e) => {
                  if (labActivityObtainedView !== 0) {
                    e.target.style.color = '#2c3e50';
                    e.target.style.borderBottom = '3px solid #bdc3c7';
                  }
                }}
                onMouseLeave={(e) => {
                  if (labActivityObtainedView !== 0) {
                    e.target.style.color = '#7f8c8d';
                    e.target.style.borderBottom = '3px solid transparent';
                  }
                }}
              >
                CO wise obtained marks
              </button>
              <button
                onClick={() => setLabActivityObtainedView(1)}
                style={{
                  padding: '12px 24px',
                  backgroundColor: 'transparent',
                  color: labActivityObtainedView === 1 ? '#2c3e50' : '#7f8c8d',
                  border: 'none',
                  borderBottom: labActivityObtainedView === 1 ? '3px solid #3498db' : '3px solid transparent',
                  cursor: 'pointer',
                  fontWeight: labActivityObtainedView === 1 ? '600' : 'normal',
                  fontSize: '14px',
                  transition: 'all 0.2s ease',
                  marginBottom: '-2px'
                }}
                onMouseEnter={(e) => {
                  if (labActivityObtainedView !== 1) {
                    e.target.style.color = '#2c3e50';
                    e.target.style.borderBottom = '3px solid #bdc3c7';
                  }
                }}
                onMouseLeave={(e) => {
                  if (labActivityObtainedView !== 1) {
                    e.target.style.color = '#7f8c8d';
                    e.target.style.borderBottom = '3px solid transparent';
                  }
                }}
              >
                CO attainment
              </button>
            </div>

            {/* Table 1: CO wise obtained marks */}
            {labActivityObtainedView === 0 && (
              <div className="table-wrapper">
                <table className="section-a-table">
                  <thead>
                    <tr>
                      <th rowSpan="3">Roll</th>
                      <th colSpan={labActivityRows.length}>CO wise obtained marks out of {(() => {
                        // Calculate total CO marks from allocated table
                        let total = 0;
                        labActivityRows.forEach(row => {
                          total += computeLabActivityCOTotal(row);
                        });
                        return formatNumber(total);
                      })()}</th>
                      <th colSpan={labActivityRows.length}>CO wise obtained marks out of {coMappedActivityMarks}</th>
                    </tr>
                    <tr>
                      {/* First set of CO columns */}
                      {labActivityRows.map((row, idx) => (
                        <th key={`co1-${idx}`}>{row.coNumber}</th>
                      ))}
                      {/* Second set of CO columns */}
                      {labActivityRows.map((row, idx) => (
                        <th key={`co2-${idx}`}>{row.coNumber}</th>
                      ))}
                    </tr>
                    <tr>
                      {/* Total allocated marks for each CO - first set */}
                      {labActivityRows.map((row, idx) => (
                        <th key={`co1-total-${idx}`} style={{ fontSize: '13px', fontWeight: '600', backgroundColor: '#e8f4f8', color: '#2c3e50', padding: '8px' }}>
                          out of {formatNumber(computeLabActivityCOTotal(row))}
                        </th>
                      ))}
                      {/* Total allocated marks for each CO - second set */}
                      {labActivityRows.map((row, idx) => (
                        <th key={`co2-total-${idx}`} style={{ fontSize: '13px', fontWeight: '600', backgroundColor: '#e8f4f8', color: '#2c3e50', padding: '8px' }}>
                          out of {formatNumber(getLabActivityGeneratedCOTotal(row))}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {labActivityObtainedRows.map((studentRow, idx) => (
                      <tr key={`lab-co-${studentRow.rollNumber}-${idx}`}>
                        <td>{studentRow.rollNumber || '-'}</td>
                        {/* CO wise marks out of CO Total */}
                        {labActivityRows.map((coRow, coIdx) => (
                          <td key={`co-total-${coIdx}`} style={{ textAlign: 'center' }}>
                            {formatNumber(getLabActivityStudentCOMarks(studentRow, coRow.coNumber))}
                          </td>
                        ))}
                        {/* CO wise marks out of CO Mapped Activity Marks */}
                        {labActivityRows.map((coRow, coIdx) => (
                          <td key={`co-mapped-${coIdx}`} style={{ textAlign: 'center' }}>
                            {formatNumber(getLabActivityStudentCOMappedMarks(studentRow, coRow.coNumber))}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td className="footer-label">Total</td>
                      {/* Totals for CO wise marks out of CO Total */}
                      {labActivityRows.map((coRow, coIdx) => (
                        <td key={`total-co-${coIdx}`} style={{ textAlign: 'center', fontWeight: 'bold' }}>
                          {formatNumber(labActivityObtainedRows.reduce((sum, studentRow) =>
                            sum + getLabActivityStudentCOMarks(studentRow, coRow.coNumber), 0))}
                        </td>
                      ))}
                      {/* Totals for CO wise marks out of CO Mapped Activity Marks */}
                      {labActivityRows.map((coRow, coIdx) => (
                        <td key={`total-mapped-${coIdx}`} style={{ textAlign: 'center', fontWeight: 'bold' }}>
                          {formatNumber(labActivityObtainedRows.reduce((sum, studentRow) =>
                            sum + getLabActivityStudentCOMappedMarks(studentRow, coRow.coNumber), 0))}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* Table 2: CO attainment */}
            {labActivityObtainedView === 1 && (
              <div className="table-wrapper">
                <table className="section-a-table">
                  <thead>
                    <tr>
                      <th>Roll</th>
                      {labActivityRows.map((coRow, idx) => (
                        <th key={`co-${idx}`}>{coRow.coNumber}</th>
                      ))}
                      <th>Total Marks</th>
                      <th>Ltr. Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {labActivityObtainedRows.map((studentRow, idx) => {
                      const totalMarks = getLabActivityStudentTotalMarks(studentRow);
                      const grade = getLetterGrade(totalMarks);
                      const hasRollNumber = studentRow.rollNumber && String(studentRow.rollNumber).trim() !== '';

                      return (
                        <tr key={`lab-att-${studentRow.rollNumber}-${idx}`}>
                          <td>{studentRow.rollNumber || '-'}</td>
                          {/* CO attainment values */}
                          {labActivityRows.map((coRow, coIdx) => {
                            const attainment = getLabActivityCOAttainment(studentRow, coRow.coNumber);
                            return (
                              <td key={`co-att-${coIdx}`} style={{ textAlign: 'center' }}>
                                {attainment === null ? '' : parseFloat(attainment.toFixed(1))}
                              </td>
                            );
                          })}
                          {/* Total Marks */}
                          <td style={{ textAlign: 'center', fontWeight: '500' }}>
                            {hasRollNumber ? formatNumber(totalMarks) : ''}
                          </td>
                          {/* Letter Grade */}
                          <td style={{ textAlign: 'center', fontWeight: '600', color: getGradeColor(grade) }}>
                            {hasRollNumber ? grade : ''}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CO Attainment Section - Shows appropriate table based on course type */}
      {selectedCourse && selectedSheet === 'COAttainment' && (() => {
        const courseCode = selectedCourse.courseCode || '';
        const lastDigit = parseInt(courseCode.slice(-1));
        const isTheoryCourse = !isNaN(lastDigit) && lastDigit % 2 === 1;

        const courseInfo = (selectedCourse.courseTitle || '').toLowerCase();
        const isProjectCourse = courseInfo.includes('project') ||
          courseInfo.includes('thesis') ||
          courseInfo.includes('research') ||
          courseInfo.includes('dissertation');

        const isLabCourse = (!isNaN(lastDigit) && lastDigit % 2 === 0) || isProjectCourse;

        return (
          <>
            {/* Theory Course Table */}
            {isTheoryCourse && (
              <section className="co-attainment-section" style={{ marginTop: '30px' }}>
                <h2>CO Attainment - Theory Courses</h2>

                {clos.length === 0 && (
                  <p style={{ padding: '20px', color: '#7f8c8d' }}>Loading course outcomes...</p>
                )}

                {clos.length > 0 && coAttainmentData.length === 0 && (
                  <p style={{ padding: '20px', color: '#7f8c8d' }}>No student data available.</p>
                )}

                {clos.length > 0 && coAttainmentData.length > 0 && (
                  <div className="table-wrapper">
                    <table className="co-attainment-table">
                      <thead>
                        <tr>
                          <th rowSpan="2">Roll</th>
                          <th colSpan={clos.length}>Attainment of COs in % (only Theory)</th>
                          <th colSpan={clos.length}>CO Achievement&gt;=55%</th>
                          <th colSpan={clos.length}>Binary Achievement&gt;=55%</th>
                        </tr>
                        <tr>
                          {/* CO headers for attainment % */}
                          {clos.map((clo, idx) => {
                            const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                            return <th key={`att-${idx}`}>{coNumber}</th>;
                          })}
                          {/* CO headers for Y/N achievement */}
                          {clos.map((clo, idx) => {
                            const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                            return <th key={`ach-${idx}`}>{coNumber}</th>;
                          })}
                          {/* CO headers for binary achievement */}
                          {clos.map((clo, idx) => {
                            const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                            return <th key={`bin-${idx}`}>{coNumber}</th>;
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {coAttainmentData.map((studentRow, studentIdx) => {
                          return (
                            <tr key={studentIdx}>
                              <td className="roll-cell">{studentRow.rollNumber}</td>

                              {/* Attainment of COs in % */}
                              {clos.map((clo, coIdx) => {
                                const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                                const percentage = studentRow.coValues[coNumber] || 0;
                                return (
                                  <td key={`att-${coIdx}`} style={{ textAlign: 'center' }}>
                                    {formatNumber(percentage)}%
                                  </td>
                                );
                              })}

                              {/* CO Achievement>=55% (Y or N) */}
                              {clos.map((clo, coIdx) => {
                                const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                                const percentage = studentRow.coValues[coNumber] || 0;
                                const achieved = percentage >= 55;
                                return (
                                  <td key={`ach-${coIdx}`} style={{
                                    textAlign: 'center',
                                    fontWeight: '600',
                                    color: achieved ? '#27ae60' : '#e74c3c'
                                  }}>
                                    {achieved ? 'Y' : 'N'}
                                  </td>
                                );
                              })}

                              {/* Binary Achievement>=55% (0 or 1) */}
                              {clos.map((clo, coIdx) => {
                                const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                                const percentage = studentRow.coValues[coNumber] || 0;
                                const achieved = percentage >= 55;
                                return (
                                  <td key={`bin-${coIdx}`} style={{
                                    textAlign: 'center',
                                    fontWeight: '600',
                                    backgroundColor: achieved ? '#d4edda' : '#f8d7da'
                                  }}>
                                    {achieved ? '1' : '0'}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td className="footer-label">Average</td>

                          {/* Average attainment % for each CO */}
                          {clos.map((clo, coIdx) => {
                            const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                            const total = coAttainmentData.reduce((sum, studentRow) =>
                              sum + (studentRow.coValues[coNumber] || 0), 0);
                            const avg = coAttainmentData.length > 0 ? total / coAttainmentData.length : 0;
                            return (
                              <td key={`avg-att-${coIdx}`} style={{ textAlign: 'center', fontWeight: 'bold' }}>
                                {formatNumber(avg)}%
                              </td>
                            );
                          })}

                          {/* Average Y/N achievement for each CO */}
                          {clos.map((clo, coIdx) => {
                            const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                            const achievedCount = coAttainmentData.reduce((sum, studentRow) =>
                              sum + ((studentRow.coValues[coNumber] || 0) >= 55 ? 1 : 0), 0);
                            const achievedPercentage = coAttainmentData.length > 0
                              ? (achievedCount / coAttainmentData.length) * 100
                              : 0;
                            return (
                              <td key={`avg-ach-${coIdx}`} style={{ textAlign: 'center', fontWeight: 'bold' }}>
                                {formatNumber(achievedPercentage)}%
                              </td>
                            );
                          })}

                          {/* Average binary achievement for each CO */}
                          {clos.map((clo, coIdx) => {
                            const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                            const achievedCount = coAttainmentData.reduce((sum, studentRow) =>
                              sum + ((studentRow.coValues[coNumber] || 0) >= 55 ? 1 : 0), 0);
                            const avg = coAttainmentData.length > 0 ? achievedCount / coAttainmentData.length : 0;
                            return (
                              <td key={`avg-bin-${coIdx}`} style={{
                                textAlign: 'center',
                                fontWeight: 'bold',
                                backgroundColor: avg >= 0.5 ? '#d4edda' : '#f8d7da'
                              }}>
                                {formatNumber(avg)}
                              </td>
                            );
                          })}
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </section>
            )}

            {/* Lab/Project Course Table */}
            {isLabCourse && (
              <section className="co-attainment-section" style={{ marginTop: '30px' }}>
                <h2>CO Attainment - Lab/Project Courses</h2>

                {clos.length === 0 && (
                  <p style={{ padding: '20px', color: '#7f8c8d' }}>Loading course outcomes...</p>
                )}

                {clos.length > 0 && coAttainmentData.length === 0 && (
                  <p style={{ padding: '20px', color: '#7f8c8d' }}>No student data available.</p>
                )}

                {clos.length > 0 && coAttainmentData.length > 0 && (
                  <div className="table-wrapper">
                    <table className="co-attainment-table">
                      <thead>
                        <tr>
                          <th rowSpan="2">Roll</th>
                          <th colSpan={clos.length}>Attainment of COs in % (only Lab)</th>
                          <th colSpan={clos.length}>CO Achievement&gt;=55%</th>
                          <th colSpan={clos.length}>Binary Achievement&gt;=55%</th>
                        </tr>
                        <tr>
                          {/* CO headers for attainment % */}
                          {clos.map((clo, idx) => {
                            const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                            return <th key={`att-lab-${idx}`}>{coNumber}</th>;
                          })}
                          {/* CO headers for Y/N achievement */}
                          {clos.map((clo, idx) => {
                            const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                            return <th key={`ach-lab-${idx}`}>{coNumber}</th>;
                          })}
                          {/* CO headers for binary achievement */}
                          {clos.map((clo, idx) => {
                            const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                            return <th key={`bin-lab-${idx}`}>{coNumber}</th>;
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {coAttainmentData.map((studentRow, studentIdx) => {
                          return (
                            <tr key={studentIdx}>
                              <td className="roll-cell">{studentRow.rollNumber}</td>

                              {/* Attainment of COs in % */}
                              {clos.map((clo, coIdx) => {
                                const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                                const percentage = studentRow.coValues[coNumber] || 0;
                                return (
                                  <td key={`att-lab-${coIdx}`} style={{ textAlign: 'center' }}>
                                    {formatNumber(percentage)}%
                                  </td>
                                );
                              })}

                              {/* CO Achievement>=55% (Y or N) */}
                              {clos.map((clo, coIdx) => {
                                const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                                const percentage = studentRow.coValues[coNumber] || 0;
                                const achieved = percentage >= 55;
                                return (
                                  <td key={`ach-lab-${coIdx}`} style={{
                                    textAlign: 'center',
                                    fontWeight: '600',
                                    color: achieved ? '#27ae60' : '#e74c3c'
                                  }}>
                                    {achieved ? 'Y' : 'N'}
                                  </td>
                                );
                              })}

                              {/* Binary Achievement>=55% (0 or 1) */}
                              {clos.map((clo, coIdx) => {
                                const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                                const percentage = studentRow.coValues[coNumber] || 0;
                                const achieved = percentage >= 55;
                                return (
                                  <td key={`bin-lab-${coIdx}`} style={{
                                    textAlign: 'center',
                                    fontWeight: '600',
                                    backgroundColor: achieved ? '#d4edda' : '#f8d7da'
                                  }}>
                                    {achieved ? '1' : '0'}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td className="footer-label">Average</td>

                          {/* Average attainment % for each CO */}
                          {clos.map((clo, coIdx) => {
                            const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                            const total = coAttainmentData.reduce((sum, studentRow) =>
                              sum + (studentRow.coValues[coNumber] || 0), 0);
                            const avg = coAttainmentData.length > 0 ? total / coAttainmentData.length : 0;
                            return (
                              <td key={`avg-att-lab-${coIdx}`} style={{ textAlign: 'center', fontWeight: 'bold' }}>
                                {formatNumber(avg)}%
                              </td>
                            );
                          })}

                          {/* Average Y/N achievement for each CO */}
                          {clos.map((clo, coIdx) => {
                            const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                            const achievedCount = coAttainmentData.reduce((sum, studentRow) =>
                              sum + ((studentRow.coValues[coNumber] || 0) >= 55 ? 1 : 0), 0);
                            const achievedPercentage = coAttainmentData.length > 0
                              ? (achievedCount / coAttainmentData.length) * 100
                              : 0;
                            return (
                              <td key={`avg-ach-lab-${coIdx}`} style={{ textAlign: 'center', fontWeight: 'bold' }}>
                                {formatNumber(achievedPercentage)}%
                              </td>
                            );
                          })}

                          {/* Average binary achievement for each CO */}
                          {clos.map((clo, coIdx) => {
                            const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                            const achievedCount = coAttainmentData.reduce((sum, studentRow) =>
                              sum + ((studentRow.coValues[coNumber] || 0) >= 55 ? 1 : 0), 0);
                            const avg = coAttainmentData.length > 0 ? achievedCount / coAttainmentData.length : 0;
                            return (
                              <td key={`avg-bin-lab-${coIdx}`} style={{
                                textAlign: 'center',
                                fontWeight: 'bold',
                                backgroundColor: avg >= 0.5 ? '#d4edda' : '#f8d7da'
                              }}>
                                {formatNumber(avg)}
                              </td>
                            );
                          })}
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </section>
            )}

            {/* Combined Theory+Lab Table (shown for all courses) */}
            <section className="co-attainment-section" style={{ marginTop: '30px' }}>
              <h2>CO Attainment - Combined (Theory+Lab)</h2>

              {clos.length === 0 && (
                <p style={{ padding: '20px', color: '#7f8c8d' }}>Loading course outcomes...</p>
              )}

              {clos.length > 0 && coAttainmentData.length === 0 && (
                <p style={{ padding: '20px', color: '#7f8c8d' }}>No student data available.</p>
              )}

              {clos.length > 0 && coAttainmentData.length > 0 && (
                <div className="table-wrapper">
                  <table className="co-attainment-table">
                    <thead>
                      <tr>
                        <th rowSpan="2">Roll</th>
                        <th colSpan={clos.length}>Attainment of COs in % (only Lab)</th>
                        <th colSpan={clos.length}>CO Achievement&gt;=55%</th>
                        <th colSpan={clos.length}>Binary Achievement&gt;=55%</th>
                      </tr>
                      <tr>
                        {/* CO headers for attainment % */}
                        {clos.map((clo, idx) => {
                          const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                          return <th key={`att-${idx}`}>{coNumber}</th>;
                        })}
                        {/* CO headers for Y/N achievement */}
                        {clos.map((clo, idx) => {
                          const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                          return <th key={`ach-${idx}`}>{coNumber}</th>;
                        })}
                        {/* CO headers for binary achievement */}
                        {clos.map((clo, idx) => {
                          const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                          return <th key={`bin-${idx}`}>{coNumber}</th>;
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {coAttainmentData.map((studentRow, studentIdx) => {
                        return (
                          <tr key={studentIdx}>
                            <td className="roll-cell">{studentRow.rollNumber}</td>

                            {/* Attainment of COs in % */}
                            {clos.map((clo, coIdx) => {
                              const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                              const percentage = studentRow.coValues[coNumber] || 0;
                              return (
                                <td key={`att-${coIdx}`} style={{ textAlign: 'center' }}>
                                  {formatNumber(percentage)}%
                                </td>
                              );
                            })}

                            {/* CO Achievement>=55% (Y or N) */}
                            {clos.map((clo, coIdx) => {
                              const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                              const percentage = studentRow.coValues[coNumber] || 0;
                              const achieved = percentage >= 55;
                              return (
                                <td key={`ach-${coIdx}`} style={{
                                  textAlign: 'center',
                                  fontWeight: '600',
                                  color: achieved ? '#27ae60' : '#e74c3c'
                                }}>
                                  {achieved ? 'Y' : 'N'}
                                </td>
                              );
                            })}

                            {/* Binary Achievement>=55% (0 or 1) */}
                            {clos.map((clo, coIdx) => {
                              const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                              const percentage = studentRow.coValues[coNumber] || 0;
                              const achieved = percentage >= 55;
                              return (
                                <td key={`bin-${coIdx}`} style={{
                                  textAlign: 'center',
                                  fontWeight: '600',
                                  backgroundColor: achieved ? '#d4edda' : '#f8d7da'
                                }}>
                                  {achieved ? '1' : '0'}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td className="footer-label">Average</td>

                        {/* Average attainment % for each CO */}
                        {clos.map((clo, coIdx) => {
                          const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                          const total = coAttainmentData.reduce((sum, studentRow) =>
                            sum + (studentRow.coValues[coNumber] || 0), 0);
                          const avg = coAttainmentData.length > 0 ? total / coAttainmentData.length : 0;
                          return (
                            <td key={`avg-att-${coIdx}`} style={{ textAlign: 'center', fontWeight: 'bold' }}>
                              {formatNumber(avg)}%
                            </td>
                          );
                        })}

                        {/* Average Y/N achievement for each CO */}
                        {clos.map((clo, coIdx) => {
                          const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                          const achievedCount = coAttainmentData.reduce((sum, studentRow) =>
                            sum + ((studentRow.coValues[coNumber] || 0) >= 55 ? 1 : 0), 0);
                          const achievedPercentage = coAttainmentData.length > 0
                            ? (achievedCount / coAttainmentData.length) * 100
                            : 0;
                          return (
                            <td key={`avg-ach-${coIdx}`} style={{ textAlign: 'center', fontWeight: 'bold' }}>
                              {formatNumber(achievedPercentage)}%
                            </td>
                          );
                        })}

                        {/* Average binary achievement for each CO */}
                        {clos.map((clo, coIdx) => {
                          const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                          const achievedCount = coAttainmentData.reduce((sum, studentRow) =>
                            sum + ((studentRow.coValues[coNumber] || 0) >= 55 ? 1 : 0), 0);
                          const avg = coAttainmentData.length > 0 ? achievedCount / coAttainmentData.length : 0;
                          return (
                            <td key={`avg-bin-${coIdx}`} style={{
                              textAlign: 'center',
                              fontWeight: 'bold',
                              backgroundColor: avg >= 0.5 ? '#d4edda' : '#f8d7da'
                            }}>
                              {formatNumber(avg)}
                            </td>
                          );
                        })}
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </section>
          </>
        );
      })()}

      {/* COCalc Section - Only for theory courses */}
      {(() => {
        if (selectedSheet !== 'COCalc') return null;

        const courseCode = selectedCourse?.courseCode || '';
        const lastDigit = parseInt(courseCode.slice(-1));
        const isTheoryCourse = !isNaN(lastDigit) && lastDigit % 2 === 1;

        if (!isTheoryCourse) return null;

        return (
          <>
            <section className="co-calc-section" data-section="COCalc">
              <h2>CO Calculation - Section A & B Marks</h2>

              {clos.length === 0 && (
                <p style={{ padding: '20px', color: '#7f8c8d' }}>Loading course outcomes...</p>
              )}

              {clos.length > 0 && coCalcData.length === 0 && (
                <p style={{ padding: '20px', color: '#7f8c8d' }}>No student data available.</p>
              )}

              {clos.length > 0 && coCalcData.length > 0 && (
                <div className="table-wrapper">
                  <table className="co-calc-table">
                    <thead>
                      <tr>
                        <th rowSpan="3">Roll</th>
                        <th colSpan={clos.length * 2}>Section A</th>
                        <th colSpan={clos.length * 2}>Section B</th>
                      </tr>
                      <tr>
                        <th colSpan={clos.length}>Marks Obtained</th>
                        <th colSpan={clos.length}>Marks Distribution</th>
                        <th colSpan={clos.length}>Marks Obtained</th>
                        <th colSpan={clos.length}>Marks Distribution</th>
                      </tr>
                      <tr>
                        {/* Section A - Marks Obtained CO headers */}
                        {clos.map((clo, idx) => {
                          const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                          return <th key={`sectA-obt-${idx}`}>{coNumber}</th>;
                        })}
                        {/* Section A - Marks Distribution CO headers */}
                        {clos.map((clo, idx) => {
                          const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                          return <th key={`sectA-dist-${idx}`}>{coNumber}</th>;
                        })}
                        {/* Section B - Marks Obtained CO headers */}
                        {clos.map((clo, idx) => {
                          const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                          return <th key={`sectB-obt-${idx}`}>{coNumber}</th>;
                        })}
                        {/* Section B - Marks Distribution CO headers */}
                        {clos.map((clo, idx) => {
                          const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                          return <th key={`sectB-dist-${idx}`}>{coNumber}</th>;
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {coCalcData.map((studentRow, studentIdx) => {
                        return (
                          <tr key={studentIdx}>
                            <td className="roll-cell">{studentRow.rollNumber}</td>

                            {/* Section A - Marks Obtained */}
                            {clos.map((clo, coIdx) => {
                              const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                              const marks = studentRow.sectionA.marksObtained[coNumber] || 0;
                              return (
                                <td key={`sectA-obt-${coIdx}`} style={{ textAlign: 'center' }}>
                                  {formatNumber(marks)}
                                </td>
                              );
                            })}

                            {/* Section A - Marks Distribution */}
                            {clos.map((clo, coIdx) => {
                              const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                              const marks = studentRow.sectionA.marksDistribution[coNumber] || 0;
                              return (
                                <td key={`sectA-dist-${coIdx}`} style={{ textAlign: 'center' }}>
                                  {formatNumber(marks)}
                                </td>
                              );
                            })}

                            {/* Section B - Marks Obtained */}
                            {clos.map((clo, coIdx) => {
                              const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                              const marks = studentRow.sectionB.marksObtained[coNumber] || 0;
                              return (
                                <td key={`sectB-obt-${coIdx}`} style={{ textAlign: 'center' }}>
                                  {formatNumber(marks)}
                                </td>
                              );
                            })}

                            {/* Section B - Marks Distribution */}
                            {clos.map((clo, coIdx) => {
                              const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                              const marks = studentRow.sectionB.marksDistribution[coNumber] || 0;
                              return (
                                <td key={`sectB-dist-${coIdx}`} style={{ textAlign: 'center' }}>
                                  {formatNumber(marks)}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Second Table: CO-PO Percentage (Theory: CT+Assign+A+B) */}
            <section className="co-po-percentage-section" style={{ marginTop: '30px' }}>
              <h2>CO-PO percentage (Theory: CT+Assign+A+B)</h2>

              {clos.length === 0 && (
                <p style={{ padding: '20px', color: '#7f8c8d' }}>Loading course outcomes...</p>
              )}

              {clos.length > 0 && coCalcData.length === 0 && (
                <p style={{ padding: '20px', color: '#7f8c8d' }}>No student data available.</p>
              )}

              {clos.length > 0 && coCalcData.length > 0 && (
                <div className="table-wrapper">
                  <table className="co-po-percentage-table">
                    <thead>
                      <tr>
                        <th rowSpan="2">Roll</th>
                        <th colSpan={clos.length}>Total Mark Obtained</th>
                        <th colSpan={clos.length}>Total Marks Distribution</th>
                        <th colSpan={clos.length} style={{ backgroundColor: '#16a085', color: '#fff' }}>CO Attainment (Theory)</th>
                        <th rowSpan="3" style={{ backgroundColor: '#138d75', color: '#fff', fontWeight: '700', fontSize: '14px' }}>Total</th>
                        <th rowSpan="3" style={{ backgroundColor: '#1abc9c', color: '#fff', fontWeight: '700', fontSize: '14px' }}>Ltr Grade</th>
                      </tr>
                      <tr>
                        {/* CO headers for Total Mark Obtained */}
                        {clos.map((clo, idx) => {
                          const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                          return <th key={`obt-co-${idx}`}>{coNumber}</th>;
                        })}
                        {/* CO headers for Total Marks Distribution */}
                        {clos.map((clo, idx) => {
                          const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                          return <th key={`dist-co-${idx}`}>{coNumber}</th>;
                        })}
                        {/* CO headers for CO Attainment */}
                        {clos.map((clo, idx) => {
                          const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                          return <th key={`theory-attain-co-${idx}`} style={{ backgroundColor: '#16a085', color: '#fff' }}>{coNumber}</th>;
                        })}
                      </tr>
                      <tr>
                        <th style={{ fontSize: '13px', fontWeight: '600' }}>CO msrd</th>
                        {/* CO msrd row for Total Mark Obtained */}
                        {clos.map((clo, coIdx) => {
                          const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                          // Calculate total distribution across all students (same way as displayed in table)
                          let totalDistribution = 0;
                          const factoredTotals = calculateFactoredCOTotals();
                          const ctCoTotal = factoredTotals[coNumber] || 0;
                          const factoredAssignmentTotals = calculateFactoredAssignmentCOTotals();
                          const assignmentCoTotal = factoredAssignmentTotals[coNumber] || 0;

                          coCalcData.forEach(student => {
                            const sectionADist = student.sectionA.marksDistribution[coNumber] || 0;
                            const sectionBDist = student.sectionB.marksDistribution[coNumber] || 0;
                            const attendance = student.attendance || 0;
                            totalDistribution += sectionADist + sectionBDist + ctCoTotal + assignmentCoTotal + attendance;
                          });
                          // CO msrd is 1 if totalDistribution > 0, otherwise 0
                          const coMsrd = totalDistribution > 0 ? 1 : 0;
                          return (
                            <th key={`msrd-${coIdx}`} style={{ fontSize: '13px', fontWeight: '600' }}>
                              {coMsrd}
                            </th>
                          );
                        })}

                        {/* Empty cells for Total Marks Distribution */}
                        {clos.map((clo, coIdx) => {
                          return <th key={`msrd-empty-${coIdx}`}></th>;
                        })}

                        {/* Empty cells for CO Attainment */}
                        {clos.map((clo, coIdx) => {
                          return <th key={`theory-attain-msrd-${coIdx}`} style={{ backgroundColor: '#16a085', borderLeft: 'none', borderRight: 'none' }}></th>;
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {/* Student rows */}
                      {coCalcData.map((studentRow, studentIdx) => {
                        return (
                          <tr key={studentIdx}>
                            <td className="roll-cell">{studentRow.rollNumber}</td>

                            {/* Total Mark Obtained for each CO */}
                            {clos.map((clo, coIdx) => {
                              const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                              // Sum: Section A obtained + Section B obtained + CT (obtained + distribution) + Assignment (obtained + distribution)
                              const sectionAObt = studentRow.sectionA.marksObtained[coNumber] || 0;
                              const sectionBObt = studentRow.sectionB.marksObtained[coNumber] || 0;
                              const ctObt = getStudentCTFactoredMarks(studentRow.rollNumber, coNumber);
                              const assignObt = getStudentAssignmentFactoredMarks(studentRow.rollNumber, coNumber);
                              const marks = sectionAObt + sectionBObt + ctObt + assignObt;
                              return (
                                <td key={`total-obt-${coIdx}`} style={{ textAlign: 'center' }}>
                                  {formatNumber(marks)}
                                </td>
                              );
                            })}

                            {/* Total Marks Distribution for each CO */}
                            {clos.map((clo, coIdx) => {
                              const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                              const sectionADist = studentRow.sectionA.marksDistribution[coNumber] || 0;
                              const sectionBDist = studentRow.sectionB.marksDistribution[coNumber] || 0;
                              const factoredTotals = calculateFactoredCOTotals();
                              const ctCoTotal = factoredTotals[coNumber] || 0;
                              const factoredAssignmentTotals = calculateFactoredAssignmentCOTotals();
                              const assignmentCoTotal = factoredAssignmentTotals[coNumber] || 0;
                              const attendance = studentRow.attendance || 0;
                              const marks = sectionADist + sectionBDist + ctCoTotal + assignmentCoTotal + attendance;
                              return (
                                <td key={`total-dist-${coIdx}`} style={{ textAlign: 'center' }}>
                                  {formatNumber(marks)}
                                </td>
                              );
                            })}

                            {/* CO Attainment percentage for each CO */}
                            {clos.map((clo, coIdx) => {
                              const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                              // Calculate Total Mark Obtained
                              const sectionAObt = studentRow.sectionA.marksObtained[coNumber] || 0;
                              const sectionBObt = studentRow.sectionB.marksObtained[coNumber] || 0;
                              const ctObt = getStudentCTFactoredMarks(studentRow.rollNumber, coNumber);
                              const assignObt = getStudentAssignmentFactoredMarks(studentRow.rollNumber, coNumber);
                              const totalMarksObtained = sectionAObt + sectionBObt + ctObt + assignObt;

                              // Calculate Total Marks Distribution
                              const sectionADist = studentRow.sectionA.marksDistribution[coNumber] || 0;
                              const sectionBDist = studentRow.sectionB.marksDistribution[coNumber] || 0;
                              const factoredTotals = calculateFactoredCOTotals();
                              const ctCoTotal = factoredTotals[coNumber] || 0;
                              const factoredAssignmentTotals = calculateFactoredAssignmentCOTotals();
                              const assignmentCoTotal = factoredAssignmentTotals[coNumber] || 0;
                              const attendance = studentRow.attendance || 0;
                              const totalMarksDistribution = sectionADist + sectionBDist + ctCoTotal + assignmentCoTotal + attendance;

                              // CO Attainment = (Total Mark Obtained / Total Marks Distribution) * 100
                              const percentage = totalMarksDistribution > 0 ? parseFloat(((totalMarksObtained / totalMarksDistribution) * 100).toFixed(4)) : 0;
                              return (
                                <td key={`theory-attain-${coIdx}`} style={{ textAlign: 'center', backgroundColor: '#a8e6d7' }}>
                                  {formatNumber(percentage)}%
                                </td>
                              );
                            })}

                            {/* Total */}
                            <td style={{ textAlign: 'center', fontWeight: '700', backgroundColor: '#d5f4e6', border: '2px solid #138d75', fontSize: '14px' }}>
                              {(() => {
                                let total = 0;
                                // Get attendance
                                const attnStudent = attnAssignObtainedRows.find(s =>
                                  String(s.rollNumber || '').trim().toLowerCase() ===
                                  String(studentRow.rollNumber || '').trim().toLowerCase()
                                );
                                const attendance = attnStudent ? (attnStudent.attendance || 0) : 0;

                                // Sum total marks obtained for all COs (from CO-PO percentage table)
                                clos.forEach(clo => {
                                  const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                                  const sectionAObt = studentRow.sectionA.marksObtained[coNumber] || 0;
                                  const sectionBObt = studentRow.sectionB.marksObtained[coNumber] || 0;
                                  const ctObt = getStudentCTFactoredMarks(studentRow.rollNumber, coNumber);
                                  const assignObt = getStudentAssignmentFactoredMarks(studentRow.rollNumber, coNumber);
                                  total += sectionAObt + sectionBObt + ctObt + assignObt;
                                });

                                total += attendance;
                                return formatNumber(total);
                              })()}
                            </td>

                            {/* Letter Grade */}
                            <td style={{
                              textAlign: 'center',
                              fontWeight: '700',
                              fontSize: '15px',
                              border: (() => {
                                let total = 0;
                                const attnStudent = attnAssignObtainedRows.find(s =>
                                  String(s.rollNumber || '').trim().toLowerCase() ===
                                  String(studentRow.rollNumber || '').trim().toLowerCase()
                                );
                                const attendance = attnStudent ? (attnStudent.attendance || 0) : 0;

                                // Sum total marks obtained for all COs (from CO-PO percentage table)
                                clos.forEach(clo => {
                                  const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                                  const sectionAObt = studentRow.sectionA.marksObtained[coNumber] || 0;
                                  const sectionBObt = studentRow.sectionB.marksObtained[coNumber] || 0;
                                  const ctObt = getStudentCTFactoredMarks(studentRow.rollNumber, coNumber);
                                  const assignObt = getStudentAssignmentFactoredMarks(studentRow.rollNumber, coNumber);
                                  total += sectionAObt + sectionBObt + ctObt + assignObt;
                                });

                                total += attendance;

                                // Border color - darker shade of background
                                if (total < 119) return '2px solid #c82333'; // F - dark red
                                else if (total < 134) return '2px solid #ff9800'; // D - dark orange
                                else if (total < 149) return '2px solid #ffc107'; // C - dark yellow
                                else if (total < 164) return '2px solid #81c784'; // C+ - medium green
                                else if (total < 179) return '2px solid #66bb6a'; // B- - darker green
                                else if (total < 194) return '2px solid #4caf50'; // B - green
                                else if (total < 209) return '2px solid #43a047'; // B+ - darker green
                                else if (total < 224) return '2px solid #388e3c'; // A- - even darker green
                                else if (total < 239) return '2px solid #2e7d32'; // A - very dark green
                                else return '2px solid #1b5e20'; // A+ - darkest green
                              })(),
                              backgroundColor: (() => {
                                let total = 0;
                                const attnStudent = attnAssignObtainedRows.find(s =>
                                  String(s.rollNumber || '').trim().toLowerCase() ===
                                  String(studentRow.rollNumber || '').trim().toLowerCase()
                                );
                                const attendance = attnStudent ? (attnStudent.attendance || 0) : 0;

                                // Sum total marks obtained for all COs (from CO-PO percentage table)
                                clos.forEach(clo => {
                                  const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                                  const sectionAObt = studentRow.sectionA.marksObtained[coNumber] || 0;
                                  const sectionBObt = studentRow.sectionB.marksObtained[coNumber] || 0;
                                  const ctObt = getStudentCTFactoredMarks(studentRow.rollNumber, coNumber);
                                  const assignObt = getStudentAssignmentFactoredMarks(studentRow.rollNumber, coNumber);
                                  total += sectionAObt + sectionBObt + ctObt + assignObt;
                                });

                                total += attendance;

                                // Color based on grade
                                if (total < 119) return '#f8d7da'; // F - light red
                                else if (total < 134) return '#ffe5cc'; // D - light orange
                                else if (total < 149) return '#fff3cd'; // C - light yellow
                                else if (total < 164) return '#e7f5e0'; // C+ - very light green
                                else if (total < 179) return '#d4edda'; // B- - light green
                                else if (total < 194) return '#c3e6cb'; // B - green
                                else if (total < 209) return '#b2dfbb'; // B+ - medium green
                                else if (total < 224) return '#a1d9ab'; // A- - darker green
                                else if (total < 239) return '#8fd19e'; // A - even darker green
                                else return '#7ec98f'; // A+ - darkest green
                              })(),
                              color: (() => {
                                let total = 0;
                                const attnStudent = attnAssignObtainedRows.find(s =>
                                  String(s.rollNumber || '').trim().toLowerCase() ===
                                  String(studentRow.rollNumber || '').trim().toLowerCase()
                                );
                                const attendance = attnStudent ? (attnStudent.attendance || 0) : 0;

                                // Sum total marks obtained for all COs (from CO-PO percentage table)
                                clos.forEach(clo => {
                                  const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                                  const sectionAObt = studentRow.sectionA.marksObtained[coNumber] || 0;
                                  const sectionBObt = studentRow.sectionB.marksObtained[coNumber] || 0;
                                  const ctObt = getStudentCTFactoredMarks(studentRow.rollNumber, coNumber);
                                  const assignObt = getStudentAssignmentFactoredMarks(studentRow.rollNumber, coNumber);
                                  total += sectionAObt + sectionBObt + ctObt + assignObt;
                                });

                                total += attendance;

                                // F should have red text
                                if (total < 119) return '#c82333';
                                else return '#2c3e50';
                              })()
                            }}>
                              {(() => {
                                let total = 0;
                                const attnStudent = attnAssignObtainedRows.find(s =>
                                  String(s.rollNumber || '').trim().toLowerCase() ===
                                  String(studentRow.rollNumber || '').trim().toLowerCase()
                                );
                                const attendance = attnStudent ? (attnStudent.attendance || 0) : 0;

                                // Sum total marks obtained for all COs (from CO-PO percentage table)
                                clos.forEach(clo => {
                                  const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                                  const sectionAObt = studentRow.sectionA.marksObtained[coNumber] || 0;
                                  const sectionBObt = studentRow.sectionB.marksObtained[coNumber] || 0;
                                  const ctObt = getStudentCTFactoredMarks(studentRow.rollNumber, coNumber);
                                  const assignObt = getStudentAssignmentFactoredMarks(studentRow.rollNumber, coNumber);
                                  total += sectionAObt + sectionBObt + ctObt + assignObt;
                                });

                                total += attendance;

                                // Grade calculation
                                if (total < 119) return 'F';
                                else if (total < 134) return 'D';
                                else if (total < 149) return 'C';
                                else if (total < 164) return 'C+';
                                else if (total < 179) return 'B-';
                                else if (total < 194) return 'B';
                                else if (total < 209) return 'B+';
                                else if (total < 224) return 'A-';
                                else if (total < 239) return 'A';
                                else return 'A+';
                              })()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Third Table: CT and Assignment Marks */}
            <section className="ct-assignment-section" style={{ marginTop: '30px' }}>
              <h2>CT and Assignment Marks</h2>

              {clos.length === 0 && (
                <p style={{ padding: '20px', color: '#7f8c8d' }}>No student data available.</p>
              )}

              {clos.length > 0 && coCalcData.length > 0 && (
                <div className="table-wrapper">
                  <table className="co-po-percentage-table">
                    <thead>
                      <tr>
                        <th rowSpan="2">Roll</th>
                        <th colSpan={clos.length}>Total Mark Obtained</th>
                        <th colSpan={clos.length}>Total Marks Distribution</th>
                      </tr>
                      <tr>
                        {/* CO headers for Total Mark Obtained */}
                        {clos.map((clo, idx) => {
                          const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                          return <th key={`combined-obt-co-${idx}`}>{coNumber}</th>;
                        })}
                        {/* CO headers for Total Marks Distribution */}
                        {clos.map((clo, idx) => {
                          const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                          return <th key={`combined-dist-co-${idx}`}>{coNumber}</th>;
                        })}
                      </tr>
                      <tr>
                        <th style={{ fontSize: '13px', fontWeight: '600' }}>CO msrd</th>
                        {/* CO msrd row for Total Mark Obtained */}
                        {clos.map((clo, coIdx) => {
                          const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                          // Calculate total distribution across all students (theory + lab)
                          let totalDistribution = 0;
                          coCalcData.forEach(student => {
                            const theoryDist = student.total.marksDistribution[coNumber] || 0;
                            const labActivityStudent = labActivityObtainedRows.find(s => s.rollNumber === student.rollNumber);
                            const labDist = labActivityStudent ? getLabActivityStudentCOMappedMarks(labActivityStudent, coNumber) : 0;
                            totalDistribution += theoryDist + labDist;
                          });
                          // CO msrd is 1 if totalDistribution > 0, otherwise 0
                          const coMsrd = totalDistribution > 0 ? 1 : 0;
                          return (
                            <th key={`combined-msrd-${coIdx}`} style={{ fontSize: '13px', fontWeight: '600' }}>
                              {coMsrd}
                            </th>
                          );
                        })}

                        {/* CO msrd for Total Marks Distribution */}
                        {clos.map((clo, coIdx) => {
                          const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                          // Get the total from rightmost CO-wise obtained marks (CO Mapped Activity Marks) from Lab Activity Obtained table
                          const totalLabActivityObtained = labActivityObtainedRows.reduce((sum, studentRow) => {
                            return sum + getLabActivityStudentCOMappedMarks(studentRow, coNumber);
                          }, 0);
                          return (
                            <th key={`combined-msrd-dist-${coIdx}`} style={{ fontSize: '13px', fontWeight: '600' }}>
                              {formatNumber(totalLabActivityObtained)}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {/* Student rows */}
                      {coCalcData.map((studentRow, studentIdx) => {
                        return (
                          <tr key={studentIdx}>
                            <td className="roll-cell">{studentRow.rollNumber}</td>

                            {/* Total Mark Obtained for each CO (Theory + Lab) */}
                            {clos.map((clo, coIdx) => {
                              const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                              const theoryMarks = studentRow.total.marksObtained[coNumber] || 0;
                              // Get lab activity marks from rightmost CO-wise obtained marks
                              const labActivityStudent = labActivityObtainedRows.find(s => s.rollNumber === studentRow.rollNumber);
                              const labMarks = getLabActivityStudentCOMappedMarks(labActivityStudent, coNumber);
                              const totalMarks = theoryMarks + labMarks;
                              return (
                                <td key={`combined-total-obt-${coIdx}`} style={{ textAlign: 'center' }}>
                                  {formatNumber(totalMarks)}
                                </td>
                              );
                            })}

                            {/* Total Marks Distribution for each CO (Theory + Lab) */}
                            {clos.map((clo, coIdx) => {
                              const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                              const theoryDist = studentRow.total.marksDistribution[coNumber] || 0;
                              // Get lab activity marks from rightmost CO-wise obtained marks
                              const labActivityStudent = labActivityObtainedRows.find(s => s.rollNumber === studentRow.rollNumber);
                              const labDist = getLabActivityStudentCOMappedMarks(labActivityStudent, coNumber);
                              const totalDist = theoryDist + labDist;
                              return (
                                <td key={`combined-total-dist-${coIdx}`} style={{ textAlign: 'center' }}>
                                  {formatNumber(totalDist)}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        );
      })()}

      {/* COCalc Additional Tables - Show for all course types */}
      {(() => {
        if (selectedSheet !== 'COCalc') return null;

        // No course type restriction - show for all courses

        return (
          <>
            {/* Fourth Table: CO - PO percentage (theory + Lab) - Show for all course types */}
            <section className="co-po-combined-percentage-section" style={{ marginTop: '30px' }}>
              <h2>CO - PO percentage (theory + Lab)</h2>

              {clos.length === 0 && (
                <p style={{ padding: '20px', color: '#7f8c8d' }}>Loading course outcomes...</p>
              )}

              {clos.length > 0 && coCalcData.length === 0 && (
                <p style={{ padding: '20px', color: '#7f8c8d' }}>No student data available.</p>
              )}

              {clos.length > 0 && coCalcData.length > 0 && (
                <div className="table-wrapper">
                  <table className="co-po-percentage-table">
                    <thead>
                      <tr>
                        <th rowSpan="2">Roll</th>
                        <th colSpan={clos.length}>Total Mark Obtained</th>
                        <th colSpan={clos.length}>Total Marks Distribution</th>
                      </tr>
                      <tr>
                        {/* CO headers for Total Mark Obtained */}
                        {clos.map((clo, idx) => {
                          const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                          return <th key={`co-po-comb-obt-co-${idx}`}>{coNumber}</th>;
                        })}
                        {/* CO headers for Total Marks Distribution */}
                        {clos.map((clo, idx) => {
                          const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                          return <th key={`co-po-comb-dist-co-${idx}`}>{coNumber}</th>;
                        })}
                      </tr>
                      <tr>
                        <th style={{ fontSize: '13px', fontWeight: '600' }}>CO msrd</th>
                        {/* CO msrd row for Total Mark Obtained */}
                        {clos.map((clo, coIdx) => {
                          const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                          // Sum all student values in the corresponding CO column of Total Marks Distribution
                          let sumOfDistribution = 0;
                          coCalcData.forEach(studentRow => {
                            const theoryDist = studentRow.total.marksDistribution[coNumber] || 0;
                            const labActivityStudent = labActivityObtainedRows.find(s => s.rollNumber === studentRow.rollNumber);
                            const labDist = getLabActivityStudentCOMappedMarks(labActivityStudent, coNumber);
                            sumOfDistribution += theoryDist + labDist;
                          });
                          // CO msrd is 1 if sumOfDistribution > 0, otherwise 0
                          const coMsrd = sumOfDistribution > 0 ? 1 : 0;
                          return (
                            <th key={`co-po-comb-msrd-${coIdx}`} style={{ fontSize: '13px', fontWeight: '600' }}>
                              {coMsrd}
                            </th>
                          );
                        })}

                        {/* CO msrd for Total Marks Distribution */}
                        {clos.map((clo, coIdx) => {
                          const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                          // Get CO Total from CO Mapping of Lab Activity Marks table
                          const labActivityRow = labActivityRows.find(r => r.coNumber === coNumber);
                          let coTotal = 0;
                          if (labActivityRow && activityTaken > 0) {
                            const eqWt = (coMappedActivityMarks || 0) / (activityTaken || 1);
                            for (let activityIndex = 0; activityIndex < activityTaken; activityIndex++) {
                              const activityNum = activityIndex + 1;
                              if ((labActivityRow[`Activity${activityNum}_Q1`] || 0) !== 0) coTotal += eqWt;
                              if ((labActivityRow[`Activity${activityNum}_Q2`] || 0) !== 0) coTotal += eqWt;
                              if ((labActivityRow[`Activity${activityNum}_Q3`] || 0) !== 0) coTotal += eqWt;
                            }
                          }
                          return (
                            <th key={`co-po-comb-msrd-dist-${coIdx}`} style={{ fontSize: '13px', fontWeight: '600' }}>
                              {formatNumber(coTotal)}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {/* Student rows */}
                      {coCalcData.map((studentRow, studentIdx) => {
                        return (
                          <tr key={studentIdx}>
                            <td className="roll-cell">{studentRow.rollNumber}</td>

                            {/* Total Mark Obtained for each CO (Theory + Lab) */}
                            {clos.map((clo, coIdx) => {
                              const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                              const theoryMarks = studentRow.total.marksObtained[coNumber] || 0;
                              // Get lab activity marks from 2nd "CO wise obtained marks out of" column (rightmost)
                              const labActivityStudent = labActivityObtainedRows.find(s => s.rollNumber === studentRow.rollNumber);
                              const labMarks = getLabActivityStudentCOMappedMarks(labActivityStudent, coNumber);
                              const totalMarks = theoryMarks + labMarks;
                              return (
                                <td key={`co-po-comb-total-obt-${coIdx}`} style={{ textAlign: 'center' }}>
                                  {formatNumber(totalMarks)}
                                </td>
                              );
                            })}

                            {/* Total Marks Distribution for each CO (Theory + Lab) */}
                            {clos.map((clo, coIdx) => {
                              const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                              const theoryDist = studentRow.total.marksDistribution[coNumber] || 0;
                              // Get lab activity marks from rightmost CO-wise obtained marks
                              const labActivityStudent = labActivityObtainedRows.find(s => s.rollNumber === studentRow.rollNumber);
                              const labDist = getLabActivityStudentCOMappedMarks(labActivityStudent, coNumber);
                              const totalDist = theoryDist + labDist;
                              return (
                                <td key={`co-po-comb-total-dist-${coIdx}`} style={{ textAlign: 'center' }}>
                                  {formatNumber(totalDist)}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Fifth Table: CO attainment (theory+Lab) - Show for all course types */}
            <section className="co-attainment-combined-section" style={{ marginTop: '30px' }}>
              <h2>CO attainment (theory+Lab)</h2>

              {clos.length === 0 && (
                <p style={{ padding: '20px', color: '#7f8c8d' }}>Loading course outcomes...</p>
              )}

              {clos.length > 0 && coCalcData.length === 0 && (
                <p style={{ padding: '20px', color: '#7f8c8d' }}>No student data available.</p>
              )}

              {clos.length > 0 && coCalcData.length > 0 && (
                <div className="table-wrapper">
                  <table className="co-attainment-table">
                    <thead>
                      <tr>
                        <th>Roll</th>
                        {/* CO headers */}
                        {clos.map((clo, idx) => {
                          const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                          return <th key={`co-attain-comb-co-${idx}`} style={{ backgroundColor: '#16a085', color: '#fff' }}>{coNumber}</th>;
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {/* Student rows */}
                      {coCalcData.map((studentRow, studentIdx) => {
                        return (
                          <tr key={studentIdx}>
                            <td className="roll-cell">{studentRow.rollNumber}</td>

                            {/* CO attainment percentage for each CO */}
                            {clos.map((clo, coIdx) => {
                              const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                              // Calculate Total Mark Obtained (Theory + Lab)
                              const theoryMarks = studentRow.total.marksObtained[coNumber] || 0;
                              const labActivityStudent = labActivityObtainedRows.find(s => s.rollNumber === studentRow.rollNumber);
                              const labMarks = getLabActivityStudentCOMappedMarks(labActivityStudent, coNumber);
                              const totalMarksObtained = theoryMarks + labMarks;

                              // Calculate Total Marks Distribution (Theory + Lab)
                              const theoryDist = studentRow.total.marksDistribution[coNumber] || 0;
                              const labDist = getLabActivityStudentCOMappedMarks(labActivityStudent, coNumber);
                              const totalMarksDistribution = theoryDist + labDist;

                              // CO attainment = Total Mark Obtained / Total Marks Distribution
                              const percentage = totalMarksDistribution > 0 ? parseFloat(((totalMarksObtained / totalMarksDistribution) * 100).toFixed(4)) : 0;
                              return (
                                <td key={`co-attain-comb-${coIdx}`} style={{ textAlign: 'center', backgroundColor: '#a8e6d7' }}>
                                  {formatNumber(percentage)}%
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        );
      })()}

      {/* COCalc_LabUnnorm Section - Same as COCalc */}
      {(() => {
        if (selectedSheet !== 'COCalc_LabUnnorm') return null;

        // No course type restriction - show for all courses

        return (
          <>
            <section className="co-calc-section" data-section="COCalc_LabUnnorm">
              <h2>CO Calculation - Section A & B Marks</h2>

              {clos.length === 0 && (
                <p style={{ padding: '20px', color: '#7f8c8d' }}>Loading course outcomes...</p>
              )}

              {clos.length > 0 && coCalcData.length === 0 && (
                <p style={{ padding: '20px', color: '#7f8c8d' }}>No student data available.</p>
              )}

              {clos.length > 0 && coCalcData.length > 0 && (
                <div className="table-wrapper">
                  <table className="co-calc-table">
                    <thead>
                      <tr>
                        <th rowSpan="3">Roll</th>
                        <th colSpan={clos.length * 2}>Section A</th>
                        <th colSpan={clos.length * 2}>Section B</th>
                      </tr>
                      <tr>
                        <th colSpan={clos.length}>Marks Obtained</th>
                        <th colSpan={clos.length}>Marks Distribution</th>
                        <th colSpan={clos.length}>Marks Obtained</th>
                        <th colSpan={clos.length}>Marks Distribution</th>
                      </tr>
                      <tr>
                        {/* Section A - Marks Obtained CO headers */}
                        {clos.map((clo, idx) => {
                          const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                          return <th key={`sectA-obt-${idx}`}>{coNumber}</th>;
                        })}
                        {/* Section A - Marks Distribution CO headers */}
                        {clos.map((clo, idx) => {
                          const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                          return <th key={`sectA-dist-${idx}`}>{coNumber}</th>;
                        })}
                        {/* Section B - Marks Obtained CO headers */}
                        {clos.map((clo, idx) => {
                          const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                          return <th key={`sectB-obt-${idx}`}>{coNumber}</th>;
                        })}
                        {/* Section B - Marks Distribution CO headers */}
                        {clos.map((clo, idx) => {
                          const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                          return <th key={`sectB-dist-${idx}`}>{coNumber}</th>;
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {coCalcData.map((studentRow, studentIdx) => {
                        return (
                          <tr key={studentIdx}>
                            <td className="roll-cell">{studentRow.rollNumber}</td>

                            {/* Section A - Marks Obtained */}
                            {clos.map((clo, coIdx) => {
                              const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                              const marks = studentRow.sectionA.marksObtained[coNumber] || 0;
                              return (
                                <td key={`sectA-obt-${coIdx}`} style={{ textAlign: 'center' }}>
                                  {formatNumber(marks)}
                                </td>
                              );
                            })}

                            {/* Section A - Marks Distribution */}
                            {clos.map((clo, coIdx) => {
                              const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                              const marks = studentRow.sectionA.marksDistribution[coNumber] || 0;
                              return (
                                <td key={`sectA-dist-${coIdx}`} style={{ textAlign: 'center' }}>
                                  {formatNumber(marks)}
                                </td>
                              );
                            })}

                            {/* Section B - Marks Obtained */}
                            {clos.map((clo, coIdx) => {
                              const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                              const marks = studentRow.sectionB.marksObtained[coNumber] || 0;
                              return (
                                <td key={`sectB-obt-${coIdx}`} style={{ textAlign: 'center' }}>
                                  {formatNumber(marks)}
                                </td>
                              );
                            })}

                            {/* Section B - Marks Distribution */}
                            {clos.map((clo, coIdx) => {
                              const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                              const marks = studentRow.sectionB.marksDistribution[coNumber] || 0;
                              return (
                                <td key={`sectB-dist-${coIdx}`} style={{ textAlign: 'center' }}>
                                  {formatNumber(marks)}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Second Table: CO-PO Percentage (Theory: CT+Assign+A+B) */}
            <section className="co-po-percentage-section" style={{ marginTop: '30px' }}>
              <h2>CO-PO percentage (Theory: CT+Assign+A+B)</h2>

              {clos.length === 0 && (
                <p style={{ padding: '20px', color: '#7f8c8d' }}>Loading course outcomes...</p>
              )}

              {clos.length > 0 && coCalcData.length === 0 && (
                <p style={{ padding: '20px', color: '#7f8c8d' }}>No student data available.</p>
              )}

              {clos.length > 0 && coCalcData.length > 0 && (
                <div className="table-wrapper">
                  <table className="co-po-percentage-table">
                    <thead>
                      <tr>
                        <th rowSpan="2">Roll</th>
                        <th colSpan={clos.length}>Total Mark Obtained</th>
                        <th colSpan={clos.length}>Total Marks Distribution</th>
                        <th colSpan={clos.length} style={{ backgroundColor: '#16a085', color: '#fff' }}>CO Attainment (Theory)</th>
                        <th rowSpan="3" style={{ backgroundColor: '#138d75', color: '#fff', fontWeight: '700', fontSize: '14px' }}>Total</th>
                        <th rowSpan="3" style={{ backgroundColor: '#1abc9c', color: '#fff', fontWeight: '700', fontSize: '14px' }}>Ltr Grade</th>
                      </tr>
                      <tr>
                        {/* CO headers for Total Mark Obtained */}
                        {clos.map((clo, idx) => {
                          const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                          return <th key={`obt-co-${idx}`}>{coNumber}</th>;
                        })}
                        {/* CO headers for Total Marks Distribution */}
                        {clos.map((clo, idx) => {
                          const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                          return <th key={`dist-co-${idx}`}>{coNumber}</th>;
                        })}
                        {/* CO headers for CO Attainment */}
                        {clos.map((clo, idx) => {
                          const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                          return <th key={`theory-attain-co-${idx}`} style={{ backgroundColor: '#16a085', color: '#fff' }}>{coNumber}</th>;
                        })}
                      </tr>
                      <tr>
                        <th style={{ fontSize: '13px', fontWeight: '600' }}>CO msrd</th>
                        {/* CO msrd row for Total Mark Obtained */}
                        {clos.map((clo, coIdx) => {
                          const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                          // Calculate total distribution across all students (same way as displayed in table)
                          let totalDistribution = 0;
                          const factoredTotals = calculateFactoredCOTotals();
                          const ctCoTotal = factoredTotals[coNumber] || 0;
                          const factoredAssignmentTotals = calculateFactoredAssignmentCOTotals();
                          const assignmentCoTotal = factoredAssignmentTotals[coNumber] || 0;

                          coCalcData.forEach(student => {
                            const sectionADist = student.sectionA.marksDistribution[coNumber] || 0;
                            const sectionBDist = student.sectionB.marksDistribution[coNumber] || 0;
                            const attendance = student.attendance || 0;
                            totalDistribution += sectionADist + sectionBDist + ctCoTotal + assignmentCoTotal + attendance;
                          });
                          // CO msrd is 1 if totalDistribution > 0, otherwise 0
                          const coMsrd = totalDistribution > 0 ? 1 : 0;
                          return (
                            <th key={`msrd-${coIdx}`} style={{ fontSize: '13px', fontWeight: '600' }}>
                              {coMsrd}
                            </th>
                          );
                        })}

                        {/* Empty cells for Total Marks Distribution */}
                        {clos.map((clo, coIdx) => {
                          return <th key={`msrd-empty-${coIdx}`}></th>;
                        })}

                        {/* Empty cells for CO Attainment */}
                        {clos.map((clo, coIdx) => {
                          return <th key={`theory-attain-msrd-${coIdx}`} style={{ backgroundColor: '#16a085', borderLeft: 'none', borderRight: 'none' }}></th>;
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {/* Student rows */}
                      {coCalcData.map((studentRow, studentIdx) => {
                        return (
                          <tr key={studentIdx}>
                            <td className="roll-cell">{studentRow.rollNumber}</td>

                            {/* Total Mark Obtained for each CO */}
                            {clos.map((clo, coIdx) => {
                              const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                              // Sum: Section A obtained + Section B obtained + CT (obtained + distribution) + Assignment (obtained + distribution)
                              const sectionAObt = studentRow.sectionA.marksObtained[coNumber] || 0;
                              const sectionBObt = studentRow.sectionB.marksObtained[coNumber] || 0;
                              const ctObt = getStudentCTFactoredMarks(studentRow.rollNumber, coNumber);
                              const assignObt = getStudentAssignmentFactoredMarks(studentRow.rollNumber, coNumber);
                              const marks = sectionAObt + sectionBObt + ctObt + assignObt;
                              return (
                                <td key={`total-obt-${coIdx}`} style={{ textAlign: 'center' }}>
                                  {formatNumber(marks)}
                                </td>
                              );
                            })}

                            {/* Total Marks Distribution for each CO */}
                            {clos.map((clo, coIdx) => {
                              const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                              const sectionADist = studentRow.sectionA.marksDistribution[coNumber] || 0;
                              const sectionBDist = studentRow.sectionB.marksDistribution[coNumber] || 0;
                              const factoredTotals = calculateFactoredCOTotals();
                              const ctCoTotal = factoredTotals[coNumber] || 0;
                              const factoredAssignmentTotals = calculateFactoredAssignmentCOTotals();
                              const assignmentCoTotal = factoredAssignmentTotals[coNumber] || 0;
                              const attendance = studentRow.attendance || 0;
                              const marks = sectionADist + sectionBDist + ctCoTotal + assignmentCoTotal + attendance;
                              return (
                                <td key={`total-dist-${coIdx}`} style={{ textAlign: 'center' }}>
                                  {formatNumber(marks)}
                                </td>
                              );
                            })}

                            {/* CO Attainment percentage for each CO */}
                            {clos.map((clo, coIdx) => {
                              const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                              // Calculate Total Mark Obtained
                              const sectionAObt = studentRow.sectionA.marksObtained[coNumber] || 0;
                              const sectionBObt = studentRow.sectionB.marksObtained[coNumber] || 0;
                              const ctObt = getStudentCTFactoredMarks(studentRow.rollNumber, coNumber);
                              const assignObt = getStudentAssignmentFactoredMarks(studentRow.rollNumber, coNumber);
                              const totalMarksObtained = sectionAObt + sectionBObt + ctObt + assignObt;

                              // Calculate Total Marks Distribution
                              const sectionADist = studentRow.sectionA.marksDistribution[coNumber] || 0;
                              const sectionBDist = studentRow.sectionB.marksDistribution[coNumber] || 0;
                              const factoredTotals = calculateFactoredCOTotals();
                              const ctCoTotal = factoredTotals[coNumber] || 0;
                              const factoredAssignmentTotals = calculateFactoredAssignmentCOTotals();
                              const assignmentCoTotal = factoredAssignmentTotals[coNumber] || 0;
                              const attendance = studentRow.attendance || 0;
                              const totalMarksDistribution = sectionADist + sectionBDist + ctCoTotal + assignmentCoTotal + attendance;

                              // CO Attainment = (Total Mark Obtained / Total Marks Distribution) * 100
                              const percentage = totalMarksDistribution > 0 ? parseFloat(((totalMarksObtained / totalMarksDistribution) * 100).toFixed(4)) : 0;
                              return (
                                <td key={`theory-attain-${coIdx}`} style={{ textAlign: 'center', backgroundColor: '#a8e6d7' }}>
                                  {formatNumber(percentage)}%
                                </td>
                              );
                            })}

                            {/* Total */}
                            <td style={{ textAlign: 'center', fontWeight: '700', backgroundColor: '#d5f4e6', border: '2px solid #138d75', fontSize: '14px' }}>
                              {(() => {
                                let total = 0;
                                // Get attendance
                                const attnStudent = attnAssignObtainedRows.find(s =>
                                  String(s.rollNumber || '').trim().toLowerCase() ===
                                  String(studentRow.rollNumber || '').trim().toLowerCase()
                                );
                                const attendance = attnStudent ? (attnStudent.attendance || 0) : 0;

                                // Sum total marks obtained for all COs (from CO-PO percentage table)
                                clos.forEach(clo => {
                                  const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                                  const sectionAObt = studentRow.sectionA.marksObtained[coNumber] || 0;
                                  const sectionBObt = studentRow.sectionB.marksObtained[coNumber] || 0;
                                  const ctObt = getStudentCTFactoredMarks(studentRow.rollNumber, coNumber);
                                  const assignObt = getStudentAssignmentFactoredMarks(studentRow.rollNumber, coNumber);
                                  total += sectionAObt + sectionBObt + ctObt + assignObt;
                                });

                                total += attendance;
                                return formatNumber(total);
                              })()}
                            </td>

                            {/* Letter Grade */}
                            <td style={{
                              textAlign: 'center',
                              fontWeight: '700',
                              fontSize: '15px',
                              border: (() => {
                                let total = 0;
                                const attnStudent = attnAssignObtainedRows.find(s =>
                                  String(s.rollNumber || '').trim().toLowerCase() ===
                                  String(studentRow.rollNumber || '').trim().toLowerCase()
                                );
                                const attendance = attnStudent ? (attnStudent.attendance || 0) : 0;

                                // Sum total marks obtained for all COs (from CO-PO percentage table)
                                clos.forEach(clo => {
                                  const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                                  const sectionAObt = studentRow.sectionA.marksObtained[coNumber] || 0;
                                  const sectionBObt = studentRow.sectionB.marksObtained[coNumber] || 0;
                                  const ctObt = getStudentCTFactoredMarks(studentRow.rollNumber, coNumber);
                                  const assignObt = getStudentAssignmentFactoredMarks(studentRow.rollNumber, coNumber);
                                  total += sectionAObt + sectionBObt + ctObt + assignObt;
                                });

                                total += attendance;

                                // Border color - darker shade of background
                                if (total < 119) return '2px solid #c82333'; // F - dark red
                                else if (total < 134) return '2px solid #ff9800'; // D - dark orange
                                else if (total < 149) return '2px solid #ffc107'; // C - dark yellow
                                else if (total < 164) return '2px solid #81c784'; // C+ - medium green
                                else if (total < 179) return '2px solid #66bb6a'; // B- - darker green
                                else if (total < 194) return '2px solid #4caf50'; // B - green
                                else if (total < 209) return '2px solid #43a047'; // B+ - darker green
                                else if (total < 224) return '2px solid #388e3c'; // A- - even darker green
                                else if (total < 239) return '2px solid #2e7d32'; // A - very dark green
                                else return '2px solid #1b5e20'; // A+ - darkest green
                              })(),
                              backgroundColor: (() => {
                                let total = 0;
                                const attnStudent = attnAssignObtainedRows.find(s =>
                                  String(s.rollNumber || '').trim().toLowerCase() ===
                                  String(studentRow.rollNumber || '').trim().toLowerCase()
                                );
                                const attendance = attnStudent ? (attnStudent.attendance || 0) : 0;

                                // Sum total marks obtained for all COs (from CO-PO percentage table)
                                clos.forEach(clo => {
                                  const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                                  const sectionAObt = studentRow.sectionA.marksObtained[coNumber] || 0;
                                  const sectionBObt = studentRow.sectionB.marksObtained[coNumber] || 0;
                                  const ctObt = getStudentCTFactoredMarks(studentRow.rollNumber, coNumber);
                                  const assignObt = getStudentAssignmentFactoredMarks(studentRow.rollNumber, coNumber);
                                  total += sectionAObt + sectionBObt + ctObt + assignObt;
                                });

                                total += attendance;

                                // Color based on grade
                                if (total < 119) return '#f8d7da'; // F - light red
                                else if (total < 134) return '#ffe5cc'; // D - light orange
                                else if (total < 149) return '#fff3cd'; // C - light yellow
                                else if (total < 164) return '#e7f5e0'; // C+ - very light green
                                else if (total < 179) return '#d4edda'; // B- - light green
                                else if (total < 194) return '#c3e6cb'; // B - green
                                else if (total < 209) return '#b2dfbb'; // B+ - medium green
                                else if (total < 224) return '#a1d9ab'; // A- - darker green
                                else if (total < 239) return '#8fd19e'; // A - even darker green
                                else return '#7ec98f'; // A+ - darkest green
                              })(),
                              color: (() => {
                                let total = 0;
                                const attnStudent = attnAssignObtainedRows.find(s =>
                                  String(s.rollNumber || '').trim().toLowerCase() ===
                                  String(studentRow.rollNumber || '').trim().toLowerCase()
                                );
                                const attendance = attnStudent ? (attnStudent.attendance || 0) : 0;

                                // Sum total marks obtained for all COs (from CO-PO percentage table)
                                clos.forEach(clo => {
                                  const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                                  const sectionAObt = studentRow.sectionA.marksObtained[coNumber] || 0;
                                  const sectionBObt = studentRow.sectionB.marksObtained[coNumber] || 0;
                                  const ctObt = getStudentCTFactoredMarks(studentRow.rollNumber, coNumber);
                                  const assignObt = getStudentAssignmentFactoredMarks(studentRow.rollNumber, coNumber);
                                  total += sectionAObt + sectionBObt + ctObt + assignObt;
                                });

                                total += attendance;

                                // F should have red text
                                if (total < 119) return '#c82333';
                                else return '#2c3e50';
                              })()
                            }}>
                              {(() => {
                                let total = 0;
                                const attnStudent = attnAssignObtainedRows.find(s =>
                                  String(s.rollNumber || '').trim().toLowerCase() ===
                                  String(studentRow.rollNumber || '').trim().toLowerCase()
                                );
                                const attendance = attnStudent ? (attnStudent.attendance || 0) : 0;

                                // Sum total marks obtained for all COs (from CO-PO percentage table)
                                clos.forEach(clo => {
                                  const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                                  const sectionAObt = studentRow.sectionA.marksObtained[coNumber] || 0;
                                  const sectionBObt = studentRow.sectionB.marksObtained[coNumber] || 0;
                                  const ctObt = getStudentCTFactoredMarks(studentRow.rollNumber, coNumber);
                                  const assignObt = getStudentAssignmentFactoredMarks(studentRow.rollNumber, coNumber);
                                  total += sectionAObt + sectionBObt + ctObt + assignObt;
                                });

                                total += attendance;

                                // Grade calculation
                                if (total < 119) return 'F';
                                else if (total < 134) return 'D';
                                else if (total < 149) return 'C';
                                else if (total < 164) return 'C+';
                                else if (total < 179) return 'B-';
                                else if (total < 194) return 'B';
                                else if (total < 209) return 'B+';
                                else if (total < 224) return 'A-';
                                else if (total < 239) return 'A';
                                else return 'A+';
                              })()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Third Table: CT and Assignment Marks */}
            <section className="ct-assignment-section" style={{ marginTop: '30px' }}>
              <h2>CT and Assignment Marks</h2>

              {clos.length === 0 && (
                <p style={{ padding: '20px', color: '#7f8c8d' }}>Loading course outcomes...</p>
              )}

              {clos.length > 0 && coCalcData.length === 0 && (
                <p style={{ padding: '20px', color: '#7f8c8d' }}>No student data available.</p>
              )}

              {clos.length > 0 && coCalcData.length > 0 && (
                <div className="table-wrapper">
                  <table className="ct-assignment-table">
                    <thead>
                      <tr>
                        <th rowSpan="3">Roll</th>
                        <th colSpan={clos.length}>CT</th>
                        <th colSpan={clos.length}>Assignment</th>
                        <th rowSpan="4">Attn</th>
                      </tr>
                      <tr>
                        <th colSpan={clos.length}>Mark Obtained + Distribution</th>
                        <th colSpan={clos.length}>Mark Obtained + Distribution</th>
                      </tr>
                      <tr>
                        {/* CT CO headers */}
                        {clos.map((clo, idx) => {
                          const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                          return <th key={`ct-co-${idx}`}>{coNumber}</th>;
                        })}
                        {/* Assignment CO headers */}
                        {clos.map((clo, idx) => {
                          const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                          return <th key={`assign-co-${idx}`}>{coNumber}</th>;
                        })}
                      </tr>
                      <tr>
                        <th style={{ fontSize: '13px', fontWeight: '600' }}>CO msrd</th>
                        {/* CT CO msrd - reflects CO Total from Generated Table */}
                        {clos.map((clo, coIdx) => {
                          const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                          const factoredTotals = calculateFactoredCOTotals();
                          const coTotal = factoredTotals[coNumber] || 0;
                          return (
                            <th key={`ct-msrd-${coIdx}`} style={{ fontSize: '13px', fontWeight: '600' }}>
                              {formatNumber(coTotal)}
                            </th>
                          );
                        })}
                        {/* Assignment CO msrd */}
                        {clos.map((clo, coIdx) => {
                          const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                          const factoredTotals = calculateFactoredAssignmentCOTotals();
                          const coTotal = factoredTotals[coNumber] || 0;
                          return (
                            <th key={`assign-msrd-${coIdx}`} style={{ fontSize: '13px', fontWeight: '600' }}>
                              {formatNumber(coTotal)}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {coCalcData.map((studentRow, studentIdx) => {
                        return (
                          <tr key={studentIdx}>
                            <td className="roll-cell">{studentRow.rollNumber}</td>

                            {/* CT - Mark Obtained (Factored) */}
                            {clos.map((clo, coIdx) => {
                              const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                              const obtained = getStudentCTFactoredMarks(studentRow.rollNumber, coNumber);
                              return (
                                <td key={`ct-${coIdx}`} style={{ textAlign: 'center' }}>
                                  {formatNumber(obtained)}
                                </td>
                              );
                            })}

                            {/* Assignment - Mark Obtained (Factored from Generated Table) */}
                            {clos.map((clo, coIdx) => {
                              const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                              const obtained = getStudentAssignmentFactoredMarks(studentRow.rollNumber, coNumber);
                              return (
                                <td key={`assign-${coIdx}`} style={{ textAlign: 'center' }}>
                                  {formatNumber(obtained)}
                                </td>
                              );
                            })}

                            {/* Attendance */}
                            <td style={{ textAlign: 'center', fontWeight: '600' }}>
                              {(() => {
                                const attnStudent = attnAssignObtainedRows.find(s =>
                                  String(s.rollNumber || '').trim().toLowerCase() ===
                                  String(studentRow.rollNumber || '').trim().toLowerCase()
                                );
                                return formatNumber(attnStudent ? (attnStudent.attendance || 0) : 0);
                              })()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Fourth Table: CO-PO percentage (theory + Lab) */}
            <section className="co-po-combined-section" style={{ marginTop: '30px' }}>
              <h2>CO - PO percentage (theory + Lab)</h2>

              {clos.length === 0 && (
                <p style={{ padding: '20px', color: '#7f8c8d' }}>Loading course outcomes...</p>
              )}

              {clos.length > 0 && coCalcData.length === 0 && (
                <p style={{ padding: '20px', color: '#7f8c8d' }}>No student data available.</p>
              )}

              {clos.length > 0 && coCalcData.length > 0 && (
                <div className="table-wrapper">
                  <table className="co-po-percentage-table">
                    <thead>
                      <tr>
                        <th rowSpan="2">Roll</th>
                        <th colSpan={clos.length}>Total Mark Obtained</th>
                        <th colSpan={clos.length}>Total Marks Distribution</th>
                        <th colSpan={clos.length} style={{ backgroundColor: '#16a085', color: '#fff' }}>CO attainment (theory+Lab)</th>
                      </tr>
                      <tr>
                        {/* CO headers for Total Mark Obtained */}
                        {clos.map((clo, idx) => {
                          const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                          return <th key={`combined-obt-co-${idx}`}>{coNumber}</th>;
                        })}
                        {/* CO headers for Total Marks Distribution */}
                        {clos.map((clo, idx) => {
                          const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                          return <th key={`combined-dist-co-${idx}`}>{coNumber}</th>;
                        })}
                        {/* CO headers for CO attainment */}
                        {clos.map((clo, idx) => {
                          const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                          return <th key={`combined-attain-co-${idx}`} style={{ backgroundColor: '#16a085', color: '#fff' }}>{coNumber}</th>;
                        })}
                      </tr>
                      <tr>
                        <th style={{ fontSize: '13px', fontWeight: '600' }}>CO msrd</th>
                        {/* CO msrd row for Total Mark Obtained */}
                        {clos.map((clo, coIdx) => {
                          const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                          // Calculate total distribution across all students (theory + lab)
                          let totalDistribution = 0;
                          coCalcData.forEach(student => {
                            const theoryDist = student.total.marksDistribution[coNumber] || 0;
                            const labActivityStudent = labActivityObtainedRows.find(s => s.rollNumber === student.rollNumber);
                            const labDist = labActivityStudent ? getLabActivityStudentCOMappedMarks(labActivityStudent, coNumber) : 0;
                            totalDistribution += theoryDist + labDist;
                          });
                          // CO msrd is 1 if totalDistribution > 0, otherwise 0
                          const coMsrd = totalDistribution > 0 ? 1 : 0;
                          return (
                            <th key={`combined-msrd-${coIdx}`} style={{ fontSize: '13px', fontWeight: '600' }}>
                              {coMsrd}
                            </th>
                          );
                        })}

                        {/* CO msrd for Total Marks Distribution */}
                        {clos.map((clo, coIdx) => {
                          const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                          // Get the total from rightmost CO-wise obtained marks (CO Mapped Activity Marks) from Lab Activity Obtained table
                          const totalLabActivityObtained = labActivityObtainedRows.reduce((sum, studentRow) => {
                            return sum + getLabActivityStudentCOMappedMarks(studentRow, coNumber);
                          }, 0);
                          return (
                            <th key={`combined-msrd-dist-${coIdx}`} style={{ fontSize: '13px', fontWeight: '600' }}>
                              {formatNumber(totalLabActivityObtained)}
                            </th>
                          );
                        })}

                        {/* Empty cells for CO attainment */}
                        {clos.map((clo, coIdx) => {
                          return <th key={`combined-msrd-attain-${coIdx}`} style={{ backgroundColor: '#16a085', borderLeft: 'none', borderRight: 'none' }}></th>;
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {/* Student rows */}
                      {coCalcData.map((studentRow, studentIdx) => {
                        return (
                          <tr key={studentIdx}>
                            <td className="roll-cell">{studentRow.rollNumber}</td>

                            {/* Total Mark Obtained for each CO (Theory + Lab) */}
                            {clos.map((clo, coIdx) => {
                              const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                              const theoryMarks = studentRow.total.marksObtained[coNumber] || 0;
                              // Get lab activity marks from rightmost CO-wise obtained marks
                              const labActivityStudent = labActivityObtainedRows.find(s => s.rollNumber === studentRow.rollNumber);
                              const labMarks = getLabActivityStudentCOMappedMarks(labActivityStudent, coNumber);
                              const totalMarks = theoryMarks + labMarks;
                              return (
                                <td key={`combined-total-obt-${coIdx}`} style={{ textAlign: 'center' }}>
                                  {formatNumber(totalMarks)}
                                </td>
                              );
                            })}

                            {/* Total Marks Distribution for each CO (Theory + Lab) */}
                            {clos.map((clo, coIdx) => {
                              const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                              const theoryDist = studentRow.total.marksDistribution[coNumber] || 0;
                              // Get lab activity marks from rightmost CO-wise obtained marks
                              const labActivityStudent = labActivityObtainedRows.find(s => s.rollNumber === studentRow.rollNumber);
                              const labDist = getLabActivityStudentCOMappedMarks(labActivityStudent, coNumber);
                              const totalDist = theoryDist + labDist;
                              return (
                                <td key={`combined-total-dist-${coIdx}`} style={{ textAlign: 'center' }}>
                                  {formatNumber(totalDist)}
                                </td>
                              );
                            })}

                            {/* CO attainment percentage for each CO */}
                            {clos.map((clo, coIdx) => {
                              const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                              // Calculate Total Mark Obtained (Theory + Lab)
                              const theoryMarks = studentRow.total.marksObtained[coNumber] || 0;
                              const labActivityStudent = labActivityObtainedRows.find(s => s.rollNumber === studentRow.rollNumber);
                              const labMarks = getLabActivityStudentCOMappedMarks(labActivityStudent, coNumber);
                              const totalMarksObtained = theoryMarks + labMarks;

                              // Calculate Total Marks Distribution (Theory + Lab)
                              const theoryDist = studentRow.total.marksDistribution[coNumber] || 0;
                              const labDist = getLabActivityStudentCOMappedMarks(labActivityStudent, coNumber);
                              const totalMarksDistribution = theoryDist + labDist;

                              // CO attainment = Total Mark Obtained / Total Marks Distribution
                              const percentage = totalMarksDistribution > 0 ? parseFloat(((totalMarksObtained / totalMarksDistribution) * 100).toFixed(4)) : 0;
                              return (
                                <td key={`combined-attain-${coIdx}`} style={{ textAlign: 'center', backgroundColor: '#a8e6d7' }}>
                                  {formatNumber(percentage)}%
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        );
      })()}

      {/* CO-PO Mapping Table */}
      {(() => {
        if (selectedSheet !== 'COPOMap') return null;

        return (
          <>
            <section className="co-po-map-section">
              <h3>CO-PO Mapping Table</h3>

              {!clos || clos.length === 0 ? (
                <p>No Course Outcomes available. Please load course profile data.</p>
              ) : !programOutcomes || programOutcomes.length === 0 ? (
                <p>Loading Program Outcomes...</p>
              ) : (
                <>
                  <div className="table-container">
                    <table className="co-po-map-table">
                      <thead>
                        <tr>
                          <th style={{ backgroundColor: '#2980b9', color: 'white' }}>CO/PO</th>
                          {programOutcomes.map((po, idx) => (
                            <th key={idx} style={{ backgroundColor: '#2980b9', color: 'white' }}>
                              {po.poCode || `PO${idx + 1}`}
                            </th>
                          ))}
                          <th style={{ backgroundColor: '#2980b9', color: 'white' }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {clos.map((clo, coIdx) => {
                          const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');

                          // Parse ploAssessed field which contains comma-separated PO numbers
                          // Expected format: "1, 2, 5" or "1, 3, 7, 11"
                          const ploAssessed = clo.ploAssessed || '';
                          const mappedPOs = new Set();


                          if (ploAssessed && ploAssessed.trim()) {
                            // Split by comma and parse numbers
                            const parts = ploAssessed.split(',').map(p => p.trim());
                            parts.forEach(part => {
                              const poNum = parseInt(part);
                              if (!isNaN(poNum) && poNum > 0) {
                                mappedPOs.add(poNum);
                              }
                            });
                          }


                          // Calculate row total
                          const rowTotal = mappedPOs.size;

                          return (
                            <tr key={coIdx}>
                              <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#e8f4f8' }}>
                                {coNumber}
                              </td>
                              {programOutcomes.map((po, poIdx) => {
                                const poNumber = poIdx + 1; // PO1, PO2, PO3, ...
                                const isMapped = mappedPOs.has(poNumber);

                                return (
                                  <td
                                    key={poIdx}
                                    style={{
                                      textAlign: 'center',
                                      backgroundColor: isMapped ? '#d5f4e6' : 'white',
                                      fontWeight: isMapped ? 'bold' : 'normal'
                                    }}
                                  >
                                    {isMapped ? '1' : '-'}
                                  </td>
                                );
                              })}
                              <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#fff3cd' }}>
                                {rowTotal}
                              </td>
                            </tr>
                          );
                        })}

                        {/* Column Totals Row */}
                        <tr>
                          <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#e8f4f8' }}>
                            Total
                          </td>
                          {programOutcomes.map((po, poIdx) => {
                            const poNumber = poIdx + 1;
                            // Count how many COs map to this PO
                            let columnTotal = 0;
                            clos.forEach(clo => {
                              const ploAssessed = clo.ploAssessed || '';
                              if (ploAssessed && ploAssessed.trim()) {
                                const parts = ploAssessed.split(',').map(p => p.trim());
                                parts.forEach(part => {
                                  const poNum = parseInt(part);
                                  if (poNum === poNumber) {
                                    columnTotal++;
                                  }
                                });
                              }
                            });

                            return (
                              <td
                                key={poIdx}
                                style={{
                                  textAlign: 'center',
                                  fontWeight: 'bold',
                                  backgroundColor: '#fff3cd'
                                }}
                              >
                                {columnTotal}
                              </td>
                            );
                          })}
                          <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#fff3cd' }}>
                            -
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Normalized CO-PO Mapping Table (divided by column totals) */}
                  <div className="table-container" style={{ marginTop: '30px' }}>
                    <h4 style={{ marginBottom: '15px', color: '#2c3e50' }}>Normalized CO-PO Mapping (Contribution per PO)</h4>
                    <table className="co-po-map-table">
                      <thead>
                        <tr>
                          <th style={{ backgroundColor: '#2980b9', color: 'white' }}>CO/PO</th>
                          {programOutcomes.map((po, idx) => (
                            <th key={idx} style={{ backgroundColor: '#2980b9', color: 'white' }}>
                              {po.poCode || `PO${idx + 1}`}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          // Calculate column totals first
                          const columnTotals = programOutcomes.map((po, poIdx) => {
                            const poNumber = poIdx + 1;
                            let columnTotal = 0;
                            clos.forEach(clo => {
                              const ploAssessed = clo.ploAssessed || '';
                              if (ploAssessed && ploAssessed.trim()) {
                                const parts = ploAssessed.split(',').map(p => p.trim());
                                parts.forEach(part => {
                                  const poNum = parseInt(part);
                                  if (poNum === poNumber) {
                                    columnTotal++;
                                  }
                                });
                              }
                            });
                            return columnTotal;
                          });

                          return clos.map((clo, coIdx) => {
                            const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');

                            const ploAssessed = clo.ploAssessed || '';
                            const mappedPOs = new Set();

                            if (ploAssessed && ploAssessed.trim()) {
                              const parts = ploAssessed.split(',').map(p => p.trim());
                              parts.forEach(part => {
                                const poNum = parseInt(part);
                                if (!isNaN(poNum) && poNum > 0) {
                                  mappedPOs.add(poNum);
                                }
                              });
                            }

                            return (
                              <tr key={coIdx}>
                                <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#e8f4f8' }}>
                                  {coNumber}
                                </td>
                                {programOutcomes.map((po, poIdx) => {
                                  const poNumber = poIdx + 1;
                                  const isMapped = mappedPOs.has(poNumber);
                                  const columnTotal = columnTotals[poIdx];
                                  const normalizedValue = (isMapped && columnTotal > 0) ? (1 / columnTotal) : 0;

                                  return (
                                    <td
                                      key={poIdx}
                                      style={{
                                        textAlign: 'center',
                                        backgroundColor: isMapped ? '#d5f4e6' : 'white',
                                        fontWeight: isMapped ? 'bold' : 'normal'
                                      }}
                                    >
                                      {normalizedValue > 0 ? parseFloat(normalizedValue.toFixed(4)) : '-'}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          });
                        })()}

                        {/* Column Totals Row - should sum to 1.0 for each column */}
                        <tr>
                          <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#e8f4f8' }}>
                            Total
                          </td>
                          {programOutcomes.map((po, poIdx) => {
                            const poNumber = poIdx + 1;
                            let columnSum = 0;

                            // Get original column total
                            let originalColumnTotal = 0;
                            clos.forEach(clo => {
                              const ploAssessed = clo.ploAssessed || '';
                              if (ploAssessed && ploAssessed.trim()) {
                                const parts = ploAssessed.split(',').map(p => p.trim());
                                parts.forEach(part => {
                                  const poNum = parseInt(part);
                                  if (poNum === poNumber) {
                                    originalColumnTotal++;
                                  }
                                });
                              }
                            });

                            // Sum normalized values
                            clos.forEach(clo => {
                              const ploAssessed = clo.ploAssessed || '';
                              if (ploAssessed && ploAssessed.trim()) {
                                const parts = ploAssessed.split(',').map(p => p.trim());
                                parts.forEach(part => {
                                  const poNum = parseInt(part);
                                  if (poNum === poNumber && originalColumnTotal > 0) {
                                    columnSum += 1 / originalColumnTotal;
                                  }
                                });
                              }
                            });

                            return (
                              <td
                                key={poIdx}
                                style={{
                                  textAlign: 'center',
                                  fontWeight: 'bold',
                                  backgroundColor: '#fff3cd'
                                }}
                              >
                                {columnSum > 0 ? parseFloat(columnSum.toFixed(4)) : '-'}
                              </td>
                            );
                          })}
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Combined CO-PO Mapping Table (Theory + Lab) */}
                  {combinedCOPOMatrix && matchingCourseCode && (
                    <>
                      <div className="table-container" style={{ marginTop: '30px' }}>
                        <h4 style={{ marginBottom: '15px', color: '#2c3e50' }}>
                          Combined CO-PO Mapping ({selectedCourse.courseCode} + {matchingCourseCode})
                        </h4>
                        <table className="co-po-map-table">
                          <thead>
                            <tr>
                              <th style={{ backgroundColor: '#2980b9', color: 'white' }}>CO/PO</th>
                              {programOutcomes.map((po, idx) => (
                                <th key={idx} style={{ backgroundColor: '#2980b9', color: 'white' }}>
                                  {po.poCode || `PO${idx + 1}`}
                                </th>
                              ))}
                              <th style={{ backgroundColor: '#2980b9', color: 'white' }}>Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.keys(combinedCOPOMatrix).sort().map((coNumber, coIdx) => {
                              const mappedPOs = combinedCOPOMatrix[coNumber];
                              const rowTotal = mappedPOs.length;

                              return (
                                <tr key={coIdx}>
                                  <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#e8f4f8' }}>
                                    {coNumber}
                                  </td>
                                  {programOutcomes.map((po, poIdx) => {
                                    const poNumber = poIdx + 1;
                                    const isMapped = mappedPOs.includes(poNumber);

                                    return (
                                      <td
                                        key={poIdx}
                                        style={{
                                          textAlign: 'center',
                                          backgroundColor: isMapped ? '#d5f4e6' : 'white',
                                          fontWeight: isMapped ? 'bold' : 'normal'
                                        }}
                                      >
                                        {isMapped ? '1' : '-'}
                                      </td>
                                    );
                                  })}
                                  <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#fff3cd' }}>
                                    {rowTotal}
                                  </td>
                                </tr>
                              );
                            })}

                            {/* Column Totals Row */}
                            <tr>
                              <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#e8f4f8' }}>
                                Total
                              </td>
                              {programOutcomes.map((po, poIdx) => {
                                const poNumber = poIdx + 1;
                                let columnTotal = 0;
                                Object.keys(combinedCOPOMatrix).forEach(coNumber => {
                                  if (combinedCOPOMatrix[coNumber].includes(poNumber)) {
                                    columnTotal++;
                                  }
                                });

                                return (
                                  <td
                                    key={poIdx}
                                    style={{
                                      textAlign: 'center',
                                      fontWeight: 'bold',
                                      backgroundColor: '#fff3cd'
                                    }}
                                  >
                                    {columnTotal}
                                  </td>
                                );
                              })}
                              <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#fff3cd' }}>
                                -
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* Normalized Combined CO-PO Mapping Table */}
                      <div className="table-container" style={{ marginTop: '30px' }}>
                        <h4 style={{ marginBottom: '15px', color: '#2c3e50' }}>
                          Normalized Combined CO-PO Mapping ({selectedCourse.courseCode} + {matchingCourseCode})
                        </h4>
                        <table className="co-po-map-table">
                          <thead>
                            <tr>
                              <th style={{ backgroundColor: '#2980b9', color: 'white' }}>CO/PO</th>
                              {programOutcomes.map((po, idx) => (
                                <th key={idx} style={{ backgroundColor: '#2980b9', color: 'white' }}>
                                  {po.poCode || `PO${idx + 1}`}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {(() => {
                              // First, calculate column totals
                              const columnTotals = programOutcomes.map((po, poIdx) => {
                                const poNumber = poIdx + 1;
                                let total = 0;
                                Object.keys(combinedCOPOMatrix).forEach(coNumber => {
                                  if (combinedCOPOMatrix[coNumber].includes(poNumber)) {
                                    total++;
                                  }
                                });
                                return total;
                              });

                              return (
                                <>
                                  {Object.keys(combinedCOPOMatrix).sort().map((coNumber, coIdx) => {
                                    const mappedPOs = combinedCOPOMatrix[coNumber];

                                    return (
                                      <tr key={coIdx}>
                                        <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#e8f4f8' }}>
                                          {coNumber}
                                        </td>
                                        {programOutcomes.map((po, poIdx) => {
                                          const poNumber = poIdx + 1;
                                          const isMapped = mappedPOs.includes(poNumber);
                                          const columnTotal = columnTotals[poIdx];
                                          const normalizedValue = isMapped && columnTotal > 0
                                            ? parseFloat((1 / columnTotal).toFixed(4))
                                            : 0;

                                          return (
                                            <td
                                              key={poIdx}
                                              style={{
                                                textAlign: 'center',
                                                backgroundColor: isMapped ? '#d5f4e6' : 'white',
                                                fontWeight: isMapped ? 'bold' : 'normal'
                                              }}
                                            >
                                              {isMapped ? normalizedValue : '-'}
                                            </td>
                                          );
                                        })}
                                      </tr>
                                    );
                                  })}

                                  {/* Column Totals Row */}
                                  <tr>
                                    <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#e8f4f8' }}>
                                      Total
                                    </td>
                                    {columnTotals.map((total, poIdx) => {
                                      // Sum of normalized values in each column should equal 1
                                      return (
                                        <td
                                          key={poIdx}
                                          style={{
                                            textAlign: 'center',
                                            fontWeight: 'bold',
                                            backgroundColor: '#fff3cd'
                                          }}
                                        >
                                          {total > 0 ? parseFloat((1).toFixed(4)) : '-'}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                </>
                              );
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </>
              )}
            </section>
          </>
        );
      })()}

      {/* PO Calculation Max Tables */}
      {(() => {
        if (selectedSheet !== 'POCalcMax') return null;

        // Determine if course is theory or lab based on last digit of course code
        const courseCode = selectedCourse?.courseCode || '';
        const lastDigit = parseInt(courseCode.charAt(courseCode.length - 1));
        const isTheoryCourse = lastDigit % 2 === 1; // odd = theory
        const isLabCourse = lastDigit % 2 === 0; // even = lab

        return (
          <>
            <section className="po-calc-max-section">
              <h3>PO Calculation Max</h3>

              {!programOutcomes || programOutcomes.length === 0 ? (
                <p>Loading Program Outcomes...</p>
              ) : !poCalcStudents || poCalcStudents.length === 0 ? (
                <p>Loading Students...</p>
              ) : (
                <>
                  {/* Theory Only Table - Show only in theory courses */}
                  {isTheoryCourse && (
                    <div className="table-container" style={{ marginTop: '20px' }}>
                      <h4 style={{ marginBottom: '15px', color: '#2c3e50' }}>Theory only</h4>
                      <table className="co-po-map-table">
                        <thead>
                          <tr>
                            <th style={{ backgroundColor: '#2980b9', color: 'white' }}>Roll</th>
                            {programOutcomes.map((po, idx) => (
                              <th key={idx} style={{ backgroundColor: '#2980b9', color: 'white' }}>
                                {po.poCode || `PO${idx + 1}`}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {poCalcStudents.map((student, sIdx) => (
                            <tr key={sIdx}>
                              <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#e8f4f8' }}>
                                {student.rollNumber}
                              </td>
                              {programOutcomes.map((po, pIdx) => (
                                <td key={pIdx} style={{ textAlign: 'center' }}>-</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Lab Only Table - Show only in lab courses */}
                  {isLabCourse && (
                    <div className="table-container" style={{ marginTop: '30px' }}>
                      <h4 style={{ marginBottom: '15px', color: '#2c3e50' }}>Lab Only</h4>
                      <table className="co-po-map-table">
                        <thead>
                          <tr>
                            <th style={{ backgroundColor: '#2980b9', color: 'white' }}>Roll</th>
                            {programOutcomes.map((po, idx) => (
                              <th key={idx} style={{ backgroundColor: '#2980b9', color: 'white' }}>
                                {po.poCode || `PO${idx + 1}`}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {poCalcStudents.map((student, sIdx) => (
                            <tr key={sIdx}>
                              <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#e8f4f8' }}>
                                {student.rollNumber}
                              </td>
                              {programOutcomes.map((po, pIdx) => (
                                <td key={pIdx} style={{ textAlign: 'center' }}>-</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Theory+Lab Table */}
                  <div className="table-container" style={{ marginTop: '30px' }}>
                    <h4 style={{ marginBottom: '15px', color: '#2c3e50' }}>Theory+Lab</h4>
                    <table className="co-po-map-table">
                      <thead>
                        <tr>
                          <th style={{ backgroundColor: '#2980b9', color: 'white' }}>Roll</th>
                          {programOutcomes.map((po, idx) => (
                            <th key={idx} style={{ backgroundColor: '#2980b9', color: 'white' }}>
                              {po.poCode || `PO${idx + 1}`}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {poCalcStudents.map((student, sIdx) => (
                          <tr key={sIdx}>
                            <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#e8f4f8' }}>
                              {student.rollNumber}
                            </td>
                            {programOutcomes.map((po, pIdx) => (
                              <td key={pIdx} style={{ textAlign: 'center' }}>-</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Theory+Lab(unnorm) Table */}
                  <div className="table-container" style={{ marginTop: '30px' }}>
                    <h4 style={{ marginBottom: '15px', color: '#2c3e50' }}>Theory+Lab(unnorm)</h4>
                    <table className="co-po-map-table">
                      <thead>
                        <tr>
                          <th style={{ backgroundColor: '#2980b9', color: 'white' }}>Roll</th>
                          {programOutcomes.map((po, idx) => (
                            <th key={idx} style={{ backgroundColor: '#2980b9', color: 'white' }}>
                              {po.poCode || `PO${idx + 1}`}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {poCalcStudents.map((student, sIdx) => (
                          <tr key={sIdx}>
                            <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#e8f4f8' }}>
                              {student.rollNumber}
                            </td>
                            {programOutcomes.map((po, pIdx) => (
                              <td key={pIdx} style={{ textAlign: 'center' }}>-</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Theory+Lab(Eq Wt) Table */}
                  <div className="table-container" style={{ marginTop: '30px' }}>
                    <h4 style={{ marginBottom: '15px', color: '#2c3e50' }}>Theory+Lab(Eq Wt)</h4>
                    <table className="co-po-map-table">
                      <thead>
                        <tr>
                          <th style={{ backgroundColor: '#2980b9', color: 'white' }}>Roll</th>
                          {programOutcomes.map((po, idx) => (
                            <th key={idx} style={{ backgroundColor: '#2980b9', color: 'white' }}>
                              {po.poCode || `PO${idx + 1}`}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {poCalcStudents.map((student, sIdx) => (
                          <tr key={sIdx}>
                            <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#e8f4f8' }}>
                              {student.rollNumber}
                            </td>
                            {programOutcomes.map((po, pIdx) => (
                              <td key={pIdx} style={{ textAlign: 'center' }}>-</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>
          </>
        );
      })()}

      {/* Charts Section */}
      {(() => {
        if (selectedSheet !== 'Charts') return null;

        // Determine matching course code for theory + lab pairing
        const courseCode = selectedCourse?.courseCode || '';
        const lastDigit = parseInt(courseCode.charAt(courseCode.length - 1));
        const baseCode = courseCode.substring(0, courseCode.length - 1);
        const isTheory = lastDigit % 2 === 1;
        const theoryCourseCode = isTheory ? courseCode : baseCode + (lastDigit - 1);
        const labCourseCode = isTheory ? baseCode + (lastDigit + 1) : courseCode;

        return (
          <>
            <section className="charts-section">
              <h3>Charts</h3>

              {!clos || clos.length === 0 ? (
                <p>Loading Course Outcomes...</p>
              ) : !programOutcomes || programOutcomes.length === 0 ? (
                <p>Loading Program Outcomes...</p>
              ) : (
                <>
                  {/* CO Achievement Table */}
                  <div className="table-container" style={{ marginTop: '20px' }}>
                    <h4 style={{ marginBottom: '15px', color: '#2c3e50' }}>
                      CO Attainment of {theoryCourseCode} + {labCourseCode}
                    </h4>
                    <table className="co-po-map-table">
                      <thead>
                        <tr>
                          <th style={{ backgroundColor: '#2980b9', color: 'white' }}>Metric</th>
                          {clos.map((clo, idx) => {
                            const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                            return (
                              <th key={idx} style={{ backgroundColor: '#2980b9', color: 'white' }}>
                                {coNumber}
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#e8f4f8' }}>
                            Achieved(%)
                          </td>
                          {clos.map((clo, idx) => (
                            <td key={idx} style={{ textAlign: 'center' }}>-</td>
                          ))}
                        </tr>
                        <tr>
                          <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#e8f4f8' }}>
                            Unnorm Achieved(%)
                          </td>
                          {clos.map((clo, idx) => (
                            <td key={idx} style={{ textAlign: 'center' }}>-</td>
                          ))}
                        </tr>
                        <tr>
                          <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#e8f4f8' }}>
                            Eq. Wt. Achieved(%)
                          </td>
                          {clos.map((clo, idx) => (
                            <td key={idx} style={{ textAlign: 'center' }}>-</td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* PO Achievement Table */}
                  <div className="table-container" style={{ marginTop: '30px' }}>
                    <h4 style={{ marginBottom: '15px', color: '#2c3e50' }}>
                      PO Attainment of {theoryCourseCode} + {labCourseCode}
                    </h4>
                    <table className="co-po-map-table">
                      <thead>
                        <tr>
                          <th style={{ backgroundColor: '#2980b9', color: 'white' }}>Metric</th>
                          {programOutcomes.map((po, idx) => (
                            <th key={idx} style={{ backgroundColor: '#2980b9', color: 'white' }}>
                              {po.poCode || `PO${idx + 1}`}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#e8f4f8' }}>
                            Achieved(%)
                          </td>
                          {programOutcomes.map((po, idx) => (
                            <td key={idx} style={{ textAlign: 'center' }}>-</td>
                          ))}
                        </tr>
                        <tr>
                          <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#e8f4f8' }}>
                            Unnorm Achieved(%)
                          </td>
                          {programOutcomes.map((po, idx) => (
                            <td key={idx} style={{ textAlign: 'center' }}>-</td>
                          ))}
                        </tr>
                        <tr>
                          <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#e8f4f8' }}>
                            Eq. Wt. Achieved(%)
                          </td>
                          {programOutcomes.map((po, idx) => (
                            <td key={idx} style={{ textAlign: 'center' }}>-</td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>
          </>
        );
      })()}

      {/* CheckPO Section */}
      {(() => {
        if (selectedSheet !== 'CheckPO') return null;

        return (
          <>
            <section className="check-po-section">
              <h3>Check PO</h3>

              {!programOutcomes || programOutcomes.length === 0 ? (
                <p>Loading Program Outcomes...</p>
              ) : !poCalcStudents || poCalcStudents.length === 0 ? (
                <p>Loading Students...</p>
              ) : (
                <>
                  <div className="table-container" style={{ marginTop: '20px' }}>
                    <table className="co-po-map-table">
                      <thead>
                        <tr>
                          <th style={{ backgroundColor: '#2980b9', color: 'white' }}>Roll</th>
                          {programOutcomes.map((po, idx) => (
                            <th key={idx} style={{ backgroundColor: '#2980b9', color: 'white' }}>
                              {po.poCode || `PO${idx + 1}`}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {poCalcStudents.map((student, sIdx) => (
                          <tr key={sIdx}>
                            <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#e8f4f8' }}>
                              {student.rollNumber}
                            </td>
                            {programOutcomes.map((po, pIdx) => (
                              <td key={pIdx} style={{ textAlign: 'center' }}>Ok</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>
          </>
        );
      })()}

      {/* POCalc Section */}
      {(() => {
        if (selectedSheet !== 'POCalc') return null;

        // Determine if course is theory or lab based on last digit of course code
        const courseCode = selectedCourse?.courseCode || '';
        const lastDigit = parseInt(courseCode.charAt(courseCode.length - 1));
        const isTheoryCourse = lastDigit % 2 === 1; // odd = theory
        const isLabCourse = lastDigit % 2 === 0; // even = lab

        return (
          <>
            <section className="po-calc-section">
              <h3>PO Calculation</h3>

              {!programOutcomes || programOutcomes.length === 0 ? (
                <p>Loading Program Outcomes...</p>
              ) : !poCalcStudents || poCalcStudents.length === 0 ? (
                <p>Loading Students...</p>
              ) : (
                <>
                  {/* Theory Only Table - Show only in theory courses */}
                  {isTheoryCourse && (
                    <div className="table-container" style={{ marginTop: '20px' }}>
                      <h4 style={{ marginBottom: '15px', color: '#2c3e50' }}>Theory only</h4>
                      <table className="co-po-map-table">
                        <thead>
                          <tr>
                            <th style={{ backgroundColor: '#2980b9', color: 'white' }}>Roll</th>
                            {programOutcomes.map((po, idx) => (
                              <th key={idx} style={{ backgroundColor: '#2980b9', color: 'white' }}>
                                {po.poCode || `PO${idx + 1}`}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {poCalcStudents.map((student, sIdx) => (
                            <tr key={sIdx}>
                              <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#e8f4f8' }}>
                                {student.rollNumber}
                              </td>
                              {programOutcomes.map((po, pIdx) => (
                                <td key={pIdx} style={{ textAlign: 'center' }}>-</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Lab Only Table - Show only in lab courses */}
                  {isLabCourse && (
                    <div className="table-container" style={{ marginTop: '30px' }}>
                      <h4 style={{ marginBottom: '15px', color: '#2c3e50' }}>Lab Only</h4>
                      <table className="co-po-map-table">
                        <thead>
                          <tr>
                            <th style={{ backgroundColor: '#2980b9', color: 'white' }}>Roll</th>
                            {programOutcomes.map((po, idx) => (
                              <th key={idx} style={{ backgroundColor: '#2980b9', color: 'white' }}>
                                {po.poCode || `PO${idx + 1}`}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {poCalcStudents.map((student, sIdx) => (
                            <tr key={sIdx}>
                              <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#e8f4f8' }}>
                                {student.rollNumber}
                              </td>
                              {programOutcomes.map((po, pIdx) => (
                                <td key={pIdx} style={{ textAlign: 'center' }}>-</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Theory+Lab Table */}
                  <div className="table-container" style={{ marginTop: '30px' }}>
                    <h4 style={{ marginBottom: '15px', color: '#2c3e50' }}>Theory+Lab</h4>
                    <table className="co-po-map-table">
                      <thead>
                        <tr>
                          <th style={{ backgroundColor: '#2980b9', color: 'white' }}>Roll</th>
                          {programOutcomes.map((po, idx) => (
                            <th key={idx} style={{ backgroundColor: '#2980b9', color: 'white' }}>
                              {po.poCode || `PO${idx + 1}`}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {poCalcStudents.map((student, sIdx) => (
                          <tr key={sIdx}>
                            <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#e8f4f8' }}>
                              {student.rollNumber}
                            </td>
                            {programOutcomes.map((po, pIdx) => (
                              <td key={pIdx} style={{ textAlign: 'center' }}>-</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>
          </>
        );
      })()}
    </div>
  );
};

export default AttainmentView;





