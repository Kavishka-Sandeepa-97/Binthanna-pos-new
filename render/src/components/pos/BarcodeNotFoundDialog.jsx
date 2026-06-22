import React, { useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  Alert,
} from '@mui/material';
import { ErrorOutline } from '@mui/icons-material';

/**
 * BarcodeNotFoundDialog
 * 
 * Shows a "Product not found" message when a scanned barcode doesn't match any item
 * Auto-closes after 0.5 seconds
 */

const BarcodeNotFoundDialog = ({ open, barcode, onClose }) => {
  useEffect(() => {
    if (open) {
      // Auto-close after 500ms (0.5 seconds)
      const timer = setTimeout(() => {
        onClose();
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [open, onClose]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      disableEscapeKeyDown
      PaperProps={{
        sx: {
          borderRadius: 2,
          boxShadow: '0 10px 40px rgba(244, 67, 54, 0.3)',
        }
      }}
    >
      <DialogTitle sx={{ pb: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ErrorOutline sx={{ color: '#f44336', fontSize: '1.5rem' }} />
          <Typography variant="h6" fontWeight="bold">
            Product Not Found
          </Typography>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          No product found with this barcode
        </Alert>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          <strong>Scanned Barcode:</strong>
        </Typography>
        <Typography
          variant="body1"
          sx={{
            p: 1.5,
            bgcolor: '#f5f5f5',
            borderRadius: 1,
            border: '1px dashed #ccc',
            fontFamily: 'monospace',
            fontSize: '1rem',
            wordBreak: 'break-all',
          }}
        >
          {barcode}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
          ⚠️ This dialog will close automatically in 0.5 seconds
        </Typography>
      </DialogContent>
    </Dialog>
  );
};

export default BarcodeNotFoundDialog;
