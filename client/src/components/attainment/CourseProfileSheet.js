import React from 'react';

const CourseProfileSheet = ({ clos, renderCLOCell }) => {
  if (clos.length === 0) return null;

  return (
    <section className="course-profile-section" style={{ marginTop: '30px' }}>
      <h2>Course Profile</h2>
      <div className="table-wrapper">
        <table className="clo-table">
          <thead>
            <tr>
              <th rowSpan="2">CLOs</th>
              <th rowSpan="2">CLO Description</th>
              <th colSpan="4">Bloom's Learning Levels</th>
              <th rowSpan="2">PLOs Assessed</th>
              <th rowSpan="2">CLO-PLO Correlation</th>
            </tr>
            <tr>
              <th>C</th>
              <th>A</th>
              <th>P</th>
              <th>S</th>
            </tr>
          </thead>
          <tbody>
            {clos.map((clo) => (
              <tr key={clo.cloNumber}>
                <td className="clo-number">{clo.cloNumber}</td>
                <td className="clo-description">
                  {renderCLOCell(clo, 'description', clo.description)}
                </td>
                <td className="bloom-level">
                  {renderCLOCell(clo, 'bloomC', clo.bloomLevels.cognitive)}
                </td>
                <td className="bloom-level">
                  {renderCLOCell(clo, 'bloomA', clo.bloomLevels.affective)}
                </td>
                <td className="bloom-level">
                  {renderCLOCell(clo, 'bloomP', clo.bloomLevels.psychomotor)}
                </td>
                <td className="bloom-level">
                  {renderCLOCell(clo, 'bloomS', clo.bloomLevels.social)}
                </td>
                <td className="plo-assessed">
                  {renderCLOCell(clo, 'ploAssessed', clo.ploAssessed)}
                </td>
                <td className="clo-plo-corr">
                  {renderCLOCell(clo, 'cloPloCorrelation', clo.cloPloCorrelation)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default CourseProfileSheet;
