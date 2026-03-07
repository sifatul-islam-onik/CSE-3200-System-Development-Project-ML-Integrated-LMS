import React from 'react';
import * as XLSX from 'xlsx';

const CTModals = ({
  selectedSheet,
  // showGeneratedTableModal
  showGeneratedTableModal,
  setShowGeneratedTableModal,
  ctRows,
  assignmentRows,
  getActiveCTs,
  getActiveCTFields,
  getActiveAssignments,
  getActiveAssignmentFields,
  calculateAutoFactor,
  calculateAutoAssignmentFactor,
  computeAssignmentCOTotal,
  formatNumber,
  // showObtainedGeneratedModal
  showObtainedGeneratedModal,
  setShowObtainedGeneratedModal,
  obtainedModalView,
  setObtainedModalView,
  ctObtainedRows,
  attnAssignObtainedRows,
  calculateCOTotals,
  calculateFactoredCOTotals,
  calculateAssignmentCOTotalsNoAttendance,
  calculateFactoredAssignmentCOTotals,
}) => {
  const handleExportToExcel = () => {
    const wb = XLSX.utils.book_new();

    if (selectedSheet === 'CT') {
      const autoFactor = calculateAutoFactor();
      const activeCTFields = getActiveCTFields();

      const buildSheetData = (isFactored) => {
        const coTotals = isFactored ? calculateFactoredCOTotals() : calculateCOTotals();

        const headerRow = ['Roll'];
        ctRows.forEach(row => {
          const total = coTotals[row.coNumber || ''] || 0;
          headerRow.push(`${row.coNumber} (${formatNumber(total)})`);
        });
        headerRow.push('Total');

        const dataRows = ctObtainedRows.map(studentRow => {
          const dataRow = [studentRow.rollNumber || '-'];

          ctRows.forEach(coRow => {
            const coActiveFields = activeCTFields.filter(f => (coRow[f] || 0) !== 0);
            const coAllAbsent = coActiveFields.length > 0 &&
              coActiveFields.every(f => { const v = studentRow[f]; return v === 'A' || v === 'Absent'; });
            if (coAllAbsent) {
              dataRow.push('Absent');
            } else {
              const coTotal = coActiveFields.reduce((sum, field) => {
                const ctKey = field.replace(/(_Q[123])$/, '');
                const factor = isFactored ? (autoFactor[ctKey] || 0) : 1;
                const rawMark = studentRow[field];
                const mark = (rawMark === 'A' || rawMark === 'Absent') ? 0 : (parseFloat(rawMark) || 0);
                return sum + (factor * mark);
              }, 0);
              dataRow.push(parseFloat(formatNumber(coTotal)) || 0);
            }
          });

          const allActiveFields = activeCTFields.filter(f => ctRows.some(coRow => (coRow[f] || 0) !== 0));
          const rowAllAbsent = allActiveFields.length > 0 &&
            allActiveFields.every(f => { const v = studentRow[f]; return v === 'A' || v === 'Absent'; });
          if (rowAllAbsent) {
            dataRow.push('Absent');
          } else {
            const rowTotal = ctRows.reduce((total, coRow) =>
              total + activeCTFields.reduce((sum, field) => {
                const allocated = coRow[field] || 0;
                if (allocated === 0) return sum;
                const ctKey = field.replace(/(_Q[123])$/, '');
                const factor = isFactored ? (autoFactor[ctKey] || 0) : 1;
                const rawMark = studentRow[field];
                const mark = (rawMark === 'A' || rawMark === 'Absent') ? 0 : (parseFloat(rawMark) || 0);
                return sum + (factor * mark);
              }, 0)
            , 0);
            dataRow.push(parseFloat(formatNumber(rowTotal)) || 0);
          }

          return dataRow;
        });

        return [headerRow, ...dataRows];
      };

      const ws1 = XLSX.utils.aoa_to_sheet(buildSheetData(false));
      XLSX.utils.book_append_sheet(wb, ws1, 'CO-wise Marks (Original)');

      const ws2 = XLSX.utils.aoa_to_sheet(buildSheetData(true));
      XLSX.utils.book_append_sheet(wb, ws2, 'CO-wise Marks (Factored)');

      XLSX.writeFile(wb, 'CT_CO_wise_Marks.xlsx');

    } else if (selectedSheet === 'Attn_Assign') {
      const autoAssignFactor = calculateAutoAssignmentFactor();
      const activeAssignFields = getActiveAssignmentFields();

      const buildSheetData = (isFactored) => {
        const coTotals = isFactored ? calculateFactoredAssignmentCOTotals() : calculateAssignmentCOTotalsNoAttendance();

        const headerRow = ['Roll'];
        assignmentRows.forEach(row => {
          const total = coTotals[row.coNumber || ''] || 0;
          headerRow.push(`${row.coNumber} (${formatNumber(total)})`);
        });
        headerRow.push('Total');

        const dataRows = attnAssignObtainedRows.map(studentRow => {
          const dataRow = [studentRow.rollNumber || '-'];

          assignmentRows.forEach(coRow => {
            const coTotal = activeAssignFields.reduce((sum, field) => {
              const allocated = coRow[field] || 0;
              if (allocated === 0) return sum;
              const assignmentKey = field.replace(/(_Q[123])$/, '');
              const factor = isFactored ? (autoAssignFactor[assignmentKey] || 0) : 1;
              return sum + (factor * (studentRow[field] || 0));
            }, 0);
            dataRow.push(parseFloat(formatNumber(coTotal)) || 0);
          });

          const rowTotal = assignmentRows.reduce((total, coRow) =>
            total + activeAssignFields.reduce((sum, field) => {
              const allocated = coRow[field] || 0;
              if (allocated === 0) return sum;
              const assignmentKey = field.replace(/(_Q[123])$/, '');
              const factor = isFactored ? (autoAssignFactor[assignmentKey] || 0) : 1;
              return sum + (factor * (studentRow[field] || 0));
            }, 0)
          , 0);
          dataRow.push(parseFloat(formatNumber(rowTotal)) || 0);

          return dataRow;
        });

        return [headerRow, ...dataRows];
      };

      const ws1 = XLSX.utils.aoa_to_sheet(buildSheetData(false));
      XLSX.utils.book_append_sheet(wb, ws1, 'CO-wise Marks (Original)');

      const ws2 = XLSX.utils.aoa_to_sheet(buildSheetData(true));
      XLSX.utils.book_append_sheet(wb, ws2, 'CO-wise Marks (Factored)');

      XLSX.writeFile(wb, 'Attn_Assign_CO_wise_Marks.xlsx');
    }
  };

  return (
    <>
      {/* Generated Table Modal (CT & Attn_Assign) */}
      {showGeneratedTableModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white', padding: '20px', borderRadius: '16px',
            maxWidth: '90%', maxHeight: '90%', overflow: 'auto', position: 'relative'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3>
                {selectedSheet === 'CT'
                  ? 'Generated Table - CO mapping of Class Test Marks'
                  : selectedSheet === 'Attn_Assign'
                    ? 'Generated Table - CO mapping of Attendance and Assignment Marks'
                    : 'Generated Table'}
              </h3>
              <button onClick={() => setShowGeneratedTableModal(false)}
                style={{ padding: '4px 8px', backgroundColor: '#e74c3c', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
                ✕
              </button>
            </div>
            <div className="table-wrapper">
              <table className="ct-table">
                {selectedSheet === 'CT' ? (
                  <>
                    <thead>
                      <tr>
                        <th rowSpan="2">CO No.</th>
                        {getActiveCTs().map(ct => (<th key={ct} colSpan="3">{ct}</th>))}
                        <th rowSpan="2">CO Total</th>
                      </tr>
                      <tr>
                        {getActiveCTs().map(ct => (
                          <React.Fragment key={`${ct}-questions`}>
                            <th>Q1</th><th>Q2</th><th>Q3</th>
                          </React.Fragment>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ctRows.map((row, idx) => (
                        <tr key={row.coNumber || idx}>
                          <td className="co-label">{row.coNumber || '-'}</td>
                          {getActiveCTFields().map(field => {
                            const ctKey = field.replace(/(_Q[123])$/, '');
                            const factor = calculateAutoFactor()[ctKey] || 0;
                            return (
                              <td key={field} style={{ textAlign: 'center' }}>
                                {formatNumber(factor * (row[field] || 0))}
                              </td>
                            );
                          })}
                          <td className="co-total">
                            {formatNumber(getActiveCTFields().reduce((sum, field) => {
                              const ctKey = field.replace(/(_Q[123])$/, '');
                              return sum + (calculateAutoFactor()[ctKey] || 0) * (row[field] || 0);
                            }, 0))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td className="footer-label" style={{ fontWeight: 'bold' }}>Total</td>
                        <td colSpan={getActiveCTs().length * 3} style={{ textAlign: 'center' }}></td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                          {formatNumber(ctRows.reduce((totalSum, row) =>
                            totalSum + getActiveCTFields().reduce((sum, field) => {
                              const ctKey = field.replace(/(_Q[123])$/, '');
                              return sum + (calculateAutoFactor()[ctKey] || 0) * (row[field] || 0);
                            }, 0), 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </>
                ) : selectedSheet === 'Attn_Assign' ? (
                  <>
                    <thead>
                      <tr>
                        <th rowSpan="2">CO No.</th>
                        <th rowSpan="2">Attendance</th>
                        {getActiveAssignments().map(assignment => (
                          <th key={assignment} colSpan="3">{assignment.replace('Assgn', 'Assignment ')}</th>
                        ))}
                        <th rowSpan="2">CO Total</th>
                      </tr>
                      <tr>
                        {getActiveAssignments().map(assignment => (
                          <React.Fragment key={`${assignment}-questions`}>
                            <th>Q1</th><th>Q2</th><th>Q3</th>
                          </React.Fragment>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {assignmentRows.map((row, idx) => (
                        <tr key={row.coNumber || idx}>
                          <td className="co-label">{row.coNumber || '-'}</td>
                          <td style={{ textAlign: 'center' }}>-</td>
                          {getActiveAssignmentFields().map(field => {
                            const assignmentKey = field.replace(/(_Q[123])$/, '');
                            const factor = calculateAutoAssignmentFactor()[assignmentKey] || 0;
                            return (
                              <td key={field} style={{ textAlign: 'center' }}>
                                {formatNumber(factor * (row[field] || 0))}
                              </td>
                            );
                          })}
                          <td className="co-total">
                            {formatNumber(getActiveAssignmentFields().reduce((sum, field) => {
                              const assignmentKey = field.replace(/(_Q[123])$/, '');
                              return sum + (calculateAutoAssignmentFactor()[assignmentKey] || 0) * (row[field] || 0);
                            }, 0))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                ) : null}
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Obtained Generated Table Modal (CT & Attn_Assign) */}
      {showObtainedGeneratedModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white', padding: '20px', borderRadius: '16px',
            maxWidth: '90%', maxHeight: '90%', overflow: 'auto', position: 'relative'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button onClick={() => setObtainedModalView(prev => Math.max(0, prev - 1))}
                  disabled={obtainedModalView === 0}
                  style={{ padding: '6px 12px', backgroundColor: obtainedModalView === 0 ? '#ccc' : '#3498db', color: 'white', border: 'none', borderRadius: '4px', cursor: obtainedModalView === 0 ? 'not-allowed' : 'pointer', fontSize: '14px' }}>
                  ← Previous
                </button>
                <h3>
                  Generated Obtained Table - CO-wise Marks{' '}
                  {obtainedModalView === 0 ? '(Original)' : '(Factored)'}
                </h3>
                <button onClick={() => setObtainedModalView(prev => Math.min(1, prev + 1))}
                  disabled={obtainedModalView === 1}
                  style={{ padding: '6px 12px', backgroundColor: obtainedModalView === 1 ? '#ccc' : '#3498db', color: 'white', border: 'none', borderRadius: '4px', cursor: obtainedModalView === 1 ? 'not-allowed' : 'pointer', fontSize: '14px' }}>
                  Next →
                </button>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {(selectedSheet === 'CT' || selectedSheet === 'Attn_Assign') && (
                  <button
                    onClick={handleExportToExcel}
                    style={{ padding: '6px 14px', backgroundColor: '#27ae60', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}
                    title="Export both Original and Factored tables to Excel"
                  >
                    ⬇ Export Excel
                  </button>
                )}
                <button onClick={() => { setShowObtainedGeneratedModal(false); setObtainedModalView(0); }}
                  style={{ padding: '4px 8px', backgroundColor: '#e74c3c', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
                  ✕
                </button>
              </div>
            </div>

            <div className="table-wrapper">
              <table className="ct-obtained-table">
                {selectedSheet === 'CT' ? (
                  <>
                    <thead>
                      <tr>
                        <th>Roll</th>
                        {ctRows.map((row, idx) => {
                          const coKey = row.coNumber || `CO${idx + 1}`;
                          const coTotals = obtainedModalView === 0 ? calculateCOTotals() : calculateFactoredCOTotals();
                          const totalMarks = coTotals[coKey] || 0;
                          return (
                            <th key={`co-${idx}`}>
                              {row.coNumber}<br />
                              <small style={{ fontWeight: 'normal', color: '#666' }}>({formatNumber(totalMarks)})</small>
                            </th>
                          );
                        })}
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ctObtainedRows.map((studentRow, studentIdx) => (
                        <tr key={`ct-co-${studentRow.rollNumber}-${studentIdx}`}>
                          <td className="roll-cell" title={studentRow.name || studentRow.rollNumber}>
                            {studentRow.rollNumber || '-'}
                          </td>
                          {ctRows.map((coRow, coIdx) => {
                            const coActiveFields = getActiveCTFields().filter(f => (coRow[f] || 0) !== 0);
                            const coAllAbsent = coActiveFields.length > 0 && coActiveFields.every(f => { const v = studentRow[f]; return v === 'A' || v === 'Absent'; });
                            const coTotal = coActiveFields.reduce((sum, field) => {
                              const ctKey = field.replace(/(_Q[123])$/, '');
                              const factor = obtainedModalView === 0 ? 1 : (calculateAutoFactor()[ctKey] || 0);
                              const rawMark = studentRow[field];
                              const mark = (rawMark === 'A' || rawMark === 'Absent') ? 0 : (parseFloat(rawMark) || 0);
                              return sum + (factor * mark);
                            }, 0);
                            return (
                              <td key={`co-${coIdx}-student-${studentIdx}`} style={{ textAlign: 'center', color: coAllAbsent ? '#e74c3c' : undefined, fontStyle: coAllAbsent ? 'italic' : undefined }}>
                                {coAllAbsent ? 'Absent' : formatNumber(coTotal)}
                              </td>
                            );
                          })}
                          {(() => {
                            const allActiveFields = getActiveCTFields().filter(f => ctRows.some(coRow => (coRow[f] || 0) !== 0));
                            const rowAllAbsent = allActiveFields.length > 0 && allActiveFields.every(f => { const v = studentRow[f]; return v === 'A' || v === 'Absent'; });
                            const rowTotal = ctRows.reduce((total, coRow) => {
                              return total + getActiveCTFields().reduce((sum, field) => {
                                const allocatedMarks = coRow[field] || 0;
                                if (allocatedMarks === 0) return sum;
                                const ctKey = field.replace(/(_Q[123])$/, '');
                                const factor = obtainedModalView === 0 ? 1 : (calculateAutoFactor()[ctKey] || 0);
                                const rawMark = studentRow[field];
                                const mark = (rawMark === 'A' || rawMark === 'Absent') ? 0 : (parseFloat(rawMark) || 0);
                                return sum + (factor * mark);
                              }, 0);
                            }, 0);
                            return (
                              <td style={{ textAlign: 'center', fontWeight: 'bold', color: rowAllAbsent ? '#e74c3c' : undefined, fontStyle: rowAllAbsent ? 'italic' : undefined }}>
                                {rowAllAbsent ? 'Absent' : formatNumber(rowTotal)}
                              </td>
                            );
                          })()}
                        </tr>
                      ))}
                      {ctObtainedRows.length === 0 && (
                        <tr>
                          <td colSpan={ctRows.length + 2} style={{ textAlign: 'center', color: '#7f8c8d', padding: '20px' }}>
                            No students found for this course.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  
                  </>
                ) : selectedSheet === 'Attn_Assign' ? (
                  <>
                    <thead>
                      <tr>
                        <th>Roll</th>
                        {assignmentRows.map((row, idx) => {
                          const coKey = row.coNumber || `CO${idx + 1}`;
                          const coTotals = obtainedModalView === 0 ? calculateAssignmentCOTotalsNoAttendance() : calculateFactoredAssignmentCOTotals();
                          const totalMarks = coTotals[coKey] || 0;
                          return (
                            <th key={`co-${idx}`}>
                              {row.coNumber}<br />
                              <small style={{ fontWeight: 'normal', color: '#666' }}>({formatNumber(totalMarks)})</small>
                            </th>
                          );
                        })}
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attnAssignObtainedRows.map((studentRow, studentIdx) => (
                        <tr key={`assign-co-${studentRow.rollNumber}-${studentIdx}`}>
                          <td className="roll-cell" title={studentRow.name || studentRow.rollNumber}>
                            {studentRow.rollNumber || '-'}
                          </td>
                          {assignmentRows.map((coRow, coIdx) => {
                            const coTotal = getActiveAssignmentFields().reduce((sum, field) => {
                              const allocatedMarks = coRow[field] || 0;
                              if (allocatedMarks === 0) return sum;
                              const assignmentKey = field.replace(/(_Q[123])$/, '');
                              const factor = obtainedModalView === 0 ? 1 : (calculateAutoAssignmentFactor()[assignmentKey] || 0);
                              return sum + (factor * (studentRow[field] || 0));
                            }, 0);
                            return (
                              <td key={`co-${coIdx}-student-${studentIdx}`} style={{ textAlign: 'center' }}>
                                {formatNumber(coTotal)}
                              </td>
                            );
                          })}
                          <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                            {formatNumber(assignmentRows.reduce((total, coRow) => {
                              return total + getActiveAssignmentFields().reduce((sum, field) => {
                                const allocatedMarks = coRow[field] || 0;
                                if (allocatedMarks === 0) return sum;
                                const assignmentKey = field.replace(/(_Q[123])$/, '');
                                const factor = obtainedModalView === 0 ? 1 : (calculateAutoAssignmentFactor()[assignmentKey] || 0);
                                return sum + (factor * (studentRow[field] || 0));
                              }, 0);
                            }, 0))}
                          </td>
                        </tr>
                      ))}
                      {attnAssignObtainedRows.length === 0 && (
                        <tr>
                          <td colSpan={assignmentRows.length + 2} style={{ textAlign: 'center', color: '#7f8c8d', padding: '20px' }}>
                            No students found for this course.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </>
                ) : null}
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CTModals;
