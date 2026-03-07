import React from 'react';
import * as XLSX from 'xlsx';
import { SkeletonTable } from './LoadingSpinner';

// ── Summary tables: CO measured & Wt ─────────────────────────────────────────
const COSummaryTables = ({ clos, theoryCoAttainmentData, labCoAttainmentData }) => {
  if (!clos.length) return null;

  const coNumbers = clos.map(clo => (clo.cloNumber || '').toString().replace('CLO', 'CO'));

  // Use sourceType from Course Profile to determine theory/lab presence
  // sourceType is 'theory', 'lab', or 'both' — falls back to data presence if missing
  const theoryBin = clos.map((clo, i) => {
    const cn = coNumbers[i];
    if (clo.sourceType) {
      return (clo.sourceType === 'theory' || clo.sourceType === 'both') ? 1 : 0;
    }
    // fallback: check if any student has non-zero value in theory data
    return Array.isArray(theoryCoAttainmentData) && theoryCoAttainmentData.some(s => (s.coValues?.[cn] || 0) > 0) ? 1 : 0;
  });

  const labBin = clos.map((clo, i) => {
    const cn = coNumbers[i];
    if (clo.sourceType) {
      return (clo.sourceType === 'lab' || clo.sourceType === 'both') ? 1 : 0;
    }
    // fallback
    return Array.isArray(labCoAttainmentData) && labCoAttainmentData.some(s => (s.coValues?.[cn] || 0) > 0) ? 1 : 0;
  });
  const sumBin    = coNumbers.map((_, i) => theoryBin[i] + labBin[i]);

  // Wt values: each binary cell divided by its column sum (0 if sum is 0)
  const fmt = (v, s) => s === 0 ? '0' : Number(v / s).toFixed(2).replace(/\.?0+$/, '') || '0';
  const theoryWt = coNumbers.map((_, i) => fmt(theoryBin[i], sumBin[i]));
  const labWt    = coNumbers.map((_, i) => fmt(labBin[i],    sumBin[i]));

  const renderMeasuredTable = () => (
    <div className="co-summary-table-wrap">
      <table className="co-summary-table">
        <thead>
          <tr>
            <th className="co-summary-th-label">CO measured</th>
            {coNumbers.map((cn, i) => <th key={i}>{cn}</th>)}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="co-summary-row-label">Theory</td>
            {theoryBin.map((v, i) => (
              <td key={i} className={v ? 'co-summary-bin co-summary-bin--1' : 'co-summary-bin co-summary-bin--0'}>{v}</td>
            ))}
          </tr>
          <tr>
            <td className="co-summary-row-label">Lab</td>
            {labBin.map((v, i) => (
              <td key={i} className={v ? 'co-summary-bin co-summary-bin--1' : 'co-summary-bin co-summary-bin--0'}>{v}</td>
            ))}
          </tr>
          <tr>
            <td className="co-summary-row-label co-summary-row-label--sum">Sum</td>
            {sumBin.map((v, i) => (
              <td key={i} className="co-summary-bin co-summary-bin--sum">{v}</td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );

  const renderWtTable = () => (
    <div className="co-summary-table-wrap">
      <table className="co-summary-table">
        <thead>
          <tr>
            <th className="co-summary-th-label">Wt</th>
            {coNumbers.map((cn, i) => <th key={i}>{cn}</th>)}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="co-summary-row-label">Theory</td>
            {theoryWt.map((v, i) => (
              <td key={i} className={parseFloat(v) > 0 ? 'co-summary-bin co-summary-bin--1' : 'co-summary-bin co-summary-bin--0'}>{v}</td>
            ))}
          </tr>
          <tr>
            <td className="co-summary-row-label">Lab</td>
            {labWt.map((v, i) => (
              <td key={i} className={parseFloat(v) > 0 ? 'co-summary-bin co-summary-bin--1' : 'co-summary-bin co-summary-bin--0'}>{v}</td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="co-summary-tables-container">
      {renderMeasuredTable()}
      {renderWtTable()}
    </div>
  );
};

const AttainmentTable = ({ clos, coAttainmentData, formatNumber, keyPrefix, title, showAchievementAvg = false }) => (
  <section className="co-attainment-section" style={{ marginTop: '30px' }}>
    <h2>{title}</h2>
    {clos.length === 0 && <SkeletonTable rows={6} cols={5} />}
    {clos.length > 0 && coAttainmentData.length === 0 && (
      <SkeletonTable rows={6} cols={Math.min(clos.length * 3 + 1, 13)} />
    )}
    {clos.length > 0 && coAttainmentData.length > 0 && (
      <div className="table-wrapper">
        <table className="co-attainment-table">
          <thead>
            <tr>
              <th rowSpan="2" style={{ position: 'sticky', left: 0, top: 0, zIndex: 12, backgroundColor: '#2980b9', color: 'white' }}>Roll</th>
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
                if (!showAchievementAvg) return <td key={`avg-ach-${keyPrefix}-${coIdx}`} />;
                const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                // =IF(COUNTIF(AT6:AT130,"--")>0,"--",COUNTIF(AT6:AT130,"Y"))
                // "--" in CO Achievement>= column means the student has no data for that CO
                const hasNoData = coAttainmentData.some(r => r.coValues?.[coNumber] == null);
                const val = hasNoData ? '--' : coAttainmentData.filter(r => (r.coValues?.[coNumber] || 0) >= 55).length;
                return (
                  <td key={`avg-ach-${keyPrefix}-${coIdx}`} style={{ textAlign: 'center', fontWeight: 'bold' }}>
                    {val}
                  </td>
                );
              })}
              {clos.map((_, coIdx) => (
                <td key={`avg-bin-${keyPrefix}-${coIdx}`} />
              ))}
            </tr>
            {showAchievementAvg && (
              <tr>
                <td className="footer-label">Achieved(%)</td>
                {/* Attainment of COs in % — empty */}
                {clos.map((_, coIdx) => (
                  <td key={`achpct-att-${keyPrefix}-${coIdx}`} />
                ))}
                {/* CO Achievement>= — =IFERROR(AT132/$B$133*100,"--") */}
                {clos.map((clo, coIdx) => {
                  const coNumber = (clo.cloNumber || '').toString().replace('CLO', 'CO');
                  const hasNoData = coAttainmentData.some(r => r.coValues?.[coNumber] == null);
                  const yCount = hasNoData ? '--' : coAttainmentData.filter(r => (r.coValues?.[coNumber] || 0) >= 55).length;
                  const val = yCount === '--' ? '--' : parseFloat((yCount / coAttainmentData.length * 100).toFixed(2));
                  return (
                    <td key={`achpct-ach-${keyPrefix}-${coIdx}`} style={{ textAlign: 'center', fontWeight: 'bold' }}>
                      {val === '--' ? '--' : `${val}%`}
                    </td>
                  );
                })}
                {/* Binary — empty */}
                {clos.map((_, coIdx) => (
                  <td key={`achpct-bin-${keyPrefix}-${coIdx}`} />
                ))}
              </tr>
            )}
          </tfoot>
        </table>
      </div>
    )}
  </section>
);

const COAttainmentSheet = ({ selectedCourse, clos, ownClos, coAttainmentData, theoryCoAttainmentData, labCoAttainmentData, combinedCoAttainmentData, unnormedCoAttainmentData, equalWtCoAttainmentData, formatNumber }) => {
  const courseCode = selectedCourse?.courseCode || '';
  const lastDigit = parseInt(courseCode.replace(/\s/g, '').slice(-1));
  const isTheoryCourse = !isNaN(lastDigit) && lastDigit % 2 === 1;
  const isLabCourse    = !isNaN(lastDigit) && lastDigit % 2 === 0;
  const separatedClos = (ownClos && ownClos.length > 0) ? ownClos : clos;

  const handleExportToExcel = () => {
    const wb = XLSX.utils.book_new();

    const buildSheet = (closList, data) => {
      if (!data || !data.length || !closList.length) return null;
      const coNumbers = closList.map(clo => (clo.cloNumber || '').toString().replace('CLO', 'CO'));
      const header = [
        'Roll',
        ...coNumbers.map(cn => `${cn} (%)`),
        ...coNumbers.map(cn => `${cn} (>=55?)`),
        ...coNumbers.map(cn => `${cn} (Binary)`),
      ];
      const dataRows = data.map(studentRow => [
        studentRow.rollNumber,
        ...coNumbers.map(cn => parseFloat(formatNumber(studentRow.coValues[cn] || 0)) || 0),
        ...coNumbers.map(cn => (studentRow.coValues[cn] || 0) >= 55 ? 'Y' : 'N'),
        ...coNumbers.map(cn => (studentRow.coValues[cn] || 0) >= 55 ? 1 : 0),
      ]);
      const avgRow = [
        'Average',
        ...coNumbers.map(cn => {
          const total = data.reduce((sum, r) => sum + (r.coValues[cn] || 0), 0);
          return parseFloat(formatNumber(data.length > 0 ? total / data.length : 0)) || 0;
        }),
        ...coNumbers.map(cn => {
          const hasNoData = data.some(r => r.coValues?.[cn] == null);
          return hasNoData ? '--' : data.filter(r => (r.coValues?.[cn] || 0) >= 55).length;
        }),
        ...coNumbers.map(() => ''),
      ];
      const achievedRow = [
        'Achieved(%)',
        ...coNumbers.map(() => ''),
        ...coNumbers.map(cn => {
          const hasNoData = data.some(r => r.coValues?.[cn] == null);
          if (hasNoData) return '--';
          const yCount = data.filter(r => (r.coValues?.[cn] || 0) >= 55).length;
          return parseFloat((yCount / data.length * 100).toFixed(2));
        }),
        ...coNumbers.map(() => ''),
      ];
      return [header, ...dataRows, avgRow, achievedRow];
    };

    const effectiveTheory   = theoryCoAttainmentData?.length   > 0 ? theoryCoAttainmentData   : coAttainmentData;
    const effectiveLab      = labCoAttainmentData?.length      > 0 ? labCoAttainmentData      : coAttainmentData;
    const effectiveCombined = combinedCoAttainmentData?.length > 0 ? combinedCoAttainmentData : coAttainmentData;
    const effectiveUnnormed = unnormedCoAttainmentData?.length > 0 ? unnormedCoAttainmentData : coAttainmentData;
    const effectiveEqualWt  = equalWtCoAttainmentData?.length  > 0 ? equalWtCoAttainmentData  : coAttainmentData;

    if (isTheoryCourse) {
      const d = buildSheet(separatedClos, effectiveTheory);
      if (d) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(d), 'Theory Courses');
    }
    if (isLabCourse) {
      const d = buildSheet(separatedClos, effectiveLab);
      if (d) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(d), 'Lab Courses');
    }
    const d2 = buildSheet(clos, effectiveCombined);
    if (d2) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(d2), 'Combined (Theory+Lab)');
    const d3 = buildSheet(clos, effectiveUnnormed);
    if (d3) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(d3), 'Unnormed (Theory+Lab)');
    const d4 = buildSheet(clos, effectiveEqualWt);
    if (d4) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(d4), 'Equal Wt (Theory+Lab)');

    if (wb.SheetNames.length === 0) return;
    XLSX.writeFile(wb, `CO_Attainment_${courseCode || 'export'}.xlsx`);
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
        <button
          onClick={handleExportToExcel}
          style={{ padding: '8px 18px', backgroundColor: '#27ae60', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}
          title="Export all CO Attainment tables to Excel"
        >
          ⬇ Export Excel
        </button>
      </div>
      <COSummaryTables
        clos={clos}
        theoryCoAttainmentData={theoryCoAttainmentData}
        labCoAttainmentData={labCoAttainmentData}
      />
      {isTheoryCourse && (
        <AttainmentTable
          clos={separatedClos}
          coAttainmentData={theoryCoAttainmentData && theoryCoAttainmentData.length > 0 ? theoryCoAttainmentData : coAttainmentData}
          formatNumber={formatNumber}
          keyPrefix="theory"
          title="CO Attainment - Theory Courses"
        />
      )}
      {isLabCourse && (
        <AttainmentTable
          clos={separatedClos}
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
        showAchievementAvg
      />
      <AttainmentTable
        clos={clos}
        coAttainmentData={unnormedCoAttainmentData && unnormedCoAttainmentData.length > 0 ? unnormedCoAttainmentData : coAttainmentData}
        formatNumber={formatNumber}
        keyPrefix="unnormed"
        title="Attainment of COs in % (Theory+Lab) Unnormed"
        showAchievementAvg
      />
      <AttainmentTable
        clos={clos}
        coAttainmentData={equalWtCoAttainmentData && equalWtCoAttainmentData.length > 0 ? equalWtCoAttainmentData : coAttainmentData}
        formatNumber={formatNumber}
        keyPrefix="equalwt"
        title="Attainment of COs in % (Theory+Lab) Equal Wt"
        showAchievementAvg
      />
    </>
  );
};

export default COAttainmentSheet;
