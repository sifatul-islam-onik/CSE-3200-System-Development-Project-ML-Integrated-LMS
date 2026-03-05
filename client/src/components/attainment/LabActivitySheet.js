import React from 'react';

const LabActivitySheet = ({
  clos,
  labActivityRows,
  labActivityObtainedRows,
  labAttendanceMarks,
  labQuizMarks,
  labVivaMarks,
  labActivityManualWts,
  activityTaken,
  otherActivityRemaining,
  otherActivityMeasured,
  coMappedActivityMarks,
  useEqWtActivity,
  setShowLabActivityGeneratedModal,
  setShowLabActivityObtainedModal,
  labActivityActivityTotals,
  computeLabActivityMeasuredTotal,
  computeLabActivityCOTotal,
  formatNumber,
}) => {
  return (
    <section className="ct-section" style={{ marginTop: '30px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
        <h2 style={{ margin: 0 }}>Allocated Marks for Lab activity</h2>
        <div className="action-buttons-container">
          <button
            onClick={() => setShowLabActivityGeneratedModal(true)}
            className="btn-professional btn-primary"
          >
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
            <table className="section-a-table">
              <thead>
                <tr>
                  <th rowSpan="3">CO No.</th>
                  <th rowSpan="2">Attn.</th>
                  <th rowSpan="2">Quiz</th>
                  <th rowSpan="2">C. Viva</th>
                  <th colSpan={(activityTaken || 5) * 3}>CO Mapping of Lab Activity Marks</th>
                  <th colSpan="1">Other</th>
                  <th rowSpan="3">CO Total</th>
                </tr>
                <tr>
                  {Array.from({ length: activityTaken || 5 }, (_, i) => (
                    <th key={`activity-header-${i + 1}`} colSpan="3">Activity{i + 1}</th>
                  ))}
                  <th rowSpan="2">Measured Total</th>
                </tr>
                <tr>
                  <th>{labAttendanceMarks || 0}</th>
                  <th>{labQuizMarks || 0}</th>
                  <th>{labVivaMarks || 0}</th>
                  {Array.from({ length: activityTaken || 5 }, (_, i) => (
                    <React.Fragment key={`q-headers-${i + 1}`}>
                      <th>Q1</th>
                      <th>Q2</th>
                      <th>Q3</th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {labActivityRows.map((row, idx) => (
                  <tr key={idx}>
                    <td className="co-column">{row.coNumber}</td>
                    <td style={{ textAlign: 'center' }}>-</td>
                    <td style={{ textAlign: 'center' }}>-</td>
                    <td style={{ textAlign: 'center' }}>-</td>
                    {Array.from({ length: activityTaken || 5 }, (_, activityIndex) => {
                      const activityNum = activityIndex + 1;
                      return (
                        <React.Fragment key={`activity-vals-${activityNum}`}>
                          <td style={{ textAlign: 'center' }}>{row[`Activity${activityNum}_Q1`] || 0}</td>
                          <td style={{ textAlign: 'center' }}>{row[`Activity${activityNum}_Q2`] || 0}</td>
                          <td style={{ textAlign: 'center' }}>{row[`Activity${activityNum}_Q3`] || 0}</td>
                        </React.Fragment>
                      );
                    })}
                    {idx === 0 && (
                      <td rowSpan={labActivityRows.length} style={{ verticalAlign: 'middle', fontWeight: 'bold' }}>
                        {(() => {
                          let grandTotal = (labAttendanceMarks || 0) + (labQuizMarks || 0) + (labVivaMarks || 0);
                          labActivityRows.forEach(r => { grandTotal += computeLabActivityMeasuredTotal(r); });
                          return grandTotal;
                        })()}
                      </td>
                    )}
                    <td className="co-total">{computeLabActivityCOTotal(row)}</td>
                  </tr>
                ))}

                {/* Total Row */}
                <tr className="factor-row">
                  <td colSpan="4"><strong>Total</strong></td>
                  {Array.from({ length: activityTaken || 5 }, (_, activityIndex) => {
                    const activityNum = activityIndex + 1;
                    const activityKey = `activity${activityNum}`;
                    const totals = labActivityActivityTotals();
                    return (
                      <td key={`factor-${activityKey}`} colSpan="3" style={{ textAlign: 'center', fontWeight: 'bold' }}>
                        {totals[activityKey] || 0}
                      </td>
                    );
                  })}
                  <td>
                    {(() => {
                      const totals = labActivityActivityTotals();
                      let sum = (labAttendanceMarks || 0) + (labQuizMarks || 0) + (labVivaMarks || 0);
                      for (let i = 1; i <= (activityTaken || 5); i++) sum += totals[`activity${i}`] || 0;
                      return sum;
                    })()}
                  </td>
                  <td className="co-total">
                    {(() => {
                      const totals = labActivityActivityTotals();
                      let sum = 0;
                      for (let i = 1; i <= (activityTaken || 5); i++) sum += totals[`activity${i}`] || 0;
                      return sum;
                    })()}
                  </td>
                </tr>

                {/* Factor Row */}
                <tr className="factor-row">
                  <td colSpan="4"><strong>Factor</strong></td>
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
                        const eqWtValue = activityTotal > 0 ? (coMappedActivityMarks || 0) / (activityTaken || 1) : 0;
                        calculatedFactor = eqWtValue / activityTotal;
                      } else {
                        const manualWtValue = labActivityManualWts[activityKey] || 0;
                        calculatedFactor = manualWtValue / activityTotal;
                      }
                    } catch (error) {
                      calculatedFactor = 0;
                    }

                    return (
                      <td key={`factor-${activityKey}`} colSpan="3" style={{ textAlign: 'center', fontWeight: 'bold' }}>
                        {formatNumber(calculatedFactor)}
                      </td>
                    );
                  })}
                  <td>
                    {(() => {
                      try {
                        const totals = labActivityActivityTotals();
                        let measuredTotal = (labAttendanceMarks || 0) + (labQuizMarks || 0) + (labVivaMarks || 0);
                        for (let i = 1; i <= (activityTaken || 5); i++) measuredTotal += totals[`activity${i}`] || 0;
                        if (measuredTotal === 0) return '0';
                        return formatNumber((otherActivityRemaining || 0) / measuredTotal);
                      } catch { return '0'; }
                    })()}
                  </td>
                  <td className="co-total">
                    {(() => {
                      try {
                        const totals = labActivityActivityTotals();
                        let measuredTotal = (labAttendanceMarks || 0) + (labQuizMarks || 0) + (labVivaMarks || 0);
                        for (let i = 1; i <= (activityTaken || 5); i++) measuredTotal += totals[`activity${i}`] || 0;
                        const t14 = measuredTotal === 0 ? 0 : (otherActivityRemaining || 0) / measuredTotal;
                        return formatNumber(t14 * measuredTotal);
                      } catch { return '0'; }
                    })()}
                  </td>
                </tr>

                {/* Eq. Wt Row */}
                <tr className="eq-wt-row">
                  <td colSpan="4"><strong>Eq. Wt</strong></td>
                  {Array.from({ length: activityTaken || 5 }, (_, activityIndex) => {
                    const activityNum = activityIndex + 1;
                    const activityKey = `activity${activityNum}`;
                    const totals = labActivityActivityTotals();
                    const activityTotal = totals[activityKey] || 0;
                    const calculatedEqWt = activityTotal > 0 ? (coMappedActivityMarks || 0) / (activityTaken || 1) : 0;
                    return (
                      <td key={`eqwt-${activityKey}`} colSpan="3" style={{ textAlign: 'center', fontWeight: 'bold' }}>
                        {formatNumber(calculatedEqWt)}
                      </td>
                    );
                  })}
                  <td></td>
                  <td className="co-total">
                    {(() => {
                      const totals = labActivityActivityTotals();
                      let sum = 0;
                      for (let i = 1; i <= (activityTaken || 5); i++) {
                        const activityKey = `activity${i}`;
                        const activityTotal = totals[activityKey] || 0;
                        sum += activityTotal > 0 ? (coMappedActivityMarks || 0) / (activityTaken || 1) : 0;
                      }
                      return formatNumber(sum);
                    })()}
                  </td>
                </tr>

                {/* Manual Wt Row */}
                <tr className="manual-wt-row">
                  <td colSpan="4"><strong>Manual Wt</strong></td>
                  {Array.from({ length: activityTaken || 5 }, (_, activityIndex) => {
                    const activityNum = activityIndex + 1;
                    const activityKey = `activity${activityNum}`;
                    return (
                      <td key={`manualwt-${activityKey}`} colSpan="3" style={{ textAlign: 'center', fontWeight: 'bold' }}>
                        {labActivityManualWts[activityKey] || 0}
                      </td>
                    );
                  })}
                  <td></td>
                  <td className="co-total">
                    {(() => {
                      let sum = 0;
                      for (let i = 1; i <= (activityTaken || 5); i++) sum += (labActivityManualWts[`activity${i}`] || 0);
                      return formatNumber(sum);
                    })()}
                  </td>
                </tr>

                {/* Validation Row */}
                <tr style={{ backgroundColor: '#f8f9fa' }}>
                  <td colSpan="4"></td>
                  <td colSpan={(activityTaken || 5) * 3} style={{ textAlign: 'center', fontWeight: 'bold' }}>
                    {(() => {
                      let u16 = 0;
                      for (let i = 1; i <= (activityTaken || 5); i++) u16 += (labActivityManualWts[`activity${i}`] || 0);
                      const ab8 = coMappedActivityMarks || 0;
                      const ab9 = useEqWtActivity;
                      if (u16 === ab8) return <span style={{ color: '#27ae60' }}>ok</span>;
                      if (!ab9) return <span style={{ color: '#e74c3c' }}>Sum should be {ab8}</span>;
                      return <span style={{ color: '#138d75' }}>Sum should be {ab8}, you can ignore as Eq. wt=1</span>;
                    })()}
                  </td>
                  <td colSpan="2"></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Summary Config Table — read-only */}
          <div className="table-wrapper" style={{ marginTop: '20px' }}>
            <table className="ct-table">
              <tbody>
                <tr><td>Activity Taken</td><td style={{ fontWeight: 600 }}>{activityTaken || 0}</td></tr>
                <tr><td>Other Activity remaining marks /50</td><td style={{ fontWeight: 600 }}>{otherActivityRemaining || 0}</td></tr>
                <tr><td>Other Activity Measured in</td><td style={{ fontWeight: 600 }}>{otherActivityMeasured || 0}</td></tr>
                <tr><td>CO Mapped Activity Marks out of 50</td><td style={{ fontWeight: 600 }}>{coMappedActivityMarks || 0}</td></tr>
                <tr><td>Use Eq. Wt for each activity</td><td style={{ fontWeight: 600 }}>{useEqWtActivity || 0}</td></tr>
              </tbody>
            </table>
          </div>

          {/* Obtained Marks Section */}
          <section style={{ marginTop: '30px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '15px' }}>
              <h3>Obtained Marks</h3>
              <div className="action-buttons-container">
                <button onClick={() => setShowLabActivityObtainedModal(true)} className="btn-professional btn-primary">
                  Generated Tables
                </button>
              </div>
            </div>
            <div className="table-wrapper">
              <table className="ct-obtained-table">
                <thead>
                  <tr>
                    <th rowSpan="3">Roll</th>
                    <th rowSpan="1">Attn.</th>
                    <th rowSpan="1">Quiz</th>
                    <th rowSpan="1">C. Viva</th>
                    <th colSpan={(activityTaken || 5) * 3}>Lab Activity marks obtained out of {coMappedActivityMarks}</th>
                    <th rowSpan="3">
                      Other<br />
                      ({(() => {
                        const totals = labActivityActivityTotals();
                        let measuredTotal = (labAttendanceMarks || 0) + (labQuizMarks || 0) + (labVivaMarks || 0);
                        for (let i = 1; i <= (activityTaken || 5); i++) measuredTotal += totals[`activity${i}`] || 0;
                        return measuredTotal;
                      })()})
                    </th>
                    <th rowSpan="3">Other<br />({otherActivityRemaining || 0})</th>
                  </tr>
                  <tr>
                    <th rowSpan="2">Out of {labAttendanceMarks}</th>
                    <th rowSpan="2">Out of {labQuizMarks}</th>
                    <th rowSpan="2">Out of {labVivaMarks}</th>
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
                  {labActivityObtainedRows.length > 0 ? labActivityObtainedRows.map((row, idx) => (
                    <tr key={`lab-${row.rollNumber}-${idx}`}>
                      <td>{row.rollNumber || '-'}</td>
                      <td style={{ textAlign: 'center' }}>{row.attn != null && row.attn !== '' ? row.attn : 0}</td>
                      <td style={{ textAlign: 'center' }}>{row.quiz != null && row.quiz !== '' ? row.quiz : 0}</td>
                      <td style={{ textAlign: 'center' }}>{row.viva != null && row.viva !== '' ? row.viva : 0}</td>
                      {Array.from({ length: activityTaken || 5 }, (_, activityIndex) => {
                        const activityNum = activityIndex + 1;
                        return (
                          <React.Fragment key={`activity-${activityNum}`}>
                            {['Q1', 'Q2', 'Q3'].map(q => {
                              const val = row[`Activity${activityNum}_${q}`];
                              const isAbsent = val === 'A' || val === 'Absent';
                              return (
                                <td key={q} style={{ textAlign: 'center', color: isAbsent ? '#e74c3c' : undefined, fontStyle: isAbsent ? 'italic' : undefined }}>
                                  {isAbsent ? 'Absent' : (val != null ? val : 0)}
                                </td>
                              );
                            })}
                          </React.Fragment>
                        );
                      })}
                      <td style={{ textAlign: 'center' }}>{row.otherMeasured || 0}</td>
                      <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                        {(() => {
                          const totals = labActivityActivityTotals();
                          let totalMeasuredTotal = (labAttendanceMarks || 0) + (labQuizMarks || 0) + (labVivaMarks || 0);
                          for (let i = 1; i <= (activityTaken || 5); i++) totalMeasuredTotal += totals[`activity${i}`] || 0;
                          if (totalMeasuredTotal === 0) return 0;
                          const factor = (otherActivityRemaining || 0) / totalMeasuredTotal;
                          return formatNumber(Math.round((row.otherMeasured || 0) * factor * 10000) / 10000);
                        })()}
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={6 + ((activityTaken || 5) * 3)} style={{ textAlign: 'center', color: '#7f8c8d' }}>
                        No students found for this sheet.
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

export default LabActivitySheet;
