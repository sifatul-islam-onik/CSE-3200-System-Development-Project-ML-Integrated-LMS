import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DataGrid } from '@mui/x-data-grid';
import { Box, Alert, Chip } from '@mui/material';
import { Save as SaveIcon, Warning as WarningIcon } from '@mui/icons-material';
import PropTypes from 'prop-types';

/**
 * ExcelGrid - A reusable Excel-like data grid component for mark entry
 * 
 * @param {Array} rows - Array of row objects with id and data fields
 * @param {Array} columns - Array of column definitions
 * @param {Function} onCellEditCommit - Callback when cell is edited (field, value, row)
 * @param {Object} validation - Validation rules { maxMarks: {field: maxValue} }
 * @param {Boolean} loading - Loading state
 * @param {String} height - Grid height (default: 600px)
 * @param {Boolean} checkboxSelection - Enable row selection (default: false)
 * @param {Function} onSelectionChange - Callback for row selection changes
 */
const ExcelGrid = ({
  rows,
  columns,
  onCellEditCommit,
  validation = {},
  loading = false,
  height = '600px',
  checkboxSelection = false,
  onSelectionChange,
  enableValidation = true,
  autoHeight = false,
  hasUnsavedChanges = false,
  isSaving = false,
}) => {
  const [gridRows, setGridRows] = useState(rows);
  const [validationError, setValidationError] = useState(null);
  const [copiedCell, setCopiedCell] = useState(null);
  const [selectedCell, setSelectedCell] = useState(null);
  const gridRef = useRef(null);

  // Update rows when prop changes
  useEffect(() => {
    setGridRows(rows);
  }, [rows]);

  /**
   * Handle keyboard navigation and copy-paste
   */
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Copy: Ctrl+C or Cmd+C
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        if (selectedCell) {
          e.preventDefault();
          setCopiedCell(selectedCell);
          // Visual feedback
          const notification = document.createElement('div');
          notification.textContent = '✓ Copied';
          notification.style.cssText = 'position:fixed;top:20px;right:20px;background:#4caf50;color:white;padding:8px 16px;border-radius:4px;z-index:9999;font-size:14px;';
          document.body.appendChild(notification);
          setTimeout(() => notification.remove(), 1500);
        }
      }

      // Paste: Ctrl+V or Cmd+V
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        if (copiedCell && selectedCell && selectedCell.field === copiedCell.field) {
          e.preventDefault();
          handleCellEditCommit({
            id: selectedCell.id,
            field: selectedCell.field,
            value: copiedCell.value,
          });
          // Visual feedback
          const notification = document.createElement('div');
          notification.textContent = '✓ Pasted';
          notification.style.cssText = 'position:fixed;top:20px;right:20px;background:#2196f3;color:white;padding:8px 16px;border-radius:4px;z-index:9999;font-size:14px;';
          document.body.appendChild(notification);
          setTimeout(() => notification.remove(), 1500);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedCell, copiedCell]);

  /**
   * Warn about unsaved changes before leaving
   */
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  /**
   * Handle cell click for keyboard navigation
   */
  const handleCellClick = useCallback((params) => {
    if (params.field !== '__check__' && params.field !== 'actions') {
      setSelectedCell({
        id: params.id,
        field: params.field,
        value: params.value,
      });
    }
  }, []);

  /**
   * Validate cell value against rules
   */
  const validateCell = (field, value, row) => {
    if (!enableValidation) return { valid: true };

    // Check for numeric validation
    if (value !== '' && value !== null && value !== undefined) {
      const numValue = Number(value);
      
      // Check if it's a valid number
      if (isNaN(numValue)) {
        return {
          valid: false,
          message: `Invalid number for ${field}`,
        };
      }

      // Check for negative values
      if (numValue < 0) {
        return {
          valid: false,
          message: `${field} cannot be negative`,
        };
      }

      // Check max marks validation
      if (validation.maxMarks && validation.maxMarks[field] !== undefined) {
        const maxValue = validation.maxMarks[field];
        if (numValue > maxValue) {
          return {
            valid: false,
            message: `${field} cannot exceed ${maxValue} marks`,
          };
        }
      }

      // Custom validation function
      if (validation.customValidator) {
        const customResult = validation.customValidator(field, numValue, row);
        if (!customResult.valid) {
          return customResult;
        }
      }
    }

    return { valid: true };
  };

  /**
   * Handle cell edit commit
   */
  const handleCellEditCommit = (params) => {
    const { id, field, value } = params;
    const row = gridRows.find((r) => r.id === id);

    if (!row) return;

    // Validate the new value
    const validationResult = validateCell(field, value, row);

    if (!validationResult.valid) {
      setValidationError(validationResult.message);
      // Clear error after 3 seconds
      setTimeout(() => setValidationError(null), 3000);
      return;
    }

    // Clear any previous errors
    setValidationError(null);

    // Update local state
    const updatedRows = gridRows.map((r) =>
      r.id === id ? { ...r, [field]: value } : r
    );
    setGridRows(updatedRows);

    // Call parent callback
    if (onCellEditCommit) {
      onCellEditCommit({
        field,
        value,
        row: updatedRows.find((r) => r.id === id),
        allRows: updatedRows,
      });
    }
  };

  /**
   * Handle selection change
   */
  const handleSelectionChange = (newSelection) => {
    if (onSelectionChange) {
      const selectedRows = gridRows.filter((row) =>
        newSelection.includes(row.id)
      );
      onSelectionChange(selectedRows, newSelection);
    }
  };

  /**
   * Process columns to add editable configuration and sticky columns
   */
  const processedColumns = columns.map((col) => ({
    ...col,
    editable: col.editable !== undefined ? col.editable : true,
    type: col.type || 'number',
    headerAlign: col.headerAlign || 'center',
    align: col.align || 'center',
    flex: col.flex || 1,
    minWidth: col.minWidth || 100,
    // Add sticky styling for pinned columns
    cellClassName: col.pinned ? 'sticky-column' : '',
    headerClassName: col.pinned ? 'sticky-header' : '',
    // Custom cell renderer for numeric cells
    renderCell: col.renderCell
      ? col.renderCell
      : (params) => {
          if (col.type === 'number' && params.value !== null && params.value !== undefined && params.value !== '') {
            return (
              <Box
                sx={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 500,
                }}
              >
                {params.value}
              </Box>
            );
          }
          return params.value !== null && params.value !== undefined ? params.value : '-';
        },
    // Value parser for numeric fields
    valueParser: col.valueParser
      ? col.valueParser
      : (value) => {
          if (col.type === 'number') {
            if (value === '' || value === null || value === undefined) {
              return null;
            }
            const parsed = Number(value);
            return isNaN(parsed) ? null : parsed;
          }
          return value;
        },
  }));

  return (
    <Box sx={{ width: '100%', height: autoHeight ? 'auto' : height, position: 'relative' }}>
      {/* Autosave Indicator */}
      {(hasUnsavedChanges || isSaving) && (
        <Box
          sx={{
            position: 'absolute',
            top: -40,
            right: 0,
            zIndex: 1000,
            display: 'flex',
            gap: 1,
          }}
        >
          {isSaving && (
            <Chip
              icon={<SaveIcon sx={{ fontSize: 16 }} />}
              label="Saving..."
              color="primary"
              size="small"
              sx={{ fontWeight: 600 }}
            />
          )}
          {hasUnsavedChanges && !isSaving && (
            <Chip
              icon={<WarningIcon sx={{ fontSize: 16 }} />}
              label="Unsaved Changes"
              color="warning"
              size="small"
              sx={{ fontWeight: 600 }}
            />
          )}
        </Box>
      )}
      {validationError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setValidationError(null)}>
          {validationError}
        </Alert>
      )}
      
      <DataGrid
        ref={gridRef}
        rows={gridRows}
        columns={processedColumns}
        loading={loading}
        checkboxSelection={checkboxSelection}
        onSelectionModelChange={handleSelectionChange}
        onCellEditCommit={handleCellEditCommit}
        onCellClick={handleCellClick}
        disableSelectionOnClick
        autoHeight={autoHeight}
        density="comfortable"
        sx={{
          '& .MuiDataGrid-cell': {
            borderRight: '1px solid #e0e0e0',
          },
          '& .MuiDataGrid-columnHeader': {
            backgroundColor: '#f5f5f5',
            fontWeight: 600,
            borderRight: '1px solid #e0e0e0',
          },
          '& .MuiDataGrid-cell--editable': {
            backgroundColor: '#fff',
            '&:hover': {
              backgroundColor: '#f0f8ff',
            },
          },
          '& .MuiDataGrid-cell:focus': {
            outline: '2px solid #1976d2',
          },
          '& .MuiDataGrid-row:hover': {
            backgroundColor: '#fafafa',
          },
          // Sticky columns styling for Roll No and Name
          '& .sticky-column': {
            position: 'sticky !important',
            backgroundColor: '#fff',
            zIndex: 100,
            borderRight: '2px solid #1976d2 !important',
            '&:hover': {
              backgroundColor: '#f0f8ff',
            },
          },
          '& .sticky-header': {
            position: 'sticky !important',
            backgroundColor: '#e3f2fd !important',
            zIndex: 101,
            borderRight: '2px solid #1976d2 !important',
            fontWeight: 700,
          },
          '& .MuiDataGrid-row .MuiDataGrid-cell:first-of-type': {
            left: '0 !important',
          },
          '& .MuiDataGrid-row .MuiDataGrid-cell:nth-of-type(2)': {
            left: '120px !important',
          },
          '& .MuiDataGrid-columnHeaders .MuiDataGrid-columnHeader:first-of-type': {
            left: '0 !important',
          },
          '& .MuiDataGrid-columnHeaders .MuiDataGrid-columnHeader:nth-of-type(2)': {
            left: '120px !important',
          },
          border: '1px solid #e0e0e0',
          borderRadius: 1,
        }}
        hideFooter={rows.length <= 100}
        pageSize={100}
        rowsPerPageOptions={[25, 50, 100]}
        experimentalFeatures={{ newEditingApi: true }}
        getCellClassName={(params) => {
          // Highlight cells with validation errors
          if (params.field !== 'id' && enableValidation) {
            const validationResult = validateCell(params.field, params.value, params.row);
            if (!validationResult.valid) {
              return 'cell-error';
            }
          }
          return '';
        }}
      />
    </Box>
  );
};

ExcelGrid.propTypes = {
  rows: PropTypes.arrayOf(PropTypes.object).isRequired,
  columns: PropTypes.arrayOf(
    PropTypes.shape({
      field: PropTypes.string.isRequired,
      headerName: PropTypes.string.isRequired,
      width: PropTypes.number,
      editable: PropTypes.bool,
      type: PropTypes.string,
      renderCell: PropTypes.func,
      valueParser: PropTypes.func,
      pinned: PropTypes.string,
    })
  ).isRequired,
  onCellEditCommit: PropTypes.func,
  validation: PropTypes.shape({
    maxMarks: PropTypes.object,
    customValidator: PropTypes.func,
  }),
  loading: PropTypes.bool,
  height: PropTypes.string,
  checkboxSelection: PropTypes.bool,
  onSelectionChange: PropTypes.func,
  enableValidation: PropTypes.bool,
  autoHeight: PropTypes.bool,
  hasUnsavedChanges: PropTypes.bool,
  isSaving: PropTypes.bool,
};

export default ExcelGrid;
