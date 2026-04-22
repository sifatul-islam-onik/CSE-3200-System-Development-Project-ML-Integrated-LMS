import React, { useState } from 'react';

const LAB_INPUT_CSS = `
.lab-cell-input {
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
.lab-cell-input:hover {
  border-bottom-color: #5c7cfa;
  background: rgba(92,124,250,0.04);
}
.lab-cell-input:focus {
  border: 1px solid #5c7cfa;
  border-radius: 4px;
  background: #fff;
  box-shadow: 0 0 0 2px rgba(92,124,250,0.15);
}
.lab-cell-input.absent {
  color: #e74c3c;
  font-style: italic;
  border-bottom-color: #e74c3c;
}
.lab-cell-input.absent:focus {
  border-color: #e74c3c;
  box-shadow: 0 0 0 2px rgba(231,76,60,0.12);
}
.lab-cell-input::-webkit-inner-spin-button {display:none;}
`;

let _labStyleInjected = false;
const injectLabStyles = () => {
  if (_labStyleInjected) return;
  const tag = document.createElement('style');
  tag.textContent = LAB_INPUT_CSS;
  document.head.appendChild(tag);
  _labStyleInjected = true;
};

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
  // Setters
  setLabActivityRows,
  setLabActivityObtainedRows,
  setLabActivityManualWts,
  setShowLabActivityGeneratedModal,
  setShowLabActivityObtainedModal,
  // Save
  handleManualSaveLabActivity,
  // Helpers
  labActivityActivityTotals,
  computeLabActivityMeasuredTotal,
  computeLabActivityCOTotal,
  formatNumber,
}) => {
  injectLabStyles();
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
      await handleManualSaveLabActivity(buttonId);
      setSaveMsg('Saved!');
    } catch (e) {
      setSaveMsg('Save failed');
    } finally {
      setSaving(false);
      setActiveSaveButton(null);
      setTimeout(() => setSaveMsg(''), 3000);
    }
  };

  const handleLabCoMapCell = (rowIdx, field, raw) => {
    const val = raw === '' ? 0 : (isNaN(parseFloat(raw)) ? 0 : parseFloat(raw));
    setLabActivityRows(prev => prev.map((r, i) => i === rowIdx ? { ...r, [field]: val } : r));
  };

  const handleObtainedActivityCell = (rowIdx, field, raw) => {
    const trimmed = raw.trim();
    let val = trimmed.toLowerCase() === 'a' ? 'A'
      : trimmed === '' ? 0
      : isNaN(parseFloat(trimmed)) ? 0
      : parseFloat(trimmed);

    if (typeof val === 'number') {
      const field_total = labActivityRows.reduce((sum, r) => sum + (parseFloat(r[field]) || 0), 0);
      if (field_total > 0 && val > field_total) return;
    }

    setLabActivityObtainedRows(prev => prev.map((r, i) => i === rowIdx ? { ...r, [field]: val } : r));
  };

  const handleObtainedBaseCell = (rowIdx, field, raw) => {
    const trimmed = raw.trim();
    const val = trimmed === '' ? 0 : isNaN(parseFloat(trimmed)) ? 0 : parseFloat(trimmed);

    if (field === 'attn' && labAttendanceMarks > 0 && val > labAttendanceMarks) return;
    if (field === 'quiz' && labQuizMarks > 0 && val > labQuizMarks) return;
    if (field === 'viva' && labVivaMarks > 0 && val > labVivaMarks) return;
    if (field === 'otherMeasured' && otherActivityMeasured > 0 && val > otherActivityMeasured) return;

    setLabActivityObtainedRows(prev => prev.map((r, i) => i === rowIdx ? { ...r, [field]: val } : r));
  };
  return (
    <section className="ct-section" style={{ marginTop: '30px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
        <h2 style={{ margin: 0 }}>Allocated Marks for Lab activity</h2>
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
          <button
            type="button"
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
          <div className="table-wrapper" style={{ overflowX: 'auto' }}>
            <table className="section-a-table" style={{ minWidth: '560px', width: '100%' }}>
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
                          {['Q1', 'Q2', 'Q3'].map(q => {
                            const field = `Activity${activityNum}_${q}`;
                            return (
                              <td key={field} style={{ padding: '2px 3px' }}>
                                <input
                                  type="text"
                                  className="lab-cell-input"
                                  value={row[field] || 0}
                                  onChange={e => handleLabCoMapCell(idx, field, e.target.value)}
                                />
                              </td>
                            );
                          })}
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
                      <td key={`manualwt-${activityKey}`} colSpan="3" style={{ padding: '2px 3px', textAlign: 'center' }}>
                        <input
                          type="text"
                          className="lab-cell-input"
                          value={labActivityManualWts[activityKey] || 0}
                          onChange={e => {
                            const raw = e.target.value;
                            const val = raw === '' ? 0 : isNaN(parseFloat(raw)) ? 0 : parseFloat(raw);
                            setLabActivityManualWts(prev => ({ ...prev, [activityKey]: val }));
                          }}
                          style={{ width: '80px', display: 'inline-block' }}
                        />
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
                      return <span style={{ color: '#059669' }}>Sum should be {ab8}, you can ignore as Eq. wt=1</span>;
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
                <button type="button" onClick={() => setShowLabActivityObtainedModal(true)} className="btn-professional btn-primary">
                  Generated Tables
                </button>
              </div>
            </div>
            <div className="table-wrapper" style={{ overflowX: 'auto' }}>
              <table className="ct-obtained-table" style={{ minWidth: '560px', width: '100%' }}>
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
                      <td style={{ padding: '2px 3px' }}>
                        <input
                          type="text"
                          className="lab-cell-input"
                          value={row.attn != null && row.attn !== '' ? row.attn : 0}
                          onChange={e => handleObtainedBaseCell(idx, 'attn', e.target.value)}
                        />
                      </td>
                      <td style={{ padding: '2px 3px' }}>
                        <input
                          type="text"
                          className="lab-cell-input"
                          value={row.quiz != null && row.quiz !== '' ? row.quiz : 0}
                          onChange={e => handleObtainedBaseCell(idx, 'quiz', e.target.value)}
                        />
                      </td>
                      <td style={{ padding: '2px 3px' }}>
                        <input
                          type="text"
                          className="lab-cell-input"
                          value={row.viva != null && row.viva !== '' ? row.viva : 0}
                          onChange={e => handleObtainedBaseCell(idx, 'viva', e.target.value)}
                        />
                      </td>
                      {Array.from({ length: activityTaken || 5 }, (_, activityIndex) => {
                        const activityNum = activityIndex + 1;
                        return (
                          <React.Fragment key={`activity-${activityNum}`}>
                            {['Q1', 'Q2', 'Q3'].map(q => {
                              const field = `Activity${activityNum}_${q}`;
                              const val = row[field];
                              const isAbsent = val === 'A' || val === 'Absent';
                              return (
                                <td key={q} style={{ padding: '2px 3px' }}>
                                  <input
                                    type="text"
                                    className={`lab-cell-input${isAbsent ? ' absent' : ''}`}
                                    value={isAbsent ? 'A' : (val != null ? val : 0)}
                                    onChange={e => handleObtainedActivityCell(idx, field, e.target.value)}
                                  />
                                </td>
                              );
                            })}
                          </React.Fragment>
                        );
                      })}
                      <td style={{ padding: '2px 3px' }}>
                        <input
                          type="text"
                          className="lab-cell-input"
                          value={row.otherMeasured || 0}
                          onChange={e => handleObtainedBaseCell(idx, 'otherMeasured', e.target.value)}
                        />
                      </td>
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
