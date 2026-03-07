import React from 'react';
import * as XLSX from 'xlsx';
import { SheetLoader } from './LoadingSpinner';

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
const POTableComputed = ({ title, programOutcomes, computedRows, showYCount = false }) => {
  if (!computedRows || computedRows.length === 0) {
    return (
      <div className="table-container" style={{ marginTop: '20px' }}>
        <h4 style={{ marginBottom: '15px', color: '#2c3e50' }}>{title}</h4>
        <p style={{ padding: '10px', color: '#7f8c8d' }}>No attainment data available.</p>
      </div>
    );
  }

  const totalStudents = computedRows.length;

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
        {showYCount && (
          <tfoot>
            <tr>
              <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#e8f4f8', whiteSpace: 'nowrap' }}>
                Y count
              </td>
              {programOutcomes.map((_, pIdx) => {
                // =IF(COUNTIF(col,0)>=$D$135,"--",COUNTIF(col,1))
                // $D$135 = total number of students
                const zeroCount = computedRows.filter(r => r.poValues[pIdx] === 0).length;
                const val = zeroCount >= totalStudents ? '--' : computedRows.filter(r => r.poValues[pIdx] === 1).length;
                return (
                  <td key={pIdx} style={{ textAlign: 'center', fontWeight: 'bold' }}>
                    {val}
                  </td>
                );
              })}
            </tr>
            <tr>
              <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#e8f4f8', whiteSpace: 'nowrap' }}>
                Achieved(%)
              </td>
              {programOutcomes.map((_, pIdx) => {
                // =IFERROR(C132/$B$135*100,"--")
                // C132 = Y count for this PO; $B$135 = total students
                const zeroCount = computedRows.filter(r => r.poValues[pIdx] === 0).length;
                const yCount = zeroCount >= totalStudents ? null : computedRows.filter(r => r.poValues[pIdx] === 1).length;
                const val = yCount == null ? '--' : parseFloat((yCount / totalStudents * 100).toFixed(2));
                return (
                  <td key={pIdx} style={{ textAlign: 'center', fontWeight: 'bold' }}>
                    {val === '--' ? '--' : `${val}%`}
                  </td>
                );
              })}
            </tr>
          </tfoot>
        )}
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
    return <SheetLoader label="Loading Program Outcomes…" />;
  }
  if (!poCalcStudents || poCalcStudents.length === 0) {
    return <SheetLoader label="Loading Students…" />;
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
  const handleExportToExcel = () => {
    const safeNum = v => { const n = Number(v); return isFinite(n) ? n : 0; };
    const wb = XLSX.utils.book_new();
    const poNames = programOutcomes.map((po, idx) => po.poCode || `PO${idx + 1}`);

    const buildSheet = (computedRows, withYCount = false) => {
      const header = ['Roll', ...poNames];
      const dataRows = computedRows.map(row => [row.rollNumber, ...row.poValues.map(safeNum)]);
      const aoa = [header, ...dataRows];
      if (withYCount && computedRows.length > 0) {
        const totalStudents = computedRows.length;
        const yCountRow = ['Y count', ...programOutcomes.map((_, pIdx) => {
          const zeroCount = computedRows.filter(r => r.poValues[pIdx] === 0).length;
          return zeroCount >= totalStudents ? '--' : computedRows.filter(r => r.poValues[pIdx] === 1).length;
        })];
        const achievedRow = ['Achieved(%)', ...programOutcomes.map((_, pIdx) => {
          const zeroCount = computedRows.filter(r => r.poValues[pIdx] === 0).length;
          const yCount = zeroCount >= totalStudents ? null : computedRows.filter(r => r.poValues[pIdx] === 1).length;
          return yCount == null ? '--' : parseFloat((yCount / totalStudents * 100).toFixed(2));
        })];
        aoa.push(yCountRow, achievedRow);
      }
      return XLSX.utils.aoa_to_sheet(aoa);
    };

    if (isTheoryCourse && theoryPORows.length > 0)
      XLSX.utils.book_append_sheet(wb, buildSheet(theoryPORows), 'Theory only');
    if (combinedPORows.length > 0)
      XLSX.utils.book_append_sheet(wb, buildSheet(combinedPORows, true), 'Theory+Lab');
    if (unnormedPORows.length > 0)
      XLSX.utils.book_append_sheet(wb, buildSheet(unnormedPORows, true), 'Theory+Lab(unnorm)');
    if (equalWtPORows.length > 0)
      XLSX.utils.book_append_sheet(wb, buildSheet(equalWtPORows, true), 'Theory+Lab(Eq Wt)');

    if (wb.SheetNames.length === 0) return;
    XLSX.writeFile(wb, `POCalcMax_${courseCode}.xlsx`);
  };
  return (
    <section className="po-calc-max-section">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
        <button
          onClick={handleExportToExcel}
          style={{ backgroundColor: '#27ae60', color: '#fff', border: 'none', borderRadius: '6px', padding: '8px 18px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}
        >
          Export to Excel
        </button>
      </div>
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
        showYCount
      />
      <POTableComputed
        title="Theory+Lab(unnorm)"
        programOutcomes={programOutcomes}
        computedRows={unnormedPORows}
        showYCount
      />
      <POTableComputed
        title="Theory+Lab(Eq Wt)"
        programOutcomes={programOutcomes}
        computedRows={equalWtPORows}
        showYCount
      />
    </section>
  );
};

export default POCalcMaxSheet;
