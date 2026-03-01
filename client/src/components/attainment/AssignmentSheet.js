import React from 'react';

const AssignmentSheet = ({
  clos,
  assignmentRows,
  attnAssignObtainedRows,
  attendanceMarks,
  assignmentManualWts,
  assignmentSummary,
  saveStatus,
  setAttendanceMarks,
  setAssignmentSummary,
  setAttnAssignObtainedRows,
  setShowGeneratedTableModal,
  setShowObtainedGeneratedModal,
  handleManualSaveAssignment,
  handleAssignmentCellChange,
  handleAssignmentManualWtChange,
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
  return (
    <section className="ct-section" style={{ marginTop: '30px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
        <h2 style={{ margin: 0 }}>Allocated Marks for Attendance and Assignment (if taken)</h2>
        <div className="action-buttons-container">
          {saveStatus && (
            <div className={`save-status-badge ${saveStatus}`}>
              {saveStatus === 'saving' && '💾 Saving...'}
              {saveStatus === 'saved' && '✓ Saved'}
              {saveStatus === 'error' && '✗ Error saving'}
            </div>
          )}
          <button onClick={handleManualSaveAssignment} disabled={saveStatus === 'saving'}
            className="btn-professional btn-save">
            {saveStatus === 'saving' ? 'Saving...' : 'Save Table'}
          </button>
          <button onClick={() => setShowGeneratedTableModal(true)} className="btn-professional btn-primary">
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
          <div className="table-wrapper">
            <table className="ct-table">
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
                  <th>
                    <input type="number" min={0} value={attendanceMarks}
                      onChange={e => setAttendanceMarks(Number(e.target.value))}
                      style={{ width: '80px' }} />
                  </th>
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
                      <td key={field}>
                        <input type="number" min="0" value={row[field]}
                          onChange={(e) => handleAssignmentCellChange(idx, field, e.target.value)}
                          style={{ width: '80px' }} />
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
                    <td key={assignment} colSpan={3}>
                      <input type="number" step="0.01"
                        value={assignmentManualWts[assignment] ?? 0}
                        onChange={(e) => handleAssignmentManualWtChange(assignment, e.target.value)}
                        style={{ width: '80px' }} />
                    </td>
                  ))}
                  <td><strong>{formatNumber(sumAssignmentManualWtTotal())}</strong></td>
                </tr>
                <tr>
                  <td className="footer-label" style={{ fontWeight: 'bold', color: '#2c3e50' }}>Status</td>
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
                      messageColor = '#138d75';
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
                  <td>
                    <input type="number" min={0} max={3} style={{ width: '80px' }}
                      value={assignmentSummary.assignTaken}
                      onChange={e => setAssignmentSummary(prev => ({ ...prev, assignTaken: Math.max(0, Math.min(3, Number(e.target.value) || 0)) }))} />
                  </td>
                </tr>
                <tr>
                  <td style={{ backgroundColor: '#f8f9fa', fontWeight: 600 }}>Assignment Marks out of 30</td>
                  <td>
                    <input type="number" min={0} max={30} style={{ width: '80px' }}
                      value={assignmentSummary.assignmentMarks30}
                      onChange={e => setAssignmentSummary(prev => ({ ...prev, assignmentMarks30: Math.max(0, Math.min(30, Number(e.target.value) || 0)) }))} />
                  </td>
                </tr>
                <tr>
                  <td style={{ backgroundColor: '#f8f9fa', fontWeight: 600 }}>Use Eq. Wt</td>
                  <td>
                    <input type="number" step="0.01" style={{ width: '80px' }}
                      value={assignmentSummary.useEqWt}
                      onChange={e => setAssignmentSummary(prev => ({ ...prev, useEqWt: Number(e.target.value) || 0 }))} />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Summary Save Button */}
          <div className="action-buttons-container" style={{ marginTop: '10px', justifyContent: 'flex-end' }}>
            {saveStatus && (
              <div className={`save-status-badge ${saveStatus}`}>
                {saveStatus === 'saving' && '💾 Saving...'}
                {saveStatus === 'saved' && '✓ Saved'}
                {saveStatus === 'error' && '✗ Error saving'}
              </div>
            )}
            <button onClick={handleManualSaveAssignment} disabled={saveStatus === 'saving'}
              className="btn-professional btn-save">
              {saveStatus === 'saving' ? 'Saving...' : 'Save Summary'}
            </button>
          </div>

          {/* Obtained Marks Table */}
          <section style={{ marginTop: '30px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
              <h3 style={{ margin: 0 }}>Obtained Marks for Attendance, Performance and Assignment</h3>
              <div className="action-buttons-container">
                {saveStatus && (
                  <div className={`save-status-badge ${saveStatus}`}>
                    {saveStatus === 'saving' && '💾 Saving...'}
                    {saveStatus === 'saved' && '✓ Saved'}
                    {saveStatus === 'error' && '✗ Error saving'}
                  </div>
                )}
                <button onClick={handleManualSaveAssignment} disabled={saveStatus === 'saving'}
                  className="btn-professional btn-save">
                  {saveStatus === 'saving' ? 'Saving...' : 'Save Table'}
                </button>
                <button onClick={() => setShowObtainedGeneratedModal(true)} className="btn-professional btn-primary">
                  View Generated Obtained Table
                </button>
              </div>
            </div>
            <div className="table-wrapper">
              <table className="ct-obtained-table">
                <thead>
                  <tr>
                    <th rowSpan={3}>Roll</th>
                    <th rowSpan={3}>Attendance Performance ({attendanceMarks})</th>
                    <th colSpan={getActiveAssignments().length * 3}>Assignment marks obtained out of 30</th>
                    <th rowSpan={3}>Total (30)</th>
                  </tr>
                  <tr>
                    {getActiveAssignments().map((assignment, index) => {
                      const assignmentNumber = index + 1;
                      const totalMarks = attnAssignObtainedRows.reduce((sum, row) => {
                        return sum + (row[`${assignment}_Q1`] || 0) + (row[`${assignment}_Q2`] || 0) + (row[`${assignment}_Q3`] || 0);
                      }, 0);
                      return (
                        <th key={assignment} colSpan={3}>
                          Assignment {assignmentNumber} ({totalMarks})
                        </th>
                      );
                    })}
                  </tr>
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
                      <td>
                        <input type="number" min={0} value={row.attendance || 0}
                          onChange={e => {
                            const updatedRows = [...attnAssignObtainedRows];
                            updatedRows[idx] = { ...row, attendance: Number(e.target.value) };
                            setAttnAssignObtainedRows(updatedRows);
                          }} style={{ width: '80px' }} />
                      </td>
                      {getActiveAssignmentFields().map(field => (
                        <td key={field}>
                          <input type="number" min={0} value={row[field] || 0}
                            onChange={e => {
                              const updatedRows = [...attnAssignObtainedRows];
                              updatedRows[idx] = { ...row, [field]: Number(e.target.value) };
                              setAttnAssignObtainedRows(updatedRows);
                            }} style={{ width: '80px' }} />
                        </td>
                      ))}
                      <td>{getActiveAssignmentFields().reduce((sum, field) => sum + (row[field] || 0), 0)}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={2 + getActiveAssignments().length * 3 + 1} style={{ textAlign: 'center', color: '#7f8c8d', padding: '20px' }}>
                        <div style={{ marginBottom: '10px' }}>
                          <strong>No students found for this course.</strong>
                        </div>
                        <div style={{ fontSize: '14px', lineHeight: '1.4' }}>
                          To enter student marks, you need to:
                          <br />• Ensure students are enrolled in this course, or
                          <br />• Import student data from existing evaluation sheets
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
