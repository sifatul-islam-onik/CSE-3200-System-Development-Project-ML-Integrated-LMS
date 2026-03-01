import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBook, faPlus, faHourglass, faCheckCircle, faTimesCircle, faEye, faTrash, faEdit, faSignOutAlt, faChevronDown, faChevronRight, faClipboardList, faTimes } from '@fortawesome/free-solid-svg-icons';
import { getUser, logout } from '../components/ProtectedRoute';
import { getProfile } from '../services/authService';
import { getMyProposals, createCourseProposal, deleteProposal } from '../services/courseProposalService';
import { getAllCourses, getCourseStudents, updateCourse } from '../services/courseService';
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
  const [ctMarksData, setCtMarksData] = useState([]);
  const [ctMarksLoading, setCtMarksLoading] = useState(false);
  const [ctCount, setCtCount] = useState(3);
  const [ctTotalMarks, setCtTotalMarks] = useState([20, 20, 20]);
  const [isSmallScreen, setIsSmallScreen] = useState(typeof window !== 'undefined' ? window.innerWidth < 640 : false);
  
  // Attendance & Assignment Marks state
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [attendanceCourse, setAttendanceCourse] = useState(null);
  const [attendanceData, setAttendanceData] = useState([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceTotalMarks, setAttendanceTotalMarks] = useState(10);
  const [assignmentCount, setAssignmentCount] = useState(3);
  const [assignmentTotalMarks, setAssignmentTotalMarks] = useState([10, 10, 10]);

  // When CT count changes, redistribute totals to sum 60 and resize marks arrays
  useEffect(() => {
    const base = Math.floor(60 / ctCount);
    const rem = 60 % ctCount;
    const redistributed = Array.from({ length: ctCount }, (_, i) => base + (i < rem ? 1 : 0));
    setCtTotalMarks(redistributed);

    setCtMarksData((prev) => prev.map((s) => {
      const newMarks = Array.from({ length: ctCount }, (_, i) => (Array.isArray(s.marks) ? s.marks[i] : undefined) ?? '');
      return { ...s, marks: newMarks };
    }));
  }, [ctCount]);

  useEffect(() => {
    const handleResize = () => {
      setIsSmallScreen(window.innerWidth < 640);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // When assignment count changes, redistribute totals and resize marks arrays
  useEffect(() => {
    const newTotals = Array.from({ length: assignmentCount }, () => 10);
    setAssignmentTotalMarks(newTotals);

    setAttendanceData((prev) => prev.map((s) => {
      const newMarks = Array.from({ length: assignmentCount }, (_, i) => (Array.isArray(s.assignments) ? s.assignments[i] : undefined) ?? '');
      return { ...s, assignments: newMarks };
    }));
  }, [assignmentCount]);

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
                        {getStatusBadge(proposal.status)}
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
                      <div className="proposal-actions">
                        {proposal.status === 'PENDING' && (
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDeleteProposal(proposal._id)}
                          >
                            <FontAwesomeIcon icon={faTrash} /> Delete
                          </button>
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
                            console.log('[TeacherDashboard] Checking course:', course.courseCode);
                            console.log('[TeacherDashboard] User ID:', user?.userId, 'User _id:', user?._id);
                            console.log('[TeacherDashboard] Assigned teachers:', course.assignedTeachers);
                            
                            const assignment = course.assignedTeachers?.find(at => {
                              const teacherId = at.teacher?._id || at.teacher;
                              const userIdToMatch = user.userId || user._id;
                              console.log('[TeacherDashboard] Comparing:', {
                                teacherId: teacherId?.toString(),
                                userId: userIdToMatch,
                                matches: teacherId?.toString() === userIdToMatch
                              });
                              return teacherId && teacherId.toString() === userIdToMatch;
                            });
                            const teacherSection = assignment?.section || null;
                            console.log('[TeacherDashboard] Found assignment:', assignment, 'Section:', teacherSection);
                            
                            return (
                            <div key={course._id} className="course-item">
                              <div className="course-item-header">
                                <div className="course-info">
                                  <span className="course-code">{course.courseCode}</span>
                                  {teacherSection && (
                                    <span style={{
                                      padding: '2px 8px',
                                      backgroundColor: '#dbeafe',
                                      color: '#1e40af',
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
                                      backgroundColor: '#fef3c7',
                                      color: '#92400e',
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
                                      setCtMarksLoading(true);
                                      const response = await getCourseStudents(course._id, section);
                                      if (response.success && response.data.length > 0) {
                                        // Sort students by roll in ascending order
                                        const sortedStudents = response.data.sort((a, b) => {
                                          return (a.roll || '').localeCompare(b.roll || '', undefined, { numeric: true });
                                        });
                                        setCtMarksData(sortedStudents.map(student => ({
                                          studentId: student._id,
                                          roll: student.roll,
                                          name: student.name,
                                          marks: []
                                        })));
                                        setCtMarksCourse(course);
                                        setShowCTMarksModal(true);
                                      } else {
                                        setError('No students enrolled in this course');
                                        setTimeout(() => setError(''), 3000);
                                      }
                                    } catch (err) {
                                      console.error('Error fetching students:', err);
                                      setError('Failed to fetch students');
                                      setTimeout(() => setError(''), 3000);
                                    } finally {
                                      setCtMarksLoading(false);
                                    }
                                  }}
                                >
                                  <FontAwesomeIcon icon={faClipboardList} /> Enter CT Marks
                                </button>
                                <button
                                  className="btn btn-sm btn-info"
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
                                      setAttendanceLoading(true);
                                      const response = await getCourseStudents(course._id, section);
                                      if (response.success && response.data.length > 0) {
                                        // Sort students by roll in ascending order
                                        const sortedStudents = response.data.sort((a, b) => {
                                          return (a.roll || '').localeCompare(b.roll || '', undefined, { numeric: true });
                                        });
                                        setAttendanceData(sortedStudents.map(student => ({
                                          studentId: student._id,
                                          roll: student.roll,
                                          name: student.name,
                                          attendance: '',
                                          assignments: []
                                        })));
                                        setAttendanceCourse(course);
                                        // Set attendance total marks from course
                                        setAttendanceTotalMarks(course.attendanceMarks || 10);
                                        setShowAttendanceModal(true);
                                      } else {
                                        setError('No students enrolled in this course');
                                        setTimeout(() => setError(''), 3000);
                                      }
                                    } catch (err) {
                                      console.error('Error fetching students:', err);
                                      setError('Failed to fetch students');
                                      setTimeout(() => setError(''), 3000);
                                    } finally {
                                      setAttendanceLoading(false);
                                    }
                                  }}
                                >
                                  <FontAwesomeIcon icon={faClipboardList} /> Attendance & Assignments
                                </button>
                                <button
                                  className="btn btn-sm btn-primary"
                                  onClick={() => openEditProposal(course)}
                                >
                                  <FontAwesomeIcon icon={faEdit} /> Propose Edit
                                </button>
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
        return <AttainmentView />;

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
      {showCTMarksModal && ctMarksCourse && ctMarksData.length > 0 && (
        <div className="modal-overlay" onClick={() => setShowCTMarksModal(false)}>
          <div className="modal-content" style={{ width: '95vw', maxWidth: '900px', maxHeight: '90vh', borderRadius: '10px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ padding: '24px', position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#fff', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0 }}>Enter CT Marks - {ctMarksCourse.courseCode}</h3>
              <button 
                className="close-btn"
                onClick={() => setShowCTMarksModal(false)}
                disabled={ctMarksLoading}
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            <div className="modal-body" style={{ padding: '24px', overflowY: 'auto', flex: '1 1 auto' }}>
              {/* CT Total Marks Configuration */}
              <div style={{
                marginBottom: '20px',
                padding: '16px',
                backgroundColor: '#efe5ff',
                border: '1px solid #ddd6fe',
                borderRadius: '6px',
              }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600, color: '#374151' }}>
                  Set Total Marks for Each CT
                </h4>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '12px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>Number of CTs</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={ctCount}
                    onChange={(e) => {
                      const n = parseInt(e.target.value) || 1;
                      setCtCount(Math.max(1, Math.min(n, 10)));
                    }}
                    style={{ width: '80px', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px' }}
                  />
                  <span style={{ fontSize: '12px', color: '#6b7280' }}>Total must be 60</span>
                </div>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: '12px' 
                }}>
                  {Array.from({ length: ctCount }, (_, ctIndex) => (
                    <div key={ctIndex}>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: '#374151' }}>
                        CT {ctIndex + 1} Total Marks
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={ctTotalMarks[ctIndex]}
                        onChange={(e) => {
                          let val = e.target.value ? parseInt(e.target.value) : 0;
                          if (isNaN(val) || val < 0) val = 0;
                          const newTotals = [...ctTotalMarks];
                          const othersSum = newTotals.reduce((sum, m, i) => i === ctIndex ? sum : sum + (m || 0), 0);
                          const maxForThis = Math.max(0, 60 - othersSum);
                          newTotals[ctIndex] = Math.min(val, maxForThis);
                          const totalNow = newTotals.reduce((s, m) => s + (m || 0), 0);
                          const remainder = Math.max(0, 60 - totalNow);
                          if (newTotals.length > 0) {
                            const last = newTotals.length - 1;
                            if (last !== ctIndex) {
                              newTotals[last] = remainder;
                            } else {
                              newTotals[last] = Math.min(newTotals[last], maxForThis);
                            }
                          }
                          setCtTotalMarks(newTotals);
                        }}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '4px',
                          fontSize: '13px'
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ width: '100%', overflowX: 'auto' }}>
                <table style={{
                  width: '100%',
                  minWidth: `${(isSmallScreen ? 200 : 320) + ctCount * 110}px`,
                  borderCollapse: 'collapse',
                  fontSize: '14px',
                  tableLayout: 'fixed'
                }}>
                <thead>
                  <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '2px solid #d1d5db' }}>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, color: '#1f2937', position: 'sticky', left: 0, backgroundColor: '#f3f4f6', zIndex: 2, minWidth: '110px' }}>Roll</th>
                    {!isSmallScreen && (
                      <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, color: '#1f2937' }}>Name</th>
                    )}
                    {ctTotalMarks.map((total, i) => (
                      <th key={i} style={{ padding: '12px', textAlign: 'center', fontWeight: 600, color: '#1f2937' }}>CT {i + 1} ({total})</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ctMarksData.map((student, idx) => (
                    <tr key={student.studentId} style={{
                      borderBottom: '1px solid #e5e7eb',
                      backgroundColor: idx % 2 === 0 ? '#fff' : '#f9fafb'
                    }}>
                      <td style={{ padding: '12px', color: '#1f2937', fontWeight: 500, position: 'sticky', left: 0, backgroundColor: '#fff', zIndex: 1 }}>
                        {student.roll}
                      </td>
                      {!isSmallScreen && (
                        <td style={{ padding: '12px', color: '#1f2937' }}>
                          {student.name}
                        </td>
                      )}
                      {Array.from({ length: ctCount }, (_, ctIndex) => (
                        <td key={ctIndex} style={{ padding: '12px', textAlign: 'center' }}>
                          <input
                            type="number"
                            min="0"
                            max={ctTotalMarks[ctIndex]}
                            placeholder="0"
                            value={(student.marks && student.marks[ctIndex]) ?? ''}
                            onChange={(e) => {
                              let value = e.target.value ? parseInt(e.target.value) : '';
                              // Validate against max marks
                              if (value && value > ctTotalMarks[ctIndex]) {
                                value = ctTotalMarks[ctIndex];
                              }
                              const newData = [...ctMarksData];
                              const marks = Array.from({ length: ctCount }, (_, i) => (newData[idx].marks && newData[idx].marks[i]) ?? '');
                              marks[ctIndex] = value;
                              newData[idx].marks = marks;
                              setCtMarksData(newData);
                            }}
                            style={{
                              width: '100%',
                              maxWidth: '70px',
                              padding: '6px 8px',
                              border: '1px solid #d1d5db',
                              borderRadius: '4px',
                              textAlign: 'center',
                              fontSize: '13px'
                            }}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                </table>
              </div>
            </div>
            <div className="modal-footer" style={{ padding: '16px 20px', display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'flex-end', width: '100%', boxSizing: 'border-box', backgroundColor: '#fff', borderTop: '1px solid #e5e7eb' }}>
              <button
                className="btn btn-outline"
                onClick={() => setShowCTMarksModal(false)}
                disabled={ctMarksLoading}
                style={{ flex: '0 0 auto', width: '120px', whiteSpace: 'nowrap' }}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  // Save CT marks logic here
                  setShowCTMarksModal(false);
                  setSuccessMessage('CT Marks saved successfully');
                  setTimeout(() => setSuccessMessage(''), 3000);
                }}
                disabled={ctMarksLoading}
                style={{ flex: '0 0 auto', width: '120px', whiteSpace: 'nowrap' }}
              >
                Save CT Marks
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Attendance & Assignment Marks Modal */}
      {showAttendanceModal && attendanceCourse && attendanceData.length > 0 && (
        <div className="modal-overlay" onClick={() => setShowAttendanceModal(false)}>
          <div className="modal-content" style={{ width: '95vw', maxWidth: '900px', maxHeight: '90vh', borderRadius: '10px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ padding: '24px', position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#fff', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0 }}>Attendance & Assignments - {attendanceCourse.courseCode}</h3>
              <button 
                className="close-btn"
                onClick={() => setShowAttendanceModal(false)}
                disabled={attendanceLoading}
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            <div className="modal-body" style={{ padding: '24px', overflowY: 'auto', flex: '1 1 auto' }}>
              {/* Attendance Configuration */}
              <div style={{
                marginBottom: '20px',
                padding: '16px',
                backgroundColor: '#fef3c7',
                border: '1px solid #fde68a',
                borderRadius: '6px',
              }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600, color: '#374151' }}>
                  Set Attendance Total Marks
                </h4>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>Attendance Total Marks</label>
                  <input
                    type="number"
                    min="0"
                    value={attendanceTotalMarks}
                    onChange={(e) => {
                      let val = e.target.value ? parseInt(e.target.value) : 0;
                      if (isNaN(val) || val < 0) val = 0;
                      setAttendanceTotalMarks(val);
                    }}
                    style={{ width: '100px', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px' }}
                  />
                </div>
              </div>

              {/* Assignment Configuration */}
              <div style={{
                marginBottom: '20px',
                padding: '16px',
                backgroundColor: '#e0f2fe',
                border: '1px solid #bae6fd',
                borderRadius: '6px',
              }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600, color: '#374151' }}>
                  Set Assignment Marks
                </h4>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '12px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>Number of Assignments</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={assignmentCount}
                    onChange={(e) => {
                      const n = parseInt(e.target.value) || 1;
                      setAssignmentCount(Math.max(1, Math.min(n, 10)));
                    }}
                    style={{ width: '80px', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px' }}
                  />
                </div>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: '12px' 
                }}>
                  {Array.from({ length: assignmentCount }, (_, assignIndex) => (
                    <div key={assignIndex}>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: '#374151' }}>
                        Assignment {assignIndex + 1} Full Marks
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={assignmentTotalMarks[assignIndex]}
                        onChange={(e) => {
                          let val = e.target.value ? parseInt(e.target.value) : 0;
                          if (isNaN(val) || val < 0) val = 0;
                          const newTotals = [...assignmentTotalMarks];
                          newTotals[assignIndex] = val;
                          setAssignmentTotalMarks(newTotals);
                        }}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '4px',
                          fontSize: '13px'
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ width: '100%', overflowX: 'auto' }}>
                <table style={{
                  width: '100%',
                  minWidth: `${(isSmallScreen ? 200 : 320) + 110 + assignmentCount * 110}px`,
                  borderCollapse: 'collapse',
                  fontSize: '14px',
                  tableLayout: 'fixed'
                }}>
                <thead>
                  <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '2px solid #d1d5db' }}>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, color: '#1f2937', position: 'sticky', left: 0, backgroundColor: '#f3f4f6', zIndex: 2, minWidth: '110px' }}>Roll</th>
                    {!isSmallScreen && (
                      <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, color: '#1f2937' }}>Name</th>
                    )}
                    <th style={{ padding: '12px', textAlign: 'center', fontWeight: 600, color: '#1f2937' }}>Attendance ({attendanceTotalMarks})</th>
                    {assignmentTotalMarks.map((total, i) => (
                      <th key={i} style={{ padding: '12px', textAlign: 'center', fontWeight: 600, color: '#1f2937' }}>Assign {i + 1} ({total})</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {attendanceData.map((student, idx) => (
                    <tr key={student.studentId} style={{
                      borderBottom: '1px solid #e5e7eb',
                      backgroundColor: idx % 2 === 0 ? '#fff' : '#f9fafb'
                    }}>
                      <td style={{ padding: '12px', color: '#1f2937', fontWeight: 500, position: 'sticky', left: 0, backgroundColor: idx % 2 === 0 ? '#fff' : '#f9fafb', zIndex: 1 }}>
                        {student.roll}
                      </td>
                      {!isSmallScreen && (
                        <td style={{ padding: '12px', color: '#1f2937' }}>
                          {student.name}
                        </td>
                      )}
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <input
                          type="number"
                          min="0"
                          max={attendanceTotalMarks}
                          placeholder="0"
                          value={student.attendance ?? ''}
                          onChange={(e) => {
                            let value = e.target.value ? parseInt(e.target.value) : '';
                            if (value && value > attendanceTotalMarks) {
                              value = attendanceTotalMarks;
                            }
                            const newData = [...attendanceData];
                            newData[idx].attendance = value;
                            setAttendanceData(newData);
                          }}
                          style={{
                            width: '100%',
                            maxWidth: '70px',
                            padding: '6px 8px',
                            border: '1px solid #d1d5db',
                            borderRadius: '4px',
                            textAlign: 'center',
                            fontSize: '13px'
                          }}
                        />
                      </td>
                      {Array.from({ length: assignmentCount }, (_, assignIndex) => (
                        <td key={assignIndex} style={{ padding: '12px', textAlign: 'center' }}>
                          <input
                            type="number"
                            min="0"
                            max={assignmentTotalMarks[assignIndex]}
                            placeholder="0"
                            value={(student.assignments && student.assignments[assignIndex]) ?? ''}
                            onChange={(e) => {
                              let value = e.target.value ? parseInt(e.target.value) : '';
                              if (value && value > assignmentTotalMarks[assignIndex]) {
                                value = assignmentTotalMarks[assignIndex];
                              }
                              const newData = [...attendanceData];
                              const assignments = Array.from({ length: assignmentCount }, (_, i) => (newData[idx].assignments && newData[idx].assignments[i]) ?? '');
                              assignments[assignIndex] = value;
                              newData[idx].assignments = assignments;
                              setAttendanceData(newData);
                            }}
                            style={{
                              width: '100%',
                              maxWidth: '70px',
                              padding: '6px 8px',
                              border: '1px solid #d1d5db',
                              borderRadius: '4px',
                              textAlign: 'center',
                              fontSize: '13px'
                            }}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                </table>
              </div>
            </div>
            <div className="modal-footer" style={{ padding: '16px 20px', display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'flex-end', width: '100%', boxSizing: 'border-box', backgroundColor: '#fff', borderTop: '1px solid #e5e7eb' }}>
              <button
                className="btn btn-outline"
                onClick={() => setShowAttendanceModal(false)}
                disabled={attendanceLoading}
                style={{ flex: '0 0 auto', width: '120px', whiteSpace: 'nowrap' }}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={async () => {
                  try {
                    setAttendanceLoading(true);
                    // Save attendance total marks to course
                    await updateCourse(attendanceCourse._id, { 
                      attendanceMarks: attendanceTotalMarks 
                    });
                    setShowAttendanceModal(false);
                    setSuccessMessage('Attendance & Assignment Marks saved successfully');
                    setTimeout(() => setSuccessMessage(''), 3000);
                  } catch (err) {
                    setError(err.error || 'Failed to save marks');
                    setTimeout(() => setError(''), 3000);
                  } finally {
                    setAttendanceLoading(false);
                  }
                }}
                disabled={attendanceLoading}
                style={{ flex: '0 0 auto', width: '120px', whiteSpace: 'nowrap' }}
              >
                Save Marks
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherDashboard;
