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
  Autocomplete,
} from '@mui/material';
import { toast } from 'react-toastify';
import api from '../../../services/api';

const ProductDialog = ({ open, data, onClose, onRefresh, categories, units }) => {
  const [formData, setFormData] = useState({
    name: '',
    category_id: '',
    unit_id: '',
    current_qty: 0,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (data) {
      setFormData({
        name: data.name,
        category_id: data.category_id,
        unit_id: data.unit_id,
        current_qty: data.current_qty || 0,
      });
    } else {
      setFormData({
        name: '',
        category_id: categories.length > 0 ? categories[0].id : '',
        unit_id: units.length > 0 ? units[0].id : '',
        current_qty: 0,
      });
    }
  }, [data, categories, units]);

  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.category_id || !formData.unit_id) {
      toast.error('Product name, category, and unit are required');
      return;
    }

    setLoading(true);
    try {
      if (data) {
        await api.stock.products.update(data.id, formData);
        toast.success('Product updated successfully');
      } else {
        await api.stock.products.create(formData);
        toast.success('Product created successfully');
      }
      setFormData({
        name: '',
        category_id: '',
        unit_id: '',
        current_qty: 0,
      });
      onClose();
      onRefresh();
    } catch (error) {
      toast.error(error.message || 'Operation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{data ? 'Edit Product' : 'Add Product'}</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Product Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Autocomplete
              options={categories}
              getOptionLabel={(option) => option.name}
              value={categories.find(c => c.id === formData.category_id) || null}
              onChange={(event, newValue) => {
                setFormData({ 
                  ...formData, 
                  category_id: newValue ? newValue.id : '' 
                });
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Category"
                  required
                  placeholder="Search category..."
                />
              )}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              noOptionsText="No categories found"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Autocomplete
              options={units}
              getOptionLabel={(option) => option.name}
              value={units.find(u => u.id === formData.unit_id) || null}
              onChange={(event, newValue) => {
                setFormData({ 
                  ...formData, 
                  unit_id: newValue ? newValue.id : '' 
                });
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Unit"
                  required
                  placeholder="Search unit..."
                />
              )}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              noOptionsText="No units found"
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={loading}>
          {loading ? 'Saving...' : data ? 'Update' : 'Add'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ProductDialog;
