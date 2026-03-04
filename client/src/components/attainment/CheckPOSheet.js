import React from 'react';

// ── helpers (mirrors POCalcSheet / POCalcMaxSheet logic) ──────────────────────

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

// POCalc Theory only: =MMULT(coAttainmentPct_row, normalizedCOPO_col) / 100
const buildNormalizedMap = (clos, programOutcomes) => {
  const columnTotals = programOutcomes.map((_, poIdx) => {
    const poNumber = poIdx + 1;
    return clos.reduce((sum, clo) =>
      sum + (parseMappedPOs(clo.ploAssessed || '').has(poNumber) ? 1 : 0), 0);
  });
  return clos.map(clo => {
    const mapped = parseMappedPOs(clo.ploAssessed || '');
    return programOutcomes.map((_, poIdx) => {
      const ct = columnTotals[poIdx];
      return (mapped.has(poIdx + 1) && ct > 0) ? 1 / ct : 0;
    });
  });
};

const computePoCalcTheory = (coAttainmentData, clos, programOutcomes) => {
  if (!coAttainmentData?.length || !clos.length || !programOutcomes.length) return [];
  const normMap = buildNormalizedMap(clos, programOutcomes);
  return coAttainmentData.map(studentRow => {
    const poValues = programOutcomes.map((_, poIdx) => {
      const mmult = clos.reduce((sum, clo, coIdx) => {
        const cn = (clo.cloNumber || '').toString().replace('CLO', 'CO');
        return sum + (studentRow.coValues[cn] || 0) * normMap[coIdx][poIdx];
      }, 0);
      return parseFloat((mmult / 100).toFixed(4));
    });
    return { rollNumber: studentRow.rollNumber, poValues };
  });
};

// POCalcMax Theory only: =MIN(MMULT(binary_row, coPOMap_col), 1)
const computePoCalcMaxTheory = (coAttainmentData, clos, programOutcomes) => {
  if (!coAttainmentData?.length || !clos.length || !programOutcomes.length) return [];
  return coAttainmentData.map(studentRow => {
    const poValues = programOutcomes.map((_, poIdx) => {
      const poNumber = poIdx + 1;
      const mmult = clos.reduce((sum, clo) => {
        const cn = (clo.cloNumber || '').toString().replace('CLO', 'CO');
        const binary = (studentRow.coValues[cn] || 0) >= 55 ? 1 : 0;
        const mapped = parseMappedPOs(clo.ploAssessed || '').has(poNumber) ? 1 : 0;
        return sum + binary * mapped;
      }, 0);
      return Math.min(mmult, 1);
    });
    return { rollNumber: studentRow.rollNumber, poValues };
  });
};

// Formula: =IF(IF(POCalc!val >= 0.55, 1, 0) = POCalcMax!val, "Ok", "Prob")
const PO_THRESHOLD = 0.55;

const CheckPOSheet = ({ selectedCourse, clos, programOutcomes, poCalcStudents, theoryCoAttainmentData }) => {
  if (!programOutcomes || programOutcomes.length === 0) return <p>Loading Program Outcomes...</p>;
  if (!poCalcStudents || poCalcStudents.length === 0) return <p>Loading Students...</p>;

  const courseCode = selectedCourse?.courseCode || '';
  const lastDigit = parseInt(courseCode.charAt(courseCode.length - 1));
  const isTheoryCourse = lastDigit % 2 === 1;

  const safeClos = clos || [];
  const poCalcRows   = computePoCalcTheory(theoryCoAttainmentData, safeClos, programOutcomes);
  const poCalcMaxRows = computePoCalcMaxTheory(theoryCoAttainmentData, safeClos, programOutcomes);

  // Build lookup maps by rollNumber for fast access
  const poCalcMap   = Object.fromEntries(poCalcRows.map(r => [String(r.rollNumber).trim(), r.poValues]));
  const poCalcMaxMap = Object.fromEntries(poCalcMaxRows.map(r => [String(r.rollNumber).trim(), r.poValues]));

  const getCheck = (rollNumber, poIdx) => {
    const roll = String(rollNumber).trim();
    const calcVal  = (poCalcMap[roll]   || [])[poIdx] ?? 0;
    const maxVal   = (poCalcMaxMap[roll] || [])[poIdx] ?? 0;
    const binary   = calcVal >= PO_THRESHOLD ? 1 : 0;
    return binary === maxVal ? 'Ok' : 'Prob';
  };

  const noData = !theoryCoAttainmentData?.length || !safeClos.length;

  return (
    <section className="check-po-section">
      <h3>Check PO</h3>
      {!isTheoryCourse && (
        <p style={{ padding: '20px', color: '#7f8c8d' }}>
          Check PO is computed from Theory only data. Select the theory course or navigate to it.
        </p>
      )}
      {isTheoryCourse && noData && (
        <p style={{ padding: '20px', color: '#7f8c8d' }}>No attainment data available.</p>
      )}
      {isTheoryCourse && !noData && (
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
                  {programOutcomes.map((_, pIdx) => {
                    const result = getCheck(student.rollNumber, pIdx);
                    return (
                      <td key={pIdx} style={{
                        textAlign: 'center',
                        fontWeight: 'bold',
                        color: result === 'Ok' ? '#155724' : '#721c24',
                        backgroundColor: result === 'Ok' ? '#d4edda' : '#f8d7da',
                      }}>
                        {result}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default CheckPOSheet;
