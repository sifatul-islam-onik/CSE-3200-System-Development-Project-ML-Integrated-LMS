import React from 'react';
import * as XLSX from 'xlsx';

// ── helpers ──────────────────────────────────────────────────────────────────

// Parse "1,3,5" → Set of PO numbers
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

// Build normalizedMap[coIdx][poIdx] = 1/columnTotal  (or 0 if not mapped)
// Used for the own-course (theory) tables: =MMULT(coAttainmentPct_row, normalizedCOPO_col)
const buildNormalizedMap = (clos, programOutcomes) => {
  const columnTotals = programOutcomes.map((_, poIdx) => {
    const poNumber = poIdx + 1;
    return clos.reduce((sum, clo) => {
      return sum + (parseMappedPOs(clo.ploAssessed || '').has(poNumber) ? 1 : 0);
    }, 0);
  });
  return clos.map(clo => {
    const mapped = parseMappedPOs(clo.ploAssessed || '');
    return programOutcomes.map((_, poIdx) => {
      const ct = columnTotals[poIdx];
      return (mapped.has(poIdx + 1) && ct > 0) ? 1 / ct : 0;
    });
  });
};

// =MMULT(coAttainmentPct_row, normalizedCOPO_col) for each student × PO
const computePOValuesNormalized = (coAttainmentData, clos, programOutcomes) => {
  if (!coAttainmentData || !coAttainmentData.length || !clos.length || !programOutcomes.length) return [];
  const normMap = buildNormalizedMap(clos, programOutcomes);
  return coAttainmentData.map(studentRow => {
    const poValues = programOutcomes.map((_, poIdx) => {
      const mmult = clos.reduce((sum, clo, coIdx) => {
        const cn = (clo.cloNumber || '').toString().replace('CLO', 'CO');
        const pct = studentRow.coValues[cn] || 0;
        return sum + pct * normMap[coIdx][poIdx];
      }, 0);
      return parseFloat((mmult / 100).toFixed(4));
    });
    return { rollNumber: studentRow.rollNumber, poValues };
  });
};

// Build normalizedMap[cn][poIdx] = 1/columnTotal from combinedCOPOMatrix ({CO1:[1,3],...})
const buildNormalizedMapFromMatrix = (combinedCOPOMatrix, programOutcomes) => {
  const coKeys = Object.keys(combinedCOPOMatrix || {});
  const columnTotals = programOutcomes.map((_, poIdx) => {
    const poNumber = poIdx + 1;
    return coKeys.reduce((sum, cn) => {
      return sum + ((combinedCOPOMatrix[cn] || []).includes(poNumber) ? 1 : 0);
    }, 0);
  });
  const result = {};
  coKeys.forEach(cn => {
    result[cn] = programOutcomes.map((_, poIdx) => {
      const ct = columnTotals[poIdx];
      return ((combinedCOPOMatrix[cn] || []).includes(poIdx + 1) && ct > 0) ? 1 / ct : 0;
    });
  });
  return result;
};

// =MMULT(coAttainmentPct_row, normalizedCombinedCOPO_col)/100 for each student × PO
const computePOValuesNormalizedCombined = (coAttainmentData, combinedCOPOMatrix, programOutcomes) => {
  if (!coAttainmentData || !coAttainmentData.length || !combinedCOPOMatrix || !programOutcomes.length) return [];
  const normMap = buildNormalizedMapFromMatrix(combinedCOPOMatrix, programOutcomes);
  const coKeys = Object.keys(combinedCOPOMatrix);
  return coAttainmentData.map(studentRow => {
    const poValues = programOutcomes.map((_, poIdx) => {
      const mmult = coKeys.reduce((sum, cn) => {
        const pct = studentRow.coValues[cn] || 0;
        return sum + pct * (normMap[cn]?.[poIdx] || 0);
      }, 0);
      return parseFloat((mmult / 100).toFixed(4));
    });
    return { rollNumber: studentRow.rollNumber, poValues };
  });
};

// ── Placeholder table (not yet implemented) ──────────────────────────────────
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

// ── Computed table ────────────────────────────────────────────────────────────
const POTableComputed = ({ title, programOutcomes, computedRows }) => {
  if (!computedRows || computedRows.length === 0) {
    return (
      <div className="table-container" style={{ marginTop: '20px' }}>
        <h4 style={{ marginBottom: '15px', color: '#2c3e50' }}>{title}</h4>
        <p style={{ padding: '20px', color: '#7f8c8d' }}>No attainment data available.</p>
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
          {computedRows.map((row, rIdx) => (
            <tr key={rIdx}>
              <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#e8f4f8' }}>
                {row.rollNumber}
              </td>
              {row.poValues.map((val, pIdx) => (
                <td key={pIdx} style={{ textAlign: 'center' }}>
                  {val > 0 ? val : '-'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────
const POCalcSheet = ({ selectedCourse, clos, programOutcomes, poCalcStudents, theoryCoAttainmentData, labCourseClos, labCoAttainmentData, combinedCoAttainmentData, combinedCOPOMatrix }) => {
  const courseCode = selectedCourse?.courseCode || '';
  const lastDigit = parseInt(courseCode.charAt(courseCode.length - 1));
  const isTheoryCourse = lastDigit % 2 === 1;
  const isLabCourse = lastDigit % 2 === 0;

  if (!programOutcomes || programOutcomes.length === 0) return <p>Loading Program Outcomes...</p>;
  if (!poCalcStudents || poCalcStudents.length === 0) return <p>Loading Students...</p>;

  // Theory only: =MMULT(COCalc!$AB5:$AG5, COPOMap!P$13:P$18)
  // COCalc!col = CO Attainment (Theory) %, COPOMap!col = Normalized CO-PO Mapping (theory course)
  const theoryPORows = computePOValuesNormalized(theoryCoAttainmentData, clos || [], programOutcomes);

  // Lab Only: =MMULT(LabActivity!$AK32:$AP32, COPOMap!P$23:P$28)
  // LabActivity!col = CO attainment from lab activity, COPOMap!col = Normalized CO-PO Mapping (lab course)
  const labPORows = computePOValuesNormalized(labCoAttainmentData, labCourseClos || [], programOutcomes);

  // Theory+Lab: =MMULT(COCalc!$AB5:$AG5, COPOMap!P$13:P$18)/100
  // COCalc!col = CO Attainment (Theory+Lab) %, COPOMap!col = Normalized Combined CO-PO Mapping
  const combinedPORows = computePOValuesNormalizedCombined(combinedCoAttainmentData, combinedCOPOMatrix, programOutcomes);

  const handleExportToExcel = () => {
    const safeNum = v => { const n = Number(v); return isFinite(n) ? n : 0; };
    const wb = XLSX.utils.book_new();
    const poNames = programOutcomes.map((po, idx) => po.poCode || `PO${idx + 1}`);

    const buildSheet = (computedRows) => {
      const header = ['Roll', ...poNames];
      const dataRows = computedRows.map(row => [row.rollNumber, ...row.poValues.map(safeNum)]);
      return XLSX.utils.aoa_to_sheet([header, ...dataRows]);
    };

    if (isTheoryCourse && theoryPORows.length > 0)
      XLSX.utils.book_append_sheet(wb, buildSheet(theoryPORows), 'Theory only');
    if (combinedPORows.length > 0)
      XLSX.utils.book_append_sheet(wb, buildSheet(combinedPORows), 'Theory+Lab');

    if (wb.SheetNames.length === 0) return;
    XLSX.writeFile(wb, `POCalc_${courseCode}.xlsx`);
  };

  return (
    <section className="po-calc-section">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
        <button
          onClick={handleExportToExcel}
          style={{ backgroundColor: '#27ae60', color: '#fff', border: 'none', borderRadius: '6px', padding: '8px 18px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}
        >
          Export to Excel
        </button>
      </div>
      <h3>PO Calculation</h3>
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
    </section>
  );
};

export default POCalcSheet;
