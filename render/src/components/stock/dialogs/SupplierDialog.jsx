import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Divider,
  Box,
  Typography,
} from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { toast } from 'react-toastify';
import api from '../../../services/api';

const SupplierDialog = ({ open, data, onClose, onRefresh, suppliers }) => {
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (data) {
      setFormData({ name: data.name, description: data.description || '' });
    } else {
      setFormData({ name: '', description: '' });
    }
  }, [data]);

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error('Supplier name is required');
      return;
    }

    setLoading(true);
    try {
      if (data) {
        await api.stock.suppliers.update(data.id, formData);
        toast.success('Supplier updated successfully');
      } else {
        await api.stock.suppliers.create(formData);
        toast.success('Supplier created successfully');
      }
      setFormData({ name: '', description: '' });
      onClose();
      onRefresh();
    } catch (error) {
      toast.error(error.message || 'Operation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this supplier?')) return;

    try {
      await api.stock.suppliers.delete(id);
      toast.success('Supplier deleted successfully');
      onClose();
      onRefresh();
    } catch (error) {
      toast.error(error.message || 'Delete failed');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{data ? 'Edit Supplier' : 'Add Supplier'}</DialogTitle>
      <DialogContent>
        <TextField
          fullWidth
          label="Supplier Name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          margin="normal"
          required
        />
        <TextField
          fullWidth
          label="Description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          margin="normal"
          multiline
          rows={3}
          placeholder="Optional description"
        />

        {!data && suppliers && suppliers.length > 0 && (
          <Box mt={3}>
            <Typography variant="subtitle1" gutterBottom>
              Current Suppliers
            </Typography>
            <List>
              {suppliers.map((supplier) => (
                <React.Fragment key={supplier.id}>
                  <ListItem>
                    <ListItemText
                      primary={supplier.name}
                      secondary={supplier.description}
                    />
                    <ListItemSecondaryAction>
                      <IconButton edge="end" onClick={() => handleDelete(supplier.id)}>
                        <DeleteIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                  <Divider />
                </React.Fragment>
              ))}
            </List>
          </Box>
        )}
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

export default SupplierDialog;
