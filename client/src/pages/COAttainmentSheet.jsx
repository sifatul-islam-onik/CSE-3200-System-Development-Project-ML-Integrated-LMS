import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Typography,
  Paper,
  Alert,
  Chip,
  Tooltip,
  IconButton,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  PictureAsPdf as PdfIcon,
  TableChart as ExcelIcon,
  Assessment as AssessmentIcon,
  Calculate as CalculateIcon,
} from '@mui/icons-material';
import { getCourseCoAttainment, calculateCourseCoAttainment } from '../services/coAttainmentService';
import { getCourseById } from '../services/courseService';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const COAttainmentSheet = ({ courseId, section, academicYear }) => {
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [attainmentData, setAttainmentData] = useState([]);
  const [course, setCourse] = useState(null);
  const [error, setError] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  /**
   * Fetch course details
   */
  useEffect(() => {
    if (!courseId) return;

    const fetchCourse = async () => {
      try {
        const response = await getCourseById(courseId);
        setCourse(response.data);
      } catch (err) {
        console.error('Error fetching course:', err);
        setError(err.response?.data?.message || 'Failed to fetch course data');
      }
    };

    fetchCourse();
  }, [courseId]);

  /**
   * Fetch CO attainment data
   */
  useEffect(() => {
    if (!courseId) return;

    fetchAttainment();
  }, [courseId, section, academicYear]);

  const fetchAttainment = async () => {
    try {
      setLoading(true);
      setError(null);

      const filters = {
        section: section || undefined,
        academicYear: academicYear || new Date().getFullYear().toString(),
      };

      const response = await getCourseCoAttainment(courseId, filters);
      setAttainmentData(response.data || []);
    } catch (err) {
      console.error('Error fetching CO attainment:', err);
      // Don't show error if data doesn't exist yet
      if (err.response?.status !== 404) {
        setError(err.response?.data?.message || 'Failed to fetch CO attainment data');
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * Calculate CO attainment
   */
  const handleCalculate = async () => {
    try {
      setCalculating(true);
      setError(null);

      const data = {
        section: section || null,
        academicYear: academicYear || new Date().getFullYear().toString(),
      };

      await calculateCourseCoAttainment(courseId, data);

      setSnackbar({
        open: true,
        message: '✓ Successfully calculated CO attainment!',
        severity: 'success',
      });

      // Refresh data
      await fetchAttainment();
    } catch (err) {
      console.error('Error calculating CO attainment:', err);
      setSnackbar({
        open: true,
        message: `✗ ${err.response?.data?.message || 'Failed to calculate CO attainment'}`,
        severity: 'error',
      });
      setError(err.response?.data?.message || 'Failed to calculate CO attainment');
    } finally {
      setCalculating(false);
    }
  };

  /**
   * Get attainment level from average score (0-3)
   * Level 0: < 40%
   * Level 1: 40-60%
   * Level 2: 60-75%
   * Level 3: >= 75%
   */
  const getAttainmentLevel = (avgScore) => {
    if (avgScore < 40) return 0;
    if (avgScore < 60) return 1;
    if (avgScore < 75) return 2;
    return 3;
  };

  /**
   * Get badge color and label for attainment level
   */
  const getAttainmentBadge = (level) => {
    const badges = {
      0: { label: 'Level 0', color: 'error', bg: '#ffcdd2', text: '#c62828' },
      1: { label: 'Level 1', color: 'warning', bg: '#fff9c4', text: '#f57f17' },
      2: { label: 'Level 2', color: 'info', bg: '#bbdefb', text: '#1565c0' },
      3: { label: 'Level 3', color: 'success', bg: '#c8e6c9', text: '#2e7d32' },
    };
    return badges[level] || badges[0];
  };

  /**
   * Export to Excel
   */
  const handleExportExcel = () => {
    try {
      const data = attainmentData.map((item) => ({
        'Course Outcome': item.courseOutcome?.co_code || 'N/A',
        'Description': item.courseOutcome?.description || 'N/A',
        'Average Score (%)': item.averageScore?.toFixed(2) || '0.00',
        'Attainment Level': `Level ${item.attainmentLevel || 0}`,
        'Total Obtained': item.totalMarksObtained || 0,
        'Total Possible': item.totalMarksPossible || 0,
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'CO Attainment');

      // Set column widths
      ws['!cols'] = [
        { wch: 18 },
        { wch: 50 },
        { wch: 18 },
        { wch: 18 },
        { wch: 15 },
        { wch: 15 },
      ];

      const fileName = `CO_Attainment_${course?.courseCode || courseId}_${section || 'All'}_${academicYear || 'Current'}.xlsx`;
      XLSX.writeFile(wb, fileName);

      setSnackbar({
        open: true,
        message: '✓ Successfully exported to Excel!',
        severity: 'success',
      });
    } catch (err) {
      console.error('Error exporting to Excel:', err);
      setSnackbar({
        open: true,
        message: '✗ Failed to export to Excel',
        severity: 'error',
      });
    }
  };

  /**
   * Export to PDF
   */
  const handleExportPDF = () => {
    try {
      const doc = new jsPDF();

      // Add title
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('Course Outcome Attainment Report', 14, 20);

      // Add course details
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(`Course: ${course?.courseCode || courseId} - ${course?.courseTitle || 'N/A'}`, 14, 30);
      if (section) {
        doc.text(`Section: ${section}`, 14, 37);
      }
      doc.text(`Academic Year: ${academicYear || new Date().getFullYear()}`, 14, section ? 44 : 37);

      // Prepare table data
      const tableData = attainmentData.map((item) => [
        item.courseOutcome?.co_code || 'N/A',
        item.courseOutcome?.description?.substring(0, 50) + '...' || 'N/A',
        `${item.averageScore?.toFixed(2) || '0.00'}%`,
        `Level ${item.attainmentLevel || 0}`,
      ]);

      // Add table
      doc.autoTable({
        startY: section ? 50 : 43,
        head: [['Course Outcome', 'Description', 'Avg Score', 'Level']],
        body: tableData,
        theme: 'grid',
        styles: {
          fontSize: 10,
          cellPadding: 3,
        },
        headStyles: {
          fillColor: [41, 128, 185],
          textColor: 255,
          fontStyle: 'bold',
        },
        columnStyles: {
          0: { cellWidth: 30 },
          1: { cellWidth: 80 },
          2: { cellWidth: 30 },
          3: { cellWidth: 25 },
        },
        didParseCell: function (data) {
          // Color code attainment levels
          if (data.section === 'body' && data.column.index === 3) {
            const level = parseInt(data.cell.text[0].replace('Level ', ''));
            const colors = {
              0: [255, 205, 210],
              1: [255, 249, 196],
              2: [187, 222, 251],
              3: [200, 230, 201],
            };
            data.cell.styles.fillColor = colors[level] || colors[0];
          }
        },
      });

      // Add footer
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(10);
        doc.text(
          `Generated on ${new Date().toLocaleDateString()} - Page ${i} of ${pageCount}`,
          14,
          doc.internal.pageSize.height - 10
        );
      }

      const fileName = `CO_Attainment_${course?.courseCode || courseId}_${section || 'All'}_${academicYear || 'Current'}.pdf`;
      doc.save(fileName);

      setSnackbar({
        open: true,
        message: '✓ Successfully exported to PDF!',
        severity: 'success',
      });
    } catch (err) {
      console.error('Error exporting to PDF:', err);
      setSnackbar({
        open: true,
        message: '✗ Failed to export to PDF',
        severity: 'error',
      });
    }
  };

  /**
   * Close snackbar
   */
  const handleCloseSnackbar = (event, reason) => {
    if (reason === 'clickaway') return;
    setSnackbar({ ...snackbar, open: false });
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Paper elevation={3} sx={{ p: 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" gutterBottom>
              <AssessmentIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              CO Attainment Report
            </Typography>
            {course && (
              <Typography variant="subtitle1" color="text.secondary">
                {course.courseCode} - {course.courseTitle}
                {section && ` (Section ${section})`}
              </Typography>
            )}
            <Typography variant="body2" color="text.secondary">
              Academic Year: {academicYear || new Date().getFullYear()}
            </Typography>
          </Box>

          {/* Right Side Controls */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Tooltip title="Calculate CO Attainment">
              <Button
                variant="contained"
                color="primary"
                startIcon={calculating ? <CircularProgress size={20} /> : <CalculateIcon />}
                onClick={handleCalculate}
                disabled={calculating}
              >
                {calculating ? 'Calculating...' : 'Calculate'}
              </Button>
            </Tooltip>
            <Tooltip title="Export to Excel">
              <span>
                <IconButton
                  onClick={handleExportExcel}
                  color="success"
                  disabled={attainmentData.length === 0}
                  sx={{ border: '1px solid #4caf50' }}
                >
                  <ExcelIcon />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Export to PDF">
              <span>
                <IconButton
                  onClick={handleExportPDF}
                  color="error"
                  disabled={attainmentData.length === 0}
                  sx={{ border: '1px solid #f44336' }}
                >
                  <PdfIcon />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Refresh">
              <IconButton onClick={fetchAttainment} color="primary" disabled={loading}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Alert Messages */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Info Box */}
        <Box 
          sx={{ 
            mb: 2, 
            p: 2, 
            bgcolor: '#e3f2fd', 
            borderRadius: 1,
            border: '1px solid #2196f3',
          }}
        >
          <Typography variant="body2" color="text.secondary">
            <strong>Total Course Outcomes:</strong> {attainmentData.length}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            💡 <strong>Attainment Levels:</strong> Level 0 (&lt;40%) | Level 1 (40-60%) | Level 2 (60-75%) | Level 3 (≥75%)
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            📊 Average scores are calculated from CT marks, assignments, and term exams mapped to each CO.
          </Typography>
        </Box>

        {/* CO Attainment Table */}
        {attainmentData.length === 0 ? (
          <Alert severity="info">
            No CO attainment data available. Click "Calculate" to generate attainment report.
          </Alert>
        ) : (
          <TableContainer>
            <Table sx={{ minWidth: 650 }} aria-label="CO attainment table">
              <TableHead>
                <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
                    Course Outcome
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
                    Description
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
                    Average Score (%)
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
                    Attainment Level
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
                    Marks
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {attainmentData.map((item, index) => {
                  const level = item.attainmentLevel !== undefined 
                    ? item.attainmentLevel 
                    : getAttainmentLevel(item.averageScore || 0);
                  const badge = getAttainmentBadge(level);

                  return (
                    <TableRow
                      key={index}
                      sx={{
                        '&:nth-of-type(odd)': { bgcolor: '#fafafa' },
                        '&:hover': { bgcolor: '#f5f5f5' },
                      }}
                    >
                      <TableCell>
                        <Typography variant="body1" sx={{ fontWeight: 600, color: '#1976d2' }}>
                          {item.courseOutcome?.co_code || 'N/A'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {item.courseOutcome?.description || 'N/A'}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Typography
                          variant="body1"
                          sx={{
                            fontWeight: 700,
                            color: level >= 2 ? '#2e7d32' : level === 1 ? '#ed6c02' : '#d32f2f',
                            fontSize: '1rem',
                          }}
                        >
                          {item.averageScore?.toFixed(2) || '0.00'}%
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={badge.label}
                          sx={{
                            backgroundColor: badge.bg,
                            color: badge.text,
                            fontWeight: 700,
                            fontSize: '0.85rem',
                            minWidth: 80,
                          }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip
                          title={`${item.totalMarksObtained?.toFixed(2) || 0} out of ${item.totalMarksPossible?.toFixed(2) || 0} marks`}
                          arrow
                        >
                          <Typography variant="body2" color="text.secondary">
                            {item.totalMarksObtained?.toFixed(2) || 0} / {item.totalMarksPossible?.toFixed(2) || 0}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Summary Statistics */}
        {attainmentData.length > 0 && (
          <Box sx={{ mt: 3, p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
            <Typography variant="h6" gutterBottom>
              Summary
            </Typography>
            <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {[0, 1, 2, 3].map((level) => {
                const count = attainmentData.filter(
                  (item) => (item.attainmentLevel !== undefined ? item.attainmentLevel : getAttainmentLevel(item.averageScore || 0)) === level
                ).length;
                const percentage = ((count / attainmentData.length) * 100).toFixed(1);
                const badge = getAttainmentBadge(level);

                return (
                  <Box key={level} sx={{ flex: '1 1 200px' }}>
                    <Chip
                      label={badge.label}
                      sx={{
                        backgroundColor: badge.bg,
                        color: badge.text,
                        fontWeight: 700,
                        mb: 1,
                      }}
                    />
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      {count} COs ({percentage}%)
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          </Box>
        )}
      </Paper>

      {/* Toast Notification */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={handleCloseSnackbar} 
          severity={snackbar.severity} 
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default COAttainmentSheet;
