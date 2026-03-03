import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { PageLoader, SheetLoader, SkeletonTable } from './attainment/LoadingSpinner';
import CourseProfileSheet from './attainment/CourseProfileSheet';
import CTSheet from './attainment/CTSheet';
import SectionASheet from './attainment/SectionASheet';
import SectionBSheet from './attainment/SectionBSheet';
import LabActivitySheet from './attainment/LabActivitySheet';
import AssignmentSheet from './attainment/AssignmentSheet';
import CTModals from './attainment/CTModals';
import SectionAModals from './attainment/SectionAModals';
import SectionBModals from './attainment/SectionBModals';
import LabActivityModals from './attainment/LabActivityModals';
import COAttainmentSheet from './attainment/COAttainmentSheet';
import COCalcSheet from './attainment/COCalcSheet';
import COPOMapSheet from './attainment/COPOMapSheet';
import POCalcMaxSheet from './attainment/POCalcMaxSheet';
import ChartsSheet from './attainment/ChartsSheet';
import CheckPOSheet from './attainment/CheckPOSheet';
import POCalcSheet from './attainment/POCalcSheet';
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
import { getCourseProfile, getCombinedCourseProfile } from '../services/courseProfileService';
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
  const [combinedClos, setCombinedClos] = useState([]);
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
  // Gate: prevent rendering tables while async loaders are still updating state.
  // Reset whenever any feed-state changes; show tables only after 400ms of no updates.
  const [coAttainmentReady, setCoAttainmentReady] = useState(false);
  const coAttainmentSettleTimerRef = useRef(null);

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
      // Own-course COs only (for Course Profile tab)
      const ownResponse = await getCourseProfile(selectedCourse.courseCode);
      if (ownResponse.success && ownResponse.data) {
        setClos(ownResponse.data);
      } else {
        setClos([]);
      }
    } catch (err) {
      logger.error('Failed to load course profile (own):', err);
      setClos([]);
    }
    try {
      // Combined theory+lab COs (for COAttainment, COCalc, COPOMap, Charts)
      const combinedResponse = await getCombinedCourseProfile(selectedCourse.courseCode);
      if (combinedResponse.success && combinedResponse.data) {
        setCombinedClos(combinedResponse.data);
      } else {
        setCombinedClos([]);
      }
    } catch (err) {
      logger.error('Failed to load combined course profile:', err);
      setCombinedClos([]);
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
      if (combinedClos.length > 0) {
        setCombinedClos([]);
      }
    }
  }, [selectedCourse, selectedSheet, loadCourseProfile, cloDependentSheets, clos.length, combinedClos.length]);

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
    // Don't clear CT data when on COCalc/COAttainment sheets (they need CT data for calculations)
    if (selectedSheet !== 'CT' && selectedSheet !== 'COCalc' && selectedSheet !== 'COCalc_LabUnnorm' && selectedSheet !== 'COAttainment') {
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
    // Don't clear Assignment data when on COCalc/COAttainment sheets (they need Assignment data for calculations)
    if (selectedSheet !== 'Attn_Assign' && selectedSheet !== 'COCalc' && selectedSheet !== 'COCalc_LabUnnorm' && selectedSheet !== 'COAttainment') {
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
    // Don't clear Lab Activity data when on COCalc/COAttainment (they need Lab Activity data for calculations)
    if (selectedSheet !== 'LabActivity' && selectedSheet !== 'COCalc' && selectedSheet !== 'COCalc_LabUnnorm' && selectedSheet !== 'COAttainment') {
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
      if ((selectedSheet === 'COCalc' || selectedSheet === 'COCalc_LabUnnorm' || selectedSheet === 'COAttainment') && selectedCourse && clos.length > 0) {

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

      if (selectedCourse && selectedCourse._id && (selectedSheet === 'CT' || selectedSheet === 'COCalc' || selectedSheet === 'COCalc_LabUnnorm' || selectedSheet === 'COAttainment')) {
        // Set the flag immediately to prevent initialization from running during load
        ctDataLoadedRef.current = true;

        // For lab courses on COCalc/COAttainment sheets, use the paired theory course's CT data
        let courseIdToUse = selectedCourse._id;
        if (selectedSheet === 'COCalc' || selectedSheet === 'COCalc_LabUnnorm' || selectedSheet === 'COAttainment') {
          const courseCode = selectedCourse.courseCode || '';
          const lastDigit = parseInt(courseCode.slice(-1));
          if (!isNaN(lastDigit) && lastDigit % 2 === 0) {
            const pairedCode = courseCode.slice(0, -1) + (lastDigit - 1);
            const theoryCourse = teacherCourses.find(c => c.courseCode === pairedCode);
            if (theoryCourse) courseIdToUse = theoryCourse._id;
          }
        }

        try {
          const response = await getCTData(courseIdToUse);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCourse, selectedSheet, initObtainedRows, teacherCourses]);

  // Load saved Assignment/Attendance data when course and Attn_Assign sheet selected (also load for COCalc sheets)
  useEffect(() => {
    const loadAssignmentData = async () => {
      // Only reset the flag when course actually changes (not on every render)
      const currentCourseId = selectedCourse?._id;
      if (currentCourseId !== previousCourseIdForAssignmentRef.current) {
        assignmentDataLoadedRef.current = false;
        previousCourseIdForAssignmentRef.current = currentCourseId;
      }

      if (selectedCourse && selectedCourse._id && (selectedSheet === 'Attn_Assign' || selectedSheet === 'COCalc' || selectedSheet === 'COCalc_LabUnnorm' || selectedSheet === 'COAttainment')) {
        // Set the flag immediately to prevent initialization from running during load
        assignmentDataLoadedRef.current = true;

        // For lab courses on COCalc/COAttainment sheets, use the paired theory course's assignment data
        let courseIdToUse = selectedCourse._id;
        if (selectedSheet === 'COCalc' || selectedSheet === 'COCalc_LabUnnorm' || selectedSheet === 'COAttainment') {
          const courseCode = selectedCourse.courseCode || '';
          const lastDigit = parseInt(courseCode.slice(-1));
          if (!isNaN(lastDigit) && lastDigit % 2 === 0) {
            const pairedCode = courseCode.slice(0, -1) + (lastDigit - 1);
            const theoryCourse = teacherCourses.find(c => c.courseCode === pairedCode);
            if (theoryCourse) courseIdToUse = theoryCourse._id;
          }
        }

        try {
          const response = await getAssignmentData(courseIdToUse);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCourse, selectedSheet, initObtainedRows, teacherCourses]);

  // Load saved Lab Activity data when course and LabActivity sheet selected (also load for COCalc sheets)
  useEffect(() => {
    const loadLabActivityData = async () => {
      // Only reset the flag when course actually changes (not on every render)
      const currentCourseId = selectedCourse?._id;
      if (currentCourseId !== previousCourseIdForLabActivityRef.current) {
        labActivityDataLoadedRef.current = false;
        previousCourseIdForLabActivityRef.current = currentCourseId;
      }

      if (selectedCourse && selectedCourse._id && (selectedSheet === 'LabActivity' || selectedSheet === 'COCalc' || selectedSheet === 'COCalc_LabUnnorm' || selectedSheet === 'COAttainment')) {
        // Set the flag immediately to prevent initialization from running during load
        labActivityDataLoadedRef.current = true;

        // For theory courses on COCalc/COAttainment sheets, use the paired lab course's lab activity data
        let courseIdToUse = selectedCourse._id;
        if (selectedSheet === 'COCalc' || selectedSheet === 'COCalc_LabUnnorm' || selectedSheet === 'COAttainment') {
          const courseCode = selectedCourse.courseCode || '';
          const lastDigit = parseInt(courseCode.slice(-1));
          if (!isNaN(lastDigit) && lastDigit % 2 === 1) {
            const pairedCode = courseCode.slice(0, -1) + (lastDigit + 1);
            const labCourse = teacherCourses.find(c => c.courseCode === pairedCode);
            if (labCourse) courseIdToUse = labCourse._id;
          }
        }
        console.log('[loadLabActivityData] sheet:', selectedSheet, 'courseId:', courseIdToUse);

        try {
          const response = await getLabActivityData(courseIdToUse);
          console.log('[loadLabActivityData] response success:', response.success, 'hasData:', !!response.data,
            'savedRows:', response.data?.labActivityRows?.length,
            'savedObtained:', response.data?.labActivityObtainedRows?.length,
            'activityTaken:', response.data?.activityTaken,
            'useEqWt:', response.data?.useEqWtActivity,
            'coMapped:', response.data?.coMappedActivityMarks);
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
              // No saved obtained rows - allow initialization
              labActivityDataLoadedRef.current = false;
              initObtainedRows('LabActivity');
            }
          } else {
            // No data found - allow initialization
            labActivityDataLoadedRef.current = false;
            initObtainedRows('LabActivity');
          }
        } catch (error) {
          console.error('[loadLabActivityData] Error loading saved data:', error);
          // Error loading - allow initialization
          labActivityDataLoadedRef.current = false;
        }
      }
    };
    loadLabActivityData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCourse, selectedSheet, teacherCourses]);

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
        // For lab courses on COCalc/COAttainment sheets, use the paired theory course's section A/B data
        let courseIdToUse = selectedCourse._id;
        if (selectedSheet === 'COCalc' || selectedSheet === 'COCalc_LabUnnorm' || selectedSheet === 'COAttainment') {
          const courseCode = selectedCourse.courseCode || '';
          const lastDigit = parseInt(courseCode.slice(-1));
          if (!isNaN(lastDigit) && lastDigit % 2 === 0) {
            const pairedCode = courseCode.slice(0, -1) + (lastDigit - 1);
            const theoryCourse = teacherCourses.find(c => c.courseCode === pairedCode);
            if (theoryCourse) courseIdToUse = theoryCourse._id;
          }
        }

        try {
          const response = await getSectionAData(courseIdToUse);

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCourse, selectedSheet, clos, teacherCourses]);

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
    if (!row) return 0;
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

  // CO Attainment (Lab) – AK32*100, where AK32 = getLabActivityCOAttainment (a 0-1 ratio).
  // Placed after labActivityActivityTotals to avoid TDZ (all transitively called consts must be above).
  const labCoAttainmentData = useMemo(() => {
    console.log('[labCoAttainmentData] recomputing', {
      obtainedRows: labActivityObtainedRows.length,
      allocatedRows: labActivityRows.length,
      clos: clos.length,
      useEqWtActivity,
      coMappedActivityMarks,
      activityTaken,
      labActivityManualWts,
      sampleObtained: labActivityObtainedRows[0],
      sampleAllocated: labActivityRows[0],
    });
    if (!labActivityObtainedRows.length || !clos.length) return [];
    return labActivityObtainedRows
      .filter(student => student.rollNumber)
      .map(student => {
        const coValues = {};
        clos.forEach(clo => {
          const cn = (clo.cloNumber || '').toString().replace('CLO', 'CO');
          const ratio = getLabActivityCOAttainment(student, cn);
          console.log('[labCoAttainmentData] student', student.rollNumber, 'co', cn, 'ratio', ratio);
          coValues[cn] = ratio != null ? parseFloat((ratio * 100).toFixed(4)) : 0;
        });
        return { rollNumber: student.rollNumber, coValues };
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labActivityObtainedRows, labActivityRows, clos, useEqWtActivity, coMappedActivityMarks, activityTaken, labActivityManualWts]);

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

  // CO Attainment (Theory) – exact same formula as TheoryCOPOTable CO Attainment (Theory) column.
  // Placed after calculateAutoFactor to avoid temporal dead zone (const TDZ).
  // CT/Assignment states are preserved for COAttainment tab so factored helpers work correctly.
  const theoryCoAttainmentData = useMemo(() => {
    if (!coCalcData.length || !clos.length) return [];
    const factoredTotals = calculateFactoredCOTotals();
    const factoredAssignTotals = calculateFactoredAssignmentCOTotals();
    return coCalcData.map(studentRow => {
      const coValues = {};
      clos.forEach(clo => {
        const cn = (clo.cloNumber || '').toString().replace('CLO', 'CO');
        const totalObt = (studentRow.sectionA.marksObtained[cn] || 0)
          + (studentRow.sectionB.marksObtained[cn] || 0)
          + getStudentCTFactoredMarks(studentRow.rollNumber, cn)
          + getStudentAssignmentFactoredMarks(studentRow.rollNumber, cn);
        const totalDist = (studentRow.sectionA.marksDistribution[cn] || 0)
          + (studentRow.sectionB.marksDistribution[cn] || 0)
          + (factoredTotals[cn] || 0)
          + (factoredAssignTotals[cn] || 0);
        coValues[cn] = totalDist > 0 ? parseFloat(((totalObt / totalDist) * 100).toFixed(4)) : 0;
      });
      return { rollNumber: studentRow.rollNumber, coValues };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coCalcData, clos, ctRows, assignmentRows, attnAssignObtainedRows, ctObtainedRows, ctManualWts, ctSummary]);

  // CO Attainment – Combined (Theory+Lab): =IFERROR(BP5/BV5, 0)*100
  // BP5 = totalObt (theory + lab obtained), BV5 = totalDist (theory + lab distribution)
  // Mirrors the CombinedCOPOTable logic in COCalcSheet.js.
  const combinedCoAttainmentData = useMemo(() => {
    if (!coCalcData.length || !clos.length) return [];
    const factoredTotals = calculateFactoredCOTotals();
    const factoredAssignmentTotals = calculateFactoredAssignmentCOTotals();
    return coCalcData.map(studentRow => {
      const coValues = {};
      clos.forEach(clo => {
        const cn = (clo.cloNumber || '').toString().replace('CLO', 'CO');
        // BP5: theory obtained + lab activity obtained (factored/weighted)
        const labStudent = labActivityObtainedRows.find(s =>
          String(s.rollNumber || '').trim().toLowerCase() === String(studentRow.rollNumber || '').trim().toLowerCase()
        );
        const labObt = getLabActivityStudentCOMappedMarks(labStudent, cn);
        const theoryObt = (studentRow.sectionA.marksObtained[cn] || 0)
          + (studentRow.sectionB.marksObtained[cn] || 0)
          + getStudentCTFactoredMarks(studentRow.rollNumber, cn)
          + getStudentAssignmentFactoredMarks(studentRow.rollNumber, cn);
        const totalObt = theoryObt + labObt;
        // BV5: theory distribution + lab activity distribution (eq-wt per question)
        const theoryDist = (studentRow.sectionA.marksDistribution[cn] || 0)
          + (studentRow.sectionB.marksDistribution[cn] || 0)
          + (factoredTotals[cn] || 0)
          + (factoredAssignmentTotals[cn] || 0);
        const labRow = labActivityRows.find(r => r.coNumber === cn);
        let labCoTotal = 0;
        if (labRow && activityTaken > 0) {
          const eqWt = (coMappedActivityMarks || 0) / (activityTaken || 1);
          for (let i = 1; i <= activityTaken; i++) {
            if ((labRow[`Activity${i}_Q1`] || 0) !== 0) labCoTotal += eqWt;
            if ((labRow[`Activity${i}_Q2`] || 0) !== 0) labCoTotal += eqWt;
            if ((labRow[`Activity${i}_Q3`] || 0) !== 0) labCoTotal += eqWt;
          }
        }
        const totalDist = theoryDist + labCoTotal;
        // IFERROR(BP5/BV5, 0) * 100
        coValues[cn] = totalDist > 0 ? parseFloat(((totalObt / totalDist) * 100).toFixed(4)) : 0;
      });
      return { rollNumber: studentRow.rollNumber, coValues };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coCalcData, clos, ctRows, assignmentRows, attnAssignObtainedRows, ctObtainedRows, ctManualWts, ctSummary,
    labActivityObtainedRows, labActivityRows, activityTaken, coMappedActivityMarks]);

  // CO Attainment – Unnormed (Theory+Lab): raw lab marks / raw lab distribution, no weighting
  const unnormedCoAttainmentData = useMemo(() => {
    if (!coCalcData.length || !clos.length) return [];
    const factoredTotals = calculateFactoredCOTotals();
    const factoredAssignmentTotals = calculateFactoredAssignmentCOTotals();
    return coCalcData.map(studentRow => {
      const coValues = {};
      clos.forEach(clo => {
        const cn = (clo.cloNumber || '').toString().replace('CLO', 'CO');
        const labStudent = labActivityObtainedRows.find(s =>
          String(s.rollNumber || '').trim().toLowerCase() === String(studentRow.rollNumber || '').trim().toLowerCase()
        );
        const labObt = getLabActivityStudentCOMarks(labStudent, cn);
        const theoryObt = (studentRow.sectionA.marksObtained[cn] || 0)
          + (studentRow.sectionB.marksObtained[cn] || 0)
          + getStudentCTFactoredMarks(studentRow.rollNumber, cn)
          + getStudentAssignmentFactoredMarks(studentRow.rollNumber, cn);
        const totalObt = theoryObt + labObt;
        const theoryDist = (studentRow.sectionA.marksDistribution[cn] || 0)
          + (studentRow.sectionB.marksDistribution[cn] || 0)
          + (factoredTotals[cn] || 0)
          + (factoredAssignmentTotals[cn] || 0);
        const labRow = labActivityRows.find(r => r.coNumber === cn);
        const labCoTotal = computeLabActivityCOTotal(labRow);
        const totalDist = theoryDist + labCoTotal;
        coValues[cn] = totalDist > 0 ? parseFloat(((totalObt / totalDist) * 100).toFixed(4)) : 0;
      });
      return { rollNumber: studentRow.rollNumber, coValues };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coCalcData, clos, ctRows, assignmentRows, attnAssignObtainedRows, ctObtainedRows, ctManualWts, ctSummary,
    labActivityObtainedRows, labActivityRows, activityTaken]);

  // CO Attainment – Equal Wt (Theory+Lab): forces equal weight across all lab activities regardless of manual-wt setting
  // CO Attainment – Equal Wt (Theory+Lab):
  // Excel formula: =B6:G6*$H$143:$M$143 + U6:Z6*$H$144:$M$144
  // B6:G6  = theoryCoAttainmentData CO % per student
  // U6:Z6  = labCoAttainmentData CO % per student
  // H143:M143 = Wt table Theory row  (theoryBin[CO] / sumBin[CO])
  // H144:M144 = Wt table Lab row     (labBin[CO]   / sumBin[CO])
  const equalWtCoAttainmentData = useMemo(() => {
    if (!clos.length) return [];
    if (!theoryCoAttainmentData.length && !labCoAttainmentData.length) return [];

    const coNumbers = clos.map(clo => (clo.cloNumber || '').toString().replace('CLO', 'CO'));

    // Binary presence per CO in each dataset
    const hasAny = (dataset, cn) =>
      Array.isArray(dataset) && dataset.some(s => (s.coValues?.[cn] || 0) > 0) ? 1 : 0;

    const theoryWt = {};
    const labWt = {};
    coNumbers.forEach(cn => {
      const tBin = hasAny(theoryCoAttainmentData, cn);
      const lBin = hasAny(labCoAttainmentData, cn);
      const s = tBin + lBin;
      theoryWt[cn] = s > 0 ? tBin / s : 0;
      labWt[cn]    = s > 0 ? lBin / s : 0;
    });

    // Union of all students from both datasets
    const rollSet = new Set([
      ...theoryCoAttainmentData.map(s => String(s.rollNumber || '').trim()),
      ...labCoAttainmentData.map(s => String(s.rollNumber || '').trim()),
    ]);

    return [...rollSet].filter(Boolean).map(roll => {
      const theoryRow = theoryCoAttainmentData.find(s =>
        String(s.rollNumber || '').trim().toLowerCase() === roll.toLowerCase()
      );
      const labRow = labCoAttainmentData.find(s =>
        String(s.rollNumber || '').trim().toLowerCase() === roll.toLowerCase()
      );
      const coValues = {};
      coNumbers.forEach(cn => {
        const tVal = theoryRow?.coValues?.[cn] || 0;
        const lVal = labRow?.coValues?.[cn] || 0;
        coValues[cn] = parseFloat(((tVal * theoryWt[cn]) + (lVal * labWt[cn])).toFixed(4));
      });
      return { rollNumber: roll, coValues };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theoryCoAttainmentData, labCoAttainmentData, clos]);

  // Effect 1: Reset ready-gate whenever the user navigates to a different course/sheet.
  const coAttainmentKeyRef = useRef('');
  useEffect(() => {
    const key = `${selectedSheet}__${selectedCourse?._id || ''}`;
    if (key !== coAttainmentKeyRef.current) {
      coAttainmentKeyRef.current = key;
      setCoAttainmentReady(false);
      if (coAttainmentSettleTimerRef.current) clearTimeout(coAttainmentSettleTimerRef.current);
    }
  }, [selectedSheet, selectedCourse]);

  // Effect 2: After data settles (400ms of no further changes), mark ready.
  // Uses a separate effect so that data updates AFTER the first settle do NOT hide the tables.
  useEffect(() => {
    if (selectedSheet !== 'COAttainment') return;
    if (coAttainmentSettleTimerRef.current) clearTimeout(coAttainmentSettleTimerRef.current);
    coAttainmentSettleTimerRef.current = setTimeout(() => {
      setCoAttainmentReady(true);
    }, 400);
    return () => {
      if (coAttainmentSettleTimerRef.current) clearTimeout(coAttainmentSettleTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSheet, selectedCourse, coCalcData, ctObtainedRows, attnAssignObtainedRows,
    labActivityObtainedRows, labActivityRows, activityTaken, coMappedActivityMarks]);

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
    return <PageLoader />;
  }

  return (
    <div className="attainment-container">
      <h1>Course Outcome Attainment</h1>

      {/* Mid-session loading banner */}
      {loading && attainmentData && (
        <div className="attainment-loading-banner">
          <SheetLoader label="" />
          <p className="attainment-loading-banner__text">Refreshing sheet data…</p>
        </div>
      )}

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
            <CourseProfileSheet clos={clos} renderCLOCell={renderCLOCell} />
          )}

          {/* CT Matrix */}
          {selectedSheet === 'CT' && (
            <CTSheet
              ctRows={ctRows}
              ctManualWts={ctManualWts}
              ctSummary={ctSummary}
              ctObtainedRows={ctObtainedRows}
              saveStatus={saveStatus}
              setCtSummary={setCtSummary}
              setShowGeneratedTableModal={setShowGeneratedTableModal}
              setShowObtainedGeneratedModal={setShowObtainedGeneratedModal}
              handleManualSave={handleManualSave}
              handleCTCellChange={handleCTCellChange}
              handleObtainedCellChange={handleObtainedCellChange}
              handleManualWtChange={handleManualWtChange}
              getActiveCTs={getActiveCTs}
              getActiveCTFields={getActiveCTFields}
              computeCOTotal={computeCOTotal}
              calculateAutoFactor={calculateAutoFactor}
              calculateAutoEqWt={calculateAutoEqWt}
              ctColumnTotals={ctColumnTotals}
              ctGroupTotals={ctGroupTotals}
              sumEqWtTotal={sumEqWtTotal}
              sumManualWtTotal={sumManualWtTotal}
              computeObtainedTotal={computeObtainedTotal}
              formatNumber={formatNumber}
            />
          )}

          {/* Section A */}
          {selectedSheet === 'SectionA' && (
            <SectionASheet
              clos={clos}
              sectionARows={sectionARows}
              sectionAObtainedRows={sectionAObtainedRows}
              sectionASaveStatus={sectionASaveStatus}
              handleManualSaveSectionA={handleManualSaveSectionA}
              handleSectionACellChange={handleSectionACellChange}
              computeSectionAObtainedTotal={computeSectionAObtainedTotal}
              sectionAQuestionTotals={sectionAQuestionTotals}
              setShowSectionAGeneratedModal={setShowSectionAGeneratedModal}
              setShowSectionAObtainedModal={setShowSectionAObtainedModal}
            />
          )}

          {/* Section B */}
          {selectedSheet === 'SectionB' && (
            <SectionBSheet
              clos={clos}
              sectionBRows={sectionBRows}
              sectionBObtainedRows={sectionBObtainedRows}
              sectionBSaveStatus={sectionBSaveStatus}
              handleManualSaveSectionB={handleManualSaveSectionB}
              handleSectionBCellChange={handleSectionBCellChange}
              computeSectionBObtainedTotal={computeSectionBObtainedTotal}
              sectionBQuestionTotals={sectionBQuestionTotals}
              setShowSectionBGeneratedModal={setShowSectionBGeneratedModal}
              setShowSectionBObtainedModal={setShowSectionBObtainedModal}
            />
          )}

          {/* Lab Activity */}
          {selectedSheet === 'LabActivity' && (
            <LabActivitySheet
              clos={clos}
              labActivityRows={labActivityRows}
              labActivityObtainedRows={labActivityObtainedRows}
              labAttendanceMarks={labAttendanceMarks}
              setLabAttendanceMarks={setLabAttendanceMarks}
              labQuizMarks={labQuizMarks}
              setLabQuizMarks={setLabQuizMarks}
              labVivaMarks={labVivaMarks}
              setLabVivaMarks={setLabVivaMarks}
              activityTaken={activityTaken}
              setActivityTaken={setActivityTaken}
              otherActivityRemaining={otherActivityRemaining}
              setOtherActivityRemaining={setOtherActivityRemaining}
              otherActivityMeasured={otherActivityMeasured}
              setOtherActivityMeasured={setOtherActivityMeasured}
              coMappedActivityMarks={coMappedActivityMarks}
              setCoMappedActivityMarks={setCoMappedActivityMarks}
              useEqWtActivity={useEqWtActivity}
              setUseEqWtActivity={setUseEqWtActivity}
              labActivityManualWts={labActivityManualWts}
              setLabActivityManualWts={setLabActivityManualWts}
              labActivitySaveStatus={labActivitySaveStatus}
              setLabActivityObtainedRows={setLabActivityObtainedRows}
              handleManualSaveLabActivity={handleManualSaveLabActivity}
              handleLabActivityCellChange={handleLabActivityCellChange}
              setShowLabActivityGeneratedModal={setShowLabActivityGeneratedModal}
              setShowLabActivityObtainedModal={setShowLabActivityObtainedModal}
              labActivityActivityTotals={labActivityActivityTotals}
              computeLabActivityMeasuredTotal={computeLabActivityMeasuredTotal}
              computeLabActivityCOTotal={computeLabActivityCOTotal}
              formatNumber={formatNumber}
            />
          )}

          {/* Attendance & Assignment */}
          {selectedSheet === 'Attn_Assign' && (
            <AssignmentSheet
              clos={clos}
              assignmentRows={assignmentRows}
              attnAssignObtainedRows={attnAssignObtainedRows}
              attendanceMarks={attendanceMarks}
              setAttendanceMarks={setAttendanceMarks}
              assignmentManualWts={assignmentManualWts}
              setAssignmentManualWts={setAssignmentManualWts}
              assignmentSummary={assignmentSummary}
              setAssignmentSummary={setAssignmentSummary}
              saveStatus={saveStatus}
              setAttnAssignObtainedRows={setAttnAssignObtainedRows}
              handleManualSaveAssignment={handleManualSaveAssignment}
              handleAssignmentCellChange={handleAssignmentCellChange}
              handleAssignmentManualWtChange={handleAssignmentManualWtChange}
              setShowGeneratedTableModal={setShowGeneratedTableModal}
              setShowObtainedGeneratedModal={setShowObtainedGeneratedModal}
              getActiveAssignments={getActiveAssignments}
              getActiveAssignmentFields={getActiveAssignmentFields}
              computeAssignmentCOTotal={computeAssignmentCOTotal}
              assignmentColumnGroupTotals={assignmentColumnGroupTotals}
              calculateAutoAssignmentFactor={calculateAutoAssignmentFactor}
              calculateAssignmentAutoEqWt={calculateAssignmentAutoEqWt}
              sumAssignmentEqWtTotal={sumAssignmentEqWtTotal}
              sumAssignmentManualWtTotal={sumAssignmentManualWtTotal}
              formatNumber={formatNumber}
            />
          )}
        </>
      )}

      {/* Show message if no data loaded yet */}
      {!attainmentData && !loading && selectedSheet && (
        <SkeletonTable rows={7} cols={6} />
      )}

      {/* CT / Attn_Assign Modals */}
          <CTModals
            selectedSheet={selectedSheet}
            showGeneratedTableModal={showGeneratedTableModal}
            setShowGeneratedTableModal={setShowGeneratedTableModal}
            ctRows={ctRows}
            assignmentRows={assignmentRows}
            getActiveCTs={getActiveCTs}
            getActiveCTFields={getActiveCTFields}
            getActiveAssignments={getActiveAssignments}
            getActiveAssignmentFields={getActiveAssignmentFields}
            calculateAutoFactor={calculateAutoFactor}
            calculateAutoAssignmentFactor={calculateAutoAssignmentFactor}
            computeAssignmentCOTotal={computeAssignmentCOTotal}
            formatNumber={formatNumber}
            showObtainedGeneratedModal={showObtainedGeneratedModal}
            setShowObtainedGeneratedModal={setShowObtainedGeneratedModal}
            obtainedModalView={obtainedModalView}
            setObtainedModalView={setObtainedModalView}
            ctObtainedRows={ctObtainedRows}
            attnAssignObtainedRows={attnAssignObtainedRows}
            calculateCOTotals={calculateCOTotals}
            calculateFactoredCOTotals={calculateFactoredCOTotals}
            calculateAssignmentCOTotalsNoAttendance={calculateAssignmentCOTotalsNoAttendance}
            calculateFactoredAssignmentCOTotals={calculateFactoredAssignmentCOTotals}
          />

          {/* Section A Modals */}
          <SectionAModals
            sectionARows={sectionARows}
            sectionAObtainedRows={sectionAObtainedRows}
            showSectionAGeneratedModal={showSectionAGeneratedModal}
            setShowSectionAGeneratedModal={setShowSectionAGeneratedModal}
            showSectionAObtainedModal={showSectionAObtainedModal}
            setShowSectionAObtainedModal={setShowSectionAObtainedModal}
            getAutoGeneratedCombination={getAutoGeneratedCombination}
            calculateSectionACOMsrd={calculateSectionACOMsrd}
            calculateUnitV={calculateUnitV}
            calculateCombinationRatio={calculateCombinationRatio}
            calculateTotalCOMsrd={calculateTotalCOMsrd}
            calculateStDevP={calculateStDevP}
            calculateDist={calculateDist}
            getStudentCOTotal={getStudentCOTotal}
            getStudentQuestionTotal={getStudentQuestionTotal}
            getStudentZeroCount={getStudentZeroCount}
            getStudentAnswerCombination={getStudentAnswerCombination}
            getStudentCODistribution={getStudentCODistribution}
            formatNumber={formatNumber}
          />

          {/* Section B Modals */}
          <SectionBModals
            sectionBRows={sectionBRows}
            sectionBObtainedRows={sectionBObtainedRows}
            showSectionBGeneratedModal={showSectionBGeneratedModal}
            setShowSectionBGeneratedModal={setShowSectionBGeneratedModal}
            showSectionBObtainedModal={showSectionBObtainedModal}
            setShowSectionBObtainedModal={setShowSectionBObtainedModal}
            getAutoGeneratedCombinationB={getAutoGeneratedCombinationB}
            calculateSectionBCOMsrd={calculateSectionBCOMsrd}
            calculateUnitVB={calculateUnitVB}
            calculateCombinationRatioB={calculateCombinationRatioB}
            calculateTotalCOMsrdB={calculateTotalCOMsrdB}
            calculateStDevPB={calculateStDevPB}
            calculateDistB={calculateDistB}
            getStudentCOTotalB={getStudentCOTotalB}
            getStudentQuestionTotalB={getStudentQuestionTotalB}
            getStudentZeroCountB={getStudentZeroCountB}
            getStudentAnswerCombinationB={getStudentAnswerCombinationB}
            getStudentCODistributionB={getStudentCODistributionB}
            formatNumber={formatNumber}
          />

          {/* Lab Activity Modals */}
          <LabActivityModals
            showLabActivityGeneratedModal={showLabActivityGeneratedModal}
            setShowLabActivityGeneratedModal={setShowLabActivityGeneratedModal}
            showLabActivityObtainedModal={showLabActivityObtainedModal}
            setShowLabActivityObtainedModal={setShowLabActivityObtainedModal}
            labActivityRows={labActivityRows}
            labActivityObtainedRows={labActivityObtainedRows}
            activityTaken={activityTaken}
            coMappedActivityMarks={coMappedActivityMarks}
            labActivityManualWts={labActivityManualWts}
            useEqWtActivity={useEqWtActivity}
            labActivityActivityTotals={labActivityActivityTotals}
            computeLabActivityCOTotal={computeLabActivityCOTotal}
            getLabActivityStudentCOMarks={getLabActivityStudentCOMarks}
            getLabActivityStudentCOMappedMarks={getLabActivityStudentCOMappedMarks}
            getLabActivityGeneratedCOTotal={getLabActivityGeneratedCOTotal}
            getLabActivityStudentTotalMarks={getLabActivityStudentTotalMarks}
            getLabActivityCOAttainment={getLabActivityCOAttainment}
            getLetterGrade={getLetterGrade}
            getGradeColor={getGradeColor}
            formatNumber={formatNumber}
          />

          {/* CO Attainment */}
          {selectedCourse && selectedSheet === 'COAttainment' && (
            coAttainmentReady ? (
              <COAttainmentSheet
                selectedCourse={selectedCourse}
                clos={combinedClos.length > 0 ? combinedClos : clos}
                coAttainmentData={coAttainmentData}
                theoryCoAttainmentData={theoryCoAttainmentData}
                labCoAttainmentData={labCoAttainmentData}
                combinedCoAttainmentData={combinedCoAttainmentData}
                unnormedCoAttainmentData={unnormedCoAttainmentData}
                equalWtCoAttainmentData={equalWtCoAttainmentData}
                formatNumber={formatNumber}
              />
            ) : (
              <div style={{ padding: '40px', textAlign: 'center', color: '#7f8c8d', fontSize: '15px' }}>
                Calculating CO Attainment…
              </div>
            )
          )}

          {/* CO Calculation (COCalc and COCalc_LabUnnorm) */}
          {(selectedSheet === 'COCalc' || selectedSheet === 'COCalc_LabUnnorm') && (
            <COCalcSheet
              selectedSheet={selectedSheet}
              selectedCourse={selectedCourse}
              clos={combinedClos.length > 0 ? combinedClos : clos}
              coCalcData={coCalcData}
              ctRows={ctRows}
              assignmentRows={assignmentRows}
              attnAssignObtainedRows={attnAssignObtainedRows}
              attendanceMarks={attendanceMarks}
              labActivityRows={labActivityRows}
              labActivityObtainedRows={labActivityObtainedRows}
              activityTaken={activityTaken}
              coMappedActivityMarks={coMappedActivityMarks}
              calculateFactoredCOTotals={calculateFactoredCOTotals}
              calculateFactoredAssignmentCOTotals={calculateFactoredAssignmentCOTotals}
              getStudentCTFactoredMarks={getStudentCTFactoredMarks}
              getStudentAssignmentFactoredMarks={getStudentAssignmentFactoredMarks}
              getLabActivityStudentCOMappedMarks={getLabActivityStudentCOMappedMarks}
              computeLabActivityCOTotal={computeLabActivityCOTotal}
              getLabActivityStudentCOMarks={getLabActivityStudentCOMarks}
              getActiveCTFields={getActiveCTFields}
              getActiveAssignmentFields={getActiveAssignmentFields}
              calculateAutoFactor={calculateAutoFactor}
              calculateAutoAssignmentFactor={calculateAutoAssignmentFactor}
              formatNumber={formatNumber}
            />
          )}

          {/* CO-PO Mapping */}
          {selectedSheet === 'COPOMap' && (
            <COPOMapSheet
              selectedCourse={selectedCourse}
              clos={combinedClos.length > 0 ? combinedClos : clos}
              programOutcomes={programOutcomes}
              combinedCOPOMatrix={combinedCOPOMatrix}
              matchingCourseCode={matchingCourseCode}
            />
          )}

          {/* PO Calculation Max */}
          {selectedSheet === 'POCalcMax' && (
            <POCalcMaxSheet
              selectedCourse={selectedCourse}
              programOutcomes={programOutcomes}
              poCalcStudents={poCalcStudents}
            />
          )}

          {/* Charts */}
          {selectedSheet === 'Charts' && (
            <ChartsSheet
              selectedCourse={selectedCourse}
              clos={combinedClos.length > 0 ? combinedClos : clos}
              programOutcomes={programOutcomes}
            />
          )}

          {/* Check PO */}
          {selectedSheet === 'CheckPO' && (
            <CheckPOSheet
              programOutcomes={programOutcomes}
              poCalcStudents={poCalcStudents}
            />
          )}

          {/* PO Calculation */}
          {selectedSheet === 'POCalc' && (
            <POCalcSheet
              selectedCourse={selectedCourse}
              programOutcomes={programOutcomes}
              poCalcStudents={poCalcStudents}
            />
          )}
    </div>
  );
};

export default AttainmentView;





