import React, { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Typography,
  Box,
  TextField,
  InputAdornment,
} from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon, Search as SearchIcon } from '@mui/icons-material';
import { toast } from 'react-toastify';
import api from '../../../services/api';

const ProductTable = ({ products, onEdit, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this product?')) {
      return;
    }

    try {
      await api.stock.products.delete(id);
      toast.success('Product deleted successfully');
      onRefresh();
    } catch (error) {
      toast.error(error.message || 'Delete failed');
    }
  };

  const filteredProducts = products.filter((product) =>
    (product.name || '').toString().toLowerCase().includes((searchTerm || '').toLowerCase()) ||
    (product.category_name || '').toString().toLowerCase().includes((searchTerm || '').toLowerCase())
  );

  if (!products || products.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
        <Typography variant="body1" color="text.secondary">
          No products found
        </Typography>
      </Box>
    );
  }

  return (
    <>
      <Box mb={2}>
        <TextField
          placeholder="Search products..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          fullWidth
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: 'grey.100' }}>
              <TableCell><strong>Product Name</strong></TableCell>
              <TableCell><strong>Quantity</strong></TableCell>
              <TableCell><strong>Category</strong></TableCell>
              <TableCell><strong>Unit</strong></TableCell>
              <TableCell><strong>Actions</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredProducts.map((product) => (
              <TableRow key={product.id} hover>
                <TableCell>{product.name}</TableCell>
                <TableCell>{product.current_qty || 0}</TableCell>
                <TableCell>{product.category_name || '-'}</TableCell>
                <TableCell>{product.unit_name || '-'}</TableCell>
                <TableCell>
                  <IconButton
                    size="small"
                    color="primary"
                    onClick={() => onEdit(product)}
                  >
                    <EditIcon />
                  </IconButton>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => handleDelete(product.id)}
                  >
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
};

export default ProductTable;
