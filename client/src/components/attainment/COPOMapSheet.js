import React from 'react';

const COPOMapSheet = ({ selectedCourse, clos, programOutcomes, combinedCOPOMatrix, matchingCourseCode }) => {
  if (!clos || clos.length === 0) {
    return <p>No Course Outcomes available. Please load course profile data.</p>;
  }
  if (!programOutcomes || programOutcomes.length === 0) {
    return <p>Loading Program Outcomes...</p>;
  }

  // ── helpers ────────────────────────────────────────────────────────────────
  const parseMappedPOs = (ploAssessed) => {
    const set = new Set();
    if (ploAssessed && ploAssessed.trim()) {
      ploAssessed.split(',').forEach(part => {
        const n = parseInt(part.trim());
        if (!isNaN(n) && n > 0) set.add(n);
      });
    }
    return set;
  };

  const columnTotals = programOutcomes.map((_, poIdx) => {
    const poNumber = poIdx + 1;
    let total = 0;
    clos.forEach(clo => {
      const mapped = parseMappedPOs(clo.ploAssessed || '');
      if (mapped.has(poNumber)) total++;
    });
    return total;
  });

  const headerRow = (
    <tr>
      <th style={{ backgroundColor: '#2980b9', color: 'white' }}>CO/PO</th>
      {programOutcomes.map((po, idx) => (
        <th key={idx} style={{ backgroundColor: '#2980b9', color: 'white' }}>
          {po.poCode || `PO${idx + 1}`}
        </th>
      ))}
      <th style={{ backgroundColor: '#2980b9', color: 'white' }}>Total</th>
    </tr>
  );

  return (
    <section className="co-po-map-section">
      <h3>CO-PO Mapping Table</h3>

      {/* ── Raw mapping ───────────────────────────────────────────────────── */}
      <div className="table-container">
        <table className="co-po-map-table">
          <thead>{headerRow}</thead>
          <tbody>
            {clos.map((clo, coIdx) => {
              const cn = (clo.cloNumber || '').toString().replace('CLO', 'CO');
              const mappedPOs = parseMappedPOs(clo.ploAssessed || '');
              return (
                <tr key={coIdx}>
                  <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#e8f4f8' }}>{cn}</td>
                  {programOutcomes.map((_, poIdx) => {
                    const isMapped = mappedPOs.has(poIdx + 1);
                    return (
                      <td key={poIdx} style={{
                        textAlign: 'center',
                        backgroundColor: isMapped ? '#d5f4e6' : 'white',
                        fontWeight: isMapped ? 'bold' : 'normal'
                      }}>
                        {isMapped ? '1' : '-'}
                      </td>
                    );
                  })}
                  <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#fff3cd' }}>
                    {mappedPOs.size}
                  </td>
                </tr>
              );
            })}
            {/* Column totals row */}
            <tr>
              <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#e8f4f8' }}>Total</td>
              {columnTotals.map((ct, poIdx) => (
                <td key={poIdx} style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#fff3cd' }}>{ct}</td>
              ))}
              <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#fff3cd' }}>-</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Normalized mapping ────────────────────────────────────────────── */}
      <div className="table-container" style={{ marginTop: '30px' }}>
        <h4 style={{ marginBottom: '15px', color: '#2c3e50' }}>Normalized CO-PO Mapping (Contribution per PO)</h4>
        <table className="co-po-map-table">
          <thead>
            <tr>
              <th style={{ backgroundColor: '#2980b9', color: 'white' }}>CO/PO</th>
              {programOutcomes.map((po, idx) => (
                <th key={idx} style={{ backgroundColor: '#2980b9', color: 'white' }}>{po.poCode || `PO${idx + 1}`}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {clos.map((clo, coIdx) => {
              const cn = (clo.cloNumber || '').toString().replace('CLO', 'CO');
              const mappedPOs = parseMappedPOs(clo.ploAssessed || '');
              return (
                <tr key={coIdx}>
                  <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#e8f4f8' }}>{cn}</td>
                  {programOutcomes.map((_, poIdx) => {
                    const isMapped = mappedPOs.has(poIdx + 1);
                    const ct = columnTotals[poIdx];
                    const norm = isMapped && ct > 0 ? parseFloat((1 / ct).toFixed(4)) : 0;
                    return (
                      <td key={poIdx} style={{
                        textAlign: 'center',
                        backgroundColor: isMapped ? '#d5f4e6' : 'white',
                        fontWeight: isMapped ? 'bold' : 'normal'
                      }}>
                        {norm > 0 ? norm : '-'}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {/* Column totals row */}
            <tr>
              <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#e8f4f8' }}>Total</td>
              {columnTotals.map((ct, poIdx) => (
                <td key={poIdx} style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#fff3cd' }}>
                  {ct > 0 ? parseFloat((1).toFixed(4)) : '-'}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Combined Theory+Lab mapping (only when paired course exists) ───── */}
      {combinedCOPOMatrix && matchingCourseCode && (
        <>
          {/* Raw combined */}
          <div className="table-container" style={{ marginTop: '30px' }}>
            <h4 style={{ marginBottom: '15px', color: '#2c3e50' }}>
              Combined CO-PO Mapping ({selectedCourse.courseCode} + {matchingCourseCode})
            </h4>
            <table className="co-po-map-table">
              <thead>{headerRow}</thead>
              <tbody>
                {Object.keys(combinedCOPOMatrix).sort().map((cn, coIdx) => {
                  const mappedPOs = combinedCOPOMatrix[cn];
                  return (
                    <tr key={coIdx}>
                      <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#e8f4f8' }}>{cn}</td>
                      {programOutcomes.map((_, poIdx) => {
                        const isMapped = mappedPOs.includes(poIdx + 1);
                        return (
                          <td key={poIdx} style={{
                            textAlign: 'center',
                            backgroundColor: isMapped ? '#d5f4e6' : 'white',
                            fontWeight: isMapped ? 'bold' : 'normal'
                          }}>
                            {isMapped ? '1' : '-'}
                          </td>
                        );
                      })}
                      <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#fff3cd' }}>{mappedPOs.length}</td>
                    </tr>
                  );
                })}
                <tr>
                  <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#e8f4f8' }}>Total</td>
                  {programOutcomes.map((_, poIdx) => {
                    const ct = Object.keys(combinedCOPOMatrix).reduce((sum, cn) =>
                      sum + (combinedCOPOMatrix[cn].includes(poIdx + 1) ? 1 : 0), 0);
                    return <td key={poIdx} style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#fff3cd' }}>{ct}</td>;
                  })}
                  <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#fff3cd' }}>-</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Normalized combined */}
          <div className="table-container" style={{ marginTop: '30px' }}>
            <h4 style={{ marginBottom: '15px', color: '#2c3e50' }}>
              Normalized Combined CO-PO Mapping ({selectedCourse.courseCode} + {matchingCourseCode})
            </h4>
            <table className="co-po-map-table">
              <thead>
                <tr>
                  <th style={{ backgroundColor: '#2980b9', color: 'white' }}>CO/PO</th>
                  {programOutcomes.map((po, idx) => (
                    <th key={idx} style={{ backgroundColor: '#2980b9', color: 'white' }}>{po.poCode || `PO${idx + 1}`}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const combinedColumnTotals = programOutcomes.map((_, poIdx) =>
                    Object.keys(combinedCOPOMatrix).reduce((sum, cn) =>
                      sum + (combinedCOPOMatrix[cn].includes(poIdx + 1) ? 1 : 0), 0)
                  );
                  return (
                    <>
                      {Object.keys(combinedCOPOMatrix).sort().map((cn, coIdx) => {
                        const mappedPOs = combinedCOPOMatrix[cn];
                        return (
                          <tr key={coIdx}>
                            <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#e8f4f8' }}>{cn}</td>
                            {programOutcomes.map((_, poIdx) => {
                              const isMapped = mappedPOs.includes(poIdx + 1);
                              const ct = combinedColumnTotals[poIdx];
                              const norm = isMapped && ct > 0 ? parseFloat((1 / ct).toFixed(4)) : 0;
                              return (
                                <td key={poIdx} style={{
                                  textAlign: 'center',
                                  backgroundColor: isMapped ? '#d5f4e6' : 'white',
                                  fontWeight: isMapped ? 'bold' : 'normal'
                                }}>
                                  {isMapped ? norm : '-'}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                      <tr>
                        <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#e8f4f8' }}>Total</td>
                        {combinedColumnTotals.map((ct, poIdx) => (
                          <td key={poIdx} style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#fff3cd' }}>
                            {ct > 0 ? parseFloat((1).toFixed(4)) : '-'}
                          </td>
                        ))}
                      </tr>
                    </>
                  );
                })()}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
};

export default COPOMapSheet;
