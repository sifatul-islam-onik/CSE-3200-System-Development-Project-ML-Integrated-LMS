import React from 'react';

const ChartsSheet = ({ selectedCourse, clos, programOutcomes }) => {
  const courseCode = selectedCourse?.courseCode || '';
  const lastDigit = parseInt(courseCode.charAt(courseCode.length - 1));
  const baseCode = courseCode.substring(0, courseCode.length - 1);
  const isTheory = lastDigit % 2 === 1;
  const theoryCourseCode = isTheory ? courseCode : baseCode + (lastDigit - 1);
  const labCourseCode = isTheory ? baseCode + (lastDigit + 1) : courseCode;

  if (!clos || clos.length === 0) return <p>Loading Course Outcomes...</p>;
  if (!programOutcomes || programOutcomes.length === 0) return <p>Loading Program Outcomes...</p>;

  return (
    <section className="charts-section">
      <h3>Charts</h3>

      {/* CO Achievement Table */}
      <div className="table-container" style={{ marginTop: '20px' }}>
        <h4 style={{ marginBottom: '15px', color: '#2c3e50' }}>
          CO Attainment of {theoryCourseCode} + {labCourseCode}
        </h4>
        <table className="co-po-map-table">
          <thead>
            <tr>
              <th style={{ backgroundColor: '#2980b9', color: 'white' }}>Metric</th>
              {clos.map((clo, idx) => {
                const cn = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                return <th key={idx} style={{ backgroundColor: '#2980b9', color: 'white' }}>{cn}</th>;
              })}
            </tr>
          </thead>
          <tbody>
            {['Achieved(%)', 'Unnorm Achieved(%)', 'Eq. Wt. Achieved(%)'].map(metric => (
              <tr key={metric}>
                <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#e8f4f8' }}>{metric}</td>
                {clos.map((_, idx) => <td key={idx} style={{ textAlign: 'center' }}>-</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* PO Achievement Table */}
      <div className="table-container" style={{ marginTop: '30px' }}>
        <h4 style={{ marginBottom: '15px', color: '#2c3e50' }}>
          PO Attainment of {theoryCourseCode} + {labCourseCode}
        </h4>
        <table className="co-po-map-table">
          <thead>
            <tr>
              <th style={{ backgroundColor: '#2980b9', color: 'white' }}>Metric</th>
              {programOutcomes.map((po, idx) => (
                <th key={idx} style={{ backgroundColor: '#2980b9', color: 'white' }}>
                  {po.poCode || `PO${idx + 1}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {['Achieved(%)', 'Unnorm Achieved(%)', 'Eq. Wt. Achieved(%)'].map(metric => (
              <tr key={metric}>
                <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#e8f4f8' }}>{metric}</td>
                {programOutcomes.map((_, idx) => <td key={idx} style={{ textAlign: 'center' }}>-</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default ChartsSheet;
