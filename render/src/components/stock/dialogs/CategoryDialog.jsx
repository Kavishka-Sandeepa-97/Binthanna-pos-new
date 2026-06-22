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

const CategoryDialog = ({ open, data, onClose, onRefresh, categories }) => {
  const [formData, setFormData] = useState({ name: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (data) {
      setFormData({ name: data.name });
    } else {
      setFormData({ name: '' });
    }
  }, [data]);

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error('Category name is required');
      return;
    }

    setLoading(true);
    try {
      if (data) {
        await api.stock.categories.update(data.id, formData);
        toast.success('Category updated successfully');
      } else {
        await api.stock.categories.create(formData);
        toast.success('Category created successfully');
      }
      setFormData({ name: '' });
      onClose();
      onRefresh();
    } catch (error) {
      toast.error(error.message || 'Operation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this category?')) return;

    try {
      await api.stock.categories.delete(id);
      toast.success('Category deleted successfully');
      onClose();
      onRefresh();
    } catch (error) {
      toast.error(error.message || 'Delete failed');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{data ? 'Edit Category' : 'Add Category'}</DialogTitle>
      <DialogContent>
        <TextField
          fullWidth
          label="Category Name"
          value={formData.name}
          onChange={(e) => setFormData({ name: e.target.value })}
          margin="normal"
          placeholder="e.g., Food, Beverages, Cleaning Supplies"
        />

        {!data && categories && categories.length > 0 && (
          <Box mt={3}>
            <Typography variant="subtitle1" gutterBottom>
              Current Categories
            </Typography>
            <List>
              {categories.map((category) => (
                <React.Fragment key={category.id}>
                  <ListItem>
                    <ListItemText primary={category.name} />
                    <ListItemSecondaryAction>
                      <IconButton edge="end" onClick={() => handleDelete(category.id)}>
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

export default CategoryDialog;
