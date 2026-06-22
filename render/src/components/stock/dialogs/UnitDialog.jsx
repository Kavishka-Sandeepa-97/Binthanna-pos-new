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

const UnitDialog = ({ open, data, onClose, onRefresh, units }) => {
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
      toast.error('Unit name is required');
      return;
    }

    setLoading(true);
    try {
      if (data) {
        await api.stock.units.update(data.id, formData);
        toast.success('Unit updated successfully');
      } else {
        await api.stock.units.create(formData);
        toast.success('Unit created successfully');
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
    if (!window.confirm('Are you sure you want to delete this unit?')) return;

    try {
      await api.stock.units.delete(id);
      toast.success('Unit deleted successfully');
      onClose();
      onRefresh();
    } catch (error) {
      toast.error(error.message || 'Delete failed');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{data ? 'Edit Unit' : 'Add Unit'}</DialogTitle>
      <DialogContent>
        <TextField
          fullWidth
          label="Unit Name"
          value={formData.name}
          onChange={(e) => setFormData({ name: e.target.value })}
          margin="normal"
          placeholder="e.g., KG, Liter, Pieces, Count"
        />

        {!data && units && units.length > 0 && (
          <Box mt={3}>
            <Typography variant="subtitle1" gutterBottom>
              Current Units
            </Typography>
            <List>
              {units.map((unit) => (
                <React.Fragment key={unit.id}>
                  <ListItem>
                    <ListItemText primary={unit.name} />
                    <ListItemSecondaryAction>
                      <IconButton edge="end" onClick={() => handleDelete(unit.id)}>
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

export default UnitDialog;
