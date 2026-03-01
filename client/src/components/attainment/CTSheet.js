import React from 'react';

const CTSheet = ({
  // State
  ctRows,
  ctManualWts,
  ctSummary,
  ctObtainedRows,
  saveStatus,
  // Setters
  setCtSummary,
  setShowGeneratedTableModal,
  setShowObtainedGeneratedModal,
  // Handlers
  handleManualSave,
  handleCTCellChange,
  handleObtainedCellChange,
  handleManualWtChange,
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
  return (
    <section className="ct-section" style={{ marginTop: '30px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
        <h2 style={{ margin: 0 }}>CO mapping of Class Test Marks</h2>
        <div className="action-buttons-container">
          {saveStatus && (
            <div className={`save-status-badge ${saveStatus}`}>
              {saveStatus === 'saving' && '💾 Saving...'}
              {saveStatus === 'saved' && '✓ Saved'}
              {saveStatus === 'error' && '✗ Error saving'}
            </div>
          )}
          <button
            onClick={handleManualSave}
            disabled={saveStatus === 'saving'}
            className="btn-professional btn-save"
          >
            {saveStatus === 'saving' ? 'Saving...' : 'Save Table'}
          </button>
          <button
            onClick={() => setShowGeneratedTableModal(true)}
            className="btn-professional btn-primary"
          >
            View Generated Table
          </button>
        </div>
      </div>

      {/* CO mapping table */}
      <div className="table-wrapper">
        <table className="ct-table">
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
            {ctRows.map((row, idx) => (
              <tr key={row.coNumber || idx}>
                <td className="co-label">{row.coNumber || '-'}</td>
                {getActiveCTFields().map(field => (
                  <td key={field}>
                    <input
                      type="number"
                      min="0"
                      value={row[field]}
                      onChange={(e) => handleCTCellChange(idx, field, e.target.value)}
                      style={{ width: '80px' }}
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
                <td key={ct} colSpan={3}>
                  <input
                    type="number"
                    step="0.01"
                    value={ctManualWts[ct] ?? 0}
                    onChange={(e) => handleManualWtChange(ct, e.target.value)}
                    style={{ width: '80px' }}
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

      {/* CT summary table */}
      <div className="table-wrapper" style={{ marginTop: '20px' }}>
        <table className="ct-table">
          <tbody>
            <tr>
              <td style={{ backgroundColor: '#f8f9fa', fontWeight: 600 }}>CTs Taken</td>
              <td>
                <input
                  type="number" min={0} max={3} style={{ width: '80px' }}
                  value={ctSummary.ctTaken}
                  onChange={e => setCtSummary(prev => ({ ...prev, ctTaken: Math.max(0, Math.min(3, Number(e.target.value) || 0)) }))}
                />
              </td>
            </tr>
            <tr>
              <td style={{ backgroundColor: '#f8f9fa', fontWeight: 600 }}>CT Marks out of 60</td>
              <td>
                <input
                  type="number" min={0} max={60} style={{ width: '80px' }}
                  value={ctSummary.coMappedMarks60}
                  onChange={e => setCtSummary(prev => ({ ...prev, coMappedMarks60: Math.max(0, Math.min(60, Number(e.target.value) || 0)) }))}
                />
              </td>
            </tr>
            <tr>
              <td style={{ backgroundColor: '#f8f9fa', fontWeight: 600 }}>Use Eq. Wt</td>
              <td>
                <input
                  type="number" step="0.01" style={{ width: '80px' }}
                  value={ctSummary.useEqWt}
                  onChange={e => setCtSummary(prev => ({ ...prev, useEqWt: Number(e.target.value) || 0 }))}
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Save Summary Button */}
      <div className="action-buttons-container" style={{ marginTop: '10px', justifyContent: 'flex-end' }}>
        {saveStatus && (
          <div className={`save-status-badge ${saveStatus}`}>
            {saveStatus === 'saving' && '💾 Saving...'}
            {saveStatus === 'saved' && '✓ Saved'}
            {saveStatus === 'error' && '✗ Error saving'}
          </div>
        )}
        <button
          onClick={handleManualSave}
          disabled={saveStatus === 'saving'}
          className="btn-professional btn-save"
        >
          {saveStatus === 'saving' ? 'Saving...' : 'Save Summary'}
        </button>
      </div>

      {/* Obtained Marks for Class Tests */}
      {(() => {
        const g = ctGroupTotals();
        const ctTaken = ctSummary.ctTaken || 3;
        return (
          <section style={{ marginTop: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
              <h3 style={{ margin: 0 }}>Obtained Marks for Class Tests</h3>
              <div className="action-buttons-container">
                {saveStatus && (
                  <div className={`save-status-badge ${saveStatus}`}>
                    {saveStatus === 'saving' && '💾 Saving...'}
                    {saveStatus === 'saved' && '✓ Saved'}
                    {saveStatus === 'error' && '✗ Error saving'}
                  </div>
                )}
                <button
                  onClick={handleManualSave}
                  disabled={saveStatus === 'saving'}
                  className="btn-professional btn-save"
                >
                  {saveStatus === 'saving' ? 'Saving...' : 'Save Table'}
                </button>
                <button
                  onClick={() => setShowObtainedGeneratedModal(true)}
                  className="btn-professional btn-primary"
                >
                  View Generated Obtained Table
                </button>
              </div>
            </div>
            <div className="table-wrapper">
              <table className="ct-obtained-table">
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
                  {ctObtainedRows.map((row, idx) => (
                    <tr key={`ct-${row.rollNumber}-${idx}`}>
                      <td className="roll-cell" title={row.name || row.rollNumber}>{row.rollNumber || '-'}</td>
                      {getActiveCTFields().map(field => (
                        <td key={`obt_${field}_${idx}`}>
                          <input
                            type="number"
                            min="0"
                            value={row[field]}
                            onChange={(e) => handleObtainedCellChange(idx, field, e.target.value)}
                            style={{ width: '80px' }}
                          />
                        </td>
                      ))}
                      <td className="row-total">{computeObtainedTotal(row)}</td>
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
