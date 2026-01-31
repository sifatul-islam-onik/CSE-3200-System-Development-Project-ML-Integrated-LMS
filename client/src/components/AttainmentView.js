import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  getAttainmentData,
  getSheetNames,
  updateStudentPoValue,
  saveCTData,
  getCTData,
} from '../services/attainmentService';
import { getCourseProfile } from '../services/courseProfileService';
import { getCourseStudents } from '../services/courseService';
import { getAllCourses } from '../services/courseService';
import '../styles/AttainmentView.css';

// Helper function to safely render cell values
const renderCellValue = (value) => {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'object') {
    // Handle formula objects or other objects
    return value.result !== undefined ? value.result : '-';
  }
  return value.toString();
};

const AttainmentView = () => {
  const [sheetNames, setSheetNames] = useState([]);
  const [teacherCourses, setTeacherCourses] = useState([]);
  const [selectedSheet, setSelectedSheet] = useState(null);
  const [attainmentData, setAttainmentData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editingCell, setEditingCell] = useState(null);
  const [saving, setSaving] = useState(false);
  const [userRole, setUserRole] = useState('');
  const [clos, setClos] = useState([]);
  const [editingCLOCell, setEditingCLOCell] = useState(null);
  const [showCourseProfile, setShowCourseProfile] = useState(true);
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
  const saveTimeoutRef = useRef(null);
  
  // Assignment & Attendance states
  const [assignmentRows, setAssignmentRows] = useState([]);
  const [assignmentFactors, setAssignmentFactors] = useState({});
  const [assignmentEqWts, setAssignmentEqWts] = useState({});
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
  
  // Load user role
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    setUserRole(user.role || '');
  }, []);

  // Load sheet names on mount
  useEffect(() => {
    loadSheetNames();
  }, []);

  // Load course profile function
  const loadCourseProfile = useCallback(async () => {
    if (!selectedCourse) return;
    try {
      console.log('Loading course profile for:', selectedCourse.courseCode);
      const response = await getCourseProfile(selectedCourse.courseCode);
      console.log('Course profile response:', response);
      if (response.success && response.data) {
        console.log('Setting CLOs:', response.data);
        setClos(response.data);
      } else {
        console.log('No data in response');
        setClos([]);
      }
    } catch (err) {
      console.error('Failed to load course profile:', err);
      setClos([]);
    }
  }, [selectedCourse]);

  // Load/clear course outcomes for CourseProfile, CT, Attn_Assign, SectionA and SectionB views
  useEffect(() => {
    console.log('CLO loading effect triggered:', { selectedCourse, selectedSheet, hasSelectedCourse: !!selectedCourse });
    if (selectedCourse && (selectedSheet === 'CourseProfile' || selectedSheet === 'CT' || selectedSheet === 'Attn_Assign' || selectedSheet === 'SectionA' || selectedSheet === 'SectionB' || selectedSheet === 'LabActivity')) {
      console.log('Loading course profile for sheet:', selectedSheet);
      loadCourseProfile();
    } else {
      console.log('Clearing CLOs');
      setClos([]);
    }
  }, [selectedCourse, selectedSheet, loadCourseProfile]);

  // Initialize CT matrix rows when clos is available and CT is selected
  useEffect(() => {
    if (selectedSheet === 'CT' && clos.length > 0) {
      const initial = clos.map(clo => ({
        coNumber: (clo.cloNumber || '').toString().replace('CLO', 'CO'),
        CT1_Q1: 0, CT1_Q2: 0, CT1_Q3: 0,
        CT2_Q1: 0, CT2_Q2: 0, CT2_Q3: 0,
        CT3_Q1: 0, CT3_Q2: 0, CT3_Q3: 0,
      }));
      setCtRows(initial);
      // initialize factors (default 1) and manual weights (default 0)
      const fields = ['CT1_Q1','CT1_Q2','CT1_Q3','CT2_Q1','CT2_Q2','CT2_Q3','CT3_Q1','CT3_Q2','CT3_Q3'];
      const manualInit = {};
      fields.forEach(f => { manualInit[f] = 0; });
      setCtFactors({ CT1: 1, CT2: 1, CT3: 1 });
      setCtEqWts({ CT1: 0, CT2: 0, CT3: 0 });
      setCtManualWts(manualInit);
      setCtSummary({ ctTaken: 0, coMappedMarks60: 0, useEqWt: 0 });
    }
    if (selectedSheet !== 'CT') {
      setCtRows([]);
      setCtFactors({});
      setCtEqWts({});
      setCtManualWts({});
      setCtSummary({ ctTaken: 0, coMappedMarks60: 0, useEqWt: 0 });
    }
  }, [selectedSheet, clos]);

  // Initialize Assignment matrix rows when clos is available and Attn_Assign is selected
  useEffect(() => {
    console.log('Assignment initialization effect:', { selectedSheet, closLength: clos.length, clos });
    if (selectedSheet === 'Attn_Assign' && clos.length > 0) {
      const initial = clos.map(clo => ({
        coNumber: (clo.cloNumber || '').toString().replace('CLO', 'CO'),
        attendance: 0,
        Assgn1_Q1: 0, Assgn1_Q2: 0, Assgn1_Q3: 0,
        Assgn2_Q1: 0, Assgn2_Q2: 0, Assgn2_Q3: 0,
        Assgn3_Q1: 0, Assgn3_Q2: 0, Assgn3_Q3: 0,
      }));
      setAssignmentRows(initial);
      
      // Initialize factors, eq wt, and manual wt
      const manualInit = {};
      ['Assgn1_Q1','Assgn1_Q2','Assgn1_Q3','Assgn2_Q1','Assgn2_Q2','Assgn2_Q3','Assgn3_Q1','Assgn3_Q2','Assgn3_Q3'].forEach(f => {
        manualInit[f] = 0;
      });
      setAssignmentFactors({ Assgn1: 1, Assgn2: 1, Assgn3: 1 });
      setAssignmentEqWts({ Assgn1: 0, Assgn2: 0, Assgn3: 0 });
      setAssignmentManualWts(manualInit);
      
      // Get attendance marks from course
      if (selectedCourse && selectedCourse.attendanceMarks) {
        setAttendanceMarks(selectedCourse.attendanceMarks);
      } else {
        setAttendanceMarks(0);
      }
    }
    if (selectedSheet !== 'Attn_Assign') {
      setAssignmentRows([]);
      setAssignmentFactors({});
      setAssignmentEqWts({});
      setAssignmentManualWts({});
      setAttendanceMarks(0);
    }
  }, [selectedSheet, clos, selectedCourse]);

  // Initialize SectionA matrix rows when clos is available and SectionA is selected
  useEffect(() => {
    if (selectedSheet === 'SectionA' && clos.length > 0) {
      const initial = clos.map(clo => ({
        coNumber: (clo.cloNumber || '').toString().replace('CLO', 'CO'),
        Q1a: 0, Q1b: 0, Q1c: 0, Q1d: 0,
        Q2a: 0, Q2b: 0, Q2c: 0, Q2d: 0,
        Q3a: 0, Q3b: 0, Q3c: 0, Q3d: 0,
        Q4a: 0, Q4b: 0, Q4c: 0, Q4d: 0,
      }));
      setSectionARows(initial);
    }
    if (selectedSheet !== 'SectionA') {
      setSectionARows([]);
    }
  }, [selectedSheet, clos]);

  // Initialize SectionB matrix rows when clos is available and SectionB is selected
  useEffect(() => {
    if (selectedSheet === 'SectionB' && clos.length > 0) {
      const initial = clos.map(clo => ({
        coNumber: (clo.cloNumber || '').toString().replace('CLO', 'CO'),
        Q1a: 0, Q1b: 0, Q1c: 0, Q1d: 0,
        Q2a: 0, Q2b: 0, Q2c: 0, Q2d: 0,
        Q3a: 0, Q3b: 0, Q3c: 0, Q3d: 0,
        Q4a: 0, Q4b: 0, Q4c: 0, Q4d: 0,
      }));
      setSectionBRows(initial);
    }
    if (selectedSheet !== 'SectionB') {
      setSectionBRows([]);
    }
  }, [selectedSheet, clos]);

  // Initialize LabActivity matrix rows when clos is available and LabActivity is selected
  useEffect(() => {
    if (selectedSheet === 'LabActivity' && clos.length > 0) {
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
    if (selectedSheet !== 'LabActivity') {
      setLabActivityRows([]);
    }
  }, [selectedSheet, clos]);

  // Initialize Obtained Marks table rows from student list when CT, Attn_Assign, SectionA or SectionB selected
  useEffect(() => {
    const initObtainedRows = async (forSheet) => {
      let allStudents = [];
      if (selectedCourse && selectedCourse._id) {
        try {
          const resp = await getCourseStudents(selectedCourse._id);
          if (resp.success && Array.isArray(resp.data) && resp.data.length > 0) {
            allStudents = resp.data.map(s => ({ rollNumber: s.roll || s.rollNumber, name: s.name }));
          }
        } catch {}
      }
      if (allStudents.length === 0) {
        const sectionSheets = (sheetNames || []).filter(name => /^Section/i.test(name));
        for (const sName of sectionSheets) {
          try {
            const resp = await getAttainmentData(sName);
            const list = Array.isArray(resp?.data?.students) ? resp.data.students : [];
            if (list.length) allStudents = allStudents.concat(list);
          } catch {}
        }
      }
      if (allStudents.length === 0 && (sheetNames || []).includes('Attn_Assign')) {
        try {
          const resp = await getAttainmentData('Attn_Assign');
          const list = Array.isArray(resp?.data?.students) ? resp.data.students : [];
          if (list.length) allStudents = allStudents.concat(list);
        } catch {}
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
      if (uniqueByRoll.length > 0) {
        if (forSheet === 'CT') {
          const initial = uniqueByRoll.map(stu => ({
            rollNumber: stu.rollNumber,
            name: stu.name,
            CT1_Q1: 0, CT1_Q2: 0, CT1_Q3: 0,
            CT2_Q1: 0, CT2_Q2: 0, CT2_Q3: 0,
            CT3_Q1: 0, CT3_Q2: 0, CT3_Q3: 0,
          }));
          setCtObtainedRows(initial);
        } else if (forSheet === 'Attn_Assign') {
          const initial = uniqueByRoll.map(stu => ({
            rollNumber: stu.rollNumber,
            name: stu.name,
            attendance: 0,
            Assgn1_Q1: 0, Assgn1_Q2: 0, Assgn1_Q3: 0,
            Assgn2_Q1: 0, Assgn2_Q2: 0, Assgn2_Q3: 0,
            Assgn3_Q1: 0, Assgn3_Q2: 0, Assgn3_Q3: 0,
          }));
          setAttnAssignObtainedRows(initial);
        } else if (forSheet === 'SectionA') {
          const initial = uniqueByRoll.map(stu => ({
            rollNumber: stu.rollNumber,
            name: stu.name,
            Q1a: 0, Q1b: 0, Q1c: 0, Q1d: 0,
            Q2a: 0, Q2b: 0, Q2c: 0, Q2d: 0,
            Q3a: 0, Q3b: 0, Q3c: 0, Q3d: 0,
            Q4a: 0, Q4b: 0, Q4c: 0, Q4d: 0,
          }));
          setSectionAObtainedRows(initial);
        } else if (forSheet === 'SectionB') {
          const initial = uniqueByRoll.map(stu => ({
            rollNumber: stu.rollNumber,
            name: stu.name,
            Q1a: 0, Q1b: 0, Q1c: 0, Q1d: 0,
            Q2a: 0, Q2b: 0, Q2c: 0, Q2d: 0,
            Q3a: 0, Q3b: 0, Q3c: 0, Q3d: 0,
            Q4a: 0, Q4b: 0, Q4c: 0, Q4d: 0,
          }));
          setSectionBObtainedRows(initial);
        } else if (forSheet === 'LabActivity') {
          const initial = uniqueByRoll.map(stu => ({
            rollNumber: stu.rollNumber,
            name: stu.name,
            attendance: 0,
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
        }
      } else {
        if (forSheet === 'CT') setCtObtainedRows([]);
        else if (forSheet === 'Attn_Assign') setAttnAssignObtainedRows([]);
        else if (forSheet === 'SectionA') setSectionAObtainedRows([]);
        else if (forSheet === 'SectionB') setSectionBObtainedRows([]);
        else if (forSheet === 'LabActivity') setLabActivityObtainedRows([]);
      }
    };
    if (selectedSheet === 'CT') initObtainedRows('CT');
    else if (selectedSheet === 'Attn_Assign') initObtainedRows('Attn_Assign');
    else if (selectedSheet === 'SectionA') initObtainedRows('SectionA');
    else if (selectedSheet === 'SectionB') initObtainedRows('SectionB');
    else if (selectedSheet === 'LabActivity') initObtainedRows('LabActivity');
  }, [selectedSheet, attainmentData, selectedCourse, sheetNames]);

  // Helper to get dynamic CT field names based on ctTaken
  const getActiveCTFields = () => {
    const ctTaken = ctSummary.ctTaken || 3;
    const allFields = ['CT1_Q1','CT1_Q2','CT1_Q3','CT2_Q1','CT2_Q2','CT2_Q3','CT3_Q1','CT3_Q2','CT3_Q3'];
    return allFields.slice(0, ctTaken * 3);
  };

  // Helper to get CT keys based on ctTaken
  const getActiveCTs = () => {
    const ctTaken = ctSummary.ctTaken || 3;
    return ['CT1', 'CT2', 'CT3'].slice(0, ctTaken);
  };

  // Autosave function with debounce
  const triggerAutosave = useCallback(() => {
    if (!selectedCourse || !selectedCourse._id || selectedSheet !== 'CT') {
      console.log('[Autosave] Skipping - no course or not CT sheet');
      return;
    }

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set saving status
    setSaveStatus('saving');

    // Debounce save by 1.5 seconds
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const dataToSave = {
          ctRows,
          ctFactors,
          ctManualWts,
          ctEqWts,
          ctSummary,
          ctObtainedRows
        };

        console.log('[Autosave] Saving data for course:', selectedCourse._id);
        const response = await saveCTData(selectedCourse._id, dataToSave);
        console.log('[Autosave] Save response:', response);
        
        setSaveStatus('saved');
        
        // Clear saved status after 2 seconds
        setTimeout(() => setSaveStatus(''), 2000);
      } catch (error) {
        console.error('[Autosave] Error:', error);
        setSaveStatus('error');
        setTimeout(() => setSaveStatus(''), 3000);
      }
    }, 1500);
  }, [selectedCourse, selectedSheet, ctRows, ctFactors, ctManualWts, ctEqWts, ctSummary, ctObtainedRows]);

  // Load saved CT data when course and CT sheet selected
  useEffect(() => {
    const loadCTData = async () => {
      if (selectedCourse && selectedCourse._id && selectedSheet === 'CT') {
        try {
          const response = await getCTData(selectedCourse._id);
          if (response.success && response.data) {
            const { ctRows: savedRows, ctFactors: savedFactors, ctManualWts: savedManual, 
                    ctEqWts: savedEq, ctSummary: savedSummary, ctObtainedRows: savedObtained } = response.data;
            
            if (savedRows) setCtRows(savedRows);
            if (savedFactors) setCtFactors(savedFactors);
            if (savedManual) setCtManualWts(savedManual);
            if (savedEq) setCtEqWts(savedEq);
            if (savedSummary) setCtSummary(savedSummary);
            if (savedObtained) setCtObtainedRows(savedObtained);
          }
        } catch (error) {
          console.log('No saved CT data found or error loading:', error);
        }
      }
    };
    loadCTData();
  }, [selectedCourse, selectedSheet]);

  const handleCTCellChange = (index, field, value) => {
    const num = Number(value);
    const updated = [...ctRows];
    updated[index] = { ...updated[index], [field]: isNaN(num) ? 0 : num };
    setCtRows(updated);
    triggerAutosave();
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
    triggerAutosave();
  };

  const computeAssignmentCOTotal = (row) => {
    return (
      (row.attendance || 0) +
      (row.Assgn1_Q1 || 0) + (row.Assgn1_Q2 || 0) + (row.Assgn1_Q3 || 0) +
      (row.Assgn2_Q1 || 0) + (row.Assgn2_Q2 || 0) + (row.Assgn2_Q3 || 0) +
      (row.Assgn3_Q1 || 0) + (row.Assgn3_Q2 || 0) + (row.Assgn3_Q3 || 0)
    );
  };

  const assignmentColumnTotals = () => {
    const fields = ['attendance','Assgn1_Q1','Assgn1_Q2','Assgn1_Q3','Assgn2_Q1','Assgn2_Q2','Assgn2_Q3','Assgn3_Q1','Assgn3_Q2','Assgn3_Q3'];
    const totals = {};
    fields.forEach(f => totals[f] = 0);
    assignmentRows.forEach(r => fields.forEach(f => totals[f] += (r[f] || 0)));
    return totals;
  };

  const assignmentSums = () => {
    let assgn1 = 0, assgn2 = 0, assgn3 = 0;
    assignmentRows.forEach(r => {
      assgn1 += (r.Assgn1_Q1||0)+(r.Assgn1_Q2||0)+(r.Assgn1_Q3||0);
      assgn2 += (r.Assgn2_Q1||0)+(r.Assgn2_Q2||0)+(r.Assgn2_Q3||0);
      assgn3 += (r.Assgn3_Q1||0)+(r.Assgn3_Q2||0)+(r.Assgn3_Q3||0);
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

  const handleAssignmentFactorChange = (key, value) => {
    const num = Number(value);
    setAssignmentFactors(prev => ({ ...prev, [key]: isNaN(num) ? 0 : num }));
    triggerAutosave();
  };

  const handleAssignmentEqWtChange = (key, value) => {
    const num = Number(value);
    setAssignmentEqWts(prev => ({ ...prev, [key]: isNaN(num) ? 0 : num }));
    triggerAutosave();
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

  const sectionAColumnTotals = () => {
    const fields = ['Q1a','Q1b','Q1c','Q1d','Q2a','Q2b','Q2c','Q2d','Q3a','Q3b','Q3c','Q3d','Q4a','Q4b','Q4c','Q4d'];
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
    const fields = ['Q1a','Q1b','Q1c','Q1d','Q2a','Q2b','Q2c','Q2d','Q3a','Q3b','Q3c','Q3d','Q4a','Q4b','Q4c','Q4d'];
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
    return (
      (row.attn || 0) + (row.quiz || 0) + (row.viva || 0) +
      (row.Activity1_Q1 || 0) + (row.Activity1_Q2 || 0) + (row.Activity1_Q3 || 0) +
      (row.Activity2_Q1 || 0) + (row.Activity2_Q2 || 0) + (row.Activity2_Q3 || 0) +
      (row.Activity3_Q1 || 0) + (row.Activity3_Q2 || 0) + (row.Activity3_Q3 || 0) +
      (row.Activity4_Q1 || 0) + (row.Activity4_Q2 || 0) + (row.Activity4_Q3 || 0) +
      (row.Activity5_Q1 || 0) + (row.Activity5_Q2 || 0) + (row.Activity5_Q3 || 0)
    );
  };

  const labActivityColumnTotals = () => {
    const fields = [
      'Activity1_Q1','Activity1_Q2','Activity1_Q3',
      'Activity2_Q1','Activity2_Q2','Activity2_Q3',
      'Activity3_Q1','Activity3_Q2','Activity3_Q3',
      'Activity4_Q1','Activity4_Q2','Activity4_Q3',
      'Activity5_Q1','Activity5_Q2','Activity5_Q3'
    ];
    const totals = {};
    fields.forEach(f => totals[f] = 0);
    labActivityRows.forEach(r => fields.forEach(f => totals[f] += (r[f] || 0)));
    return totals;
  };

  const labActivityActivityTotals = () => {
    const totals = labActivityColumnTotals();
    const activity1 = (totals.Activity1_Q1 || 0) + (totals.Activity1_Q2 || 0) + (totals.Activity1_Q3 || 0);
    const activity2 = (totals.Activity2_Q1 || 0) + (totals.Activity2_Q2 || 0) + (totals.Activity2_Q3 || 0);
    const activity3 = (totals.Activity3_Q1 || 0) + (totals.Activity3_Q2 || 0) + (totals.Activity3_Q3 || 0);
    const activity4 = (totals.Activity4_Q1 || 0) + (totals.Activity4_Q2 || 0) + (totals.Activity4_Q3 || 0);
    const activity5 = (totals.Activity5_Q1 || 0) + (totals.Activity5_Q2 || 0) + (totals.Activity5_Q3 || 0);
    return { activity1, activity2, activity3, activity4, activity5 };
  };

  const computeSectionBObtainedTotal = (row) => {
    return (
      (row.Q1a || 0) + (row.Q1b || 0) + (row.Q1c || 0) + (row.Q1d || 0) +
      (row.Q2a || 0) + (row.Q2b || 0) + (row.Q2c || 0) + (row.Q2d || 0) +
      (row.Q3a || 0) + (row.Q3b || 0) + (row.Q3c || 0) + (row.Q3d || 0) +
      (row.Q4a || 0) + (row.Q4b || 0) + (row.Q4c || 0) + (row.Q4d || 0)
    );
  };

  const columnTotals = () => {
    const fields = ['CT1_Q1','CT1_Q2','CT1_Q3','CT2_Q1','CT2_Q2','CT2_Q3','CT3_Q1','CT3_Q2','CT3_Q3'];
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
      ct1 += (r.CT1_Q1||0)+(r.CT1_Q2||0)+(r.CT1_Q3||0);
      ct2 += (r.CT2_Q1||0)+(r.CT2_Q2||0)+(r.CT2_Q3||0);
      ct3 += (r.CT3_Q1||0)+(r.CT3_Q2||0)+(r.CT3_Q3||0);
    });
    return { ct1, ct2, ct3 };
  };

  const handleFactorChange = (ctKey, value) => {
    const num = Number(value);
    setCtFactors(prev => ({ ...prev, [ctKey]: isNaN(num) ? 0 : num }));
    triggerAutosave();
  };

  const handleManualWtChange = (ctKey, value) => {
    const num = Number(value);
    setCtManualWts(prev => ({ ...prev, [ctKey]: isNaN(num) ? 0 : num }));
    triggerAutosave();
  };

  const handleEqWtChange = (ctKey, value) => {
    const num = Number(value);
    setCtEqWts(prev => ({ ...prev, [ctKey]: isNaN(num) ? 0 : num }));
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
    triggerAutosave();
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
        'CourseProfile', 'CT', 'Attn_Assign', 'SectionA', 'SectionB', 'COAttainment', 'COCalc', 'COPOMap', 'POCalcMax', 'Charts', 'POCalc', 'CheckPO'
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
      setTeacherCourses(response.courses || []);
      
      // Auto-select first sheet
      if (response.sheets && response.sheets.length > 0) {
        setSelectedSheet(response.sheets[0]);
      } else if (response.courses && response.courses.length > 0) {
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

  const handleCellEdit = (rollNumber, poNumber, currentValue) => {
    // Only allow editing for teachers and admins
    if (userRole !== 'teacher' && userRole !== 'admin') {
      return;
    }

    setEditingCell({ rollNumber, poNumber, value: currentValue });
  };

  const handleCellSave = async () => {
    if (!editingCell) return;

    try {
      setSaving(true);
      await updateStudentPoValue(
        selectedSheet,
        editingCell.rollNumber,
        editingCell.poNumber,
        editingCell.value
      );

      // Reload data to get updated summary
      await loadAttainmentData(selectedSheet);
      setEditingCell(null);
    } catch (err) {
      alert(err.error || 'Failed to save value');
    } finally {
      setSaving(false);
    }
  };

  const handleCellCancel = () => {
    setEditingCell(null);
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
      alert(err.error || 'Failed to save');
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

  const handleCellChange = (e) => {
    setEditingCell({ ...editingCell, value: e.target.value });
  };

  const canEdit = userRole === 'teacher' || userRole === 'admin';

  // Refresh teacher courses (force reload from backend)
  const refreshTeacherCourses = async () => {
    try {
      const data = await getAllCourses();
      const courseList = Array.isArray(data) ? data : (data.courses || []);
      // Only update if we get a valid course list
      if (courseList && courseList.length > 0) {
        setTeacherCourses(courseList);
        // If a course is already selected, update it with the latest info
        if (selectedCourse) {
          const updated = courseList.find(c => c._id === selectedCourse._id);
          if (updated) setSelectedCourse(updated);
        }
      }
    } catch (err) {
      console.error('refreshTeacherCourses error:', err);
      // Don't clear existing courses on error, just log it
      console.warn('Keeping existing course list due to refresh error');
    }
  };

  // Auto-refresh courses when AttainmentView mounts and when sheet changes to Attn_Assign
  useEffect(() => {
    if (selectedSheet === 'Attn_Assign') {
      refreshTeacherCourses();
    }
  }, [selectedSheet]);

  if (loading && !attainmentData) {
    return <div className="attainment-loading">Loading...</div>;
  }

  return (
    <div className="attainment-container">
      <h1>Course Outcome Attainment</h1>

      {error && (
        <div className="attainment-error" style={{marginBottom: '20px'}}>
          Error: {error}
        </div>
      )}

      {/* Course Selector - First Step - Always shown for teachers */}
      {userRole === 'teacher' && (
        <div className="course-selector" style={{marginBottom: '20px'}}>
          <label htmlFor="course-select" style={{display: 'block', marginBottom: '8px', fontWeight: '600'}}>
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
            style={{width: '100%', padding: '10px', fontSize: '14px', borderRadius: '4px', border: '1px solid #ddd'}}
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

      {/* Save Status Indicator */}
      {selectedSheet === 'CT' && saveStatus && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          padding: '10px 20px',
          borderRadius: '4px',
          backgroundColor: saveStatus === 'saved' ? '#d4edda' : saveStatus === 'saving' ? '#fff3cd' : '#f8d7da',
          color: saveStatus === 'saved' ? '#155724' : saveStatus === 'saving' ? '#856404' : '#721c24',
          border: `1px solid ${saveStatus === 'saved' ? '#c3e6cb' : saveStatus === 'saving' ? '#ffeeba' : '#f5c6cb'}`,
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          zIndex: 1000
        }}>
          {saveStatus === 'saving' && '💾 Saving...'}
          {saveStatus === 'saved' && '✓ Saved'}
          {saveStatus === 'error' && '✗ Error saving'}
        </div>
      )}

      {/* Evaluation Selector - Second Step (shown only after course selection) */}
      {selectedCourse && (
        <>
          {/* Show message when no sheets found */}
          {filteredSheets.length === 0 && !loading && (
            <div className="attainment-empty" style={{textAlign: 'center', padding: '20px', backgroundColor: '#fff3cd', borderRadius: '4px', marginTop: '10px', marginBottom: '20px'}}>
              <p style={{margin: 0}}>No evaluation sheets found for {selectedCourse.courseCode}.</p>
            </div>
          )}

          {filteredSheets.length > 0 && (
            <div className="sheet-selector" style={{marginBottom: '20px'}}>
              <label htmlFor="sheet-select" style={{display: 'block', marginBottom: '8px', fontWeight: '600'}}>
                Evaluations:
              </label>
              <select
                id="sheet-select"
                value={selectedSheet || ''}
                onChange={(e) => setSelectedSheet(e.target.value)}
                style={{width: '100%', padding: '10px', fontSize: '14px', borderRadius: '4px', border: '1px solid #ddd'}}
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
            <section className="course-profile-section" style={{marginTop: '30px'}}>
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
            <section className="ct-section" style={{marginTop: '30px'}}>
              <h2>CO mapping of Class Test Marks</h2>
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
                              style={{width:'80px'}}
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
                      {(() => { const ctTotals = ctColumnTotals(); return (
                        <>
                          {getActiveCTs().map(ct => (
                            <td key={ct} colSpan={3} style={{textAlign: 'center', fontWeight: 'bold'}}>
                              {ctTotals[ct] || 0}
                            </td>
                          ))}
                        </>
                      ); })()}
                      <td>{ctRows.reduce((sum, r) => sum + computeCOTotal(r), 0)}</td>
                    </tr>
                    <tr>
                      <td className="footer-label">Factor</td>
                      {getActiveCTs().map(ct => {
                        const autoFactor = calculateAutoFactor();
                        return (
                          <td key={ct} colSpan={3} style={{textAlign: 'center'}}>
                            {(autoFactor[ct] || 0).toFixed(4)}
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
                          <td key={ct} colSpan={3} style={{textAlign: 'center'}}>
                            {(autoEqWt[ct] || 0).toFixed(2)}
                          </td>
                        );
                      })}
                      <td><strong>{sumEqWtTotal().toFixed(2)}</strong></td>
                    </tr>
                    <tr>
                      <td className="footer-label">Manual Wt</td>
                      {getActiveCTs().map(ct => (
                        <td key={ct} colSpan={3}>
                          <input
                            type="number"
                            step="0.01"
                            value={ctManualWts[ct] ?? 0}
                            onChange={(e)=>handleManualWtChange(ct, e.target.value)}
                            style={{width:'80px'}}
                          />
                        </td>
                      ))}
                      <td><strong>{sumManualWtTotal().toFixed(2)}</strong></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              {/* CT summary table */}
              <div className="table-wrapper" style={{marginTop: '20px'}}>
                <table className="ct-table">
                  <tbody>
                    <tr>
                      <td>CTs Taken</td>
                      <td><input type="number" min={0} max={3} style={{width:'80px'}} value={ctSummary.ctTaken} onChange={e=>setCtSummary(prev=>({...prev, ctTaken: Math.max(0, Math.min(3, Number(e.target.value)||0))}))} /></td>
                    </tr>
                    <tr>
                      <td>CT Marks out of 60</td>
                      <td><input type="number" min={0} max={60} style={{width:'80px'}} value={ctSummary.coMappedMarks60} onChange={e=>setCtSummary(prev=>({...prev, coMappedMarks60: Math.max(0, Math.min(60, Number(e.target.value)||0))}))} /></td>
                    </tr>
                    <tr>
                      <td>Use Eq. Wt</td>
                      <td><input type="number" step="0.01" style={{width:'80px'}} value={ctSummary.useEqWt} onChange={e=>setCtSummary(prev=>({...prev, useEqWt: Number(e.target.value)||0}))} /></td>
                    </tr>
                  </tbody>
                </table>
              </div>


              {/* Obtained Marks for Class Tests */}
              {(() => { const g = ctGroupTotals(); const ctTaken = ctSummary.ctTaken || 3; return (
              <section style={{marginTop:'20px'}}>
                <h3>Obtained Marks for Class Tests</h3>
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
                        <tr key={row.rollNumber || idx}>
                          <td className="roll-cell" title={row.name || row.rollNumber}>{row.rollNumber || '-'}</td>
                          {getActiveCTFields().map(field => (
                            <td key={`obt_${field}_${idx}`}>
                              <input
                                type="number"
                                min="0"
                                value={row[field]}
                                onChange={(e) => handleObtainedCellChange(idx, field, e.target.value)}
                                style={{width:'80px'}}
                              />
                            </td>
                          ))}
                          <td className="row-total">{computeObtainedTotal(row)}</td>
                        </tr>
                      ))}
                      {ctObtainedRows.length === 0 && (
                        <tr><td colSpan={ctTaken * 3 + 2} style={{textAlign:'center', color:'#7f8c8d'}}>No students found for this sheet.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
              ); })()}
              
            </section>
          )}

          {/* Section A Section */}
          {selectedSheet === 'SectionA' && (
            <section className="section-a-section" style={{marginTop: '30px'}}>
              <h2>Allocated marks for Section-A in final question</h2>
              {clos.length === 0 && (
                <p style={{padding: '20px', color: '#7f8c8d'}}>Loading course outcomes...</p>
              )}
              {clos.length > 0 && (
              <>
              <div className="table-wrapper">
                <table className="section-a-table">
                  <thead>
                    <tr>
                      <th rowSpan="2">CO No.</th>
                      <th colSpan="4">1</th>
                      <th style={{borderLeft: '2px solid #d5d5d5'}} colSpan="4">2</th>
                      <th style={{borderLeft: '2px solid #d5d5d5'}} colSpan="4">3</th>
                      <th style={{borderLeft: '2px solid #d5d5d5'}} colSpan="4">4</th>
                      <th rowSpan="2">CO Total</th>
                    </tr>
                    <tr>
                      <th>1(a)</th><th>1(b)</th><th>1(c)</th><th>1(d)</th>
                      <th style={{borderLeft: '2px solid #d5d5d5'}}>2(a)</th><th>2(b)</th><th>2(c)</th><th>2(d)</th>
                      <th style={{borderLeft: '2px solid #d5d5d5'}}>3(a)</th><th>3(b)</th><th>3(c)</th><th>3(d)</th>
                      <th style={{borderLeft: '2px solid #d5d5d5'}}>4(a)</th><th>4(b)</th><th>4(c)</th><th>4(d)</th>
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
                            style={{width:'80px'}}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            value={row.Q1b}
                            onChange={(e) => handleSectionACellChange(idx, 'Q1b', e.target.value)}
                            style={{width:'80px'}}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            value={row.Q1c}
                            onChange={(e) => handleSectionACellChange(idx, 'Q1c', e.target.value)}
                            style={{width:'80px'}}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            value={row.Q1d}
                            onChange={(e) => handleSectionACellChange(idx, 'Q1d', e.target.value)}
                            style={{width:'80px'}}
                          />
                        </td>
                        <td style={{borderLeft: '2px solid #d5d5d5'}}>
                          <input
                            type="number"
                            min="0"
                            value={row.Q2a}
                            onChange={(e) => handleSectionACellChange(idx, 'Q2a', e.target.value)}
                            style={{width:'80px'}}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            value={row.Q2b}
                            onChange={(e) => handleSectionACellChange(idx, 'Q2b', e.target.value)}
                            style={{width:'80px'}}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            value={row.Q2c}
                            onChange={(e) => handleSectionACellChange(idx, 'Q2c', e.target.value)}
                            style={{width:'80px'}}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            value={row.Q2d}
                            onChange={(e) => handleSectionACellChange(idx, 'Q2d', e.target.value)}
                            style={{width:'80px'}}
                          />
                        </td>
                        <td style={{borderLeft: '2px solid #d5d5d5'}}>
                          <input
                            type="number"
                            min="0"
                            value={row.Q3a}
                            onChange={(e) => handleSectionACellChange(idx, 'Q3a', e.target.value)}
                            style={{width:'80px'}}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            value={row.Q3b}
                            onChange={(e) => handleSectionACellChange(idx, 'Q3b', e.target.value)}
                            style={{width:'80px'}}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            value={row.Q3c}
                            onChange={(e) => handleSectionACellChange(idx, 'Q3c', e.target.value)}
                            style={{width:'80px'}}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            value={row.Q3d}
                            onChange={(e) => handleSectionACellChange(idx, 'Q3d', e.target.value)}
                            style={{width:'80px'}}
                          />
                        </td>
                        <td style={{borderLeft: '2px solid #d5d5d5'}}>
                          <input
                            type="number"
                            min="0"
                            value={row.Q4a}
                            onChange={(e) => handleSectionACellChange(idx, 'Q4a', e.target.value)}
                            style={{width:'80px'}}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            value={row.Q4b}
                            onChange={(e) => handleSectionACellChange(idx, 'Q4b', e.target.value)}
                            style={{width:'80px'}}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            value={row.Q4c}
                            onChange={(e) => handleSectionACellChange(idx, 'Q4c', e.target.value)}
                            style={{width:'80px'}}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            value={row.Q4d}
                            onChange={(e) => handleSectionACellChange(idx, 'Q4d', e.target.value)}
                            style={{width:'80px'}}
                          />
                        </td>
                        <td className="co-total">{computeSectionACOTotal(row)}</td>
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
                            <td colSpan="4" style={{textAlign: 'center', fontWeight: 'bold'}}>{questionTotals.q1}</td>
                            <td colSpan="4" style={{borderLeft: '2px solid #d5d5d5', textAlign: 'center', fontWeight: 'bold'}}>{questionTotals.q2}</td>
                            <td colSpan="4" style={{borderLeft: '2px solid #d5d5d5', textAlign: 'center', fontWeight: 'bold'}}>{questionTotals.q3}</td>
                            <td colSpan="4" style={{borderLeft: '2px solid #d5d5d5', textAlign: 'center', fontWeight: 'bold'}}>{questionTotals.q4}</td>
                          </>
                        );
                      })()}
                      <td>{sectionARows.reduce((sum, r) => sum + computeSectionACOTotal(r), 0)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              
              {/* Obtained Marks for Section-A */}
              <section style={{marginTop:'30px'}}>
                <h3>Obtained marks for Section-A</h3>
                <div className="table-wrapper">
                  <table className="section-a-table">
                    <thead>
                      <tr>
                        <th rowSpan="2">Roll</th>
                        <th colSpan="4">1</th>
                        <th style={{borderLeft: '2px solid #d5d5d5'}} colSpan="4">2</th>
                        <th style={{borderLeft: '2px solid #d5d5d5'}} colSpan="4">3</th>
                        <th style={{borderLeft: '2px solid #d5d5d5'}} colSpan="4">4</th>
                        <th rowSpan="2">Total</th>
                      </tr>
                      <tr>
                        <th>1(a)</th><th>1(b)</th><th>1(c)</th><th>1(d)</th>
                        <th style={{borderLeft: '2px solid #d5d5d5'}}>2(a)</th><th>2(b)</th><th>2(c)</th><th>2(d)</th>
                        <th style={{borderLeft: '2px solid #d5d5d5'}}>3(a)</th><th>3(b)</th><th>3(c)</th><th>3(d)</th>
                        <th style={{borderLeft: '2px solid #d5d5d5'}}>4(a)</th><th>4(b)</th><th>4(c)</th><th>4(d)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sectionAObtainedRows.length > 0 ? sectionAObtainedRows.map((row, idx) => (
                        <tr key={row.rollNumber || idx}>
                          <td className="roll-cell" title={row.name || row.rollNumber}>{row.rollNumber || '-'}</td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              value={row.Q1a}
                              onChange={(e) => handleSectionAObtainedCellChange(idx, 'Q1a', e.target.value)}
                              style={{width:'70px'}}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              value={row.Q1b}
                              onChange={(e) => handleSectionAObtainedCellChange(idx, 'Q1b', e.target.value)}
                              style={{width:'70px'}}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              value={row.Q1c}
                              onChange={(e) => handleSectionAObtainedCellChange(idx, 'Q1c', e.target.value)}
                              style={{width:'70px'}}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              value={row.Q1d}
                              onChange={(e) => handleSectionAObtainedCellChange(idx, 'Q1d', e.target.value)}
                              style={{width:'70px'}}
                            />
                          </td>
                          <td style={{borderLeft: '2px solid #d5d5d5'}}>
                            <input
                              type="number"
                              min="0"
                              value={row.Q2a}
                              onChange={(e) => handleSectionAObtainedCellChange(idx, 'Q2a', e.target.value)}
                              style={{width:'70px'}}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              value={row.Q2b}
                              onChange={(e) => handleSectionAObtainedCellChange(idx, 'Q2b', e.target.value)}
                              style={{width:'70px'}}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              value={row.Q2c}
                              onChange={(e) => handleSectionAObtainedCellChange(idx, 'Q2c', e.target.value)}
                              style={{width:'70px'}}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              value={row.Q2d}
                              onChange={(e) => handleSectionAObtainedCellChange(idx, 'Q2d', e.target.value)}
                              style={{width:'70px'}}
                            />
                          </td>
                          <td style={{borderLeft: '2px solid #d5d5d5'}}>
                            <input
                              type="number"
                              min="0"
                              value={row.Q3a}
                              onChange={(e) => handleSectionAObtainedCellChange(idx, 'Q3a', e.target.value)}
                              style={{width:'70px'}}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              value={row.Q3b}
                              onChange={(e) => handleSectionAObtainedCellChange(idx, 'Q3b', e.target.value)}
                              style={{width:'70px'}}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              value={row.Q3c}
                              onChange={(e) => handleSectionAObtainedCellChange(idx, 'Q3c', e.target.value)}
                              style={{width:'70px'}}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              value={row.Q3d}
                              onChange={(e) => handleSectionAObtainedCellChange(idx, 'Q3d', e.target.value)}
                              style={{width:'70px'}}
                            />
                          </td>
                          <td style={{borderLeft: '2px solid #d5d5d5'}}>
                            <input
                              type="number"
                              min="0"
                              value={row.Q4a}
                              onChange={(e) => handleSectionAObtainedCellChange(idx, 'Q4a', e.target.value)}
                              style={{width:'70px'}}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              value={row.Q4b}
                              onChange={(e) => handleSectionAObtainedCellChange(idx, 'Q4b', e.target.value)}
                              style={{width:'70px'}}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              value={row.Q4c}
                              onChange={(e) => handleSectionAObtainedCellChange(idx, 'Q4c', e.target.value)}
                              style={{width:'70px'}}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              value={row.Q4d}
                              onChange={(e) => handleSectionAObtainedCellChange(idx, 'Q4d', e.target.value)}
                              style={{width:'70px'}}
                            />
                          </td>
                          <td className="co-total">{computeSectionAObtainedTotal(row)}</td>
                        </tr>
                      )) : (
                        <tr><td colSpan={18} style={{textAlign:'center', color:'#7f8c8d'}}>No students found for this course.</td></tr>
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
            <section className="section-b-section" style={{marginTop: '30px'}}>
              <h2>Allocated marks for Section-B in final question</h2>
              {clos.length === 0 && (
                <p style={{padding: '20px', color: '#7f8c8d'}}>Loading course outcomes...</p>
              )}
              {clos.length > 0 && (
              <>
              <div className="table-wrapper">
                <table className="section-a-table">
                  <thead>
                    <tr>
                      <th rowSpan="2">CO No.</th>
                      <th colSpan="4">1</th>
                      <th style={{borderLeft: '2px solid #d5d5d5'}} colSpan="4">2</th>
                      <th style={{borderLeft: '2px solid #d5d5d5'}} colSpan="4">3</th>
                      <th style={{borderLeft: '2px solid #d5d5d5'}} colSpan="4">4</th>
                      <th rowSpan="2">CO Total</th>
                    </tr>
                    <tr>
                      <th>1(a)</th><th>1(b)</th><th>1(c)</th><th>1(d)</th>
                      <th style={{borderLeft: '2px solid #d5d5d5'}}>2(a)</th><th>2(b)</th><th>2(c)</th><th>2(d)</th>
                      <th style={{borderLeft: '2px solid #d5d5d5'}}>3(a)</th><th>3(b)</th><th>3(c)</th><th>3(d)</th>
                      <th style={{borderLeft: '2px solid #d5d5d5'}}>4(a)</th><th>4(b)</th><th>4(c)</th><th>4(d)</th>
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
                            style={{width:'80px'}}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            value={row.Q1b}
                            onChange={(e) => handleSectionBCellChange(idx, 'Q1b', e.target.value)}
                            style={{width:'80px'}}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            value={row.Q1c}
                            onChange={(e) => handleSectionBCellChange(idx, 'Q1c', e.target.value)}
                            style={{width:'80px'}}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            value={row.Q1d}
                            onChange={(e) => handleSectionBCellChange(idx, 'Q1d', e.target.value)}
                            style={{width:'80px'}}
                          />
                        </td>
                        <td style={{borderLeft: '2px solid #d5d5d5'}}>
                          <input
                            type="number"
                            min="0"
                            value={row.Q2a}
                            onChange={(e) => handleSectionBCellChange(idx, 'Q2a', e.target.value)}
                            style={{width:'80px'}}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            value={row.Q2b}
                            onChange={(e) => handleSectionBCellChange(idx, 'Q2b', e.target.value)}
                            style={{width:'80px'}}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            value={row.Q2c}
                            onChange={(e) => handleSectionBCellChange(idx, 'Q2c', e.target.value)}
                            style={{width:'80px'}}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            value={row.Q2d}
                            onChange={(e) => handleSectionBCellChange(idx, 'Q2d', e.target.value)}
                            style={{width:'80px'}}
                          />
                        </td>
                        <td style={{borderLeft: '2px solid #d5d5d5'}}>
                          <input
                            type="number"
                            min="0"
                            value={row.Q3a}
                            onChange={(e) => handleSectionBCellChange(idx, 'Q3a', e.target.value)}
                            style={{width:'80px'}}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            value={row.Q3b}
                            onChange={(e) => handleSectionBCellChange(idx, 'Q3b', e.target.value)}
                            style={{width:'80px'}}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            value={row.Q3c}
                            onChange={(e) => handleSectionBCellChange(idx, 'Q3c', e.target.value)}
                            style={{width:'80px'}}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            value={row.Q3d}
                            onChange={(e) => handleSectionBCellChange(idx, 'Q3d', e.target.value)}
                            style={{width:'80px'}}
                          />
                        </td>
                        <td style={{borderLeft: '2px solid #d5d5d5'}}>
                          <input
                            type="number"
                            min="0"
                            value={row.Q4a}
                            onChange={(e) => handleSectionBCellChange(idx, 'Q4a', e.target.value)}
                            style={{width:'80px'}}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            value={row.Q4b}
                            onChange={(e) => handleSectionBCellChange(idx, 'Q4b', e.target.value)}
                            style={{width:'80px'}}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            value={row.Q4c}
                            onChange={(e) => handleSectionBCellChange(idx, 'Q4c', e.target.value)}
                            style={{width:'80px'}}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            value={row.Q4d}
                            onChange={(e) => handleSectionBCellChange(idx, 'Q4d', e.target.value)}
                            style={{width:'80px'}}
                          />
                        </td>
                        <td className="co-total">{computeSectionBCOTotal(row)}</td>
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
                            <td colSpan="4" style={{textAlign: 'center', fontWeight: 'bold'}}>{questionTotals.q1}</td>
                            <td colSpan="4" style={{borderLeft: '2px solid #d5d5d5', textAlign: 'center', fontWeight: 'bold'}}>{questionTotals.q2}</td>
                            <td colSpan="4" style={{borderLeft: '2px solid #d5d5d5', textAlign: 'center', fontWeight: 'bold'}}>{questionTotals.q3}</td>
                            <td colSpan="4" style={{borderLeft: '2px solid #d5d5d5', textAlign: 'center', fontWeight: 'bold'}}>{questionTotals.q4}</td>
                          </>
                        );
                      })()} 
                      <td>{sectionBRows.reduce((sum, r) => sum + computeSectionBCOTotal(r), 0)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              
              {/* Obtained Marks for Section-B */}
              <section style={{marginTop:'30px'}}>
                <h3>Obtained marks for Section-B</h3>
                <div className="table-wrapper">
                  <table className="section-a-table">
                    <thead>
                      <tr>
                        <th rowSpan="2">Roll</th>
                        <th colSpan="4">1</th>
                        <th style={{borderLeft: '2px solid #d5d5d5'}} colSpan="4">2</th>
                        <th style={{borderLeft: '2px solid #d5d5d5'}} colSpan="4">3</th>
                        <th style={{borderLeft: '2px solid #d5d5d5'}} colSpan="4">4</th>
                        <th rowSpan="2">Total</th>
                      </tr>
                      <tr>
                        <th>1(a)</th><th>1(b)</th><th>1(c)</th><th>1(d)</th>
                        <th style={{borderLeft: '2px solid #d5d5d5'}}>2(a)</th><th>2(b)</th><th>2(c)</th><th>2(d)</th>
                        <th style={{borderLeft: '2px solid #d5d5d5'}}>3(a)</th><th>3(b)</th><th>3(c)</th><th>3(d)</th>
                        <th style={{borderLeft: '2px solid #d5d5d5'}}>4(a)</th><th>4(b)</th><th>4(c)</th><th>4(d)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sectionBObtainedRows.length > 0 ? sectionBObtainedRows.map((row, idx) => (
                        <tr key={row.rollNumber || idx}>
                          <td className="roll-cell" title={row.name || row.rollNumber}>{row.rollNumber || '-'}</td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              value={row.Q1a}
                              onChange={(e) => handleSectionBObtainedCellChange(idx, 'Q1a', e.target.value)}
                              style={{width:'70px'}}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              value={row.Q1b}
                              onChange={(e) => handleSectionBObtainedCellChange(idx, 'Q1b', e.target.value)}
                              style={{width:'70px'}}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              value={row.Q1c}
                              onChange={(e) => handleSectionBObtainedCellChange(idx, 'Q1c', e.target.value)}
                              style={{width:'70px'}}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              value={row.Q1d}
                              onChange={(e) => handleSectionBObtainedCellChange(idx, 'Q1d', e.target.value)}
                              style={{width:'70px'}}
                            />
                          </td>
                          <td style={{borderLeft: '2px solid #d5d5d5'}}>
                            <input
                              type="number"
                              min="0"
                              value={row.Q2a}
                              onChange={(e) => handleSectionBObtainedCellChange(idx, 'Q2a', e.target.value)}
                              style={{width:'70px'}}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              value={row.Q2b}
                              onChange={(e) => handleSectionBObtainedCellChange(idx, 'Q2b', e.target.value)}
                              style={{width:'70px'}}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              value={row.Q2c}
                              onChange={(e) => handleSectionBObtainedCellChange(idx, 'Q2c', e.target.value)}
                              style={{width:'70px'}}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              value={row.Q2d}
                              onChange={(e) => handleSectionBObtainedCellChange(idx, 'Q2d', e.target.value)}
                              style={{width:'70px'}}
                            />
                          </td>
                          <td style={{borderLeft: '2px solid #d5d5d5'}}>
                            <input
                              type="number"
                              min="0"
                              value={row.Q3a}
                              onChange={(e) => handleSectionBObtainedCellChange(idx, 'Q3a', e.target.value)}
                              style={{width:'70px'}}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              value={row.Q3b}
                              onChange={(e) => handleSectionBObtainedCellChange(idx, 'Q3b', e.target.value)}
                              style={{width:'70px'}}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              value={row.Q3c}
                              onChange={(e) => handleSectionBObtainedCellChange(idx, 'Q3c', e.target.value)}
                              style={{width:'70px'}}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              value={row.Q3d}
                              onChange={(e) => handleSectionBObtainedCellChange(idx, 'Q3d', e.target.value)}
                              style={{width:'70px'}}
                            />
                          </td>
                          <td style={{borderLeft: '2px solid #d5d5d5'}}>
                            <input
                              type="number"
                              min="0"
                              value={row.Q4a}
                              onChange={(e) => handleSectionBObtainedCellChange(idx, 'Q4a', e.target.value)}
                              style={{width:'70px'}}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              value={row.Q4b}
                              onChange={(e) => handleSectionBObtainedCellChange(idx, 'Q4b', e.target.value)}
                              style={{width:'70px'}}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              value={row.Q4c}
                              onChange={(e) => handleSectionBObtainedCellChange(idx, 'Q4c', e.target.value)}
                              style={{width:'70px'}}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              value={row.Q4d}
                              onChange={(e) => handleSectionBObtainedCellChange(idx, 'Q4d', e.target.value)}
                              style={{width:'70px'}}
                            />
                          </td>
                          <td className="co-total">{computeSectionBObtainedTotal(row)}</td>
                        </tr>
                      )) : (
                        <tr><td colSpan={18} style={{textAlign:'center', color:'#7f8c8d'}}>No students found for this course.</td></tr>
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
            <section className="ct-section" style={{marginTop: '30px'}}>
              <h2>Allocated Marks for Lab activity</h2>
              {clos.length === 0 && (
                <p style={{padding: '20px', color: '#7f8c8d'}}>Loading course outcomes...</p>
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
                      <th colSpan="15">CO Mapping of Lab Activity Marks</th>
                      <th colSpan="1">Other</th>
                      <th rowSpan="3">CO Total</th>
                    </tr>
                    <tr>
                      <th colSpan="3">Activity1</th>
                      <th colSpan="3">Activity2</th>
                      <th colSpan="3">Activity3</th>
                      <th colSpan="3">Activity4</th>
                      <th colSpan="3">Activity5</th>
                      <th rowSpan="2">Measured Total</th>
                    </tr>
                    <tr>
                      <th>
                        <input
                          type="number"
                          min="0"
                          value={labAttendanceMarks}
                          onChange={(e) => setLabAttendanceMarks(Number(e.target.value))}
                          style={{width:'50px'}}
                        />
                      </th>
                      <th>
                        <input
                          type="number"
                          min="0"
                          value={labQuizMarks}
                          onChange={(e) => setLabQuizMarks(Number(e.target.value))}
                          style={{width:'50px'}}
                        />
                      </th>
                      <th>
                        <input
                          type="number"
                          min="0"
                          value={labVivaMarks}
                          onChange={(e) => setLabVivaMarks(Number(e.target.value))}
                          style={{width:'50px'}}
                        />
                      </th>
                      <th>Q1</th><th>Q2</th><th>Q3</th>
                      <th>Q1</th><th>Q2</th><th>Q3</th>
                      <th>Q1</th><th>Q2</th><th>Q3</th>
                      <th>Q1</th><th>Q2</th><th>Q3</th>
                      <th>Q1</th><th>Q2</th><th>Q3</th>
                    </tr>
                  </thead>
                  <tbody>
                    {labActivityRows.map((row, idx) => (
                      <tr key={idx}>
                        <td className="co-column">{row.coNumber}</td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            value={row.attn || 0}
                            onChange={(e) => handleLabActivityCellChange(idx, 'attn', e.target.value)}
                            style={{width:'60px'}}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            value={row.quiz || 0}
                            onChange={(e) => handleLabActivityCellChange(idx, 'quiz', e.target.value)}
                            style={{width:'60px'}}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            value={row.viva || 0}
                            onChange={(e) => handleLabActivityCellChange(idx, 'viva', e.target.value)}
                            style={{width:'60px'}}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            value={row.Activity1_Q1}
                            onChange={(e) => handleLabActivityCellChange(idx, 'Activity1_Q1', e.target.value)}
                            style={{width:'60px'}}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            value={row.Activity1_Q2}
                            onChange={(e) => handleLabActivityCellChange(idx, 'Activity1_Q2', e.target.value)}
                            style={{width:'60px'}}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            value={row.Activity1_Q3}
                            onChange={(e) => handleLabActivityCellChange(idx, 'Activity1_Q3', e.target.value)}
                            style={{width:'60px'}}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            value={row.Activity2_Q1}
                            onChange={(e) => handleLabActivityCellChange(idx, 'Activity2_Q1', e.target.value)}
                            style={{width:'60px'}}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            value={row.Activity2_Q2}
                            onChange={(e) => handleLabActivityCellChange(idx, 'Activity2_Q2', e.target.value)}
                            style={{width:'60px'}}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            value={row.Activity2_Q3}
                            onChange={(e) => handleLabActivityCellChange(idx, 'Activity2_Q3', e.target.value)}
                            style={{width:'60px'}}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            value={row.Activity3_Q1}
                            onChange={(e) => handleLabActivityCellChange(idx, 'Activity3_Q1', e.target.value)}
                            style={{width:'60px'}}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            value={row.Activity3_Q2}
                            onChange={(e) => handleLabActivityCellChange(idx, 'Activity3_Q2', e.target.value)}
                            style={{width:'60px'}}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            value={row.Activity3_Q3}
                            onChange={(e) => handleLabActivityCellChange(idx, 'Activity3_Q3', e.target.value)}
                            style={{width:'60px'}}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            value={row.Activity4_Q1}
                            onChange={(e) => handleLabActivityCellChange(idx, 'Activity4_Q1', e.target.value)}
                            style={{width:'60px'}}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            value={row.Activity4_Q2}
                            onChange={(e) => handleLabActivityCellChange(idx, 'Activity4_Q2', e.target.value)}
                            style={{width:'60px'}}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            value={row.Activity4_Q3}
                            onChange={(e) => handleLabActivityCellChange(idx, 'Activity4_Q3', e.target.value)}
                            style={{width:'60px'}}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            value={row.Activity5_Q1}
                            onChange={(e) => handleLabActivityCellChange(idx, 'Activity5_Q1', e.target.value)}
                            style={{width:'60px'}}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            value={row.Activity5_Q2}
                            onChange={(e) => handleLabActivityCellChange(idx, 'Activity5_Q2', e.target.value)}
                            style={{width:'60px'}}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            value={row.Activity5_Q3}
                            onChange={(e) => handleLabActivityCellChange(idx, 'Activity5_Q3', e.target.value)}
                            style={{width:'60px'}}
                          />
                        </td>
                        <td>{computeLabActivityCOTotal(row)}</td>
                        <td className="co-total">{computeLabActivityCOTotal(row)}</td>
                      </tr>
                    ))}
                    
                    {/* Total Factor Row */}
                    <tr className="factor-row">
                      <td colSpan="4"><strong>Total</strong></td>
                      <td colSpan="3">
                        <input
                          type="number"
                          min="0"
                          value={labActivityFactors.activity1 || 0}
                          onChange={(e) => handleLabActivityFactorChange('activity1', e.target.value)}
                          style={{width:'80px'}}
                        />
                      </td>
                      <td colSpan="3">
                        <input
                          type="number"
                          min="0"
                          value={labActivityFactors.activity2 || 0}
                          onChange={(e) => handleLabActivityFactorChange('activity2', e.target.value)}
                          style={{width:'80px'}}
                        />
                      </td>
                      <td colSpan="3">
                        <input
                          type="number"
                          min="0"
                          value={labActivityFactors.activity3 || 0}
                          onChange={(e) => handleLabActivityFactorChange('activity3', e.target.value)}
                          style={{width:'80px'}}
                        />
                      </td>
                      <td colSpan="3">
                        <input
                          type="number"
                          min="0"
                          value={labActivityFactors.activity4 || 0}
                          onChange={(e) => handleLabActivityFactorChange('activity4', e.target.value)}
                          style={{width:'80px'}}
                        />
                      </td>
                      <td colSpan="3">
                        <input
                          type="number"
                          min="0"
                          value={labActivityFactors.activity5 || 0}
                          onChange={(e) => handleLabActivityFactorChange('activity5', e.target.value)}
                          style={{width:'80px'}}
                        />
                      </td>
                      <td>
                        {(() => {
                          const totals = labActivityActivityTotals();
                          return (totals.activity1 + totals.activity2 + totals.activity3 + totals.activity4 + totals.activity5);
                        })()}
                      </td>
                      <td className="co-total">
                        {(() => {
                          const totals = labActivityActivityTotals();
                          return (totals.activity1 + totals.activity2 + totals.activity3 + totals.activity4 + totals.activity5);
                        })()}
                      </td>
                    </tr>
                    
                    {/* Eq. Wt Row */}
                    <tr className="eq-wt-row">
                      <td colSpan="4"><strong>Eq. Wt</strong></td>
                      <td colSpan="3">
                        <input
                          type="number"
                          min="0"
                          value={labActivityEqWts.activity1 || 0}
                          onChange={(e) => handleLabActivityEqWtChange('activity1', e.target.value)}
                          style={{width:'80px'}}
                        />
                      </td>
                      <td colSpan="3">
                        <input
                          type="number"
                          min="0"
                          value={labActivityEqWts.activity2 || 0}
                          onChange={(e) => handleLabActivityEqWtChange('activity2', e.target.value)}
                          style={{width:'80px'}}
                        />
                      </td>
                      <td colSpan="3">
                        <input
                          type="number"
                          min="0"
                          value={labActivityEqWts.activity3 || 0}
                          onChange={(e) => handleLabActivityEqWtChange('activity3', e.target.value)}
                          style={{width:'80px'}}
                        />
                      </td>
                      <td colSpan="3">
                        <input
                          type="number"
                          min="0"
                          value={labActivityEqWts.activity4 || 0}
                          onChange={(e) => handleLabActivityEqWtChange('activity4', e.target.value)}
                          style={{width:'80px'}}
                        />
                      </td>
                      <td colSpan="3">
                        <input
                          type="number"
                          min="0"
                          value={labActivityEqWts.activity5 || 0}
                          onChange={(e) => handleLabActivityEqWtChange('activity5', e.target.value)}
                          style={{width:'80px'}}
                        />
                      </td>
                      <td>
                        {(() => {
                          const totals = labActivityActivityTotals();
                          const eqWts = labActivityEqWts;
                          const activity1Total = totals.activity1 * (eqWts.activity1 || 0);
                          const activity2Total = totals.activity2 * (eqWts.activity2 || 0);
                          const activity3Total = totals.activity3 * (eqWts.activity3 || 0);
                          const activity4Total = totals.activity4 * (eqWts.activity4 || 0);
                          const activity5Total = totals.activity5 * (eqWts.activity5 || 0);
                          return (activity1Total + activity2Total + activity3Total + activity4Total + activity5Total);
                        })()}
                      </td>
                      <td className="co-total">
                        {(() => {
                          const totals = labActivityActivityTotals();
                          const eqWts = labActivityEqWts;
                          const activity1Total = totals.activity1 * (eqWts.activity1 || 0);
                          const activity2Total = totals.activity2 * (eqWts.activity2 || 0);
                          const activity3Total = totals.activity3 * (eqWts.activity3 || 0);
                          const activity4Total = totals.activity4 * (eqWts.activity4 || 0);
                          const activity5Total = totals.activity5 * (eqWts.activity5 || 0);
                          return (activity1Total + activity2Total + activity3Total + activity4Total + activity5Total);
                        })()}
                      </td>
                    </tr>
                    
                    {/* Manual Wt Row */}
                    <tr className="manual-wt-row">
                      <td colSpan="4"><strong>Manual Wt</strong></td>
                      <td colSpan="3">
                        <input
                          type="number"
                          min="0"
                          value={labActivityManualWts.activity1 || 0}
                          onChange={(e) => handleLabActivityManualWtChange('activity1', e.target.value)}
                          style={{width:'80px'}}
                        />
                      </td>
                      <td colSpan="3">
                        <input
                          type="number"
                          min="0"
                          value={labActivityManualWts.activity2 || 0}
                          onChange={(e) => handleLabActivityManualWtChange('activity2', e.target.value)}
                          style={{width:'80px'}}
                        />
                      </td>
                      <td colSpan="3">
                        <input
                          type="number"
                          min="0"
                          value={labActivityManualWts.activity3 || 0}
                          onChange={(e) => handleLabActivityManualWtChange('activity3', e.target.value)}
                          style={{width:'80px'}}
                        />
                      </td>
                      <td colSpan="3">
                        <input
                          type="number"
                          min="0"
                          value={labActivityManualWts.activity4 || 0}
                          onChange={(e) => handleLabActivityManualWtChange('activity4', e.target.value)}
                          style={{width:'80px'}}
                        />
                      </td>
                      <td colSpan="3">
                        <input
                          type="number"
                          min="0"
                          value={labActivityManualWts.activity5 || 0}
                          onChange={(e) => handleLabActivityManualWtChange('activity5', e.target.value)}
                          style={{width:'80px'}}
                        />
                      </td>
                      <td>
                        {(() => {
                          const totals = labActivityActivityTotals();
                          const manualWts = labActivityManualWts;
                          const activity1Total = totals.activity1 * (manualWts.activity1 || 0);
                          const activity2Total = totals.activity2 * (manualWts.activity2 || 0);
                          const activity3Total = totals.activity3 * (manualWts.activity3 || 0);
                          const activity4Total = totals.activity4 * (manualWts.activity4 || 0);
                          const activity5Total = totals.activity5 * (manualWts.activity5 || 0);
                          return (activity1Total + activity2Total + activity3Total + activity4Total + activity5Total);
                        })()}
                      </td>
                      <td className="co-total">
                        {(() => {
                          const totals = labActivityActivityTotals();
                          const manualWts = labActivityManualWts;
                          const activity1Total = totals.activity1 * (manualWts.activity1 || 0);
                          const activity2Total = totals.activity2 * (manualWts.activity2 || 0);
                          const activity3Total = totals.activity3 * (manualWts.activity3 || 0);
                          const activity4Total = totals.activity4 * (manualWts.activity4 || 0);
                          const activity5Total = totals.activity5 * (manualWts.activity5 || 0);
                          return (activity1Total + activity2Total + activity3Total + activity4Total + activity5Total);
                        })()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              
              {/* LabActivity Summary Table */}
              <div className="table-wrapper" style={{marginTop: '20px'}}>
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
                          style={{width:'80px'}}
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
                          style={{width:'80px'}}
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
                          style={{width:'80px'}}
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
                          style={{width:'80px'}}
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
                          style={{width:'80px'}}
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              
              {/* LabActivity Obtained Marks Table */}
              <section style={{marginTop:'30px'}}>
                <h3>Obtained Marks</h3>
                <div className="table-wrapper">
                  <table className="ct-obtained-table">
                    <thead>
                      <tr>
                        <th rowSpan="3">Roll</th>
                        <th rowSpan="1">Attn.</th>
                        <th rowSpan="1">Quiz</th>
                        <th rowSpan="1">C. Viva</th>
                        <th colSpan="15">Lab Activity marks obtained out of {coMappedActivityMarks}</th>
                        <th rowSpan="3">Other<br/>(Measured Total)</th>
                        <th rowSpan="3">Other<br/>(0)</th>
                      </tr>
                      <tr>
                        <th rowSpan="2">Out of {labAttendanceMarks}</th>
                        <th rowSpan="2">Out of {labQuizMarks}</th>
                        <th rowSpan="2">Out of {labVivaMarks}</th>
                        <th colSpan="3">Activity1</th>
                        <th colSpan="3">Activity2</th>
                        <th colSpan="3">Activity3</th>
                        <th colSpan="3">Activity4</th>
                        <th colSpan="3">Activity5</th>
                      </tr>
                      <tr>
                        <th>Q1</th><th>Q2</th><th>Q3</th>
                        <th>Q1</th><th>Q2</th><th>Q3</th>
                        <th>Q1</th><th>Q2</th><th>Q3</th>
                        <th>Q1</th><th>Q2</th><th>Q3</th>
                        <th>Q1</th><th>Q2</th><th>Q3</th>
                      </tr>
                    </thead>
                    <tbody>
                      {labActivityObtainedRows.length > 0 ? labActivityObtainedRows.map((row, idx) => (
                        <tr key={row.rollNumber || idx}>
                          <td>{row.rollNumber || '-'}</td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              value={row.attendance || 0}
                              onChange={e => {
                                const updatedRows = [...labActivityObtainedRows];
                                updatedRows[idx] = { ...row, attendance: Number(e.target.value) };
                                setLabActivityObtainedRows(updatedRows);
                              }}
                              style={{width:'80px'}}
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
                              style={{width:'80px'}}
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
                              style={{width:'80px'}}
                            />
                          </td>
                          {['Activity1_Q1','Activity1_Q2','Activity1_Q3','Activity2_Q1','Activity2_Q2','Activity2_Q3','Activity3_Q1','Activity3_Q2','Activity3_Q3','Activity4_Q1','Activity4_Q2','Activity4_Q3','Activity5_Q1','Activity5_Q2','Activity5_Q3'].map(field => (
                            <td key={field}>
                              <input
                                type="number"
                                min="0"
                                value={row[field] || 0}
                                onChange={e => {
                                  const updatedRows = [...labActivityObtainedRows];
                                  updatedRows[idx] = { ...row, [field]: Number(e.target.value) };
                                  setLabActivityObtainedRows(updatedRows);
                                }}
                                style={{width:'80px'}}
                              />
                            </td>
                          ))}
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
                              style={{width:'80px'}}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              value={row.other || 0}
                              onChange={e => {
                                const updatedRows = [...labActivityObtainedRows];
                                updatedRows[idx] = { ...row, other: Number(e.target.value) };
                                setLabActivityObtainedRows(updatedRows);
                              }}
                              style={{width:'80px'}}
                            />
                          </td>
                        </tr>
                      )) : (
                        <tr><td colSpan="20" style={{textAlign:'center', color:'#7f8c8d'}}>No students found for this sheet.</td></tr>
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
            <section className="ct-section" style={{marginTop: '30px'}}>
              <h2>Allocated Marks for Attendance and Assignment (if taken)</h2>
              {console.log('selectedCourse', selectedCourse, 'attendanceMarks', selectedCourse?.attendanceMarks)}
              {clos.length === 0 && (
                <p style={{padding: '20px', color: '#7f8c8d'}}>Loading course outcomes...</p>
              )}
              {clos.length > 0 && (
              <>
              <div className="table-wrapper">
                <table className="ct-table">
                  <thead>
                    <tr>
                      <th rowSpan="3">CO No.</th>
                      <th rowSpan="2">Attendance Performance</th>
                      <th colSpan="9">CO mapping of Assignment Marks</th>
                      <th rowSpan="3">CO Total</th>
                    </tr>
                    <tr>
                      <th colSpan="3">Assignment 1</th>
                      <th colSpan="3">Assignment 2</th>
                      <th colSpan="3">Assignment 3</th>
                    </tr>
                    <tr>
                      <th>
                        <input
                          type="number"
                          min={0}
                          value={attendanceMarks}
                          onChange={e => setAttendanceMarks(Number(e.target.value))}
                          style={{width:'80px'}}
                        />
                      </th>
                      <th>Q1</th><th>Q2</th><th>Q3</th>
                      <th>Q1</th><th>Q2</th><th>Q3</th>
                      <th>Q1</th><th>Q2</th><th>Q3</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignmentRows.map((row, idx) => (
                      <tr key={row.coNumber || idx}>
                        <td className="co-label">{row.coNumber || '-'}</td>
                        <td>-</td>
                        {['Assgn1_Q1','Assgn1_Q2','Assgn1_Q3','Assgn2_Q1','Assgn2_Q2','Assgn2_Q3','Assgn3_Q1','Assgn3_Q2','Assgn3_Q3'].map(field => (
                          <td key={field}>
                            <input
                              type="number"
                              min="0"
                              value={row[field]}
                              onChange={(e) => handleAssignmentCellChange(idx, field, e.target.value)}
                              style={{width:'80px'}}
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
                      {(() => { const assignmentTotals = assignmentColumnGroupTotals(); return (
                        <>
                          {['Assgn1', 'Assgn2', 'Assgn3'].map(assignment => (
                            <td key={assignment} colSpan={3} style={{textAlign: 'center', fontWeight: 'bold'}}>
                              {assignmentTotals[assignment] || 0}
                            </td>
                          ))}
                        </>
                      ); })()}
                      <td>{assignmentRows.reduce((sum, r) => sum + computeAssignmentCOTotal(r), 0)}</td>
                    </tr>
                    <tr>
                      <td className="footer-label" colSpan={2}>Factor</td>
                      {['Assgn1', 'Assgn2', 'Assgn3'].map(assignment => {
                        const autoFactor = calculateAutoAssignmentFactor();
                        return (
                          <td key={assignment} colSpan={3} style={{textAlign: 'center'}}>
                            {(autoFactor[assignment] || 0).toFixed(4)}
                          </td>
                        );
                      })}
                      <td></td>
                    </tr>
                    <tr>
                      <td className="footer-label" colSpan={2}>Eq. Wt</td>
                      {['Assgn1', 'Assgn2', 'Assgn3'].map(assignment => {
                        const autoEqWt = calculateAssignmentAutoEqWt();
                        return (
                          <td key={assignment} colSpan={3} style={{textAlign: 'center'}}>
                            {(autoEqWt[assignment] || 0).toFixed(2)}
                          </td>
                        );
                      })}
                      <td><strong>{sumAssignmentEqWtTotal().toFixed(2)}</strong></td>
                    </tr>
                    <tr>
                      <td className="footer-label" colSpan={2}>Manual Wt</td>
                      {['Assgn1', 'Assgn2', 'Assgn3'].map(assignment => (
                        <td key={assignment} colSpan={3}>
                          <input
                            type="number"
                            step="0.01"
                            value={assignmentManualWts[assignment] ?? 0}
                            onChange={(e)=>handleAssignmentManualWtChange(assignment, e.target.value)}
                            style={{width:'80px'}}
                          />
                        </td>
                      ))}
                      <td><strong>{sumAssignmentManualWtTotal().toFixed(2)}</strong></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              {/* 1st new table: summary below allocated marks */}
              <div className="table-wrapper" style={{marginTop: '20px'}}>
                <table className="ct-table">
                  <tbody>
                    <tr>
                      <td>Assign. Taken</td>
                      <td><input type="number" min={0} max={3} style={{width:'80px'}} value={assignmentSummary.assignTaken} onChange={e=>setAssignmentSummary(prev=>({...prev, assignTaken: Math.max(0, Math.min(3, Number(e.target.value)||0))}))} /></td>
                    </tr>
                    <tr>
                      <td>Assignment Marks out of 30</td>
                      <td><input type="number" min={0} max={30} style={{width:'80px'}} value={assignmentSummary.assignmentMarks30} onChange={e=>setAssignmentSummary(prev=>({...prev, assignmentMarks30: Math.max(0, Math.min(30, Number(e.target.value)||0))}))} /></td>
                    </tr>
                    <tr>
                      <td>Use Eq. Wt</td>
                      <td><input type="number" step="0.01" style={{width:'80px'}} value={assignmentSummary.useEqWt} onChange={e=>setAssignmentSummary(prev=>({...prev, useEqWt: Number(e.target.value)||0}))} /></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* 2nd new table: Obtained Marks for Attendance, Performance and Assignment */}
              <section style={{marginTop:'30px'}}>
                <h3>Obtained Marks for Attendance, Performance and Assignment</h3>
                <div className="table-wrapper">
                  <table className="ct-obtained-table">
                    <thead>
                      <tr>
                        <th rowSpan={3}>Roll</th>
                        <th rowSpan={3}>Attendance Performance ({selectedCourse?.attendanceMarks ?? 0})</th>
                        <th colSpan={9}>Assignment marks obtained out of {/* TODO: replace with total assignment marks variable */}30</th>
                        <th rowSpan={3}>Total (30)</th>
                      </tr>
                      <tr>
                        <th colSpan={3}>Assignment 1 ({attnAssignObtainedRows.reduce((sum, row) => sum + (row.Assgn1_Q1 || 0) + (row.Assgn1_Q2 || 0) + (row.Assgn1_Q3 || 0), 0)})</th>
                        <th colSpan={3}>Assignment 2 ({attnAssignObtainedRows.reduce((sum, row) => sum + (row.Assgn2_Q1 || 0) + (row.Assgn2_Q2 || 0) + (row.Assgn2_Q3 || 0), 0)})</th>
                        <th colSpan={3}>Assignment 3 ({attnAssignObtainedRows.reduce((sum, row) => sum + (row.Assgn3_Q1 || 0) + (row.Assgn3_Q2 || 0) + (row.Assgn3_Q3 || 0), 0)})</th>
                      </tr>
                      <tr>
                        <th>Q1</th><th>Q2</th><th>Q3</th>
                        <th>Q1</th><th>Q2</th><th>Q3</th>
                        <th>Q1</th><th>Q2</th><th>Q3</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attnAssignObtainedRows.length > 0 ? attnAssignObtainedRows.map((row, idx) => (
                        <tr key={row.rollNumber || idx}>
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
                              style={{width:'80px'}}
                            />
                          </td>
                          {['Assgn1_Q1','Assgn1_Q2','Assgn1_Q3','Assgn2_Q1','Assgn2_Q2','Assgn2_Q3','Assgn3_Q1','Assgn3_Q2','Assgn3_Q3'].map(field => (
                            <td key={field}><input type="number" min={0} style={{width:'80px'}} /></td>
                          ))}
                          <td>{
                            (row.attendance || 0) +
                            (row.Assgn1_Q1 || 0) + (row.Assgn1_Q2 || 0) + (row.Assgn1_Q3 || 0) +
                            (row.Assgn2_Q1 || 0) + (row.Assgn2_Q2 || 0) + (row.Assgn2_Q3 || 0) +
                            (row.Assgn3_Q1 || 0) + (row.Assgn3_Q2 || 0) + (row.Assgn3_Q3 || 0)
                          }</td>
                        </tr>
                      )) : (
                        <tr><td colSpan={12} style={{textAlign:'center', color:'#7f8c8d'}}>No students found for this sheet.</td></tr>
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
        <div className="attainment-empty" style={{textAlign: 'center', padding: '40px'}}>
          Loading data for {selectedSheet}...
        </div>
      )}
    </div>
  );
};

export default AttainmentView;
