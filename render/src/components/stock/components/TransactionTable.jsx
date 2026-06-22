import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  Typography,
  Box,
  Tooltip,
} from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { toast } from 'react-toastify';
import api from '../../../services/api';

const TransactionTable = ({ transactions, onRefresh, onEdit }) => {
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this transaction? This will reverse the stock change.')) {
      return;
    }

    try {
      await api.stock.transactions.delete(id);
      toast.success('Transaction deleted successfully');
      onRefresh();
    } catch (error) {
      toast.error(error.message || 'Delete failed');
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  // Check if transactions is null, undefined, or empty
  if (!Array.isArray(transactions) || transactions.length === 0) {
    return (
      <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" minHeight={200}>
        <Typography variant="body1" color="text.secondary" gutterBottom>
          No transactions found
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Create your first transaction using the IN or OUT buttons above
        </Typography>
      </Box>
    );
  }

  return (
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          <TableRow sx={{ backgroundColor: 'grey.100' }}>
            <TableCell><strong>Product Name</strong></TableCell>
            <TableCell><strong>Supplier Name</strong></TableCell>
            <TableCell><strong>Total Price</strong></TableCell>
            <TableCell><strong>Quantity</strong></TableCell>
            <TableCell><strong>Type</strong></TableCell>
            <TableCell><strong>Date</strong></TableCell>
            <TableCell><strong>Description</strong></TableCell>
            <TableCell><strong>Options</strong></TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {transactions.map((transaction) => (
            <TableRow key={transaction.id} hover>
              <TableCell>{transaction.product_name || '-'}</TableCell>
              <TableCell>{transaction.supplier_name || '-'}</TableCell>
              <TableCell>
                {transaction.price ? `Rs. ${parseFloat(transaction.price).toFixed(2)}` : '-'}
              </TableCell>
              <TableCell>
                {transaction.qty} {transaction.unit_name || ''}
              </TableCell>
              <TableCell>
                <Chip
                  label={transaction.type}
                  color={transaction.type === 'IN' ? 'success' : 'error'}
                  size="small"
                />
              </TableCell>
              <TableCell>{formatDate(transaction.created_at)}</TableCell>
              <TableCell>
                {transaction.description || 'no description'}
              </TableCell>
              <TableCell>
                <Tooltip title="Edit">
                  <IconButton
                    size="small"
                    color="primary"
                    onClick={() => onEdit(transaction)}
                  >
                    <EditIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete">
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => handleDelete(transaction.id)}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Tooltip>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default TransactionTable;
