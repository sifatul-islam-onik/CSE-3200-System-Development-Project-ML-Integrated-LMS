import React from 'react';

// ─── helpers ──────────────────────────────────────────────────────────────────
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

// For each student row in coAttainmentData, compute PO values using:
// PO[po] = MIN(MMULT(binaryAchievementRow, coPOMapColumn[po]), 1)
// binaryAchievement[co] = coValues[co] >= 55 ? 1 : 0
// coPOMap[co][po]       = 1 if po is in clo.ploAssessed, else 0
const computePOValues = (coAttainmentData, clos, programOutcomes) => {
  if (!coAttainmentData || !clos || !programOutcomes) return [];
  return coAttainmentData.map(studentRow => {
    const poValues = programOutcomes.map((_, poIdx) => {
      const poNumber = poIdx + 1;
      const mmult = clos.reduce((sum, clo) => {
        const cn = (clo.cloNumber || '').toString().replace('CLO', 'CO');
        const pct = studentRow.coValues[cn] || 0;
        const binary = pct >= 55 ? 1 : 0;
        const mapped = parseMappedPOs(clo.ploAssessed || '').has(poNumber) ? 1 : 0;
        return sum + binary * mapped;
      }, 0);
      return Math.min(mmult, 1);
    });
    return { rollNumber: studentRow.rollNumber, poValues };
  });
};

// Variant using combinedCOPOMatrix ({ CO1: [1,3,5], CO2: [2,4], ... }) for CO-PO mapping.
// Used for Theory+Lab table where the Combined CO-PO Mapping table is the source.
const computePOValuesCombined = (coAttainmentData, combinedCOPOMatrix, programOutcomes) => {
  if (!coAttainmentData || !combinedCOPOMatrix || !programOutcomes) return [];
  return coAttainmentData.map(studentRow => {
    const poValues = programOutcomes.map((_, poIdx) => {
      const poNumber = poIdx + 1;
      const mmult = Object.keys(combinedCOPOMatrix).reduce((sum, cn) => {
        const pct = studentRow.coValues[cn] || 0;
        const binary = pct >= 55 ? 1 : 0;
        const mapped = combinedCOPOMatrix[cn].includes(poNumber) ? 1 : 0;
        return sum + binary * mapped;
      }, 0);
      return Math.min(mmult, 1);
    });
    return { rollNumber: studentRow.rollNumber, poValues };
  });
};

// ─── Generic PO table (placeholder rows, no computed values) ─────────────────
const POTablePlaceholder = ({ title, programOutcomes, poCalcStudents }) => (
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

// ─── Computed PO table ────────────────────────────────────────────────────────
// Renders PO values computed via MMULT(binaryAchievementRow, coPOMapCol) capped at 1.
const POTableComputed = ({ title, programOutcomes, computedRows }) => {
  if (!computedRows || computedRows.length === 0) {
    return (
      <div className="table-container" style={{ marginTop: '20px' }}>
        <h4 style={{ marginBottom: '15px', color: '#2c3e50' }}>{title}</h4>
        <p style={{ padding: '10px', color: '#7f8c8d' }}>No attainment data available.</p>
      </div>
    );
  }
  return (
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
          {computedRows.map((row, sIdx) => (
            <tr key={sIdx}>
              <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#e8f4f8' }}>
                {row.rollNumber}
              </td>
              {row.poValues.map((val, pIdx) => (
                <td key={pIdx} style={{
                  textAlign: 'center',
                  fontWeight: val > 0 ? '600' : 'normal',
                  backgroundColor: val > 0 ? '#d4edda' : 'white',
                }}>
                  {val}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ─── Main export ──────────────────────────────────────────────────────────────
const POCalcMaxSheet = ({ selectedCourse, clos, programOutcomes, poCalcStudents, theoryCoAttainmentData, labCoAttainmentData, combinedCoAttainmentData, combinedCOPOMatrix, unnormedCoAttainmentData, equalWtCoAttainmentData }) => {
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

  // Compute Theory-only PO values:
  // MIN(MMULT(binaryAchievementRow, coPOMapColumn), 1)
  const theoryPORows = computePOValues(theoryCoAttainmentData, clos, programOutcomes);

  // Compute Lab-only PO values using the same formula with labCoAttainmentData:
  // MIN(MMULT(binaryLabAchievementRow, labCOPOMapColumn), 1)
  const labPORows = computePOValues(labCoAttainmentData, clos, programOutcomes);

  // Compute Theory+Lab PO values using combinedCoAttainmentData and combinedCOPOMatrix:
  // MIN(MMULT(binaryCombinedAchievementRow, combinedCOPOMapColumn), 1)
  const combinedPORows = computePOValuesCombined(combinedCoAttainmentData, combinedCOPOMatrix, programOutcomes);

  // Theory+Lab(unnorm): same formula with unnormedCoAttainmentData and combinedCOPOMatrix
  const unnormedPORows = computePOValuesCombined(unnormedCoAttainmentData, combinedCOPOMatrix, programOutcomes);

  // Theory+Lab(Eq Wt): same formula with equalWtCoAttainmentData and combinedCOPOMatrix
  const equalWtPORows = computePOValuesCombined(equalWtCoAttainmentData, combinedCOPOMatrix, programOutcomes);

  return (
    <section className="po-calc-max-section">
      <h3>PO Calculation Max</h3>
      {isTheoryCourse && (
        <POTableComputed
          title="Theory only"
          programOutcomes={programOutcomes}
          computedRows={theoryPORows}
        />
      )}
      {isLabCourse && (
        <POTableComputed
          title="Lab Only"
          programOutcomes={programOutcomes}
          computedRows={labPORows}
        />
      )}
      <POTableComputed
        title="Theory+Lab"
        programOutcomes={programOutcomes}
        computedRows={combinedPORows}
      />
      <POTableComputed
        title="Theory+Lab(unnorm)"
        programOutcomes={programOutcomes}
        computedRows={unnormedPORows}
      />
      <POTableComputed
        title="Theory+Lab(Eq Wt)"
        programOutcomes={programOutcomes}
        computedRows={equalWtPORows}
      />
    </section>
  );
};

export default POCalcMaxSheet;
