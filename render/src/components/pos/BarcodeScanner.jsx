import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Alert,
  Card,
  CardContent,
  Chip,
  IconButton,
} from '@mui/material';
import {
  QrCodeScanner,
  Close,
  Add,
  Search,
} from '@mui/icons-material';
import { closeModal } from '../../store/slices/uiSlice';
import { searchByBarcode, clearBarcodeResult } from '../../store/slices/inventorySlice';
import { addItemToOrder } from '../../store/slices/orderSlice';

const BarcodeScanner = () => {
  const dispatch = useDispatch();
  const { modals } = useSelector((state) => state.ui);
  const { barcodeResult, loading, error } = useSelector((state) => state.inventory);

  const [barcode, setBarcode] = useState('');

  const handleClose = () => {
    dispatch(closeModal('barcode'));
    dispatch(clearBarcodeResult());
    setBarcode('');
  };

  const handleSearch = async () => {
    if (barcode.trim()) {
      dispatch(searchByBarcode(barcode.trim()));
    }
  };

  const handleAddToOrder = () => {
    if (barcodeResult) {
      dispatch(addItemToOrder({ itemVariant: barcodeResult, quantity: 1 }));
      handleClose();
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const formatPrice = (price) => {
    return `Rs. ${parseFloat(price).toFixed(2)}`;
  };

  const getStockStatus = (stock) => {
    if (stock <= 0) return { label: 'Out of Stock', color: 'error' };
    if (stock <= 10) return { label: 'Low Stock', color: 'warning' };
    return { label: 'In Stock', color: 'success' };
  };

  return (
    <Dialog
      open={modals.barcode.open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          minHeight: '400px',
        },
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <QrCodeScanner color="primary" />
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          Barcode Scanner
        </Typography>
        <IconButton onClick={handleClose}>
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Scan or enter the barcode to search for items
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
            <TextField
              fullWidth
              label="Barcode"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Scan or type barcode here..."
              autoFocus
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                },
              }}
            />
            <Button
              variant="contained"
              onClick={handleSearch}
              disabled={!barcode.trim() || loading}
              startIcon={<Search />}
              sx={{
                minWidth: 120,
                borderRadius: 2,
                background: 'linear-gradient(45deg, #4ECDC4, #44A08D)',
              }}
            >
              Search
            </Button>
          </Box>
        </Box>

        {/* Error Display */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Search Result */}
        {barcodeResult && (
          <Card
            sx={{
              border: '2px solid #4ECDC4',
              borderRadius: 3,
              background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
            }}
          >
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                <Box>
                  <Typography variant="h6" fontWeight="bold" gutterBottom>
                    {barcodeResult.itemName}
                  </Typography>
                  <Typography variant="body1" color="text.secondary" gutterBottom>
                    {barcodeResult.variantName}
                  </Typography>
                  <Chip
                    label={barcodeResult.categoryName}
                    color="primary"
                    size="small"
                    sx={{ mr: 1 }}
                  />
                  <Chip
                    label={getStockStatus(barcodeResult.totalStock).label}
                    color={getStockStatus(barcodeResult.totalStock).color}
                    size="small"
                  />
                </Box>
                
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="h5" fontWeight="bold" color="primary">
                    {formatPrice(barcodeResult.sellingPrice)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Stock: {barcodeResult.totalStock} units
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<Add />}
                  onClick={handleAddToOrder}
                  disabled={barcodeResult.totalStock <= 0}
                  sx={{
                    borderRadius: 2,
                    background: barcodeResult.totalStock > 0 
                      ? 'linear-gradient(45deg, #4ECDC4, #44A08D)'
                      : 'grey.300',
                    fontSize: '1.1rem',
                    fontWeight: 'bold',
                  }}
                >
                  Add to Order
                </Button>
              </Box>

              {barcodeResult.totalStock <= 0 && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  This item is currently out of stock and cannot be added to the order.
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        {/* Instructions */}
        {!barcodeResult && !error && (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '200px',
              color: 'text.secondary',
              textAlign: 'center',
            }}
          >
            <QrCodeScanner sx={{ fontSize: 80, mb: 2, opacity: 0.5 }} />
            <Typography variant="h6" gutterBottom>
              Ready to Scan
            </Typography>
            <Typography variant="body2">
              Position the barcode in front of your camera or type it manually
            </Typography>
            <Typography variant="caption" sx={{ mt: 1 }}>
              Tip: Most barcode scanners work like a keyboard - just scan and the code will appear in the field
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 3 }}>
        <Button onClick={handleClose} variant="outlined" sx={{ borderRadius: 2 }}>
          Close
        </Button>
        {barcodeResult && (
          <Button
            onClick={handleAddToOrder}
            variant="contained"
            disabled={barcodeResult.totalStock <= 0}
            sx={{
              borderRadius: 2,
              background: 'linear-gradient(45deg, #4ECDC4, #44A08D)',
            }}
          >
            Add to Order
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default BarcodeScanner;