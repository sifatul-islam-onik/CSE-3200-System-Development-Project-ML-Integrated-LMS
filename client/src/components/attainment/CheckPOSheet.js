import React from 'react';

const CheckPOSheet = ({ programOutcomes, poCalcStudents }) => {
  if (!programOutcomes || programOutcomes.length === 0) return <p>Loading Program Outcomes...</p>;
  if (!poCalcStudents || poCalcStudents.length === 0) return <p>Loading Students...</p>;

  return (
    <section className="check-po-section">
      <h3>Check PO</h3>
      <div className="table-container" style={{ marginTop: '20px' }}>
        <table className="co-po-map-table">
          <thead>
            <tr>
              <th style={{ backgroundColor: '#2980b9', color: 'white' }}>Roll</th>
              {programOutcomes.map((po, idx) => (
                <th key={idx} style={{ backgroundColor: '#2980b9', color: 'white' }}>
                  {po.poCode || `PO${idx + 1}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {poCalcStudents.map((student, sIdx) => (
              <tr key={sIdx}>
                <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#e8f4f8' }}>
                  {student.rollNumber}
                </td>
                {programOutcomes.map((_, pIdx) => (
                  <td key={pIdx} style={{ textAlign: 'center' }}>Ok</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default CheckPOSheet;
