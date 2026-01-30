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
  const [saveStatus, setSaveStatus] = useState(''); // 'saving', 'saved', 'error'
  const saveTimeoutRef = useRef(null);
  
  // Assignment & Attendance states
  const [assignmentRows, setAssignmentRows] = useState([]);
  const [assignmentFactors, setAssignmentFactors] = useState({});
  const [assignmentEqWts, setAssignmentEqWts] = useState({});
  const [assignmentManualWts, setAssignmentManualWts] = useState({});
  const [attendanceMarks, setAttendanceMarks] = useState(0);

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

  // Load/clear course outcomes for CourseProfile, CT and Attn_Assign views
  useEffect(() => {
    console.log('CLO loading effect triggered:', { selectedCourse, selectedSheet, hasSelectedCourse: !!selectedCourse });
    if (selectedCourse && (selectedSheet === 'CourseProfile' || selectedSheet === 'CT' || selectedSheet === 'Attn_Assign')) {
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

  // Initialize Obtained Marks table rows from student list when CT or Attn_Assign selected
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
        }
      } else {
        if (forSheet === 'CT') setCtObtainedRows([]);
        else if (forSheet === 'Attn_Assign') setAttnAssignObtainedRows([]);
      }
    };
    if (selectedSheet === 'CT') initObtainedRows('CT');
    else if (selectedSheet === 'Attn_Assign') initObtainedRows('Attn_Assign');
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

  const handleAssignmentManualWtChange = (field, value) => {
    const num = Number(value);
    setAssignmentManualWts(prev => ({ ...prev, [field]: isNaN(num) ? 0 : num }));
    triggerAutosave();
  };

  const sumAssignmentEqWtTotal = () => {
    const { Assgn1 = 0, Assgn2 = 0, Assgn3 = 0 } = assignmentEqWts || {};
    return (Assgn1 + Assgn2 + Assgn3);
  };

  const sumAssignmentManualWtTotal = () => {
    const fields = ['Assgn1_Q1','Assgn1_Q2','Assgn1_Q3','Assgn2_Q1','Assgn2_Q2','Assgn2_Q3','Assgn3_Q1','Assgn3_Q2','Assgn3_Q3'];
    return fields.reduce((acc, f) => acc + (assignmentManualWts[f] || 0), 0);
  };

  const columnTotals = () => {
    const fields = ['CT1_Q1','CT1_Q2','CT1_Q3','CT2_Q1','CT2_Q2','CT2_Q3','CT3_Q1','CT3_Q2','CT3_Q3'];
    const totals = {};
    fields.forEach(f => totals[f] = 0);
    ctRows.forEach(r => fields.forEach(f => totals[f] += (r[f] || 0)));
    return totals;
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

  const handleManualWtChange = (field, value) => {
    const num = Number(value);
    setCtManualWts(prev => ({ ...prev, [field]: isNaN(num) ? 0 : num }));
    triggerAutosave();
  };

  const handleEqWtChange = (ctKey, value) => {
    const num = Number(value);
    setCtEqWts(prev => ({ ...prev, [ctKey]: isNaN(num) ? 0 : num }));
    triggerAutosave();
  };

  const sumEqWtTotal = () => {
    const { CT1 = 0, CT2 = 0, CT3 = 0 } = ctEqWts || {};
    return (CT1 + CT2 + CT3);
  };

  const sumManualWtTotal = () => {
    const fields = ['CT1_Q1','CT1_Q2','CT1_Q3','CT2_Q1','CT2_Q2','CT2_Q3','CT3_Q1','CT3_Q2','CT3_Q3'];
    return fields.reduce((acc, f) => acc + (ctManualWts[f] || 0), 0);
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
      // Determine course type from course code
      const isLabCourse = selectedCourse.courseCode.includes('1102') || 
                          selectedCourse.courseCode.toLowerCase().includes('lab');
      
      // Define sheets for each course type
      const theorySheets = [
        'CourseProfile', 'CT', 'Attn_Assign', 'SectionA', 'SectionB',
        'COAttainment', 'COCalc', 'COPOMap', 'POCalcMax', 'Charts', 'POCalc', 'CheckPO'
      ];
      
      const labSheets = [
        'CourseProfile', 'LabActivity', 'COAttainment', 'COCalc_LabUnnorm',
        'COCalc', 'COPOMap', 'POCalcMax', 'Charts', 'POCalc', 'CheckPO'
      ];
      
      // Select appropriate sheet list
      const allowedSheets = isLabCourse ? labSheets : theorySheets;
      
      // Filter sheets to only show allowed ones
      let filtered = sheetNames.filter(sheet => allowedSheets.includes(sheet));
      
      // Always include default sheets even if not in Excel file
      const defaultSheets = isLabCourse 
        ? ['CourseProfile', 'LabActivity']
        : ['CourseProfile', 'CT', 'Attn_Assign'];
      
      defaultSheets.forEach(sheet => {
        if (!filtered.includes(sheet)) {
          filtered.unshift(sheet);
        }
      });
      
      // For theory courses with specific section assignment, filter section sheets
      if (!isLabCourse && selectedCourse.section) {
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
      setTeacherCourses(courseList);
      // If a course is already selected, update it with the latest info
      if (selectedCourse) {
        const updated = courseList.find(c => c._id === selectedCourse._id);
        if (updated) setSelectedCourse(updated);
      }
    } catch (err) {
      console.error('refreshTeacherCourses error:', err);
      setError('Failed to refresh courses: ' + (err?.message || JSON.stringify(err)));
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

      {/* Course Selector - First Step */}
      {userRole === 'teacher' && teacherCourses.length > 0 && (
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
          >
            <option value="">-- Select a Course --</option>
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
              {/* CT summary table similar to Assignments Taken */}
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
                      {(() => { const totals = columnTotals(); return (
                        <>
                          {getActiveCTFields().map(field => (
                            <td key={field}>{totals[field]}</td>
                          ))}
                        </>
                      ); })()}
                      <td>{ctRows.reduce((sum, r) => sum + computeCOTotal(r), 0)}</td>
                    </tr>
                    <tr>
                      <td className="footer-label">Factor</td>
                      {getActiveCTs().map(ct => (
                        <td key={ct} colSpan={3}>
                          <input
                            type="number"
                            step="0.01"
                            value={ctFactors[ct] ?? 1}
                            onChange={(e)=>handleFactorChange(ct, e.target.value)}
                            style={{width:'80px'}}
                          />
                        </td>
                      ))}
                      <td></td>
                    </tr>
                    <tr>
                      <td className="footer-label">Eq. Wt</td>
                      {getActiveCTs().map(ct => (
                        <td key={ct} colSpan={3}>
                          <input
                            type="number"
                            step="0.01"
                            value={ctEqWts[ct] ?? 0}
                            onChange={(e)=>handleEqWtChange(ct, e.target.value)}
                            style={{width:'80px'}}
                          />
                        </td>
                      ))}
                      <td><strong>{sumEqWtTotal().toFixed(2)}</strong></td>
                    </tr>
                    <tr>
                      <td className="footer-label">Manual Wt</td>
                      {getActiveCTFields().map(field => (
                        <td key={`man_${field}`}>
                          <input
                            type="number"
                            step="0.01"
                            value={ctManualWts[field] ?? 0}
                            onChange={(e)=>handleManualWtChange(field, e.target.value)}
                            style={{width:'80px'}}
                          />
                        </td>
                      ))}
                      <td><strong>{sumManualWtTotal().toFixed(2)}</strong></td>
                    </tr>
                  </tfoot>
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
                      {(() => { const totals = assignmentColumnTotals(); return (
                        <>
                          <td>{totals['Assgn1_Q1']}</td>
                          <td>{totals['Assgn1_Q2']}</td>
                          <td>{totals['Assgn1_Q3']}</td>
                          <td>{totals['Assgn2_Q1']}</td>
                          <td>{totals['Assgn2_Q2']}</td>
                          <td>{totals['Assgn2_Q3']}</td>
                          <td>{totals['Assgn3_Q1']}</td>
                          <td>{totals['Assgn3_Q2']}</td>
                          <td>{totals['Assgn3_Q3']}</td>
                        </>
                      ); })()}
                      <td>{assignmentRows.reduce((sum, r) => sum + computeAssignmentCOTotal(r), 0)}</td>
                    </tr>
                    <tr>
                      <td className="footer-label" colSpan={2}>Factor</td>
                      <td colSpan={3}>
                        <input
                          type="number"
                          step="0.01"
                          value={assignmentFactors['Assgn1'] ?? 1}
                          onChange={(e)=>handleAssignmentFactorChange('Assgn1', e.target.value)}
                          style={{width:'80px'}}
                        />
                      </td>
                      <td colSpan={3}>
                        <input
                          type="number"
                          step="0.01"
                          value={assignmentFactors['Assgn2'] ?? 1}
                          onChange={(e)=>handleAssignmentFactorChange('Assgn2', e.target.value)}
                          style={{width:'80px'}}
                        />
                      </td>
                      <td colSpan={3}>
                        <input
                          type="number"
                          step="0.01"
                          value={assignmentFactors['Assgn3'] ?? 1}
                          onChange={(e)=>handleAssignmentFactorChange('Assgn3', e.target.value)}
                          style={{width:'80px'}}
                        />
                      </td>
                      <td></td>
                    </tr>
                    <tr>
                      <td className="footer-label" colSpan={2}>Eq. Wt</td>
                      <td colSpan={3}>
                        <input
                          type="number"
                          step="0.01"
                          value={assignmentEqWts['Assgn1'] ?? 0}
                          onChange={(e)=>handleAssignmentEqWtChange('Assgn1', e.target.value)}
                          style={{width:'80px'}}
                        />
                      </td>
                      <td colSpan={3}>
                        <input
                          type="number"
                          step="0.01"
                          value={assignmentEqWts['Assgn2'] ?? 0}
                          onChange={(e)=>handleAssignmentEqWtChange('Assgn2', e.target.value)}
                          style={{width:'80px'}}
                        />
                      </td>
                      <td colSpan={3}>
                        <input
                          type="number"
                          step="0.01"
                          value={assignmentEqWts['Assgn3'] ?? 0}
                          onChange={(e)=>handleAssignmentEqWtChange('Assgn3', e.target.value)}
                          style={{width:'80px'}}
                        />
                      </td>
                      <td><strong>{sumAssignmentEqWtTotal().toFixed(2)}</strong></td>
                    </tr>
                    <tr>
                      <td className="footer-label" colSpan={2}>Manual Wt</td>
                      {['Assgn1_Q1','Assgn1_Q2','Assgn1_Q3','Assgn2_Q1','Assgn2_Q2','Assgn2_Q3','Assgn3_Q1','Assgn3_Q2','Assgn3_Q3'].map(field => (
                        <td key={`man_${field}`}>
                          <input
                            type="number"
                            step="0.01"
                            value={assignmentManualWts[field] ?? 0}
                            onChange={(e)=>handleAssignmentManualWtChange(field, e.target.value)}
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
                      <td><input type="number" min={0} max={3} style={{width:'80px'}} /></td>
                    </tr>
                    <tr>
                      <td>Assignment Marks out of 30</td>
                      <td><input type="number" min={0} max={30} style={{width:'80px'}} /></td>
                    </tr>
                    <tr>
                      <td>Use Eq. Wt</td>
                      <td><input type="number" step="0.01" style={{width:'80px'}} /></td>
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
