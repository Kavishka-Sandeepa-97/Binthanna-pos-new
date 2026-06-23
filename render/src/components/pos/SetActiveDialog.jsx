import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Alert,
} from '@mui/material';
import { Restaurant, Person } from '@mui/icons-material';

const SetActiveDialog = ({ open, onClose, onSave, initialCustomerName = '', initialTableNumber = '' }) => {
  const [customerName, setCustomerName] = useState('');
  const [tableNumber, setTableNumber] = useState('');
  const [error, setError] = useState('');

  // Prefill when dialog opens
  React.useEffect(() => {
    if (open) {
      setCustomerName(String(initialCustomerName || ''));
      setTableNumber(String(initialTableNumber || ''));
      setError('');
    }
  }, [open, initialCustomerName, initialTableNumber]);

  const handleSave = () => {
    // Validate: at least one must be filled
    if (!customerName.trim() && !tableNumber.trim()) {
      setError('Please enter a Customer Name or Table Number');
      return;
    }

    setError('');
    onSave({
      customerName: customerName.trim(),
      tableNumber: tableNumber.trim(),
    });
  };

  const handleClose = () => {
    setError('');
    setCustomerName('');
    setTableNumber('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Set Order as Active</DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {error && (
            <Alert severity="error" onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          <TextField
            label="Customer Name"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            fullWidth
            InputProps={{
              startAdornment: <Person sx={{ mr: 1, color: 'action.active' }} />,
            }}
            placeholder="e.g., John Doe"
          />

          <TextField
            label="Table Number"
            value={tableNumber}
            onChange={(e) => setTableNumber(e.target.value)}
            fullWidth
            InputProps={{
              startAdornment: <Restaurant sx={{ mr: 1, color: 'action.active' }} />,
            }}
            placeholder="e.g., T-12, VIP 1"
          />

          <Alert severity="info" sx={{ mt: 1 }}>
            Provide at least Customer Name or Table Number to save the order as active.
          </Alert>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} color="inherit">
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          sx={{
            background: 'linear-gradient(45deg, #667eea, #764ba2)',
            '&:hover': {
              background: 'linear-gradient(45deg, #5568d3, #6a3f8f)',
            },
          }}
        >
          Save as Active
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SetActiveDialog;
