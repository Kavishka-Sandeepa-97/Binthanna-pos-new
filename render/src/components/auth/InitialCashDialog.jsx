import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  CircularProgress,
} from '@mui/material';
import { AttachMoney } from '@mui/icons-material';
import { openCashierShift } from '../../store/slices/cashierShiftSlice';
import { setActiveShift } from '../../store/slices/authSlice';
import { toast } from 'react-toastify';

const InitialCashDialog = ({ open, onClose }) => {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const { loading } = useSelector((state) => state.cashierShift);

  const [initialCash, setInitialCash] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();

    const cashAmount = parseFloat(initialCash);
    if (isNaN(cashAmount) || cashAmount < 0) {
      setError('Please enter a valid initial cash amount');
      return;
    }

    try {
      const result = await dispatch(openCashierShift({
        user_id: user.id,
        initial_cash_onhand: cashAmount,
        description: description.trim() || 'Initial cash entry',
      }));

      if (result.type === 'cashierShift/open/fulfilled') {
        dispatch(setActiveShift(result.payload));
        toast.success('Cashier shift opened successfully!');
        onClose();
      } else {
        setError('Failed to open cashier shift. Please try again.');
      }
    } catch (error) {
      console.error('Error opening shift:', error);
      setError('Failed to open cashier shift. Please try again.');
    }
  };

  const handleSkip = () => {
    // Allow user to skip for now, but they won't be able to do transactions
    toast.warning('You must open a cashier shift to process orders and transactions.');
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={() => {}} // Prevent closing by clicking outside
      maxWidth="sm"
      fullWidth
      disableEscapeKeyDown
    >
      <DialogTitle sx={{ textAlign: 'center', pb: 1 }}>
        <Box display="flex" alignItems="center" justifyContent="center" mb={1}>
          <AttachMoney sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="h6" component="span">
            Open Cashier Shift
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary">
          Please enter your initial cash amount to start your shift
        </Typography>
      </DialogTitle>

      <form onSubmit={handleSubmit}>
        <DialogContent>
          <Box sx={{ mb: 3 }}>
            <TextField
              fullWidth
              label="Initial Cash Amount"
              type="number"
              value={initialCash}
              onChange={(e) => {
                setInitialCash(e.target.value);
                setError('');
              }}
              InputProps={{
                startAdornment: <Typography sx={{ mr: 1 }}>$</Typography>,
              }}
              inputProps={{
                min: 0,
                step: 0.01,
              }}
              required
              autoFocus
              sx={{ mb: 2 }}
            />

            <TextField
              fullWidth
              label="Description (Optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Starting cash for the day"
              multiline
              rows={2}
            />
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>Important:</strong> You must open a cashier shift to:
            </Typography>
            <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
              <li>Process customer orders</li>
              <li>Add in/out transactions</li>
              <li>Track your cash balance</li>
            </ul>
          </Alert>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button
            onClick={handleSkip}
            color="inherit"
            disabled={loading}
          >
            Skip for Now
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={loading || !initialCash.trim()}
            startIcon={loading ? <CircularProgress size={16} /> : null}
          >
            {loading ? 'Opening Shift...' : 'Open Shift'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default InitialCashDialog;