import React, { useState } from 'react';
import CourseOutcomeEditor from './CourseOutcomeEditor';
import '../styles/CourseForm.css';
import '../styles/spinner.css';

const CourseForm = ({ onSubmit, onCancel, loading, initialData = null, isEditMode = false }) => {
  const [formData, setFormData] = useState(initialData ? {
    courseCode: initialData.courseCode || '',
    courseTitle: initialData.courseTitle || '',
    course_type: initialData.course_type || 'THEORY',
    credit: initialData.credit || '',
    course_offered_to: initialData.course_offered_to || '',
    category: initialData.category || 'COMPULSORY',
    elective_group: initialData.elective_group || '',
    term: initialData.term || '',
    contactHours: initialData.contactHours || '',
    academicYear: initialData.academicYear ? initialData.academicYear.split('-')[0] : '',
    yearLevel: initialData.yearLevel || '',
    prerequisites: initialData.prerequisites || [],
    course_content: initialData.course_content || [],
    kpa_mapping: initialData.kpa_mapping || [],
    // Sort lecture_plan by week when loading
    lecture_plan: initialData.lecture_plan ? 
      [...initialData.lecture_plan].sort((a, b) => a.week - b.week) : [],
    references: initialData.references || [],
    courseOutcomes: initialData.courseOutcomes || [],
    learningObjectives: initialData.learningObjectives || [],
    knowledge_required: initialData.knowledge_required || [],
    course_objectives: initialData.course_objectives || []
  } : {
    courseCode: '',
    courseTitle: '',
    course_type: 'THEORY',
    credit: '',
    course_offered_to: '',
    category: 'COMPULSORY',
    elective_group: '',
    term: '',
    contactHours: '',
    academicYear: '',
    yearLevel: '',
    prerequisites: [],
    course_content: [],
    kpa_mapping: [],
    lecture_plan: [],
    references: [],
    courseOutcomes: [],
    learningObjectives: [],
    knowledge_required: [],
    course_objectives: []
  });

  const [errors, setErrors] = useState({});
  const [lecturePlanErrors, setLecturePlanErrors] = useState([]);
  const [referencesErrors, setReferencesErrors] = useState([]);
  const [isCOValidationValid, setIsCOValidationValid] = useState(true);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    // Special handling for academicYear to enforce 4-digit year
    if (name === 'academicYear') {
      // Allow empty or only accept 4-digit numbers >= 1967
      if (value === '' || (/^\d{0,4}$/.test(value))) {
        setFormData({
          ...formData,
          [name]: value
        });
      }
    } else {
      setFormData({
        ...formData,
        [name]: type === 'checkbox' ? checked : value
      });
    }
    
    // Clear error for this field
    if (errors[name]) {
      setErrors({ ...errors, [name]: '' });
    }
  };

  const addPrerequisite = () => {
    setFormData({
      ...formData,
      prerequisites: [...formData.prerequisites, '']
    });
  };

  const updatePrerequisite = (index, value) => {
    const updated = [...formData.prerequisites];
    updated[index] = value;
    setFormData({ ...formData, prerequisites: updated });
  };

  const removePrerequisite = (index) => {
    const updated = formData.prerequisites.filter((_, i) => i !== index);
    setFormData({ ...formData, prerequisites: updated });
  };

  const addCourseContent = () => {
    setFormData({
      ...formData,
      course_content: [...formData.course_content, { concept_name: '', concept_description: '' }]
    });
  };

  const updateCourseContent = (index, field, value) => {
    const updated = [...formData.course_content];
    updated[index][field] = value;
    setFormData({ ...formData, course_content: updated });
  };

  const removeCourseContent = (index) => {
    const updated = formData.course_content.filter((_, i) => i !== index);
    setFormData({ ...formData, course_content: updated });
  };

  const addKnowledgeRequired = () => {
    setFormData({
      ...formData,
      knowledge_required: [...formData.knowledge_required, '']
    });
  };

  const updateKnowledgeRequired = (index, value) => {
    const updated = [...formData.knowledge_required];
    updated[index] = value;
    setFormData({ ...formData, knowledge_required: updated });
  };

  const removeKnowledgeRequired = (index) => {
    const updated = formData.knowledge_required.filter((_, i) => i !== index);
    setFormData({ ...formData, knowledge_required: updated });
  };

  const addCourseObjective = () => {
    setFormData({
      ...formData,
      course_objectives: [...formData.course_objectives, '']
    });
  };

  const updateCourseObjective = (index, value) => {
    const updated = [...formData.course_objectives];
    updated[index] = value;
    setFormData({ ...formData, course_objectives: updated });
  };

  const removeCourseObjective = (index) => {
    const updated = formData.course_objectives.filter((_, i) => i !== index);
    setFormData({ ...formData, course_objectives: updated });
  };

  const addLecturePlan = () => {
    if (formData.lecture_plan.length >= 13) return;
    const updated = [...formData.lecture_plan, { week: '', plan: '' }];
    setFormData({
      ...formData,
      lecture_plan: updated
    });
    // Validate after adding
    setTimeout(() => validateLecturePlan(updated), 0);
  };

  const updateLecturePlan = (index, field, value) => {
    const updated = [...formData.lecture_plan];
    updated[index][field] = value;
    setFormData({ ...formData, lecture_plan: updated });
    // Validate in real-time
    setTimeout(() => validateLecturePlan(updated), 0);
  };

  const removeLecturePlan = (index) => {
    const updated = formData.lecture_plan.filter((_, i) => i !== index);
    setFormData({ ...formData, lecture_plan: updated });
    // Validate after removal
    setTimeout(() => validateLecturePlan(updated), 0);
  };

  const validateLecturePlan = (lecturePlan = formData.lecture_plan) => {
    const rowErrors = [];
    const weeks = [];

    lecturePlan.forEach((item, index) => {
      const error = {};
      
      // Check for empty week
      if (!item.week || item.week === '') {
        error.week = 'Week is required';
      } else if (item.week < 1 || item.week > 13) {
        error.week = 'Week must be 1-13';
      } else {
        weeks.push({ week: item.week, index });
      }
      
      // Check for empty plan
      if (!item.plan || !item.plan.trim()) {
        error.plan = 'Plan is required';
      }
      
      rowErrors[index] = error;
    });

    // Check for duplicate weeks
    const weekCounts = {};
    weeks.forEach(({ week, index }) => {
      if (!weekCounts[week]) {
        weekCounts[week] = [];
      }
      weekCounts[week].push(index);
    });

    Object.keys(weekCounts).forEach(week => {
      if (weekCounts[week].length > 1) {
        weekCounts[week].forEach(index => {
          if (!rowErrors[index]) rowErrors[index] = {};
          rowErrors[index].week = `Week ${week} is duplicated`;
        });
      }
    });

    setLecturePlanErrors(rowErrors);
    return rowErrors.every(err => !err.week && !err.plan);
  };

  const addReference = () => {
    const updated = [...formData.references, ''];
    setFormData({
      ...formData,
      references: updated
    });
    // Validate after adding
    setTimeout(() => validateReferences(updated), 0);
  };

  const updateReference = (index, value) => {
    const updated = [...formData.references];
    updated[index] = value;
    setFormData({ ...formData, references: updated });
    // Validate in real-time
    setTimeout(() => validateReferences(updated), 0);
  };

  const trimReference = (index) => {
    const updated = [...formData.references];
    updated[index] = updated[index].trim();
    setFormData({ ...formData, references: updated });
    // Validate after trim
    setTimeout(() => validateReferences(updated), 0);
  };

  const removeReference = (index) => {
    const updated = formData.references.filter((_, i) => i !== index);
    setFormData({ ...formData, references: updated });
    // Validate after removal
    setTimeout(() => validateReferences(updated), 0);
  };

  const validateReferences = (references = formData.references) => {
    const errors = references.map((ref) => {
      const trimmed = ref ? ref.trim() : '';
      if (!trimmed) {
        return 'Reference cannot be empty';
      }
      return null;
    });
    
    setReferencesErrors(errors);
    // Return true only if there are no errors
    return errors.every(err => !err);
  };

  const handleKPAChange = (value) => {
    const currentMapping = [...formData.kpa_mapping];
    const index = currentMapping.indexOf(value);
    
    if (index > -1) {
      // Remove if already selected
      currentMapping.splice(index, 1);
    } else {
      // Add if not selected
      currentMapping.push(value);
    }
    
    setFormData({ ...formData, kpa_mapping: currentMapping });
    // Clear error when user makes a selection
    if (errors.kpa_mapping && currentMapping.length > 0) {
      setErrors({ ...errors, kpa_mapping: '' });
    }
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.courseCode.trim()) {
      newErrors.courseCode = 'Course code is required';
    }

    if (!formData.courseTitle.trim()) {
      newErrors.courseTitle = 'Course title is required';
    }

    if (!formData.credit || formData.credit < 0) {
      newErrors.credit = 'Valid credit is required';
    }

    if (!formData.course_offered_to || !formData.course_offered_to.trim()) {
      newErrors.course_offered_to = 'Course offered to department is required';
    }

    if (!formData.course_type) {
      newErrors.course_type = 'Course type is required';
    }

    if (!formData.category) {
      newErrors.category = 'Category is required';
    }

    if (formData.category === 'OPTIONAL' && !formData.elective_group) {
      newErrors.elective_group = 'Elective group is required for optional courses';
    }

    // Validate knowledge_required
    if (!formData.knowledge_required || formData.knowledge_required.length === 0) {
      newErrors.knowledge_required = 'At least one knowledge required entry is required';
    } else {
      const hasEmpty = formData.knowledge_required.some(k => !k?.trim());
      if (hasEmpty) {
        newErrors.knowledge_required = 'All knowledge required entries must be non-empty';
      }
    }

    // Validate course_objectives
    if (!formData.course_objectives || formData.course_objectives.length === 0) {
      newErrors.course_objectives = 'At least one course objective is required';
    } else {
      const hasEmpty = formData.course_objectives.some(obj => !obj?.trim());
      if (hasEmpty) {
        newErrors.course_objectives = 'All course objectives must be non-empty';
      }
    }

    if (!formData.term || formData.term < 1 || formData.term > 2) {
      newErrors.term = 'Term (1 or 2) is required';
    }

    if (!formData.contactHours || formData.contactHours < 0) {
      newErrors.contactHours = 'Valid contact hours is required';
    }

    if (!formData.academicYear || formData.academicYear.toString().length !== 4 || formData.academicYear < 1967) {
      newErrors.academicYear = 'Valid 4-digit academic year (≥1967) is required';
    }

    const maxYearLevel = formData.course_offered_to === 'ARCH' ? 5 : 4;
    if (!formData.yearLevel || formData.yearLevel < 1 || formData.yearLevel > maxYearLevel) {
      newErrors.yearLevel = `Year level must be between 1-${maxYearLevel} for ${formData.course_offered_to || 'this department'}`;
    }

    // Validate course_content
    if (!formData.course_content || formData.course_content.length === 0) {
      newErrors.course_content = 'At least one course content item is required';
    } else {
      const hasIncomplete = formData.course_content.some(
        item => !item.concept_name?.trim() || !item.concept_description?.trim()
      );
      if (hasIncomplete) {
        newErrors.course_content = 'All course content rows must have both concept name and description';
      }
    }

    // Validate KPA mapping
    if (!formData.kpa_mapping || formData.kpa_mapping.length === 0) {
      newErrors.kpa_mapping = 'At least one KPA mapping must be selected';
    }

    // Validate lecture_plan
    if (!formData.lecture_plan || formData.lecture_plan.length === 0) {
      newErrors.lecture_plan = 'At least one lecture plan entry is required';
    } else if (formData.lecture_plan.length > 13) {
      newErrors.lecture_plan = 'Maximum 13 lecture plan entries allowed';
    } else {
      const isValid = validateLecturePlan();
      if (!isValid) {
        newErrors.lecture_plan = 'Please fix the errors in lecture plan rows';
      }
    }

    // Validate references
    if (!formData.references || formData.references.length === 0) {
      newErrors.references = 'At least one reference is required';
    } else {
      // Check if all references are empty
      const allEmpty = formData.references.every(ref => !ref || !ref.trim());
      if (allEmpty) {
        newErrors.references = 'At least one non-empty reference is required';
      } else {
        const isValid = validateReferences();
        if (!isValid) {
          newErrors.references = 'Some references are empty. Please fill or remove them';
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) {
      // Prepare payload with properly structured data
      const payload = {
        ...formData,
        // Convert academicYear to integer
        academicYear: formData.academicYear ? parseInt(formData.academicYear) : undefined,
        // Convert empty elective_group to null when category is COMPULSORY
        elective_group: formData.category === 'COMPULSORY' 
          ? null 
          : (formData.elective_group || null),
        // Ensure lecture_plan has correct structure and is sorted by week
        lecture_plan: formData.lecture_plan
          .map(item => ({
            week: parseInt(item.week),
            plan: item.plan.trim()
          }))
          .sort((a, b) => a.week - b.week),
        // Ensure references is cleaned: array of trimmed strings
        references: formData.references
          .map(ref => ref.trim())
          .filter(ref => ref !== ''),
        // Ensure course_content has correct structure
        course_content: formData.course_content.map(item => ({
          concept_name: item.concept_name.trim(),
          concept_description: item.concept_description.trim()
        })),
        // Clean prerequisites (remove empty entries)
        prerequisites: formData.prerequisites
          .map(p => p.trim())
          .filter(p => p !== ''),
        // Clean knowledge_required (remove empty entries)
        knowledge_required: formData.knowledge_required
          .map(k => k.trim())
          .filter(k => k !== ''),
        // Clean course_objectives (remove empty entries)
        course_objectives: formData.course_objectives
          .map(obj => obj.trim())
          .filter(obj => obj !== '')
      };
      
      // Always include courseOutcomes if they exist
      if (formData.courseOutcomes.length > 0) {
        payload.courseOutcomes = formData.courseOutcomes;
      }
      
      // Include course ID if editing
      if (isEditMode && initialData?._id) {
        payload._id = initialData._id;
      }
      
      onSubmit(payload);
    }
  };

  return (
    <div className="course-form-overlay">
      <div className="course-form-container">
        <div className="course-form-header">
          <h3>{isEditMode ? 'Edit Course' : 'Create New Course'}</h3>
          <button className="close-btn" onClick={onCancel} disabled={loading}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="course-form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="courseCode">Course Code *</label>
              <input
                type="text"
                id="courseCode"
                name="courseCode"
                value={formData.courseCode}
                onChange={handleChange}
                placeholder="e.g., CSE1101"
                disabled={loading}
              />
              {errors.courseCode && <span className="error-text">{errors.courseCode}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="credit">Credit *</label>
              <input
                type="number"
                id="credit"
                name="credit"
                value={formData.credit}
                onChange={handleChange}
                placeholder="e.g., 3"
                min="0"
                step="0.5"
                disabled={loading}
              />
              {errors.credit && <span className="error-text">{errors.credit}</span>}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="courseTitle">Course Title *</label>
            <input
              type="text"
              id="courseTitle"
              name="courseTitle"
              value={formData.courseTitle}
              onChange={handleChange}
              placeholder="e.g., Introduction to Programming"
              disabled={loading}
            />
            {errors.courseTitle && <span className="error-text">{errors.courseTitle}</span>}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="course_type">Course Type *</label>
              <select
                id="course_type"
                name="course_type"
                value={formData.course_type}
                onChange={handleChange}
                disabled={loading}
              >
                <option value="THEORY">Theory</option>
                <option value="SESSIONAL">Sessional</option>
                <option value="PROJECT/THESIS">Project/Thesis</option>
              </select>
              {errors.course_type && <span className="error-text">{errors.course_type}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="course_offered_to">Course Offered To *</label>
              <select
                id="course_offered_to"
                name="course_offered_to"
                value={formData.course_offered_to}
                onChange={handleChange}
                disabled={loading}
              >
                <option value="">Select department...</option>
                <option value="CSE">CSE - Computer Science & Engineering</option>
                <option value="EEE">EEE - Electrical & Electronic Engineering</option>
                <option value="ME">ME - Mechanical Engineering</option>
                <option value="CE">CE - Civil Engineering</option>
                <option value="ECE">ECE - Electronics & Communication Engineering</option>
                <option value="IEM">IEM - Industrial Engineering & Management</option>
                <option value="ESE">ESE - Energy Science & Engineering</option>
                <option value="BME">BME - Biomedical Engineering</option>
                <option value="URP">URP - Urban & Regional Planning</option>
                <option value="LE">LE - Leather Engineering</option>
                <option value="TE">TE - Textile Engineering</option>
                <option value="BECM">BECM - Building Engineering & Construction Management</option>
                <option value="ARCH">ARCH - Architecture</option>
                <option value="MSE">MSE - Materials Science & Engineering</option>
                <option value="CHE">CHE - Chemical Engineering</option>
                <option value="MTE">MTE - Mechatronics Engineering</option>
              </select>
              {errors.course_offered_to && <span className="error-text">{errors.course_offered_to}</span>}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="category">Category *</label>
              <select
                id="category"
                name="category"
                value={formData.category}
                onChange={handleChange}
                disabled={loading}
              >
                <option value="COMPULSORY">Compulsory</option>
                <option value="OPTIONAL">Optional</option>
              </select>
              {errors.category && <span className="error-text">{errors.category}</span>}
            </div>

            {formData.category === 'OPTIONAL' && (
              <div className="form-group">
                <label htmlFor="elective_group">Elective Group *</label>
                <select
                  id="elective_group"
                  name="elective_group"
                  value={formData.elective_group}
                  onChange={handleChange}
                  disabled={loading}
                >
                  <option value="">Select elective group...</option>
                  <option value="OPTIONAL_I">Optional I</option>
                  <option value="OPTIONAL_II">Optional II</option>
                  <option value="OPTIONAL_III">Optional III</option>
                </select>
                {errors.elective_group && <span className="error-text">{errors.elective_group}</span>}
              </div>
            )}
          </div>

          {/* Curriculum Details - Now Required */}
          <div className="form-section">
            <h4>Curriculum Details</h4>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="term">Term (1-2) *</label>
                <input
                  type="number"
                  id="term"
                  name="term"
                  value={formData.term}
                  onChange={handleChange}
                  min="1"
                  max="2"
                  disabled={loading}
                  placeholder="1 or 2"
                  required
                />
                {errors.term && <span className="error-text">{errors.term}</span>}
              </div>
              <div className="form-group">
                <label htmlFor="contactHours">Contact Hours *</label>
                <input
                  type="number"
                  id="contactHours"
                  name="contactHours"
                  value={formData.contactHours}
                  onChange={handleChange}
                  onKeyDown={(e) => {
                    // Prevent 'e', 'E', '+', '-', '.'
                    if (['e', 'E', '+', '-', '.'].includes(e.key)) {
                      e.preventDefault();
                    }
                  }}
                  onInput={(e) => {
                    // Limit to single digit (0-9)
                    if (e.target.value.length > 1) {
                      e.target.value = e.target.value.slice(0, 1);
                    }
                    // Ensure value is between 0-9
                    if (e.target.value !== '' && (parseInt(e.target.value) < 0 || parseInt(e.target.value) > 9)) {
                      e.target.value = '';
                    }
                  }}
                  min="0"
                  max="9"
                  step="1"
                  disabled={loading}
                  placeholder="e.g., 3"
                  required
                />
                {errors.contactHours && <span className="error-text">{errors.contactHours}</span>}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="academicYear">Academic Year *</label>
                <input
                  type="text"
                  id="academicYear"
                  name="academicYear"
                  value={formData.academicYear}
                  onChange={handleChange}
                  placeholder="e.g., 2024"
                  pattern="\d{4}"
                  maxLength="4"
                  disabled={loading}
                  required
                />
                {formData.academicYear && formData.academicYear.length === 4 && parseInt(formData.academicYear) >= 1967 ? (
                  <small style={{ color: '#28a745', marginTop: '4px', display: 'block', fontWeight: '500' }}>
                    ✓ Format: {formData.academicYear}-{String(parseInt(formData.academicYear) + 1).slice(-2)}
                  </small>
                ) : formData.academicYear && formData.academicYear.length > 0 ? (
                  <small style={{ color: '#dc3545', marginTop: '4px', display: 'block' }}>
                    Enter a valid 4-digit year (≥1967)
                  </small>
                ) : null}
                {errors.academicYear && <span className="error-text">{errors.academicYear}</span>}
              </div>
              <div className="form-group">
                <label htmlFor="yearLevel">
                  Year Level (1-{formData.course_offered_to === 'ARCH' ? '5' : '4'}) *
                </label>
                <input
                  type="number"
                  id="yearLevel"
                  name="yearLevel"
                  value={formData.yearLevel}
                  onChange={handleChange}
                  min="1"
                  max={formData.course_offered_to === 'ARCH' ? '5' : '4'}
                  disabled={loading}
                  required
                />
                {errors.yearLevel && <span className="error-text">{errors.yearLevel}</span>}
              </div>
            </div>
          </div>

          {/* Knowledge Required */}
          <div className="form-section">
            <div className="section-header">
              <label className="section-label">Knowledge Required *</label>
              <button type="button" className="btn-add-small" onClick={addKnowledgeRequired} disabled={loading}>
                + Add Knowledge
              </button>
            </div>
            {errors.knowledge_required && <span className="error-text" style={{display: 'block', marginBottom: '10px'}}>{errors.knowledge_required}</span>}
            {formData.knowledge_required.length === 0 && (
              <p style={{color: '#666', fontSize: '14px', marginBottom: '10px'}}>No knowledge required yet. Click "+ Add Knowledge" to start.</p>
            )}
            {formData.knowledge_required.map((knowledge, index) => (
              <div key={index} className="array-item">
                <input
                  type="text"
                  value={knowledge}
                  onChange={(e) => updateKnowledgeRequired(index, e.target.value)}
                  placeholder="e.g., Basic programming concepts"
                  disabled={loading}
                />
                <button
                  type="button"
                  className="btn-remove-small"
                  onClick={() => removeKnowledgeRequired(index)}
                  disabled={loading}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {/* Course Objectives */}
          <div className="form-section">
            <div className="section-header">
              <label className="section-label">Course Objectives *</label>
              <button type="button" className="btn-add-small" onClick={addCourseObjective} disabled={loading}>
                + Add Objective
              </button>
            </div>
            {errors.course_objectives && <span className="error-text" style={{display: 'block', marginBottom: '10px'}}>{errors.course_objectives}</span>}
            {formData.course_objectives.length === 0 && (
              <p style={{color: '#666', fontSize: '14px', marginBottom: '10px'}}>No course objectives yet. Click "+ Add Objective" to start.</p>
            )}
            {formData.course_objectives.map((objective, index) => (
              <div key={index} className="array-item">
                <input
                  type="text"
                  value={objective}
                  onChange={(e) => updateCourseObjective(index, e.target.value)}
                  placeholder="e.g., Understand object-oriented programming principles"
                  disabled={loading}
                />
                <button
                  type="button"
                  className="btn-remove-small"
                  onClick={() => removeCourseObjective(index)}
                  disabled={loading}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {/* Course Content */}
          <div className="form-section">
            <div className="section-header">
              <label className="section-label">Course Content *</label>
              <button type="button" className="btn-add-small" onClick={addCourseContent} disabled={loading}>
                + Add Content
              </button>
            </div>
            {errors.course_content && <span className="error-text" style={{display: 'block', marginBottom: '10px'}}>{errors.course_content}</span>}
            {formData.course_content.map((content, index) => (
              <div key={index} className="course-content-item" style={{marginBottom: '15px', padding: '15px', border: '1px solid #ddd', borderRadius: '4px'}}>
                <div className="form-group" style={{marginBottom: '10px'}}>
                  <label>Concept Name *</label>
                  <input
                    type="text"
                    value={content.concept_name}
                    onChange={(e) => updateCourseContent(index, 'concept_name', e.target.value)}
                    placeholder="e.g., Object-Oriented Programming"
                    disabled={loading}
                  />
                </div>
                <div className="form-group" style={{marginBottom: '10px'}}>
                  <label>Concept Description *</label>
                  <textarea
                    value={content.concept_description}
                    onChange={(e) => updateCourseContent(index, 'concept_description', e.target.value)}
                    placeholder="Detailed description of the concept..."
                    disabled={loading}
                    rows="3"
                    style={{width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc'}}
                  />
                </div>
                <button
                  type="button"
                  className="btn-remove-small"
                  onClick={() => removeCourseContent(index)}
                  disabled={loading}
                  style={{marginTop: '5px'}}
                >
                  ✕ Remove
                </button>
              </div>
            ))}
            {formData.course_content.length === 0 && (
              <p style={{color: '#666', fontStyle: 'italic', marginTop: '10px'}}>
                No course content added yet. Click "+ Add Content" to begin.
              </p>
            )}
          </div>

          {/* KPA Mapping */}
          <div className="form-section">
            <label className="section-label">Mapping of Knowledge Profile, Complex Engineering Problem Solving and Complex Engineering Activities *</label>
            {errors.kpa_mapping && <span className="error-text" style={{display: 'block', marginBottom: '10px'}}>{errors.kpa_mapping}</span>}
            
            <div style={{marginTop: '10px'}}>
              <div style={{display: 'flex', flexWrap: 'wrap', gap: '12px'}}>
                {['K1', 'K2', 'K3', 'K4', 'K5', 'K6', 'K7', 'K8'].map(kpa => (
                  <label key={kpa} style={{display: 'flex', alignItems: 'center', cursor: 'pointer', minWidth: '60px'}}>
                    <input
                      type="checkbox"
                      value={kpa}
                      checked={formData.kpa_mapping.includes(kpa)}
                      onChange={() => handleKPAChange(kpa)}
                      disabled={loading}
                      style={{marginRight: '6px', cursor: 'pointer'}}
                    />
                    <span>{kpa}</span>
                  </label>
                ))}
                {['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7'].map(kpa => (
                  <label key={kpa} style={{display: 'flex', alignItems: 'center', cursor: 'pointer', minWidth: '60px'}}>
                    <input
                      type="checkbox"
                      value={kpa}
                      checked={formData.kpa_mapping.includes(kpa)}
                      onChange={() => handleKPAChange(kpa)}
                      disabled={loading}
                      style={{marginRight: '6px', cursor: 'pointer'}}
                    />
                    <span>{kpa}</span>
                  </label>
                ))}
                {['A1', 'A2', 'A3', 'A4', 'A5'].map(kpa => (
                  <label key={kpa} style={{display: 'flex', alignItems: 'center', cursor: 'pointer', minWidth: '60px'}}>
                    <input
                      type="checkbox"
                      value={kpa}
                      checked={formData.kpa_mapping.includes(kpa)}
                      onChange={() => handleKPAChange(kpa)}
                      disabled={loading}
                      style={{marginRight: '6px', cursor: 'pointer'}}
                    />
                    <span>{kpa}</span>
                  </label>
                ))}
              </div>

              {formData.kpa_mapping.length > 0 && (
                <div style={{marginTop: '10px', padding: '10px', backgroundColor: '#f0f9ff', borderRadius: '4px', border: '1px solid #bfdbfe'}}>
                  <strong style={{color: '#1e40af'}}>Selected: </strong>
                  <span style={{color: '#1e40af'}}>{formData.kpa_mapping.join(', ')}</span>
                </div>
              )}
            </div>
          </div>

          {/* Lecture Plan */}
          <div className="form-section">
            <div className="section-header">
              <label className="section-label">Lecture Plan (Week 1-13) *</label>
              <button 
                type="button" 
                className="btn-add-small" 
                onClick={addLecturePlan} 
                disabled={loading || formData.lecture_plan.length >= 13}
                title={formData.lecture_plan.length >= 13 ? 'Maximum 13 entries allowed' : 'Add lecture plan entry'}
              >
                + Add Week
              </button>
            </div>
            {errors.lecture_plan && <span className="error-text" style={{display: 'block', marginBottom: '10px'}}>{errors.lecture_plan}</span>}
            {formData.lecture_plan.length === 0 && (
              <p style={{color: '#666', fontSize: '14px', marginBottom: '10px'}}>No lecture plan entries yet. Click "+ Add Week" to start.</p>
            )}
            {formData.lecture_plan.map((item, index) => {
              const usedWeeks = formData.lecture_plan
                .map((lp, i) => i !== index ? parseInt(lp.week) : null)
                .filter(w => w !== null && !isNaN(w));
              
              const rowError = lecturePlanErrors[index] || {};
              const hasError = rowError.week || rowError.plan;
              
              return (
                <div 
                  key={index} 
                  className="lecture-plan-item" 
                  style={{
                    marginBottom: '15px', 
                    padding: '15px', 
                    border: hasError ? '2px solid #dc3545' : '1px solid #ddd', 
                    borderRadius: '4px', 
                    backgroundColor: hasError ? '#fff5f5' : '#fafafa',
                    boxShadow: hasError ? '0 0 5px rgba(220, 53, 69, 0.2)' : 'none'
                  }}
                >
                  <div style={{display: 'flex', gap: '15px', alignItems: 'flex-start'}}>
                    <div className="form-group" style={{flex: '0 0 120px', marginBottom: '0'}}>
                      <label>Week *</label>
                      <select
                        value={item.week}
                        onChange={(e) => updateLecturePlan(index, 'week', parseInt(e.target.value))}
                        disabled={loading}
                        style={{
                          width: '100%',
                          borderColor: rowError.week ? '#dc3545' : undefined,
                          borderWidth: rowError.week ? '2px' : undefined
                        }}
                      >
                        <option value="">Select</option>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map(week => (
                          <option 
                            key={week} 
                            value={week}
                            disabled={usedWeeks.includes(week)}
                            style={{color: usedWeeks.includes(week) ? '#ccc' : 'inherit'}}
                          >
                            Week {week} {usedWeeks.includes(week) ? '(used)' : ''}
                          </option>
                        ))}
                      </select>
                      {rowError.week && (
                        <span style={{color: '#dc3545', fontSize: '12px', marginTop: '4px', display: 'block'}}>
                          {rowError.week}
                        </span>
                      )}
                    </div>
                    <div className="form-group" style={{flex: '1', marginBottom: '0'}}>
                      <label>Lecture Plan *</label>
                      <textarea
                        value={item.plan}
                        onChange={(e) => updateLecturePlan(index, 'plan', e.target.value)}
                        placeholder="Describe the lecture plan for this week"
                        disabled={loading}
                        rows="2"
                        style={{
                          width: '100%', 
                          resize: 'vertical',
                          borderColor: rowError.plan ? '#dc3545' : undefined,
                          borderWidth: rowError.plan ? '2px' : undefined
                        }}
                      />
                      {rowError.plan && (
                        <span style={{color: '#dc3545', fontSize: '12px', marginTop: '4px', display: 'block'}}>
                          {rowError.plan}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      className="btn-remove-small"
                      onClick={() => removeLecturePlan(index)}
                      disabled={loading}
                      style={{marginTop: '28px'}}
                      title="Remove this week"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* References */}
          <div className="form-section">
            <div className="section-header">
              <label className="section-label">References *</label>
              <button type="button" className="btn-add-small" onClick={addReference} disabled={loading}>
                + Add Reference
              </button>
            </div>
            {errors.references && <span className="error-text" style={{display: 'block', marginBottom: '10px'}}>{errors.references}</span>}
            {formData.references.length === 0 && (
              <p style={{color: '#666', fontSize: '14px', marginBottom: '10px'}}>No references yet. Click "+ Add Reference" to start.</p>
            )}
            {formData.references.map((ref, index) => {
              const hasError = referencesErrors[index];
              
              return (
                <div 
                  key={index} 
                  className="array-item"
                  style={{
                    padding: hasError ? '10px' : undefined,
                    border: hasError ? '2px solid #dc3545' : undefined,
                    borderRadius: hasError ? '4px' : undefined,
                    backgroundColor: hasError ? '#fff5f5' : undefined,
                    marginBottom: hasError ? '10px' : undefined
                  }}
                >
                  <input
                    type="text"
                    value={ref}
                    onChange={(e) => updateReference(index, e.target.value)}
                    onBlur={() => trimReference(index)}
                    placeholder="e.g., Introduction to Algorithms by Cormen et al."
                    disabled={loading}
                    style={{
                      borderColor: hasError ? '#dc3545' : undefined,
                      borderWidth: hasError ? '2px' : undefined
                    }}
                  />
                  <button
                    type="button"
                    className="btn-remove-small"
                    onClick={() => removeReference(index)}
                    disabled={loading}
                  >
                    ✕
                  </button>
                  {hasError && (
                    <span style={{color: '#dc3545', fontSize: '12px', marginTop: '4px', display: 'block', marginLeft: '0'}}>
                      {hasError}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Prerequisites */}
          <div className="form-section">
            <div className="section-header">
              <label className="section-label">Prerequisites (Optional)</label>
              <button type="button" className="btn-add-small" onClick={addPrerequisite} disabled={loading}>
                + Add
              </button>
            </div>
            {formData.prerequisites.map((prereq, index) => (
              <div key={index} className="array-item">
                <input
                  type="text"
                  value={prereq}
                  onChange={(e) => updatePrerequisite(index, e.target.value)}
                  placeholder="e.g., CSE1101"
                  disabled={loading}
                />
                <button
                  type="button"
                  className="btn-remove-small"
                  onClick={() => removePrerequisite(index)}
                  disabled={loading}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {/* Course Outcomes & CO-PO Mapping */}
          <CourseOutcomeEditor
            courseOutcomes={formData.courseOutcomes}
            onChange={(outcomes) => setFormData({ ...formData, courseOutcomes: outcomes })}
            onValidationChange={(isValid) => setIsCOValidationValid(isValid)}
          />

          <div className="form-actions">
            <button
              type="button"
              className="btn-cancel"
              onClick={onCancel}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`btn-submit ${loading ? 'loading' : ''}`}
              disabled={
                loading || 
                (formData.courseOutcomes.length > 0 && !isCOValidationValid) ||
                (formData.lecture_plan.length > 0 && lecturePlanErrors.some(err => err.week || err.plan)) ||
                formData.lecture_plan.length === 0 ||
                formData.lecture_plan.length > 13 ||
                formData.references.length === 0 ||
                referencesErrors.some(err => err !== null)
              }
              title={
                !isCOValidationValid ? 'Please fix Course Outcome validation errors before saving' :
                formData.lecture_plan.length === 0 ? 'At least one lecture plan entry is required' :
                formData.lecture_plan.length > 13 ? 'Maximum 13 lecture plan entries allowed' :
                lecturePlanErrors.some(err => err.week || err.plan) ? 'Please fix lecture plan errors before saving' :
                formData.references.length === 0 ? 'At least one reference is required' :
                referencesErrors.some(err => err !== null) ? 'Please fill or remove empty references' :
                ''
              }
            >
              {loading && <span className="spinner"></span>}
              {loading ? (isEditMode ? 'Updating...' : 'Creating...') : (isEditMode ? 'Update Course' : 'Create Course')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CourseForm;
