import React from 'react';

// â”€â”€ helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// Average CO attainment (%) across all students for each CO name
const avgCOAttainment = (coAttainmentData, coNames) => {
  if (!coAttainmentData?.length || !coNames.length) return {};
  const result = {};
  coNames.forEach(cn => {
    const sum = coAttainmentData.reduce((s, row) => s + (row.coValues?.[cn] || 0), 0);
    result[cn] = parseFloat((sum / coAttainmentData.length).toFixed(2));
  });
  return result;
};

// =IF(ISNUMBER(COAttainment!AT133), COAttainment!AT133, 0)
// AT133 = % of students in Unnormed table whose CO attainment >= 55
const achievedPct = (coAttainmentData, coNames) => {
  if (!coAttainmentData?.length || !coNames.length) return {};
  const result = {};
  coNames.forEach(cn => {
    const achieved = coAttainmentData.filter(row => (row.coValues?.[cn] || 0) >= 55).length;
    result[cn] = parseFloat(((achieved / coAttainmentData.length) * 100).toFixed(2));
  });
  return result;
};

// =IF(ISNUMBER(COAttainment!AT133), COAttainment!AT133, 0)
// AT133 = Achieved(%) row in "CO Achievement>=" column for CO Attainment - Theory Courses table
// = IFERROR(yCount / totalStudents * 100, "--")  â†’ returns 0 when "--" (no data)
const theoryAchievementPct = (theoryCoAttainmentData, coNames) => {
  if (!theoryCoAttainmentData?.length || !coNames.length) return {};
  const total = theoryCoAttainmentData.length;
  const result = {};
  coNames.forEach(cn => {
    const hasNoData = theoryCoAttainmentData.some(r => r.coValues?.[cn] == null);
    const yCount = hasNoData ? null : theoryCoAttainmentData.filter(r => (r.coValues?.[cn] || 0) >= 55).length;
    // IF(ISNUMBER(AT133), AT133, 0) â€” AT133 = yCount/total*100; 0 when "--"
    result[cn] = yCount == null ? 0 : parseFloat((yCount / total * 100).toFixed(2));
  });
  return result;
};

// Build normalized CO-PO map from combinedCOPOMatrix ({CO1:[1,3],...})
const buildNormMapFromMatrix = (combinedCOPOMatrix, programOutcomes) => {
  const coKeys = Object.keys(combinedCOPOMatrix || {});
  const colTotals = programOutcomes.map((_, poIdx) =>
    coKeys.reduce((s, cn) => s + ((combinedCOPOMatrix[cn] || []).includes(poIdx + 1) ? 1 : 0), 0)
  );
  const normMap = {};
  coKeys.forEach(cn => {
    normMap[cn] = programOutcomes.map((_, poIdx) => {
      const ct = colTotals[poIdx];
      return ((combinedCOPOMatrix[cn] || []).includes(poIdx + 1) && ct > 0) ? 1 / ct : 0;
    });
  });
  return normMap;
};

// Average PO attainment across all students using normalised combined CO-PO map
// Formula: MMULT(pct_row, normalizedCOPO_col) / 100, then average across students â†’ result in 0â€“1
// Returns array of PO averages (multiply Ã—100 to display as %)
const avgPOAttainment = (coAttainmentData, combinedCOPOMatrix, programOutcomes) => {
  if (!coAttainmentData?.length || !combinedCOPOMatrix || !programOutcomes.length) return [];
  const normMap = buildNormMapFromMatrix(combinedCOPOMatrix, programOutcomes);
  const coKeys = Object.keys(combinedCOPOMatrix);
  const poSums = new Array(programOutcomes.length).fill(0);
  coAttainmentData.forEach(row => {
    programOutcomes.forEach((_, poIdx) => {
      const mmult = coKeys.reduce((s, cn) =>
        s + (row.coValues?.[cn] || 0) * (normMap[cn]?.[poIdx] || 0), 0);
      poSums[poIdx] += mmult / 100;
    });
  });
  return poSums.map(s => parseFloat((s / coAttainmentData.length).toFixed(4)));
};

// =IF(ISNUMBER(POCalcMax!AC$133), POCalcMax!AC$133, 0)
// POCalcMax Theory+Lab: MIN(MMULT(binary(>=55)_row, combinedCOPOMap_col), 1) per student, then average
// Returns array of PO averages in 0â€“1 scale (multiply Ã—100 to display as %)
const avgPOAttainmentMax = (coAttainmentData, combinedCOPOMatrix, programOutcomes) => {
  if (!coAttainmentData?.length || !combinedCOPOMatrix || !programOutcomes.length) return [];
  const coKeys = Object.keys(combinedCOPOMatrix);
  const poSums = new Array(programOutcomes.length).fill(0);
  coAttainmentData.forEach(row => {
    programOutcomes.forEach((_, poIdx) => {
      const poNumber = poIdx + 1;
      const mmult = coKeys.reduce((s, cn) => {
        const binary = (row.coValues?.[cn] || 0) >= 55 ? 1 : 0;
        const mapped = (combinedCOPOMatrix[cn] || []).includes(poNumber) ? 1 : 0;
        return s + binary * mapped;
      }, 0);
      poSums[poIdx] += Math.min(mmult, 1);
    });
  });
  return poSums.map(s => parseFloat((s / coAttainmentData.length).toFixed(4)));
};

const fmt = v => (v != null && v !== 0 && !isNaN(v)) ? v : '-';

// â”€â”€ SVG Bar Chart helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const CHART_W = 700;
const CHART_H = 300;
const PAD = { top: 20, right: 20, bottom: 60, left: 50 };
const PLOT_W = CHART_W - PAD.left - PAD.right;
const PLOT_H = CHART_H - PAD.top - PAD.bottom;

// Single-series bar chart
const SingleBarChart = ({ title, labels, values, color = '#2980b9', yLabel = 'Achieved (%)' }) => {
  const n = labels.length;
  if (n === 0) return null;
  const maxVal = Math.max(100, ...values.map(v => typeof v === 'number' ? v : 0));
  const yTicks = [0, 20, 40, 60, 80, 100].filter(t => t <= maxVal + 5);
  const barW = Math.max(10, Math.floor(PLOT_W / n) - 6);
  const xStep = PLOT_W / n;

  return (
    <div style={{ marginTop: '30px' }}>
      <h4 style={{ marginBottom: '8px', color: '#2c3e50', textAlign: 'center' }}>{title}</h4>
      <svg width={CHART_W} height={CHART_H} style={{ display: 'block', margin: '0 auto', overflow: 'visible' }}>
        <g transform={`translate(${PAD.left},${PAD.top})`}>
          {/* Y gridlines + ticks */}
          {yTicks.map(t => {
            const y = PLOT_H - (t / 100) * PLOT_H;
            return (
              <g key={t}>
                <line x1={0} y1={y} x2={PLOT_W} y2={y} stroke="#ddd" strokeDasharray="3,3" />
                <text x={-6} y={y + 4} textAnchor="end" fontSize={11} fill="#555">{t}</text>
              </g>
            );
          })}
          {/* Y axis label */}
          <text transform={`rotate(-90)`} x={-PLOT_H / 2} y={-38} textAnchor="middle" fontSize={12} fill="#333">{yLabel}</text>
          {/* Axes */}
          <line x1={0} y1={0} x2={0} y2={PLOT_H} stroke="#333" />
          <line x1={0} y1={PLOT_H} x2={PLOT_W} y2={PLOT_H} stroke="#333" />
          {/* Bars + X labels */}
          {labels.map((lbl, i) => {
            const val = typeof values[i] === 'number' ? values[i] : 0;
            const barH = (val / 100) * PLOT_H;
            const cx = xStep * i + xStep / 2;
            return (
              <g key={i}>
                <rect
                  x={cx - barW / 2} y={PLOT_H - barH}
                  width={barW} height={barH}
                  fill={color} rx={2}
                />
                {val > 0 && (
                  <text x={cx} y={PLOT_H - barH - 4} textAnchor="middle" fontSize={10} fill="#333">
                    {val}
                  </text>
                )}
                <text
                  x={cx} y={PLOT_H + 14}
                  textAnchor="middle" fontSize={11} fill="#333"
                  transform={n > 8 ? `rotate(-35,${cx},${PLOT_H + 14})` : undefined}
                >
                  {lbl}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
};

// Multi-series grouped bar chart (for PO Attainment with 3 series)
const SERIES_COLORS = ['#2980b9', '#27ae60', '#e67e22'];

const GroupedBarChart = ({ title, labels, series, yLabel = 'Achieved (%)' }) => {
  const n = labels.length;
  const k = series.length;
  if (n === 0 || k === 0) return null;
  const allVals = series.flatMap(s => s.values.map(v => typeof v === 'number' ? v : 0));
  const maxVal = Math.max(100, ...allVals);
  const yTicks = [0, 20, 40, 60, 80, 100].filter(t => t <= maxVal + 5);
  const groupW = PLOT_W / n;
  const gap = 3;
  const barW = Math.max(6, (groupW - gap * (k + 1)) / k);

  return (
    <div style={{ marginTop: '30px' }}>
      <h4 style={{ marginBottom: '8px', color: '#2c3e50', textAlign: 'center' }}>{title}</h4>
      {/* Legend */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginBottom: '6px', flexWrap: 'wrap' }}>
        {series.map((s, si) => (
          <div key={si} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#333' }}>
            <div style={{ width: 14, height: 14, background: SERIES_COLORS[si], borderRadius: 2 }} />
            {s.label}
          </div>
        ))}
      </div>
      <svg width={CHART_W} height={CHART_H} style={{ display: 'block', margin: '0 auto', overflow: 'visible' }}>
        <g transform={`translate(${PAD.left},${PAD.top})`}>
          {/* Y gridlines + ticks */}
          {yTicks.map(t => {
            const y = PLOT_H - (t / 100) * PLOT_H;
            return (
              <g key={t}>
                <line x1={0} y1={y} x2={PLOT_W} y2={y} stroke="#ddd" strokeDasharray="3,3" />
                <text x={-6} y={y + 4} textAnchor="end" fontSize={11} fill="#555">{t}</text>
              </g>
            );
          })}
          {/* Y axis label */}
          <text transform={`rotate(-90)`} x={-PLOT_H / 2} y={-38} textAnchor="middle" fontSize={12} fill="#333">{yLabel}</text>
          {/* Axes */}
          <line x1={0} y1={0} x2={0} y2={PLOT_H} stroke="#333" />
          <line x1={0} y1={PLOT_H} x2={PLOT_W} y2={PLOT_H} stroke="#333" />
          {/* Groups */}
          {labels.map((lbl, i) => {
            const cx = groupW * i + groupW / 2;
            const groupStart = cx - (k * barW + (k - 1) * gap) / 2;
            return (
              <g key={i}>
                {series.map((s, si) => {
                  const val = typeof s.values[i] === 'number' ? s.values[i] : 0;
                  const barH = (val / 100) * PLOT_H;
                  const bx = groupStart + si * (barW + gap);
                  return (
                    <g key={si}>
                      <rect
                        x={bx} y={PLOT_H - barH}
                        width={barW} height={barH}
                        fill={SERIES_COLORS[si]} rx={2}
                      />
                      {val > 0 && (
                        <text x={bx + barW / 2} y={PLOT_H - barH - 3} textAnchor="middle" fontSize={9} fill="#333">
                          {val}
                        </text>
                      )}
                    </g>
                  );
                })}
                <text
                  x={cx} y={PLOT_H + 14}
                  textAnchor="middle" fontSize={11} fill="#333"
                  transform={n > 8 ? `rotate(-35,${cx},${PLOT_H + 14})` : undefined}
                >
                  {lbl}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
};

// â”€â”€ Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const ChartsSheet = ({
  selectedCourse, clos, combinedClos, programOutcomes,
  combinedCOPOMatrix,
  theoryCoAttainmentData,
  combinedCoAttainmentData, unnormedCoAttainmentData, equalWtCoAttainmentData
}) => {
  const courseCode = selectedCourse?.courseCode || '';
  const lastDigit = parseInt(courseCode.charAt(courseCode.length - 1));
  const baseCode = courseCode.substring(0, courseCode.length - 1);
  const isTheory = lastDigit % 2 === 1;
  const theoryCourseCode = isTheory ? courseCode : baseCode + (lastDigit - 1);
  const labCourseCode    = isTheory ? baseCode + (lastDigit + 1) : courseCode;

  // Effective combined CO list (all COs across theory + lab)
  const effectiveClos = combinedClos?.length > 0 ? combinedClos : (clos || []);

  if (!effectiveClos.length) return <p>Loading Course Outcomes...</p>;
  if (!programOutcomes || programOutcomes.length === 0) return <p>Loading Program Outcomes...</p>;

  const coNames = effectiveClos.map(clo => (clo.cloNumber || '').toString().replace('CLO', 'CO'));
  const poNames = programOutcomes.map((po, idx) => po.poCode || `PO${idx + 1}`);

  // â”€â”€ CO Attainment averages â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // =IF(ISNUMBER(COAttainment!AT133),COAttainment!AT133,0) â†’ Achieved(%) row from Theory Courses table
  const coAchieved    = theoryAchievementPct(theoryCoAttainmentData,    coNames);
  // =IF(ISNUMBER(COAttainment!AT133),COAttainment!AT133,0) â†’ Achieved(%) row from Unnormed table
  const coUnnorm      = theoryAchievementPct(unnormedCoAttainmentData,  coNames);
  // =IF(ISNUMBER(COAttainment!AT133),COAttainment!AT133,0) â†’ Achieved(%) row from Equal Wt table
  const coEqWt        = theoryAchievementPct(equalWtCoAttainmentData,   coNames);

  const coRows = [
    { label: 'Achieved(%)',       vals: coNames.map(cn => fmt(coAchieved[cn])) },
    { label: 'Unnorm Achieved(%)', vals: coNames.map(cn => fmt(coUnnorm[cn]))  },
    { label: 'Eq. Wt. Achieved(%)', vals: coNames.map(cn => fmt(coEqWt[cn]))  },
  ];

  // â”€â”€ PO Attainment averages â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const poAchieved = avgPOAttainmentMax(combinedCoAttainmentData,  combinedCOPOMatrix, programOutcomes);  // =IF(ISNUMBER(POCalcMax!AC$133),AC$133,0) Theory+Lab
  const poUnnorm   = avgPOAttainmentMax(unnormedCoAttainmentData,  combinedCOPOMatrix, programOutcomes);  // =IF(ISNUMBER(POCalcMax!AC$133),AC$133,0) Theory+Lab(unnorm)
  const poEqWt     = avgPOAttainmentMax(equalWtCoAttainmentData,   combinedCOPOMatrix, programOutcomes);  // =IF(ISNUMBER(POCalcMax!AC$133),AC$133,0) Theory+Lab(Eq Wt)

  const poRows = [
    { label: 'Achieved(%)',        vals: poAchieved.map(v => fmt(parseFloat((v * 100).toFixed(2)))) },
    { label: 'Unnorm Achieved(%)', vals: poUnnorm.map(v   => fmt(parseFloat((v * 100).toFixed(2)))) },
    { label: 'Eq. Wt. Achieved(%)', vals: poEqWt.map(v   => fmt(parseFloat((v * 100).toFixed(2)))) },
  ];

  // â”€â”€ Chart data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const coAchievedVals = coNames.map(cn => coAchieved[cn] || 0);
  const coUnnormVals   = coNames.map(cn => coUnnorm[cn]   || 0);
  const coEqWtVals     = coNames.map(cn => coEqWt[cn]     || 0);
  const poAchievedVals = poAchieved.map(v => parseFloat((v * 100).toFixed(2)));
  const poUnnormVals   = poUnnorm.map(v   => parseFloat((v * 100).toFixed(2)));
  const poEqWtVals     = poEqWt.map(v     => parseFloat((v * 100).toFixed(2)));

  const thStyle = { backgroundColor: '#2980b9', color: 'white' };
  const labelStyle = { textAlign: 'center', fontWeight: 'bold', backgroundColor: '#e8f4f8', whiteSpace: 'nowrap' };
  const cellStyle  = { textAlign: 'center' };

  return (
    <section className="charts-section">
      <h3>Charts</h3>

      {/* CO Attainment Table */}
      <div className="table-container" style={{ marginTop: '20px' }}>
        <h4 style={{ marginBottom: '15px', color: '#2c3e50' }}>
          CO Attainment of {theoryCourseCode}+{labCourseCode}
        </h4>
        <table className="co-po-map-table">
          <thead>
            <tr>
              <th style={thStyle}>Metric</th>
              {coNames.map((cn, idx) => <th key={idx} style={thStyle}>{cn}</th>)}
            </tr>
          </thead>
          <tbody>
            {coRows.map(row => (
              <tr key={row.label}>
                <td style={labelStyle}>{row.label}</td>
                {row.vals.map((v, idx) => <td key={idx} style={cellStyle}>{v}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* PO Attainment Table */}
      <div className="table-container" style={{ marginTop: '30px' }}>
        <h4 style={{ marginBottom: '15px', color: '#2c3e50' }}>
          PO Attainment of {theoryCourseCode}+{labCourseCode}
        </h4>
        <table className="co-po-map-table">
          <thead>
            <tr>
              <th style={thStyle}>Metric</th>
              {programOutcomes.map((po, idx) => (
                <th key={idx} style={thStyle}>{po.poCode || `PO${idx + 1}`}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {poRows.map(row => (
              <tr key={row.label}>
                <td style={labelStyle}>{row.label}</td>
                {row.vals.map((v, idx) => <td key={idx} style={cellStyle}>{v}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* â”€â”€ Charts â”€â”€ */}
      <SingleBarChart
        title={`CO Attainment of ${theoryCourseCode}+${labCourseCode}`}
        labels={coNames}
        values={coAchievedVals}
        color="#2980b9"
        yLabel="Achieved (%)"
      />
      <SingleBarChart
        title={`CO Attainment of ${theoryCourseCode}+${labCourseCode} (Unnorm)`}
        labels={coNames}
        values={coUnnormVals}
        color="#27ae60"
        yLabel="Unnorm Achieved (%)"
      />
      <SingleBarChart
        title={`CO Attainment of ${theoryCourseCode}+${labCourseCode} (Eq. Wt.)`}
        labels={coNames}
        values={coEqWtVals}
        color="#e67e22"
        yLabel="Eq. Wt. Achieved (%)"
      />
      <GroupedBarChart
        title={`PO Attainment of ${theoryCourseCode}+${labCourseCode}`}
        labels={poNames}
        series={[
          { label: 'Achieved(%)',        values: poAchievedVals },
          { label: 'Unnorm Achieved(%)', values: poUnnormVals   },
          { label: 'Eq. Wt. Achieved(%)', values: poEqWtVals   },
        ]}
        yLabel="Achieved (%)"
      />
    </section>
  );
};

export default ChartsSheet;
