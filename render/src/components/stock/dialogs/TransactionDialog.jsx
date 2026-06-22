import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Grid,
  Typography,
  Box,
  Alert,
  Autocomplete,
} from '@mui/material';
import { toast } from 'react-toastify';
import api from '../../../services/api';

const TransactionDialog = ({ open, type, data, onClose, onRefresh, products, suppliers, userId }) => {
  const [formData, setFormData] = useState({
    product_id: '',
    supplier_id: '',
    qty: '',
    price: '',
    description: '',
  });
  const [loading, setLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  useEffect(() => {
    if (open) {
      if (data) {
        // Edit mode - populate form with existing data
        setFormData({
          product_id: data.product_id,
          supplier_id: data.supplier_id || '',
          qty: String(data.qty),
          price: data.price ? String(data.price) : '',
          description: data.description || '',
        });
        const product = products.find(p => p.id === data.product_id);
        setSelectedProduct(product || null);
      } else {
        // Create mode - reset form
        setFormData({
          product_id: '',
          supplier_id: '',
          qty: '',
          price: '',
          description: '',
        });
        setSelectedProduct(null);
      }
    }
  }, [open, data, products]);

  const handleProductChange = (productId) => {
    const product = products.find(p => p.id === parseInt(productId));
    setSelectedProduct(product);
    setFormData({ ...formData, product_id: productId });
  };

  const handleSubmit = async () => {
    // Validate required fields
    if (!formData.product_id) {
      toast.error('Please select a product');
      return;
    }

    if (!formData.qty || parseFloat(formData.qty) <= 0) {
      toast.error('Quantity must be greater than 0');
      return;
    }

    // For IN transactions, price and supplier are required
    if (type === 'IN') {
      if (!formData.price || parseFloat(formData.price) <= 0) {
        toast.error('Price is required for IN transactions and must be greater than 0');
        return;
      }
      if (!formData.supplier_id) {
        toast.error('Supplier is required for IN transactions');
        return;
      }
    }

    // For OUT transactions, check if sufficient stock
    if (type === 'OUT' && selectedProduct) {
      if (parseFloat(formData.qty) > selectedProduct.current_qty) {
        toast.error(`Insufficient stock. Available: ${selectedProduct.current_qty} ${selectedProduct.unit_name}`);
        return;
      }
    }

    setLoading(true);
    try {
      const transactionData = {
        product_id: formData.product_id,
        supplier_id: type === 'IN' ? formData.supplier_id : null,
        type: type,
        qty: parseFloat(formData.qty),
        price: type === 'IN' ? parseFloat(formData.price) : null,
        description: formData.description,
        user_id: userId || 1,
      };

      if (data) {
        // Update existing transaction
        await api.stock.transactions.update(data.id, transactionData);
        toast.success(`Transaction updated successfully`);
      } else {
        // Create new transaction
        await api.stock.transactions.create(transactionData);
        toast.success(`${type} transaction created successfully`);
      }
      
      setFormData({
        product_id: '',
        supplier_id: '',
        qty: '',
        price: '',
        description: '',
      });
      onClose();
      onRefresh();
    } catch (error) {
      toast.error(error.message || 'Transaction failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={2}>
          <Box
            sx={{
              px: 2,
              py: 0.5,
              borderRadius: 1,
              background: type === 'IN' 
                ? 'linear-gradient(45deg, #4ECDC4, #44A08D)' 
                : 'linear-gradient(45deg, #FF6B6B, #EE5A52)',
              color: 'white',
              fontWeight: 'bold',
            }}
          >
            {type}
          </Box>
          <Typography variant="h6">
            {data ? 'Edit' : 'Create'} Stock Transaction
          </Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid item xs={12}>
            <Autocomplete
              options={products}
              getOptionLabel={(option) => 
                `${option.name} (${option.category_name}) - Current: ${option.current_qty} ${option.unit_name}`
              }
              value={selectedProduct}
              onChange={(event, newValue) => {
                if (newValue) {
                  handleProductChange(newValue.id);
                } else {
                  setSelectedProduct(null);
                  setFormData({ ...formData, product_id: '' });
                }
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Product"
                  required
                  placeholder="Search product..."
                />
              )}
              renderOption={(props, option) => (
                <li {...props} key={option.id}>
                  <Box>
                    <Typography variant="body1">
                      {option.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {option.category_name} - Stock: {option.current_qty} {option.unit_name}
                    </Typography>
                  </Box>
                </li>
              )}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              noOptionsText="No products found"
            />
          </Grid>

          {selectedProduct && type === 'OUT' && (
            <Grid item xs={12}>
              <Alert severity="info">
                Available Stock: {selectedProduct.current_qty} {selectedProduct.unit_name}
              </Alert>
            </Grid>
          )}

          {type === 'IN' && (
            <Grid item xs={12}>
              <Autocomplete
                options={suppliers}
                getOptionLabel={(option) => option.name}
                value={suppliers.find(s => s.id === formData.supplier_id) || null}
                onChange={(event, newValue) => {
                  setFormData({ 
                    ...formData, 
                    supplier_id: newValue ? newValue.id : '' 
                  });
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Supplier"
                    required
                    placeholder="Search supplier..."
                  />
                )}
                renderOption={(props, option) => (
                  <li {...props} key={option.id}>
                    <Box>
                      <Typography variant="body1">{option.name}</Typography>
                      {option.description && (
                        <Typography variant="caption" color="text.secondary">
                          {option.description}
                        </Typography>
                      )}
                    </Box>
                  </li>
                )}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                noOptionsText="No suppliers found"
              />
            </Grid>
          )}

          <Grid item xs={12} sm={type === 'IN' ? 6 : 12}>
            <TextField
              fullWidth
              label="Quantity"
              type="number"
              value={formData.qty}
              onChange={(e) => setFormData({ ...formData, qty: e.target.value })}
              required
              inputProps={{ min: 0, step: 0.01 }}
              helperText={selectedProduct ? `Unit: ${selectedProduct.unit_name}` : ''}
            />
          </Grid>

          {type === 'IN' && (
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Total Price"
                type="number"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                required
                inputProps={{ min: 0, step: 0.01 }}
                helperText="Total price for this quantity"
              />
            </Grid>
          )}

          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              multiline
              rows={3}
              placeholder={type === 'IN' ? 'e.g., Purchase from supplier' : 'e.g., Used in kitchen'}
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading}
          sx={{
            background: type === 'IN' 
              ? 'linear-gradient(45deg, #4ECDC4, #44A08D)' 
              : 'linear-gradient(45deg, #FF6B6B, #EE5A52)',
          }}
        >
          {loading ? 'Processing...' : data ? 'Update Transaction' : `Create ${type} Transaction`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TransactionDialog;
