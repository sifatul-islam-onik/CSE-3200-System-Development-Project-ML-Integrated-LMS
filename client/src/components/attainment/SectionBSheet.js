import React from 'react';

const SectionBSheet = ({
  clos,
  sectionBRows,
  sectionBObtainedRows,
  computeSectionBObtainedTotal,
  sectionBQuestionTotals,
  setShowSectionBGeneratedModal,
  setShowSectionBObtainedModal,
}) => {
  return (
    <section className="section-b-section" style={{ marginTop: '30px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ borderBottom: 'none', marginBottom: 0, paddingBottom: 0 }}>
          Allocated marks for Section-B in final question
        </h2>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', color: '#7f8c8d', fontStyle: 'italic' }}>Edit via "Marks Distribution" in Enter Term Marks</span>
          <button
            onClick={() => setShowSectionBGeneratedModal(true)}
            style={{
              padding: '8px 16px',
              backgroundColor: '#3498db',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
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
                  <th colSpan="4">5</th>
                  <th style={{ borderLeft: '2px solid #d5d5d5' }} colSpan="4">6</th>
                  <th style={{ borderLeft: '2px solid #d5d5d5' }} colSpan="4">7</th>
                  <th style={{ borderLeft: '2px solid #d5d5d5' }} colSpan="4">8</th>
                </tr>
                <tr>
                  <th>5(a)</th><th>5(b)</th><th>5(c)</th><th>5(d)</th>
                  <th style={{ borderLeft: '2px solid #d5d5d5' }}>6(a)</th><th>6(b)</th><th>6(c)</th><th>6(d)</th>
                  <th style={{ borderLeft: '2px solid #d5d5d5' }}>7(a)</th><th>7(b)</th><th>7(c)</th><th>7(d)</th>
                  <th style={{ borderLeft: '2px solid #d5d5d5' }}>8(a)</th><th>8(b)</th><th>8(c)</th><th>8(d)</th>
                </tr>
              </thead>
              <tbody>
                {sectionBRows.map((row, idx) => (
                  <tr key={row.coNumber || idx}>
                    <td className="co-label">{row.coNumber || '-'}</td>
                    {['Q1a','Q1b','Q1c','Q1d'].map((f) => (
                      <td key={f} style={{ textAlign: 'center' }}>{row[f] || 0}</td>
                    ))}
                    {['Q2a','Q2b','Q2c','Q2d'].map((f, fi) => (
                      <td key={f} style={{ ...(fi === 0 ? { borderLeft: '2px solid #d5d5d5' } : {}), textAlign: 'center' }}>{row[f] || 0}</td>
                    ))}
                    {['Q3a','Q3b','Q3c','Q3d'].map((f, fi) => (
                      <td key={f} style={{ ...(fi === 0 ? { borderLeft: '2px solid #d5d5d5' } : {}), textAlign: 'center' }}>{row[f] || 0}</td>
                    ))}
                    {['Q4a','Q4b','Q4c','Q4d'].map((f, fi) => (
                      <td key={f} style={{ ...(fi === 0 ? { borderLeft: '2px solid #d5d5d5' } : {}), textAlign: 'center' }}>{row[f] || 0}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="footer-label">Total</td>
                  {(() => {
                    const questionTotals = sectionBQuestionTotals();
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

          {/* Obtained Marks for Section-B */}
          <section style={{ marginTop: '30px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0 }}>Obtained marks for Section-B</h3>
              <button
                onClick={() => setShowSectionBObtainedModal(true)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#3498db',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                View Generated Table
              </button>
            </div>
            <div className="table-wrapper">
              <table className="section-a-table">
                <thead>
                  <tr>
                    <th rowSpan="2">Roll</th>
                    <th colSpan="4">5</th>
                    <th style={{ borderLeft: '2px solid #d5d5d5' }} colSpan="4">6</th>
                    <th style={{ borderLeft: '2px solid #d5d5d5' }} colSpan="4">7</th>
                    <th style={{ borderLeft: '2px solid #d5d5d5' }} colSpan="4">8</th>
                    <th rowSpan="2">Total</th>
                  </tr>
                  <tr>
                    <th>5(a)</th><th>5(b)</th><th>5(c)</th><th>5(d)</th>
                    <th style={{ borderLeft: '2px solid #d5d5d5' }}>6(a)</th><th>6(b)</th><th>6(c)</th><th>6(d)</th>
                    <th style={{ borderLeft: '2px solid #d5d5d5' }}>7(a)</th><th>7(b)</th><th>7(c)</th><th>7(d)</th>
                    <th style={{ borderLeft: '2px solid #d5d5d5' }}>8(a)</th><th>8(b)</th><th>8(c)</th><th>8(d)</th>
                  </tr>
                </thead>
                <tbody>
                  {sectionBObtainedRows.length > 0 ? sectionBObtainedRows.map((row, idx) => (
                    <tr key={`sectB-${row.rollNumber}-${idx}`}>
                      <td className="roll-cell" title={row.name || row.rollNumber}>{row.rollNumber || '-'}</td>
                      <td style={{ textAlign: 'center' }}>{row.Q1a || 0}</td>
                      <td style={{ textAlign: 'center' }}>{row.Q1b || 0}</td>
                      <td style={{ textAlign: 'center' }}>{row.Q1c || 0}</td>
                      <td style={{ textAlign: 'center' }}>{row.Q1d || 0}</td>
                      <td style={{ borderLeft: '2px solid #d5d5d5', textAlign: 'center' }}>{row.Q2a || 0}</td>
                      <td style={{ textAlign: 'center' }}>{row.Q2b || 0}</td>
                      <td style={{ textAlign: 'center' }}>{row.Q2c || 0}</td>
                      <td style={{ textAlign: 'center' }}>{row.Q2d || 0}</td>
                      <td style={{ borderLeft: '2px solid #d5d5d5', textAlign: 'center' }}>{row.Q3a || 0}</td>
                      <td style={{ textAlign: 'center' }}>{row.Q3b || 0}</td>
                      <td style={{ textAlign: 'center' }}>{row.Q3c || 0}</td>
                      <td style={{ textAlign: 'center' }}>{row.Q3d || 0}</td>
                      <td style={{ borderLeft: '2px solid #d5d5d5', textAlign: 'center' }}>{row.Q4a || 0}</td>
                      <td style={{ textAlign: 'center' }}>{row.Q4b || 0}</td>
                      <td style={{ textAlign: 'center' }}>{row.Q4c || 0}</td>
                      <td style={{ textAlign: 'center' }}>{row.Q4d || 0}</td>
                      <td className="co-total">{computeSectionBObtainedTotal(row)}</td>
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

export default SectionBSheet;
