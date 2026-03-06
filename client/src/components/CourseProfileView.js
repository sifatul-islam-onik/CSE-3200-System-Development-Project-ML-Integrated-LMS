import React, { useState, useEffect } from 'react';
import { getCourseProfile, updateCLOField } from '../services/courseProfileService';
import '../styles/CourseProfileView.css';

const CourseProfileView = () => {
  const [clos, setClos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editingCell, setEditingCell] = useState(null);
  const [saving, setSaving] = useState(false);
  const [userRole, setUserRole] = useState('');

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    setUserRole(user.role || '');
    loadCourseProfile();
  }, []);

  const loadCourseProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getCourseProfile();
      setClos(response.data || []);
    } catch (err) {
      console.error('Course Profile Error:', err);
      setError(err.error || 'Failed to load course profile');
    } finally {
      setLoading(false);
    }
  };

  const handleCellEdit = (cloNumber, field, currentValue) => {
    if (userRole !== 'teacher' && userRole !== 'admin') {
      return;
    }
    setEditingCell({ cloNumber, field, value: currentValue });
  };

  const handleCellSave = async () => {
    if (!editingCell) return;

    try {
      setSaving(true);
      await updateCLOField(editingCell.cloNumber, editingCell.field, editingCell.value);
      await loadCourseProfile();
      setEditingCell(null);
    } catch (err) {
      alert(err.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleCellCancel = () => {
    setEditingCell(null);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleCellSave();
    } else if (e.key === 'Escape') {
      handleCellCancel();
    }
  };

  const canEdit = userRole === 'teacher' || userRole === 'admin';

  const renderCell = (clo, field, value) => {
    const isEditing = editingCell?.cloNumber === clo.cloNumber && editingCell?.field === field;

    if (isEditing) {
      return (
        <input
          type="text"
          value={editingCell.value || ''}
          onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
          onBlur={handleCellSave}
          onKeyDown={handleKeyDown}
          autoFocus
          disabled={saving}
          className="edit-input"
        />
      );
    }

    return (
      <div
        className={`cell-content ${canEdit ? 'editable' : ''}`}
        onClick={() => canEdit && handleCellEdit(clo.cloNumber, field, value)}
        title={canEdit ? 'Click to edit' : ''}
      >
        {value || '-'}
      </div>
    );
  };

  if (loading && clos.length === 0) {
    return <div className="profile-loading">Loading...</div>;
  }

  return (
    <div className="course-profile-container">
      <h1>Course Profile - Learning Outcomes</h1>

      {error && (
        <div className="profile-error" style={{ marginBottom: '20px' }}>
          Error: {error}
        </div>
      )}

      <div className="instructions" style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#f0f8ff', borderRadius: '4px', fontSize: '13px' }}>
        <strong>Instructions:</strong> 
        <ul style={{ marginTop: '5px', marginBottom: '0' }}>
          <li>Bloom's Learning Levels (C, A, P, S): Enter numerical values (1-6)</li>
          <li>PLOs Assessed: Enter PLO numbers (e.g., "1,2,3" for PLO1, PLO2, PLO3)</li>
          <li>CLO-PLO Correlation: Enter correlation strength as a number</li>
        </ul>
      </div>

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
                  {renderCell(clo, 'description', clo.description)}
                </td>
                <td className="bloom-level">
                  {renderCell(clo, 'bloomC', clo.bloomLevels.cognitive)}
                </td>
                <td className="bloom-level">
                  {renderCell(clo, 'bloomA', clo.bloomLevels.affective)}
                </td>
                <td className="bloom-level">
                  {renderCell(clo, 'bloomP', clo.bloomLevels.psychomotor)}
                </td>
                <td className="bloom-level">
                  {renderCell(clo, 'bloomS', clo.bloomLevels.social)}
                </td>
                <td className="plo-assessed">
                  {renderCell(clo, 'ploAssessed', clo.ploAssessed)}
                </td>
                <td className="clo-plo-corr">
                  {renderCell(clo, 'cloPloCorrelation', clo.cloPloCorrelation)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canEdit && (
        <div className="edit-instructions">
          Click on any cell to edit. Press Enter to save or Esc to cancel.
        </div>
      )}
    </div>
  );
};

export default CourseProfileView;
