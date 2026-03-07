import React, { useEffect, useState } from 'react';
import { getStudentResults } from '../services/resultService';

const YEAR_LABELS = { 1: '1st Year', 2: '2nd Year', 3: '3rd Year', 4: '4th Year', 5: '5th Year' };
const TERM_LABELS = { 1: '1st Term', 2: '2nd Term' };

const gradeColor = (grade) => {
  if (!grade) return '#555';
  if (grade === 'A+' || grade === 'A') return '#15803d';
  if (grade === 'A-' || grade === 'B+') return '#166534';
  if (grade === 'B' || grade === 'B-') return '#1e4d2b';
  if (grade === 'C+' || grade === 'C') return '#b45309';
  if (grade === 'D') return '#b91c1c';
  if (grade === 'F') return '#dc2626';
  return '#555';
};

const ResultView = () => {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openTerms, setOpenTerms] = useState({});

  useEffect(() => {
    const fetch = async () => {
      try {
        const data = await getStudentResults();
        setResults(data.results || []);
        // Open all terms by default
        const initial = {};
        (data.results || []).forEach(r => {
          initial[`${r.yearLevel}-${r.term}`] = true;
        });
        setOpenTerms(initial);
      } catch (err) {
        setError('Failed to load results. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const toggleTerm = (key) => setOpenTerms(prev => ({ ...prev, [key]: !prev[key] }));

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner spinner-large"></div>
      </div>
    );
  }

  if (error) {
    return <div className="alert alert-error">{error}</div>;
  }

  if (!results.length) {
    return (
      <div className="empty-state">
        <div className="empty-icon">📋</div>
        <p>No results have been published yet.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {results.map((termResult) => {
        const key = `${termResult.yearLevel}-${termResult.term}`;
        const isOpen = openTerms[key] !== false;
        const semLabel = `${YEAR_LABELS[termResult.yearLevel] || `Year ${termResult.yearLevel}`} — ${TERM_LABELS[termResult.term] || `Term ${termResult.term}`}`;

        return (
          <div
            key={termResult._id}
            style={{
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              overflow: 'hidden',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              background: '#fff',
            }}
          >
            {/* Collapsible header */}
            <button
              onClick={() => toggleTerm(key)}
              style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '14px 20px',
                background: '#1e3a5f',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                fontSize: '15px',
                fontWeight: 600,
              }}
            >
              <span>{semLabel}</span>
              <span style={{ fontSize: '18px' }}>{isOpen ? '▲' : '▼'}</span>
            </button>

            {isOpen && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                  <thead>
                    <tr style={{ background: '#f3f4f6', borderBottom: '2px solid #d1d5db' }}>
                      <th style={thStyle}>Sl. No.</th>
                      <th style={thStyle}>Course No.</th>
                      <th style={{ ...thStyle, textAlign: 'left' }}>Course Title</th>
                      <th style={thStyle}>Credit</th>
                      <th style={thStyle}>Grade Point</th>
                      <th style={thStyle}>Letter Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {termResult.courses.map((cr, idx) => (
                      <tr
                        key={cr.courseCode || idx}
                        style={{ borderBottom: '1px solid #e5e7eb', background: idx % 2 === 0 ? '#fff' : '#f9fafb' }}
                      >
                        <td style={tdCenterStyle}>{idx + 1}</td>
                        <td style={tdCenterStyle}>{cr.courseCode}</td>
                        <td style={{ ...tdStyle, textAlign: 'left' }}>{cr.courseTitle}</td>
                        <td style={tdCenterStyle}>{cr.credit}</td>
                        <td style={tdCenterStyle}>{cr.gradePoint?.toFixed(2)}</td>
                        <td style={{ ...tdCenterStyle, fontWeight: 700, color: gradeColor(cr.letterGrade) }}>
                          {cr.letterGrade}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#f0f4ff', borderTop: '2px solid #c7d2fe', fontWeight: 600 }}>
                      <td colSpan={2} style={{ padding: '10px 12px', textAlign: 'right', color: '#374151' }}>
                        Credit Taken:
                      </td>
                      <td style={{ padding: '10px 12px', color: '#1e3a5f' }}>{termResult.creditTaken}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', color: '#374151' }}>
                        Completed: <strong>{termResult.creditCompleted}</strong>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', color: '#374151' }}>
                        Total Earned: <strong>{termResult.totalCreditCompleted}</strong>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', color: '#374151' }}></td>
                    </tr>
                    <tr style={{ background: '#e0f2fe', borderTop: '1px solid #bae6fd', fontWeight: 700 }}>
                      <td colSpan={3} style={{ padding: '10px 12px', textAlign: 'right', color: '#0c4a6e' }}>
                        Term GPA:
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: '16px', color: '#0c4a6e' }}>
                        {termResult.termGPA?.toFixed(2)}
                      </td>
                      <td colSpan={2} style={{ padding: '10px 12px', textAlign: 'center', color: '#0c4a6e' }}>
                        CGPA: <span style={{ fontSize: '16px' }}>{termResult.cgpa?.toFixed(2)}</span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const thStyle = {
  padding: '10px 12px',
  textAlign: 'center',
  fontWeight: 600,
  color: '#374151',
  whiteSpace: 'nowrap',
};

const tdStyle = {
  padding: '9px 12px',
  color: '#374151',
};

const tdCenterStyle = {
  ...tdStyle,
  textAlign: 'center',
};

export default ResultView;
