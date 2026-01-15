import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Chip,
  Divider,
} from '@mui/material';
import {
  Keyboard as KeyboardIcon,
  ContentCopy as CopyIcon,
  ContentPaste as PasteIcon,
  Save as SaveIcon,
  ArrowUpward as ArrowUpIcon,
  ArrowDownward as ArrowDownIcon,
  ArrowBack as ArrowLeftIcon,
  ArrowForward as ArrowRightIcon,
} from '@mui/icons-material';

const KeyboardShortcutsHelp = ({ open, onClose }) => {
  const shortcuts = [
    {
      category: 'Navigation',
      items: [
        { keys: ['↑', '↓', '←', '→'], description: 'Navigate between cells', icon: <ArrowUpIcon /> },
        { keys: ['Tab'], description: 'Move to next cell', icon: <ArrowRightIcon /> },
        { keys: ['Enter'], description: 'Confirm edit and move down', icon: <ArrowDownIcon /> },
        { keys: ['Esc'], description: 'Cancel edit', icon: null },
      ],
    },
    {
      category: 'Copy & Paste',
      items: [
        { keys: ['Ctrl', 'C'], description: 'Copy selected cell value', icon: <CopyIcon /> },
        { keys: ['Ctrl', 'V'], description: 'Paste to selected cell (same column)', icon: <PasteIcon /> },
        { keys: ['Cmd', 'C'], description: 'Copy (Mac)', icon: <CopyIcon /> },
        { keys: ['Cmd', 'V'], description: 'Paste (Mac)', icon: <PasteIcon /> },
      ],
    },
    {
      category: 'Editing',
      items: [
        { keys: ['Double-click'], description: 'Start editing cell', icon: null },
        { keys: ['Type'], description: 'Start editing and replace value', icon: null },
        { keys: ['Delete'], description: 'Clear cell value', icon: null },
      ],
    },
    {
      category: 'Saving',
      items: [
        { keys: ['Ctrl', 'S'], description: 'Save changes (if implemented)', icon: <SaveIcon /> },
      ],
    },
  ];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: '#f5f5f5' }}>
        <KeyboardIcon color="primary" />
        <Typography variant="h6">Keyboard Shortcuts</Typography>
      </DialogTitle>
      <DialogContent sx={{ mt: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Use these keyboard shortcuts to work faster with the mark entry system.
        </Typography>

        {shortcuts.map((section, idx) => (
          <Box key={idx} sx={{ mb: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2, color: '#1976d2' }}>
              {section.category}
            </Typography>
            {section.items.map((item, itemIdx) => (
              <Box
                key={itemIdx}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  py: 1.5,
                  px: 2,
                  bgcolor: itemIdx % 2 === 0 ? '#fafafa' : '#fff',
                  borderRadius: 1,
                  mb: 0.5,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                  {item.icon && (
                    <Box sx={{ color: '#666', display: 'flex', alignItems: 'center' }}>
                      {item.icon}
                    </Box>
                  )}
                  <Typography variant="body2">{item.description}</Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  {item.keys.map((key, keyIdx) => (
                    <React.Fragment key={keyIdx}>
                      <Chip
                        label={key}
                        size="small"
                        sx={{
                          bgcolor: '#e3f2fd',
                          color: '#1976d2',
                          fontWeight: 600,
                          fontSize: '0.8rem',
                          fontFamily: 'monospace',
                          minWidth: key.length > 3 ? '80px' : '40px',
                        }}
                      />
                      {keyIdx < item.keys.length - 1 && (
                        <Typography
                          variant="caption"
                          sx={{ display: 'flex', alignItems: 'center', px: 0.5, color: '#999' }}
                        >
                          +
                        </Typography>
                      )}
                    </React.Fragment>
                  ))}
                </Box>
              </Box>
            ))}
            {idx < shortcuts.length - 1 && <Divider sx={{ mt: 2 }} />}
          </Box>
        ))}

        <Box sx={{ mt: 3, p: 2, bgcolor: '#fff3e0', borderRadius: 1, border: '1px solid #ffb74d' }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: '#e65100' }}>
            💡 Excel-like Features:
          </Typography>
          <Typography variant="body2" color="text.secondary">
            • <strong>Sticky Columns:</strong> Roll No and Name columns stay visible when scrolling<br />
            • <strong>Autosave Indicator:</strong> See real-time saving status at the top-right<br />
            • <strong>Unsaved Changes Warning:</strong> Get notified before leaving with unsaved changes<br />
            • <strong>Copy-Paste:</strong> Works only within the same column to maintain data integrity
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} variant="contained">
          Got it!
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default KeyboardShortcutsHelp;
