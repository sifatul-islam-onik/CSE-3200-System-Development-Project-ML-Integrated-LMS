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
  resetAttainmentData,
  saveAssignmentData,
  getAssignmentData,
  getTermExamMarks,
  getCoAttainmentCalcs,
  saveLabActivityData,
  getLabActivityData,
  saveSectionAData,
  getSectionAData,
} from '../services/attainmentService';
import { getCourseProfile, getCombinedCourseProfile, updateCOCorrelation } from '../services/courseProfileService';
import { getCourseStudents } from '../services/courseService';
import { getAllCourses } from '../services/courseService';
import { getAllProgramOutcomes } from '../services/programOutcomeService';

import logger from '../utils/logger';
import '../styles/AttainmentView.css';
const formatNumber = (num) => {
  if (num === 0 || num === null || num === undefined || isNaN(num)) return '0';
  return parseFloat(Number(num).toFixed(2)).toString();
};

const AttainmentView = ({ labDataRefreshKey = 0, preselectedAdminCourse = null }) => {
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
  const [labCourseClos, setLabCourseClos] = useState([]);
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
  const activeManualSaveRef = useRef(null);
  const ctPersistedRef = useRef({
    ctRows: [],
    ctFactors: {},
    ctManualWts: {},
    ctEqWts: {},
    ctSummary: { ctTaken: 0, coMappedMarks60: 0, useEqWt: 0 },
    ctObtainedRows: []
  });
  const assignmentPersistedRef = useRef({
    assignmentRows: [],
    assignmentManualWts: {},
    assignmentSummary: { assignTaken: 0, assignmentMarks30: 0, useEqWt: 0, attendancePerformance: 0 },
    attendanceMarks: 0,
    attnAssignObtainedRows: []
  });
  const labPersistedRef = useRef({
    labActivityRows: [],
    labActivityFactors: {},
    labActivityEqWts: {},
    labActivityManualWts: {},
    labAttendanceMarks: 0,
    labQuizMarks: 0,
    labVivaMarks: 0,
    activityTaken: 0,
    otherActivityRemaining: 0,
    otherActivityMeasured: 0,
    coMappedActivityMarks: 0,
    useEqWtActivity: 0,
    labActivityObtainedRows: []
  });
  const assignmentDataLoadedRef = useRef(false);
  const ctDataLoadedRef = useRef(false);
  const labActivityDataLoadedRef = useRef(false);
  const lastLabDataRefreshKeyRef = useRef(0);
  const sectionADataLoadedRef = useRef(false);
  const previousCourseIdRef = useRef(null);
  const previousCourseIdForAssignmentRef = useRef(null);
  const previousCourseIdForLabActivityRef = useRef(null);
  const previousCourseIdForSectionARef = useRef(null);
  const studentsFetchCacheRef = useRef({});
  const coCalcApiCacheRef = useRef(null); // { courseId, uniqueStudents, ctData, assignData }
  const prevCoCalcSheetRef = useRef(null);
  const [assignmentRows, setAssignmentRows] = useState([]);
  const [assignmentManualWts, setAssignmentManualWts] = useState({});
  const [attendanceMarks, setAttendanceMarks] = useState(0);
  const [assignmentSummary, setAssignmentSummary] = useState({ assignTaken: 0, assignmentMarks30: 0, useEqWt: 0 });
  const [sectionARows, setSectionARows] = useState([]);
  const [sectionBRows, setSectionBRows] = useState([]);
  const [labActivityRows, setLabActivityRows] = useState([]);
  const [labActivityFactors, setLabActivityFactors] = useState({});
  const [labActivityEqWts, setLabActivityEqWts] = useState({});
  const [labActivityManualWts, setLabActivityManualWts] = useState({});
  const [labAttendanceMarks, setLabAttendanceMarks] = useState(0);
  const [labQuizMarks, setLabQuizMarks] = useState(0);
  const [labVivaMarks, setLabVivaMarks] = useState(0);
  const [activityTaken, setActivityTaken] = useState(0);
  const [otherActivityRemaining, setOtherActivityRemaining] = useState(0);
  const [otherActivityMeasured, setOtherActivityMeasured] = useState(0);
  const [coMappedActivityMarks, setCoMappedActivityMarks] = useState(0);
  const [useEqWtActivity, setUseEqWtActivity] = useState(0);
  const [labActivityObtainedRows, setLabActivityObtainedRows] = useState([]);
  const [showGeneratedTableModal, setShowGeneratedTableModal] = useState(false);
  const [showObtainedGeneratedModal, setShowObtainedGeneratedModal] = useState(false);
  const [showSectionAGeneratedModal, setShowSectionAGeneratedModal] = useState(false);
  const [showSectionAObtainedModal, setShowSectionAObtainedModal] = useState(false);
  const [showSectionBGeneratedModal, setShowSectionBGeneratedModal] = useState(false);
  const [showSectionBObtainedModal, setShowSectionBObtainedModal] = useState(false);
  const [showLabActivityGeneratedModal, setShowLabActivityGeneratedModal] = useState(false);
  const [showLabActivityObtainedModal, setShowLabActivityObtainedModal] = useState(false);
  const [termExamMarks, setTermExamMarks] = useState([]);
  const [termExamLoading, setTermExamLoading] = useState(false);
  const [labActivityGeneratedView, setLabActivityGeneratedView] = useState(0);
  const [labActivityObtainedView, setLabActivityObtainedView] = useState(0);
  const [obtainedModalView, setObtainedModalView] = useState(0);
  const [coAttainmentData, setCoAttainmentData] = useState([]);
  const [coAttainmentReady, setCoAttainmentReady] = useState(false);
  const [isStandaloneCourse, setIsStandaloneCourse] = useState(null);
  const [coCalcData, setCoCalcData] = useState([]);
  const [theoryCoAttainmentData, setTheoryCoAttainmentData] = useState([]);
  const [labCoAttainmentData, setLabCoAttainmentData] = useState([]);
  const [combinedCoAttainmentData, setCombinedCoAttainmentData] = useState([]);
  const [unnormedCoAttainmentData, setUnnormedCoAttainmentData] = useState([]);
  const [equalWtCoAttainmentData, setEqualWtCoAttainmentData] = useState([]);
  const [coAttainmentRefreshKey, setCoAttainmentRefreshKey] = useState(0);
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    setUserRole(user.role || '');
  }, []);
  useEffect(() => {
    if (preselectedAdminCourse) {
      setSelectedCourse(preselectedAdminCourse);
    }
  }, [preselectedAdminCourse]);
  useEffect(() => {
    loadSheetNames();
  }, []);
  const loadCourseProfile = useCallback(async () => {
    if (!selectedCourse) return;
    const [ownResult, combinedResult] = await Promise.allSettled([
      getCourseProfile(selectedCourse.courseCode),
      getCombinedCourseProfile(selectedCourse.courseCode),
    ]);
    if (ownResult.status === 'fulfilled' && ownResult.value?.success && ownResult.value?.data) {
      setClos(ownResult.value.data);
    } else {
      if (ownResult.status === 'rejected') logger.error('Failed to load course profile (own):', ownResult.reason);
      setClos([]);
    }
    if (combinedResult.status === 'fulfilled' && combinedResult.value?.success && combinedResult.value?.data) {
      setCombinedClos(combinedResult.value.data);
    } else {
      if (combinedResult.status === 'rejected') logger.error('Failed to load combined course profile:', combinedResult.reason);
      setCombinedClos([]);
    }
  }, [selectedCourse]);
  const fetchCourseStudentsCached = useCallback((courseId) => {
    if (!studentsFetchCacheRef.current[courseId]) {
      studentsFetchCacheRef.current[courseId] =
        getCourseStudents(courseId).catch(() => ({ success: false, data: [] }));
    }
    return studentsFetchCacheRef.current[courseId];
  }, []);
  const cloDependentSheets = useMemo(() =>
    ['CourseProfile', 'CT', 'Attn_Assign', 'SectionA', 'SectionB', 'LabActivity', 'COAttainment', 'COCalc', 'COCalc_LabUnnorm', 'COPOMap', 'Charts', 'POCalcMax', 'POCalc', 'CheckPO'],
    []
  );
  useEffect(() => {
    if (selectedCourse && cloDependentSheets.includes(selectedSheet)) {
      loadCourseProfile();
    } else {
      if (clos.length > 0) {
        setClos([]);
      }
      if (combinedClos.length > 0) {
        setCombinedClos([]);
      }
    }
  }, [selectedCourse, selectedSheet, loadCourseProfile, cloDependentSheets, clos.length, combinedClos.length]);
  useEffect(() => {
    if (selectedSheet === 'CT' && clos.length > 0) {
      setCtRows(prevRows => {
        const existingMap = {};
        prevRows.forEach(row => { existingMap[row.coNumber] = row; });
        const reconciled = clos.map(clo => {
          const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
          return existingMap[coNumber] || {
            coNumber,
            CT1_Q1: 0, CT1_Q2: 0, CT1_Q3: 0,
            CT2_Q1: 0, CT2_Q2: 0, CT2_Q3: 0,
            CT3_Q1: 0, CT3_Q2: 0, CT3_Q3: 0,
          };
        });
        if (reconciled.length === prevRows.length &&
            reconciled.every((row, idx) => row === prevRows[idx])) {
          return prevRows;
        }
        return reconciled;
      });
      if (!ctDataLoadedRef.current) {
        const fields = ['CT1_Q1', 'CT1_Q2', 'CT1_Q3', 'CT2_Q1', 'CT2_Q2', 'CT2_Q3', 'CT3_Q1', 'CT3_Q2', 'CT3_Q3'];
        const manualInit = {};
        fields.forEach(f => { manualInit[f] = 0; });
        setCtFactors({ CT1: 1, CT2: 1, CT3: 1 });
        setCtEqWts({ CT1: 0, CT2: 0, CT3: 0 });
        setCtManualWts(manualInit);
        setCtSummary({ ctTaken: 0, coMappedMarks60: 0, useEqWt: 0 });
      }
    }
    if (selectedSheet !== 'CT' && selectedSheet !== 'COCalc' && selectedSheet !== 'COCalc_LabUnnorm' && selectedSheet !== 'COAttainment' && selectedSheet !== 'POCalcMax' && selectedSheet !== 'POCalc' && selectedSheet !== 'CheckPO' && selectedSheet !== 'Charts') {
      setCtRows([]);
      setCtFactors({});
      setCtEqWts({});
      setCtManualWts({});
      setCtSummary({ ctTaken: 0, coMappedMarks60: 0, useEqWt: 0 });
      ctDataLoadedRef.current = false; // Reset when leaving the sheet
    }
  }, [selectedSheet, clos]);
  useEffect(() => {
    if (selectedSheet === 'Attn_Assign' && clos.length > 0) {
      setAssignmentRows(prevRows => {
        const existingMap = {};
        prevRows.forEach(row => { existingMap[row.coNumber] = row; });
        const reconciled = clos.map(clo => {
          const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
          return existingMap[coNumber] || {
            coNumber,
            attendance: 0,
            Assgn1_Q1: 0, Assgn1_Q2: 0, Assgn1_Q3: 0,
            Assgn2_Q1: 0, Assgn2_Q2: 0, Assgn2_Q3: 0,
            Assgn3_Q1: 0, Assgn3_Q2: 0, Assgn3_Q3: 0,
          };
        });
        if (reconciled.length === prevRows.length &&
            reconciled.every((row, idx) => row === prevRows[idx])) {
          return prevRows;
        }
        return reconciled;
      });
      if (!assignmentDataLoadedRef.current) {
        const manualInit = {};
        ['Assgn1_Q1', 'Assgn1_Q2', 'Assgn1_Q3', 'Assgn2_Q1', 'Assgn2_Q2', 'Assgn2_Q3', 'Assgn3_Q1', 'Assgn3_Q2', 'Assgn3_Q3'].forEach(f => {
          manualInit[f] = 0;
        });
        setAssignmentManualWts(manualInit);
        setAttendanceMarks(0);
      }
    }
    if (selectedSheet !== 'Attn_Assign' && selectedSheet !== 'COCalc' && selectedSheet !== 'COCalc_LabUnnorm' && selectedSheet !== 'COAttainment' && selectedSheet !== 'POCalcMax' && selectedSheet !== 'POCalc' && selectedSheet !== 'CheckPO' && selectedSheet !== 'Charts') {
      setAssignmentRows([]);
      setAssignmentManualWts({});
      setAttendanceMarks(0);
      assignmentDataLoadedRef.current = false; // Reset when leaving the sheet
    }
  }, [selectedSheet, clos]);
  useEffect(() => {
    if (selectedSheet === 'SectionA' && clos.length > 0) {
      setSectionARows(prevRows => {
        const existingMap = {};
        prevRows.forEach(row => { existingMap[row.coNumber] = row; });
        const reconciled = clos.map(clo => {
          const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
          return existingMap[coNumber] || {
            coNumber,
            Q1a: 0, Q1b: 0, Q1c: 0, Q1d: 0,
            Q2a: 0, Q2b: 0, Q2c: 0, Q2d: 0,
            Q3a: 0, Q3b: 0, Q3c: 0, Q3d: 0,
            Q4a: 0, Q4b: 0, Q4c: 0, Q4d: 0,
            q123: 0, q124: 0, q134: 0, q234: 0,
            q12: 0, q13: 0, q14: 0, q23: 0, q24: 0, q34: 0,
            q1: 0, q2: 0, q3: 0, q4: 0, none: 0
          };
        });
        if (reconciled.length === prevRows.length &&
            reconciled.every((row, idx) => row === prevRows[idx])) {
          return prevRows;
        }
        return reconciled;
      });
    }
    if (selectedSheet !== 'SectionA' && !sectionADataLoadedRef.current) {
      setSectionARows([]);
    }
  }, [selectedSheet, clos]);
  useEffect(() => {
    if (selectedSheet === 'SectionB' && clos.length > 0) {
      setSectionBRows(prevRows => {
        const existingMap = {};
        prevRows.forEach(row => { existingMap[row.coNumber] = row; });
        const reconciled = clos.map(clo => {
          const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
          return existingMap[coNumber] || {
            coNumber,
            Q1a: 0, Q1b: 0, Q1c: 0, Q1d: 0,
            Q2a: 0, Q2b: 0, Q2c: 0, Q2d: 0,
            Q3a: 0, Q3b: 0, Q3c: 0, Q3d: 0,
            Q4a: 0, Q4b: 0, Q4c: 0, Q4d: 0,
            q123: 0, q124: 0, q134: 0, q234: 0,
            q12: 0, q13: 0, q14: 0, q23: 0, q24: 0, q34: 0,
            q1: 0, q2: 0, q3: 0, q4: 0, none: 0
          };
        });
        if (reconciled.length === prevRows.length &&
            reconciled.every((row, idx) => row === prevRows[idx])) {
          return prevRows;
        }
        return reconciled;
      });
    }
  }, [selectedSheet, clos]);
  useEffect(() => {
    if (selectedSheet === 'LabActivity' && clos.length > 0) {
      setLabActivityRows(prevRows => {
        const existingMap = {};
        prevRows.forEach(row => { existingMap[row.coNumber] = row; });
        const reconciled = clos.map(clo => {
          const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
          return existingMap[coNumber] || {
            coNumber,
            attn: 0, quiz: 0, viva: 0,
            Activity1_Q1: 0, Activity1_Q2: 0, Activity1_Q3: 0,
            Activity2_Q1: 0, Activity2_Q2: 0, Activity2_Q3: 0,
            Activity3_Q1: 0, Activity3_Q2: 0, Activity3_Q3: 0,
            Activity4_Q1: 0, Activity4_Q2: 0, Activity4_Q3: 0,
            Activity5_Q1: 0, Activity5_Q2: 0, Activity5_Q3: 0,
            measuredTotal: 0, coTotal: 0
          };
        });
        if (reconciled.length === prevRows.length &&
            reconciled.every((row, idx) => row === prevRows[idx])) {
          return prevRows;
        }
        return reconciled;
      });
      if (!labActivityDataLoadedRef.current) {
        setLabActivityFactors({});
        setLabActivityEqWts({});
        setLabActivityManualWts({});
        setLabAttendanceMarks(0);
        setLabQuizMarks(0);
        setLabVivaMarks(0);
      }
    }
    if (selectedSheet !== 'LabActivity' && selectedSheet !== 'COCalc' && selectedSheet !== 'COCalc_LabUnnorm' && selectedSheet !== 'COAttainment' && selectedSheet !== 'POCalcMax' && selectedSheet !== 'POCalc' && selectedSheet !== 'CheckPO' && selectedSheet !== 'Charts') {
      setLabActivityRows([]);
    }
  }, [selectedSheet, clos]);
  useEffect(() => {
    studentsFetchCacheRef.current = {};
    coCalcApiCacheRef.current = null;
  }, [selectedCourse]);
  useEffect(() => {
    const loadCOCalcData = async () => {
      if ((selectedSheet === 'COCalc' || selectedSheet === 'COCalc_LabUnnorm' || selectedSheet === 'COAttainment' || selectedSheet === 'POCalcMax' || selectedSheet === 'POCalc' || selectedSheet === 'CheckPO' || selectedSheet === 'Charts') && selectedCourse && clos.length > 0) {
        const calcSheetGroup = new Set(['COCalc', 'COCalc_LabUnnorm', 'COAttainment', 'POCalcMax', 'POCalc', 'CheckPO', 'Charts']);
        if (!calcSheetGroup.has(prevCoCalcSheetRef.current)) {
          coCalcApiCacheRef.current = null;
        }
        prevCoCalcSheetRef.current = selectedSheet;

        const cacheKey = selectedCourse._id;
        let uniqueStudents, ctData, assignData;

        if (coCalcApiCacheRef.current?.courseId === cacheKey) {
          ({ uniqueStudents, ctData, assignData } = coCalcApiCacheRef.current);
        } else {
          setTermExamLoading(true);
          let studentsResp, ctResp, termResp, assignResp, sectAFallbackResp;
          try {
            [studentsResp, ctResp, termResp, assignResp, sectAFallbackResp] = await Promise.all([
              fetchCourseStudentsCached(cacheKey),
              sheetNames.includes('CT')
                ? getCTData(cacheKey).catch(() => ({ success: false }))
                : Promise.resolve({ success: false }),
              getTermExamMarks(cacheKey, selectedCourse.section)
                .catch(() => ({ success: false, data: [] })),
              sheetNames.includes('Attn_Assign')
                ? getAttainmentData('Attn_Assign').catch(() => ({ success: false }))
                : Promise.resolve({ success: false }),
              sheetNames.includes('Section A')
                ? getAttainmentData('Section A').catch(() => ({ success: false }))
                : Promise.resolve({ success: false }),
            ]);
          } finally {
            setTermExamLoading(false);
          }
          let allStudents = [];
          if (studentsResp.success && Array.isArray(studentsResp.data) && studentsResp.data.length > 0) {
            allStudents = studentsResp.data.map(s => ({ rollNumber: s.roll || s.rollNumber }));
          } else if (sectAFallbackResp?.success && Array.isArray(sectAFallbackResp.data)) {
            allStudents = sectAFallbackResp.data.map(s => ({ rollNumber: s.rollNumber }));
          }
          if (allStudents.length === 0) {
            const assignRolls = attnAssignObtainedRows
              .filter(r => r.rollNumber && String(r.rollNumber).trim().toLowerCase() !== 'roll')
              .map(r => ({ rollNumber: String(r.rollNumber).trim() }));
            const ctRolls = ctObtainedRows
              .filter(r => r.rollNumber && String(r.rollNumber).trim().toLowerCase() !== 'roll')
              .map(r => ({ rollNumber: String(r.rollNumber).trim() }));
            allStudents = assignRolls.length > 0 ? assignRolls : ctRolls;
          }
          const seenRolls = new Set();
          uniqueStudents = [];
          allStudents.forEach(student => {
            const rollLower = String(student.rollNumber || '').trim().toLowerCase();
            if (rollLower && !seenRolls.has(rollLower)) {
              seenRolls.add(rollLower);
              uniqueStudents.push(student);
            }
          });

          ctData = (ctResp?.success && Array.isArray(ctResp.data)) ? ctResp.data : [];
          assignData = (assignResp?.success && Array.isArray(assignResp.data)) ? assignResp.data : [];
          const termData = (termResp?.success && Array.isArray(termResp.data)) ? termResp.data : [];
          setTermExamMarks(termData.length ? termData : []);
          coCalcApiCacheRef.current = { courseId: cacheKey, uniqueStudents, ctData, assignData };
        }
        if (uniqueStudents.length === 0) {
          const assignRolls = attnAssignObtainedRows
            .filter(r => r.rollNumber && String(r.rollNumber).trim().toLowerCase() !== 'roll')
            .map(r => ({ rollNumber: String(r.rollNumber).trim() }));
          const ctRolls = ctObtainedRows
            .filter(r => r.rollNumber && String(r.rollNumber).trim().toLowerCase() !== 'roll')
            .map(r => ({ rollNumber: String(r.rollNumber).trim() }));
          const fallbackStudents = assignRolls.length > 0 ? assignRolls : ctRolls;
          if (fallbackStudents.length > 0) {
            const seenFallback = new Set();
            uniqueStudents = [];
            fallbackStudents.forEach(s => {
              const r = String(s.rollNumber).trim().toLowerCase();
              if (r && !seenFallback.has(r)) { seenFallback.add(r); uniqueStudents.push(s); }
            });
            if (coCalcApiCacheRef.current?.courseId === cacheKey) {
              coCalcApiCacheRef.current = { ...coCalcApiCacheRef.current, uniqueStudents };
            }
          }
        }
        const effectiveClos = (combinedClos && combinedClos.length > 0) ? combinedClos : clos;
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
          effectiveClos.forEach(clo => {
            const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
            const studentObtainedA = sectionAObtainedRows.find(s =>
              String(s.rollNumber || '').trim().toLowerCase() ===
              String(student.rollNumber || '').trim().toLowerCase()
            );
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
            let marksDistribution = 0;
            if (studentObtainedA) {
              const coRow = sectionARows.find(r => r.coNumber === coNumber);
              if (coRow) {
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
                const combinationMap = {
                  '1,2,3': 'q123', '1,2,4': 'q124', '1,3,4': 'q134', '2,3,4': 'q234',
                  '1,2': 'q12', '1,3': 'q13', '1,4': 'q14', '2,3': 'q23', '2,4': 'q24', '3,4': 'q34',
                  '1': 'q1', '2': 'q2', '3': 'q3', '4': 'q4'
                };
                const combinationKey = answerCombination === 'None' ? 'none' : (combinationMap[answerCombination] || 'none');
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
          effectiveClos.forEach(clo => {
            const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
            const studentObtainedB = sectionBObtainedRows.find(s =>
              String(s.rollNumber || '').trim().toLowerCase() ===
              String(student.rollNumber || '').trim().toLowerCase()
            );
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
            let marksDistributionB = 0;
            if (studentObtainedB) {
              const coRow = sectionBRows.find(r => r.coNumber === coNumber);
              if (coRow) {
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
                const combinationMap = {
                  '5,6,7': 'q123', '5,6,8': 'q124', '5,7,8': 'q134', '6,7,8': 'q234',
                  '5,6': 'q12', '5,7': 'q13', '5,8': 'q14', '6,7': 'q23', '6,8': 'q24', '7,8': 'q34',
                  '5': 'q1', '6': 'q2', '7': 'q3', '8': 'q4'
                };
                const combinationKey = answerCombination === 'None' ? 'none' : (combinationMap[answerCombination] || 'none');
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
          const factoredCOTotals = calculateFactoredCOTotals();
          effectiveClos.forEach(clo => {
            const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
            row.ct.marksObtained[coNumber] = getStudentCTFactoredMarks(student.rollNumber, coNumber);
            row.ct.marksDistribution[coNumber] = factoredCOTotals[coNumber] || 0;
          });
          const factoredAssignCOTotals = calculateFactoredAssignmentCOTotals();
          effectiveClos.forEach(clo => {
            const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
            row.assignment.marksObtained[coNumber] = getStudentAssignmentFactoredMarks(student.rollNumber, coNumber);
            row.assignment.marksDistribution[coNumber] = factoredAssignCOTotals[coNumber] || 0;
          });
          const studentAssignRow = attnAssignObtainedRows.find(s =>
            String(s.rollNumber || '').trim().toLowerCase() ===
            String(student.rollNumber || '').trim().toLowerCase()
          );
          row.attendance = studentAssignRow ? (studentAssignRow.attendanceMark || studentAssignRow.attendance || 0) : 0;
          effectiveClos.forEach(clo => {
            const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');

            const totalObtained =
              (row.ct.marksObtained[coNumber] || 0) +
              (row.assignment.marksObtained[coNumber] || 0) +
              (row.sectionA.marksObtained[coNumber] || 0) +
              (row.sectionB.marksObtained[coNumber] || 0);

            const totalAllocated =
              (row.ct.marksDistribution[coNumber] || 0) +
              (row.assignment.marksDistribution[coNumber] || 0) +
              (row.sectionA.marksDistribution[coNumber] || 0) +
              (row.sectionB.marksDistribution[coNumber] || 0);

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
  }, [selectedSheet, selectedCourse, clos, combinedClos, sheetNames, sectionAObtainedRows, sectionARows, sectionBObtainedRows, sectionBRows, attnAssignObtainedRows, assignmentRows, assignmentManualWts, assignmentSummary, ctObtainedRows, ctRows, ctSummary]);

  const refreshCoAttainmentCalcs = useCallback(() => {
    setCoAttainmentRefreshKey(key => key + 1);
  }, []);

  useEffect(() => {
    const calcSheetGroup = new Set(['COCalc', 'COCalc_LabUnnorm', 'COAttainment', 'POCalcMax', 'POCalc', 'CheckPO', 'Charts']);
    if (!calcSheetGroup.has(selectedSheet) || !selectedCourse?._id) {
      setCoAttainmentData([]);
      setTheoryCoAttainmentData([]);
      setLabCoAttainmentData([]);
      setCombinedCoAttainmentData([]);
      setUnnormedCoAttainmentData([]);
      setEqualWtCoAttainmentData([]);
      return;
    }

    let cancelled = false;
    setCoAttainmentReady(false);

    const loadCoAttainmentCalcs = async () => {
      try {
        const resp = await getCoAttainmentCalcs(selectedCourse._id);
        if (cancelled) return;
        const data = resp?.data || {};
        const fallbackData = [
          data.theoryCoAttainmentData,
          data.labCoAttainmentData,
          data.combinedCoAttainmentData,
          data.unnormedCoAttainmentData,
          data.equalWtCoAttainmentData
        ].find(list => Array.isArray(list) && list.length) || [];
        setCoAttainmentData(fallbackData);
        setTheoryCoAttainmentData(Array.isArray(data.theoryCoAttainmentData) ? data.theoryCoAttainmentData : []);
        setLabCoAttainmentData(Array.isArray(data.labCoAttainmentData) ? data.labCoAttainmentData : []);
        setCombinedCoAttainmentData(Array.isArray(data.combinedCoAttainmentData) ? data.combinedCoAttainmentData : []);
        setUnnormedCoAttainmentData(Array.isArray(data.unnormedCoAttainmentData) ? data.unnormedCoAttainmentData : []);
        setEqualWtCoAttainmentData(Array.isArray(data.equalWtCoAttainmentData) ? data.equalWtCoAttainmentData : []);
        setCoAttainmentReady(true);
      } catch (err) {
        if (cancelled) return;
        logger.error('Failed to load CO attainment calculations:', err);
        setCoAttainmentData([]);
        setTheoryCoAttainmentData([]);
        setLabCoAttainmentData([]);
        setCombinedCoAttainmentData([]);
        setUnnormedCoAttainmentData([]);
        setEqualWtCoAttainmentData([]);
        setCoAttainmentReady(true);
      }
    };

    loadCoAttainmentCalcs();

    return () => {
      cancelled = true;
    };
  }, [selectedSheet, selectedCourse, coAttainmentRefreshKey]);
  const initObtainedRows = useCallback(async (forSheet) => {
    if (forSheet === 'CT' && ctDataLoadedRef.current) {
      return;
    }
    if (forSheet === 'Attn_Assign' && assignmentDataLoadedRef.current) {
      return;
    }
    if (forSheet === 'LabActivity' && labActivityDataLoadedRef.current) {
      return;
    }
    if ((forSheet === 'SectionA' || forSheet === 'SectionB') && sectionADataLoadedRef.current) {
      return;
    }


    let allStudents = [];
    if (selectedCourse && selectedCourse._id) {
      try {
        const resp = await fetchCourseStudentsCached(selectedCourse._id);
        if (resp.success && Array.isArray(resp.data) && resp.data.length > 0) {
          allStudents = resp.data.map(s => ({ rollNumber: s.roll || s.rollNumber, name: s.name }));
        }
      } catch (error) {
      }
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
    if (uniqueByRoll.length === 0) {
    }
    if (uniqueByRoll.length > 0) {
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
      const initialSectionA = uniqueByRoll.map(stu => {
        let studentData = {
          rollNumber: stu.rollNumber,
          name: stu.name,
          Q1a: 0, Q1b: 0, Q1c: 0, Q1d: 0,
          Q2a: 0, Q2b: 0, Q2c: 0, Q2d: 0,
          Q3a: 0, Q3b: 0, Q3c: 0, Q3d: 0,
          Q4a: 0, Q4b: 0, Q4c: 0, Q4d: 0,
        };
        if (termExamMarks && termExamMarks.length > 0) {
          const studentTermMarks = termExamMarks.find(tm => {
            if (!tm.student) return false;
            const termRoll = tm.student.roll || tm.student.rollNumber;
            return termRoll && String(termRoll).trim() === String(stu.rollNumber).trim();
          });

          if (studentTermMarks && studentTermMarks.marks) {
            const marks = studentTermMarks.marks;
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

      const initialSectionB = uniqueByRoll.map(stu => {
        let studentData = {
          rollNumber: stu.rollNumber,
          name: stu.name,
          Q1a: 0, Q1b: 0, Q1c: 0, Q1d: 0,
          Q2a: 0, Q2b: 0, Q2c: 0, Q2d: 0,
          Q3a: 0, Q3b: 0, Q3c: 0, Q3d: 0,
          Q4a: 0, Q4b: 0, Q4c: 0, Q4d: 0,
        };
        if (termExamMarks && termExamMarks.length > 0) {
          const studentTermMarks = termExamMarks.find(tm => {
            if (!tm.student) return false;
            const termRoll = tm.student.roll || tm.student.rollNumber;
            return termRoll && String(termRoll).trim() === String(stu.rollNumber).trim();
          });

          if (studentTermMarks && studentTermMarks.marks) {
            const marks = studentTermMarks.marks;
            const getValue = (row, question) => {
              const val = marks[row]?.[question] || marks[row]?.[String(question)];
              if (val === null || val === undefined || val === '') return 0;
              const num = parseFloat(val);
              return isNaN(num) ? 0 : num;
            };

            studentData = {
              ...studentData,
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
  }, [selectedCourse, sheetNames, attainmentData, termExamMarks, fetchCourseStudentsCached]);
  useEffect(() => {
    if (selectedSheet === 'CT') initObtainedRows('CT');
    else if (selectedSheet === 'Attn_Assign') initObtainedRows('Attn_Assign');
    else if (selectedSheet === 'SectionA') initObtainedRows('SectionA');
    else if (selectedSheet === 'SectionB') initObtainedRows('SectionB');
    else if (selectedSheet === 'LabActivity') initObtainedRows('LabActivity');
  }, [selectedSheet, initObtainedRows]);
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
  useEffect(() => {
    const loadCombinedCOPOMatrix = async () => {
      if ((selectedSheet === 'COPOMap' || selectedSheet === 'POCalcMax' || selectedSheet === 'POCalc' || selectedSheet === 'CheckPO' || selectedSheet === 'Charts') && selectedCourse && selectedCourse.courseCode) {
        try {
          const courseCode = selectedCourse.courseCode;
          const lastDigit = parseInt(courseCode.slice(-1));

          if (isNaN(lastDigit)) return;
          const isTheory = lastDigit % 2 === 1;
          const baseCode = courseCode.slice(0, -1);
          const matchingLastDigit = isTheory ? lastDigit + 1 : lastDigit - 1;
          const matchingCode = baseCode + matchingLastDigit;

          setMatchingCourseCode(matchingCode);
          const [currentProfile, matchingProfile] = await Promise.all([
            getCourseProfile(courseCode),
            getCourseProfile(matchingCode).catch(() => ({ success: false, data: [] }))
          ]);

          if (!currentProfile.success || !currentProfile.data) {
            setCombinedCOPOMatrix(null);
            setLabCourseClos([]);
            return;
          }

          const currentCLOs = currentProfile.data;
          const matchingCLOs = matchingProfile.success ? matchingProfile.data : [];
          const combined = {};
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
          Object.keys(combined).forEach(co => {
            combined[co].sort((a, b) => a - b);
          });

          setCombinedCOPOMatrix(combined);
          setLabCourseClos(isTheory ? matchingCLOs : currentCLOs);

        } catch (err) {
          logger.error('Failed to load combined CO-PO matrix:', err);
          setCombinedCOPOMatrix(null);
          setLabCourseClos([]);
        }
      }
    };
    loadCombinedCOPOMatrix();
  }, [selectedSheet, selectedCourse]);
  useEffect(() => {
    if (!selectedCourse?.courseCode) {
      setIsStandaloneCourse(null);
      return;
    }
    const courseCode = selectedCourse.courseCode;
    const lastDigit = parseInt(courseCode.slice(-1));
    if (isNaN(lastDigit)) {
      setIsStandaloneCourse(false); // Cannot determine â€” treat as paired
      return;
    }
    const baseCode = courseCode.slice(0, -1);
    const isTheory = lastDigit % 2 === 1;
    const pairLastDigit = isTheory ? lastDigit + 1 : lastDigit - 1;
    const pairCode = baseCode + pairLastDigit;
    const firstTwoDigits = (code) => (code.match(/\d+/)?.[0] || '').slice(0, 2);
    const sameSemester = firstTwoDigits(courseCode) === firstTwoDigits(pairCode);
    if (!sameSemester) {
      setIsStandaloneCourse(true);
      return;
    }
    getCourseProfile(pairCode)
      .then(() => setIsStandaloneCourse(false))
      .catch(() => setIsStandaloneCourse(true));
  }, [selectedCourse]);
  const calculateCOTotals = () => {
    const coTotals = {};
    ctRows.forEach((row, idx) => {
      const coKey = row.coNumber || `CO${idx + 1}`;
      const coTotal = computeCOTotal(row);
      coTotals[coKey] = (coTotals[coKey] || 0) + coTotal;
    });
    return coTotals;
  };
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
  const calculateAssignmentCOTotals = () => {
    const coTotals = {};
    assignmentRows.forEach((row, idx) => {
      const coKey = row.coNumber || `CO${idx + 1}`;
      const coTotal = computeAssignmentCOTotal(row);
      coTotals[coKey] = (coTotals[coKey] || 0) + coTotal;
    });
    return coTotals;
  };
  const calculateAssignmentCOTotalsNoAttendance = () => {
    const coTotals = {};
    assignmentRows.forEach((row, idx) => {
      const coKey = row.coNumber || `CO${idx + 1}`;
      const coTotal = getActiveAssignmentFields().reduce((sum, field) => {
        const allocatedMarks = row[field] || 0;
        if (allocatedMarks === 0) return sum; // Skip if no allocation for this field in this CO
        return sum + allocatedMarks;
      }, 0);
      coTotals[coKey] = coTotal;
    });
    return coTotals;
  };
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
  const getActiveCTFields = () => {
    let ctTaken = ctSummary.ctTaken > 0 ? ctSummary.ctTaken
      : ctRows.some(r => (r.CT3_Q1 || 0) + (r.CT3_Q2 || 0) + (r.CT3_Q3 || 0) > 0) ? 3
      : ctRows.some(r => (r.CT2_Q1 || 0) + (r.CT2_Q2 || 0) + (r.CT2_Q3 || 0) > 0) ? 2
      : ctRows.some(r => (r.CT1_Q1 || 0) + (r.CT1_Q2 || 0) + (r.CT1_Q3 || 0) > 0) ? 1 : 0;
    const allFields = ['CT1_Q1', 'CT1_Q2', 'CT1_Q3', 'CT2_Q1', 'CT2_Q2', 'CT2_Q3', 'CT3_Q1', 'CT3_Q2', 'CT3_Q3'];
    return allFields.slice(0, ctTaken * 3);
  };
  const getActiveCTs = () => {
    const ctTaken = ctSummary.ctTaken > 0 ? ctSummary.ctTaken
      : ctRows.some(r => (r.CT3_Q1 || 0) + (r.CT3_Q2 || 0) + (r.CT3_Q3 || 0) > 0) ? 3
      : ctRows.some(r => (r.CT2_Q1 || 0) + (r.CT2_Q2 || 0) + (r.CT2_Q3 || 0) > 0) ? 2
      : ctRows.some(r => (r.CT1_Q1 || 0) + (r.CT1_Q2 || 0) + (r.CT1_Q3 || 0) > 0) ? 1 : 0;
    return ['CT1', 'CT2', 'CT3'].slice(0, ctTaken);
  };
  const getActiveAssignments = () => {
    const assignTaken = assignmentSummary.assignTaken > 0 ? assignmentSummary.assignTaken
      : assignmentRows.some(r => (r.Assgn3_Q1 || 0) + (r.Assgn3_Q2 || 0) + (r.Assgn3_Q3 || 0) > 0) ? 3
      : assignmentRows.some(r => (r.Assgn2_Q1 || 0) + (r.Assgn2_Q2 || 0) + (r.Assgn2_Q3 || 0) > 0) ? 2
      : assignmentRows.some(r => (r.Assgn1_Q1 || 0) + (r.Assgn1_Q2 || 0) + (r.Assgn1_Q3 || 0) > 0) ? 1 : 0;
    return ['Assgn1', 'Assgn2', 'Assgn3'].slice(0, assignTaken);
  };
  const getActiveAssignmentFields = () => {
    const assignTaken = assignmentSummary.assignTaken > 0 ? assignmentSummary.assignTaken
      : assignmentRows.some(r => (r.Assgn3_Q1 || 0) + (r.Assgn3_Q2 || 0) + (r.Assgn3_Q3 || 0) > 0) ? 3
      : assignmentRows.some(r => (r.Assgn2_Q1 || 0) + (r.Assgn2_Q2 || 0) + (r.Assgn2_Q3 || 0) > 0) ? 2
      : assignmentRows.some(r => (r.Assgn1_Q1 || 0) + (r.Assgn1_Q2 || 0) + (r.Assgn1_Q3 || 0) > 0) ? 1 : 0;
    const allFields = ['Assgn1_Q1', 'Assgn1_Q2', 'Assgn1_Q3', 'Assgn2_Q1', 'Assgn2_Q2', 'Assgn2_Q3', 'Assgn3_Q1', 'Assgn3_Q2', 'Assgn3_Q3'];
    return allFields.slice(0, assignTaken * 3);
  };
  const getStudentCTFactoredMarks = (rollNumber, coNumber) => {
    const studentRow = ctObtainedRows.find(r =>
      String(r.rollNumber || '').trim().toLowerCase() === String(rollNumber || '').trim().toLowerCase()
    );
    if (!studentRow) return 0;
    const coIdx = ctRows.findIndex(row => {
      const rowCoNumber = (row.coNumber || '').toString().replace('CLO', 'CO');
      return rowCoNumber === coNumber;
    });

    if (coIdx === -1) return 0; // CO not found

    const coRow = ctRows[coIdx];

    return getActiveCTFields().reduce((sum, field) => {
      const allocatedMarks = coRow[field] || 0;
      if (allocatedMarks === 0) return sum;

      const ctKey = field.replace(/(_Q[123])$/, '');
      const factor = calculateAutoFactor()[ctKey] || 0;
      const rawMark = studentRow[field];
      const studentMark = (rawMark === 'A' || rawMark === 'Absent') ? 0 : (parseFloat(rawMark) || 0);
      return sum + (factor * studentMark);
    }, 0);
  };
  const getStudentAssignmentFactoredMarks = (rollNumber, coNumber) => {
    const studentRow = attnAssignObtainedRows.find(r =>
      String(r.rollNumber || '').trim().toLowerCase() === String(rollNumber || '').trim().toLowerCase()
    );
    if (!studentRow) return 0;
    const coIdx = assignmentRows.findIndex(row => {
      const rowCoNumber = (row.coNumber || '').toString().replace('CLO', 'CO');
      return rowCoNumber === coNumber;
    });

    if (coIdx === -1) return 0;

    const coRow = assignmentRows[coIdx];

    return getActiveAssignmentFields().reduce((sum, field) => {
      const allocatedMarks = coRow[field] || 0;
      if (allocatedMarks === 0) return sum;

      const assignmentKey = field.replace(/(_Q[123])$/, '');
      const factor = calculateAutoAssignmentFactor()[assignmentKey] || 0;
      const studentMark = studentRow[field] || 0;
      return sum + (factor * studentMark);
    }, 0);
  };
  const getStudentAssignmentOriginalMarks = (rollNumber, coNumber) => {
    const studentRow = attnAssignObtainedRows.find(r =>
      String(r.rollNumber || '').trim().toLowerCase() === String(rollNumber || '').trim().toLowerCase()
    );
    if (!studentRow) return 0;

    const coIdx = assignmentRows.findIndex(row => {
      const rowCoNumber = (row.coNumber || '').toString().replace('CLO', 'CO');
      return rowCoNumber === coNumber;
    });

    if (coIdx === -1) return 0;

    const coRow = assignmentRows[coIdx];
    return getActiveAssignmentFields().reduce((sum, field) => {
      const allocatedMarks = coRow[field] || 0;
      if (allocatedMarks === 0) return sum;
      return sum + (studentRow[field] || 0); // factor = 1 (Original, no scaling)
    }, 0);
  };
  const triggerAutosave = useCallback(() => {
    return;
  }, []);
  const handleManualSave = async (scope = 'all') => {
    if (selectedSheet !== 'CT') return;
    if (activeManualSaveRef.current && activeManualSaveRef.current !== 'CT') return;
    if (activeManualSaveRef.current === 'CT') return;
    if (!selectedCourse || !selectedCourse._id) {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(''), 3000);
      return;
    }
    activeManualSaveRef.current = 'CT';
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    setSaveStatus('saving');

    try {
      const saveTopOnly = scope === 'top';
      const saveBottomOnly = scope === 'bottom';
      const persisted = ctPersistedRef.current || {};
      const dataToSave = {
        ctRows: saveBottomOnly ? (persisted.ctRows || []) : ctRows,
        ctFactors: saveBottomOnly ? (persisted.ctFactors || {}) : ctFactors,
        ctManualWts: saveBottomOnly ? (persisted.ctManualWts || {}) : ctManualWts,
        ctEqWts: saveBottomOnly ? (persisted.ctEqWts || {}) : ctEqWts,
        ctSummary: saveBottomOnly ? (persisted.ctSummary || { ctTaken: 0, coMappedMarks60: 0, useEqWt: 0 }) : ctSummary,
        ctObtainedRows: saveTopOnly ? (persisted.ctObtainedRows || []) : ctObtainedRows
      };

      const response = await saveCTData(selectedCourse._id, dataToSave);

      ctPersistedRef.current = {
        ctRows: dataToSave.ctRows,
        ctFactors: dataToSave.ctFactors,
        ctManualWts: dataToSave.ctManualWts,
        ctEqWts: dataToSave.ctEqWts,
        ctSummary: dataToSave.ctSummary,
        ctObtainedRows: dataToSave.ctObtainedRows
      };

      setSaveStatus('saved');
      refreshCoAttainmentCalcs();
      setTimeout(() => setSaveStatus(''), 2000);
    } catch (error) {
      console.error('[handleManualSave] Error:', error);
      logger.error('[Manual Save] Error:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(''), 3000);
    } finally {
      activeManualSaveRef.current = null;
    }
  };
  const handleManualSaveAssignment = async (scope = 'all') => {
    if (selectedSheet !== 'Attn_Assign') return;
    if (activeManualSaveRef.current && activeManualSaveRef.current !== 'ASSIGNMENT') return;
    if (activeManualSaveRef.current === 'ASSIGNMENT') return;
    if (!selectedCourse || !selectedCourse._id) {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(''), 3000);
      return;
    }
    activeManualSaveRef.current = 'ASSIGNMENT';
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    setSaveStatus('saving');

    try {
      const saveTopOnly = scope === 'top';
      const saveBottomOnly = scope === 'bottom';
      const persisted = assignmentPersistedRef.current || {};
      const dataToSave = {
        assignmentRows: saveBottomOnly ? (persisted.assignmentRows || []) : assignmentRows,
        assignmentManualWts: saveBottomOnly ? (persisted.assignmentManualWts || {}) : assignmentManualWts,
        assignmentSummary: saveBottomOnly ? (persisted.assignmentSummary || { assignTaken: 0, assignmentMarks30: 0, useEqWt: 0, attendancePerformance: 0 }) : assignmentSummary,
        attendanceMarks: saveBottomOnly ? (persisted.attendanceMarks ?? 0) : attendanceMarks,
        attnAssignObtainedRows: saveTopOnly ? (persisted.attnAssignObtainedRows || []) : attnAssignObtainedRows
      };

      const response = await saveAssignmentData(selectedCourse._id, dataToSave);

      assignmentPersistedRef.current = {
        assignmentRows: dataToSave.assignmentRows,
        assignmentManualWts: dataToSave.assignmentManualWts,
        assignmentSummary: dataToSave.assignmentSummary,
        attendanceMarks: dataToSave.attendanceMarks,
        attnAssignObtainedRows: dataToSave.attnAssignObtainedRows
      };

      setSaveStatus('saved');
      refreshCoAttainmentCalcs();
      setTimeout(() => setSaveStatus(''), 2000);
    } catch (error) {
      console.error('[handleManualSaveAssignment] Error:', error);
      logger.error('[Manual Save Assignment] Error:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(''), 3000);
    } finally {
      activeManualSaveRef.current = null;
    }
  };
  const handleManualSaveLabActivity = async (scope = 'all') => {
    if (selectedSheet !== 'LabActivity') return;
    if (activeManualSaveRef.current && activeManualSaveRef.current !== 'LAB') return;
    if (activeManualSaveRef.current === 'LAB') return;
    if (!selectedCourse || !selectedCourse._id) {
      console.warn('Lab Activity Save: Please select a course first');
      setLabActivitySaveStatus('error');
      setTimeout(() => setLabActivitySaveStatus(''), 3000);
      return;
    }
    activeManualSaveRef.current = 'LAB';
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    setLabActivitySaveStatus('saving');

    try {
      const saveTopOnly = scope === 'top';
      const saveBottomOnly = scope === 'bottom';
      const persisted = labPersistedRef.current || {};
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
        const rounded = Math.round(calculatedOther * 10000) / 10000;
        return { ...row, other: rounded };
      });

      const dataToSave = {
        labActivityRows: saveBottomOnly ? (persisted.labActivityRows || []) : labActivityRows,
        labActivityFactors: saveBottomOnly ? (persisted.labActivityFactors || {}) : labActivityFactors,
        labActivityEqWts: saveBottomOnly ? (persisted.labActivityEqWts || {}) : labActivityEqWts,
        labActivityManualWts: saveBottomOnly ? (persisted.labActivityManualWts || {}) : labActivityManualWts,
        labAttendanceMarks: saveBottomOnly ? (persisted.labAttendanceMarks ?? 0) : labAttendanceMarks,
        labQuizMarks: saveBottomOnly ? (persisted.labQuizMarks ?? 0) : labQuizMarks,
        labVivaMarks: saveBottomOnly ? (persisted.labVivaMarks ?? 0) : labVivaMarks,
        activityTaken: saveBottomOnly ? (persisted.activityTaken ?? 0) : activityTaken,
        otherActivityRemaining: saveBottomOnly ? (persisted.otherActivityRemaining ?? 0) : otherActivityRemaining,
        otherActivityMeasured: saveBottomOnly ? (persisted.otherActivityMeasured ?? 0) : otherActivityMeasured,
        coMappedActivityMarks: saveBottomOnly ? (persisted.coMappedActivityMarks ?? 0) : coMappedActivityMarks,
        useEqWtActivity: saveBottomOnly ? (persisted.useEqWtActivity ?? 0) : useEqWtActivity,
        labActivityObtainedRows: saveTopOnly ? (persisted.labActivityObtainedRows || []) : rowsWithCalculatedOther
      };

      const response = await saveLabActivityData(selectedCourse._id, dataToSave);

      labPersistedRef.current = {
        labActivityRows: dataToSave.labActivityRows,
        labActivityFactors: dataToSave.labActivityFactors,
        labActivityEqWts: dataToSave.labActivityEqWts,
        labActivityManualWts: dataToSave.labActivityManualWts,
        labAttendanceMarks: dataToSave.labAttendanceMarks,
        labQuizMarks: dataToSave.labQuizMarks,
        labVivaMarks: dataToSave.labVivaMarks,
        activityTaken: dataToSave.activityTaken,
        otherActivityRemaining: dataToSave.otherActivityRemaining,
        otherActivityMeasured: dataToSave.otherActivityMeasured,
        coMappedActivityMarks: dataToSave.coMappedActivityMarks,
        useEqWtActivity: dataToSave.useEqWtActivity,
        labActivityObtainedRows: dataToSave.labActivityObtainedRows
      };

      console.log('Lab Activity data saved successfully!');
      setLabActivitySaveStatus('saved');
      refreshCoAttainmentCalcs();
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
    } finally {
      activeManualSaveRef.current = null;
    }
  };
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
      refreshCoAttainmentCalcs();
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
      refreshCoAttainmentCalcs();
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
  useEffect(() => {
    const loadCTData = async () => {
      const currentCourseId = selectedCourse?._id;
      if (currentCourseId !== previousCourseIdRef.current) {
        ctDataLoadedRef.current = false;
        previousCourseIdRef.current = currentCourseId;
        ctPersistedRef.current = {
          ctRows: [],
          ctFactors: {},
          ctManualWts: {},
          ctEqWts: {},
          ctSummary: { ctTaken: 0, coMappedMarks60: 0, useEqWt: 0 },
          ctObtainedRows: []
        };
      }

      if (selectedCourse && selectedCourse._id && (selectedSheet === 'CT' || selectedSheet === 'COCalc' || selectedSheet === 'COCalc_LabUnnorm' || selectedSheet === 'COAttainment' || selectedSheet === 'POCalcMax' || selectedSheet === 'POCalc' || selectedSheet === 'CheckPO' || selectedSheet === 'Charts')) {
        ctDataLoadedRef.current = true;
        let courseIdToUse = selectedCourse._id;
        if (selectedSheet === 'COCalc' || selectedSheet === 'COCalc_LabUnnorm' || selectedSheet === 'COAttainment' || selectedSheet === 'POCalcMax' || selectedSheet === 'POCalc' || selectedSheet === 'CheckPO' || selectedSheet === 'Charts') {
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

            ctPersistedRef.current = {
              ctRows: savedRows || [],
              ctFactors: savedFactors || {},
              ctManualWts: savedManual || {},
              ctEqWts: savedEq || {},
              ctSummary: savedSummary || { ctTaken: 0, coMappedMarks60: 0, useEqWt: 0 },
              ctObtainedRows: savedObtained || []
            };

            setCtRows(() => {
              if (!savedRows || savedRows.length === 0) {
                if (clos.length === 0) return [];
                return clos.map(clo => {
                  const cn = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                  return {
                    coNumber: cn,
                    CT1_Q1: 0, CT1_Q2: 0, CT1_Q3: 0,
                    CT2_Q1: 0, CT2_Q2: 0, CT2_Q3: 0,
                    CT3_Q1: 0, CT3_Q2: 0, CT3_Q3: 0,
                  };
                });
              }
              if (courseIdToUse !== selectedCourse._id) return savedRows;
              if (clos.length === 0) return savedRows;
              const savedMap = {};
              savedRows.forEach(r => { savedMap[r.coNumber] = r; });
              return clos.map(clo => {
                const cn = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                return savedMap[cn] || {
                  coNumber: cn,
                  CT1_Q1: 0, CT1_Q2: 0, CT1_Q3: 0,
                  CT2_Q1: 0, CT2_Q2: 0, CT2_Q3: 0,
                  CT3_Q1: 0, CT3_Q2: 0, CT3_Q3: 0,
                };
              });
            });
            if (savedFactors) setCtFactors(savedFactors);
            if (savedManual) setCtManualWts(savedManual);
            if (savedEq) setCtEqWts(savedEq);
            if (savedSummary) setCtSummary(savedSummary);
            if (savedObtained && savedObtained.length > 0) {
              const cleaned = savedObtained.filter(r => r.rollNumber && r.rollNumber.toLowerCase() !== 'roll');
              try {
                const stuResp = await fetchCourseStudentsCached(selectedCourse._id);
                if (stuResp.success && Array.isArray(stuResp.data) && stuResp.data.length > 0) {
                  const enrolled = stuResp.data
                    .map(s => ({ rollNumber: String(s.roll || s.rollNumber || '').trim(), name: s.name || '' }))
                    .filter(s => s.rollNumber && /^[0-9]{4,}$/.test(s.rollNumber));
                  if (enrolled.length > 0) {
                    const savedMap = {};
                    cleaned.forEach(r => { savedMap[String(r.rollNumber).trim()] = r; });
                    const merged = enrolled.map(s => savedMap[s.rollNumber] || {
                      rollNumber: s.rollNumber, name: s.name,
                      CT1_Q1: 0, CT1_Q2: 0, CT1_Q3: 0,
                      CT2_Q1: 0, CT2_Q2: 0, CT2_Q3: 0,
                      CT3_Q1: 0, CT3_Q2: 0, CT3_Q3: 0,
                    });
                    setCtObtainedRows(merged);
                  } else {
                    setCtObtainedRows(cleaned);
                  }
                } else {
                  setCtObtainedRows(cleaned);
                }
              } catch (e) {
                setCtObtainedRows(cleaned);
              }
            } else {
              ctDataLoadedRef.current = false;
              initObtainedRows('CT');
            }
          } else {
            ctDataLoadedRef.current = false;
            initObtainedRows('CT');
          }
        } catch (error) {
          console.error('[loadCTData] Error loading saved data:', error);
          ctDataLoadedRef.current = false;
          initObtainedRows('CT');
        }
      }
    };
    loadCTData();
  }, [selectedCourse, selectedSheet, initObtainedRows, teacherCourses]);
  useEffect(() => {
    const loadAssignmentData = async () => {
      const currentCourseId = selectedCourse?._id;
      const courseActuallyChanged = currentCourseId !== previousCourseIdForAssignmentRef.current;
      if (courseActuallyChanged) {
        assignmentDataLoadedRef.current = false;
        previousCourseIdForAssignmentRef.current = currentCourseId;
        assignmentPersistedRef.current = {
          assignmentRows: [],
          assignmentManualWts: {},
          assignmentSummary: { assignTaken: 0, assignmentMarks30: 0, useEqWt: 0, attendancePerformance: 0 },
          attendanceMarks: 0,
          attnAssignObtainedRows: []
        };
      }

      if (selectedCourse && selectedCourse._id && (selectedSheet === 'Attn_Assign' || selectedSheet === 'COCalc' || selectedSheet === 'COCalc_LabUnnorm' || selectedSheet === 'COAttainment' || selectedSheet === 'POCalcMax' || selectedSheet === 'POCalc' || selectedSheet === 'CheckPO' || selectedSheet === 'Charts')) {
        assignmentDataLoadedRef.current = true;
        let courseIdToUse = selectedCourse._id;
        if (selectedSheet === 'COCalc' || selectedSheet === 'COCalc_LabUnnorm' || selectedSheet === 'COAttainment' || selectedSheet === 'POCalcMax' || selectedSheet === 'POCalc' || selectedSheet === 'CheckPO' || selectedSheet === 'Charts') {
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

            assignmentPersistedRef.current = {
              assignmentRows: savedRows || [],
              assignmentManualWts: savedManual || {},
              assignmentSummary: savedSummary || { assignTaken: 0, assignmentMarks30: 0, useEqWt: 0, attendancePerformance: 0 },
              attendanceMarks: savedAttendance ?? 0,
              attnAssignObtainedRows: savedObtained || []
            };

            setAssignmentRows(() => {
              if (!savedRows || savedRows.length === 0) {
                if (clos.length === 0) return [];
                return clos.map(clo => {
                  const cn = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                  return {
                    coNumber: cn,
                    attendance: 0,
                    Assgn1_Q1: 0, Assgn1_Q2: 0, Assgn1_Q3: 0,
                    Assgn2_Q1: 0, Assgn2_Q2: 0, Assgn2_Q3: 0,
                    Assgn3_Q1: 0, Assgn3_Q2: 0, Assgn3_Q3: 0,
                  };
                });
              }
              if (courseIdToUse !== selectedCourse._id) return savedRows;
              if (clos.length === 0) return savedRows;
              const savedMap = {};
              savedRows.forEach(r => { savedMap[r.coNumber] = r; });
              return clos.map(clo => {
                const cn = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                return savedMap[cn] || {
                  coNumber: cn,
                  attendance: 0,
                  Assgn1_Q1: 0, Assgn1_Q2: 0, Assgn1_Q3: 0,
                  Assgn2_Q1: 0, Assgn2_Q2: 0, Assgn2_Q3: 0,
                  Assgn3_Q1: 0, Assgn3_Q2: 0, Assgn3_Q3: 0,
                };
              });
            });
            if (savedManual) setAssignmentManualWts(savedManual);
            if (savedSummary) setAssignmentSummary(savedSummary);
            if (savedAttendance !== undefined) setAttendanceMarks(savedAttendance);
            const mergeWithEnrolled = async (rows) => {
              try {
                const stuResp = await fetchCourseStudentsCached(selectedCourse._id);
                if (stuResp.success && Array.isArray(stuResp.data) && stuResp.data.length > 0) {
                  const enrolled = stuResp.data
                    .map(s => ({ rollNumber: String(s.roll || s.rollNumber || '').trim(), name: s.name || '' }))
                    .filter(s => s.rollNumber && /^[0-9]{4,}$/.test(s.rollNumber));
                  if (enrolled.length > 0) {
                    const savedMap = {};
                    rows.forEach(r => { savedMap[String(r.rollNumber).trim()] = r; });
                    const merged = enrolled.map(s => savedMap[s.rollNumber] || {
                      rollNumber: s.rollNumber, name: s.name,
                      attendance: 0,
                      Assgn1_Q1: 0, Assgn1_Q2: 0, Assgn1_Q3: 0,
                      Assgn2_Q1: 0, Assgn2_Q2: 0, Assgn2_Q3: 0,
                      Assgn3_Q1: 0, Assgn3_Q2: 0, Assgn3_Q3: 0,
                    });
                    return merged;
                  }
                }
              } catch (e) {  }
              return rows;
            };

            if (savedObtained && savedObtained.length > 0) {
              const merged = await mergeWithEnrolled(savedObtained);
              setAttnAssignObtainedRows(merged);
            } else {
              const seeded = await mergeWithEnrolled([]);
              if (seeded.length > 0) {
                setAttnAssignObtainedRows(seeded);
              } else if (courseActuallyChanged || attnAssignObtainedRows.length === 0) {
                assignmentDataLoadedRef.current = false;
                initObtainedRows('Attn_Assign');
              }
            }
          } else {
            if (courseActuallyChanged || attnAssignObtainedRows.length === 0) {
              try {
                const stuResp = await fetchCourseStudentsCached(selectedCourse._id);
                if (stuResp.success && Array.isArray(stuResp.data) && stuResp.data.length > 0) {
                  const enrolled = stuResp.data
                    .map(s => ({ rollNumber: String(s.roll || s.rollNumber || '').trim(), name: s.name || '' }))
                    .filter(s => s.rollNumber && /^[0-9]{4,}$/.test(s.rollNumber));
                  if (enrolled.length > 0) {
                    setAttnAssignObtainedRows(enrolled.map(s => ({
                      rollNumber: s.rollNumber, name: s.name,
                      attendance: 0,
                      Assgn1_Q1: 0, Assgn1_Q2: 0, Assgn1_Q3: 0,
                      Assgn2_Q1: 0, Assgn2_Q2: 0, Assgn2_Q3: 0,
                      Assgn3_Q1: 0, Assgn3_Q2: 0, Assgn3_Q3: 0,
                    })));
                  } else {
                    assignmentDataLoadedRef.current = false;
                    initObtainedRows('Attn_Assign');
                  }
                } else {
                  assignmentDataLoadedRef.current = false;
                  initObtainedRows('Attn_Assign');
                }
              } catch (e) {
                assignmentDataLoadedRef.current = false;
                initObtainedRows('Attn_Assign');
              }
            }
          }
        } catch (error) {
          console.error('[loadAssignmentData] Error loading saved data:', error);
          if (courseActuallyChanged || attnAssignObtainedRows.length === 0) {
            assignmentDataLoadedRef.current = false;
            initObtainedRows('Attn_Assign');
          }
        }
      }
    };
    loadAssignmentData();
  }, [selectedCourse, selectedSheet, initObtainedRows, teacherCourses]);
  useEffect(() => {
    const loadLabActivityData = async () => {
      const currentCourseId = selectedCourse?._id;
      if (currentCourseId !== previousCourseIdForLabActivityRef.current) {
        labActivityDataLoadedRef.current = false;
        previousCourseIdForLabActivityRef.current = currentCourseId;
        labPersistedRef.current = {
          labActivityRows: [],
          labActivityFactors: {},
          labActivityEqWts: {},
          labActivityManualWts: {},
          labAttendanceMarks: 0,
          labQuizMarks: 0,
          labVivaMarks: 0,
          activityTaken: 0,
          otherActivityRemaining: 0,
          otherActivityMeasured: 0,
          coMappedActivityMarks: 0,
          useEqWtActivity: 0,
          labActivityObtainedRows: []
        };
      }
      if (labDataRefreshKey !== lastLabDataRefreshKeyRef.current) {
        labActivityDataLoadedRef.current = false;
        lastLabDataRefreshKeyRef.current = labDataRefreshKey;
      }

      if (selectedCourse && selectedCourse._id && (selectedSheet === 'LabActivity' || selectedSheet === 'COCalc' || selectedSheet === 'COCalc_LabUnnorm' || selectedSheet === 'COAttainment' || selectedSheet === 'POCalcMax' || selectedSheet === 'POCalc' || selectedSheet === 'CheckPO' || selectedSheet === 'Charts')) {
        labActivityDataLoadedRef.current = true;
        let courseIdToUse = selectedCourse._id;
        if (selectedSheet === 'COCalc' || selectedSheet === 'COCalc_LabUnnorm' || selectedSheet === 'COAttainment' || selectedSheet === 'POCalcMax' || selectedSheet === 'POCalc' || selectedSheet === 'CheckPO' || selectedSheet === 'Charts') {
          const courseCode = selectedCourse.courseCode || '';
          const lastDigit = parseInt(courseCode.slice(-1));
          if (!isNaN(lastDigit) && lastDigit % 2 === 1) {
            const pairedCode = courseCode.slice(0, -1) + (lastDigit + 1);
            const labCourse = teacherCourses.find(c => c.courseCode === pairedCode);
            if (labCourse) courseIdToUse = labCourse._id;
          }
        }
        
        try {
          const response = await getLabActivityData(courseIdToUse);
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

            labPersistedRef.current = {
              labActivityRows: savedRows || [],
              labActivityFactors: savedFactors || {},
              labActivityEqWts: savedEqWts || {},
              labActivityManualWts: savedManualWts || {},
              labAttendanceMarks: savedLabAttendance ?? 0,
              labQuizMarks: savedLabQuiz ?? 0,
              labVivaMarks: savedLabViva ?? 0,
              activityTaken: savedActivityTaken ?? 0,
              otherActivityRemaining: savedOtherRemaining ?? 0,
              otherActivityMeasured: savedOtherMeasured ?? 0,
              coMappedActivityMarks: savedCoMapped ?? 0,
              useEqWtActivity: savedUseEqWt ?? 0,
              labActivityObtainedRows: savedObtained || []
            };

            setLabActivityRows(() => {
              if (!savedRows || savedRows.length === 0) {
                if (clos.length === 0) return [];
                return clos.map(clo => {
                  const cn = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                  return {
                    coNumber: cn,
                    attn: 0, quiz: 0, viva: 0,
                    Activity1_Q1: 0, Activity1_Q2: 0, Activity1_Q3: 0,
                    Activity2_Q1: 0, Activity2_Q2: 0, Activity2_Q3: 0,
                    Activity3_Q1: 0, Activity3_Q2: 0, Activity3_Q3: 0,
                    Activity4_Q1: 0, Activity4_Q2: 0, Activity4_Q3: 0,
                    Activity5_Q1: 0, Activity5_Q2: 0, Activity5_Q3: 0,
                    measuredTotal: 0, coTotal: 0
                  };
                });
              }
              if (clos.length === 0) return savedRows;
              const savedMap = {};
              savedRows.forEach(r => { savedMap[r.coNumber] = r; });
              return clos.map(clo => {
                const cn = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                return savedMap[cn] || {
                  coNumber: cn,
                  attn: 0, quiz: 0, viva: 0,
                  Activity1_Q1: 0, Activity1_Q2: 0, Activity1_Q3: 0,
                  Activity2_Q1: 0, Activity2_Q2: 0, Activity2_Q3: 0,
                  Activity3_Q1: 0, Activity3_Q2: 0, Activity3_Q3: 0,
                  Activity4_Q1: 0, Activity4_Q2: 0, Activity4_Q3: 0,
                  Activity5_Q1: 0, Activity5_Q2: 0, Activity5_Q3: 0,
                  measuredTotal: 0, coTotal: 0
                };
              });
            });
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
              const cleaned = savedObtained.filter(r => r.rollNumber && r.rollNumber.toLowerCase() !== 'roll');
              try {
                const stuResp = await fetchCourseStudentsCached(selectedCourse._id);
                if (stuResp.success && Array.isArray(stuResp.data) && stuResp.data.length > 0) {
                  const enrolled = stuResp.data
                    .map(s => ({ rollNumber: String(s.roll || s.rollNumber || '').trim(), name: s.name || '' }))
                    .filter(s => s.rollNumber && /^[0-9]{4,}$/.test(s.rollNumber));
                  if (enrolled.length > 0) {
                    const savedMap = {};
                    cleaned.forEach(r => { savedMap[String(r.rollNumber).trim()] = r; });
                    const merged = enrolled.map(s => savedMap[s.rollNumber] || {
                      rollNumber: s.rollNumber, name: s.name,
                      attn: 0, quiz: 0, viva: 0,
                      Activity1_Q1: 0, Activity1_Q2: 0, Activity1_Q3: 0,
                      Activity2_Q1: 0, Activity2_Q2: 0, Activity2_Q3: 0,
                      Activity3_Q1: 0, Activity3_Q2: 0, Activity3_Q3: 0,
                      Activity4_Q1: 0, Activity4_Q2: 0, Activity4_Q3: 0,
                      Activity5_Q1: 0, Activity5_Q2: 0, Activity5_Q3: 0,
                      otherMeasured: 0, other: 0,
                    });
                    setLabActivityObtainedRows(merged);
                  } else {
                    setLabActivityObtainedRows(cleaned);
                  }
                } else {
                  setLabActivityObtainedRows(cleaned);
                }
              } catch (e) {
                setLabActivityObtainedRows(cleaned);
              }
            } else {
              try {
                const stuResp = await fetchCourseStudentsCached(selectedCourse._id);
                if (stuResp.success && Array.isArray(stuResp.data) && stuResp.data.length > 0) {
                  const enrolled = stuResp.data
                    .map(s => ({ rollNumber: String(s.roll || s.rollNumber || '').trim(), name: s.name || '' }))
                    .filter(s => s.rollNumber && /^[0-9]{4,}$/.test(s.rollNumber));
                  if (enrolled.length > 0) {
                    setLabActivityObtainedRows(enrolled.map(s => ({
                      rollNumber: s.rollNumber, name: s.name,
                      attn: 0, quiz: 0, viva: 0,
                      Activity1_Q1: 0, Activity1_Q2: 0, Activity1_Q3: 0,
                      Activity2_Q1: 0, Activity2_Q2: 0, Activity2_Q3: 0,
                      Activity3_Q1: 0, Activity3_Q2: 0, Activity3_Q3: 0,
                      Activity4_Q1: 0, Activity4_Q2: 0, Activity4_Q3: 0,
                      Activity5_Q1: 0, Activity5_Q2: 0, Activity5_Q3: 0,
                    })));
                  }
                }
              } catch (e) {  }
            }
          } else {
            labActivityDataLoadedRef.current = false;
            initObtainedRows('LabActivity');
          }
        } catch (error) {
          console.error('[loadLabActivityData] Error loading saved data:', error);
          labActivityDataLoadedRef.current = false;
        }
      }
    };
    loadLabActivityData();
  }, [selectedCourse, selectedSheet, teacherCourses, labDataRefreshKey]);
  useEffect(() => {
    const loadSectionAData = async () => {
      const currentCourseId = selectedCourse?._id;
      if (currentCourseId !== previousCourseIdForSectionARef.current) {
        sectionADataLoadedRef.current = false;
        previousCourseIdForSectionARef.current = currentCourseId;
      }

      if (selectedCourse && selectedCourse._id) {
        let courseIdToUse = selectedCourse._id;
        if (selectedSheet === 'COCalc' || selectedSheet === 'COCalc_LabUnnorm' || selectedSheet === 'COAttainment' || selectedSheet === 'POCalcMax' || selectedSheet === 'POCalc' || selectedSheet === 'CheckPO' || selectedSheet === 'Charts') {
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
            const hasAllocatedData = (savedSectionARows && savedSectionARows.length > 0) ||
              (savedSectionBRows && savedSectionBRows.length > 0);

            if (!hasAllocatedData) {
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
              let allStudents = [];
              try {
                const resp = await fetchCourseStudentsCached(selectedCourse._id);
                if (resp.success && Array.isArray(resp.data) && resp.data.length > 0) {
                  allStudents = resp.data.map(s => ({
                    rollNumber: s.roll || s.rollNumber,
                    name: s.name
                  }));
                }
              } catch (error) {
                console.error('[loadSectionAData] Error fetching students:', error);
              }
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
              const dedupedSectionB = [];
              const seenRolls = new Set();
              if (savedSectionBObtainedRows) {
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
            sectionADataLoadedRef.current = true; // Mark as loaded to prevent re-initialization

            if (savedSectionARows && savedSectionARows.length > 0) {
              setSectionARows(() => {
                if (courseIdToUse !== selectedCourse._id) return savedSectionARows;
                if (clos.length === 0) return savedSectionARows;
                const savedMap = {};
                savedSectionARows.forEach(r => { savedMap[r.coNumber] = r; });
                return clos.map(clo => {
                  const cn = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                  return savedMap[cn] || {
                    coNumber: cn,
                    Q1a: 0, Q1b: 0, Q1c: 0, Q1d: 0,
                    Q2a: 0, Q2b: 0, Q2c: 0, Q2d: 0,
                    Q3a: 0, Q3b: 0, Q3c: 0, Q3d: 0,
                    Q4a: 0, Q4b: 0, Q4c: 0, Q4d: 0,
                    q123: 0, q124: 0, q134: 0, q234: 0,
                    q12: 0, q13: 0, q14: 0, q23: 0, q24: 0, q34: 0,
                    q1: 0, q2: 0, q3: 0, q4: 0, none: 0
                  };
                });
              });
            }
            if (savedSectionBRows && savedSectionBRows.length > 0) {
              setSectionBRows(() => {
                if (courseIdToUse !== selectedCourse._id) return savedSectionBRows;
                if (clos.length === 0) return savedSectionBRows;
                const savedMap = {};
                savedSectionBRows.forEach(r => { savedMap[r.coNumber] = r; });
                return clos.map(clo => {
                  const cn = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                  return savedMap[cn] || {
                    coNumber: cn,
                    Q1a: 0, Q1b: 0, Q1c: 0, Q1d: 0,
                    Q2a: 0, Q2b: 0, Q2c: 0, Q2d: 0,
                    Q3a: 0, Q3b: 0, Q3c: 0, Q3d: 0,
                    Q4a: 0, Q4b: 0, Q4c: 0, Q4d: 0,
                    q123: 0, q124: 0, q134: 0, q234: 0,
                    q12: 0, q13: 0, q14: 0, q23: 0, q24: 0, q34: 0,
                    q1: 0, q2: 0, q3: 0, q4: 0, none: 0
                  };
                });
              });
            }
            let allStudents = [];
            try {
              const resp = await fetchCourseStudentsCached(selectedCourse._id);
              if (resp.success && Array.isArray(resp.data) && resp.data.length > 0) {
                allStudents = resp.data.map(s => ({
                  rollNumber: s.roll || s.rollNumber,
                  name: s.name
                }));
              }
            } catch (error) {
              console.error('[loadSectionAData] Error fetching students:', error);
            }
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
            const dedupedSectionB = [];
            const seenRolls = new Set();
            if (savedSectionBObtainedRows) {
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
            sectionADataLoadedRef.current = false;
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
          sectionADataLoadedRef.current = false;
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
    const maxQ = (field) => Math.max(0, ...assignmentRows.map(r => r[field] || 0));
    const assgn1 = maxQ('Assgn1_Q1') + maxQ('Assgn1_Q2') + maxQ('Assgn1_Q3');
    const assgn2 = maxQ('Assgn2_Q1') + maxQ('Assgn2_Q2') + maxQ('Assgn2_Q3');
    const assgn3 = maxQ('Assgn3_Q1') + maxQ('Assgn3_Q2') + maxQ('Assgn3_Q3');
    return { assgn1, assgn2, assgn3 };
  };
  const assignmentColumnGroupTotals = () => {
    const sums = assignmentSums();
    return {
      Assgn1: sums.assgn1,
      Assgn2: sums.assgn2,
      Assgn3: sums.assgn3
    };
  };
  const calculateAssignmentAutoEqWt = () => {
    const sums = assignmentSums();
    const assignmentMarks = assignmentSummary.assignmentMarks30 || 0;
    const assignTaken = assignmentSummary.assignTaken || 1; // Avoid division by zero

    const result = {};
    if (sums.assgn1 > 0) {
      result.Assgn1 = assignmentMarks / assignTaken;
    } else {
      result.Assgn1 = 0;
    }
    if (sums.assgn2 > 0) {
      result.Assgn2 = assignmentMarks / assignTaken;
    } else {
      result.Assgn2 = 0;
    }
    if (sums.assgn3 > 0) {
      result.Assgn3 = assignmentMarks / assignTaken;
    } else {
      result.Assgn3 = 0;
    }

    return result;
  };
  const calculateAutoAssignmentFactor = () => {
    const assignmentTotals = assignmentColumnGroupTotals();
    const autoEqWt = calculateAssignmentAutoEqWt();
    const useEqWt = assignmentSummary.useEqWt || 0;
    const result = {};
    try {
      const totalMarks = assignmentTotals.Assgn1 || 0;
      if (totalMarks > 0) {
        if (useEqWt !== 0) {
          result.Assgn1 = autoEqWt.Assgn1 / totalMarks;
        } else {
          const manualWt = assignmentManualWts.Assgn1 > 0 ? assignmentManualWts.Assgn1 : totalMarks;
          result.Assgn1 = manualWt / totalMarks;
        }
      } else {
        result.Assgn1 = 0;
      }
    } catch (error) {
      result.Assgn1 = 0;
    }
    try {
      const totalMarks = assignmentTotals.Assgn2 || 0;
      if (totalMarks > 0) {
        if (useEqWt !== 0) {
          result.Assgn2 = autoEqWt.Assgn2 / totalMarks;
        } else {
          const manualWt = assignmentManualWts.Assgn2 > 0 ? assignmentManualWts.Assgn2 : totalMarks;
          result.Assgn2 = manualWt / totalMarks;
        }
      } else {
        result.Assgn2 = 0;
      }
    } catch (error) {
      result.Assgn2 = 0;
    }
    try {
      const totalMarks = assignmentTotals.Assgn3 || 0;
      if (totalMarks > 0) {
        if (useEqWt !== 0) {
          result.Assgn3 = autoEqWt.Assgn3 / totalMarks;
        } else {
          const manualWt = assignmentManualWts.Assgn3 > 0 ? assignmentManualWts.Assgn3 : totalMarks;
          result.Assgn3 = manualWt / totalMarks;
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
  const handleSectionAGeneratedCellChange = (index, field, value) => {
    const num = Number(value);
    const updated = [...sectionARows];
    updated[index] = { ...updated[index], [field]: isNaN(num) ? 0 : num };
    setSectionARows(updated);
  };
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
  const calculateStDevP = (combination) => {
    const values = sectionARows.map(row => calculateCombinationRatio(row, combination));
    const n = values.length;
    if (n === 0) return 0;
    const mean = values.reduce((sum, val) => sum + val, 0) / n;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
    return Math.sqrt(variance);
  };
  const calculateDist = (combination) => {
    return sectionARows.reduce((sum, row) => {
      const unitV = calculateUnitV(row);
      const combinationValue = calculateCombinationRatio(row, combination);
      return sum + Math.pow(unitV - combinationValue, 2);
    }, 0);
  };
  const getStudentQuestionTotal = (studentRow, questionNum) => {
    const parts = ['a', 'b', 'c', 'd'];
    return parts.reduce((sum, part) => {
      const field = `Q${questionNum}${part}`;
      return sum + (parseFloat(studentRow[field]) || 0);
    }, 0);
  };
  const getStudentCOTotal = (studentRow, coNumber) => {
    const coRow = sectionARows.find(r => r.coNumber === coNumber);
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
  const getStudentZeroCount = (studentRow) => {
    let zeroCount = 0;
    for (let qNum = 1; qNum <= 4; qNum++) {
      if (getStudentQuestionTotal(studentRow, qNum) === 0) {
        zeroCount++;
      }
    }
    return zeroCount;
  };
  const getStudentAnswerCombination = (studentRow) => {
    const answeredQuestions = [];
    for (let qNum = 1; qNum <= 4; qNum++) {
      if (getStudentQuestionTotal(studentRow, qNum) > 0) {
        answeredQuestions.push(qNum);
      }
    }
    return answeredQuestions.length > 0 ? answeredQuestions.join(',') : 'None';
  };
  const answerCombinationToKey = (answerCombination) => {
    if (!answerCombination || answerCombination === 'None') return 'none';
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
  const getStudentCODistribution = (studentRow, coNumber) => {
    const coRow = sectionARows.find(r => r.coNumber === coNumber);
    if (!coRow) return 0;
    const answerCombination = getStudentAnswerCombination(studentRow);
    const combinationKey = answerCombinationToKey(answerCombination);
    return getAutoGeneratedCombination(coRow, combinationKey);
  };
  const calculateQ1TotalB = (row) => (row.Q1a || 0) + (row.Q1b || 0) + (row.Q1c || 0) + (row.Q1d || 0);
  const calculateQ2TotalB = (row) => (row.Q2a || 0) + (row.Q2b || 0) + (row.Q2c || 0) + (row.Q2d || 0);
  const calculateQ3TotalB = (row) => (row.Q3a || 0) + (row.Q3b || 0) + (row.Q3c || 0) + (row.Q3d || 0);
  const calculateQ4TotalB = (row) => (row.Q4a || 0) + (row.Q4b || 0) + (row.Q4c || 0) + (row.Q4d || 0);
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
  const calculateSectionBCOMsrd = (row) => {
    const sum3combos = getAutoGeneratedCombinationB(row, 'q123') +
      getAutoGeneratedCombinationB(row, 'q124') +
      getAutoGeneratedCombinationB(row, 'q134') +
      getAutoGeneratedCombinationB(row, 'q234');
    return sum3combos > 0 ? 1 : 0;
  };
  const calculateTotalCOMsrdB = () => {
    return sectionBRows.reduce((sum, row) => sum + calculateSectionBCOMsrd(row), 0);
  };
  const calculateUnitVB = (row) => {
    const totalCOMsrd = calculateTotalCOMsrdB();
    if (totalCOMsrd === 0) return 0;
    return calculateSectionBCOMsrd(row) / totalCOMsrd;
  };
  const calculateCombinationRatioB = (row, combination) => {
    const totalForAllCOs = sectionBRows.reduce((sum, r) => sum + getAutoGeneratedCombinationB(r, combination), 0);
    if (totalForAllCOs === 0) return 0;
    return getAutoGeneratedCombinationB(row, combination) / totalForAllCOs;
  };
  const calculateStDevPB = (combination) => {
    const values = sectionBRows.map(row => calculateCombinationRatioB(row, combination));
    const n = values.length;
    if (n === 0) return 0;
    const mean = values.reduce((sum, val) => sum + val, 0) / n;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
    return Math.sqrt(variance);
  };
  const calculateDistB = (combination) => {
    return sectionBRows.reduce((sum, row) => {
      const unitV = calculateUnitVB(row);
      const combinationValue = calculateCombinationRatioB(row, combination);
      return sum + Math.pow(unitV - combinationValue, 2);
    }, 0);
  };
  const getStudentQuestionTotalB = (studentRow, questionNum) => {
    const parts = ['a', 'b', 'c', 'd'];
    return parts.reduce((sum, part) => {
      const field = `Q${questionNum}${part}`;
      return sum + (parseFloat(studentRow[field]) || 0);
    }, 0);
  };
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
  const getStudentZeroCountB = (studentRow) => {
    let zeroCount = 0;
    for (let qNum = 1; qNum <= 4; qNum++) {
      if (getStudentQuestionTotalB(studentRow, qNum) === 0) {
        zeroCount++;
      }
    }
    return zeroCount;
  };
  const getStudentAnswerCombinationB = (studentRow) => {
    const answeredQuestions = [];
    for (let qNum = 1; qNum <= 4; qNum++) {
      if (getStudentQuestionTotalB(studentRow, qNum) > 0) {
        answeredQuestions.push(qNum + 4); // Map 1-4 to 5-8 for Section B display
      }
    }
    return answeredQuestions.length > 0 ? answeredQuestions.join(',') : 'None';
  };
  const answerCombinationToKeyB = (answerCombination) => {
    if (!answerCombination || answerCombination === 'None') return 'none';
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
  const getStudentCODistributionB = (studentRow, coNumber) => {
    const coRow = sectionBRows.find(r => r.coNumber === coNumber);
    if (!coRow) return 0;
    const answerCombination = getStudentAnswerCombinationB(studentRow);
    const combinationKey = answerCombinationToKeyB(answerCombination);
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
  const handleSectionAObtainedCellChange = (index, field, value) => {
    const num = Number(value);
    const raw = isNaN(num) ? 0 : Math.max(0, num);
    const maxAllowed = sectionARows.reduce((sum, coRow) => sum + (coRow[field] || 0), 0);
    const capped = maxAllowed > 0 ? Math.min(raw, maxAllowed) : raw;
    const updated = [...sectionAObtainedRows];
    updated[index] = { ...updated[index], [field]: capped };
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
  const handleSectionBObtainedCellChange = (index, field, value) => {
    const num = Number(value);
    const raw = isNaN(num) ? 0 : Math.max(0, num);
    const maxAllowed = sectionBRows.reduce((sum, coRow) => sum + (coRow[field] || 0), 0);
    const capped = maxAllowed > 0 ? Math.min(raw, maxAllowed) : raw;
    const updated = [...sectionBObtainedRows];
    updated[index] = { ...updated[index], [field]: capped };
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
  const computeLabActivityMeasuredTotal = (row) => {
    let sum = 0;
    for (let i = 1; i <= (activityTaken || 5); i++) {
      sum += (row[`Activity${i}_Q1`] || 0) + (row[`Activity${i}_Q2`] || 0) + (row[`Activity${i}_Q3`] || 0);
    }
    return sum;
  };
  const getLabActivityFactoredValue = (row, field, activityKey) => {
    try {
      const cellValue = parseFloat(row[field]) || 0;
      if (cellValue === 0) return 0;
      const totals = labActivityActivityTotals();
      const activityTotal = totals[activityKey] || 0;
      let calculatedFactor = 0;

      if (activityTotal > 0) {
        if (useEqWtActivity) {
          const eqWtValue = (coMappedActivityMarks || 0) / (activityTaken || 1);
          calculatedFactor = eqWtValue / activityTotal;
        } else {
          const manualWtValue = labActivityManualWts[activityKey] || 0;
          calculatedFactor = manualWtValue / activityTotal;
        }
      }

      return cellValue * calculatedFactor;
    } catch (error) {
      return 0;
    }
  };
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
  const getLabActivityStudentCOMarks = (studentRow, coNumber) => {
    try {
      const coRow = labActivityRows.find(r => r.coNumber === coNumber);
      if (!coRow) return 0;

      let studentTotal = 0;
      if ((coRow.attn || 0) > 0) {
        studentTotal += (parseFloat(studentRow.attn) || 0);
      }
      if ((coRow.quiz || 0) > 0) {
        studentTotal += (parseFloat(studentRow.quiz) || 0);
      }
      if ((coRow.viva || 0) > 0) {
        studentTotal += (parseFloat(studentRow.viva) || 0);
      }
      for (let i = 1; i <= (activityTaken || 5); i++) {
        const q1Field = `Activity${i}_Q1`;
        const q2Field = `Activity${i}_Q2`;
        const q3Field = `Activity${i}_Q3`;
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
  const getLabActivityStudentCOMappedMarks = (studentRow, coNumber) => {
    try {
      const coRow = labActivityRows.find(r => r.coNumber === coNumber);
      if (!coRow) return 0;

      let total = 0;
      const totals = labActivityActivityTotals();
      for (let i = 1; i <= (activityTaken || 5); i++) {
        const activityKey = `activity${i}`;
        const q1Field = `Activity${i}_Q1`;
        const q2Field = `Activity${i}_Q2`;
        const q3Field = `Activity${i}_Q3`;
        const activityTotal = totals[activityKey] || 0;
        let calculatedFactor = 0;

        if (activityTotal > 0) {
          if (useEqWtActivity) {
            const eqWtValue = (coMappedActivityMarks || 0) / (activityTaken || 1);
            calculatedFactor = eqWtValue / activityTotal;
          } else {
            const manualWtValue = labActivityManualWts[activityKey] || 0;
            calculatedFactor = manualWtValue / activityTotal;
          }
        }
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
  const getLabActivityCOAttainment = (studentRow, coNumber) => {
    try {
      if (!studentRow.rollNumber) {
        return null;
      }

      const obtainedMarks = getLabActivityStudentCOMappedMarks(studentRow, coNumber);
      const coRow = labActivityRows.find(r => r.coNumber === coNumber);
      if (!coRow) return 0;

      const allocatedMarks = getLabActivityGeneratedCOTotal(coRow);
      if (allocatedMarks === 0) return 0;
      return obtainedMarks / allocatedMarks;
    } catch (error) {
      return 0;
    }
  };
  const getLabActivityStudentTotalMarks = (studentRow) => {
    try {
      let total = 0;
      total += parseFloat(studentRow.attn) || 0;
      total += parseFloat(studentRow.quiz) || 0;
      total += parseFloat(studentRow.viva) || 0;
      const rawOther = parseFloat(studentRow.otherMeasured) || 0;
      if (rawOther > 0 && (otherActivityRemaining || 0) > 0) {
        const totals = labActivityActivityTotals();
        let measuredTotal = (labAttendanceMarks || 0) + (labQuizMarks || 0) + (labVivaMarks || 0);
        for (let i = 1; i <= (activityTaken || 5); i++) measuredTotal += totals[`activity${i}`] || 0;
        total += measuredTotal > 0 ? rawOther * ((otherActivityRemaining || 0) / measuredTotal) : 0;
      } else {
        total += parseFloat(studentRow.other) || 0;
      }
      labActivityRows.forEach(coRow => {
        total += getLabActivityStudentCOMappedMarks(studentRow, coRow.coNumber);
      });

      return total;
    } catch (error) {
      return 0;
    }
  };
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
  const getGradeColor = (grade) => {
    switch (grade) {
      case 'A+': return '#006400'; // dark green
      case 'A':  return '#228b22'; // forest green
      case 'A-': return '#32cd32'; // lime green
      case 'B+': return '#9acd32'; // yellow-green
      case 'B':  return '#ffd700'; // gold
      case 'B-': return '#ffa500'; // orange
      case 'C+': return '#ff6600'; // dark orange
      case 'C':  return '#ff3300'; // red-orange
      case 'D':  return '#cc0000'; // dark red
      case 'F':  return '#e00000'; // danger red
      default:   return '#065f46';
    }
  };
  const getLabActivityGeneratedCOTotal = (row) => {
    try {
      let total = 0;
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
  const calculateAutoEqWt = () => {
    const sums = ctSums();
    const coMappedMarks = ctSummary.coMappedMarks60 || 0;
    const ctTaken = ctSummary.ctTaken || 1; // Avoid division by zero

    const result = {};
    if (sums.ct1 > 0) {
      result.CT1 = coMappedMarks / ctTaken;
    } else {
      result.CT1 = 0;
    }
    if (sums.ct2 > 0) {
      result.CT2 = coMappedMarks / ctTaken;
    } else {
      result.CT2 = 0;
    }
    if (sums.ct3 > 0) {
      result.CT3 = coMappedMarks / ctTaken;
    } else {
      result.CT3 = 0;
    }

    return result;
  };
  const calculateAutoFactor = () => {
    const ctTotals = ctColumnTotals();
    const autoEqWt = calculateAutoEqWt();
    const useEqWt = ctSummary.useEqWt || 0;
    const result = {};
    try {
      const totalMarks = ctTotals.CT1 || 0;
      if (totalMarks > 0) {
        if (useEqWt !== 0) {
          result.CT1 = autoEqWt.CT1 / totalMarks;
        } else {
          const manualWt = ctManualWts.CT1 > 0 ? ctManualWts.CT1 : totalMarks;
          result.CT1 = manualWt / totalMarks;
        }
      } else {
        result.CT1 = 0;
      }
    } catch (error) {
      result.CT1 = 0;
    }
    try {
      const totalMarks = ctTotals.CT2 || 0;
      if (totalMarks > 0) {
        if (useEqWt !== 0) {
          result.CT2 = autoEqWt.CT2 / totalMarks;
        } else {
          const manualWt = ctManualWts.CT2 > 0 ? ctManualWts.CT2 : totalMarks;
          result.CT2 = manualWt / totalMarks;
        }
      } else {
        result.CT2 = 0;
      }
    } catch (error) {
      result.CT2 = 0;
    }
    try {
      const totalMarks = ctTotals.CT3 || 0;
      if (totalMarks > 0) {
        if (useEqWt !== 0) {
          result.CT3 = autoEqWt.CT3 / totalMarks;
        } else {
          const manualWt = ctManualWts.CT3 > 0 ? ctManualWts.CT3 : totalMarks;
          result.CT3 = manualWt / totalMarks;
        }
      } else {
        result.CT3 = 0;
      }
    } catch (error) {
      result.CT3 = 0;
    }

    return result;
  };
  const coAttainmentKeyRef = useRef('');
  useEffect(() => {
    const key = `${selectedSheet}__${selectedCourse?._id || ''}`;
    if (key !== coAttainmentKeyRef.current) {
      coAttainmentKeyRef.current = key;
      setCoAttainmentReady(false);
    }
  }, [selectedSheet, selectedCourse]);

  const sumEqWtTotal = () => {
    const autoEqWt = calculateAutoEqWt();
    return (autoEqWt.CT1 + autoEqWt.CT2 + autoEqWt.CT3);
  };

  const sumManualWtTotal = () => {
    const { CT1 = 0, CT2 = 0, CT3 = 0 } = ctManualWts || {};
    return (CT1 + CT2 + CT3);
  };
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
    const raw = isNaN(num) ? 0 : Math.max(0, num);
    const maxAllowed = ctRows.reduce((sum, coRow) => sum + (coRow[field] || 0), 0);
    const capped = maxAllowed > 0 ? Math.min(raw, maxAllowed) : raw;
    const updated = [...ctObtainedRows];
    updated[index] = { ...updated[index], [field]: capped };
    setCtObtainedRows(updated);
  };

  const computeObtainedTotal = (row) => {
    const v = (val) => (val === 'A' || val === 'Absent' ? 0 : (parseFloat(val) || 0));
    return (
      v(row.CT1_Q1) + v(row.CT1_Q2) + v(row.CT1_Q3) +
      v(row.CT2_Q1) + v(row.CT2_Q2) + v(row.CT2_Q3) +
      v(row.CT3_Q1) + v(row.CT3_Q2) + v(row.CT3_Q3)
    );
  };
  useEffect(() => {
    if (selectedCourse && sheetNames.length > 0) {
      const courseCode = (selectedCourse.courseCode || '').toLowerCase();
      const lastDigitMatch = courseCode.match(/(\d)(?:\s*)$/);
      const lastDigitNum = lastDigitMatch ? parseInt(lastDigitMatch[1]) : NaN;
      const isLabCourse = !isNaN(lastDigitNum) && lastDigitNum % 2 === 0;
      const isTheoryCourse = !isNaN(lastDigitNum) && lastDigitNum % 2 === 1;
      const theorySheets = [
        'CourseProfile', 'CT', 'Attn_Assign', 'SectionA', 'SectionB', 'COAttainment', 'COCalc', 'COCalc_LabUnnorm', 'COPOMap', 'POCalcMax', 'Charts', 'POCalc', 'CheckPO'
      ];

      const labSheets = [
        'CourseProfile', 'LabActivity', 'COAttainment', 'COCalc_LabUnnorm',
        'COCalc', 'COPOMap', 'POCalcMax', 'Charts', 'POCalc', 'CheckPO'
      ];
      const allowedSheets = isTheoryCourse ? theorySheets : labSheets;
      let filtered = sheetNames.filter(sheet => allowedSheets.includes(sheet));
      const defaultSheets = isTheoryCourse ? ['CourseProfile'] : ['CourseProfile', 'LabActivity'];

      defaultSheets.forEach(sheet => {
        if (!filtered.includes(sheet)) {
          filtered.unshift(sheet);
        }
      });
      if (isTheoryCourse && selectedCourse.section) {
        const teacherSection = `Section${selectedCourse.section}`;
        filtered = filtered.filter(sheet => {
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
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const userId = user._id || user.id;
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
    if (field !== 'cloPloCorrelation') return;
    if (userRole !== 'teacher' && userRole !== 'admin') return;
    setEditingCLOCell({ cloNumber, field, value: currentValue });
  };

  const handleCLOCellSave = async () => {
    if (!editingCLOCell) return;
    try {
      setSaving(true);
      const clo = clos.find(c => c.cloNumber === editingCLOCell.cloNumber);
      if (clo && clo._id && selectedCourse && selectedCourse._id && editingCLOCell.field === 'cloPloCorrelation') {
        await updateCOCorrelation(selectedCourse._id, clo._id, editingCLOCell.value);
      }
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
  const refreshTeacherCourses = useCallback(async () => {
    try {
      const data = await getAllCourses();
      const courseList = Array.isArray(data) ? data : (data.courses || []);
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const userId = user._id || user.id;
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
      if (coursesWithSection && coursesWithSection.length > 0) {
        setTeacherCourses(coursesWithSection);
        if (selectedCourse) {
          const updated = coursesWithSection.find(c => c._id === selectedCourse._id);
          if (updated) {
            setSelectedCourse(updated);
          }
        }
      } else {
      }
    } catch (err) {
      logger.error('ðŸš¨ refreshTeacherCourses error:', err);
    }
  }, [selectedCourse]);
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.role === 'teacher') {
      refreshTeacherCourses();
    }
  }, [refreshTeacherCourses]);
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

      {}
      {loading && attainmentData && (
        <div className="attainment-loading-banner">
          <SheetLoader label="" />
          <p className="attainment-loading-banner__text">Refreshing sheet dataâ€¦</p>
        </div>
      )}

      {error && (
        <div className="attainment-error" style={{ marginBottom: '20px' }}>
          Error: {error}
        </div>
      )}

      {}
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


      {}
      {selectedCourse && (
        <>
          {}
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

          {}
          {selectedSheet === 'CourseProfile' && clos.length > 0 && (
            <CourseProfileSheet clos={clos} renderCLOCell={renderCLOCell} />
          )}

          {}
          {selectedSheet === 'CT' && (
            <CTSheet
              ctRows={ctRows}
              ctManualWts={ctManualWts}
              ctSummary={ctSummary}
              ctObtainedRows={ctObtainedRows}
              setCtRows={setCtRows}
              setCtObtainedRows={setCtObtainedRows}
              setCtManualWts={setCtManualWts}
              setShowGeneratedTableModal={setShowGeneratedTableModal}
              setShowObtainedGeneratedModal={setShowObtainedGeneratedModal}
              handleManualSaveCT={handleManualSave}
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

          {}
          {selectedSheet === 'SectionA' && (
            <SectionASheet
              clos={clos}
              sectionARows={sectionARows}
              sectionAObtainedRows={sectionAObtainedRows}
              computeSectionAObtainedTotal={computeSectionAObtainedTotal}
              sectionAQuestionTotals={sectionAQuestionTotals}
              setShowSectionAGeneratedModal={setShowSectionAGeneratedModal}
              setShowSectionAObtainedModal={setShowSectionAObtainedModal}
            />
          )}

          {}
          {selectedSheet === 'SectionB' && (
            <SectionBSheet
              clos={clos}
              sectionBRows={sectionBRows}
              sectionBObtainedRows={sectionBObtainedRows}
              computeSectionBObtainedTotal={computeSectionBObtainedTotal}
              sectionBQuestionTotals={sectionBQuestionTotals}
              setShowSectionBGeneratedModal={setShowSectionBGeneratedModal}
              setShowSectionBObtainedModal={setShowSectionBObtainedModal}
            />
          )}

          {}
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
              setLabActivityRows={setLabActivityRows}
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

          {}
          {selectedSheet === 'Attn_Assign' && (
            <AssignmentSheet
              clos={clos}
              assignmentRows={assignmentRows}
              attnAssignObtainedRows={attnAssignObtainedRows}
              attendanceMarks={attendanceMarks}
              assignmentManualWts={assignmentManualWts}
              assignmentSummary={assignmentSummary}
              setAssignmentRows={setAssignmentRows}
              setAttnAssignObtainedRows={setAttnAssignObtainedRows}
              setAssignmentManualWts={setAssignmentManualWts}
              setShowGeneratedTableModal={setShowGeneratedTableModal}
              setShowObtainedGeneratedModal={setShowObtainedGeneratedModal}
              handleManualSaveAssignment={handleManualSaveAssignment}
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

      {}
      {!attainmentData && !loading && selectedSheet && (
        <SkeletonTable rows={7} cols={6} />
      )}

      {}
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

          {}
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

          {}
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

          {}
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

          {}
          {selectedCourse && selectedSheet === 'COAttainment' && (
            coAttainmentReady ? (
              <COAttainmentSheet
                selectedCourse={selectedCourse}
                clos={combinedClos.length > 0 ? combinedClos : clos}
                ownClos={clos}
                isStandaloneCourse={isStandaloneCourse === true}
                coAttainmentData={coAttainmentData}
                theoryCoAttainmentData={theoryCoAttainmentData}
                labCoAttainmentData={labCoAttainmentData}
                combinedCoAttainmentData={combinedCoAttainmentData}
                unnormedCoAttainmentData={unnormedCoAttainmentData}
                equalWtCoAttainmentData={equalWtCoAttainmentData}
                formatNumber={formatNumber}
                onResetData={async () => {
                  if (!selectedCourse?._id) return;
                  if (!window.confirm(
                    `Reset ALL attainment data for ${selectedCourse.courseCode}?\n\n` +
                    'This will permanently delete CT, Assignment, and Lab Activity marks for the current batch. ' +
                    'This action cannot be undone.'
                  )) return;
                  try {
                    await resetAttainmentData(selectedCourse._id);
                    setCtRows([]);
                    setCtManualWts({});
                    setCtSummary({ ctTaken: 0, coMappedMarks60: 0, useEqWt: 0 });
                    setCtObtainedRows([]);
                    ctDataLoadedRef.current = false;
                    setAssignmentRows([]);
                    setAssignmentManualWts({});
                    setAssignmentSummary({ assignTaken: 0, assignmentMarks30: 0, useEqWt: 0 });
                    setAttendanceMarks(0);
                    setAttnAssignObtainedRows([]);
                    assignmentDataLoadedRef.current = false;
                    setLabActivityRows([]);
                    setLabActivityFactors({});
                    setLabActivityEqWts({});
                    setLabActivityManualWts({});
                    setLabActivityObtainedRows([]);
                    setLabAttendanceMarks(0);
                    setActivityTaken(0);
                    setCoMappedActivityMarks(0);
                    labActivityDataLoadedRef.current = false;
                    coCalcApiCacheRef.current = null;
                    refreshCoAttainmentCalcs();
                  } catch (err) {
                    alert('Failed to reset attainment data: ' + (err?.message || err?.error || 'Unknown error'));
                  }
                }}
              />
            ) : (
              <SheetLoader label="Calculating CO Attainmentâ€¦" />
            )
          )}

          {}
          {(selectedSheet === 'COCalc' || selectedSheet === 'COCalc_LabUnnorm') && (
            <COCalcSheet
              selectedSheet={selectedSheet}
              selectedCourse={selectedCourse}
              clos={clos}
              combinedClos={combinedClos}
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
              calculateAssignmentCOTotalsNoAttendance={calculateAssignmentCOTotalsNoAttendance}
              getStudentCTFactoredMarks={getStudentCTFactoredMarks}
              getStudentAssignmentFactoredMarks={getStudentAssignmentFactoredMarks}
              getStudentAssignmentOriginalMarks={getStudentAssignmentOriginalMarks}
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

          {}
          {selectedSheet === 'COPOMap' && (
            <COPOMapSheet
              selectedCourse={selectedCourse}
              clos={clos}
              programOutcomes={programOutcomes}
              combinedCOPOMatrix={combinedCOPOMatrix}
              matchingCourseCode={matchingCourseCode}
            />
          )}

          {}
          {selectedSheet === 'POCalcMax' && (
            <POCalcMaxSheet
              selectedCourse={selectedCourse}
              clos={clos}
              programOutcomes={programOutcomes}
              poCalcStudents={poCalcStudents}
              theoryCoAttainmentData={theoryCoAttainmentData}
              labCoAttainmentData={labCoAttainmentData}
              combinedCoAttainmentData={combinedCoAttainmentData}
              combinedCOPOMatrix={combinedCOPOMatrix}
              unnormedCoAttainmentData={unnormedCoAttainmentData}
              equalWtCoAttainmentData={equalWtCoAttainmentData}
            />
          )}

          {}
          {selectedSheet === 'Charts' && (
            <ChartsSheet
              selectedCourse={selectedCourse}
              clos={clos}
              combinedClos={combinedClos}
              isStandaloneCourse={isStandaloneCourse === true}
              programOutcomes={programOutcomes}
              combinedCOPOMatrix={combinedCOPOMatrix}
              theoryCoAttainmentData={theoryCoAttainmentData}
              combinedCoAttainmentData={combinedCoAttainmentData}
              unnormedCoAttainmentData={unnormedCoAttainmentData}
              equalWtCoAttainmentData={equalWtCoAttainmentData}
            />
          )}

          {}
          {selectedSheet === 'CheckPO' && (
            <CheckPOSheet
              selectedCourse={selectedCourse}
              clos={clos}
              programOutcomes={programOutcomes}
              poCalcStudents={poCalcStudents}
              theoryCoAttainmentData={theoryCoAttainmentData}
            />
          )}

          {}
          {selectedSheet === 'POCalc' && (
            <POCalcSheet
              selectedCourse={selectedCourse}
              clos={clos}
              programOutcomes={programOutcomes}
              poCalcStudents={poCalcStudents}
              theoryCoAttainmentData={theoryCoAttainmentData}
              labCourseClos={labCourseClos}
              labCoAttainmentData={labCoAttainmentData}
              combinedCoAttainmentData={combinedCoAttainmentData}
              combinedCOPOMatrix={combinedCOPOMatrix}
            />
          )}
    </div>
  );
};

export default AttainmentView;
