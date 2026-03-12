import React, { useState } from 'react';

const CT_INPUT_CSS = `
.ct-cell-input {
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
.ct-cell-input:hover {
  border-bottom-color: #5c7cfa;
  background: rgba(92,124,250,0.04);
}
.ct-cell-input:focus {
  border: 1px solid #5c7cfa;
  border-radius: 4px;
  background: #fff;
  box-shadow: 0 0 0 2px rgba(92,124,250,0.15);
}
.ct-cell-input.absent {
  color: #e74c3c;
  font-style: italic;
  border-bottom-color: #e74c3c;
}
.ct-cell-input.absent:focus {
  border-color: #e74c3c;
  box-shadow: 0 0 0 2px rgba(231,76,60,0.12);
}
/* hide browser number spinners */
.ct-cell-input::-webkit-inner-spin-button,
.ct-cell-input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
.ct-cell-input[type=number] { -moz-appearance: textfield; }
`;

let _ctStyleInjected = false;
const injectCTStyles = () => {
  if (_ctStyleInjected) return;
  const tag = document.createElement('style');
  tag.textContent = CT_INPUT_CSS;
  document.head.appendChild(tag);
  _ctStyleInjected = true;
};

const CTSheet = ({
  // State
  ctRows,
  ctManualWts,
  ctSummary,
  ctObtainedRows,
  // Setters
  setCtRows,
  setCtObtainedRows,
  setCtManualWts,
  setShowGeneratedTableModal,
  setShowObtainedGeneratedModal,
  // Save
  handleManualSaveCT,
  ctSaveStatus,
  // Computed helpers (functions)
  getActiveCTs,
  getActiveCTFields,
  computeCOTotal,
  calculateAutoFactor,
  calculateAutoEqWt,
  ctColumnTotals,
  ctGroupTotals,
  sumEqWtTotal,
  sumManualWtTotal,
  computeObtainedTotal,
  formatNumber,
}) => {
  injectCTStyles();
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg('');
    try {
      await handleManualSaveCT();
      setSaveMsg('Saved!');
    } catch (e) {
      setSaveMsg('Save failed');
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(''), 3000);
    }
  };

  const handleCoMapCell = (rowIdx, field, raw) => {
    const val = raw === '' ? 0 : (isNaN(parseFloat(raw)) ? 0 : parseFloat(raw));
    setCtRows(prev => prev.map((r, i) => i === rowIdx ? { ...r, [field]: val } : r));
  };

  const handleObtainedCell = (rowIdx, field, raw) => {
    const trimmed = raw.trim();
    const val = trimmed.toLowerCase() === 'a' ? 'A'
      : trimmed === '' ? 0
      : isNaN(parseFloat(trimmed)) ? 0
      : parseFloat(trimmed);
    setCtObtainedRows(prev => prev.map((r, i) => i === rowIdx ? { ...r, [field]: val } : r));
  };

  return (
    <section className="ct-section" style={{ marginTop: '30px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
        <h2 style={{ margin: 0 }}>CO mapping of Class Test Marks</h2>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {saveMsg && <span style={{ fontSize: '13px', color: saveMsg === 'Saved!' ? '#27ae60' : '#e74c3c', fontWeight: 600 }}>{saveMsg}</span>}
          <button onClick={handleSave} disabled={saving} className="btn-professional btn-success">
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button onClick={() => setShowGeneratedTableModal(true)} className="btn-professional btn-primary">
            View Generated Table
          </button>
        </div>
      </div>

      {/* CO mapping table */}
      <div className="table-wrapper" style={{ overflowX: 'auto' }}>
        <table className="ct-table" style={{ minWidth: '560px', width: '100%' }}>
          <thead>
            <tr>
              <th rowSpan="2">CO No.</th>
              {getActiveCTs().map(ct => (
                <th key={ct} colSpan="3">{ct}</th>
              ))}
              <th rowSpan="2">CO Total</th>
            </tr>
            <tr>
              {getActiveCTs().map(ct => (
                <React.Fragment key={`${ct}-questions`}>
                  <th>Q1</th><th>Q2</th><th>Q3</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {ctRows.map((row, rowIdx) => (
              <tr key={row.coNumber || rowIdx}>
                <td className="co-label">{row.coNumber || '-'}</td>
                {getActiveCTFields().map(field => (
                  <td key={field} style={{ padding: '2px 3px' }}>
                    <input
                      type="text"
                      className="ct-cell-input"
                      value={row[field] ?? 0}
                      onChange={e => handleCoMapCell(rowIdx, field, e.target.value)}
                    />
                  </td>
                ))}
                <td className="co-total">{computeCOTotal(row)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="footer-label">CT Total</td>
              {(() => {
                const ctTotals = ctColumnTotals();
                return (
                  <>
                    {getActiveCTs().map(ct => (
                      <td key={ct} colSpan={3} style={{ textAlign: 'center', fontWeight: 'bold' }}>
                        {ctTotals[ct] || 0}
                      </td>
                    ))}
                  </>
                );
              })()}
              <td>{ctRows.reduce((sum, r) => sum + computeCOTotal(r), 0)}</td>
            </tr>
            <tr>
              <td className="footer-label">Factor</td>
              {getActiveCTs().map(ct => {
                const autoFactor = calculateAutoFactor();
                return (
                  <td key={ct} colSpan={3} style={{ textAlign: 'center' }}>
                    {formatNumber(autoFactor[ct] || 0)}
                  </td>
                );
              })}
              <td></td>
            </tr>
            <tr>
              <td className="footer-label">Eq. Wt</td>
              {getActiveCTs().map(ct => {
                const autoEqWt = calculateAutoEqWt();
                return (
                  <td key={ct} colSpan={3} style={{ textAlign: 'center' }}>
                    {formatNumber(autoEqWt[ct] || 0)}
                  </td>
                );
              })}
              <td><strong>{formatNumber(sumEqWtTotal())}</strong></td>
            </tr>
            <tr>
              <td className="footer-label">Manual Wt</td>
              {getActiveCTs().map(ct => (
                <td key={ct} colSpan={3} style={{ padding: '2px 3px', textAlign: 'center' }}>
                  <input
                    type="text"
                    className="ct-cell-input"
                    value={ctManualWts[ct] ?? 0}
                    onChange={e => {
                      const raw = e.target.value;
                      const val = raw === '' ? 0 : isNaN(parseFloat(raw)) ? 0 : parseFloat(raw);
                      setCtManualWts(prev => ({ ...prev, [ct]: val }));
                    }}
                    style={{ width: '80px', display: 'inline-block' }}
                  />
                </td>
              ))}
              <td><strong>{formatNumber(sumManualWtTotal())}</strong></td>
            </tr>
            <tr>
              <td className="footer-label" style={{ fontWeight: 'bold', color: '#2c3e50' }}>Status</td>
              {(() => {
                const manualTotal = sumManualWtTotal();
                const coMappedMarks = ctSummary.coMappedMarks60 || 0;
                const useEqWt = ctSummary.useEqWt || 0;
                let message = '';
                let messageColor = '#27ae60';
                if (manualTotal === coMappedMarks) {
                  message = 'OK';
                } else {
                  if (useEqWt === 0) {
                    message = `Sum should be ${coMappedMarks}`;
                    messageColor = '#e74c3c';
                  } else {
                    message = `Sum should be ${coMappedMarks}, you can ignore as Eq. wt=1`;
                    messageColor = '#138d75';
                  }
                }
                return (
                  <>
                    <td colSpan={getActiveCTs().length * 3} style={{ textAlign: 'center', fontWeight: 'bold', color: messageColor }}>
                      {message}
                    </td>
                    <td></td>
                  </>
                );
              })()}
            </tr>
          </tfoot>
        </table>
      </div>

      {/* CT summary table (read-only) */}
      <div className="table-wrapper" style={{ marginTop: '20px' }}>
        <table className="ct-table">
          <tbody>
            <tr>
              <td style={{ backgroundColor: '#f8f9fa', fontWeight: 600 }}>CTs Taken</td>
              <td style={{ paddingLeft: '12px' }}>{ctSummary.ctTaken ?? 0}</td>
            </tr>
            <tr>
              <td style={{ backgroundColor: '#f8f9fa', fontWeight: 600 }}>CT Marks out of 60</td>
              <td style={{ paddingLeft: '12px' }}>{ctSummary.coMappedMarks60 ?? 0}</td>
            </tr>
            <tr>
              <td style={{ backgroundColor: '#f8f9fa', fontWeight: 600 }}>Use Eq. Wt</td>
              <td style={{ paddingLeft: '12px' }}>{ctSummary.useEqWt ?? 0}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Obtained Marks for Class Tests */}
      {(() => {
        const g = ctGroupTotals();
        const ctTaken = ctSummary.ctTaken || 3;
        return (
          <section style={{ marginTop: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
              <h3 style={{ margin: 0 }}>Obtained Marks for Class Tests</h3>
              <div className="action-buttons-container" style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                {saveMsg && <span style={{ fontSize: '13px', color: saveMsg === 'Saved!' ? '#27ae60' : '#e74c3c', fontWeight: 600 }}>{saveMsg}</span>}
                <button onClick={handleSave} disabled={saving} className="btn-professional btn-success">
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => setShowObtainedGeneratedModal(true)}
                  className="btn-professional btn-primary"
                >
                  View Generated Obtained Table
                </button>
              </div>
            </div>
            <div className="table-wrapper" style={{ overflowX: 'auto' }}>
              <table className="ct-obtained-table" style={{ minWidth: '560px', width: '100%' }}>
                <thead>
                  <tr>
                    <th rowSpan={3}>Roll</th>
                    <th colSpan={ctTaken * 3}>Class Test marks obtained out of {g.combined}</th>
                    <th rowSpan={3}>Total ({g.combined})</th>
                  </tr>
                  <tr>
                    {getActiveCTs().map((ct, i) => (
                      <th key={ct} colSpan={3}>{ct} ({[g.ct1, g.ct2, g.ct3][i]})</th>
                    ))}
                  </tr>
                  <tr>
                    {getActiveCTs().map(ct => (
                      <React.Fragment key={`${ct}-q`}>
                        <th>Q1</th><th>Q2</th><th>Q3</th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ctObtainedRows.map((row, rowIdx) => (
                    <tr key={`ct-${row.rollNumber}-${rowIdx}`}>
                      <td className="roll-cell" title={row.name || row.rollNumber}>{row.rollNumber || '-'}</td>
                      {getActiveCTFields().map(field => {
                        const val = row[field];
                        const isAbsent = val === 'A' || val === 'Absent';
                        return (
                          <td key={`obt_${field}_${rowIdx}`} style={{ padding: '2px 3px' }}>
                            <input
                              type="text"
                              className={`ct-cell-input${isAbsent ? ' absent' : ''}`}
                              value={isAbsent ? 'A' : (val ?? 0)}
                              onChange={e => handleObtainedCell(rowIdx, field, e.target.value)}
                            />
                          </td>
                        );
                      })}
                      {(() => {
                        const activeFields = getActiveCTFields();
                        const allAbsent = activeFields.length > 0 && activeFields.every(f => row[f] === 'A' || row[f] === 'Absent');
                        return (
                          <td className="row-total" style={{ color: allAbsent ? '#e74c3c' : undefined, fontStyle: allAbsent ? 'italic' : undefined }}>
                            {allAbsent ? 'Absent' : computeObtainedTotal(row)}
                          </td>
                        );
                      })()}
                    </tr>
                  ))}
                  {ctObtainedRows.length === 0 && (
                    <tr>
                      <td colSpan={ctTaken * 3 + 2} style={{ textAlign: 'center', color: '#7f8c8d', padding: '20px' }}>
                        <div>Sample students should be loaded. If not, check browser console for errors.</div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        );
      })()}
    </section>
  );
};

export default CTSheet;
