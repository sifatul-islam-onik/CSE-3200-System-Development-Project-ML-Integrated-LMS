import React, { useRef } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { SheetLoader } from './LoadingSpinner';

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

const CHART_H   = 320;
const PAD        = { top: 30, right: 40, bottom: 72, left: 56 };
const THRESHOLD  = 55;
const PLOT_H     = CHART_H - PAD.top - PAD.bottom;

const computeChartW = (n, minPerBar = 68) =>
  Math.min(560, Math.max(320, n * minPerBar + PAD.left + PAD.right));

const ChartCard = ({ children }) => (
  <div style={{
    display: 'inline-block',
    width: '100%',
    marginTop: '28px',
    background: '#fff',
    borderRadius: '10px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 2px 10px rgba(0,0,0,0.07)',
    padding: '20px 24px 16px',
    boxSizing: 'border-box',
  }}>
    {children}
  </div>
);

let _gradId = 0;

// Single-series bar chart
const SingleBarChart = ({ title, labels, values, color = '#2563eb', yLabel = 'Achieved (%)', wide = false }) => {
  const n      = labels.length;
  if (n === 0) return null;
  const chartW = wide ? 700 : computeChartW(n);
  const plotW  = chartW - PAD.left - PAD.right;
  const maxVal = Math.max(100, ...values.map(v => typeof v === 'number' ? v : 0));
  const yTicks = [0, 20, 40, 60, 80, 100].filter(t => t <= maxVal + 5);
  const barW   = Math.max(wide ? 10 : 18, Math.floor(plotW / n) - (wide ? 6 : 8));
  const xStep  = plotW / n;
  const thY    = PLOT_H - (THRESHOLD / maxVal) * PLOT_H;
  const gradId = `sg${++_gradId}`;

  const inner = (
    <svg
      viewBox={`0 0 ${chartW} ${CHART_H}`}
      width="100%"
      style={{ display: 'block', maxWidth: chartW, margin: wide ? '0 auto' : undefined, overflow: 'visible' }}
    >
      {!wide && (
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={color} stopOpacity={1}   />
            <stop offset="100%" stopColor={color} stopOpacity={0.65} />
          </linearGradient>
        </defs>
      )}
      <g transform={`translate(${PAD.left},${PAD.top})`}>
        {!wide && <rect x={0} y={0} width={plotW} height={PLOT_H} fill="#f8fafc" rx={3} />}
        {yTicks.map(t => {
          const y = PLOT_H - (t / maxVal) * PLOT_H;
          return (
            <g key={t}>
              <line x1={0} y1={y} x2={plotW} y2={y} stroke={wide ? '#ddd' : '#e2e8f0'} strokeDasharray={wide ? '3,3' : undefined} strokeWidth={1} />
              <text x={wide ? -6 : -8} y={y + 4} textAnchor="end" fontSize={wide ? 11 : 10} fill={wide ? '#555' : '#64748b'}>{t}</text>
            </g>
          );
        })}
        {!wide && (
          <>
            <line x1={0} y1={thY} x2={plotW} y2={thY} stroke="#ef4444" strokeDasharray="5,3" strokeWidth={1.5} />
            <text x={plotW + 6} y={thY + 4} fontSize={9} fill="#ef4444" fontWeight="bold">55%</text>
          </>
        )}
        <text transform="rotate(-90)" x={-PLOT_H / 2} y={wide ? -38 : -42} textAnchor="middle" fontSize={wide ? 12 : 11} fill={wide ? '#333' : '#475569'}>{yLabel}</text>
        <line x1={0} y1={0} x2={0} y2={PLOT_H} stroke={wide ? '#333' : '#94a3b8'} strokeWidth={wide ? 1 : 1.5} />
        <line x1={0} y1={PLOT_H} x2={plotW} y2={PLOT_H} stroke={wide ? '#333' : '#94a3b8'} strokeWidth={wide ? 1 : 1.5} />
        {labels.map((lbl, i) => {
          const val    = typeof values[i] === 'number' ? values[i] : 0;
          const barH   = (val / maxVal) * PLOT_H;
          const cx     = xStep * i + xStep / 2;
          const passed = val >= THRESHOLD;
          return (
            <g key={i}>
              <rect
                x={cx - barW / 2} y={PLOT_H - barH}
                width={barW} height={Math.max(barH, wide ? 0 : 1)}
                fill={wide ? color : (passed ? `url(#${gradId})` : '#f87171')}
                rx={wide ? 2 : 3}
              />
              {val > 0 && (
                <text x={cx} y={PLOT_H - barH - (wide ? 4 : 5)} textAnchor="middle" fontSize={wide ? 10 : 10} fontWeight={wide ? undefined : '600'} fill={wide ? '#333' : '#1e293b'}>
                  {val}
                </text>
              )}
              <text
                x={cx} y={PLOT_H + (wide ? 14 : 16)}
                textAnchor="middle" fontSize={11} fill={wide ? '#333' : '#374151'} fontWeight={wide ? undefined : '500'}
                transform={n > 8 ? `rotate(${wide ? -35 : -40},${cx},${PLOT_H + (wide ? 14 : 16)})` : undefined}
              >
                {lbl}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );

  if (wide) {
    return (
      <div style={{ marginTop: '30px' }}>
        <h4 style={{ marginBottom: '8px', color: '#2c3e50', textAlign: 'center' }}>{title}</h4>
        {inner}
      </div>
    );
  }
  return (
    <ChartCard>
      <h4 style={{ margin: '0 0 14px', color: '#1e293b', textAlign: 'center', fontWeight: 700, fontSize: '14px' }}>
        {title}
      </h4>
      <div style={{ display: 'flex', justifyContent: 'center' }}>{inner}</div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '18px', marginTop: '10px' }}>
        <span style={{ fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ width: 12, height: 12, background: color, borderRadius: 2, display: 'inline-block' }} />
          Achieved (&ge;55%)
        </span>
        <span style={{ fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ width: 12, height: 12, background: '#f87171', borderRadius: 2, display: 'inline-block' }} />
          Not achieved (&lt;55%)
        </span>
      </div>
    </ChartCard>
  );
};

// Multi-series grouped bar chart
const SERIES_COLORS       = ['#2563eb', '#16a34a', '#d97706'];
const SERIES_COLORS_LIGHT = ['#3b82f6', '#22c55e', '#f59e0b'];

const GroupedBarChart = ({ title, labels, series, yLabel, wide = false }) => {
  const n = labels.length;
  const k = series.length;
  if (n === 0 || k === 0) return null;
  const allVals  = series.flatMap(s => s.values.map(v => typeof v === 'number' ? v : 0));
  const maxVal   = Math.max(100, ...allVals);
  const yTicks   = [0, 20, 40, 60, 80, 100].filter(t => t <= maxVal + 5);
  const chartW   = wide ? 700 : computeChartW(n, Math.max(56, k * 22 + 12));
  const plotW    = chartW - PAD.left - PAD.right;
  const groupW   = plotW / n;
  const gap      = wide ? 3 : 4;
  const barW     = Math.max(wide ? 6 : 8, Math.floor((groupW - gap * (k + 1)) / k));
  const thY      = PLOT_H - (THRESHOLD / maxVal) * PLOT_H;
  const gid      = ++_gradId;

  const legend = (
    <div style={{ display: 'flex', justifyContent: 'center', gap: wide ? '20px' : '18px', marginBottom: wide ? '6px' : '10px', flexWrap: 'wrap' }}>
      {series.map((s, si) => (
        <div key={si} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: wide ? '#333' : '#374151' }}>
          <div style={{ width: wide ? 14 : 13, height: wide ? 14 : 13, background: SERIES_COLORS[si], borderRadius: 2 }} />
          {s.label}
        </div>
      ))}
    </div>
  );

  const inner = (
    <svg
      viewBox={`0 0 ${chartW} ${CHART_H}`}
      width="100%"
      style={{ display: 'block', maxWidth: chartW, margin: wide ? '0 auto' : undefined, overflow: 'visible' }}
    >
      {!wide && (
        <defs>
          {SERIES_COLORS.map((c, si) => (
            <linearGradient key={si} id={`gg${gid}_${si}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={SERIES_COLORS_LIGHT[si]} stopOpacity={1}    />
              <stop offset="100%" stopColor={c}                        stopOpacity={0.85} />
            </linearGradient>
          ))}
        </defs>
      )}
      <g transform={`translate(${PAD.left},${PAD.top})`}>
        {!wide && <rect x={0} y={0} width={plotW} height={PLOT_H} fill="#f8fafc" rx={3} />}
        {yTicks.map(t => {
          const y = PLOT_H - (t / maxVal) * PLOT_H;
          return (
            <g key={t}>
              <line x1={0} y1={y} x2={plotW} y2={y} stroke={wide ? '#ddd' : '#e2e8f0'} strokeDasharray={wide ? '3,3' : undefined} strokeWidth={1} />
              <text x={wide ? -6 : -8} y={y + 4} textAnchor="end" fontSize={wide ? 11 : 10} fill={wide ? '#555' : '#64748b'}>{t}</text>
            </g>
          );
        })}
        {!wide && (
          <>
            <line x1={0} y1={thY} x2={plotW} y2={thY} stroke="#ef4444" strokeDasharray="5,3" strokeWidth={1.5} />
            <text x={plotW + 6} y={thY + 4} fontSize={9} fill="#ef4444" fontWeight="bold">55%</text>
          </>
        )}
        {yLabel && <text transform="rotate(-90)" x={-PLOT_H / 2} y={wide ? -38 : -42} textAnchor="middle" fontSize={wide ? 12 : 11} fill={wide ? '#333' : '#475569'}>{yLabel}</text>}
        <line x1={0} y1={0} x2={0} y2={PLOT_H} stroke={wide ? '#333' : '#94a3b8'} strokeWidth={wide ? 1 : 1.5} />
        <line x1={0} y1={PLOT_H} x2={plotW} y2={PLOT_H} stroke={wide ? '#333' : '#94a3b8'} strokeWidth={wide ? 1 : 1.5} />
        {labels.map((lbl, i) => {
          const cx         = groupW * i + groupW / 2;
          const groupStart = cx - (k * barW + (k - 1) * gap) / 2;
          return (
            <g key={i}>
              {series.map((s, si) => {
                const val  = typeof s.values[i] === 'number' ? s.values[i] : 0;
                const barH = (val / maxVal) * PLOT_H;
                const bx   = groupStart + si * (barW + gap);
                return (
                  <g key={si}>
                    <rect
                      x={bx} y={PLOT_H - barH}
                      width={barW} height={Math.max(barH, wide ? 0 : 1)}
                      fill={wide ? SERIES_COLORS[si] : `url(#gg${gid}_${si})`}
                      rx={2}
                    />
                    {!wide && barH > 14 && barW > 12 && (
                      <text x={bx + barW / 2} y={PLOT_H - barH - 3} textAnchor="middle" fontSize={8} fill="#1e293b" fontWeight="600">
                        {val}
                      </text>
                    )}
                  </g>
                );
              })}
              <text
                x={cx} y={PLOT_H + (wide ? 14 : 16)}
                textAnchor="middle" fontSize={11} fill={wide ? '#333' : '#374151'} fontWeight={wide ? undefined : '500'}
                transform={n > 8 ? `rotate(${wide ? -35 : -40},${cx},${PLOT_H + (wide ? 14 : 16)})` : undefined}
              >
                {lbl}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );

  if (wide) {
    return (
      <div style={{ marginTop: '30px' }}>
        <h4 style={{ marginBottom: '8px', color: '#2c3e50', textAlign: 'center' }}>{title}</h4>
        {legend}
        {inner}
      </div>
    );
  }
  return (
    <ChartCard>
      <h4 style={{ margin: '0 0 10px', color: '#1e293b', textAlign: 'center', fontWeight: 700, fontSize: '14px' }}>
        {title}
      </h4>
      {legend}
      <div style={{ display: 'flex', justifyContent: 'center' }}>{inner}</div>
    </ChartCard>
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

  // Session label: batchYear + (yearLevel - 1) → e.g. batch "21", year 3 → "2023-24"
  const batchRaw = selectedCourse?.assignedBatches?.[0]?.batch;
  const batchYear = batchRaw ? 2000 + parseInt(batchRaw, 10) : null;
  const yearLvl = selectedCourse?.yearLevel ||
    (selectedCourse?.semester ? Math.ceil(selectedCourse.semester / 2) : null);
  const sessionStartYear = (batchYear && yearLvl) ? batchYear + (yearLvl - 1) : null;
  const sessionLabel = sessionStartYear
    ? `${sessionStartYear}-${String(sessionStartYear + 1).slice(-2)}`
    : '';
  const pdfHeading = `Attainment Charts of ${theoryCourseCode}+${labCourseCode}${
    sessionLabel ? ` of Session ${sessionLabel}` : ''
  }`;

  // Effective combined CO list (all COs across theory + lab)
  const effectiveClos = combinedClos?.length > 0 ? combinedClos : (clos || []);

  // Must be called before any early returns (Rules of Hooks)
  const sectionRef = useRef(null);

  if (!effectiveClos.length) return <SheetLoader label="Loading Course Outcomes…" />;
  if (!programOutcomes || programOutcomes.length === 0) return <SheetLoader label="Loading Program Outcomes…" />;

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

  const handleExportToPDF = async () => {
    if (!sectionRef.current) return;
    const btn = sectionRef.current.querySelector('button');
    if (btn) btn.style.display = 'none';
    try {
      // A4 portrait: 595 x 842 pt
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
      const pageW = pdf.internal.pageSize.getWidth();   // 595
      const pageH = pdf.internal.pageSize.getHeight();  // 842
      const margin = 28;
      const contentW = pageW - margin * 2;
      const maxContentH = pageH - margin * 2;

      // Skip heading (children[0]) and button wrapper (children[1]) — heading is
      // rendered as text via jsPDF below; button is hidden anyway.
      const blocks = Array.from(sectionRef.current.children).slice(2);
      let currentY = margin;

      // Render heading as text on the first page
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(14);
      pdf.setTextColor('#2c3e50');
      const headingLines = pdf.splitTextToSize(pdfHeading, contentW);
      pdf.text(headingLines, margin, currentY + 14);
      currentY += headingLines.length * 18 + 10;

      let isFirstPage = true;

      for (const block of blocks) {
        const canvas = await html2canvas(block, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          scrollX: 0,
          scrollY: -window.scrollY,
        });
        const ratio = contentW / canvas.width;
        let drawW = contentW;
        let drawH = canvas.height * ratio;

        // Scale down if block is taller than a full page
        if (drawH > maxContentH) {
          const scale = maxContentH / drawH;
          drawW = contentW * scale;
          drawH = maxContentH;
        }

        // Push to a new page if the block won't fit in the remaining space
        if (!isFirstPage && currentY + drawH > pageH - margin) {
          pdf.addPage();
          currentY = margin;
        }

        const xPos = margin + (contentW - drawW) / 2;
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', xPos, currentY, drawW, drawH);
        currentY += drawH + 10;
        isFirstPage = false;
      }

      pdf.save(`Charts_${courseCode}.pdf`);
    } finally {
      if (btn) btn.style.display = '';
    }
  };

  return (
    <section className="charts-section" ref={sectionRef}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#2c3e50', margin: 0 }}>Charts</h3>
        <button
          onClick={handleExportToPDF}
          style={{ flexShrink: 0, marginLeft: '16px', backgroundColor: '#e74c3c', color: '#fff', border: 'none', borderRadius: '6px', padding: '8px 18px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}
        >
          Export to PDF
        </button>
      </div>

      {/* CO Attainment Table */}
      <div className="table-container" style={{ marginTop: '20px', overflowX: 'auto' }}>
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
      <div className="table-container" style={{ marginTop: '30px', overflowX: 'auto' }}>
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
      {/* Charts grid — CO charts, 2 columns on wide screens */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '0 24px' }}>
        <SingleBarChart
          title={`CO Attainment \u2014 ${theoryCourseCode}+${labCourseCode}`}
          labels={coNames}
          values={coAchievedVals}
          color="#2563eb"
          yLabel="Achieved (%)"
        />
        <SingleBarChart
          title={`CO Attainment (Unnorm) \u2014 ${theoryCourseCode}+${labCourseCode}`}
          labels={coNames}
          values={coUnnormVals}
          color="#16a34a"
          yLabel="Unnorm Achieved (%)"
        />
        <SingleBarChart
          title={`CO Attainment (Eq. Wt.) \u2014 ${theoryCourseCode}+${labCourseCode}`}
          labels={coNames}
          values={coEqWtVals}
          color="#d97706"
          yLabel="Eq. Wt. Achieved (%)"
        />
      </div>
      <GroupedBarChart
        title={`CO Attainment (All Methods) \u2014 ${theoryCourseCode}+${labCourseCode}`}
        labels={coNames}
        series={[
          { label: 'Achieved(%)',         values: coAchievedVals },
          { label: 'Unnorm Achieved(%)',  values: coUnnormVals   },
          { label: 'Eq. Wt. Achieved(%)', values: coEqWtVals    },
        ]}
        wide
      />
      {/* PO charts — one per row */}
      <SingleBarChart
        title={`PO Attainment \u2014 ${theoryCourseCode}+${labCourseCode}`}
        labels={poNames}
        values={poAchievedVals}
        color="#2563eb"
        yLabel="Achieved (%)"
        wide
      />
      <SingleBarChart
        title={`PO Attainment (Unnorm) \u2014 ${theoryCourseCode}+${labCourseCode}`}
        labels={poNames}
        values={poUnnormVals}
        color="#16a34a"
        yLabel="Unnorm Achieved (%)"
        wide
      />
      <SingleBarChart
        title={`PO Attainment (Eq. Wt.) \u2014 ${theoryCourseCode}+${labCourseCode}`}
        labels={poNames}
        values={poEqWtVals}
        color="#d97706"
        yLabel="Eq. Wt. Achieved (%)"
        wide
      />
      <GroupedBarChart
        title={`PO Attainment (All Methods) \u2014 ${theoryCourseCode}+${labCourseCode}`}
        labels={poNames}
        series={[
          { label: 'Achieved(%)',          values: poAchievedVals },
          { label: 'Unnorm Achieved(%)',   values: poUnnormVals   },
          { label: 'Eq. Wt. Achieved(%)', values: poEqWtVals     },
        ]}
        wide
      />
    </section>
  );
};

export default ChartsSheet;
