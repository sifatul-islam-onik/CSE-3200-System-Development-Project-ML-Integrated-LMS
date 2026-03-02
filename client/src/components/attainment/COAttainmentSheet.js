import React from 'react';

const AttainmentTable = ({ clos, coAttainmentData, formatNumber, keyPrefix, title }) => (
  <section className="co-attainment-section" style={{ marginTop: '30px' }}>
    <h2>{title}</h2>
    {clos.length === 0 && (
      <p style={{ padding: '20px', color: '#7f8c8d' }}>Loading course outcomes...</p>
    )}
    {clos.length > 0 && coAttainmentData.length === 0 && (
      <p style={{ padding: '20px', color: '#7f8c8d' }}>No student data available.</p>
    )}
    {clos.length > 0 && coAttainmentData.length > 0 && (
      <div className="table-wrapper">
        <table className="co-attainment-table">
          <thead>
            <tr>
              <th rowSpan="2">Roll</th>
              <th colSpan={clos.length}>Attainment of COs in %</th>
              <th colSpan={clos.length}>CO Achievement&gt;=55%</th>
              <th colSpan={clos.length}>Binary Achievement&gt;=55%</th>
            </tr>
            <tr>
              {clos.map((clo, idx) => {
                const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                return <th key={`att-${keyPrefix}-${idx}`}>{coNumber}</th>;
              })}
              {clos.map((clo, idx) => {
                const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                return <th key={`ach-${keyPrefix}-${idx}`}>{coNumber}</th>;
              })}
              {clos.map((clo, idx) => {
                const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                return <th key={`bin-${keyPrefix}-${idx}`}>{coNumber}</th>;
              })}
            </tr>
          </thead>
          <tbody>
            {coAttainmentData.map((studentRow, studentIdx) => (
              <tr key={studentIdx}>
                <td className="roll-cell">{studentRow.rollNumber}</td>
                {clos.map((clo, coIdx) => {
                  const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                  const percentage = studentRow.coValues[coNumber] || 0;
                  return (
                    <td key={`att-${keyPrefix}-${coIdx}`} style={{ textAlign: 'center' }}>
                      {formatNumber(percentage)}%
                    </td>
                  );
                })}
                {clos.map((clo, coIdx) => {
                  const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                  const percentage = studentRow.coValues[coNumber] || 0;
                  const achieved = percentage >= 55;
                  return (
                    <td key={`ach-${keyPrefix}-${coIdx}`} style={{
                      textAlign: 'center', fontWeight: '600',
                      color: achieved ? '#27ae60' : '#e74c3c'
                    }}>
                      {achieved ? 'Y' : 'N'}
                    </td>
                  );
                })}
                {clos.map((clo, coIdx) => {
                  const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                  const percentage = studentRow.coValues[coNumber] || 0;
                  const achieved = percentage >= 55;
                  return (
                    <td key={`bin-${keyPrefix}-${coIdx}`} style={{
                      textAlign: 'center', fontWeight: '600',
                      backgroundColor: achieved ? '#d4edda' : '#f8d7da'
                    }}>
                      {achieved ? '1' : '0'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="footer-label">Average</td>
              {clos.map((clo, coIdx) => {
                const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                const total = coAttainmentData.reduce((sum, r) => sum + (r.coValues[coNumber] || 0), 0);
                const avg = coAttainmentData.length > 0 ? total / coAttainmentData.length : 0;
                return (
                  <td key={`avg-att-${keyPrefix}-${coIdx}`} style={{ textAlign: 'center', fontWeight: 'bold' }}>
                    {formatNumber(avg)}%
                  </td>
                );
              })}
              {clos.map((clo, coIdx) => {
                const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                const achievedCount = coAttainmentData.reduce((sum, r) =>
                  sum + ((r.coValues[coNumber] || 0) >= 55 ? 1 : 0), 0);
                const achievedPercentage = coAttainmentData.length > 0
                  ? (achievedCount / coAttainmentData.length) * 100 : 0;
                return (
                  <td key={`avg-ach-${keyPrefix}-${coIdx}`} style={{ textAlign: 'center', fontWeight: 'bold' }}>
                    {formatNumber(achievedPercentage)}%
                  </td>
                );
              })}
              {clos.map((clo, coIdx) => {
                const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                const achievedCount = coAttainmentData.reduce((sum, r) =>
                  sum + ((r.coValues[coNumber] || 0) >= 55 ? 1 : 0), 0);
                const avg = coAttainmentData.length > 0 ? achievedCount / coAttainmentData.length : 0;
                return (
                  <td key={`avg-bin-${keyPrefix}-${coIdx}`} style={{
                    textAlign: 'center', fontWeight: 'bold',
                    backgroundColor: avg >= 0.5 ? '#d4edda' : '#f8d7da'
                  }}>
                    {formatNumber(avg)}
                  </td>
                );
              })}
            </tr>
          </tfoot>
        </table>
      </div>
    )}
  </section>
);

const COAttainmentSheet = ({ selectedCourse, clos, coAttainmentData, theoryCoAttainmentData, labCoAttainmentData, combinedCoAttainmentData, unnormedCoAttainmentData, equalWtCoAttainmentData, formatNumber }) => {
  const courseCode = selectedCourse?.courseCode || '';
  const lastDigit = parseInt(courseCode.slice(-1));
  const isTheoryCourse = !isNaN(lastDigit) && lastDigit % 2 === 1;

  const courseInfo = (selectedCourse?.courseTitle || '').toLowerCase();
  const isProjectCourse = courseInfo.includes('project') ||
    courseInfo.includes('thesis') ||
    courseInfo.includes('research') ||
    courseInfo.includes('dissertation');
  const isLabCourse = (!isNaN(lastDigit) && lastDigit % 2 === 0) || isProjectCourse;

  return (
    <>
      {isTheoryCourse && (
        <AttainmentTable
          clos={clos}
          coAttainmentData={theoryCoAttainmentData && theoryCoAttainmentData.length > 0 ? theoryCoAttainmentData : coAttainmentData}
          formatNumber={formatNumber}
          keyPrefix="theory"
          title="CO Attainment - Theory Courses"
        />
      )}
      {isLabCourse && (
        <AttainmentTable
          clos={clos}
          coAttainmentData={labCoAttainmentData && labCoAttainmentData.length > 0 ? labCoAttainmentData : coAttainmentData}
          formatNumber={formatNumber}
          keyPrefix="lab"
          title="CO Attainment - Lab/Project Courses"
        />
      )}
      <AttainmentTable
        clos={clos}
        coAttainmentData={combinedCoAttainmentData && combinedCoAttainmentData.length > 0 ? combinedCoAttainmentData : coAttainmentData}
        formatNumber={formatNumber}
        keyPrefix="combined"
        title="CO Attainment - Combined (Theory+Lab)"
      />
      <AttainmentTable
        clos={clos}
        coAttainmentData={unnormedCoAttainmentData && unnormedCoAttainmentData.length > 0 ? unnormedCoAttainmentData : coAttainmentData}
        formatNumber={formatNumber}
        keyPrefix="unnormed"
        title="Attainment of COs in % (Theory+Lab) Unnormed"
      />
      <AttainmentTable
        clos={clos}
        coAttainmentData={equalWtCoAttainmentData && equalWtCoAttainmentData.length > 0 ? equalWtCoAttainmentData : coAttainmentData}
        formatNumber={formatNumber}
        keyPrefix="equalwt"
        title="Attainment of COs in % (Theory+Lab) Equal Wt"
      />
    </>
  );
};

export default COAttainmentSheet;
