import React from 'react';
import { SheetLoader } from './LoadingSpinner';

// ─── Grade helpers ────────────────────────────────────────────────────────────
const getLetterGrade = (total) => {
  if (total < 119) return 'F';
  if (total < 134) return 'D';
  if (total < 149) return 'C';
  if (total < 164) return 'C+';
  if (total < 179) return 'B-';
  if (total < 194) return 'B';
  if (total < 209) return 'B+';
  if (total < 224) return 'A-';
  if (total < 239) return 'A';
  return 'A+';
};
const getGradeBg = (total) => {
  if (total < 119) return '#f8d7da';
  if (total < 134) return '#ffe5cc';
  if (total < 149) return '#fff3cd';
  if (total < 164) return '#e7f5e0';
  if (total < 179) return '#d4edda';
  if (total < 194) return '#c3e6cb';
  if (total < 209) return '#b2dfbb';
  if (total < 224) return '#a1d9ab';
  if (total < 239) return '#8fd19e';
  return '#7ec98f';
};
const getGradeBorder = (total) => {
  if (total < 119) return '2px solid #c82333';
  if (total < 134) return '2px solid #ff9800';
  if (total < 149) return '2px solid #ffc107';
  if (total < 164) return '2px solid #81c784';
  if (total < 179) return '2px solid #66bb6a';
  if (total < 194) return '2px solid #4caf50';
  if (total < 209) return '2px solid #43a047';
  if (total < 224) return '2px solid #388e3c';
  if (total < 239) return '2px solid #2e7d32';
  return '2px solid #1b5e20';
};
const getGradeColor = (total) => total < 119 ? '#c82333' : '#2c3e50';

// ─── Per-student theory total helper ─────────────────────────────────────────
const computeStudentTheoryTotal = (studentRow, clos, attnAssignObtainedRows, getStudentCTFactoredMarks, getStudentAssignmentFactoredMarks) => {
  const attnStudent = attnAssignObtainedRows.find(s =>
    String(s.rollNumber || '').trim().toLowerCase() ===
    String(studentRow.rollNumber || '').trim().toLowerCase()
  );
  const attendance = attnStudent ? (attnStudent.attendance || 0) : 0;
  let total = 0;
  clos.forEach(clo => {
    const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
    total += (studentRow.sectionA.marksObtained[coNumber] || 0)
           + (studentRow.sectionB.marksObtained[coNumber] || 0)
           + getStudentCTFactoredMarks(studentRow.rollNumber, coNumber)
           + getStudentAssignmentFactoredMarks(studentRow.rollNumber, coNumber);
  });
  return total + attendance;
};

// ─── Table 1: Section A & B Marks ────────────────────────────────────────────
const SectionABTable = ({ clos, coCalcData, formatNumber }) => (
  <section className="co-calc-section" style={{ marginTop: '30px' }}>
    <h2>CO Calculation - Section A &amp; B Marks</h2>
    {clos.length === 0 && <SheetLoader label="Loading course outcomes…" />}
    {clos.length > 0 && coCalcData.length === 0 && <p style={{ padding: '20px', color: '#7f8c8d' }}>No student data available.</p>}
    {clos.length > 0 && coCalcData.length > 0 && (
      <div className="table-wrapper">
        <table className="co-calc-table">
          <thead>
            <tr>
              <th rowSpan="3">Roll</th>
              <th colSpan={clos.length * 2}>Section A</th>
              <th colSpan={clos.length * 2}>Section B</th>
            </tr>
            <tr>
              <th colSpan={clos.length}>Marks Obtained</th>
              <th colSpan={clos.length}>Marks Distribution</th>
              <th colSpan={clos.length}>Marks Obtained</th>
              <th colSpan={clos.length}>Marks Distribution</th>
            </tr>
            <tr>
              {clos.map((clo, idx) => <th key={`sA-obt-${idx}`}>{(clo.cloNumber || '').toString().replace('CLO', 'CO')}</th>)}
              {clos.map((clo, idx) => <th key={`sA-dist-${idx}`}>{(clo.cloNumber || '').toString().replace('CLO', 'CO')}</th>)}
              {clos.map((clo, idx) => <th key={`sB-obt-${idx}`}>{(clo.cloNumber || '').toString().replace('CLO', 'CO')}</th>)}
              {clos.map((clo, idx) => <th key={`sB-dist-${idx}`}>{(clo.cloNumber || '').toString().replace('CLO', 'CO')}</th>)}
            </tr>
          </thead>
          <tbody>
            {coCalcData.map((studentRow, sIdx) => (
              <tr key={sIdx}>
                <td className="roll-cell">{studentRow.rollNumber}</td>
                {clos.map((clo, coIdx) => {
                  const cn = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                  return <td key={`sA-obt-${coIdx}`} style={{ textAlign: 'center' }}>{formatNumber(studentRow.sectionA.marksObtained[cn] || 0)}</td>;
                })}
                {clos.map((clo, coIdx) => {
                  const cn = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                  return <td key={`sA-dist-${coIdx}`} style={{ textAlign: 'center' }}>{formatNumber(studentRow.sectionA.marksDistribution[cn] || 0)}</td>;
                })}
                {clos.map((clo, coIdx) => {
                  const cn = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                  return <td key={`sB-obt-${coIdx}`} style={{ textAlign: 'center' }}>{formatNumber(studentRow.sectionB.marksObtained[cn] || 0)}</td>;
                })}
                {clos.map((clo, coIdx) => {
                  const cn = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                  return <td key={`sB-dist-${coIdx}`} style={{ textAlign: 'center' }}>{formatNumber(studentRow.sectionB.marksDistribution[cn] || 0)}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </section>
);

// ─── Table 2: CO-PO percentage (Theory: CT+Assign+A+B) ──────────────────────
const TheoryCOPOTable = ({ clos, coCalcData, attnAssignObtainedRows, attendanceMarks, calculateFactoredCOTotals, calculateFactoredAssignmentCOTotals, getStudentCTFactoredMarks, getStudentAssignmentFactoredMarks, formatNumber }) => (
  <section className="co-po-percentage-section" style={{ marginTop: '30px' }}>
    <h2>CO-PO percentage (Theory: CT+Assign+A+B)</h2>
    {clos.length === 0 && <SheetLoader label="Loading course outcomes…" />}
    {clos.length > 0 && coCalcData.length === 0 && <p style={{ padding: '20px', color: '#7f8c8d' }}>No student data available.</p>}
    {clos.length > 0 && coCalcData.length > 0 && (
      <div className="table-wrapper">
        <table className="co-po-percentage-table">
          <thead>
            <tr>
              <th rowSpan="2">Roll</th>
              <th colSpan={clos.length}>Total Mark Obtained</th>
              <th colSpan={clos.length}>Total Marks Distribution</th>
              <th colSpan={clos.length} style={{ backgroundColor: '#16a085', color: '#fff' }}>CO Attainment (Theory)</th>
              <th rowSpan="3" style={{ backgroundColor: '#138d75', color: '#fff', fontWeight: '700', fontSize: '14px' }}>Total</th>
              <th rowSpan="3" style={{ backgroundColor: '#1abc9c', color: '#fff', fontWeight: '700', fontSize: '14px' }}>Ltr Grade</th>
            </tr>
            <tr>
              {clos.map((clo, idx) => <th key={`obt-co-${idx}`}>{(clo.cloNumber || '').toString().replace('CLO', 'CO')}</th>)}
              {clos.map((clo, idx) => <th key={`dist-co-${idx}`}>{(clo.cloNumber || '').toString().replace('CLO', 'CO')}</th>)}
              {clos.map((clo, idx) => (
                <th key={`th-attain-co-${idx}`} style={{ backgroundColor: '#16a085', color: '#fff' }}>
                  {(clo.cloNumber || '').toString().replace('CLO', 'CO')}
                </th>
              ))}
            </tr>
            <tr>
              <th style={{ fontSize: '13px', fontWeight: '600' }}>CO msrd</th>
              {clos.map((clo, coIdx) => {
                const cn = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                const factoredTotals = calculateFactoredCOTotals();
                const ctCoTotal = factoredTotals[cn] || 0;
                const factoredAssignmentTotals = calculateFactoredAssignmentCOTotals();
                const assignmentCoTotal = factoredAssignmentTotals[cn] || 0;
                let totalDistribution = 0;
                coCalcData.forEach(student => {
                  totalDistribution += (student.sectionA.marksDistribution[cn] || 0)
                    + (student.sectionB.marksDistribution[cn] || 0)
                    + ctCoTotal + assignmentCoTotal;
                });
                return <th key={`msrd-${coIdx}`} style={{ fontSize: '13px', fontWeight: '600' }}>{totalDistribution > 0 ? 1 : 0}</th>;
              })}
              {clos.map((clo, coIdx) => <th key={`msrd-empty-${coIdx}`}></th>)}
              {clos.map((clo, coIdx) => <th key={`th-attain-msrd-${coIdx}`} style={{ backgroundColor: '#16a085', borderLeft: 'none', borderRight: 'none' }}></th>)}
            </tr>
          </thead>
          <tbody>
            {coCalcData.map((studentRow, sIdx) => {
              const studentTotal = computeStudentTheoryTotal(studentRow, clos, attnAssignObtainedRows, getStudentCTFactoredMarks, getStudentAssignmentFactoredMarks);
              return (
                <tr key={sIdx}>
                  <td className="roll-cell">{studentRow.rollNumber}</td>
                  {clos.map((clo, coIdx) => {
                    const cn = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                    const marks = (studentRow.sectionA.marksObtained[cn] || 0)
                      + (studentRow.sectionB.marksObtained[cn] || 0)
                      + getStudentCTFactoredMarks(studentRow.rollNumber, cn)
                      + getStudentAssignmentFactoredMarks(studentRow.rollNumber, cn);
                    return <td key={`total-obt-${coIdx}`} style={{ textAlign: 'center' }}>{formatNumber(marks)}</td>;
                  })}
                  {clos.map((clo, coIdx) => {
                    const cn = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                    const factoredTotals = calculateFactoredCOTotals();
                    const factoredAssignmentTotals = calculateFactoredAssignmentCOTotals();
                    const marks = (studentRow.sectionA.marksDistribution[cn] || 0)
                      + (studentRow.sectionB.marksDistribution[cn] || 0)
                      + (factoredTotals[cn] || 0)
                      + (factoredAssignmentTotals[cn] || 0);
                    return <td key={`total-dist-${coIdx}`} style={{ textAlign: 'center' }}>{formatNumber(marks)}</td>;
                  })}
                  {clos.map((clo, coIdx) => {
                    const cn = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                    const factoredTotals = calculateFactoredCOTotals();
                    const factoredAssignmentTotals = calculateFactoredAssignmentCOTotals();
                    const totalObt = (studentRow.sectionA.marksObtained[cn] || 0)
                      + (studentRow.sectionB.marksObtained[cn] || 0)
                      + getStudentCTFactoredMarks(studentRow.rollNumber, cn)
                      + getStudentAssignmentFactoredMarks(studentRow.rollNumber, cn);
                    const totalDist = (studentRow.sectionA.marksDistribution[cn] || 0)
                      + (studentRow.sectionB.marksDistribution[cn] || 0)
                      + (factoredTotals[cn] || 0)
                      + (factoredAssignmentTotals[cn] || 0);
                    const pct = totalDist > 0 ? parseFloat(((totalObt / totalDist) * 100).toFixed(4)) : 0;
                    return <td key={`th-attain-${coIdx}`} style={{ textAlign: 'center', backgroundColor: '#a8e6d7' }}>{formatNumber(pct)}%</td>;
                  })}
                  <td style={{ textAlign: 'center', fontWeight: '700', backgroundColor: '#d5f4e6', border: '2px solid #138d75', fontSize: '14px' }}>
                    {formatNumber(studentTotal)}
                  </td>
                  <td style={{
                    textAlign: 'center', fontWeight: '700', fontSize: '15px',
                    border: getGradeBorder(studentTotal),
                    backgroundColor: getGradeBg(studentTotal),
                    color: getGradeColor(studentTotal)
                  }}>
                    {getLetterGrade(studentTotal)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    )}
  </section>
);

// ─── Table 3a: CT and Assignment Marks (COCalc version, no Attn) ─────────────
const CTAssignmentTableV1 = ({ clos, coCalcData, ctRows, assignmentRows, getActiveCTFields, getActiveAssignmentFields, calculateAutoFactor, calculateAutoAssignmentFactor, getStudentCTFactoredMarks, getStudentAssignmentFactoredMarks, formatNumber }) => (
  <section className="ct-assignment-section" style={{ marginTop: '30px' }}>
    <h2>CT and Assignment Marks</h2>
    {clos.length === 0 && <p style={{ padding: '20px', color: '#7f8c8d' }}>No student data available.</p>}
    {clos.length > 0 && coCalcData.length > 0 && (
      <div className="table-wrapper">
        <table className="co-po-percentage-table">
          <thead>
            <tr>
              <th rowSpan="3">Roll</th>
              <th colSpan={clos.length}>CT</th>
              <th colSpan={clos.length}>Assignment</th>
            </tr>
            <tr>
              <th colSpan={clos.length}>Mark Obtained + Distribution</th>
              <th colSpan={clos.length}>Mark Obtained + Distribution</th>
            </tr>
            <tr>
              {clos.map((clo, idx) => <th key={`ct-co-${idx}`}>{(clo.cloNumber || '').toString().replace('CLO', 'CO')}</th>)}
              {clos.map((clo, idx) => <th key={`asgn-co-${idx}`}>{(clo.cloNumber || '').toString().replace('CLO', 'CO')}</th>)}
            </tr>
            <tr>
              <th style={{ fontSize: '13px', fontWeight: '600' }}>CO msrd</th>
              {clos.map((clo, coIdx) => {
                const cn = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                const ctRow = ctRows.find(r => r.coNumber === cn);
                const coTotal = ctRow
                  ? getActiveCTFields().reduce((sum, field) => {
                      const ctKey = field.replace(/(_Q[123])$/, '');
                      const factor = calculateAutoFactor()[ctKey] || 0;
                      return sum + (factor * (ctRow[field] || 0));
                    }, 0)
                  : 0;
                return <th key={`ct-msrd-${coIdx}`} style={{ fontSize: '13px', fontWeight: '600' }}>{formatNumber(coTotal)}</th>;
              })}
              {clos.map((clo, coIdx) => {
                const cn = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                const assignRow = assignmentRows.find(r => r.coNumber === cn);
                const coTotal = assignRow
                  ? getActiveAssignmentFields().reduce((sum, field) => {
                      const assignmentKey = field.replace(/(_Q[123])$/, '');
                      const factor = calculateAutoAssignmentFactor()[assignmentKey] || 0;
                      return sum + (factor * (assignRow[field] || 0));
                    }, 0)
                  : 0;
                return <th key={`asgn-msrd-${coIdx}`} style={{ fontSize: '13px', fontWeight: '600' }}>{formatNumber(coTotal)}</th>;
              })}
            </tr>
          </thead>
          <tbody>
            {coCalcData.map((studentRow, sIdx) => (
              <tr key={sIdx}>
                <td className="roll-cell">{studentRow.rollNumber}</td>
                {clos.map((clo, coIdx) => {
                  const cn = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                  return <td key={`ct-${coIdx}`} style={{ textAlign: 'center' }}>{formatNumber(getStudentCTFactoredMarks(studentRow.rollNumber, cn))}</td>;
                })}
                {clos.map((clo, coIdx) => {
                  const cn = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                  return <td key={`asgn-${coIdx}`} style={{ textAlign: 'center' }}>{formatNumber(getStudentAssignmentFactoredMarks(studentRow.rollNumber, cn))}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </section>
);

// ─── Table 3b: CT/Assignment/Attn Marks (COCalc_LabUnnorm version, with Attn) ─
const CTAssignmentTableV2 = ({ clos, coCalcData, attnAssignObtainedRows, calculateFactoredCOTotals, calculateFactoredAssignmentCOTotals, getStudentCTFactoredMarks, getStudentAssignmentFactoredMarks, formatNumber }) => (
  <section className="ct-assignment-section" style={{ marginTop: '30px' }}>
    <h2>CT and Assignment Marks</h2>
    {clos.length === 0 && <SheetLoader label="Loading course outcomes…" />}
    {clos.length > 0 && coCalcData.length > 0 && (
      <div className="table-wrapper">
        <table className="ct-assignment-table">
          <thead>
            <tr>
              <th rowSpan="3">Roll</th>
              <th colSpan={clos.length}>CT</th>
              <th colSpan={clos.length}>Assignment</th>
              <th rowSpan="4">Attn</th>
            </tr>
            <tr>
              <th colSpan={clos.length}>Mark Obtained + Distribution</th>
              <th colSpan={clos.length}>Mark Obtained + Distribution</th>
            </tr>
            <tr>
              {clos.map((clo, idx) => <th key={`ct-co-${idx}`}>{(clo.cloNumber || '').toString().replace('CLO', 'CO')}</th>)}
              {clos.map((clo, idx) => <th key={`asgn-co-${idx}`}>{(clo.cloNumber || '').toString().replace('CLO', 'CO')}</th>)}
            </tr>
            <tr>
              <th style={{ fontSize: '13px', fontWeight: '600' }}>CO msrd</th>
              {clos.map((clo, coIdx) => {
                const cn = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                const coTotal = calculateFactoredCOTotals()[cn] || 0;
                return <th key={`ct-msrd-${coIdx}`} style={{ fontSize: '13px', fontWeight: '600' }}>{formatNumber(coTotal)}</th>;
              })}
              {clos.map((clo, coIdx) => {
                const cn = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                const coTotal = calculateFactoredAssignmentCOTotals()[cn] || 0;
                return <th key={`asgn-msrd-${coIdx}`} style={{ fontSize: '13px', fontWeight: '600' }}>{formatNumber(coTotal)}</th>;
              })}
            </tr>
          </thead>
          <tbody>
            {coCalcData.map((studentRow, sIdx) => {
              const attnStudent = attnAssignObtainedRows.find(s =>
                String(s.rollNumber || '').trim().toLowerCase() ===
                String(studentRow.rollNumber || '').trim().toLowerCase()
              );
              return (
                <tr key={sIdx}>
                  <td className="roll-cell">{studentRow.rollNumber}</td>
                  {clos.map((clo, coIdx) => {
                    const cn = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                    return <td key={`ct-${coIdx}`} style={{ textAlign: 'center' }}>{formatNumber(getStudentCTFactoredMarks(studentRow.rollNumber, cn))}</td>;
                  })}
                  {clos.map((clo, coIdx) => {
                    const cn = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                    return <td key={`asgn-${coIdx}`} style={{ textAlign: 'center' }}>{formatNumber(getStudentAssignmentFactoredMarks(studentRow.rollNumber, cn))}</td>;
                  })}
                  <td style={{ textAlign: 'center', fontWeight: '600' }}>
                    {formatNumber(attnStudent ? (attnStudent.attendance || 0) : 0)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    )}
  </section>
);

// ─── Table 4: CO-PO percentage (theory + Lab) ────────────────────────────────
const CombinedCOPOTable = ({
  clos, coCalcData, labActivityRows, labActivityObtainedRows,
  activityTaken, coMappedActivityMarks,
  attnAssignObtainedRows,
  calculateFactoredCOTotals, calculateFactoredAssignmentCOTotals,
  getStudentCTFactoredMarks, getStudentAssignmentFactoredMarks,
  getLabActivityStudentCOMappedMarks, getLabActivityStudentCOMarks,
  computeLabActivityCOTotal,
  formatNumber, tablePrefix, tableTitle, useUnweightedLab,
}) => (
  <section className="co-po-combined-percentage-section" style={{ marginTop: '30px' }}>
    <h2>{tableTitle || 'CO - PO percentage (theory + Lab)'}</h2>
    {clos.length === 0 && <SheetLoader label="Loading course outcomes…" />}
    {clos.length > 0 && coCalcData.length === 0 && <p style={{ padding: '20px', color: '#7f8c8d' }}>No student data available.</p>}
    {clos.length > 0 && coCalcData.length > 0 && (
      <div className="table-wrapper">
        <table className="co-po-percentage-table">
          <thead>
            <tr>
              <th rowSpan="2">Roll</th>
              <th colSpan={clos.length}>Total Mark Obtained</th>
              <th colSpan={clos.length}>Total Marks Distribution</th>
            </tr>
            <tr>
              {clos.map((clo, idx) => <th key={`${tablePrefix}-obt-${idx}`}>{(clo.cloNumber || '').toString().replace('CLO', 'CO')}</th>)}
              {clos.map((clo, idx) => <th key={`${tablePrefix}-dist-${idx}`}>{(clo.cloNumber || '').toString().replace('CLO', 'CO')}</th>)}
            </tr>
            <tr>
              <th style={{ fontSize: '13px', fontWeight: '600' }}>CO msrd</th>
              {clos.map((clo, coIdx) => {
                const cn = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                const factoredTotals = calculateFactoredCOTotals();
                const factoredAssignmentTotals = calculateFactoredAssignmentCOTotals();
                // BV$4 = fixed lab distribution total for this CO
                const labActivityRow = labActivityRows.find(r => r.coNumber === cn);
                let labCoTotal = 0;
                if (labActivityRow) {
                  if (useUnweightedLab) {
                    labCoTotal = computeLabActivityCOTotal(labActivityRow);
                  } else if (activityTaken > 0) {
                    const eqWt = (coMappedActivityMarks || 0) / (activityTaken || 1);
                    for (let i = 0; i < activityTaken; i++) {
                      const n = i + 1;
                      if ((labActivityRow[`Activity${n}_Q1`] || 0) !== 0) labCoTotal += eqWt;
                      if ((labActivityRow[`Activity${n}_Q2`] || 0) !== 0) labCoTotal += eqWt;
                      if ((labActivityRow[`Activity${n}_Q3`] || 0) !== 0) labCoTotal += eqWt;
                    }
                  }
                }
                let sumOfDistribution = 0;
                coCalcData.forEach(studentRow => {
                  // AO5 = same theory dist formula as TheoryCOPOTable (no attendance)
                  const theoryDist = (studentRow.sectionA.marksDistribution[cn] || 0)
                    + (studentRow.sectionB.marksDistribution[cn] || 0)
                    + (factoredTotals[cn] || 0)
                    + (factoredAssignmentTotals[cn] || 0);
                  sumOfDistribution += theoryDist + labCoTotal;
                });
                return <th key={`${tablePrefix}-msrd-${coIdx}`} style={{ fontSize: '13px', fontWeight: '600' }}>{sumOfDistribution > 0 ? 1 : 0}</th>;
              })}
              {clos.map((clo, coIdx) => {
                const cn = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                const labActivityRow = labActivityRows.find(r => r.coNumber === cn);
                const coTotal = labActivityRow ? computeLabActivityCOTotal(labActivityRow) : 0;
                return <th key={`${tablePrefix}-msrd-dist-${coIdx}`} style={{ fontSize: '13px', fontWeight: '600' }}>{formatNumber(coTotal)}</th>;
              })}
            </tr>
          </thead>
          <tbody>
            {coCalcData.map((studentRow, sIdx) => (
              <tr key={sIdx}>
                <td className="roll-cell">{studentRow.rollNumber}</td>
                {clos.map((clo, coIdx) => {
                  const cn = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                  const labActivityStudent = labActivityObtainedRows.find(s =>
                    String(s.rollNumber || '').trim().toLowerCase() === String(studentRow.rollNumber || '').trim().toLowerCase()
                  );
                  // AI5 = theory obtained for this student/CO
                  const theoryObt = (studentRow.sectionA.marksObtained[cn] || 0)
                    + (studentRow.sectionB.marksObtained[cn] || 0)
                    + getStudentCTFactoredMarks(studentRow.rollNumber, cn)
                    + getStudentAssignmentFactoredMarks(studentRow.rollNumber, cn);
                  // W32 = unweighted lab CO marks (unnorm) OR factored lab CO marks (norm)
                  const labMarks = useUnweightedLab
                    ? getLabActivityStudentCOMarks(labActivityStudent, cn)
                    : getLabActivityStudentCOMappedMarks(labActivityStudent, cn);
                  return <td key={`${tablePrefix}-obt-${coIdx}`} style={{ textAlign: 'center' }}>{formatNumber(theoryObt + labMarks)}</td>;
                })}
                {clos.map((clo, coIdx) => {
                  const cn = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                  const factoredTotals = calculateFactoredCOTotals();
                  const factoredAssignmentTotals = calculateFactoredAssignmentCOTotals();
                  // AO5 = theory dist for this student (no attendance)
                  const theoryDist = (studentRow.sectionA.marksDistribution[cn] || 0)
                    + (studentRow.sectionB.marksDistribution[cn] || 0)
                    + (factoredTotals[cn] || 0)
                    + (factoredAssignmentTotals[cn] || 0);
                  // BV$4 = fixed lab distribution total for this CO
                  const labActivityRow = labActivityRows.find(r => r.coNumber === cn);
                  let labCoTotal = 0;
                  if (labActivityRow) {
                    if (useUnweightedLab) {
                      labCoTotal = computeLabActivityCOTotal(labActivityRow);
                    } else if (activityTaken > 0) {
                      const eqWt = (coMappedActivityMarks || 0) / (activityTaken || 1);
                      for (let i = 0; i < activityTaken; i++) {
                        const n = i + 1;
                        if ((labActivityRow[`Activity${n}_Q1`] || 0) !== 0) labCoTotal += eqWt;
                        if ((labActivityRow[`Activity${n}_Q2`] || 0) !== 0) labCoTotal += eqWt;
                        if ((labActivityRow[`Activity${n}_Q3`] || 0) !== 0) labCoTotal += eqWt;
                      }
                    }
                  }
                  return <td key={`${tablePrefix}-dist-${coIdx}`} style={{ textAlign: 'center' }}>{formatNumber(theoryDist + labCoTotal)}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </section>
);

// ─── Table 5: CO attainment (theory+Lab) ─────────────────────────────────────
const COAttainmentCombinedTable = ({
  clos, coCalcData, labActivityRows, labActivityObtainedRows,
  activityTaken, coMappedActivityMarks,
  calculateFactoredCOTotals, calculateFactoredAssignmentCOTotals,
  getStudentCTFactoredMarks, getStudentAssignmentFactoredMarks,
  getLabActivityStudentCOMappedMarks, getLabActivityStudentCOMarks,
  computeLabActivityCOTotal, formatNumber, tablePrefix, useUnweightedLab,
}) => (
  <section className="co-attainment-combined-section" style={{ marginTop: '30px' }}>
    <h2>{useUnweightedLab ? 'CO attainment (theory+Lab) unnorm' : 'CO attainment (theory+Lab)'}</h2>
    {clos.length === 0 && <SheetLoader label="Loading course outcomes…" />}
    {clos.length > 0 && coCalcData.length === 0 && <p style={{ padding: '20px', color: '#7f8c8d' }}>No student data available.</p>}
    {clos.length > 0 && coCalcData.length > 0 && (
      <div className="table-wrapper">
        <table className="co-attainment-table">
          <thead>
            <tr>
              <th>Roll</th>
              {clos.map((clo, idx) => (
                <th key={`${tablePrefix}-co-attain-${idx}`} style={{ backgroundColor: '#16a085', color: '#fff' }}>
                  {(clo.cloNumber || '').toString().replace('CLO', 'CO')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {coCalcData.map((studentRow, sIdx) => (
              <tr key={sIdx}>
                <td className="roll-cell">{studentRow.rollNumber}</td>
                {clos.map((clo, coIdx) => {
                  const cn = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                  // BP5 = Total Mark Obtained (theory + lab)
                  const labActivityStudent = labActivityObtainedRows.find(s =>
                    String(s.rollNumber || '').trim().toLowerCase() === String(studentRow.rollNumber || '').trim().toLowerCase()
                  );
                  const labObt = useUnweightedLab
                    ? getLabActivityStudentCOMarks(labActivityStudent, cn)
                    : getLabActivityStudentCOMappedMarks(labActivityStudent, cn);
                  const theoryObt = (studentRow.sectionA.marksObtained[cn] || 0)
                    + (studentRow.sectionB.marksObtained[cn] || 0)
                    + getStudentCTFactoredMarks(studentRow.rollNumber, cn)
                    + getStudentAssignmentFactoredMarks(studentRow.rollNumber, cn);
                  const totalObt = theoryObt + labObt;
                  // BV5 = Total Marks Distribution (theory + lab)
                  const factoredTotals = calculateFactoredCOTotals();
                  const factoredAssignmentTotals = calculateFactoredAssignmentCOTotals();
                  const theoryDist = (studentRow.sectionA.marksDistribution[cn] || 0)
                    + (studentRow.sectionB.marksDistribution[cn] || 0)
                    + (factoredTotals[cn] || 0)
                    + (factoredAssignmentTotals[cn] || 0);
                  const labActivityRow = labActivityRows.find(r => r.coNumber === cn);
                  let labCoTotal = 0;
                  if (labActivityRow) {
                    if (useUnweightedLab) {
                      labCoTotal = computeLabActivityCOTotal(labActivityRow);
                    } else if (activityTaken > 0) {
                      const eqWt = (coMappedActivityMarks || 0) / (activityTaken || 1);
                      for (let i = 0; i < activityTaken; i++) {
                        const n = i + 1;
                        if ((labActivityRow[`Activity${n}_Q1`] || 0) !== 0) labCoTotal += eqWt;
                        if ((labActivityRow[`Activity${n}_Q2`] || 0) !== 0) labCoTotal += eqWt;
                        if ((labActivityRow[`Activity${n}_Q3`] || 0) !== 0) labCoTotal += eqWt;
                      }
                    }
                  }
                  const totalDist = theoryDist + labCoTotal;
                  const pct = totalDist > 0 ? parseFloat(((totalObt / totalDist) * 100).toFixed(4)) : 0;
                  return (
                    <td key={`${tablePrefix}-co-attain-${coIdx}`} style={{ textAlign: 'center', backgroundColor: '#a8e6d7' }}>
                      {formatNumber(pct)}%
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

// ─── Main export ─────────────────────────────────────────────────────────────
const COCalcSheet = ({
  selectedSheet,
  selectedCourse,
  clos,
  combinedClos,
  coCalcData,
  ctRows,
  assignmentRows,
  attnAssignObtainedRows,
  attendanceMarks,
  labActivityRows,
  labActivityObtainedRows,
  activityTaken,
  coMappedActivityMarks,
  calculateFactoredCOTotals,
  calculateFactoredAssignmentCOTotals,
  getStudentCTFactoredMarks,
  getStudentAssignmentFactoredMarks,
  getLabActivityStudentCOMappedMarks,
  getLabActivityStudentCOMarks,
  computeLabActivityCOTotal,
  getActiveCTFields,
  getActiveAssignmentFields,
  calculateAutoFactor,
  calculateAutoAssignmentFactor,
  formatNumber,
}) => {
  const courseCode = selectedCourse?.courseCode || '';
  const lastDigit = parseInt(courseCode.slice(-1));
  const isTheoryCourse = !isNaN(lastDigit) && lastDigit % 2 === 1;

  // Combined tables (CO-PO theory+Lab, CO attainment combined) use all COs from both courses.
  // Theory-only tables (Section A&B, CO-PO Theory, CT/Assignment) use only the own-course COs.
  const effectiveCombinedClos = (combinedClos && combinedClos.length > 0) ? combinedClos : clos;

  const commonProps = {
    clos: effectiveCombinedClos, coCalcData, labActivityRows, labActivityObtainedRows,
    activityTaken, coMappedActivityMarks,
    attnAssignObtainedRows,
    calculateFactoredCOTotals, calculateFactoredAssignmentCOTotals,
    getStudentCTFactoredMarks, getStudentAssignmentFactoredMarks,
    getLabActivityStudentCOMappedMarks, getLabActivityStudentCOMarks,
    computeLabActivityCOTotal, formatNumber,
  };

  if (selectedSheet === 'COCalc') {
    return (
      <>
        {isTheoryCourse && (
          <>
            <SectionABTable clos={clos} coCalcData={coCalcData} formatNumber={formatNumber} />
            <TheoryCOPOTable
              clos={clos} coCalcData={coCalcData} attnAssignObtainedRows={attnAssignObtainedRows}
              attendanceMarks={attendanceMarks}
              calculateFactoredCOTotals={calculateFactoredCOTotals}
              calculateFactoredAssignmentCOTotals={calculateFactoredAssignmentCOTotals}
              getStudentCTFactoredMarks={getStudentCTFactoredMarks}
              getStudentAssignmentFactoredMarks={getStudentAssignmentFactoredMarks}
              formatNumber={formatNumber}
            />
            <CTAssignmentTableV1
              clos={clos} coCalcData={coCalcData} ctRows={ctRows} assignmentRows={assignmentRows}
              getActiveCTFields={getActiveCTFields} getActiveAssignmentFields={getActiveAssignmentFields}
              calculateAutoFactor={calculateAutoFactor} calculateAutoAssignmentFactor={calculateAutoAssignmentFactor}
              getStudentCTFactoredMarks={getStudentCTFactoredMarks}
              getStudentAssignmentFactoredMarks={getStudentAssignmentFactoredMarks}
              formatNumber={formatNumber}
            />
          </>
        )}
        <CombinedCOPOTable {...commonProps} tablePrefix="calc" />
        <COAttainmentCombinedTable {...commonProps} tablePrefix="calc" />
      </>
    );
  }

  if (selectedSheet === 'COCalc_LabUnnorm') {
    return (
      <>
        {isTheoryCourse && (
          <>
            <SectionABTable clos={clos} coCalcData={coCalcData} formatNumber={formatNumber} />
            <TheoryCOPOTable
              clos={clos} coCalcData={coCalcData} attnAssignObtainedRows={attnAssignObtainedRows}
              attendanceMarks={attendanceMarks}
              calculateFactoredCOTotals={calculateFactoredCOTotals}
              calculateFactoredAssignmentCOTotals={calculateFactoredAssignmentCOTotals}
              getStudentCTFactoredMarks={getStudentCTFactoredMarks}
              getStudentAssignmentFactoredMarks={getStudentAssignmentFactoredMarks}
              formatNumber={formatNumber}
            />
            <CTAssignmentTableV2
              clos={clos} coCalcData={coCalcData} attnAssignObtainedRows={attnAssignObtainedRows}
              calculateFactoredCOTotals={calculateFactoredCOTotals}
              calculateFactoredAssignmentCOTotals={calculateFactoredAssignmentCOTotals}
              getStudentCTFactoredMarks={getStudentCTFactoredMarks}
              getStudentAssignmentFactoredMarks={getStudentAssignmentFactoredMarks}
              formatNumber={formatNumber}
            />
          </>
        )}
        <CombinedCOPOTable {...commonProps} tablePrefix="unnorm" tableTitle="CO - PO percentage (theory + Lab) unnorm lab" useUnweightedLab={true} />
        <COAttainmentCombinedTable {...commonProps} tablePrefix="unnorm" useUnweightedLab={true} />
      </>
    );
  }

  return null;
};

export default COCalcSheet;
