import React, { useState, useEffect } from 'react';
import { getCOPOMatrix } from '../services/courseService';
import '../styles/CourseOBEView.css';

// Helper function to format PO codes from PO_A to PO(a)
const formatPOCode = (code) => {
  if (!code) return code;
  const match = code.match(/PO_([A-Z])/);
  if (match) {
    return `PO(${match[1].toLowerCase()})`;
  }
  return code;
};

const CourseOBEView = ({ course, onClose }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [copoMatrix, setCopoMatrix] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (activeTab === 'copo' && !copoMatrix) {
      fetchCOPOMatrix();
    }
  }, [activeTab]);

  const fetchCOPOMatrix = async () => {
    setLoading(true);
    try {
      const response = await getCOPOMatrix(course._id);
      setCopoMatrix(response.data);
    } catch (error) {
      console.error('Error fetching CO-PO matrix:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderOverview = () => (
    <div className="obe-overview">
      {/* Basic Course Information */}
      <div className="section-card">
        <h3 className="section-title">Basic Information</h3>
        <div className="info-grid">
          <div className="info-item">
            <label>Course Code:</label>
            <span className="info-value highlight">{course.courseCode}</span>
          </div>
          <div className="info-item">
            <label>Course Title:</label>
            <span className="info-value">{course.courseTitle}</span>
          </div>
          <div className="info-item">
            <label>Credit Hours:</label>
            <span className="info-value">{course.credit}</span>
          </div>
          <div className="info-item">
            <label>Course Type:</label>
            <span className={`badge badge-${course.course_type ? course.course_type.toLowerCase().replace('/', '-') : 'default'}`}>
              {course.course_type || 'N/A'}
            </span>
          </div>
          <div className="info-item">
            <label>Department:</label>
            <span className="info-value">{course.course_offered_to || 'N/A'}</span>
          </div>
          <div className="info-item">
            <label>Category:</label>
            <span className={`badge badge-${course.category === 'COMPULSORY' ? 'success' : 'info'}`}>
              {course.category || 'N/A'}
            </span>
          </div>
          {course.elective_group && (
            <div className="info-item">
              <label>Elective Group:</label>
              <span className="info-value">{course.elective_group}</span>
            </div>
          )}
          {course.term && (
            <div className="info-item">
              <label>Term:</label>
              <span className="info-value">Term {course.term}</span>
            </div>
          )}
          {course.semester && (
            <div className="info-item">
              <label>Semester:</label>
              <span className="info-value">Semester {course.semester}</span>
            </div>
          )}
          {course.yearLevel && (
            <div className="info-item">
              <label>Year Level:</label>
              <span className="info-value">Year {course.yearLevel}</span>
            </div>
          )}
          {course.contactHours && (
            <div className="info-item">
              <label>Contact Hours:</label>
              <span className="info-value">{course.contactHours} hrs/week</span>
            </div>
          )}
          {course.status && (
            <div className="info-item">
              <label>Status:</label>
              <span className={`badge badge-${course.status === 'ACTIVE' ? 'success' : 'warning'}`}>
                {course.status}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* KPA Mapping */}
      <div className="section-card">
        <h3 className="section-title">Mapping of Knowledge Profile, Complex Engineering Problem Solving and Complex Engineering Activities</h3>
        <div className="kpa-table-wrapper">
          <table className="kpa-table">
            <tbody>
              <tr>
                <td>
                  <div className="kpa-grid-all">
                    {['K1', 'K2', 'K3', 'K4', 'K5', 'K6', 'K7', 'K8', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'A1', 'A2', 'A3', 'A4', 'A5'].map(kpa => (
                      <div key={kpa} className="kpa-item">
                        <span className={course.kpa_mapping && course.kpa_mapping.includes(kpa) ? 'kpa-checked' : 'kpa-unchecked'}>
                          {course.kpa_mapping && course.kpa_mapping.includes(kpa) ? '✓' : '○'}
                        </span>
                        <span className="kpa-label">{kpa}</span>
                      </div>
                    ))}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Prerequisites & Knowledge Required */}
      <div className="section-row">
        {course.prerequisites && course.prerequisites.length > 0 && (
          <div className="section-card half-width">
            <h3 className="section-title">Prerequisites</h3>
            <div className="badges-list">
              {course.prerequisites.map((prereq, idx) => (
                <span key={idx} className="badge badge-outline">{prereq}</span>
              ))}
            </div>
          </div>
        )}
        {course.knowledge_required && course.knowledge_required.length > 0 && (
          <div className="section-card half-width">
            <h3 className="section-title">Knowledge Required</h3>
            <ul className="bullet-list">
              {course.knowledge_required.map((knowledge, idx) => (
                <li key={idx}>{knowledge}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Course Objectives */}
      {course.course_objectives && course.course_objectives.length > 0 && (
        <div className="section-card">
          <h3 className="section-title">Course Objectives</h3>
          <ol className="numbered-list">
            {course.course_objectives.map((objective, idx) => (
              <li key={idx}>{objective}</li>
            ))}
          </ol>
        </div>
      )}

      {/* Course Content */}
      {course.course_content && course.course_content.length > 0 && (
        <div className="section-card">
          <h3 className="section-title">Course Content</h3>
          <div className="content-list">
            {course.course_content.map((content, idx) => (
              <div key={idx} className="content-item">
                <h4 className="content-name">{idx + 1}. {content.concept_name}</h4>
                <p className="content-description">{content.concept_description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Course Outcomes Table */}
      {course.courseOutcomes && course.courseOutcomes.length > 0 && (
        <div className="section-card">
          <h3 className="section-title">Course Outcomes</h3>
          <div className="co-table-wrapper">
            <table className="co-table">
              <thead>
                <tr>
                  <th>COs</th>
                  <th>CO Statements</th>
                  <th>Corresponding POs</th>
                  <th>Learning Domain and Taxonomy Levels</th>
                </tr>
              </thead>
              <tbody>
                {course.courseOutcomes.map((co, idx) => {
                  console.log('CO Data:', co); // Debug log
                  return (
                    <tr key={idx}>
                      <td className="co-number-cell">{co.co_code || `CO${idx + 1}`}</td>
                      <td className="co-statement-cell">{co.description}</td>
                      <td className="co-pos-cell">
                        {co.po_mappings && co.po_mappings.length > 0 
                          ? co.po_mappings.map(mapping => formatPOCode(mapping.program_outcome_code)).join(', ')
                          : '-'
                        }
                      </td>
                      <td className="co-taxonomy-cell">
                        {co.taxonomy_levels && co.taxonomy_levels.length > 0 
                          ? co.taxonomy_levels.join(', ')
                          : '-'
                        }
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Lecture Plan */}
      {course.lecture_plan && course.lecture_plan.length > 0 && (
        <div className="section-card">
          <h3 className="section-title">Lecture Plan</h3>
          <div className="lecture-plan-table">
            <table>
              {course.lecture_plan.length > 1 && (
                <thead>
                  <tr>
                    <th>Week</th>
                    <th>Plan</th>
                  </tr>
                </thead>
              )}
              <tbody>
                {course.lecture_plan.map((lecture, idx) => (
                  <tr key={idx}>
                    {course.lecture_plan.length > 1 && <td className="week-cell">Week {lecture.week}</td>}
                    <td>{lecture.plan}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* References */}
      {course.references && course.references.length > 0 && (
        <div className="section-card">
          <h3 className="section-title">References</h3>
          <ol className="references-list">
            {course.references.map((reference, idx) => (
              <li key={idx}>{reference}</li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );

  const renderCOPOMatrix = () => {
    if (loading) return <div className="loading-spinner">Loading CO-PO Matrix...</div>;
    if (!copoMatrix) return <div className="empty-state">No CO-PO mapping available</div>;
    
    // Check if matrix data exists and is an array
    if (!copoMatrix.matrix || !Array.isArray(copoMatrix.matrix) || copoMatrix.matrix.length === 0) {
      return (
        <div className="empty-state">
          <p>No Course Outcomes or CO-PO mappings have been defined for this course yet.</p>
          <p>Please add Course Outcomes with PO mappings to view the CO-PO matrix.</p>
        </div>
      );
    }

    const poKeys = Object.keys(copoMatrix.poTotals || {});

    return (
      <div className="copo-matrix-view">
        <div className="matrix-table-wrapper">
          <table className="matrix-table">
            <thead>
              <tr>
                <th>CO</th>
                <th>Taxonomy Levels</th>
                {poKeys.map(po => (
                  <th key={po} className="po-header">{formatPOCode(po)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {copoMatrix.matrix.map((row, idx) => (
                <tr key={idx}>
                  <td className="co-cell">{row.coNumber}</td>
                  <td className="taxonomy-cell">
                    {row.taxonomy_levels && row.taxonomy_levels.length > 0 
                      ? row.taxonomy_levels.join(', ') 
                      : '-'
                    }
                  </td>
                  {poKeys.map(po => (
                    <td key={po} className={`mapping-cell level-${row[po]}`}>
                      {row[po] || '-'}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="totals-row">
                <td colSpan="2"><strong>Total</strong></td>
                {poKeys.map(po => (
                  <td key={po} className="total-cell">
                    <strong>{copoMatrix.poTotals[po]}</strong>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="obe-view-overlay">
      <div className="obe-view-container">
        <div className="obe-view-header">
          <h3>OBE Details: {course.courseCode}</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="obe-tabs">
          <button
            className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button
            className={`tab-btn ${activeTab === 'copo' ? 'active' : ''}`}
            onClick={() => setActiveTab('copo')}
          >
            CO-PO Matrix
          </button>
        </div>

        <div className="obe-content">
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'copo' && renderCOPOMatrix()}
        </div>
      </div>
    </div>
  );
};

export default CourseOBEView;
