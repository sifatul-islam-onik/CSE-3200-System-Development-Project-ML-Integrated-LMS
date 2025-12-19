import React, { useState } from 'react';
import '../styles/CourseForm.css';
import '../styles/spinner.css';

const CourseForm = ({ onSubmit, onCancel, loading }) => {
  const [formData, setFormData] = useState({
    courseCode: '',
    courseTitle: '',
    courseType: 'Core',
    credit: '',
    department: '',
    isPublished: false
  });

  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
    // Clear error for this field
    if (errors[name]) {
      setErrors({ ...errors, [name]: '' });
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

    if (!formData.department.trim()) {
      newErrors.department = 'Department is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) {
      onSubmit(formData);
    }
  };

  return (
    <div className="course-form-overlay">
      <div className="course-form-container">
        <div className="course-form-header">
          <h3>Create New Course</h3>
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
                placeholder="e.g., CSE101"
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
              <label htmlFor="courseType">Course Type *</label>
              <select
                id="courseType"
                name="courseType"
                value={formData.courseType}
                onChange={handleChange}
                disabled={loading}
              >
                <option value="Core">Core</option>
                <option value="Optional">Optional</option>
                <option value="Lab">Lab</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="department">Department *</label>
              <input
                type="text"
                id="department"
                name="department"
                value={formData.department}
                onChange={handleChange}
                placeholder="e.g., Computer Science"
                disabled={loading}
              />
              {errors.department && <span className="error-text">{errors.department}</span>}
            </div>
          </div>

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="isPublished"
                checked={formData.isPublished}
                onChange={handleChange}
                disabled={loading}
              />
              <span>Publish course immediately</span>
            </label>
          </div>

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
              disabled={loading}
            >
              {loading && <span className="spinner"></span>}
              {loading ? 'Creating...' : 'Create Course'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CourseForm;
