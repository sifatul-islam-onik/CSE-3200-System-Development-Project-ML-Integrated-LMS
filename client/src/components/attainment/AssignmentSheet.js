import React, { useState } from 'react';

const ASSIGN_INPUT_CSS = `
.assign-cell-input {
  display: block;
  width: 100%;
  min-width: 48px;
  box-sizing: border-box;
  padding: 5px 4px;
  background: transparent;
  border: 1px solid transparent;
  border-bottom: 1.5px solid #c8d0da;
  border-radius: 0;
  font-size: 15px;
  font-family: inherit;
  text-align: center;
  color: #1a2332;
  outline: none;
  transition: border-color 0.15s, background 0.15s;
}
.assign-cell-input:hover {
  border-bottom-color: #5c7cfa;
  background: rgba(92,124,250,0.04);
}
.assign-cell-input:focus {
  border: 1px solid #5c7cfa;
  border-radius: 4px;
  background: #fff;
  box-shadow: 0 0 0 2px rgba(92,124,250,0.15);
}
/* hide browser number spinners */
.assign-cell-input::-webkit-inner-spin-button {display:none;}
`;

let _assignStyleInjected = false;
const injectAssignStyles = () => {
  if (_assignStyleInjected) return;
  const tag = document.createElement('style');
  tag.textContent = ASSIGN_INPUT_CSS;
  document.head.appendChild(tag);
  _assignStyleInjected = true;
};

const AssignmentSheet = ({
  clos,
  assignmentRows,
  attnAssignObtainedRows,
  attendanceMarks,
  assignmentManualWts,
  assignmentSummary,
  // Setters
  setAssignmentRows,
  setAttnAssignObtainedRows,
  setAssignmentManualWts,
  setShowGeneratedTableModal,
  setShowObtainedGeneratedModal,
  // Save
  handleManualSaveAssignment,
  // Helpers
  getActiveAssignments,
  getActiveAssignmentFields,
  computeAssignmentCOTotal,
  assignmentColumnGroupTotals,
  calculateAutoAssignmentFactor,
  calculateAssignmentAutoEqWt,
  sumAssignmentEqWtTotal,
  sumAssignmentManualWtTotal,
  formatNumber,
}) => {
  injectAssignStyles();
  const [saving, setSaving] = useState(false);
  const [activeSaveButton, setActiveSaveButton] = useState(null);
  const [saveMsg, setSaveMsg] = useState('');

  const handleSave = async (buttonId, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (saving) return;
    setSaving(true);
    setActiveSaveButton(buttonId);
    setSaveMsg('');
    try {
      await handleManualSaveAssignment(buttonId);
      setSaveMsg('Saved!');
    } catch (e) {
      setSaveMsg('Save failed');
    } finally {
      setSaving(false);
      setActiveSaveButton(null);
      setTimeout(() => setSaveMsg(''), 3000);
    }
  };

  const handleAssignmentCoMapCell = (rowIdx, field, raw) => {
    const val = raw === '' ? 0 : (isNaN(parseFloat(raw)) ? 0 : parseFloat(raw));
    setAssignmentRows(prev => prev.map((r, i) => i === rowIdx ? { ...r, [field]: val } : r));
  };

  const handleObtainedCell = (rowIdx, field, raw) => {
    const trimmed = raw.trim();
    const val = trimmed === '' ? 0 : isNaN(parseFloat(trimmed)) ? 0 : parseFloat(trimmed);

    const qCO_total = assignmentRows.reduce((sum, r) => sum + (parseFloat(r[field]) || 0), 0);
    if (qCO_total > 0 && val > qCO_total) return;

    setAttnAssignObtainedRows(prev => prev.map((r, i) => i === rowIdx ? { ...r, [field]: val } : r));
  };

  const handleAttendanceCell = (rowIdx, raw) => {
    const trimmed = raw.trim();
    const val = trimmed === '' ? 0 : isNaN(parseFloat(trimmed)) ? 0 : parseFloat(trimmed);

    if (assignmentSummary.attendancePerformance > 0 && val > assignmentSummary.attendancePerformance) return;

    setAttnAssignObtainedRows(prev => prev.map((r, i) => i === rowIdx ? { ...r, attendance: val } : r));
  };
  return (
    <section className="ct-section" style={{ marginTop: '30px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
        <h2 style={{ margin: 0 }}>Allocated Marks for Attendance and Assignment (if taken)</h2>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {saveMsg && (
  <div style={{
    position: 'fixed',
    bottom: '40px',
    right: '40px',
    backgroundColor: '#ffffff',
    color: '#1e293b',
    padding: '16px 24px',
    borderRadius: '8px',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
    border: '1px solid #e2e8f0',
    fontSize: '14.5px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    zIndex: 9999,
    minWidth: '250px',
    letterSpacing: '-0.01em',
    animation: 'toastSlideInOut 3s ease-in-out forwards',
    overflow: 'hidden'
  }}>
    <style>{`
      @keyframes toastSlideInOut {
        0% { transform: translateX(120%); opacity: 0; }
        10% { transform: translateX(0); opacity: 1; }
        90% { transform: translateX(0); opacity: 1; }
        100% { transform: translateX(120%); opacity: 0; }
      }
      @keyframes toastProgress {
        0% { width: 100%; left: 0; right: auto; }
        100% { width: 0%; left: 0; right: auto; }
      }
    `}</style>
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '24px',
      height: '24px',
      borderRadius: '50%',
      backgroundColor: saveMsg === 'Saved!' ? '#dcfce7' : '#fee2e2',
      color: saveMsg === 'Saved!' ? '#16a34a' : '#dc2626',
      fontSize: '14px',
      fontWeight: 'bold',
      zIndex: 1
    }}>
      {saveMsg === 'Saved!' ? '✓' : '✕'}
    </div>
    <span style={{ fontWeight: 500, zIndex: 1 }}>{saveMsg}</span>
    <div style={{
      position: 'absolute',
      bottom: 0,
      left: 0,
      height: '4px',
      backgroundColor: saveMsg === 'Saved!' ? '#22c55e' : '#ef4444',
      animation: 'toastProgress 2.8s linear forwards'
    }} />
  </div>
)}
          <button type="button" onClick={(e) => handleSave('top', e)} disabled={saving && activeSaveButton === 'top'} className="btn-professional btn-success">
            {saving && activeSaveButton === 'top' ? 'Saving...' : 'Save'}
          </button>
          <button type="button" onClick={() => setShowGeneratedTableModal(true)} className="btn-professional btn-primary">
            View Generated Table
          </button>
        </div>
      </div>

      {clos.length === 0 && (
        <p style={{ padding: '20px', color: '#7f8c8d' }}>Loading course outcomes...</p>
      )}

      {clos.length > 0 && (
        <>
          {/* Allocated Marks Table */}
          <div className="table-wrapper" style={{ overflowX: 'auto' }}>
            <table className="ct-table" style={{ minWidth: '560px', width: '100%' }}>
              <thead>
                <tr>
                  <th rowSpan="3">CO No.</th>
                  <th rowSpan="2">Attendance Performance</th>
                  <th colSpan={getActiveAssignments().length * 3}>CO mapping of Assignment Marks</th>
                  <th rowSpan="3">CO Total</th>
                </tr>
                <tr>
                  {getActiveAssignments().map(assignment => (
                    <th key={assignment} colSpan="3">{assignment.replace('Assgn', 'Assignment ')}</th>
                  ))}
                </tr>
                <tr>
                  <th>{assignmentSummary.attendancePerformance ?? 0}</th>
                  {getActiveAssignments().map((assignment) => (
                    <React.Fragment key={assignment}>
                      <th>Q1</th>
                      <th>Q2</th>
                      <th>Q3</th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {assignmentRows.map((row, idx) => (
                  <tr key={row.coNumber || idx}>
                    <td className="co-label">{row.coNumber || '-'}</td>
                    <td>-</td>
                    {getActiveAssignmentFields().map(field => (
                      <td key={field} style={{ padding: '2px 3px' }}>
                        <input
                          type="text"
                          className="assign-cell-input"
                          value={row[field] ?? 0}
                          onChange={e => handleAssignmentCoMapCell(idx, field, e.target.value)}
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
                  {(() => {
                    const assignmentTotals = assignmentColumnGroupTotals();
                    return (
                      <>
                        {getActiveAssignments().map(assignment => (
                          <td key={assignment} colSpan={3} style={{ textAlign: 'center', fontWeight: 'bold' }}>
                            {assignmentTotals[assignment] || 0}
                          </td>
                        ))}
                      </>
                    );
                  })()}
                  <td>{assignmentRows.reduce((sum, r) => sum + computeAssignmentCOTotal(r), 0)}</td>
                </tr>
                <tr>
                  <td className="footer-label" colSpan={2}>Factor</td>
                  {getActiveAssignments().map(assignment => {
                    const autoFactor = calculateAutoAssignmentFactor();
                    return (
                      <td key={assignment} colSpan={3} style={{ textAlign: 'center' }}>
                        {formatNumber(autoFactor[assignment] || 0)}
                      </td>
                    );
                  })}
                  <td></td>
                </tr>
                <tr>
                  <td className="footer-label" colSpan={2}>Eq. Wt</td>
                  {getActiveAssignments().map(assignment => {
                    const autoEqWt = calculateAssignmentAutoEqWt();
                    return (
                      <td key={assignment} colSpan={3} style={{ textAlign: 'center' }}>
                        {formatNumber(autoEqWt[assignment] || 0)}
                      </td>
                    );
                  })}
                  <td><strong>{formatNumber(sumAssignmentEqWtTotal())}</strong></td>
                </tr>
                <tr>
                  <td className="footer-label" colSpan={2}>Manual Wt</td>
                  {getActiveAssignments().map(assignment => (
                    <td key={assignment} colSpan={3} style={{ padding: '2px 3px', textAlign: 'center' }}>
                      <input
                        type="text"
                        className="assign-cell-input"
                        value={assignmentManualWts[assignment] ?? 0}
                        onChange={e => {
                          const raw = e.target.value;
                          const val = raw === '' ? 0 : isNaN(parseFloat(raw)) ? 0 : parseFloat(raw);
                          setAssignmentManualWts(prev => ({ ...prev, [assignment]: val }));
                        }}
                        style={{ width: '80px', display: 'inline-block' }}
                      />
                    </td>
                  ))}
                  <td><strong>{formatNumber(sumAssignmentManualWtTotal())}</strong></td>
                </tr>
                <tr>
                  <td className="footer-label" style={{ fontWeight: 'bold', color: '#065f46' }}>Status</td>
                  {(() => {
                    const manualTotal = sumAssignmentManualWtTotal();
                    const assignmentMarks = assignmentSummary.assignmentMarks30 || 0;
                    const useEqWt = assignmentSummary.useEqWt || 0;
                    let message = '';
                    let messageColor = '#27ae60';
                    if (manualTotal === assignmentMarks) {
                      message = 'OK';
                    } else if (useEqWt === 0) {
                      message = `Sum should be ${assignmentMarks}`;
                      messageColor = '#e74c3c';
                    } else {
                      message = `Sum should be ${assignmentMarks}, you can ignore as Eq. wt=1`;
                      messageColor = '#059669';
                    }
                    return (
                      <td colSpan={1 + getActiveAssignments().length * 3 + 1} style={{ textAlign: 'center', fontWeight: 'bold', color: messageColor }}>
                        {message}
                      </td>
                    );
                  })()}
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Summary Table */}
          <div className="table-wrapper" style={{ marginTop: '20px' }}>
            <table className="ct-table">
              <tbody>
                <tr>
                  <td style={{ backgroundColor: '#f8f9fa', fontWeight: 600 }}>Assign. Taken</td>
                  <td style={{ textAlign: 'center' }}>{assignmentSummary.assignTaken ?? 0}</td>
                </tr>
                <tr>
                  <td style={{ backgroundColor: '#f8f9fa', fontWeight: 600 }}>Assignment Marks out of 30</td>
                  <td style={{ textAlign: 'center' }}>{assignmentSummary.assignmentMarks30 ?? 0}</td>
                </tr>
                <tr>
                  <td style={{ backgroundColor: '#f8f9fa', fontWeight: 600 }}>Use Eq. Wt</td>
                  <td style={{ textAlign: 'center' }}>{assignmentSummary.useEqWt ?? 0}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Obtained Marks Table */}
          <section style={{ marginTop: '30px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
              <h3 style={{ margin: 0 }}>Obtained Marks for Attendance, Performance and Assignment</h3>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                {saveMsg && (
  <div style={{
    position: 'fixed',
    bottom: '40px',
    right: '40px',
    backgroundColor: '#ffffff',
    color: '#1e293b',
    padding: '16px 24px',
    borderRadius: '8px',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
    border: '1px solid #e2e8f0',
    fontSize: '14.5px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    zIndex: 9999,
    minWidth: '250px',
    letterSpacing: '-0.01em',
    animation: 'toastSlideInOut 3s ease-in-out forwards',
    overflow: 'hidden'
  }}>
    <style>{`
      @keyframes toastSlideInOut {
        0% { transform: translateX(120%); opacity: 0; }
        10% { transform: translateX(0); opacity: 1; }
        90% { transform: translateX(0); opacity: 1; }
        100% { transform: translateX(120%); opacity: 0; }
      }
      @keyframes toastProgress {
        0% { width: 100%; left: 0; right: auto; }
        100% { width: 0%; left: 0; right: auto; }
      }
    `}</style>
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '24px',
      height: '24px',
      borderRadius: '50%',
      backgroundColor: saveMsg === 'Saved!' ? '#dcfce7' : '#fee2e2',
      color: saveMsg === 'Saved!' ? '#16a34a' : '#dc2626',
      fontSize: '14px',
      fontWeight: 'bold',
      zIndex: 1
    }}>
      {saveMsg === 'Saved!' ? '✓' : '✕'}
    </div>
    <span style={{ fontWeight: 500, zIndex: 1 }}>{saveMsg}</span>
    <div style={{
      position: 'absolute',
      bottom: 0,
      left: 0,
      height: '4px',
      backgroundColor: saveMsg === 'Saved!' ? '#22c55e' : '#ef4444',
      animation: 'toastProgress 2.8s linear forwards'
    }} />
  </div>
)}
                <button type="button" onClick={(e) => handleSave('bottom', e)} disabled={saving && activeSaveButton === 'bottom'} className="btn-professional btn-success">
                  {saving && activeSaveButton === 'bottom' ? 'Saving...' : 'Save'}
                </button>
                <button type="button" onClick={() => setShowObtainedGeneratedModal(true)} className="btn-professional btn-primary">
                  View Generated Obtained Table
                </button>
              </div>
            </div>
            <div className="table-wrapper" style={{ overflowX: 'auto' }}>
              <table className="ct-obtained-table" style={{ minWidth: '560px', width: '100%' }}>
                <thead>
                  {(() => {
                    const colTotals = assignmentColumnGroupTotals();
                    const assignmentTotal = getActiveAssignments().reduce((sum, a) => sum + (colTotals[a] || 0), 0);
                    return (
                      <>
                        <tr>
                          <th rowSpan={3}>Roll</th>
                          <th rowSpan={3}>Attendance Performance ({assignmentSummary.attendancePerformance ?? 0})</th>
                          <th colSpan={getActiveAssignments().length * 3}>Assignment marks obtained out of {assignmentTotal}</th>
                          <th rowSpan={3}>Total ({assignmentTotal})</th>
                        </tr>
                        <tr>
                          {getActiveAssignments().map((assignment, index) => (
                            <th key={assignment} colSpan={3}>
                              Assignment {index + 1} ({colTotals[assignment] || 0})
                            </th>
                          ))}
                        </tr>
                      </>
                    );
                  })()}
                  <tr>
                    {getActiveAssignments().map((assignment) => (
                      <React.Fragment key={assignment}>
                        <th>Q1</th><th>Q2</th><th>Q3</th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {attnAssignObtainedRows.length > 0 ? attnAssignObtainedRows.map((row, idx) => (
                    <tr key={`assign-${row.rollNumber}-${idx}`}>
                      <td>{row.rollNumber || '-'}</td>
                      <td style={{ padding: '2px 3px' }}>
                        <input
                          type="text"
                          className="assign-cell-input"
                          value={row.attendance ?? 0}
                          onChange={e => handleAttendanceCell(idx, e.target.value)}
                        />
                      </td>
                      {getActiveAssignmentFields().map(field => (
                        <td key={field} style={{ padding: '2px 3px' }}>
                          <input
                            type="text"
                            className="assign-cell-input"
                            value={row[field] ?? 0}
                            onChange={e => handleObtainedCell(idx, field, e.target.value)}
                          />
                        </td>
                      ))}
                      <td style={{ textAlign: 'center' }}>{getActiveAssignmentFields().reduce((sum, field) => sum + (typeof row[field] === 'number' ? row[field] : 0), 0)}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={2 + getActiveAssignments().length * 3 + 1} style={{ textAlign: 'center', color: '#7f8c8d', padding: '20px' }}>
                        <div style={{ marginBottom: '10px' }}>
                          <strong>No data uploaded yet.</strong>
                        </div>
                        <div style={{ fontSize: '14px', lineHeight: '1.4' }}>
                          Use the <em>Attendance &amp; Assignments</em> button on the course to upload assignment marks.
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </section>
  );
};

export default AssignmentSheet;
