import React, { useState } from 'react';
import { handleTableEnterNav } from '../../utils/tableNav';

const SECT_INPUT_CSS = `
.sect-cell-input {
  display: block;
  width: 100%;
  min-width: 32px;
  box-sizing: border-box;
  padding: 5px 2px;
  background: transparent;
  border: 1px solid transparent;
  border-bottom: 1.5px solid #c8d0da;
  border-radius: 0;
  font-size: 15px;
  font-family: inherit;
  text-align: center;
  color: inherit;
  outline: none;
  transition: border-color 0.15s, background 0.15s;
}
th .sect-cell-input {
  color: #ffffff;
}
.sect-cell-input:hover {
  border-bottom-color: #5c7cfa;
  background: rgba(92,124,250,0.04);
}
.sect-cell-input:focus {
  border: 1px solid #5c7cfa;
  border-radius: 4px;
  background: #fff;
  color: #1a2332;
  box-shadow: 0 0 0 2px rgba(92,124,250,0.15);
}
.sect-cell-input.absent {
  color: #e74c3c;
  font-style: italic;
  border-bottom-color: #e74c3c;
}
.sect-cell-input.absent:focus {
  border-color: #e74c3c;
  box-shadow: 0 0 0 2px rgba(231,76,60,0.12);
}
.sect-cell-input::-webkit-inner-spin-button {display:none;}
`;

let _sectStyleInjected = false;
const injectSectStyles = () => {
  if (_sectStyleInjected) return;
  const tag = document.createElement('style');
  tag.textContent = SECT_INPUT_CSS;
  document.head.appendChild(tag);
  _sectStyleInjected = true;
};

const SectionASheet = ({
  clos,
  sectionARows,
  sectionAObtainedRows,
  computeSectionAObtainedTotal,
  sectionAQuestionTotals,
  setShowSectionAGeneratedModal,
  setShowSectionAObtainedModal,
  setSectionARows,
  setSectionAObtainedRows,
  handleManualSaveSectionA,
  sectionASaveStatus,
}) => {
  injectSectStyles();

  const handleCoMapCell = (rowIdx, field, raw) => {
    const val = raw === '' ? 0 : (isNaN(parseFloat(raw)) ? 0 : parseFloat(raw));
    setSectionARows(prev => prev.map((r, i) => i === rowIdx ? { ...r, [field]: val } : r));
  };

  const handleObtainedCell = (rowIdx, field, raw) => {
    const trimmed = raw.trim();
    let val = trimmed.toLowerCase() === 'a' ? 'A'
      : trimmed === '' ? 0
      : isNaN(parseFloat(trimmed)) ? 0
      : parseFloat(trimmed);

    if (typeof val === 'number') {
      const field_total = sectionARows.reduce((sum, r) => sum + (parseFloat(r[field]) || 0), 0);
      if (field_total > 0 && val > field_total) return;
    }

    setSectionAObtainedRows(prev => prev.map((r, i) => i === rowIdx ? { ...r, [field]: val } : r));
  };
  return (
    <section className="section-a-section" style={{ marginTop: '30px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ borderBottom: 'none', marginBottom: 0, paddingBottom: 0 }}>
          Allocated marks for Section-A in final question
        </h2>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button type="button" onClick={handleManualSaveSectionA} disabled={sectionASaveStatus === 'saving'} className="btn-professional btn-success">
            {sectionASaveStatus === 'saving' ? 'Saving...' : sectionASaveStatus === 'saved' ? 'Saved!' : 'Save'}
          </button>
          <button
            onClick={() => setShowSectionAGeneratedModal(true)}
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
                  <th rowSpan="2">CO No.</th>
                  <th colSpan="4">1</th>
                  <th style={{ borderLeft: '2px solid #d5d5d5' }} colSpan="4">2</th>
                  <th style={{ borderLeft: '2px solid #d5d5d5' }} colSpan="4">3</th>
                  <th style={{ borderLeft: '2px solid #d5d5d5' }} colSpan="4">4</th>
                </tr>
                <tr>
                  <th>1(a)</th><th>1(b)</th><th>1(c)</th><th>1(d)</th>
                  <th style={{ borderLeft: '2px solid #d5d5d5' }}>2(a)</th><th>2(b)</th><th>2(c)</th><th>2(d)</th>
                  <th style={{ borderLeft: '2px solid #d5d5d5' }}>3(a)</th><th>3(b)</th><th>3(c)</th><th>3(d)</th>
                  <th style={{ borderLeft: '2px solid #d5d5d5' }}>4(a)</th><th>4(b)</th><th>4(c)</th><th>4(d)</th>
                </tr>
              </thead>
              <tbody>
                {sectionARows.map((row, idx) => (
                  <tr key={row.coNumber || idx}>
                    <td className="co-label">{row.coNumber || '-'}</td>
                    {['Q1a','Q1b','Q1c','Q1d'].map((f) => (
                      <td key={f} style={{ padding: '2px 3px' }}>
                        <input type="text" className="sect-cell-input" value={row[f] ?? 0} onChange={e => handleCoMapCell(idx, f, e.target.value)} onKeyDown={handleTableEnterNav} />
                      </td>
                    ))}
                    {['Q2a','Q2b','Q2c','Q2d'].map((f, fi) => (
                      <td key={f} style={{ ...(fi === 0 ? { borderLeft: '2px solid #d5d5d5' } : {}), padding: '2px 3px' }}>
                        <input type="text" className="sect-cell-input" value={row[f] ?? 0} onChange={e => handleCoMapCell(idx, f, e.target.value)} onKeyDown={handleTableEnterNav} />
                      </td>
                    ))}
                    {['Q3a','Q3b','Q3c','Q3d'].map((f, fi) => (
                      <td key={f} style={{ ...(fi === 0 ? { borderLeft: '2px solid #d5d5d5' } : {}), padding: '2px 3px' }}>
                        <input type="text" className="sect-cell-input" value={row[f] ?? 0} onChange={e => handleCoMapCell(idx, f, e.target.value)} onKeyDown={handleTableEnterNav} />
                      </td>
                    ))}
                    {['Q4a','Q4b','Q4c','Q4d'].map((f, fi) => (
                      <td key={f} style={{ ...(fi === 0 ? { borderLeft: '2px solid #d5d5d5' } : {}), padding: '2px 3px' }}>
                        <input type="text" className="sect-cell-input" value={row[f] ?? 0} onChange={e => handleCoMapCell(idx, f, e.target.value)} onKeyDown={handleTableEnterNav} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="footer-label">Total</td>
                  {(() => {
                    const questionTotals = sectionAQuestionTotals();
                    return (
                      <>
                        <td colSpan="4" style={{ textAlign: 'center', fontWeight: 'bold' }}>{questionTotals.q1}</td>
                        <td colSpan="4" style={{ borderLeft: '2px solid #d5d5d5', textAlign: 'center', fontWeight: 'bold' }}>{questionTotals.q2}</td>
                        <td colSpan="4" style={{ borderLeft: '2px solid #d5d5d5', textAlign: 'center', fontWeight: 'bold' }}>{questionTotals.q3}</td>
                        <td colSpan="4" style={{ borderLeft: '2px solid #d5d5d5', textAlign: 'center', fontWeight: 'bold' }}>{questionTotals.q4}</td>
                      </>
                    );
                  })()}
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Obtained Marks for Section-A */}
          <section style={{ marginTop: '30px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0 }}>Obtained marks for Section-A</h3>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" onClick={handleManualSaveSectionA} disabled={sectionASaveStatus === 'saving'} className="btn-professional btn-success">
                  {sectionASaveStatus === 'saving' ? 'Saving...' : sectionASaveStatus === 'saved' ? 'Saved!' : 'Save'}
                </button>
                <button
                  onClick={() => setShowSectionAObtainedModal(true)}
                  className="btn-professional btn-primary"
                >
                  View Generated Table
                </button>
              </div>
            </div>
            <div className="table-wrapper">
              <table className="section-a-table">
                <thead>
                  <tr>
                    <th rowSpan="2">Roll</th>
                    <th colSpan="4">1</th>
                    <th style={{ borderLeft: '2px solid #d5d5d5' }} colSpan="4">2</th>
                    <th style={{ borderLeft: '2px solid #d5d5d5' }} colSpan="4">3</th>
                    <th style={{ borderLeft: '2px solid #d5d5d5' }} colSpan="4">4</th>
                    <th rowSpan="2">Total</th>
                  </tr>
                  <tr>
                    <th>1(a)</th><th>1(b)</th><th>1(c)</th><th>1(d)</th>
                    <th style={{ borderLeft: '2px solid #d5d5d5' }}>2(a)</th><th>2(b)</th><th>2(c)</th><th>2(d)</th>
                    <th style={{ borderLeft: '2px solid #d5d5d5' }}>3(a)</th><th>3(b)</th><th>3(c)</th><th>3(d)</th>
                    <th style={{ borderLeft: '2px solid #d5d5d5' }}>4(a)</th><th>4(b)</th><th>4(c)</th><th>4(d)</th>
                  </tr>
                </thead>
                <tbody>
                  {sectionAObtainedRows.length > 0 ? sectionAObtainedRows.map((row, idx) => (
                    <tr key={`sectA-${row.rollNumber}-${idx}`}>
                      <td className="roll-cell" title={row.name || row.rollNumber}>{row.rollNumber || '-'}</td>
                      {['Q1a','Q1b','Q1c','Q1d'].map(f => {
                        const val = row[f];
                        const isAbsent = val === 'A' || val === 'Absent';
                        return (
                          <td key={f} style={{ padding: '2px 3px' }}>
                            <input type="text" className={`sect-cell-input${isAbsent ? ' absent' : ''}`} value={isAbsent ? 'A' : (val ?? 0)} onChange={e => handleObtainedCell(idx, f, e.target.value)} onKeyDown={handleTableEnterNav} />
                          </td>
                        )
                      })}
                      {['Q2a','Q2b','Q2c','Q2d'].map((f, fi) => {
                        const val = row[f];
                        const isAbsent = val === 'A' || val === 'Absent';
                        return (
                          <td key={f} style={{ ...(fi === 0 ? { borderLeft: '2px solid #d5d5d5' } : {}), padding: '2px 3px' }}>
                            <input type="text" className={`sect-cell-input${isAbsent ? ' absent' : ''}`} value={isAbsent ? 'A' : (val ?? 0)} onChange={e => handleObtainedCell(idx, f, e.target.value)} onKeyDown={handleTableEnterNav} />
                          </td>
                        )
                      })}
                      {['Q3a','Q3b','Q3c','Q3d'].map((f, fi) => {
                        const val = row[f];
                        const isAbsent = val === 'A' || val === 'Absent';
                        return (
                          <td key={f} style={{ ...(fi === 0 ? { borderLeft: '2px solid #d5d5d5' } : {}), padding: '2px 3px' }}>
                            <input type="text" className={`sect-cell-input${isAbsent ? ' absent' : ''}`} value={isAbsent ? 'A' : (val ?? 0)} onChange={e => handleObtainedCell(idx, f, e.target.value)} onKeyDown={handleTableEnterNav} />
                          </td>
                        )
                      })}
                      {['Q4a','Q4b','Q4c','Q4d'].map((f, fi) => {
                        const val = row[f];
                        const isAbsent = val === 'A' || val === 'Absent';
                        return (
                          <td key={f} style={{ ...(fi === 0 ? { borderLeft: '2px solid #d5d5d5' } : {}), padding: '2px 3px' }}>
                            <input type="text" className={`sect-cell-input${isAbsent ? ' absent' : ''}`} value={isAbsent ? 'A' : (val ?? 0)} onChange={e => handleObtainedCell(idx, f, e.target.value)} onKeyDown={handleTableEnterNav} />
                          </td>
                        )
                      })}
                      <td className="co-total">{computeSectionAObtainedTotal(row)}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={18} style={{ textAlign: 'center', color: '#7f8c8d', padding: '20px' }}>
                        <div style={{ marginBottom: '10px' }}>
                          <strong>No students found for this course.</strong>
                        </div>
                        <div style={{ fontSize: '14px', lineHeight: '1.4' }}>
                          To view student marks, you need to:
                          <br />• Ensure students are enrolled in this course
                          <br />• Enter marks in "Enter Term Marks" section
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

export default SectionASheet;
