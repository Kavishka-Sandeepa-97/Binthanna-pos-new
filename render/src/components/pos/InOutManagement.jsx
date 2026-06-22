import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  Alert,
  Grid,
  InputAdornment,
  Pagination,
  CircularProgress,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  TrendingUp,
  TrendingDown,
  Search,
  Refresh,
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import { inOutAPI, cashierShiftAPI } from '../../services/api';
import { setActiveShift } from '../../store/slices/authSlice';

const InOutManagement = () => {
  const dispatch = useDispatch();
  const { user, activeShift } = useSelector((state) => state.auth);

  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState(null);
  const [deletingTransaction, setDeletingTransaction] = useState(false);
  const [stats, setStats] = useState({ IN: { count: 0, total_amount: 0 }, OUT: { count: 0, total_amount: 0 }, net_amount: 0 });

  // Form state
  const [formData, setFormData] = useState({
    type: 'OUT',
    description: '',
    amount: '',
  });

  // Filter and pagination state
  const [filters, setFilters] = useState({
    type: '',
    search: '',
    start_date: '',
    end_date: '',
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0,
  });

  // Fetch transactions
  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const data = await inOutAPI.getAll({
        page: pagination.page,
        limit: pagination.limit,
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value !== '')
        ),
      });
      setTransactions(data.data);
      setPagination(prev => ({
        ...prev,
        total: data.pagination.total,
        pages: data.pagination.pages,
      }));
    } catch (error) {
      console.error('Error fetching transactions:', error);
      toast.error('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  // Fetch statistics
  const fetchStats = async () => {
    try {
      const data = await inOutAPI.getStats(
        Object.fromEntries(
          Object.entries({
            start_date: filters.start_date,
            end_date: filters.end_date,
          }).filter(([_, value]) => value !== '')
        )
      );
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  useEffect(() => {
    fetchTransactions();
    fetchStats();
  }, [pagination.page, filters]);

  const handleOpenDialog = (transaction = null) => {
    if (transaction) {
      setEditingTransaction(transaction);
      setFormData({
        type: transaction.type,
        description: transaction.description,
        amount: transaction.amount.toString(),
      });
    } else {
      setEditingTransaction(null);
      setFormData({
        type: 'OUT',
        description: '',
        amount: '',
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingTransaction(null);
    setFormData({
      type: 'OUT',
      description: '',
      amount: '',
    });
  };

  const handleSubmit = async () => {
    if (!formData.description.trim() || !formData.amount) {
      toast.error('Please fill in all required fields');
      return;
    }

    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    // Check if user has active cashier shift (only for cashiers)
    if (user?.role === 'cashier' && !activeShift) {
      toast.error('You must open a cashier shift before processing transactions. Please open a shift from your profile menu.');
      return;
    }

    try {
      const transactionData = {
        ...formData,
        amount,
        staff_id: user.id,
      };

      if (editingTransaction) {
        await inOutAPI.update(editingTransaction.id, transactionData);
        toast.success('Transaction updated successfully');
      } else {
        await inOutAPI.create(transactionData);
        toast.success('Transaction created successfully');
      }
      
      // Refresh active shift data for cashiers to update cash amount
      if (user?.role === 'cashier') {
        try {
          const updatedShift = await cashierShiftAPI.getActiveShift(user.id);
          dispatch(setActiveShift(updatedShift));
        } catch (shiftError) {
          console.warn('Could not refresh active shift:', shiftError);
        }
      }

      handleCloseDialog();
      fetchTransactions();
      fetchStats();
    } catch (error) {
      console.error('Error saving transaction:', error);
      toast.error('Failed to save transaction');
    }
  };

  const handleDelete = (id) => {
    setTransactionToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!transactionToDelete) return;
    setDeletingTransaction(true);
    try {
      await inOutAPI.delete(transactionToDelete);
      toast.success('Transaction deleted successfully');
      
      // Refresh active shift data for cashiers to update cash amount
      if (user?.role === 'cashier') {
        try {
          const updatedShift = await cashierShiftAPI.getActiveShift(user.id);
          dispatch(setActiveShift(updatedShift));
        } catch (shiftError) {
          console.warn('Could not refresh active shift:', shiftError);
        }
      }

      setDeleteConfirmOpen(false);
      setTransactionToDelete(null);
      
      fetchTransactions();
      fetchStats();
    } catch (error) {
      console.error('Error deleting transaction:', error);
      toast.error('Failed to delete transaction');
    } finally {
      setDeletingTransaction(false);
    }
  };

  const formatCurrency = (amount) => `Rs. ${parseFloat(amount).toFixed(2)}`;

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" fontWeight="bold">
          In/Out Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => handleOpenDialog()}
          sx={{ borderRadius: 2 }}
        >
          Add Transaction
        </Button>
      </Box>

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <Card sx={{ bgcolor: '#e8f5e8' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h6" color="success.main">
                    Money In
                  </Typography>
                  <Typography variant="h4" fontWeight="bold" color="success.main">
                    {formatCurrency(stats.IN.total_amount)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {stats.IN.count} transactions
                  </Typography>
                </Box>
                <TrendingUp sx={{ fontSize: 48, color: 'success.main', opacity: 0.7 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ bgcolor: '#ffebee' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h6" color="error.main">
                    Money Out
                  </Typography>
                  <Typography variant="h4" fontWeight="bold" color="error.main">
                    {formatCurrency(stats.OUT.total_amount)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {stats.OUT.count} transactions
                  </Typography>
                </Box>
                <TrendingDown sx={{ fontSize: 48, color: 'error.main', opacity: 0.7 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ bgcolor: stats.net_amount >= 0 ? '#e3f2fd' : '#fff3e0' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h6" color={stats.net_amount >= 0 ? 'primary.main' : 'warning.main'}>
                    Net Amount
                  </Typography>
                  <Typography
                    variant="h4"
                    fontWeight="bold"
                    color={stats.net_amount >= 0 ? 'primary.main' : 'warning.main'}
                  >
                    {formatCurrency(Math.abs(stats.net_amount))}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {stats.net_amount >= 0 ? 'Profit' : 'Loss'}
                  </Typography>
                </Box>
                {stats.net_amount >= 0 ? (
                  <TrendingUp sx={{ fontSize: 48, color: 'primary.main', opacity: 0.7 }} />
                ) : (
                  <TrendingDown sx={{ fontSize: 48, color: 'warning.main', opacity: 0.7 }} />
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Type</InputLabel>
                <Select
                  value={filters.type}
                  onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value }))}
                  label="Type"
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="IN">Money In</MenuItem>
                  <MenuItem value="OUT">Money Out</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search description..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                size="small"
                type="date"
                label="Start Date"
                value={filters.start_date}
                onChange={(e) => setFilters(prev => ({ ...prev, start_date: e.target.value }))}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                size="small"
                type="date"
                label="End Date"
                value={filters.end_date}
                onChange={(e) => setFilters(prev => ({ ...prev, end_date: e.target.value }))}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<Refresh />}
                onClick={() => {
                  setFilters({
                    type: '',
                    search: '',
                    start_date: '',
                    end_date: '',
                  });
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
              >
                Clear Filters
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card>
        <CardContent>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <TableContainer component={Paper} elevation={0}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell>Amount</TableCell>
                      <TableCell>Staff</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {transactions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                          <Typography variant="body2" color="text.secondary">
                            No transactions found
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      transactions.map((transaction) => (
                        <TableRow key={transaction.id} hover>
                          <TableCell>{formatDate(transaction.created_at)}</TableCell>
                          <TableCell>
                            <Chip
                              label={transaction.type}
                              color={transaction.type === 'IN' ? 'success' : 'error'}
                              size="small"
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell>{transaction.description}</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }}>
                            {formatCurrency(transaction.amount)}
                          </TableCell>
                          <TableCell>{transaction.staff_name}</TableCell>
                          <TableCell align="right">
                            <IconButton
                              size="small"
                              onClick={() => handleOpenDialog(transaction)}
                              color="primary"
                            >
                              <Edit />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => handleDelete(transaction.id)}
                              color="error"
                            >
                              <Delete />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Pagination */}
              {pagination.pages > 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                  <Pagination
                    count={pagination.pages}
                    page={pagination.page}
                    onChange={(event, page) => setPagination(prev => ({ ...prev, page }))}
                    color="primary"
                  />
                </Box>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingTransaction ? 'Edit Transaction' : 'Add New Transaction'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Type</InputLabel>
              <Select
                value={formData.type}
                onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                label="Type"
              >
                <MenuItem value="IN">Money In (Income)</MenuItem>
                <MenuItem value="OUT">Money Out (Expense)</MenuItem>
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Enter transaction description"
              required
            />

            <TextField
              fullWidth
              label="Amount"
              type="number"
              value={formData.amount}
              onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
              InputProps={{
                startAdornment: <InputAdornment position="start">Rs.</InputAdornment>,
              }}
              placeholder="0.00"
              required
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editingTransaction ? 'Update' : 'Add'} Transaction
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={deleteConfirmOpen}
        onClose={() => {
          if (deletingTransaction) return;
          setDeleteConfirmOpen(false);
          setTransactionToDelete(null);
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Confirm Delete Transaction</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this transaction?</Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setDeleteConfirmOpen(false);
              setTransactionToDelete(null);
            }}
            disabled={deletingTransaction}
          >
            Keep
          </Button>
          <Button
            onClick={confirmDelete}
            color="error"
            variant="contained"
            disabled={deletingTransaction}
          >
            {deletingTransaction ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default InOutManagement;