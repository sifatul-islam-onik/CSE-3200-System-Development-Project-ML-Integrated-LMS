import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBook, faPlus, faHourglass, faCheckCircle, faTimesCircle, faEye, faTrash, faEdit, faSignOutAlt, faChevronDown, faChevronRight, faClipboardList, faTimes } from '@fortawesome/free-solid-svg-icons';
import { getUser, logout } from '../components/ProtectedRoute';
import { getProfile } from '../services/authService';
import { getMyProposals, createCourseProposal, deleteProposal } from '../services/courseProposalService';
import { getAllCourses, getCourseStudents } from '../services/courseService';
import { getCourseProfile } from '../services/courseProfileService';
import { getCTData, saveCTData, parseCTUpload, getLabActivityData, saveLabActivityData, parseLabUpload, getAssignmentData, saveAssignmentData, parseAssignUpload } from '../services/attainmentService';
import CourseForm from '../components/CourseForm';
import AttainmentView from '../components/AttainmentView';
import CourseOBEView from '../components/CourseOBEView';
import MarkEntry from '../components/MarkEntry';
import { SheetLoader, SkeletonTable } from '../components/attainment/LoadingSpinner';
import '../styles/Dashboard.css';
import '../styles/AdminDashboard.css';
import '../styles/spinner.css';
import '../styles/Profile.css';

const TeacherDashboard = () => {
  // Helper: sort courses by courseCode ascending (numeric + case-insensitive)
  const sortCoursesByCode = (list = []) => {
    const normalize = (code = '') => {
      const trimmed = code.trim();
      const match = trimmed.match(/^([A-Za-z]+)\s*(\d+)/);
      if (!match) return { prefix: trimmed.toUpperCase(), num: Number.MAX_SAFE_INTEGER, raw: trimmed };
      return { prefix: match[1].toUpperCase(), num: parseInt(match[2], 10), raw: trimmed };
    };

    return [...list].sort((a, b) => {
      const aNorm = normalize(a.courseCode || '');
      const bNorm = normalize(b.courseCode || '');

      if (aNorm.prefix !== bNorm.prefix) {
        return aNorm.prefix.localeCompare(bNorm.prefix);
      }
      if (aNorm.num !== bNorm.num) {
        return aNorm.num - bNorm.num;
      }
      return (aNorm.raw || '').localeCompare(bNorm.raw || '', undefined, { sensitivity: 'base' });
    });
  };

  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [activeSection, setActiveSection] = useState('proposals');
  const [proposals, setProposals] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [courseFormLoading, setCourseFormLoading] = useState(false);
  const [proposalType, setProposalType] = useState('CREATE');
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [showOBEView, setShowOBEView] = useState(false);
  const [changeDescription, setChangeDescription] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 1024);
  const [proposalsOpen, setProposalsOpen] = useState(true);
  const [courseGroupPath, setCourseGroupPath] = useState(null); // null = root, 'year-X' = year view, 'sem-X-Y' = semester view, 'type-X-Y-Z' = type view
  const [profileForm, setProfileForm] = useState({
    name: '', father: '', mother: '', advisor: '', phone: '', address: '', hall: '', email: '', scholarship: '', gender: 'others', bloodGroup: '', religion: ''
  });
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showMarkEntry, setShowMarkEntry] = useState(false);
  const [markEntryCourse, setMarkEntryCourse] = useState(null);
  const [markEntrySection, setMarkEntrySection] = useState(null);
  const [courseStudents, setCourseStudents] = useState([]);
  const [showCTMarksModal, setShowCTMarksModal] = useState(false);
  const [ctMarksCourse, setCtMarksCourse] = useState(null);
  const [ctSettings, setCtSettings] = useState({ ctTaken: 0, coMappedMarks60: 0, useEqWt: 0 });
  const [ctSettingsSaving, setCtSettingsSaving] = useState(false);
  const [ctSettingsLoading, setCtSettingsLoading] = useState(false);
  const [ctExistingData, setCtExistingData] = useState(null);
  const [selectedCTUpload, setSelectedCTUpload] = useState('CT1');
  const [ctUploadFile, setCtUploadFile] = useState(null);
  const [ctUploadParsed, setCtUploadParsed] = useState(null);
  const [ctUploadLoading, setCtUploadLoading] = useState(false);
  const [ctUploadSaving, setCtUploadSaving] = useState(false);
  const [ctFileInputKey, setCtFileInputKey] = useState(0);
  const [isSmallScreen, setIsSmallScreen] = useState(typeof window !== 'undefined' ? window.innerWidth < 640 : false);

  // Lab Marks state
  const [showLabMarksModal, setShowLabMarksModal] = useState(false);
  const [labMarksCourse, setLabMarksCourse] = useState(null);
  const [labSettings, setLabSettings] = useState({ activityTaken: 1, otherActivityRemaining: 0, otherActivityMeasured: 0, coMappedActivityMarks: 0, useEqWtActivity: 0, attnMarks: 0, quizMarks: 0, vivaMarks: 0 });
  const [labDataRefreshKey, setLabDataRefreshKey] = useState(0);
  const [labSettingsSaving, setLabSettingsSaving] = useState(false);
  const [labSettingsLoading, setLabSettingsLoading] = useState(false);
  const [labExistingData, setLabExistingData] = useState(null);
  const [selectedActivityUpload, setSelectedActivityUpload] = useState('Activity1');
  const [labUploadFile, setLabUploadFile] = useState(null);
  const [labUploadParsed, setLabUploadParsed] = useState(null);
  const [labUploadLoading, setLabUploadLoading] = useState(false);
  const [labUploadSaving, setLabUploadSaving] = useState(false);
  const [labFileInputKey, setLabFileInputKey] = useState(0);
  
  // Attendance & Assignment Marks state
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [attendanceCourse, setAttendanceCourse] = useState(null);
  const [assignSettings, setAssignSettings] = useState({ assignTaken: 0, assignmentMarks30: 0, useEqWt: 0, attendancePerformance: 0 });
  const [assignSettingsSaving, setAssignSettingsSaving] = useState(false);
  const [assignSettingsLoading, setAssignSettingsLoading] = useState(false);
  const [selectedAssignUpload, setSelectedAssignUpload] = useState('Assgn1');
  const [assignUploadFile, setAssignUploadFile] = useState(null);
  const [assignUploadParsed, setAssignUploadParsed] = useState(null);
  const [assignUploadLoading, setAssignUploadLoading] = useState(false);
  const [assignUploadSaving, setAssignUploadSaving] = useState(false);
  const [assignFileInputKey, setAssignFileInputKey] = useState(0);
  const [assignExistingData, setAssignExistingData] = useState(null);

  useEffect(() => {
    const handleResize = () => setIsSmallScreen(window.innerWidth < 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // When CT modal opens, load existing settings
  useEffect(() => {    if (showCTMarksModal && ctMarksCourse) {
      setCtSettingsLoading(true);
      setCtUploadFile(null);
      setCtUploadParsed(null);
      getCTData(ctMarksCourse._id)
        .then(resp => {
          if (resp.success && resp.data) {
            const data = resp.data;
            // Sanitize: remove any stray "Roll" rows saved from previous bad uploads
            if (Array.isArray(data.ctObtainedRows)) {
              data.ctObtainedRows = data.ctObtainedRows.filter(r => r.rollNumber && r.rollNumber.toLowerCase() !== 'roll');
            }
            setCtExistingData(data);
            const taken = data.ctSummary?.ctTaken ?? 0;
            setCtSettings({
              ctTaken: taken,
              coMappedMarks60: data.ctSummary?.coMappedMarks60 ?? 0,
              useEqWt: data.ctSummary?.useEqWt ?? 0,
            });
            setSelectedCTUpload(`CT${Math.min(taken, 1) || 1}`);
          } else {
            setCtExistingData(null);
            setCtSettings({ ctTaken: 0, coMappedMarks60: 0, useEqWt: 0 });
            setSelectedCTUpload('CT1');
          }
        })
        .catch(err => {
          console.error('Error loading CT data:', err);
          setCtExistingData(null);
        })
        .finally(() => setCtSettingsLoading(false));
    }
  }, [showCTMarksModal, ctMarksCourse]);

  // When Lab modal opens, load existing lab data
  useEffect(() => {
    if (showLabMarksModal && labMarksCourse) {
      setLabSettingsLoading(true);
      setLabUploadFile(null);
      setLabUploadParsed(null);
      getLabActivityData(labMarksCourse._id)
        .then(resp => {
          if (resp.success && resp.data) {
            const data = resp.data;
            setLabExistingData(data);
            const taken = data.activityTaken || 1;
            setLabSettings({
              activityTaken: taken,
              otherActivityRemaining: data.otherActivityRemaining || 0,
              otherActivityMeasured: data.otherActivityMeasured || 0,
              coMappedActivityMarks: data.coMappedActivityMarks || 0,
              useEqWtActivity: data.useEqWtActivity || 0,
              attnMarks: data.labAttendanceMarks || 0,
              quizMarks: data.labQuizMarks || 0,
              vivaMarks: data.labVivaMarks || 0,
            });
            setSelectedActivityUpload(`Activity${taken >= 1 ? 1 : 1}`);
          } else {
            setLabExistingData(null);
            setLabSettings({ activityTaken: 1, otherActivityRemaining: 0, otherActivityMeasured: 0, coMappedActivityMarks: 0, useEqWtActivity: 0, attnMarks: 0, quizMarks: 0, vivaMarks: 0 });
            setSelectedActivityUpload('Activity1');
          }
        })
        .catch(err => { console.error('Error loading lab data:', err); setLabExistingData(null); })
        .finally(() => setLabSettingsLoading(false));
    }
  }, [showLabMarksModal, labMarksCourse]);

  // When Attendance & Assignments modal opens, load existing data
  useEffect(() => {
    if (showAttendanceModal && attendanceCourse) {
      setAssignSettingsLoading(true);
      setAssignUploadFile(null);
      setAssignUploadParsed(null);
      getAssignmentData(attendanceCourse._id)
        .then(resp => {
          if (resp.success && resp.data) {
            const data = resp.data;
            setAssignExistingData(data);
            const taken = data.assignmentSummary?.assignTaken ?? 0;
            setAssignSettings({
              assignTaken: taken,
              assignmentMarks30: data.assignmentSummary?.assignmentMarks30 ?? 0,
              useEqWt: data.assignmentSummary?.useEqWt ?? 0,
              attendancePerformance: data.assignmentSummary?.attendancePerformance ?? 0,
            });
            setSelectedAssignUpload('Assgn1');
          } else {
            setAssignExistingData(null);
            setAssignSettings({ assignTaken: 0, assignmentMarks30: 0, useEqWt: 0, attendancePerformance: 0 });
            setSelectedAssignUpload('Assgn1');
          }
        })
        .catch(err => { console.error('Error loading assignment data:', err); setAssignExistingData(null); })
        .finally(() => setAssignSettingsLoading(false));
    }
  }, [showAttendanceModal, attendanceCourse]);

  // Navigate to a course group (drill-down)
  const navigateToGroup = (groupKey) => {
    setCourseGroupPath(groupKey);
  };

  // Go back to previous level
  const goBackGroup = () => {
    if (!courseGroupPath) return;
    
    const parts = courseGroupPath.split('-');
    if (parts.length === 2) {
      // Going back from year-semester to root
      setCourseGroupPath(null);
    } else if (parts.length === 3) {
      // Going back from type to year-semester
      setCourseGroupPath(`${parts[0]}-${parts[1]}`);
    }
  };

  // Organize courses by year-semester (e.g., 3-1, 1-2) and type
  const getOrganizedCourses = () => {
    const organized = {};
    courses.forEach(course => {
      const year = course.yearLevel !== null && course.yearLevel !== undefined ? course.yearLevel : 'Other';
      const term = course.term !== null && course.term !== undefined ? course.term : 'Other';
      const type = course.course_type || 'THEORY';
      
      // If term is 0, add course to both semester 1 and 2 of that year
      if (term === 0) {
        [1, 2].forEach(sem => {
          const yearSemKey = `${year}-${sem}`;
          if (!organized[yearSemKey]) organized[yearSemKey] = {};
          if (!organized[yearSemKey][type]) organized[yearSemKey][type] = [];
          organized[yearSemKey][type].push(course);
        });
      } else {
        const yearSemKey = `${year}-${term}`;
        if (!organized[yearSemKey]) organized[yearSemKey] = {};
        if (!organized[yearSemKey][type]) organized[yearSemKey][type] = [];
        organized[yearSemKey][type].push(course);
      }
    });

    // Sort each type bucket by course code ascending to ensure consistent order in the UI
    Object.keys(organized).forEach((yearSemKey) => {
      Object.keys(organized[yearSemKey]).forEach((type) => {
        organized[yearSemKey][type] = sortCoursesByCode(organized[yearSemKey][type]);
      });
    });
    return organized;
  };

  useEffect(() => {
    const userData = getUser();
    setUser(userData);
    if (userData) {
      setProfileForm({
        name: userData.name || '',
        father: userData.father || '',
        mother: userData.mother || '',
        advisor: userData.advisor || '',
        phone: userData.phone || '',
        address: userData.address || '',
        hall: userData.hall || '',
        email: userData.email || '',
        designation: userData.designation || 'Lecturer',
        scholarship: userData.scholarship || '',
        gender: userData.gender || 'others',
        bloodGroup: userData.bloodGroup || '',
        religion: userData.religion || ''
      });
    }
  }, []);

  useEffect(() => {
    const refreshProfile = async () => {
      if (activeSection === 'profile') {
        try {
          const resp = await getProfile();
          if (resp?.success && resp.data) {
            localStorage.setItem('user', JSON.stringify(resp.data));
            setProfileForm((prev) => ({
              ...prev,
              name: resp.data.name || prev.name,
              father: resp.data.father || prev.father,
              mother: resp.data.mother || prev.mother,
              advisor: resp.data.advisor || prev.advisor,
              phone: resp.data.phone || prev.phone,
              address: resp.data.address || prev.address,
              hall: resp.data.hall || prev.hall,
              email: resp.data.email || prev.email,
              designation: resp.data.designation || prev.designation || 'Lecturer',
              scholarship: resp.data.scholarship || prev.scholarship,
              gender: resp.data.gender || prev.gender || 'others',
              bloodGroup: resp.data.bloodGroup || prev.bloodGroup,
              religion: resp.data.religion || prev.religion
            }));
          }
        } catch (e) {
          // ignore errors fetching profile
        }
      }
    };
    refreshProfile();
  }, [activeSection]);

  useEffect(() => {
    const run = async () => {
      if (activeSection === 'proposals') {
        setLoading(true);
        setError('');
        try {
          const response = await getMyProposals();
          setProposals(response.data || []);
        } catch (err) {
          setError(err.message || 'Failed to fetch proposals');
        } finally {
          setLoading(false);
        }
      }
      if (activeSection === 'courses') {
        setLoading(true);
        setError('');
        try {
          const response = await getAllCourses();
          setCourses(sortCoursesByCode(response.data || []));
        } catch (err) {
          setError(err.message || 'Failed to fetch courses');
        } finally {
          setLoading(false);
        }
      }
    };
    run();
  }, [activeSection]);

  const fetchMyProposals = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await getMyProposals();
      setProposals(response.data || []);
    } catch (err) {
      setError(err.message || 'Failed to fetch proposals');
    } finally {
      setLoading(false);
    }
  };

  

  const handleCreateProposal = async (courseData) => {
    // Validate that changeDescription is provided for UPDATE proposals
    if (proposalType === 'UPDATE' && !changeDescription.trim()) {
      setError('Please provide a description of changes for your update proposal');
      setTimeout(() => setError(''), 5000);
      return;
    }
    
    setCourseFormLoading(true);
    try {
      const proposalData = {
        proposalType,
        existingCourseId: proposalType === 'UPDATE' ? selectedCourse._id : undefined,
        courseData,
        changeDescription
      };
      
      await createCourseProposal(proposalData);
      setSuccessMessage('Course proposal submitted successfully! Waiting for admin approval.');
      setShowCourseForm(false);
      setSelectedCourse(null);
      setChangeDescription('');
      if (activeSection === 'proposals') {
        fetchMyProposals();
      }
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      setError(err.message || 'Failed to submit proposal');
      setTimeout(() => setError(''), 5000);
    } finally {
      setCourseFormLoading(false);
    }
  };

  const handleSectionChange = (section) => {
    setActiveSection(section);
    // Close sidebar on mobile after selecting a section
    if (window.innerWidth <= 1024) {
      setSidebarOpen(false);
    }
  };

  const handleDeleteProposal = async (proposalId) => {
    if (!window.confirm('Are you sure you want to delete this proposal?')) return;
    
    try {
      await deleteProposal(proposalId);
      setSuccessMessage('Proposal deleted successfully');
      fetchMyProposals();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to delete proposal');
      setTimeout(() => setError(''), 3000);
    }
  };

  const openCreateProposal = () => {
    setProposalType('CREATE');
    setSelectedCourse(null);
    setChangeDescription('');
    setShowCourseForm(true);
    handleSectionChange('create-proposal');
  };

  const openEditProposal = (course) => {
    setProposalType('UPDATE');
    setSelectedCourse(course);
    setChangeDescription('');
    setShowCourseForm(true);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getStatusBadge = (status) => {
    const badges = {
      PENDING: { icon: faHourglass, class: 'status-pending', text: 'Pending' },
      APPROVED: { icon: faCheckCircle, class: 'status-approved', text: 'Approved' },
      REJECTED: { icon: faTimesCircle, class: 'status-rejected', text: 'Rejected' }
    };
    const badge = badges[status] || badges.PENDING;
    return (
      <span className={`status-badge ${badge.class}`}>
        <FontAwesomeIcon icon={badge.icon} /> {badge.text}
      </span>
    );
  };

  const renderSection = () => {
    switch (activeSection) {
      case 'proposals':
        return (
          <div className="section-container">
            <div className="section-header">
              <h2>My Course Proposals</h2>
              <p>Track and manage your submitted proposals</p>
            </div>
            <div className="section-body">
              {successMessage && <div className="alert alert-success">{successMessage}</div>}
              {error && <div className="alert alert-error">{error}</div>}

              {loading ? (
                <SheetLoader label="Loading proposals…" />
              ) : proposals.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon"><FontAwesomeIcon icon={faBook} /></div>
                  <h3>No Proposals Yet</h3>
                  <p>You haven't submitted any course proposals</p>
                  <button className="btn btn-primary" onClick={openCreateProposal}>
                    <FontAwesomeIcon icon={faPlus} /> Create Proposal
                  </button>
                </div>
              ) : (
                <div className="proposals-list">
                  {proposals.map((proposal) => (
                    <div key={proposal._id} className="proposal-card">
                      <div className="proposal-header">
                        <div>
                          <h3>{proposal.proposedData.courseCode} - {proposal.proposedData.courseTitle}</h3>
                          <span className={`proposal-type-badge ${proposal.proposalType.toLowerCase()}`}>
                            {proposal.proposalType === 'CREATE' ? 'New Course' : 'Course Update'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                          {getStatusBadge(proposal.status)}
                          <button
                            className="btn-icon-delete"
                            onClick={() => handleDeleteProposal(proposal._id)}
                            title="Delete proposal"
                          >
                            <FontAwesomeIcon icon={faTrash} />
                          </button>
                        </div>
                      </div>
                      <div className="proposal-body">
                        <div className="proposal-info">
                          <span><strong>Department:</strong> {proposal.proposedData.course_offered_to}</span>
                          <span><strong>Credits:</strong> {proposal.proposedData.credit}</span>
                          <span><strong>Type:</strong> {proposal.proposedData.course_type}</span>
                        </div>
                        {proposal.changeDescription && (
                          <div className="proposal-description">
                            <strong>Description:</strong> 
                            <span>{proposal.changeDescription}</span>
                          </div>
                        )}
                        <div className="proposal-meta">
                          <small>📅 Submitted: {new Date(proposal.createdAt).toLocaleDateString()}</small>
                          {proposal.status !== 'PENDING' && (
                            <small>✓ Reviewed: {new Date(proposal.updatedAt).toLocaleDateString()}</small>
                          )}
                        </div>
                        {proposal.status === 'REJECTED' && proposal.reviewComment && (
                          <div className="rejection-reason">
                            <strong>❌ Rejection Reason:</strong>
                            <span>{proposal.reviewComment}</span>
                          </div>
                        )}
                        {proposal.status === 'APPROVED' && proposal.reviewComment && (
                          <div className="approval-comment">
                            <strong>✓ Admin Comments:</strong>
                            <span>{proposal.reviewComment}</span>
                          </div>
                        )}
                      </div>

                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );

      case 'courses':
        const organizedCourses = getOrganizedCourses();
        const yearSemKeys = Object.keys(organizedCourses).sort((a, b) => {
          const [aYear, aSem] = a.split('-').map(Number);
          const [bYear, bSem] = b.split('-').map(Number);
          
          if (aYear !== bYear) return aYear - bYear;
          return aSem - bSem;
        });

        return (
          <div className="section-container">
            <div className="section-header">
              <h2>Existing Courses</h2>
              <p>Select a course to propose modifications</p>
            </div>
            <div className="section-body">
              {error && <div className="alert alert-error">{error}</div>}

              {loading ? (
                <SkeletonTable rows={8} cols={4} />
              ) : courses.length === 0 ? (
                <div className="empty-state">
                  <h3>No Courses Available</h3>
                </div>
              ) : (
                <div className="courses-tree">
                  {/* Breadcrumb Navigation */}
                  {courseGroupPath && (
                    <div className="breadcrumb-nav">
                      <button className="breadcrumb-btn" onClick={goBackGroup}>← Back</button>
                    </div>
                  )}

                  {!courseGroupPath ? (
                    // Root view: Show all year-semester combinations
                    <div className="tree-group">
                      {yearSemKeys.map((yearSemKey) => {
                        return (
                          <button
                            key={yearSemKey}
                            className="tree-header tree-year-header"
                            onClick={() => navigateToGroup(yearSemKey)}
                          >
                            <FontAwesomeIcon icon={faChevronRight} />
                            <span>{yearSemKey}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : organizedCourses[courseGroupPath] ? (
                    // Year-Semester view: Show all course types
                    (() => {
                      const types = Object.keys(organizedCourses[courseGroupPath] || {});
                      return (
                        <div className="tree-group">
                          {types.map((type) => {
                            const typeCourses = organizedCourses[courseGroupPath][type];
                            const typeLabel = type === 'THEORY' ? 'Theory' : type === 'SESSIONAL' ? 'Sessional' : 'Project/Thesis';
                            return (
                              <button
                                key={`${courseGroupPath}-${type}`}
                                className="tree-header tree-type-header"
                                onClick={() => navigateToGroup(`${courseGroupPath}-${type}`)}
                              >
                                <FontAwesomeIcon icon={faChevronRight} />
                                <span>{typeLabel} ({typeCourses.length})</span>
                              </button>
                            );
                          })}
                        </div>
                      );
                    })()
                  ) : courseGroupPath.includes('-') ? (
                    // Type view: Show all courses in selected type
                    (() => {
                      const parts = courseGroupPath.split('-');
                      const yearSem = `${parts[0]}-${parts[1]}`;
                      const type = parts[2];
                      const typeCourses = organizedCourses[yearSem]?.[type] || [];
                      const sortedTypeCourses = sortCoursesByCode(typeCourses);
                      return (
                        <div className="tree-content">
                          {sortedTypeCourses.map((course) => {
                            // Find teacher's section for this course
                            const assignment = course.assignedTeachers?.find(at => {
                              const teacherId = at.teacher?._id || at.teacher;
                              const userIdToMatch = user.userId || user._id;
                              return teacherId && teacherId.toString() === userIdToMatch;
                            });
                            const teacherSection = assignment?.section || null;
                            
                            return (
                            <div key={course._id} className="course-item">
                              <div className="course-item-header">
                                <div className="course-info">
                                  <span className="course-code">{course.courseCode}</span>
                                  {teacherSection && (
                                    <span style={{
                                      padding: '2px 8px',
                                      backgroundColor: '#e6eeff',
                                      color: '#38485f',
                                      borderRadius: '4px',
                                      fontSize: '12px',
                                      fontWeight: 600,
                                      marginLeft: '8px'
                                    }}>
                                      Section {teacherSection}
                                    </span>
                                  )}
                                  {!teacherSection && course.course_type === 'THEORY' && (
                                    <span style={{
                                      padding: '2px 8px',
                                      backgroundColor: '#fff8ea',
                                      color: '#8a5b0f',
                                      borderRadius: '4px',
                                      fontSize: '12px',
                                      fontWeight: 600,
                                      marginLeft: '8px'
                                    }}>
                                      No Section ⚠️
                                    </span>
                                  )}
                                  <span className="course-title">{course.courseTitle}</span>
                                  <span className="course-credit">{course.credit} Cr</span>
                                </div>
                              </div>
                              <div className="course-item-actions">
                                {(() => {
                                  const courseCode = (course.courseCode || '').toLowerCase();
                                  const lastDigitMatch = courseCode.match(/(\d)(?:\s*)$/);
                                  const lastDigitNum = lastDigitMatch ? parseInt(lastDigitMatch[1]) : NaN;
                                  const isTheoryCourse = !isNaN(lastDigitNum) && lastDigitNum % 2 === 1;
                                  return (
                                <>
                                <button
                                  className="btn btn-sm btn-secondary"
                                  onClick={() => {
                                    setSelectedCourse(course);
                                    // Extract semester from courseGroupPath (e.g., "3-1" -> 1, "3-2" -> 2)
                                    const semesterMatch = courseGroupPath ? courseGroupPath.split('-')[1] : null;
                                    setShowOBEView(semesterMatch ? parseInt(semesterMatch) : true);
                                  }}
                                >
                                  <FontAwesomeIcon icon={faEye} /> View
                                </button>
                                {isTheoryCourse && <>
                                <button
                                  className="btn btn-sm btn-success"
                                  onClick={async () => {
                                    // Find teacher's section for this course
                                    const assignment = course.assignedTeachers?.find(at => {
                                      const teacherId = at.teacher?._id || at.teacher;
                                      const userIdToMatch = user.userId || user._id;
                                      return teacherId && teacherId.toString() === userIdToMatch;
                                    });
                                    const section = assignment?.section || null;
                                    
                                    // Fetch students
                                    try {
                                      setLoading(true);
                                      const response = await getCourseStudents(course._id, section);
                                      if (response.success && response.data.length > 0) {
                                        setCourseStudents(response.data);
                                        setMarkEntryCourse(course);
                                        setMarkEntrySection(section);
                                        setShowMarkEntry(true);
                                      } else {
                                        setError('No students enrolled in this course');
                                        setTimeout(() => setError(''), 3000);
                                      }
                                    } catch (err) {
                                      console.error('Error fetching students:', err);
                                      setError('Failed to fetch students');
                                      setTimeout(() => setError(''), 3000);
                                    } finally {
                                      setLoading(false);
                                    }
                                  }}
                                >
                                  <FontAwesomeIcon icon={faClipboardList} /> Enter Term Marks
                                </button>
                                <button
                                  className="btn btn-sm btn-success"
                                  onClick={() => {
                                    setCtMarksCourse(course);
                                    setShowCTMarksModal(true);
                                  }}
                                >
                                  <FontAwesomeIcon icon={faClipboardList} /> Enter CT Marks
                                </button>
                                <button
                                  className="btn btn-sm btn-info"
                                  onClick={() => {
                                    setAttendanceCourse(course);
                                    setShowAttendanceModal(true);
                                  }}
                                >
                                  <FontAwesomeIcon icon={faClipboardList} /> Attendance & Assignments
                                </button>
                                </>}
                                {!isTheoryCourse && (
                                  <button
                                    className="btn btn-sm btn-warning"
                                    onClick={() => {
                                      setLabMarksCourse(course);
                                      setShowLabMarksModal(true);
                                    }}
                                  >
                                    <FontAwesomeIcon icon={faClipboardList} /> Enter Lab Marks
                                  </button>
                                )}
                                <button
                                  className="btn btn-sm btn-primary"
                                  onClick={() => openEditProposal(course)}
                                >
                                  <FontAwesomeIcon icon={faEdit} /> Propose Edit
                                </button>
                                </>
                                  );
                                })()}
                              </div>
                            </div>
                            );
                          })}
                        </div>
                      );
                    })()
                  ) : null}
                </div>
              )}
            </div>
          </div>
        );

      case 'profile':
        const updateProfile = async () => {
          setError('');
          try {
            const payload = { ...profileForm };
            // Password change validation
            if (currentPassword || newPassword || confirmPassword) {
              if (!currentPassword || !newPassword || !confirmPassword) {
                setError('Please fill all password fields');
                setTimeout(() => setError(''), 4000);
                return;
              }
              if (newPassword !== confirmPassword) {
                setError('New password and confirm password do not match');
                setTimeout(() => setError(''), 4000);
                return;
              }
              payload.currentPassword = currentPassword;
              payload.newPassword = newPassword;
            }
            const response = await fetch(`${process.env.REACT_APP_API_URL || '/api'}/auth/profile/update`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
              },
              body: JSON.stringify(payload)
            });
            const data = await response.json();
            if (data.success) {
              setUser(data.data);
              localStorage.setItem('user', JSON.stringify(data.data));
              setSuccessMessage('Profile updated successfully');
              setTimeout(() => setSuccessMessage(''), 3000);
              setCurrentPassword('');
              setNewPassword('');
              setConfirmPassword('');
            } else {
              setError(data.message || 'Failed to update profile');
              setTimeout(() => setError(''), 4000);
            }
          } catch (err) {
            setError('Failed to update profile');
            setTimeout(() => setError(''), 4000);
          }
        };

        return (
          <div className="section-container">
            <div className="section-header">
              <h2>My Profile</h2>
              <p>Manage your account information</p>
            </div>
            <div className="section-body">
              {error && (
                <div className="alert alert-error">{error}</div>
              )}
              {successMessage && (
                <div className="alert alert-success">{successMessage}</div>
              )}
              <div className="profile-card">
                <div className="profile-view">
                  <div className="profile-images-section">
                    <div className="profile-image-wrapper">
                      <label>Profile Picture</label>
                      <div className="profile-picture-container">
                        {user.profilePicture ? (
                          <img src={user.profilePicture} alt="Profile" />
                        ) : (
                          user.name?.charAt(0).toUpperCase()
                        )}
                      </div>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = async () => {
                              try {
                                const response = await fetch(`${process.env.REACT_APP_API_URL || '/api'}/auth/profile/update`, {
                                  method: 'PUT',
                                  headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                                  },
                                  body: JSON.stringify({ profilePicture: reader.result })
                                });
                                const data = await response.json();
                                if (data.success) {
                                  setUser(data.data);
                                  localStorage.setItem('user', JSON.stringify(data.data));
                                }
                              } catch (err) {
                                console.error('Failed to update profile picture:', err);
                              }
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        style={{display: 'block', margin: '0 auto', fontSize: '12px'}}
                      />
                    </div>

                    <div className="profile-image-wrapper">
                      <label>Signature</label>
                      <div className="signature-container">
                        {user.signature ? (
                          <img src={user.signature} alt="Signature" />
                        ) : (
                          <span style={{color: '#ccc', fontSize: '12px'}}>Upload Signature</span>
                        )}
                      </div>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = async () => {
                              try {
                                const response = await fetch(`${process.env.REACT_APP_API_URL || '/api'}/auth/profile/update`, {
                                  method: 'PUT',
                                  headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                                  },
                                  body: JSON.stringify({ signature: reader.result })
                                });
                                const data = await response.json();
                                if (data.success) {
                                  setUser(data.data);
                                  localStorage.setItem('user', JSON.stringify(data.data));
                                }
                              } catch (err) {
                                console.error('Failed to update signature:', err);
                              }
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        style={{display: 'block', margin: '0 auto', fontSize: '12px'}}
                      />
                    </div>
                  </div>

                  <div className="profile-grid">
                    <div className="profile-field">
                      <label>Name</label>
                      <input type="text" className="readonly-field" value={profileForm.name} disabled readOnly />
                    </div>
                    <div className="profile-field">
                      <label>Email</label>
                      <input type="email" className="readonly-field" value={profileForm.email} disabled readOnly />
                    </div>
                    <div className="profile-field">
                      <label>Designation</label>
                      <input type="text" className="readonly-field" value={profileForm.designation || 'Lecturer'} disabled readOnly />
                    </div>
                  </div>

                  <div className="profile-grid">
                    <div className="profile-field">
                      <label>Phone</label>
                      <input type="tel" value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} />
                    </div>
                    <div className="profile-field">
                      <label>Address</label>
                      <input type="text" value={profileForm.address} onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })} />
                    </div>
                    <div className="profile-field">
                      <label>Blood Group</label>
                      <select value={profileForm.bloodGroup} onChange={(e) => setProfileForm({ ...profileForm, bloodGroup: e.target.value })}>
                        <option value="">Select Blood Group</option>
                        <option value="A+">A+</option>
                        <option value="A-">A-</option>
                        <option value="B+">B+</option>
                        <option value="B-">B-</option>
                        <option value="O+">O+</option>
                        <option value="O-">O-</option>
                        <option value="AB+">AB+</option>
                        <option value="AB-">AB-</option>
                      </select>
                    </div>
                    <div className="profile-field">
                      <label>Religion</label>
                      <select value={profileForm.religion} onChange={(e) => setProfileForm({ ...profileForm, religion: e.target.value })}>
                        <option value="">Select Religion</option>
                        <option value="Islam">Islam</option>
                        <option value="Hinduism">Hinduism</option>
                        <option value="Buddhism">Buddhism</option>
                        <option value="Christian">Christian</option>
                        <option value="Others">Others</option>
                      </select>
                    </div>
                  </div>

                  <div style={{marginBottom: '20px'}}>
                    <label style={{display: 'block', fontWeight: 700, color: '#2c3e50', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '12px'}}>Gender</label>
                    <div style={{display: 'flex', gap: '16px'}}>
                      <label style={{display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer'}}><input type="radio" name="gender" checked={profileForm.gender === 'male'} onChange={() => setProfileForm({ ...profileForm, gender: 'male' })} /> Male</label>
                      <label style={{display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer'}}><input type="radio" name="gender" checked={profileForm.gender === 'female'} onChange={() => setProfileForm({ ...profileForm, gender: 'female' })} /> Female</label>
                      <label style={{display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer'}}><input type="radio" name="gender" checked={profileForm.gender === 'others'} onChange={() => setProfileForm({ ...profileForm, gender: 'others' })} /> Others</label>
                    </div>
                  </div>

                  <div className="password-change-section">
                    <label>Change Password</label>
                    <div className="password-inputs">
                      <input type="password" placeholder="Current Password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
                      <input type="password" placeholder="New Password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                      <input type="password" placeholder="Confirm New Password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                    </div>
                  </div>

                  <div className="profile-actions" style={{display: 'flex', justifyContent: 'space-between', gap: '10px'}}>
                    <button className="btn btn-logout" onClick={handleLogout}>
                      <FontAwesomeIcon icon={faSignOutAlt} style={{marginRight: '8px'}} />
                      Logout
                    </button>
                    <button className="btn btn-primary" onClick={updateProfile}>Save Changes</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'attainment':
        return <AttainmentView labDataRefreshKey={labDataRefreshKey} />;

      default:
        return null;
    }
  };

  return (
    <div className="dashboard-layout">
      {/* Mobile hamburger button */}
      <button 
        className="mobile-menu-btn"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        title="Toggle menu"
      >
        {sidebarOpen ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" clipRule="evenodd" d="M5.29289 5.29289C5.68342 4.90237 6.31658 4.90237 6.70711 5.29289L12 10.5858L17.2929 5.29289C17.6834 4.90237 18.3166 4.90237 18.7071 5.29289C19.0976 5.68342 19.0976 6.31658 18.7071 6.70711L13.4142 12L18.7071 17.2929C19.0976 17.6834 19.0976 18.3166 18.7071 18.7071C18.3166 19.0976 17.6834 19.0976 17.2929 18.7071L12 13.4142L6.70711 18.7071C6.31658 19.0976 5.68342 19.0976 5.29289 18.7071C4.90237 18.3166 4.90237 17.6834 5.29289 17.2929L10.5858 12L5.29289 6.70711C4.90237 6.31658 4.90237 5.68342 5.29289 5.29289Z" fill="currentColor"/>
          </svg>
        ) : (
          <FontAwesomeIcon icon={faBook} />
        )}
      </button>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <div className="logo-section">
            <span className="logo-icon">
              <img src="/images/kuet-logo.png" alt="KUET Logo" className="logo-image" />
            </span>
            {sidebarOpen && <h1>Teacher Panel</h1>}
          </div>
          <button 
            className="sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {sidebarOpen ? '←' : '→'}
          </button>
        </div>
        <nav className="sidebar-nav">
          {/* Collapsible Proposals Section */}
          <div className="nav-group">
            <button
              className={`nav-item nav-group-header ${(activeSection === 'proposals' || activeSection === 'create-proposal') ? 'active' : ''}`}
              onClick={() => setProposalsOpen(!proposalsOpen)}
            >
              <span className="nav-icon"><FontAwesomeIcon icon={faClipboardList} /></span>
              {sidebarOpen && <span className="nav-label">Course Proposals</span>}
              {sidebarOpen && proposals.filter(p => p.status === 'PENDING').length > 0 && (
                <span className="badge-count">{proposals.filter(p => p.status === 'PENDING').length}</span>
              )}
              {sidebarOpen && (
                <span className="nav-chevron">
                  <FontAwesomeIcon icon={proposalsOpen ? faChevronDown : faChevronRight} />
                </span>
              )}
            </button>
            
            {proposalsOpen && (
              <div className="nav-submenu">
                <button
                  className={`nav-item nav-subitem ${activeSection === 'create-proposal' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveSection('create-proposal');
                    openCreateProposal();
                  }}
                >
                  <span className="nav-icon"><FontAwesomeIcon icon={faPlus} /></span>
                  {sidebarOpen && <span className="nav-label">Propose New Course</span>}
                </button>
                <button
                  className={`nav-item nav-subitem ${activeSection === 'proposals' ? 'active' : ''}`}
                  onClick={() => handleSectionChange('proposals')}
                >
                  <span className="nav-icon"><FontAwesomeIcon icon={faHourglass} /></span>
                  {sidebarOpen && <span className="nav-label">My Proposals</span>}
                  {sidebarOpen && proposals.filter(p => p.status === 'PENDING').length > 0 && (
                    <span className="badge-count">{proposals.filter(p => p.status === 'PENDING').length}</span>
                  )}
                </button>
              </div>
            )}
          </div>
          
          <button
            className={`nav-item ${activeSection === 'courses' ? 'active' : ''}`}
            onClick={() => handleSectionChange('courses')}
          >
            <span className="nav-icon"><FontAwesomeIcon icon={faBook} /></span>
            {sidebarOpen && <span className="nav-label">Browse Courses</span>}
          </button>
          
          <button
            className={`nav-item ${activeSection === 'attainment' ? 'active' : ''}`}
            onClick={() => handleSectionChange('attainment')}
          >
            <span className="nav-icon"><FontAwesomeIcon icon={faClipboardList} /></span>
            {sidebarOpen && <span className="nav-label">CO Attainment</span>}
          </button>
        </nav>
        <div className="sidebar-footer">
          {user && (
            <div 
              className="user-profile" 
              onClick={() => setActiveSection('profile')}
              style={{cursor: 'pointer'}}
              title="View Profile"
            >
              <div className="user-avatar-small" style={user.profilePicture ? {
                backgroundImage: `url(${user.profilePicture})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              } : {}}>
                {!user.profilePicture && user.name?.charAt(0).toUpperCase()}
              </div>
              {sidebarOpen && (
                <div className="user-details-small">
                  <p className="user-name">{user.name}</p>
                  <p className="user-role">{user.role}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>

      <main className="main-content">
        <div className="content-wrapper">
          {renderSection()}
        </div>
      </main>

      {showCourseForm && (
        <>
          <div className="change-description-wrapper">
            <button
              className="modal-close-button"
              onClick={() => {
                setShowCourseForm(false);
                setSelectedCourse(null);
                setChangeDescription('');
              }}
              aria-label="Close modal"
            >
              ×
            </button>
            <h3 className="proposal-modal-title">
              {proposalType === 'CREATE' ? 'Propose New Course' : 'Propose Course Edit'}
            </h3>
            <div className="change-description-section">
              <label htmlFor="changeDescription">
                Change Description *
              </label>
              <textarea
                id="changeDescription"
                value={changeDescription}
                onChange={(e) => setChangeDescription(e.target.value)}
                placeholder="Explain the reason for this proposal..."
                rows="3"
              />
            </div>
          </div>
          <div className="proposal-modal-wrapper">
            <CourseForm
              onSubmit={handleCreateProposal}
              onCancel={() => {
                setShowCourseForm(false);
                setSelectedCourse(null);
                setChangeDescription('');
              }}
              loading={courseFormLoading}
              initialData={proposalType === 'UPDATE' ? selectedCourse : null}
              isEditMode={proposalType === 'UPDATE'}
            />
          </div>
        </>
      )}

      {showOBEView && selectedCourse && (
        <CourseOBEView
          course={selectedCourse}
          viewingSemester={typeof showOBEView === 'number' ? showOBEView : null}
          onClose={() => {
            setShowOBEView(false);
            setSelectedCourse(null);
          }}
        />
      )}

      {showMarkEntry && markEntryCourse && courseStudents.length > 0 && (
        <MarkEntry
          course={markEntryCourse}
          students={courseStudents}
          section={markEntrySection}
          onClose={() => {
            setShowMarkEntry(false);
            setMarkEntryCourse(null);
            setMarkEntrySection(null);
            setCourseStudents([]);
          }}
        />
      )}

      {/* CT Marks Entry Modal */}
      {showCTMarksModal && ctMarksCourse && (
        <div className="modal-overlay" onClick={() => setShowCTMarksModal(false)}>
          <div className="modal-content" style={{ width: '95vw', maxWidth: '700px', maxHeight: '90vh', borderRadius: '10px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ padding: '20px 24px', position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#fff', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0 }}>Enter CT Marks - {ctMarksCourse.courseCode}</h3>
              <button className="close-btn" onClick={() => setShowCTMarksModal(false)}>
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>

            <div className="modal-body" style={{ padding: '24px', overflowY: 'auto', flex: '1 1 auto' }}>
              {ctSettingsLoading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>Loading existing settings...</div>
              ) : (
                <>
                  {/* Settings Section */}
                  <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: '#efe5ff', border: '1px solid #ddd6fe', borderRadius: '8px' }}>
                    <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: 700, color: '#374151' }}>CT Settings</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '14px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>CT Taken (0–3)</label>
                        <input
                          type="number" min={0} max={3}
                          value={ctSettings.ctTaken}
                          onChange={e => setCtSettings(prev => ({ ...prev, ctTaken: Math.max(0, Math.min(3, parseInt(e.target.value) || 0)) }))}
                          style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>CO Mapped CT marks out of 60</label>
                        <input
                          type="number" min={0} max={60}
                          value={ctSettings.coMappedMarks60}
                          onChange={e => setCtSettings(prev => ({ ...prev, coMappedMarks60: Math.max(0, Math.min(60, parseFloat(e.target.value) || 0)) }))}
                          style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Use Eq. Wt for each CT (0/1)</label>
                        <input
                          type="number" min={0} max={1} step={1}
                          value={ctSettings.useEqWt}
                          onChange={e => setCtSettings(prev => ({ ...prev, useEqWt: Math.max(0, Math.min(1, parseInt(e.target.value) || 0)) }))}
                          style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px' }}
                        />
                      </div>
                    </div>
                    <button
                      className="btn btn-primary"
                      disabled={ctSettingsSaving}
                      onClick={async () => {
                        setCtSettingsSaving(true);
                        try {
                          const existing = ctExistingData || {};
                          const fullData = {
                            ctRows: existing.ctRows || [],
                            ctFactors: existing.ctFactors || {},
                            ctManualWts: existing.ctManualWts || {},
                            ctEqWts: existing.ctEqWts || {},
                            ctSummary: ctSettings,
                            ctObtainedRows: existing.ctObtainedRows || [],
                          };
                          await saveCTData(ctMarksCourse._id, fullData);
                          setCtExistingData(prev => ({ ...(prev || {}), ...fullData }));
                          setSuccessMessage('CT settings saved');
                          setTimeout(() => setSuccessMessage(''), 3000);
                        } catch (err) {
                          console.error('Error saving CT settings:', err);
                          setError('Failed to save CT settings');
                          setTimeout(() => setError(''), 3000);
                        } finally {
                          setCtSettingsSaving(false);
                        }
                      }}
                      style={{ fontSize: '13px', padding: '8px 20px' }}
                    >
                      {ctSettingsSaving ? 'Saving...' : 'Save Settings'}
                    </button>
                  </div>

                  {/* CT Upload Section */}
                  {ctSettings.ctTaken > 0 && (
                    <div style={{ padding: '16px', border: '1px solid #cfe8d8', backgroundColor: '#eaf7ef', borderRadius: '8px' }}>
                      <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: 700, color: '#374151' }}>Upload CT Marks</h4>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '16px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Select CT</label>
                          <select
                            value={selectedCTUpload}
                            onChange={e => { setSelectedCTUpload(e.target.value); setCtUploadParsed(null); setCtUploadFile(null); setCtFileInputKey(k => k + 1); }}
                            style={{ padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px', minWidth: '100px' }}
                          >
                            {Array.from({ length: ctSettings.ctTaken }, (_, i) => (
                              <option key={i} value={`CT${i + 1}`}>CT{i + 1}</option>
                            ))}
                          </select>
                        </div>
                        <div style={{ flex: 1, minWidth: '200px' }}>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Upload Excel / CSV</label>
                          <input
                            key={ctFileInputKey}
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            onChange={e => { setCtUploadFile(e.target.files[0] || null); setCtUploadParsed(null); }}
                            style={{ fontSize: '13px' }}
                          />
                        </div>
                        <div style={{ alignSelf: 'flex-end' }}>
                          <button
                            className="btn btn-success"
                            disabled={!ctUploadFile || ctUploadLoading}
                            onClick={async () => {
                              if (!ctUploadFile) return;
                              setCtUploadLoading(true);
                              try {
                                const result = await parseCTUpload(ctMarksCourse._id, ctUploadFile, selectedCTUpload);
                                if (result.success) {
                                  setCtUploadParsed(result.data);
                                } else {
                                  setError(result.message || 'Failed to parse file');
                                  setTimeout(() => setError(''), 3000);
                                }
                              } catch (err) {
                                console.error('Error parsing CT file:', err);
                                setError(typeof err === 'string' ? err : 'Failed to parse file');
                                setTimeout(() => setError(''), 3000);
                              } finally {
                                setCtUploadLoading(false);
                              }
                            }}
                            style={{ fontSize: '13px', padding: '8px 16px', whiteSpace: 'nowrap' }}
                          >
                            {ctUploadLoading ? 'Parsing...' : 'Parse File'}
                          </button>
                        </div>
                      </div>

                      {/* File format hint */}
                      <div style={{ marginBottom: '12px', padding: '10px', backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '12px', color: '#6b7280' }}>
                        <strong>Expected file format:</strong><br />
                        Row 1: <code>Manual Wt</code> | &lt;value&gt;<br />
                        Row 2 (header): <code>Roll</code> | <code>Q1(&lt;total&gt;)</code> | <code>Q2(&lt;total&gt;)</code> | <code>Q3(&lt;total&gt;)</code><br />
                        Row 3+: roll number | Q1 marks | Q2 marks | Q3 marks
                      </div>

                      {/* Parsed preview */}
                      {ctUploadParsed && (
                        <div>
                          <div style={{ marginBottom: '10px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>
                              Preview: {selectedCTUpload} — Manual Wt: <strong>{ctUploadParsed.manualWt !== null ? ctUploadParsed.manualWt : '(unchanged)'}</strong> — {ctUploadParsed.rows.length} student(s)
                            </span>
                          </div>
                          <div style={{ overflowX: 'auto', maxHeight: '260px', overflowY: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                              <thead>
                                <tr style={{ backgroundColor: '#f3f4f6', position: 'sticky', top: 0 }}>
                                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, border: '1px solid #e5e7eb' }}>Roll</th>
                                  <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600, border: '1px solid #e5e7eb' }}>Q1({ctUploadParsed.q1Total}){ctUploadParsed.q1CO ? `(${ctUploadParsed.q1CO})` : ''}</th>
                                  <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600, border: '1px solid #e5e7eb' }}>Q2({ctUploadParsed.q2Total}){ctUploadParsed.q2CO ? `(${ctUploadParsed.q2CO})` : ''}</th>
                                  <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600, border: '1px solid #e5e7eb' }}>Q3({ctUploadParsed.q3Total}){ctUploadParsed.q3CO ? `(${ctUploadParsed.q3CO})` : ''}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {ctUploadParsed.rows.map((row, i) => (
                                  <tr key={i} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                                    <td style={{ padding: '7px 12px', border: '1px solid #e5e7eb' }}>{row.rollNumber}</td>
                                    {['q1', 'q2', 'q3'].map(q => {
                                      const isAbsent = row[q] === 'A' || row[q] === 'Absent';
                                      return (
                                        <td key={q} style={{ padding: '7px 12px', textAlign: 'center', border: '1px solid #e5e7eb', color: isAbsent ? '#ba1a1a' : undefined, fontStyle: isAbsent ? 'italic' : undefined }}>
                                          {isAbsent ? 'Absent' : row[q]}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="modal-footer" style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: '10px', backgroundColor: '#fff', borderTop: '1px solid #e5e7eb' }}>
              {error && <div className="alert alert-error" style={{ margin: 0 }}>{error}</div>}
              {successMessage && <div className="alert alert-success" style={{ margin: 0 }}>{successMessage}</div>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              {ctUploadParsed && (
                <button
                  className="btn btn-primary"
                  disabled={ctUploadSaving}
                  onClick={async () => {
                    setCtUploadSaving(true);
                    try {
                      const existing = ctExistingData || {};
                      const ctKey = selectedCTUpload;
                      // Build updated manual weights:
                      // - If the CSV included a "Manual Wt" row, use it.
                      // - Otherwise, if no weight is already stored, auto-set to the sum of Q totals
                      //   so the factor becomes 1.0 (student marks used at face value).
                      const newManualWts = { ...(existing.ctManualWts || {}) };
                      if (ctUploadParsed.manualWt !== null) {
                        newManualWts[ctKey] = ctUploadParsed.manualWt;
                      } else if (!newManualWts[ctKey]) {
                        const totalDist = (ctUploadParsed.q1Total || 0) + (ctUploadParsed.q2Total || 0) + (ctUploadParsed.q3Total || 0);
                        if (totalDist > 0) newManualWts[ctKey] = totalDist;
                      }
                      const q1Field = `${ctKey}_Q1`;
                      const q2Field = `${ctKey}_Q2`;
                      const q3Field = `${ctKey}_Q3`;
                      const parsedMap = {};
                      ctUploadParsed.rows.forEach(parsed => {
                        if (parsed.rollNumber && parsed.rollNumber.toLowerCase() !== 'roll') {
                          parsedMap[parsed.rollNumber] = parsed;
                        }
                      });
                      // Only update existing enrolled rows — never add rows from Excel
                      const existingObtained = (Array.isArray(existing.ctObtainedRows) ? existing.ctObtainedRows : [])
                        .filter(r => r.rollNumber && r.rollNumber.toLowerCase() !== 'roll')
                        .map(r => {
                          const match = parsedMap[String(r.rollNumber).trim()];
                          if (match) {
                            return {
                              ...r,
                              [q1Field]: match.q1 !== null ? Math.min(match.q1, ctUploadParsed.q1Total || Infinity) : (r[q1Field] ?? 0),
                              [q2Field]: match.q2 !== null ? Math.min(match.q2, ctUploadParsed.q2Total || Infinity) : (r[q2Field] ?? 0),
                              [q3Field]: match.q3 !== null ? Math.min(match.q3, ctUploadParsed.q3Total || Infinity) : (r[q3Field] ?? 0),
                            };
                          }
                          return r;
                        });
                      const enrolledRolls = new Set(existingObtained.map(r => String(r.rollNumber).trim()));
                      const unmatchedRolls = Object.keys(parsedMap).filter(r => !enrolledRolls.has(String(r).trim()));
                      // Build updated ctRows — update existing CO rows, or seed from parsed COs if none exist.
                      // A Q can only be assigned to ONE CO at a time, so if the new upload assigns a Q to a
                      // different CO than before, the old CO's value for that Q must be cleared to 0.
                      const applyParsedToCORow = (newRow, coNumber) => {
                        if (ctUploadParsed.hasQ1 && ctUploadParsed.q1CO != null)
                          newRow[q1Field] = ctUploadParsed.q1CO === coNumber ? ctUploadParsed.q1Total : 0;
                        if (ctUploadParsed.hasQ2 && ctUploadParsed.q2CO != null)
                          newRow[q2Field] = ctUploadParsed.q2CO === coNumber ? ctUploadParsed.q2Total : 0;
                        if (ctUploadParsed.hasQ3 && ctUploadParsed.q3CO != null)
                          newRow[q3Field] = ctUploadParsed.q3CO === coNumber ? ctUploadParsed.q3Total : 0;
                        return newRow;
                      };
                      let updatedCtRows;
                      if ((existing.ctRows || []).length === 0) {
                        // No existing CO rows — build from the COs mentioned in the Excel file
                        const parsedCOs = [...new Set([
                          ctUploadParsed.hasQ1 && ctUploadParsed.q1CO ? ctUploadParsed.q1CO : null,
                          ctUploadParsed.hasQ2 && ctUploadParsed.q2CO ? ctUploadParsed.q2CO : null,
                          ctUploadParsed.hasQ3 && ctUploadParsed.q3CO ? ctUploadParsed.q3CO : null,
                        ].filter(Boolean))];
                        updatedCtRows = parsedCOs.map(coNumber => applyParsedToCORow({ coNumber }, coNumber));
                      } else {
                        const coSet = new Set((existing.ctRows || []).map(r => r.coNumber).filter(Boolean));
                        // Also include any COs from the current upload that don't yet have a row —
                        // e.g. CT1 was uploaded for CO1 and now CT2 is uploaded for CO2.
                        [
                          ctUploadParsed.hasQ1 && ctUploadParsed.q1CO ? ctUploadParsed.q1CO : null,
                          ctUploadParsed.hasQ2 && ctUploadParsed.q2CO ? ctUploadParsed.q2CO : null,
                          ctUploadParsed.hasQ3 && ctUploadParsed.q3CO ? ctUploadParsed.q3CO : null,
                        ].filter(Boolean).forEach(co => coSet.add(co));
                        updatedCtRows = [...coSet].map(coNumber => {
                          const existingRow = (existing.ctRows || []).find(r => r.coNumber === coNumber) || { coNumber };
                          return applyParsedToCORow({ ...existingRow }, coNumber);
                        });
                      }
                      // Auto-update ctTaken to at least the index of the CT being uploaded,
                      // so COAttainment can include the newly uploaded data.
                      const ctIndex = { CT1: 1, CT2: 2, CT3: 3 }[ctKey] || 1;
                      const baseSummary = existing.ctSummary || ctSettings;
                      const updatedCtSummary = {
                        ...baseSummary,
                        ctTaken: Math.max(baseSummary.ctTaken || 0, ctIndex),
                      };
                      const fullData = {
                        ctRows: updatedCtRows,
                        ctFactors: existing.ctFactors || {},
                        ctManualWts: newManualWts,
                        ctEqWts: existing.ctEqWts || {},
                        ctSummary: updatedCtSummary,
                        ctObtainedRows: existingObtained,
                      };
                      await saveCTData(ctMarksCourse._id, fullData);
                      setCtExistingData(prev => ({ ...(prev || {}), ...fullData }));
                      const msg = unmatchedRolls.length > 0
                        ? `${ctKey} marks saved. ${unmatchedRolls.length} roll(s) in Excel not found in enrolled list: ${unmatchedRolls.join(', ')}`
                        : `${ctKey} marks saved successfully`;
                      setSuccessMessage(msg);
                      setTimeout(() => setSuccessMessage(''), unmatchedRolls.length > 0 ? 8000 : 3000);
                      setCtUploadParsed(null);
                      setCtUploadFile(null);
                      setCtFileInputKey(k => k + 1);
                    } catch (err) {
                      console.error('Error saving CT upload:', err);
                      const errMsg = err && (err.error || err.message || (typeof err === 'string' ? err : null));
                      setError(errMsg || 'Failed to save CT data');
                      setTimeout(() => setError(''), 5000);
                    } finally {
                      setCtUploadSaving(false);
                    }
                  }}
                  style={{ fontSize: '13px', padding: '8px 20px' }}
                >
                  {ctUploadSaving ? 'Saving...' : `Save ${selectedCTUpload} Data`}
                </button>
              )}
              <button className="btn btn-outline" onClick={() => setShowCTMarksModal(false)} style={{ width: '100px' }}>
                Close
              </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Lab Marks Modal */}
      {showLabMarksModal && labMarksCourse && (
        <div className="modal-overlay" onClick={() => setShowLabMarksModal(false)}>
          <div className="modal-content" style={{ width: '95vw', maxWidth: '720px', maxHeight: '90vh', borderRadius: '10px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ padding: '20px 24px', position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#fff', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0 }}>Enter Lab Marks - {labMarksCourse.courseCode}</h3>
              <button className="close-btn" onClick={() => setShowLabMarksModal(false)}>
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>

            <div className="modal-body" style={{ padding: '24px', overflowY: 'auto', flex: '1 1 auto' }}>
              {error && <div className="alert alert-error" style={{ marginBottom: '12px' }}>{error}</div>}
              {successMessage && <div className="alert alert-success" style={{ marginBottom: '12px' }}>{successMessage}</div>}
              {labSettingsLoading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>Loading existing lab data...</div>
              ) : (
                <>
                  {/* Lab Settings Section */}
                  <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: '#efe5ff', border: '1px solid #ddd6fe', borderRadius: '8px' }}>
                    <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: 700, color: '#374151' }}>Lab Activity Settings</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '14px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Activity Taken (1–5)</label>
                        <input
                          type="number" min={1}
                          value={labSettings.activityTaken}
                          onChange={e => {
                            const raw = parseInt(e.target.value);
                            if (!isNaN(raw) && raw >= 1) {
                              setLabSettings(prev => ({ ...prev, activityTaken: raw }));
                              setSelectedActivityUpload(`Activity1`);
                            }
                          }}
                          style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Other Activity Remaining Marks /50</label>
                        <input
                          type="number" min={0} max={50}
                          value={labSettings.otherActivityRemaining}
                          onChange={e => setLabSettings(prev => ({ ...prev, otherActivityRemaining: Math.max(0, Math.min(50, parseFloat(e.target.value) || 0)) }))}
                          style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Other Activity Measured In</label>
                        <input
                          type="number" min={0}
                          value={labSettings.otherActivityMeasured}
                          onChange={e => setLabSettings(prev => ({ ...prev, otherActivityMeasured: Math.max(0, parseFloat(e.target.value) || 0) }))}
                          style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>CO Mapped Activity Marks out of 50</label>
                        <input
                          type="number" min={0} max={50}
                          value={labSettings.coMappedActivityMarks}
                          onChange={e => setLabSettings(prev => ({ ...prev, coMappedActivityMarks: Math.max(0, Math.min(50, parseFloat(e.target.value) || 0)) }))}
                          style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Use Eq. Wt for each Activity (0/1)</label>
                        <input
                          type="number" min={0} max={1} step={1}
                          value={labSettings.useEqWtActivity}
                          onChange={e => setLabSettings(prev => ({ ...prev, useEqWtActivity: Math.max(0, Math.min(1, parseInt(e.target.value) || 0)) }))}
                          style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Attn. Marks (0–50)</label>
                        <input
                          type="number" min={0} max={50}
                          value={labSettings.attnMarks}
                          onChange={e => setLabSettings(prev => ({ ...prev, attnMarks: Math.max(0, Math.min(50, parseFloat(e.target.value) || 0)) }))}
                          style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Quiz Marks (0–50)</label>
                        <input
                          type="number" min={0} max={50}
                          value={labSettings.quizMarks}
                          onChange={e => setLabSettings(prev => ({ ...prev, quizMarks: Math.max(0, Math.min(50, parseFloat(e.target.value) || 0)) }))}
                          style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>C. Viva Marks (0–50)</label>
                        <input
                          type="number" min={0} max={50}
                          value={labSettings.vivaMarks}
                          onChange={e => setLabSettings(prev => ({ ...prev, vivaMarks: Math.max(0, Math.min(50, parseFloat(e.target.value) || 0)) }))}
                          style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px' }}
                        />
                      </div>
                    </div>
                    <button
                      className="btn btn-primary"
                      disabled={labSettingsSaving}
                      onClick={async () => {
                        setLabSettingsSaving(true);
                        try {
                          const existing = labExistingData || {};
                          const fullData = {
                            labActivityRows: existing.labActivityRows || [],
                            labActivityFactors: existing.labActivityFactors || {},
                            labActivityEqWts: existing.labActivityEqWts || {},
                            labActivityManualWts: existing.labActivityManualWts || {},
                            labAttendanceMarks: labSettings.attnMarks,
                            labQuizMarks: labSettings.quizMarks,
                            labVivaMarks: labSettings.vivaMarks,
                            activityTaken: labSettings.activityTaken,
                            otherActivityRemaining: labSettings.otherActivityRemaining,
                            otherActivityMeasured: labSettings.otherActivityMeasured,
                            coMappedActivityMarks: labSettings.coMappedActivityMarks,
                            useEqWtActivity: labSettings.useEqWtActivity,
                            labActivityObtainedRows: existing.labActivityObtainedRows || [],
                          };
                          await saveLabActivityData(labMarksCourse._id, fullData);
                          setLabExistingData(prev => ({ ...(prev || {}), ...fullData }));
                          setLabDataRefreshKey(k => k + 1);
                          setSuccessMessage('Lab settings saved');
                          setTimeout(() => setSuccessMessage(''), 3000);
                        } catch (err) {
                          console.error('Error saving lab settings:', err);
                          setError('Failed to save lab settings');
                          setTimeout(() => setError(''), 3000);
                        } finally {
                          setLabSettingsSaving(false);
                        }
                      }}
                      style={{ fontSize: '13px', padding: '8px 20px' }}
                    >
                      {labSettingsSaving ? 'Saving...' : 'Save Settings'}
                    </button>
                  </div>

                  {/* Lab Activity Upload Section */}
                  <div style={{ padding: '16px', border: '1px solid #cfe8d8', backgroundColor: '#eaf7ef', borderRadius: '8px' }}>
                    <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: 700, color: '#374151' }}>Upload Activity Marks</h4>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '16px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Select Activity</label>
                        <select
                          value={selectedActivityUpload}
                          onChange={e => { setSelectedActivityUpload(e.target.value); setLabUploadParsed(null); setLabUploadFile(null); }}
                          style={{ padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px', minWidth: '120px' }}
                        >
                          {Array.from({ length: labSettings.activityTaken }, (_, i) => (
                            <option key={i} value={`Activity${i + 1}`}>Activity{i + 1}</option>
                          ))}
                        </select>
                      </div>
                      <div style={{ flex: 1, minWidth: '200px' }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Upload Excel / CSV</label>
                        <input
                          key={labFileInputKey}
                          type="file"
                          accept=".xlsx,.xls,.csv"
                          onChange={e => { setLabUploadFile(e.target.files[0] || null); setLabUploadParsed(null); }}
                          style={{ fontSize: '13px' }}
                        />
                      </div>
                      <div style={{ alignSelf: 'flex-end' }}>
                        <button
                          className="btn btn-success"
                          disabled={!labUploadFile || labUploadLoading}
                          onClick={async () => {
                            if (!labUploadFile) return;
                            setLabUploadLoading(true);
                            try {
                              const result = await parseLabUpload(labMarksCourse._id, labUploadFile, selectedActivityUpload);
                              if (result.success) {
                                setLabUploadParsed(result.data);
                              } else {
                                setError(result.message || 'Failed to parse file');
                                setTimeout(() => setError(''), 3000);
                              }
                            } catch (err) {
                              console.error('Error parsing lab file:', err);
                              setError(typeof err === 'string' ? err : 'Failed to parse file');
                              setTimeout(() => setError(''), 3000);
                            } finally {
                              setLabUploadLoading(false);
                            }
                          }}
                          style={{ fontSize: '13px', padding: '8px 16px', whiteSpace: 'nowrap' }}
                        >
                          {labUploadLoading ? 'Parsing...' : 'Parse File'}
                        </button>
                      </div>
                    </div>

                    {/* File format hint */}
                    <div style={{ marginBottom: '12px', padding: '10px', backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '12px', color: '#6b7280' }}>
                      <strong>Expected file format:</strong><br />
                      Row 1: <code>Manual Wt</code> | &lt;value&gt;<br />
                      Row 2 (header): <code>Roll</code> | <em>[optional]</em> <code>Attn.</code> | <code>Quiz</code> | <code>C. Viva</code> | <code>Q1(&lt;total&gt;)(&lt;CO&gt;)</code> | <code>Q2(&lt;total&gt;)(&lt;CO&gt;)</code> | <code>Q3(&lt;total&gt;)(&lt;CO&gt;)</code> | <em>[optional]</em> <code>Other</code><br />
                      Row 3+: roll | attn (optional) | quiz (optional) | viva (optional) | Q1 | Q2 | Q3 marks | other measured (optional)
                    </div>

                    {/* Parsed preview */}
                    {labUploadParsed && (
                      <div>
                        <div style={{ marginBottom: '10px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>
                            Preview: {selectedActivityUpload} — Manual Wt: <strong>{labUploadParsed.manualWt !== null ? labUploadParsed.manualWt : '(unchanged)'}</strong> — {labUploadParsed.rows.length} student(s)
                          </span>
                        </div>
                        <div style={{ overflowX: 'auto', maxHeight: '260px', overflowY: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                            <thead>
                              <tr style={{ backgroundColor: '#f3f4f6', position: 'sticky', top: 0 }}>
                                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, border: '1px solid #e5e7eb' }}>Roll</th>
                                {labUploadParsed.hasAttn && <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600, border: '1px solid #e5e7eb' }}>Attn.</th>}
                                {labUploadParsed.hasQuiz && <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600, border: '1px solid #e5e7eb' }}>Quiz</th>}
                                {labUploadParsed.hasViva && <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600, border: '1px solid #e5e7eb' }}>C. Viva</th>}
                                <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600, border: '1px solid #e5e7eb' }}>Q1({labUploadParsed.q1Total}){labUploadParsed.q1CO ? `(${labUploadParsed.q1CO})` : ''}</th>
                                <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600, border: '1px solid #e5e7eb' }}>Q2({labUploadParsed.q2Total}){labUploadParsed.q2CO ? `(${labUploadParsed.q2CO})` : ''}</th>
                                <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600, border: '1px solid #e5e7eb' }}>Q3({labUploadParsed.q3Total}){labUploadParsed.q3CO ? `(${labUploadParsed.q3CO})` : ''}</th>
                                {labUploadParsed.hasOther && <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600, border: '1px solid #e5e7eb' }}>Other</th>}
                              </tr>
                            </thead>
                            <tbody>
                              {labUploadParsed.rows.map((row, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                                  <td style={{ padding: '7px 12px', border: '1px solid #e5e7eb' }}>{row.rollNumber}</td>
                                  {[
                                    ...(labUploadParsed.hasAttn ? ['attn'] : []),
                                    ...(labUploadParsed.hasQuiz ? ['quiz'] : []),
                                    ...(labUploadParsed.hasViva ? ['viva'] : []),
                                    'q1', 'q2', 'q3',
                                    ...(labUploadParsed.hasOther ? ['other'] : []),
                                  ].map(f => {
                                    const isAbsent = row[f] === 'A' || row[f] === 'Absent';
                                    return (
                                      <td key={f} style={{ padding: '7px 12px', textAlign: 'center', border: '1px solid #e5e7eb', color: isAbsent ? '#ba1a1a' : undefined, fontStyle: isAbsent ? 'italic' : undefined }}>
                                        {isAbsent ? 'Absent' : row[f]}
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="modal-footer" style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: '10px', backgroundColor: '#fff', borderTop: '1px solid #e5e7eb' }}>
              {error && <div className="alert alert-error" style={{ margin: 0 }}>{error}</div>}
              {successMessage && <div className="alert alert-success" style={{ margin: 0 }}>{successMessage}</div>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              {labUploadParsed && (
                <button
                  className="btn btn-primary"
                  disabled={labUploadSaving}
                  onClick={async () => {
                    setLabUploadSaving(true);
                    try {
                      const existing = labExistingData || {};
                      const actKey = selectedActivityUpload;
                      const newManualWts = { ...(existing.labActivityManualWts || {}), ...(labUploadParsed.manualWt !== null ? { [actKey.charAt(0).toLowerCase() + actKey.slice(1)]: labUploadParsed.manualWt } : {}) };
                      const q1Field = `${actKey}_Q1`;
                      const q2Field = `${actKey}_Q2`;
                      const q3Field = `${actKey}_Q3`;

                      // Build parsedMap keyed by trimmed roll so later matching is reliable
                      const parsedMap = {};
                      labUploadParsed.rows.forEach(parsed => {
                        if (parsed.rollNumber && parsed.rollNumber.toLowerCase() !== 'roll') {
                          parsedMap[String(parsed.rollNumber).trim()] = parsed;
                        }
                      });

                      if (Object.keys(parsedMap).length === 0 && labUploadParsed.rows.length === 0) {
                        // Parse returned no student rows — warn user and abort save
                        setError('No student rows found. Ensure the file has a "Roll" header in column A (row 2 after the Manual Wt row).');
                        setTimeout(() => setError(''), 6000);
                        return;
                      }

                      // Seed enrolled batch students into base list so Excel marks can be applied
                      // even when no rows have been saved yet (mirrors mergeWithEnrolled in AttainmentView)
                      const rawObtained = (Array.isArray(existing.labActivityObtainedRows) ? existing.labActivityObtainedRows : [])
                        .filter(r => r.rollNumber && r.rollNumber.toLowerCase() !== 'roll');

                      let baseObtained = rawObtained;
                      try {
                        const stuResp = await getCourseStudents(labMarksCourse._id);
                        if (stuResp.success && Array.isArray(stuResp.data) && stuResp.data.length > 0) {
                          const enrolled = stuResp.data
                            .map(s => ({ rollNumber: String(s.roll || s.rollNumber || '').trim(), name: s.name || '' }))
                            .filter(s => s.rollNumber);
                          if (enrolled.length > 0) {
                            const savedMap = {};
                            rawObtained.forEach(r => { savedMap[String(r.rollNumber).trim()] = r; });
                            baseObtained = enrolled.map(s => savedMap[s.rollNumber] || {
                              rollNumber: s.rollNumber, name: s.name,
                              attn: 0, quiz: 0, viva: 0,
                              Activity1_Q1: 0, Activity1_Q2: 0, Activity1_Q3: 0,
                              Activity2_Q1: 0, Activity2_Q2: 0, Activity2_Q3: 0,
                              Activity3_Q1: 0, Activity3_Q2: 0, Activity3_Q3: 0,
                              Activity4_Q1: 0, Activity4_Q2: 0, Activity4_Q3: 0,
                              Activity5_Q1: 0, Activity5_Q2: 0, Activity5_Q3: 0,
                              otherMeasured: 0, other: 0,
                            });
                          }
                        }
                      } catch (e) { /* use rawObtained as-is */ }

                      // Helper to apply Excel marks to a single student row
                      const applyParsedMarks = (r, match) => ({
                        ...r,
                        attn: match.attn !== null ? Math.min(match.attn, labSettings.attnMarks || Infinity) : (r.attn ?? 0),
                        quiz: match.quiz !== null ? Math.min(match.quiz, labSettings.quizMarks || Infinity) : (r.quiz ?? 0),
                        viva: match.viva !== null ? Math.min(match.viva, labSettings.vivaMarks || Infinity) : (r.viva ?? 0),
                        [q1Field]: match.q1 !== null ? Math.min(match.q1, labUploadParsed.q1Total || Infinity) : (r[q1Field] ?? 0),
                        [q2Field]: match.q2 !== null ? Math.min(match.q2, labUploadParsed.q2Total || Infinity) : (r[q2Field] ?? 0),
                        [q3Field]: match.q3 !== null ? Math.min(match.q3, labUploadParsed.q3Total || Infinity) : (r[q3Field] ?? 0),
                        ...(labUploadParsed.hasOther && match.other !== null ? { otherMeasured: match.other } : {}),
                      });

                      // Update only existing enrolled rows — never add rows from Excel.
                      const existingObtained = Object.keys(parsedMap).length === 0
                        ? baseObtained
                        : baseObtained.map(r => {
                            const match = parsedMap[String(r.rollNumber).trim()];
                            return match ? applyParsedMarks(r, match) : r;
                          });

                      const enrolledRolls = new Set(baseObtained.map(r => String(r.rollNumber).trim()));
                      const unmatchedRolls = Object.keys(parsedMap).filter(r => !enrolledRolls.has(String(r).trim()));

                      // Build CO row base from existing rows; seed from course profile if empty
                      let baseLabRows = existing.labActivityRows || [];
                      if (baseLabRows.length === 0) {
                        try {
                          const profileResp = await getCourseProfile(labMarksCourse.courseCode);
                          if (profileResp.success && Array.isArray(profileResp.data) && profileResp.data.length > 0) {
                            baseLabRows = profileResp.data.map(clo => ({
                              coNumber: (clo.cloNumber || '').toString().replace('CLO', 'CO'),
                              attn: 0, quiz: 0, viva: 0,
                              Activity1_Q1: 0, Activity1_Q2: 0, Activity1_Q3: 0,
                              Activity2_Q1: 0, Activity2_Q2: 0, Activity2_Q3: 0,
                              Activity3_Q1: 0, Activity3_Q2: 0, Activity3_Q3: 0,
                              Activity4_Q1: 0, Activity4_Q2: 0, Activity4_Q3: 0,
                              Activity5_Q1: 0, Activity5_Q2: 0, Activity5_Q3: 0,
                              measuredTotal: 0, coTotal: 0,
                            }));
                          }
                        } catch (e) { /* leave baseLabRows empty */ }
                      }

                      // Update labActivityRows CO mapping
                      const coSet = new Set(baseLabRows.map(r => r.coNumber).filter(Boolean));

                      const updatedLabRows = [...coSet].map(coNumber => {
                        const existingRow = baseLabRows.find(r => r.coNumber === coNumber) || { coNumber };
                        const newRow = { ...existingRow };
                        if (labUploadParsed.hasQ1 && labUploadParsed.q1CO != null) {
                          newRow[q1Field] = labUploadParsed.q1CO === coNumber ? labUploadParsed.q1Total : 0;
                        }
                        if (labUploadParsed.hasQ2 && labUploadParsed.q2CO != null) {
                          newRow[q2Field] = labUploadParsed.q2CO === coNumber ? labUploadParsed.q2Total : 0;
                        }
                        if (labUploadParsed.hasQ3 && labUploadParsed.q3CO != null) {
                          newRow[q3Field] = labUploadParsed.q3CO === coNumber ? labUploadParsed.q3Total : 0;
                        }
                        return newRow;
                      });

                      // Auto-fill allocated mark settings from Excel headers when they're not configured
                      const fullData = {
                        labActivityRows: updatedLabRows,
                        labActivityFactors: existing.labActivityFactors || {},
                        labActivityManualWts: newManualWts,
                        labActivityEqWts: existing.labActivityEqWts || {},
                        labAttendanceMarks: labSettings.attnMarks || labUploadParsed.attnTotal || 0,
                        labQuizMarks: labSettings.quizMarks || labUploadParsed.quizTotal || 0,
                        labVivaMarks: labSettings.vivaMarks || labUploadParsed.vivaTotal || 0,
                        activityTaken: labSettings.activityTaken,
                        otherActivityRemaining: labSettings.otherActivityRemaining,
                        otherActivityMeasured: labSettings.otherActivityMeasured || labUploadParsed.otherTotal || 0,
                        coMappedActivityMarks: labSettings.coMappedActivityMarks,
                        useEqWtActivity: labSettings.useEqWtActivity,
                        labActivityObtainedRows: existingObtained,
                      };

                      await saveLabActivityData(labMarksCourse._id, fullData);
                      setLabExistingData(prev => ({ ...(prev || {}), ...fullData }));
                      setLabDataRefreshKey(k => k + 1);
                      const msg = unmatchedRolls.length > 0
                        ? `${actKey} marks saved. ${unmatchedRolls.length} roll(s) in Excel not found in enrolled list: ${unmatchedRolls.join(', ')}`
                        : `${actKey} marks saved successfully`;
                      setSuccessMessage(msg);
                      setTimeout(() => setSuccessMessage(''), unmatchedRolls.length > 0 ? 8000 : 3000);
                      setLabUploadParsed(null);
                      setLabUploadFile(null);
                      setLabFileInputKey(k => k + 1);
                    } catch (err) {
                      console.error('Error saving lab upload:', err);
                      const errMsg = err && (err.error || err.message || (typeof err === 'string' ? err : null));
                      setError(errMsg || 'Failed to save lab data');
                      setTimeout(() => setError(''), 5000);
                    } finally {
                      setLabUploadSaving(false);
                    }
                  }}
                  style={{ fontSize: '13px', padding: '8px 20px' }}
                >
                  {labUploadSaving ? 'Saving...' : `Save ${selectedActivityUpload} Data`}
                </button>
              )}
              <button className="btn btn-outline" onClick={() => setShowLabMarksModal(false)} style={{ width: '100px' }}>
                Close
              </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Attendance & Assignment Marks Modal */}
      {showAttendanceModal && attendanceCourse && (
        <div className="modal-overlay" onClick={() => setShowAttendanceModal(false)}>
          <div className="modal-content" style={{ width: '95vw', maxWidth: '720px', maxHeight: '90vh', borderRadius: '10px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ padding: '20px 24px', position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#fff', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0 }}>Attendance & Assignments - {attendanceCourse.courseCode}</h3>
              <button className="close-btn" onClick={() => setShowAttendanceModal(false)}>
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>

            <div className="modal-body" style={{ padding: '24px', overflowY: 'auto', flex: '1 1 auto' }}>
              {assignSettingsLoading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>Loading existing assignment data...</div>
              ) : (
                <>
                  {/* Assignment Settings Section */}
                  <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: '#fff8ea', border: '1px solid #f4dfb3', borderRadius: '8px' }}>
                    <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: 700, color: '#374151' }}>Assignment &amp; Attendance Settings</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '14px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Assign. Taken (1–3)</label>
                        <input
                          type="number" min={1} max={3}
                          value={assignSettings.assignTaken}
                          onChange={e => {
                            const v = Math.max(1, Math.min(3, parseInt(e.target.value) || 1));
                            setAssignSettings(prev => ({ ...prev, assignTaken: v }));
                            setSelectedAssignUpload('Assgn1');
                          }}
                          style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Assignment Marks out of 30</label>
                        <input
                          type="number" min={0} max={30}
                          value={assignSettings.assignmentMarks30}
                          onChange={e => setAssignSettings(prev => ({ ...prev, assignmentMarks30: Math.max(0, Math.min(30, parseFloat(e.target.value) || 0)) }))}
                          style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Use Eq. Wt (0/1)</label>
                        <input
                          type="number" min={0} max={1} step={1}
                          value={assignSettings.useEqWt}
                          onChange={e => setAssignSettings(prev => ({ ...prev, useEqWt: Math.max(0, Math.min(1, parseInt(e.target.value) || 0)) }))}
                          style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Attendance Performance (0–30)</label>
                        <input
                          type="number" min={0} max={30}
                          value={assignSettings.attendancePerformance}
                          onChange={e => setAssignSettings(prev => ({ ...prev, attendancePerformance: Math.max(0, Math.min(30, parseFloat(e.target.value) || 0)) }))}
                          style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px' }}
                        />
                      </div>
                    </div>
                    <button
                      className="btn btn-primary"
                      disabled={assignSettingsSaving}
                      onClick={async () => {
                        setAssignSettingsSaving(true);
                        try {
                          const existing = assignExistingData || {};
                          const fullData = {
                            assignmentRows: existing.assignmentRows || [],
                            assignmentManualWts: existing.assignmentManualWts || {},
                            assignmentSummary: {
                              assignTaken: assignSettings.assignTaken,
                              assignmentMarks30: assignSettings.assignmentMarks30,
                              useEqWt: assignSettings.useEqWt,
                              attendancePerformance: assignSettings.attendancePerformance,
                            },
                            attendanceMarks: existing.attendanceMarks || 0,
                            attnAssignObtainedRows: existing.attnAssignObtainedRows || [],
                          };
                          await saveAssignmentData(attendanceCourse._id, fullData);
                          setAssignExistingData(prev => ({ ...(prev || {}), ...fullData }));
                          setSuccessMessage('Assignment settings saved');
                          setTimeout(() => setSuccessMessage(''), 3000);
                        } catch (err) {
                          console.error('Error saving assignment settings:', err);
                          setError('Failed to save assignment settings');
                          setTimeout(() => setError(''), 3000);
                        } finally {
                          setAssignSettingsSaving(false);
                        }
                      }}
                      style={{ fontSize: '13px', padding: '8px 20px' }}
                    >
                      {assignSettingsSaving ? 'Saving...' : 'Save Settings'}
                    </button>
                  </div>

                  {/* Assignment Upload Section */}
                  {assignSettings.assignTaken > 0 && <div style={{ padding: '16px', border: '1px solid #cfe8d8', backgroundColor: '#eaf7ef', borderRadius: '8px' }}>
                    <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: 700, color: '#374151' }}>Upload Assignment Marks</h4>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '16px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Select Assignment</label>
                        <select
                          value={selectedAssignUpload}
                          onChange={e => { setSelectedAssignUpload(e.target.value); setAssignUploadParsed(null); setAssignUploadFile(null); setAssignFileInputKey(k => k + 1); }}
                          style={{ padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px', minWidth: '120px' }}
                        >
                          {Array.from({ length: assignSettings.assignTaken }, (_, i) => (
                            <option key={i} value={`Assgn${i + 1}`}>Assgn{i + 1}</option>
                          ))}
                        </select>
                      </div>
                      <div style={{ flex: 1, minWidth: '200px' }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Upload Excel / CSV</label>
                        <input
                          key={assignFileInputKey}
                          type="file"
                          accept=".xlsx,.xls,.csv"
                          onChange={e => { setAssignUploadFile(e.target.files[0] || null); setAssignUploadParsed(null); }}
                          style={{ fontSize: '13px' }}
                        />
                      </div>
                      <div style={{ alignSelf: 'flex-end' }}>
                        <button
                          className="btn btn-success"
                          disabled={!assignUploadFile || assignUploadLoading}
                          onClick={async () => {
                            if (!assignUploadFile) return;
                            setAssignUploadLoading(true);
                            try {
                              const result = await parseAssignUpload(attendanceCourse._id, assignUploadFile, selectedAssignUpload);
                              if (result.success) {
                                setAssignUploadParsed(result.data);
                              } else {
                                setError(result.message || 'Failed to parse file');
                                setTimeout(() => setError(''), 3000);
                              }
                            } catch (err) {
                              console.error('Error parsing assignment file:', err);
                              setError(typeof err === 'string' ? err : 'Failed to parse file');
                              setTimeout(() => setError(''), 3000);
                            } finally {
                              setAssignUploadLoading(false);
                            }
                          }}
                          style={{ fontSize: '13px', padding: '8px 16px', whiteSpace: 'nowrap' }}
                        >
                          {assignUploadLoading ? 'Parsing...' : 'Parse File'}
                        </button>
                      </div>
                    </div>

                    {/* File format hint */}
                    <div style={{ marginBottom: '12px', padding: '10px', backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '12px', color: '#6b7280' }}>
                      <strong>Expected file format:</strong><br />
                      Row 1: <code>Manual Wt</code> | &lt;value&gt;<br />
                      Row 2 (header): <code>Roll</code> | <em>[optional]</em> <code>Attn. Perf.</code> | <code>Q1(&lt;total&gt;)(&lt;CO&gt;)</code> | <code>Q2(&lt;total&gt;)(&lt;CO&gt;)</code> | <code>Q3(&lt;total&gt;)(&lt;CO&gt;)</code><br />
                      Row 3+: roll | attn perf (optional) | Q1 | Q2 | Q3 marks
                    </div>

                    {/* Parsed preview */}
                    {assignUploadParsed && (
                      <div>
                        <div style={{ marginBottom: '10px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>
                            Preview: {selectedAssignUpload} — Manual Wt: <strong>{assignUploadParsed.manualWt !== null ? assignUploadParsed.manualWt : '(unchanged)'}</strong> — {assignUploadParsed.rows.length} student(s)
                          </span>
                        </div>
                        <div style={{ overflowX: 'auto', maxHeight: '260px', overflowY: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                            <thead>
                              <tr style={{ backgroundColor: '#f3f4f6', position: 'sticky', top: 0 }}>
                                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, border: '1px solid #e5e7eb' }}>Roll</th>
                                {assignUploadParsed.hasAttnPerf && <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600, border: '1px solid #e5e7eb' }}>Attn. Perf.</th>}
                                <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600, border: '1px solid #e5e7eb' }}>Q1({assignUploadParsed.q1Total}){assignUploadParsed.q1CO ? `(${assignUploadParsed.q1CO})` : ''}</th>
                                <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600, border: '1px solid #e5e7eb' }}>Q2({assignUploadParsed.q2Total}){assignUploadParsed.q2CO ? `(${assignUploadParsed.q2CO})` : ''}</th>
                                <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600, border: '1px solid #e5e7eb' }}>Q3({assignUploadParsed.q3Total}){assignUploadParsed.q3CO ? `(${assignUploadParsed.q3CO})` : ''}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {assignUploadParsed.rows.map((row, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                                  <td style={{ padding: '7px 12px', border: '1px solid #e5e7eb' }}>{row.rollNumber}</td>
                                  {[
                                    ...(assignUploadParsed.hasAttnPerf ? ['attnPerf'] : []),
                                    'q1', 'q2', 'q3',
                                  ].map(f => {
                                    const isAbsent = row[f] === 'A' || row[f] === 'Absent';
                                    return (
                                      <td key={f} style={{ padding: '7px 12px', textAlign: 'center', border: '1px solid #e5e7eb', color: isAbsent ? '#ba1a1a' : undefined, fontStyle: isAbsent ? 'italic' : undefined }}>
                                        {isAbsent ? 'Absent' : row[f]}
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>}
                </>
              )}
            </div>

            <div className="modal-footer" style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: '10px', backgroundColor: '#fff', borderTop: '1px solid #e5e7eb' }}>
              {error && <div className="alert alert-error" style={{ margin: 0 }}>{error}</div>}
              {successMessage && <div className="alert alert-success" style={{ margin: 0 }}>{successMessage}</div>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              {assignUploadParsed && (
                <button
                  className="btn btn-primary"
                  disabled={assignUploadSaving}
                  onClick={async () => {
                    setAssignUploadSaving(true);
                    try {
                      const existing = assignExistingData || {};
                      const assgnKey = selectedAssignUpload; // e.g. 'Assgn1'
                      const q1Field = `${assgnKey}_Q1`;
                      const q2Field = `${assgnKey}_Q2`;
                      const q3Field = `${assgnKey}_Q3`;

                      const parsedMap = {};
                      assignUploadParsed.rows.forEach(p => {
                        if (p.rollNumber && p.rollNumber.toLowerCase() !== 'roll') {
                          parsedMap[p.rollNumber] = p;
                        }
                      });

                      // Merge parsed rows into existing obtained rows (or create from parsed if none exist)
                      const existingObtained = (Array.isArray(existing.attnAssignObtainedRows) ? existing.attnAssignObtainedRows : [])
                        .filter(r => r.rollNumber && r.rollNumber.toLowerCase() !== 'roll');

                      // Seed enrolled batch students into base list so Excel marks can be applied
                      // even when no rows have been saved yet (mirrors mergeWithEnrolled in AttainmentView)
                      let baseObtained = existingObtained;
                      try {
                        const stuResp = await getCourseStudents(attendanceCourse._id);
                        if (stuResp.success && Array.isArray(stuResp.data) && stuResp.data.length > 0) {
                          const enrolled = stuResp.data
                            .map(s => ({ rollNumber: String(s.roll || s.rollNumber || '').trim(), name: s.name || '' }))
                            .filter(s => s.rollNumber && /^[0-9]{4,}$/.test(s.rollNumber));
                          if (enrolled.length > 0) {
                            const savedMap = {};
                            existingObtained.forEach(r => { savedMap[String(r.rollNumber).trim()] = r; });
                            baseObtained = enrolled.map(s => savedMap[s.rollNumber] || {
                              rollNumber: s.rollNumber, name: s.name,
                              attendance: 0,
                              Assgn1_Q1: 0, Assgn1_Q2: 0, Assgn1_Q3: 0,
                              Assgn2_Q1: 0, Assgn2_Q2: 0, Assgn2_Q3: 0,
                              Assgn3_Q1: 0, Assgn3_Q2: 0, Assgn3_Q3: 0,
                            });
                          }
                        }
                      } catch (e) { /* use existingObtained as-is */ }

                      // Fallback: if no base rows from DB or enrolled students, seed from parsed Excel rows
                      if (baseObtained.length === 0 && Object.keys(parsedMap).length > 0) {
                        baseObtained = Object.values(parsedMap).map(p => ({
                          rollNumber: p.rollNumber, name: '',
                          attendance: 0,
                          Assgn1_Q1: 0, Assgn1_Q2: 0, Assgn1_Q3: 0,
                          Assgn2_Q1: 0, Assgn2_Q2: 0, Assgn2_Q3: 0,
                          Assgn3_Q1: 0, Assgn3_Q2: 0, Assgn3_Q3: 0,
                        }));
                      }

                      // Only update enrolled rows — never add rows from Excel
                      const updatedObtained = Object.keys(parsedMap).length === 0
                        ? baseObtained
                        : baseObtained.map(r => {
                            const match = parsedMap[String(r.rollNumber).trim()];
                            if (match) {
                              return {
                                ...r,
                                ...(assignUploadParsed.hasAttnPerf && match.attnPerf !== null ? { attendance: match.attnPerf } : {}),
                                [q1Field]: match.q1 !== null ? match.q1 : (r[q1Field] ?? 0),
                                [q2Field]: match.q2 !== null ? match.q2 : (r[q2Field] ?? 0),
                                [q3Field]: match.q3 !== null ? match.q3 : (r[q3Field] ?? 0),
                              };
                            }
                            return r;
                          });
                      
                      const enrolledRolls = new Set(baseObtained.map(r => String(r.rollNumber).trim()));
                      const unmatchedRolls = Object.keys(parsedMap).filter(r => !enrolledRolls.has(String(r).trim()));

                      // Update assignmentManualWts for this assignment
                      const newManualWts = { ...(existing.assignmentManualWts || {}) };
                      if (assignUploadParsed.manualWt !== null) {
                        newManualWts[assgnKey] = assignUploadParsed.manualWt;
                      } else if (!(existing.assignmentManualWts?.[assgnKey] > 0)) {
                        // Auto-set from Q totals when no Manual Wt header and no existing weight
                        const autoSum = (assignUploadParsed.q1Total || 0) + (assignUploadParsed.q2Total || 0) + (assignUploadParsed.q3Total || 0);
                        if (autoSum > 0) newManualWts[assgnKey] = autoSum;
                      }

                      // Auto-bump assignTaken to at least this assignment's index
                      const assgnIndex = parseInt(assgnKey.replace('Assgn', ''), 10) || 1;

                      // Update assignmentRows CO mapping
                      const applyParsedToAssignRow = (newRow, coNumber) => {
                        if (assignUploadParsed.hasQ1 && assignUploadParsed.q1CO != null)
                          newRow[q1Field] = assignUploadParsed.q1CO === coNumber ? assignUploadParsed.q1Total : 0;
                        if (assignUploadParsed.hasQ2 && assignUploadParsed.q2CO != null)
                          newRow[q2Field] = assignUploadParsed.q2CO === coNumber ? assignUploadParsed.q2Total : 0;
                        if (assignUploadParsed.hasQ3 && assignUploadParsed.q3CO != null)
                          newRow[q3Field] = assignUploadParsed.q3CO === coNumber ? assignUploadParsed.q3Total : 0;
                        return newRow;
                      };
                      let updatedAssignmentRows;
                      if ((existing.assignmentRows || []).length === 0) {
                        const parsedCOs = [...new Set([
                          assignUploadParsed.hasQ1 && assignUploadParsed.q1CO ? assignUploadParsed.q1CO : null,
                          assignUploadParsed.hasQ2 && assignUploadParsed.q2CO ? assignUploadParsed.q2CO : null,
                          assignUploadParsed.hasQ3 && assignUploadParsed.q3CO ? assignUploadParsed.q3CO : null,
                        ].filter(Boolean))];
                        updatedAssignmentRows = parsedCOs.map(coNumber => applyParsedToAssignRow({ coNumber }, coNumber));
                      } else {
                        const coSet = new Set((existing.assignmentRows || []).map(r => r.coNumber).filter(Boolean));
                        // Add any new COs from this parsed upload that aren't already in coSet
                        [assignUploadParsed.q1CO, assignUploadParsed.q2CO, assignUploadParsed.q3CO].forEach(co => {
                          if (co != null) coSet.add(co);
                        });
                        updatedAssignmentRows = [...coSet].map(coNumber => {
                          const existingRow = (existing.assignmentRows || []).find(r => r.coNumber === coNumber) || { coNumber };
                          return applyParsedToAssignRow({ ...existingRow }, coNumber);
                        });
                      }

                      const fullData = {
                        assignmentRows: updatedAssignmentRows,
                        assignmentManualWts: newManualWts,
                        assignmentSummary: {
                          assignTaken: Math.max(assignSettings.assignTaken || 0, assgnIndex),
                          assignmentMarks30: assignSettings.assignmentMarks30,
                          useEqWt: assignSettings.useEqWt,
                          attendancePerformance: assignSettings.attendancePerformance,
                        },
                        attendanceMarks: existing.attendanceMarks || 0,
                        attnAssignObtainedRows: updatedObtained,
                      };

                      await saveAssignmentData(attendanceCourse._id, fullData);
                      setAssignExistingData(prev => ({ ...(prev || {}), ...fullData }));
                      const msg = unmatchedRolls.length > 0
                        ? `${assgnKey} marks saved. ${unmatchedRolls.length} roll(s) in Excel not found in enrolled list: ${unmatchedRolls.join(', ')}`
                        : `${assgnKey} marks saved successfully`;
                      setSuccessMessage(msg);
                      setTimeout(() => setSuccessMessage(''), unmatchedRolls.length > 0 ? 8000 : 3000);
                      setAssignUploadParsed(null);
                      setAssignUploadFile(null);
                      setAssignFileInputKey(k => k + 1);
                    } catch (err) {
                      console.error('Error saving assignment upload:', err);
                      const errMsg = err && (err.error || err.message || (typeof err === 'string' ? err : null));
                      setError(errMsg || 'Failed to save assignment data');
                      setTimeout(() => setError(''), 5000);
                    } finally {
                      setAssignUploadSaving(false);
                    }
                  }}
                  style={{ fontSize: '13px', padding: '8px 20px' }}
                >
                  {assignUploadSaving ? 'Saving...' : `Save ${selectedAssignUpload} Data`}
                </button>
              )}
              <button className="btn btn-outline" onClick={() => setShowAttendanceModal(false)} style={{ width: '100px' }}>
                Close
              </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherDashboard;

