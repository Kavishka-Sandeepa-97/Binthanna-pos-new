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

const SetActiveDialog = ({ open, onClose, onSave, initialCustomerName = '' }) => {
  const [customerName, setCustomerName] = useState('');
  const [error, setError] = useState('');

  // When dialog opens, prefill with initial values (useful when editing a loaded active order)
  React.useEffect(() => {
    if (open) {
      setCustomerName(String(initialCustomerName || ''));
      setError('');
    }
  }, [open, initialCustomerName]);
  const handleSave = () => {
    // Validate: customer name must be filled
    if (!customerName.trim()) {
      setError('Please enter Customer Name');
      return;
    }

    setError('');
    onSave({
      customerName: customerName.trim(),
    });
    // Leave inputs as they are (caller clears if needed)
  };

  const handleClose = () => {
    setError('');
    setCustomerName('');
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

          <Alert severity="info" sx={{ mt: 1 }}>
            Customer Name is required
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
