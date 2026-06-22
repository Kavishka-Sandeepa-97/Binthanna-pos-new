import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  RadioGroup,
  FormControlLabel,
  Radio,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Box,
  Chip,
  Divider,
  Alert,
} from '@mui/material';
import { Inventory2, CalendarMonth, LocalOffer } from '@mui/icons-material';

const REASONS = [
  { value: 'expiry_soon', label: 'Expiry Soon' },
  { value: 'old_batch', label: 'Old Batch' },
  { value: 'promotion', label: 'Promotion' },
  { value: 'customer_request', label: 'Customer Request' },
  { value: 'other', label: 'Other' },
];

/**
 * BatchSelectionDialog
 *
 * Shown when a scanned / clicked item has batches with different sell prices.
 * Cashier selects which batch price to charge, with an optional reason.
 */
const BatchSelectionDialog = ({ open, onClose, onConfirm, itemName, variantName, batches = [] }) => {
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [reason, setReason] = useState('');

  // Pre-select first (FIFO) batch whenever dialog opens
  useEffect(() => {
    if (open && batches.length > 0) {
      setSelectedBatchId(batches[0].id);
      setReason('');
    }
  }, [open, batches]);

  const handleConfirm = () => {
    const selectedBatch = batches.find((b) => b.id === selectedBatchId);
    if (!selectedBatch) return;
    onConfirm(selectedBatch, reason || null);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return null;
    try {
      return new Date(dateStr).toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const isExpiringSoon = (dateStr) => {
    if (!dateStr) return false;
    const diff = new Date(dateStr) - new Date();
    return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000; // within 30 days
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 2, boxShadow: '0 10px 40px rgba(0,0,0,0.2)' } }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <LocalOffer sx={{ color: 'primary.main' }} />
          <Box>
            <Typography variant="h6" fontWeight="bold">
              Multiple Batch Prices
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {itemName}{variantName ? ` — ${variantName}` : ''}
            </Typography>
          </Box>
        </Box>
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ pt: 2 }}>
        <Alert severity="info" sx={{ mb: 2 }}>
          This item has stock from multiple batches with different prices. Select which price to charge the customer.
        </Alert>

        <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
          Available Batches:
        </Typography>

        <RadioGroup
          value={selectedBatchId}
          onChange={(e) => setSelectedBatchId(Number(e.target.value))}
        >
          {batches.map((batch, idx) => {
            const expiringSoon = isExpiringSoon(batch.expire_date);
            const isSelected = selectedBatchId === batch.id;
            return (
              <Box
                key={batch.id}
                sx={{
                  border: '1px solid',
                  borderColor: isSelected ? 'primary.main' : 'divider',
                  borderRadius: 1.5,
                  mb: 1,
                  px: 1.5,
                  py: 1,
                  bgcolor: isSelected ? 'primary.50' : 'background.paper',
                  transition: 'all 0.15s',
                  cursor: 'pointer',
                }}
                onClick={() => setSelectedBatchId(batch.id)}
              >
                <FormControlLabel
                  value={batch.id}
                  control={<Radio size="small" />}
                  sx={{ m: 0, width: '100%' }}
                  label={
                    <Box sx={{ ml: 0.5, width: '100%' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Typography variant="h6" fontWeight="bold" color="success.dark">
                          Rs. {parseFloat(batch.sell_price).toFixed(2)}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Inventory2 sx={{ fontSize: '0.9rem', color: 'text.secondary' }} />
                          <Typography variant="body2" color="text.secondary">
                            Qty: {batch.remaining_qty}
                          </Typography>
                        </Box>
                        {idx === 0 && (
                          <Chip label="FIFO (oldest)" size="small" color="primary" variant="outlined" />
                        )}
                        {expiringSoon && (
                          <Chip label="Expiring Soon" size="small" color="warning" />
                        )}
                      </Box>
                      {batch.expire_date && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.3 }}>
                          <CalendarMonth sx={{ fontSize: '0.8rem', color: expiringSoon ? 'warning.main' : 'text.disabled' }} />
                          <Typography variant="caption" color={expiringSoon ? 'warning.main' : 'text.secondary'}>
                            Expires: {formatDate(batch.expire_date)}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  }
                />
              </Box>
            );
          })}
        </RadioGroup>

        <FormControl fullWidth sx={{ mt: 2 }} size="small">
          <InputLabel>Reason for price selection (optional)</InputLabel>
          <Select
            value={reason}
            label="Reason for price selection (optional)"
            onChange={(e) => setReason(e.target.value)}
          >
            <MenuItem value=""><em>None</em></MenuItem>
            {REASONS.map((r) => (
              <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </DialogContent>

      <Divider />

      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button onClick={onClose} variant="outlined" color="inherit">
          Cancel
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          disabled={!selectedBatchId}
          sx={{ minWidth: 130 }}
        >
          Add to Order
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default BatchSelectionDialog;
