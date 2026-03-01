import React, { useState } from 'react';

const LabActivityModals = ({
  showLabActivityGeneratedModal,
  setShowLabActivityGeneratedModal,
  showLabActivityObtainedModal,
  setShowLabActivityObtainedModal,
  labActivityRows,
  labActivityObtainedRows,
  activityTaken,
  coMappedActivityMarks,
  labActivityManualWts,
  useEqWtActivity,
  labActivityActivityTotals,
  computeLabActivityCOTotal,
  getLabActivityStudentCOMarks,
  getLabActivityStudentCOMappedMarks,
  getLabActivityGeneratedCOTotal,
  getLabActivityStudentTotalMarks,
  getLabActivityCOAttainment,
  getLetterGrade,
  getGradeColor,
  formatNumber,
}) => {
  const [labActivityGeneratedView, setLabActivityGeneratedView] = useState(0);
  const [labActivityObtainedView, setLabActivityObtainedView] = useState(0);

  const modalOverlayStyle = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
  };
  const modalBoxStyle = {
    backgroundColor: 'white', padding: '20px', borderRadius: '16px',
    maxWidth: '95%', maxHeight: '90%', overflow: 'auto', position: 'relative'
  };
  const closeBtnStyle = {
    padding: '4px 8px', backgroundColor: '#e74c3c', color: 'white',
    border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px'
  };

  const tabBtnStyle = (active) => ({
    padding: '12px 24px',
    backgroundColor: 'transparent',
    color: active ? '#2c3e50' : '#7f8c8d',
    border: 'none',
    borderBottom: active ? '3px solid #3498db' : '3px solid transparent',
    cursor: 'pointer',
    fontWeight: active ? '600' : 'normal',
    fontSize: '14px',
    transition: 'all 0.2s ease',
    marginBottom: '-2px'
  });

  return (
    <>
      {/* LabActivity Generated Table Modal */}
      {showLabActivityGeneratedModal && (
        <div style={modalOverlayStyle}>
          <div style={modalBoxStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3>Generated Table - Lab Activity</h3>
              <button onClick={() => setShowLabActivityGeneratedModal(false)} style={closeBtnStyle}>✕</button>
            </div>

            {/* Tab Navigation */}
            <div style={{ display: 'flex', marginBottom: '20px', borderBottom: '2px solid #e0e0e0' }}>
              <button style={tabBtnStyle(labActivityGeneratedView === 0)} onClick={() => setLabActivityGeneratedView(0)}>
                CO Mapping of Lab Activity Marks
              </button>
              <button style={tabBtnStyle(labActivityGeneratedView === 1)} onClick={() => setLabActivityGeneratedView(1)}>
                CO wise multiplication factor
              </button>
            </div>

            {/* Table 1: CO Mapping of Lab Activity Marks */}
            {labActivityGeneratedView === 0 && (
              <div className="table-wrapper">
                <h4 style={{ marginBottom: '15px' }}>CO Mapping of Lab Activity Marks out of {coMappedActivityMarks}</h4>
                <table className="ct-table">
                  <thead>
                    <tr>
                      <th rowSpan="2">CO No.</th>
                      {Array.from({ length: activityTaken || 5 }, (_, i) => (
                        <th key={`activity-${i + 1}`} colSpan="3">Activity{i + 1}</th>
                      ))}
                      <th rowSpan="2">CO Total</th>
                    </tr>
                    <tr>
                      {Array.from({ length: activityTaken || 5 }, (_, i) => (
                        <React.Fragment key={`qs-${i + 1}`}>
                          <th>Q1</th><th>Q2</th><th>Q3</th>
                        </React.Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {labActivityRows.map((row, idx) => (
                      <tr key={idx}>
                        <td className="co-label">{row.coNumber}</td>
                        {Array.from({ length: activityTaken || 5 }, (_, activityIndex) => {
                          const activityNum = activityIndex + 1;
                          const eqWt = (coMappedActivityMarks || 0) / (activityTaken || 1);
                          return (
                            <React.Fragment key={`activity-${activityNum}`}>
                              {['Q1','Q2','Q3'].map(q => (
                                <td key={q} style={{ textAlign: 'center' }}>
                                  {formatNumber((row[`Activity${activityNum}_${q}`] || 0) !== 0 ? eqWt : 0)}
                                </td>
                              ))}
                            </React.Fragment>
                          );
                        })}
                        <td style={{ textAlign: 'center', fontWeight: '600' }}>
                          {(() => {
                            let total = 0;
                            const eqWt = (coMappedActivityMarks || 0) / (activityTaken || 1);
                            for (let i = 1; i <= (activityTaken || 5); i++) {
                              ['Q1','Q2','Q3'].forEach(q => {
                                if ((row[`Activity${i}_${q}`] || 0) !== 0) total += eqWt;
                              });
                            }
                            return formatNumber(total);
                          })()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Table 2: CO wise multiplication factor */}
            {labActivityGeneratedView === 1 && (
              <div className="table-wrapper">
                <h4 style={{ marginBottom: '15px' }}>CO wise multiplication factor out of {coMappedActivityMarks}</h4>
                <table className="ct-table">
                  <thead>
                    <tr>
                      <th rowSpan="2">CO No.</th>
                      {Array.from({ length: activityTaken || 5 }, (_, i) => (
                        <th key={`activity-${i + 1}`} colSpan="3">Activity{i + 1}</th>
                      ))}
                    </tr>
                    <tr>
                      {Array.from({ length: activityTaken || 5 }, (_, i) => (
                        <React.Fragment key={`qs-${i + 1}`}>
                          <th>Q1</th><th>Q2</th><th>Q3</th>
                        </React.Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {labActivityRows.map((row, idx) => (
                      <tr key={idx}>
                        <td className="co-label">{row.coNumber}</td>
                        {Array.from({ length: activityTaken || 5 }, (_, activityIndex) => {
                          const activityNum = activityIndex + 1;
                          const activityKey = `activity${activityNum}`;
                          const totals = labActivityActivityTotals();
                          const activityTotal = totals[activityKey] || 0;
                          let calculatedFactor = 0;
                          try {
                            if (activityTotal === 0) {
                              calculatedFactor = 0;
                            } else if (useEqWtActivity) {
                              const eqWtValue = (coMappedActivityMarks || 0) / (activityTaken || 1);
                              calculatedFactor = eqWtValue / activityTotal;
                            } else {
                              calculatedFactor = (labActivityManualWts[activityKey] || 0) / activityTotal;
                            }
                          } catch { calculatedFactor = 0; }

                          return (
                            <React.Fragment key={`activity-${activityNum}`}>
                              {['Q1','Q2','Q3'].map(q => (
                                <td key={q} style={{ textAlign: 'center' }}>
                                  {formatNumber((row[`Activity${activityNum}_${q}`] || 0) !== 0 ? calculatedFactor : 0)}
                                </td>
                              ))}
                            </React.Fragment>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* LabActivity Obtained Marks Generated Modal */}
      {showLabActivityObtainedModal && (
        <div style={modalOverlayStyle}>
          <div style={{ ...modalBoxStyle, maxWidth: '95%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3>Generated Table - Lab Activity Obtained Marks</h3>
              <button onClick={() => setShowLabActivityObtainedModal(false)} style={closeBtnStyle}>✕</button>
            </div>

            {/* Tab Navigation */}
            <div style={{ display: 'flex', marginBottom: '20px', borderBottom: '2px solid #e0e0e0' }}>
              <button style={tabBtnStyle(labActivityObtainedView === 0)} onClick={() => setLabActivityObtainedView(0)}>
                CO wise obtained marks
              </button>
              <button style={tabBtnStyle(labActivityObtainedView === 1)} onClick={() => setLabActivityObtainedView(1)}>
                CO attainment
              </button>
            </div>

            {/* Table 1: CO wise obtained marks */}
            {labActivityObtainedView === 0 && (
              <div className="table-wrapper">
                <table className="section-a-table">
                  <thead>
                    <tr>
                      <th rowSpan="3">Roll</th>
                      <th colSpan={labActivityRows.length}>
                        CO wise obtained marks (Unweighted) out of {(() => {
                          let total = 0;
                          labActivityRows.forEach(row => { total += computeLabActivityCOTotal(row); });
                          return formatNumber(total);
                        })()}
                      </th>
                      <th colSpan={labActivityRows.length}>
                        CO wise obtained marks (Factored) out of {coMappedActivityMarks}
                      </th>
                    </tr>
                    <tr>
                      {labActivityRows.map((row, idx) => (<th key={`co1-${idx}`}>{row.coNumber}</th>))}
                      {labActivityRows.map((row, idx) => (<th key={`co2-${idx}`}>{row.coNumber}</th>))}
                    </tr>
                    <tr>
                      {labActivityRows.map((row, idx) => (
                        <th key={`co1-t-${idx}`} style={{ fontSize: '13px', fontWeight: '600', backgroundColor: '#e8f4f8', color: '#2c3e50', padding: '8px' }}>
                          out of {formatNumber(computeLabActivityCOTotal(row))}
                        </th>
                      ))}
                      {labActivityRows.map((row, idx) => (
                        <th key={`co2-t-${idx}`} style={{ fontSize: '13px', fontWeight: '600', backgroundColor: '#e8f4f8', color: '#2c3e50', padding: '8px' }}>
                          out of {formatNumber(getLabActivityGeneratedCOTotal(row))}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {labActivityObtainedRows.map((studentRow, idx) => (
                      <tr key={`lab-co-${studentRow.rollNumber}-${idx}`}>
                        <td>{studentRow.rollNumber || '-'}</td>
                        {labActivityRows.map((coRow, coIdx) => (
                          <td key={`co-t-${coIdx}`} style={{ textAlign: 'center' }}>
                            {formatNumber(getLabActivityStudentCOMarks(studentRow, coRow.coNumber))}
                          </td>
                        ))}
                        {labActivityRows.map((coRow, coIdx) => (
                          <td key={`co-m-${coIdx}`} style={{ textAlign: 'center' }}>
                            {formatNumber(getLabActivityStudentCOMappedMarks(studentRow, coRow.coNumber))}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td className="footer-label">Total</td>
                      {labActivityRows.map((coRow, coIdx) => (
                        <td key={`total-co-${coIdx}`} style={{ textAlign: 'center', fontWeight: 'bold' }}>
                          {formatNumber(labActivityObtainedRows.reduce((sum, studentRow) =>
                            sum + getLabActivityStudentCOMarks(studentRow, coRow.coNumber), 0))}
                        </td>
                      ))}
                      {labActivityRows.map((coRow, coIdx) => (
                        <td key={`total-mapped-${coIdx}`} style={{ textAlign: 'center', fontWeight: 'bold' }}>
                          {formatNumber(labActivityObtainedRows.reduce((sum, studentRow) =>
                            sum + getLabActivityStudentCOMappedMarks(studentRow, coRow.coNumber), 0))}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* Table 2: CO attainment */}
            {labActivityObtainedView === 1 && (
              <div className="table-wrapper">
                <table className="section-a-table">
                  <thead>
                    <tr>
                      <th>Roll</th>
                      {labActivityRows.map((coRow, idx) => (<th key={`co-${idx}`}>{coRow.coNumber}</th>))}
                      <th>Total Marks</th>
                      <th>Ltr. Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {labActivityObtainedRows.map((studentRow, idx) => {
                      const totalMarks = getLabActivityStudentTotalMarks(studentRow);
                      const grade = getLetterGrade(totalMarks);
                      const hasRollNumber = studentRow.rollNumber && String(studentRow.rollNumber).trim() !== '';
                      return (
                        <tr key={`lab-att-${studentRow.rollNumber}-${idx}`}>
                          <td>{studentRow.rollNumber || '-'}</td>
                          {labActivityRows.map((coRow, coIdx) => {
                            const attainment = getLabActivityCOAttainment(studentRow, coRow.coNumber);
                            return (
                              <td key={`co-att-${coIdx}`} style={{ textAlign: 'center' }}>
                                {attainment === null ? '' : parseFloat(attainment.toFixed(1))}
                              </td>
                            );
                          })}
                          <td style={{ textAlign: 'center', fontWeight: '500' }}>
                            {hasRollNumber ? formatNumber(totalMarks) : ''}
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: '600', color: getGradeColor(grade) }}>
                            {hasRollNumber ? grade : ''}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default LabActivityModals;
