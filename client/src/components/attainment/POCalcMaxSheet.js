import React from 'react';

const POTable = ({ title, programOutcomes, poCalcStudents }) => (
  <div className="table-container" style={{ marginTop: '20px' }}>
    <h4 style={{ marginBottom: '15px', color: '#2c3e50' }}>{title}</h4>
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
              <td key={pIdx} style={{ textAlign: 'center' }}>-</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const POCalcMaxSheet = ({ selectedCourse, programOutcomes, poCalcStudents }) => {
  const courseCode = selectedCourse?.courseCode || '';
  const lastDigit = parseInt(courseCode.charAt(courseCode.length - 1));
  const isTheoryCourse = lastDigit % 2 === 1;
  const isLabCourse = lastDigit % 2 === 0;

  if (!programOutcomes || programOutcomes.length === 0) {
    return <p>Loading Program Outcomes...</p>;
  }
  if (!poCalcStudents || poCalcStudents.length === 0) {
    return <p>Loading Students...</p>;
  }

  return (
    <section className="po-calc-max-section">
      <h3>PO Calculation Max</h3>
      {isTheoryCourse && <POTable title="Theory only" programOutcomes={programOutcomes} poCalcStudents={poCalcStudents} />}
      {isLabCourse && <POTable title="Lab Only" programOutcomes={programOutcomes} poCalcStudents={poCalcStudents} />}
      <POTable title="Theory+Lab" programOutcomes={programOutcomes} poCalcStudents={poCalcStudents} />
      <POTable title="Theory+Lab(unnorm)" programOutcomes={programOutcomes} poCalcStudents={poCalcStudents} />
      <POTable title="Theory+Lab(Eq Wt)" programOutcomes={programOutcomes} poCalcStudents={poCalcStudents} />
    </section>
  );
};

export default POCalcMaxSheet;
