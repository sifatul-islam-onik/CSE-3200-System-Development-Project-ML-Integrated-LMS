import React from 'react';

/**
 * Full-page loading screen shown on first load.
 */
export const PageLoader = () => (
  <div className="attainment-page-loader">
    <div className="attainment-page-loader__inner">
      <div className="attainment-spinner attainment-spinner--lg">
        <div className="attainment-spinner__ring" />
        <div className="attainment-spinner__ring attainment-spinner__ring--delay" />
      </div>
      <p className="attainment-page-loader__text">Loading Attainment Data…</p>
    </div>
  </div>
);

/**
 * Inline overlay shown while switching sheets / saving.
 */
export const SheetLoader = ({ label = 'Loading…' }) => (
  <div className="attainment-sheet-loader">
    <div className="attainment-spinner attainment-spinner--md">
      <div className="attainment-spinner__ring" />
      <div className="attainment-spinner__ring attainment-spinner__ring--delay" />
    </div>
    <span className="attainment-sheet-loader__label">{label}</span>
  </div>
);

/**
 * Skeleton card rows – shown while sheet data is being fetched.
 */
export const SkeletonTable = ({ rows = 6, cols = 5 }) => (
  <div className="attainment-skeleton-wrap">
    <div className="attainment-skeleton-header" />
    <table className="attainment-skeleton-table">
      <thead>
        <tr>
          {Array.from({ length: cols }).map((_, i) => (
            <th key={i}><div className="attainment-skeleton-cell attainment-skeleton-cell--th" /></th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }).map((_, r) => (
          <tr key={r}>
            {Array.from({ length: cols }).map((_, c) => (
              <td key={c}><div className="attainment-skeleton-cell" style={{ width: c === 0 ? '80%' : `${50 + Math.random() * 40}%` }} /></td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default SheetLoader;
