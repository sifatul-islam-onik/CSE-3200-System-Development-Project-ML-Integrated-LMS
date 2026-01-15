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
  Grid,
  Card,
  CardContent,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  PictureAsPdf as PdfIcon,
  TableChart as ExcelIcon,
  Assessment as AssessmentIcon,
  Calculate as CalculateIcon,
  BarChart as BarChartIcon,
  School as SchoolIcon,
} from '@mui/icons-material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  LabelList,
} from 'recharts';
import { getCoursePOAttainment, calculateCoursePOAttainment } from '../services/poAttainmentService';
import { getCourseById } from '../services/courseService';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const POAttainmentSheet = ({ courseId, section, academicYear }) => {
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
   * Fetch PO attainment data
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

      const response = await getCoursePOAttainment(courseId, filters);
      setAttainmentData(response.data || []);
    } catch (err) {
      console.error('Error fetching PO attainment:', err);
      // Don't show error if data doesn't exist yet
      if (err.response?.status !== 404) {
        setError(err.response?.data?.message || 'Failed to fetch PO attainment data');
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * Calculate PO attainment
   */
  const handleCalculate = async () => {
    try {
      setCalculating(true);
      setError(null);

      const data = {
        section: section || null,
        academicYear: academicYear || new Date().getFullYear().toString(),
      };

      await calculateCoursePOAttainment(courseId, data);

      setSnackbar({
        open: true,
        message: '✓ Successfully calculated PO attainment!',
        severity: 'success',
      });

      // Refresh data
      await fetchAttainment();
    } catch (err) {
      console.error('Error calculating PO attainment:', err);
      setSnackbar({
        open: true,
        message: `✗ ${err.response?.data?.message || 'Failed to calculate PO attainment'}`,
        severity: 'error',
      });
      setError(err.response?.data?.message || 'Failed to calculate PO attainment');
    } finally {
      setCalculating(false);
    }
  };

  /**
   * Get attainment level from weighted score (0-3)
   * Level 0: < 1.5
   * Level 1: 1.5-2.0
   * Level 2: 2.0-2.5
   * Level 3: >= 2.5
   */
  const getAttainmentLevel = (weightedScore) => {
    if (weightedScore < 1.5) return 0;
    if (weightedScore < 2.0) return 1;
    if (weightedScore < 2.5) return 2;
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
   * Get bar color based on attainment level
   */
  const getBarColor = (level) => {
    const colors = {
      0: '#f44336', // red
      1: '#ff9800', // orange
      2: '#2196f3', // blue
      3: '#4caf50', // green
    };
    return colors[level] || colors[0];
  };

  /**
   * Prepare chart data
   */
  const getChartData = () => {
    return attainmentData.map((item) => ({
      po: item.programOutcome?.po_code || 'N/A',
      score: parseFloat(item.weightedScore?.toFixed(2) || 0),
      level: item.attainmentLevel !== undefined 
        ? item.attainmentLevel 
        : getAttainmentLevel(item.weightedScore || 0),
      description: item.programOutcome?.description || '',
    }));
  };

  /**
   * Export to Excel
   */
  const handleExportExcel = () => {
    try {
      const data = attainmentData.map((item) => ({
        'Program Outcome': item.programOutcome?.po_code || 'N/A',
        'Description': item.programOutcome?.description || 'N/A',
        'Weighted Score': item.weightedScore?.toFixed(2) || '0.00',
        'Attainment Level': `Level ${item.attainmentLevel || 0}`,
        'Contributing COs': item.contributingCOs?.join(', ') || 'None',
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'PO Attainment');

      // Set column widths
      ws['!cols'] = [
        { wch: 18 },
        { wch: 60 },
        { wch: 18 },
        { wch: 18 },
        { wch: 30 },
      ];

      const fileName = `PO_Attainment_${course?.courseCode || courseId}_${section || 'All'}_${academicYear || 'Current'}.xlsx`;
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
   * Export accreditation-ready PDF report
   */
  const handleExportPDF = () => {
    try {
      const doc = new jsPDF();
      
      // Add accreditation header
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('PROGRAM OUTCOME ATTAINMENT REPORT', 105, 15, { align: 'center' });
      doc.text('(For Accreditation Purpose)', 105, 23, { align: 'center' });

      // Add horizontal line
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.5);
      doc.line(14, 26, 196, 26);

      // Add course details section
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('COURSE DETAILS:', 14, 34);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(`Course Code: ${course?.courseCode || 'N/A'}`, 14, 41);
      doc.text(`Course Title: ${course?.courseTitle || 'N/A'}`, 14, 47);
      if (section) {
        doc.text(`Section: ${section}`, 14, 53);
      }
      doc.text(`Academic Year: ${academicYear || new Date().getFullYear()}`, 14, section ? 59 : 53);
      doc.text(`Report Generated: ${new Date().toLocaleDateString('en-IN')}`, 14, section ? 65 : 59);

      // Add PO attainment table
      const tableData = attainmentData.map((item) => [
        item.programOutcome?.po_code || 'N/A',
        item.programOutcome?.description?.substring(0, 70) + '...' || 'N/A',
        item.weightedScore?.toFixed(2) || '0.00',
        `Level ${item.attainmentLevel || 0}`,
      ]);

      doc.autoTable({
        startY: section ? 72 : 66,
        head: [['PO Code', 'Description', 'Weighted Score', 'Attainment Level']],
        body: tableData,
        theme: 'grid',
        styles: {
          fontSize: 9,
          cellPadding: 4,
        },
        headStyles: {
          fillColor: [41, 128, 185],
          textColor: 255,
          fontStyle: 'bold',
          halign: 'center',
        },
        columnStyles: {
          0: { cellWidth: 25, halign: 'center' },
          1: { cellWidth: 100 },
          2: { cellWidth: 30, halign: 'center' },
          3: { cellWidth: 30, halign: 'center' },
        },
        didParseCell: function (data) {
          // Color code attainment levels
          if (data.section === 'body' && data.column.index === 3) {
            const levelText = data.cell.text[0];
            const level = parseInt(levelText.replace('Level ', ''));
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

      // Add summary section
      const finalY = doc.lastAutoTable.finalY + 10;
      
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('ATTAINMENT SUMMARY:', 14, finalY);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      
      const summaryData = [0, 1, 2, 3].map((level) => {
        const count = attainmentData.filter(
          (item) => (item.attainmentLevel !== undefined ? item.attainmentLevel : getAttainmentLevel(item.weightedScore || 0)) === level
        ).length;
        const percentage = attainmentData.length > 0 ? ((count / attainmentData.length) * 100).toFixed(1) : '0.0';
        return [`Level ${level}`, count.toString(), `${percentage}%`];
      });

      doc.autoTable({
        startY: finalY + 5,
        head: [['Attainment Level', 'Count', 'Percentage']],
        body: summaryData,
        theme: 'striped',
        styles: {
          fontSize: 9,
          cellPadding: 3,
        },
        headStyles: {
          fillColor: [66, 66, 66],
          textColor: 255,
          fontStyle: 'bold',
          halign: 'center',
        },
        columnStyles: {
          0: { cellWidth: 60, halign: 'center' },
          1: { cellWidth: 30, halign: 'center' },
          2: { cellWidth: 30, halign: 'center' },
        },
      });

      // Add accreditation notes
      const notesY = doc.lastAutoTable.finalY + 10;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('ACCREDITATION NOTES:', 14, notesY);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      const notes = [
        '1. PO attainment is calculated through weighted average of mapped Course Outcomes (COs).',
        '2. CO-PO mapping strength is considered in weighted score calculation.',
        '3. Attainment levels: Level 0 (<1.5), Level 1 (1.5-2.0), Level 2 (2.0-2.5), Level 3 (≥2.5).',
        '4. This report is generated for accreditation and quality assurance purposes.',
      ];

      notes.forEach((note, index) => {
        doc.text(note, 14, notesY + 7 + (index * 6), { maxWidth: 182 });
      });

      // Add signature section
      const signatureY = doc.internal.pageSize.height - 40;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      
      doc.text('_______________________', 14, signatureY);
      doc.text('Course Instructor', 14, signatureY + 5);
      doc.text(`Date: ______________`, 14, signatureY + 10);

      doc.text('_______________________', 140, signatureY);
      doc.text('Head of Department', 140, signatureY + 5);
      doc.text(`Date: ______________`, 140, signatureY + 10);

      // Add footer
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.text(
          `Generated by LMS | Page ${i} of ${pageCount} | ${new Date().toLocaleDateString('en-IN')} ${new Date().toLocaleTimeString('en-IN')}`,
          105,
          doc.internal.pageSize.height - 10,
          { align: 'center' }
        );
      }

      const fileName = `PO_Attainment_Accreditation_${course?.courseCode || courseId}_${section || 'All'}_${academicYear || 'Current'}.pdf`;
      doc.save(fileName);

      setSnackbar({
        open: true,
        message: '✓ Successfully exported accreditation report!',
        severity: 'success',
      });
    } catch (err) {
      console.error('Error exporting to PDF:', err);
      setSnackbar({
        open: true,
        message: '✗ Failed to export PDF',
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

  const chartData = getChartData();

  return (
    <Box sx={{ p: 3 }}>
      <Paper elevation={3} sx={{ p: 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" gutterBottom>
              <SchoolIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              PO Attainment Report
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
            <Tooltip title="Calculate PO Attainment">
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
            <Tooltip title="Export Accreditation Report (PDF)">
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
            bgcolor: '#e8f5e9', 
            borderRadius: 1,
            border: '1px solid #4caf50',
          }}
        >
          <Typography variant="body2" color="text.secondary">
            <strong>Total Program Outcomes:</strong> {attainmentData.length}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            💡 <strong>Attainment Levels:</strong> Level 0 (&lt;1.5) | Level 1 (1.5-2.0) | Level 2 (2.0-2.5) | Level 3 (≥2.5)
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            🎓 PO attainment is calculated from Course Outcomes (COs) mapped to each Program Outcome through CO-PO mapping matrix.
          </Typography>
        </Box>

        {/* Content Area */}
        {attainmentData.length === 0 ? (
          <Alert severity="info">
            No PO attainment data available. Click "Calculate" to generate attainment report.
          </Alert>
        ) : (
          <Grid container spacing={3}>
            {/* Bar Chart */}
            <Grid item xs={12}>
              <Card elevation={2}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <BarChartIcon sx={{ mr: 1, color: '#1976d2' }} />
                    <Typography variant="h6">
                      PO Attainment Visualization
                    </Typography>
                  </Box>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart
                      data={chartData}
                      margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="po" 
                        angle={-45}
                        textAnchor="end"
                        height={100}
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis 
                        label={{ value: 'Weighted Score', angle: -90, position: 'insideLeft' }}
                        domain={[0, 3]}
                        ticks={[0, 0.5, 1, 1.5, 2, 2.5, 3]}
                      />
                      <RechartsTooltip 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <Paper sx={{ p: 1.5, bgcolor: 'rgba(255,255,255,0.95)' }}>
                                <Typography variant="subtitle2" fontWeight={700}>
                                  {data.po}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                  {data.description?.substring(0, 50)}...
                                </Typography>
                                <Typography variant="body2">
                                  <strong>Score:</strong> {data.score}
                                </Typography>
                                <Typography variant="body2">
                                  <strong>Level:</strong> {data.level}
                                </Typography>
                              </Paper>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend 
                        wrapperStyle={{ paddingTop: '20px' }}
                        content={() => (
                          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 2 }}>
                            {[0, 1, 2, 3].map((level) => (
                              <Box key={level} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Box 
                                  sx={{ 
                                    width: 16, 
                                    height: 16, 
                                    bgcolor: getBarColor(level),
                                    borderRadius: 0.5,
                                  }} 
                                />
                                <Typography variant="caption">Level {level}</Typography>
                              </Box>
                            ))}
                          </Box>
                        )}
                      />
                      <Bar dataKey="score" radius={[8, 8, 0, 0]}>
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={getBarColor(entry.level)} />
                        ))}
                        <LabelList dataKey="score" position="top" fontSize={11} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Grid>

            {/* PO Attainment Table */}
            <Grid item xs={12}>
              <Card elevation={2}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                    <AssessmentIcon sx={{ mr: 1, color: '#1976d2' }} />
                    Program Outcome Attainment Details
                  </Typography>
                  <TableContainer>
                    <Table sx={{ minWidth: 650 }} aria-label="PO attainment table">
                      <TableHead>
                        <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                          <TableCell sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
                            Program Outcome
                          </TableCell>
                          <TableCell sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
                            Description
                          </TableCell>
                          <TableCell align="center" sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
                            Weighted Score
                          </TableCell>
                          <TableCell align="center" sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
                            Attainment Level
                          </TableCell>
                          <TableCell align="center" sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
                            Contributing COs
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {attainmentData.map((item, index) => {
                          const level = item.attainmentLevel !== undefined 
                            ? item.attainmentLevel 
                            : getAttainmentLevel(item.weightedScore || 0);
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
                                  {item.programOutcome?.po_code || 'N/A'}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" color="text.secondary">
                                  {item.programOutcome?.description || 'N/A'}
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
                                  {item.weightedScore?.toFixed(2) || '0.00'}
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
                                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', justifyContent: 'center' }}>
                                  {item.contributingCOs && item.contributingCOs.length > 0 ? (
                                    item.contributingCOs.map((co, idx) => (
                                      <Chip
                                        key={idx}
                                        label={co}
                                        size="small"
                                        sx={{
                                          bgcolor: '#e3f2fd',
                                          color: '#1976d2',
                                          fontSize: '0.75rem',
                                          height: 22,
                                        }}
                                      />
                                    ))
                                  ) : (
                                    <Typography variant="caption" color="text.secondary">
                                      None
                                    </Typography>
                                  )}
                                </Box>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Grid>

            {/* Summary Statistics */}
            <Grid item xs={12}>
              <Card elevation={2} sx={{ bgcolor: '#f5f5f5' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Attainment Summary
                  </Typography>
                  <Grid container spacing={2}>
                    {[0, 1, 2, 3].map((level) => {
                      const count = attainmentData.filter(
                        (item) => (item.attainmentLevel !== undefined ? item.attainmentLevel : getAttainmentLevel(item.weightedScore || 0)) === level
                      ).length;
                      const percentage = attainmentData.length > 0 ? ((count / attainmentData.length) * 100).toFixed(1) : '0.0';
                      const badge = getAttainmentBadge(level);

                      return (
                        <Grid item xs={12} sm={6} md={3} key={level}>
                          <Card sx={{ bgcolor: badge.bg, border: `2px solid ${badge.text}` }}>
                            <CardContent sx={{ textAlign: 'center' }}>
                              <Typography variant="h6" sx={{ color: badge.text, fontWeight: 700 }}>
                                {badge.label}
                              </Typography>
                              <Typography variant="h4" sx={{ color: badge.text, fontWeight: 700, my: 1 }}>
                                {count}
                              </Typography>
                              <Typography variant="body2" sx={{ color: badge.text }}>
                                {percentage}% of POs
                              </Typography>
                            </CardContent>
                          </Card>
                        </Grid>
                      );
                    })}
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
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

export default POAttainmentSheet;
