import React, { useRef, useState } from 'react';
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

const CHART_H   = 380;
const DEFAULT_PAD = { top: 40, right: 40, bottom: 80, left: 60 };
const TIGHT_PAD   = { top: 40, right: 40, bottom: 80, left: 60 }; // Reset tight pad for now, will adjust in components if needed, or use specific tight logic for combined. 
// User asked to increase combined CO/PO combined charts on left/right -> decrease margins.
// So TIGHT_PAD should be smaller.
const REDUCED_PAD = { top: 40, right: 20, bottom: 80, left: 20 };

const THRESHOLD  = 55;
const PLOT_H     = CHART_H - DEFAULT_PAD.top - DEFAULT_PAD.bottom;

const computeChartW = (n, minPerBar = 110, pad = DEFAULT_PAD) =>
  Math.min(1000, Math.max(480, n * minPerBar + pad.left + pad.right));

const ChartCard = ({ children, tight = false }) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      marginTop: '28px',
      background: '#fff',
      borderRadius: '10px',
      border: '1px solid #e2e8f0',
      boxShadow: '0 2px 10px rgba(0,0,0,0.07)',
      padding: tight ? '20px 0px 16px' : '20px 24px 16px',
      boxSizing: 'border-box',
    }}
    data-chart-card="true"
  >
    {children}
  </div>
);

let _gradId = 0;

// Single-series bar chart
const SingleBarChart = ({ title, labels, values, color = '#2563eb', yLabel = 'Achieved (%)', wide = false }) => {
  const n      = labels.length;
  if (n === 0) return null;
  const pad    = DEFAULT_PAD;
  const chartW = wide ? 700 : computeChartW(n, 110, pad);
  const plotW  = chartW - pad.left - pad.right;
  const maxVal = Math.max(100, ...values.map(v => typeof v === 'number' ? v : 0));
  const yTicks = [0, 20, 40, 60, 80, 100].filter(t => t <= maxVal + 5);
  const barW   = Math.max(wide ? 10 : 20, Math.floor(plotW / n) - (wide ? 6 : 14));
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
      <g transform={`translate(${pad.left},${pad.top})`}>
        {!wide && <rect x={0} y={0} width={plotW} height={PLOT_H} fill="#f8fafc" rx={3} />}
        {yTicks.map(t => {
          const y = PLOT_H - (t / maxVal) * PLOT_H;
          return (
            <g key={t}>
              <line x1={0} y1={y} x2={plotW} y2={y} stroke={wide ? '#ddd' : '#e2e8f0'} strokeDasharray={wide ? '3,3' : undefined} strokeWidth={1} />
              <text x={wide ? -6 : -8} y={y + 4} textAnchor="end" fontSize={wide ? 13 : 12} fill={wide ? '#555' : '#64748b'}>{t}</text>
            </g>
          );
        })}
        {!wide && (
          <>
            <line x1={0} y1={thY} x2={plotW} y2={thY} stroke="#ef4444" strokeDasharray="5,3" strokeWidth={1.5} />
            <text x={plotW + 6} y={thY + 4} fontSize={11} fill="#ef4444" fontWeight="bold">55%</text>
          </>
        )}
        <text transform="rotate(-90)" x={-PLOT_H / 2} y={wide ? -38 : -42} textAnchor="middle" fontSize={wide ? 14 : 13} fill={wide ? '#333' : '#475569'}>{yLabel}</text>
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
                <text x={cx} y={PLOT_H - barH - (wide ? 4 : 5)} textAnchor="middle" fontSize={wide ? 12 : 11} fontWeight={wide ? undefined : '600'} fill={wide ? '#333' : '#1e293b'}>
                  {val}
                </text>
              )}
              <text
                x={cx} y={PLOT_H + (wide ? 14 : 16)}
                textAnchor="middle" fontSize={13} fill={wide ? '#333' : '#374151'} fontWeight={wide ? undefined : '500'}
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
    <ChartCard tight={!wide}>
      <h4 style={{ margin: '0 0 14px', color: '#1e293b', textAlign: 'center', fontWeight: 700, fontSize: '16px' }}>
        {title}
      </h4>
      <div style={{ display: 'flex', justifyContent: 'center' }}>{inner}</div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '18px', marginTop: '10px' }}>
        <span style={{ fontSize: '13px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ width: 12, height: 12, background: color, borderRadius: 2, display: 'inline-block' }} />
          Achieved (&ge;55%)
        </span>
        <span style={{ fontSize: '13px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '5px' }}>
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

const GroupedBarChart = ({ title, labels, series, yLabel, wide = false, hideBarText = false }) => {
  const n = labels.length;
  const k = series.length;
  if (n === 0 || k === 0) return null;
  const pad      = wide ? DEFAULT_PAD : REDUCED_PAD;
  const allVals  = series.flatMap(s => s.values.map(v => typeof v === 'number' ? v : 0));
  const maxVal   = Math.max(100, ...allVals);
  const yTicks   = [0, 20, 40, 60, 80, 100].filter(t => t <= maxVal + 5);
  const chartW   = wide ? 700 : computeChartW(n, Math.max(130, k * 35 + 20), pad);
  const plotW    = chartW - pad.left - pad.right;
  const groupW   = plotW / n;
  const gap      = wide ? 3 : 4;
  const barW     = Math.max(wide ? 6 : 8, Math.floor((groupW - gap * (k + 1)) / k));
  const thY      = PLOT_H - (THRESHOLD / maxVal) * PLOT_H;
  const gid      = ++_gradId;

  const legend = (
    <div style={{ display: 'flex', justifyContent: 'center', gap: wide ? '20px' : '18px', marginBottom: wide ? '6px' : '10px', flexWrap: 'wrap' }}>
      {series.map((s, si) => (
        <div key={si} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '14px', color: wide ? '#333' : '#374151' }}>
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
      <g transform={`translate(${pad.left},${pad.top})`}>
        {!wide && <rect x={0} y={0} width={plotW} height={PLOT_H} fill="#f8fafc" rx={3} />}
        {yTicks.map(t => {
          const y = PLOT_H - (t / maxVal) * PLOT_H;
          return (
            <g key={t}>
              <line x1={0} y1={y} x2={plotW} y2={y} stroke={wide ? '#ddd' : '#e2e8f0'} strokeDasharray={wide ? '3,3' : undefined} strokeWidth={1} />
              <text x={wide ? -6 : -8} y={y + 4} textAnchor="end" fontSize={wide ? 13 : 12} fill={wide ? '#555' : '#64748b'}>{t}</text>
            </g>
          );
        })}
        {!wide && (
          <>
            <line x1={0} y1={thY} x2={plotW} y2={thY} stroke="#ef4444" strokeDasharray="5,3" strokeWidth={1.5} />
            <text x={plotW + 6} y={thY + 4} fontSize={11} fill="#ef4444" fontWeight="bold">55%</text>
          </>
        )}
        {yLabel && <text transform="rotate(-90)" x={-PLOT_H / 2} y={wide ? -38 : -42} textAnchor="middle" fontSize={wide ? 14 : 13} fill={wide ? '#333' : '#475569'}>{yLabel}</text>}
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
                    {!wide && !hideBarText && barH > 14 && barW > 12 && (
                      <text x={bx + barW / 2} y={PLOT_H - barH - 3} textAnchor="middle" fontSize={10} fill="#1e293b" fontWeight="600">
                        {val}
                      </text>
                    )}
                  </g>
                );
              })}
              <text
                x={cx} y={PLOT_H + (wide ? 14 : 16)}
                textAnchor="middle" fontSize={13} fill={wide ? '#333' : '#374151'} fontWeight={wide ? undefined : '500'}
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
      <h4 style={{ margin: '0 0 10px', color: '#1e293b', textAlign: 'center', fontWeight: 700, fontSize: '16px' }}>
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
  combinedCoAttainmentData, unnormedCoAttainmentData, equalWtCoAttainmentData,
  isStandaloneCourse
}) => {
  const courseCode = selectedCourse?.courseCode || '';
  const lastDigit = parseInt(courseCode.charAt(courseCode.length - 1));
  const baseCode = courseCode.substring(0, courseCode.length - 1);
  const isTheory = lastDigit % 2 === 1;
  const theoryCourseCode = isTheory ? courseCode : baseCode + (lastDigit - 1);
  const labCourseCode    = isTheory ? baseCode + (lastDigit + 1) : courseCode;
  const pairLabel = isStandaloneCourse ? courseCode : `${theoryCourseCode}+${labCourseCode}`;

  // Session label: batchYear + (yearLevel - 1) → e.g. batch "21", year 3 → "2023-24"
  const batchRaw = selectedCourse?.assignedBatches?.[0]?.batch;
  const batchYear = batchRaw ? 2000 + parseInt(batchRaw, 10) : null;
  const yearLvl = selectedCourse?.yearLevel ||
    (selectedCourse?.semester ? Math.ceil(selectedCourse.semester / 2) : null);
  const sessionStartYear = (batchYear && yearLvl) ? batchYear + (yearLvl - 1) : null;
  const sessionLabel = sessionStartYear
    ? `${sessionStartYear}-${String(sessionStartYear + 1).slice(-2)}`
    : '';
  const pdfHeading = `Attainment Charts of ${pairLabel}${
    sessionLabel ? ` of Session ${sessionLabel}` : ''
  }`;

  // Effective combined CO list (all COs across theory + lab)
  const effectiveClos = combinedClos?.length > 0 ? combinedClos : (clos || []);

  // Must be called before any early returns (Rules of Hooks)
  const sectionRef = useRef(null);
  const [isExporting, setIsExporting] = useState(false);

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
    if (!sectionRef.current || isExporting) return;
    setIsExporting(true);
    try {
      // A4 portrait: 595 x 842 pt
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4', compress: true });
      const pageW = pdf.internal.pageSize.getWidth();   // 595
      const pageH = pdf.internal.pageSize.getHeight();  // 842
      const margin = 10;
      const contentW = pageW - margin * 2;
      const maxContentH = pageH - margin * 2;

      // Skip heading/button wrapper (children[0]) — heading is
      // rendered as text via jsPDF below; button is hidden anyway.
      // We start from index 1 to include the CO Attainment table.
      const blocks = Array.from(sectionRef.current.children).slice(1);
      let currentY = margin;

      // Render heading as text on the first page
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(18);
      pdf.setTextColor('#1e293b');
      const headingLines = pdf.splitTextToSize(pdfHeading, contentW);
      // Center the title
      pdf.text(headingLines, pageW / 2, currentY + 20, { align: 'center' });
      
      // Add a decorative underline
      const titleHeight = headingLines.length * 24; // approx line height
      const lineWidth = 400; // width of the underline - increased for visibility
      pdf.setDrawColor(37, 99, 235); // blue underline #2563eb
      pdf.setLineWidth(2.5); // thicker line
      pdf.line((pageW - lineWidth) / 2, currentY + titleHeight, (pageW + lineWidth) / 2, currentY + titleHeight);
      
      currentY += titleHeight + 30; // space after title

      let isFirstPage = true;

      for (const block of blocks) {
        if (block.dataset.pdfSkip) continue;
        const canvas = await html2canvas(block, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          scrollX: 0,
          scrollY: -window.scrollY,
          onclone: (clonedDoc) => {
            const chartCards = clonedDoc.querySelectorAll('[data-chart-card="true"]');
            chartCards.forEach(card => {
              card.style.border = 'none';
              card.style.boxShadow = 'none';
            });
          }
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
        pdf.addImage(canvas.toDataURL('image/jpeg', 1.0), 'JPEG', xPos, currentY, drawW, drawH, undefined, 'FAST');
        currentY += drawH + 10;
        isFirstPage = false;
      }

      pdf.save(`Charts_${courseCode}.pdf`);
    } catch (err) {
      console.error(err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <section className="charts-section" ref={sectionRef}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#2c3e50', margin: 0 }}>Charts</h3>
        <button
          onClick={handleExportToPDF}
          disabled={isExporting}
          className={isExporting ? "loading" : ""}
          style={{ flexShrink: 0, marginLeft: '16px', backgroundColor: isExporting ? '#95a5a6' : '#e74c3c', color: '#fff', border: 'none', borderRadius: '6px', padding: '8px 18px', cursor: isExporting ? 'not-allowed' : 'pointer', fontWeight: '600', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          {isExporting ? (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>
              Exporting...
            </>
          ) : (
            'Export to PDF'
          )}
        </button>
      </div>

      {/* CO Attainment Table */}
      <div className="table-container" style={{ marginTop: '20px', overflowX: 'auto' }}>
        <h4 style={{ marginBottom: '15px', color: '#2c3e50' }}>
          CO Attainment of {pairLabel}
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


      {/* CO Charts - all on one page */}
      {/* â”€â”€ Charts â”€â”€ */}
      {/* Charts grid — CO charts, 2 columns on wide screens */}
      <SingleBarChart
        title={`CO Attainment \u2014 ${pairLabel}`}
        labels={coNames}
        values={coAchievedVals}
        color="#2563eb"
        yLabel="Achieved (%)"
      />
      <SingleBarChart
        title={`CO Attainment (Unnorm) \u2014 ${pairLabel}`}
        labels={coNames}
        values={coUnnormVals}
        color="#16a34a"
        yLabel="Unnorm Achieved (%)"
      />
      <SingleBarChart
        title={`CO Attainment (Eq. Wt.) \u2014 ${pairLabel}`}
        labels={coNames}
        values={coEqWtVals}
        color="#d97706"
        yLabel="Eq. Wt. Achieved (%)"
      />
      <GroupedBarChart
        title={`CO Attainment (All Methods) \u2014 ${pairLabel}`}
        labels={coNames}
        series={[
          { label: 'Achieved(%)',         values: coAchievedVals },
          { label: 'Unnorm Achieved(%)',  values: coUnnormVals   },
          { label: 'Eq. Wt. Achieved(%)', values: coEqWtVals    },
        ]}
      />
      {/* PO Attainment Table */}
      <div className="table-container" style={{ marginTop: '30px', overflowX: 'auto' }}>
        <h4 style={{ marginBottom: '15px', color: '#2c3e50' }}>
          PO Attainment of {pairLabel}
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

      {/* PO charts — one per row */}
      <SingleBarChart
        title={`PO Attainment \u2014 ${pairLabel}`}
        labels={poNames}
        values={poAchievedVals}
        color="#2563eb"
        yLabel="Achieved (%)"
      />
      <SingleBarChart
        title={`PO Attainment (Unnorm) \u2014 ${pairLabel}`}
        labels={poNames}
        values={poUnnormVals}
        color="#16a34a"
        yLabel="Unnorm Achieved (%)"
      />
      <SingleBarChart
        title={`PO Attainment (Eq. Wt.) \u2014 ${pairLabel}`}
        labels={poNames}
        values={poEqWtVals}
        color="#d97706"
        yLabel="Eq. Wt. Achieved (%)"
      />
      <GroupedBarChart
        title={`PO Attainment (All Methods) \u2014 ${pairLabel}`}
        labels={poNames}
        hideBarText={true}
        series={[
          { label: 'Achieved(%)',          values: poAchievedVals },
          { label: 'Unnorm Achieved(%)',   values: poUnnormVals   },
          { label: 'Eq. Wt. Achieved(%)', values: poEqWtVals     },
        ]}
      />
    </section>
  );
};

export default ChartsSheet;
