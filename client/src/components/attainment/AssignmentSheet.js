import React from 'react';

const AssignmentSheet = ({
  clos,
  assignmentRows,
  attnAssignObtainedRows,
  attendanceMarks,
  assignmentManualWts,
  assignmentSummary,
  setShowGeneratedTableModal,
  setShowObtainedGeneratedModal,
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
                      <td key={field} style={{ textAlign: 'center' }}>
                        {row[field] ?? 0}
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
                    <td key={assignment} colSpan={3} style={{ textAlign: 'center' }}>
                      {formatNumber(assignmentManualWts[assignment] ?? 0)}
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
                <tr>
                  <td style={{ backgroundColor: '#f8f9fa', fontWeight: 600 }}>Attendance Performance</td>
                  <td style={{ textAlign: 'center' }}>{assignmentSummary.attendancePerformance ?? 0}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Obtained Marks Table */}
          <section style={{ marginTop: '30px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
              <h3 style={{ margin: 0 }}>Obtained Marks for Attendance, Performance and Assignment</h3>
              <div className="action-buttons-container">
                <button onClick={() => setShowObtainedGeneratedModal(true)} className="btn-professional btn-primary">
                  View Generated Obtained Table
                </button>
              </div>
            </div>
            <div className="table-wrapper">
              <table className="ct-obtained-table">
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
                      <td style={{ textAlign: 'center' }}>{row.attendance ?? 0}</td>
                      {getActiveAssignmentFields().map(field => (
                        <td key={field} style={{ textAlign: 'center' }}>
                          {row[field] ?? 0}
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
