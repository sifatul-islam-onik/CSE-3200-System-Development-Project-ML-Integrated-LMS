import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Helper function to format PO codes from PO_A to PO(a)
const formatPOCode = (code) => {
  if (!code) return code;
  const match = code.match(/PO_([A-Z])/);
  if (match) {
    return `PO(${match[1].toLowerCase()})`;
  }
  return code;
};

const CourseOutcomeEditor = ({ courseOutcomes, onChange, onValidationChange }) => {
  const [expandedCO, setExpandedCO] = useState(null);
  const [programOutcomes, setProgramOutcomes] = useState([]);
  const [loadingPOs, setLoadingPOs] = useState(true);
  const [validationErrors, setValidationErrors] = useState({});

  // Fetch Program Outcomes on mount
  useEffect(() => {
    const fetchProgramOutcomes = async () => {
      try {
        const response = await axios.get(`${API_URL}/program-outcomes`);
        if (response.data.success) {
          setProgramOutcomes(response.data.data);
        }
      } catch (error) {
        console.error('Failed to load Program Outcomes:', error);
      } finally {
        setLoadingPOs(false);
      }
    };

    fetchProgramOutcomes();
  }, []);

  // Validate COs whenever they change
  useEffect(() => {
    const errors = {};
    let isValid = true;

    courseOutcomes.forEach((co, index) => {
      const coErrors = [];

      // Check if description exists
      if (!co.description || co.description.trim() === '') {
        coErrors.push('Description is required');
        isValid = false;
      }

      // Check if at least one PO mapping exists
      const hasMappings = co.po_mappings && co.po_mappings.length > 0;
      if (!hasMappings) {
        coErrors.push('At least one Program Outcome mapping is required');
        isValid = false;
      }

      // Check if at least one taxonomy level is selected
      const hasTaxonomy = co.taxonomy_levels && co.taxonomy_levels.length > 0;
      if (!hasTaxonomy) {
        coErrors.push('At least one taxonomy level is required');
        isValid = false;
      }

      if (coErrors.length > 0) {
        errors[index] = coErrors;
      }
    });

    setValidationErrors(errors);
    
    // Notify parent component about validation status
    if (onValidationChange) {
      onValidationChange(isValid);
    }
  }, [courseOutcomes, onValidationChange]);

  const addCourseOutcome = () => {
    const newCO = {
      co_code: `CO${courseOutcomes.length + 1}`,
      description: '',
      po_mappings: [],
      taxonomy_levels: []
    };
    onChange([...courseOutcomes, newCO]);
    setExpandedCO(courseOutcomes.length);
  };

  const removeCourseOutcome = (index) => {
    const updated = courseOutcomes.filter((_, i) => i !== index);
    onChange(updated);
    if (expandedCO === index) setExpandedCO(null);
  };

  const updateCourseOutcome = (index, field, value) => {
    const updated = [...courseOutcomes];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const updatePOMapping = (coIndex, poCode, level) => {
    const updated = [...courseOutcomes];
    const co = updated[coIndex];
    
    if (!co.po_mappings) {
      co.po_mappings = [];
    }

    const levelNum = parseInt(level);

    if (levelNum === 0) {
      // Remove mapping if level is 0
      co.po_mappings = co.po_mappings.filter(m => m.program_outcome_code !== poCode);
    } else {
      // Update or add mapping
      const existingIndex = co.po_mappings.findIndex(m => m.program_outcome_code === poCode);
      
      if (existingIndex >= 0) {
        co.po_mappings[existingIndex].level = levelNum;
      } else {
        co.po_mappings.push({
          program_outcome_code: poCode,
          level: levelNum
        });
      }
    }

    onChange(updated);
  };

  const getPOMappingLevel = (co, poCode) => {
    if (!co.po_mappings) return 0;
    const mapping = co.po_mappings.find(m => m.program_outcome_code === poCode);
    return mapping ? mapping.level : 0;
  };

  const toggleTaxonomyLevel = (coIndex, taxonomyCode) => {
    const updated = [...courseOutcomes];
    const co = updated[coIndex];
    
    if (!co.taxonomy_levels) {
      co.taxonomy_levels = [];
    }

    const index = co.taxonomy_levels.indexOf(taxonomyCode);
    const group = taxonomyCode.charAt(0); // Get first character (C, P, A, or S)
    
    if (index >= 0) {
      // Remove if already present
      co.taxonomy_levels.splice(index, 1);
    } else {
      // Remove any existing selection from the same group (at most one per group)
      co.taxonomy_levels = co.taxonomy_levels.filter(level => level.charAt(0) !== group);
      // Add the new selection
      co.taxonomy_levels.push(taxonomyCode);
    }

    onChange(updated);
  };

  const isTaxonomySelected = (co, taxonomyCode) => {
    return co.taxonomy_levels && co.taxonomy_levels.includes(taxonomyCode);
  };

  if (loadingPOs) {
    return (
      <div className="course-outcomes-section">
        <div className="course-section-header">
          <h4>Course Outcomes & CO-PO Mapping</h4>
        </div>
        <p className="loading-message">Loading Program Outcomes...</p>
      </div>
    );
  }

  return (
    <div className="course-outcomes-section">
      <div className="course-section-header">
        <h4>Course Outcomes & CO-PO Mapping</h4>
        <button type="button" className="btn-add-small" onClick={addCourseOutcome}>
          + Add CO
        </button>
      </div>

      {courseOutcomes.length === 0 ? (
        <p className="empty-message">No course outcomes defined. Click "Add CO" to get started.</p>
      ) : (
        <div className="co-list">
          {courseOutcomes.map((co, index) => (
            <div key={index} className={`co-item ${expandedCO === index ? 'expanded' : ''} ${validationErrors[index] ? 'has-error' : ''}`}>
              <div className="co-header" onClick={() => setExpandedCO(expandedCO === index ? null : index)}>
                <span className="co-number">{co.co_code}</span>
                <span className="co-preview">{co.description || 'No description'}</span>
                {validationErrors[index] && (
                  <span className="error-indicator" title={validationErrors[index].join(', ')}>⚠</span>
                )}
                <button
                  type="button"
                  className="btn-remove-small"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeCourseOutcome(index);
                  }}
                >
                  ✕
                </button>
              </div>

              {expandedCO === index && (
                <div className="co-details">
                  <div className="form-group">
                    <label>CO Code *</label>
                    <input
                      type="text"
                      value={co.co_code}
                      onChange={(e) => updateCourseOutcome(index, 'co_code', e.target.value)}
                      placeholder="e.g., CO1"
                    />
                  </div>

                  <div className="form-group">
                    <label>Description *</label>
                    <textarea
                      value={co.description}
                      onChange={(e) => updateCourseOutcome(index, 'description', e.target.value)}
                      placeholder="Describe what students will be able to do after completing this course..."
                      rows="3"
                    />
                  </div>

                  <div className="taxonomy-section">
                    <label>Taxonomy Levels</label>
                    <div className="taxonomy-categories">
                      <div className="taxonomy-category">
                        <div className="taxonomy-checkboxes">
                          {['C1', 'C2', 'C3', 'C4', 'C5', 'C6'].map(level => (
                            <label key={level} className="checkbox-label">
                              <input
                                type="checkbox"
                                checked={isTaxonomySelected(co, level)}
                                onChange={() => toggleTaxonomyLevel(index, level)}
                              />
                              <span>{level}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="taxonomy-category">
                        <div className="taxonomy-checkboxes">
                          {['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7'].map(level => (
                            <label key={level} className="checkbox-label">
                              <input
                                type="checkbox"
                                checked={isTaxonomySelected(co, level)}
                                onChange={() => toggleTaxonomyLevel(index, level)}
                              />
                              <span>{level}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="taxonomy-category">
                        <div className="taxonomy-checkboxes">
                          {['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7'].map(level => (
                            <label key={level} className="checkbox-label">
                              <input
                                type="checkbox"
                                checked={isTaxonomySelected(co, level)}
                                onChange={() => toggleTaxonomyLevel(index, level)}
                              />
                              <span>{level}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="taxonomy-category">
                        <div className="taxonomy-checkboxes">
                          {['S1', 'S2', 'S3', 'S4', 'S5'].map(level => (
                            <label key={level} className="checkbox-label">
                              <input
                                type="checkbox"
                                checked={isTaxonomySelected(co, level)}
                                onChange={() => toggleTaxonomyLevel(index, level)}
                              />
                              <span>{level}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="po-mapping-section">
                    <label>
                      CO-PO Mapping * 
                      <span className="helper-text"> (Select at least one Program Outcome)</span>
                    </label>
                    <div className="mapping-legend">
                      <span>0 = None</span>
                      <span>1 = Low</span>
                      <span>2 = Medium</span>
                      <span>3 = High</span>
                    </div>
                    <div className="po-mapping-grid">
                      {programOutcomes.map(po => (
                        <div key={po.po_code} className="po-mapping-item">
                          <span className="po-label" title={po.title}>
                            {formatPOCode(po.po_code)}
                          </span>
                          <select
                            value={getPOMappingLevel(co, po.po_code)}
                            onChange={(e) => updatePOMapping(index, po.po_code, e.target.value)}
                            className={getPOMappingLevel(co, po.po_code) > 0 ? 'mapped' : ''}
                          >
                            <option value="0">0</option>
                            <option value="1">1</option>
                            <option value="2">2</option>
                            <option value="3">3</option>
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>

                  {validationErrors[index] && (
                    <div className="validation-errors">
                      {validationErrors[index].map((error, i) => (
                        <p key={i} className="error-message">⚠ {error}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {courseOutcomes.length > 0 && (
        <div className="co-summary">
          <p>Total Course Outcomes: <strong>{courseOutcomes.length}</strong></p>
          {Object.keys(validationErrors).length > 0 && (
            <p className="warning-text">⚠ Please fix {Object.keys(validationErrors).length} course outcome(s) before saving</p>
          )}
        </div>
      )}
    </div>
  );
};

export default CourseOutcomeEditor;
