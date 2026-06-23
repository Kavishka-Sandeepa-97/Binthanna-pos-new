import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
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
  CircularProgress,
  Tooltip,
} from '@mui/material';
import {
  PlayArrow,
  Cancel,
  Restaurant,
  Person,
  ShoppingCart,
  Refresh,
} from '@mui/icons-material';
import { fetchActiveOrders, loadActiveOrder, updateOrderStatus } from '../../store/slices/orderSlice';

const ActiveOrdersDialog = ({ open, onClose }) => {
  const dispatch = useDispatch();
  const { activeOrders, loading, currentOrder } = useSelector((state) => state.order);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [orderToCancel, setOrderToCancel] = useState(null);
  const [cancellingOrderId, setCancellingOrderId] = useState(null);

  useEffect(() => {
    if (open) {
      // Always fetch fresh data when dialog opens
      dispatch(fetchActiveOrders()).unwrap().catch(err => {
        console.error('Failed to fetch active orders:', err);
      });
    }
  }, [open, dispatch]);

  const handleLoadOrder = async (order) => {
    // Fetch full order details with items
    try {
      const response = await fetch(`http://localhost:3001/api/orders/${order.id}`);
      const fullOrder = await response.json();
      dispatch(loadActiveOrder(fullOrder));
      // Refresh active orders after loading
      dispatch(fetchActiveOrders());
      onClose();
    } catch (error) {
      console.error('Failed to load order:', error);
    }
  };

  const handleCancelOrder = (orderId) => {
    setOrderToCancel(orderId);
    setCancelConfirmOpen(true);
  };

  const confirmCancelOrder = async () => {
    if (!orderToCancel) return;

    setCancellingOrderId(orderToCancel);
    try {
      await dispatch(updateOrderStatus({ orderId: orderToCancel, status: 'cancelled' })).unwrap();
      await dispatch(fetchActiveOrders()).unwrap();
      setCancelConfirmOpen(false);
      setOrderToCancel(null);
    } catch (error) {
      console.error('Failed to cancel order:', error);
    } finally {
      setCancellingOrderId(null);
    }
  };

  const handleRefresh = async () => {
    try {
      await dispatch(fetchActiveOrders()).unwrap();
    } catch (error) {
      console.error('Failed to refresh orders:', error);
    }
  };

  const formatPrice = (price) => {
    const numPrice = parseFloat(price);
    return isNaN(numPrice) ? 'Rs. 0.00' : `Rs. ${numPrice.toFixed(2)}`;
  };

  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isCurrentlyLoaded = (orderId) => {
    return currentOrder.id === orderId;
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ShoppingCart />
            Active Orders
            <Chip
              label={activeOrders.length}
              size="small"
              color="primary"
              sx={{ ml: 1 }}
            />
          </Box>
          <IconButton
            onClick={handleRefresh}
            color="primary"
            size="small"
            disabled={loading}
            sx={{
              animation: loading ? 'spin 1s linear infinite' : 'none',
              '@keyframes spin': {
                '0%': { transform: 'rotate(0deg)' },
                '100%': { transform: 'rotate(360deg)' },
              },
            }}
          >
            <Refresh />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : (activeOrders || []).length === 0 ? (
          <Box sx={{ textAlign: 'center', p: 4, color: 'text.secondary' }}>
            <ShoppingCart sx={{ fontSize: 60, mb: 2, opacity: 0.3 }} />
            <Typography variant="h6">No active orders</Typography>
            <Typography variant="body2">
              Active orders will appear here once created
            </Typography>
          </Box>
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: 'grey.100' }}>
                  <TableCell><strong>Order #</strong></TableCell>
                  <TableCell><strong>Customer</strong></TableCell>
                  <TableCell><strong>Time</strong></TableCell>
                  <TableCell align="right"><strong>Total</strong></TableCell>
                  <TableCell align="center"><strong>Status</strong></TableCell>
                  <TableCell align="center"><strong>Actions</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(activeOrders || []).map((order) => {
                  const isLoaded = isCurrentlyLoaded(order.id);
                  return (
                    <TableRow
                      key={order.id}
                      sx={{
                        bgcolor: isLoaded ? 'action.selected' : 'inherit',
                        '&:hover': { bgcolor: 'action.hover' },
                      }}
                    >
                      <TableCell>
                        <Typography variant="body2" fontWeight="bold">
                          #{order.id}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                          {order.customer_name && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Person fontSize="small" color="action" />
                              <Typography variant="body2" fontWeight="medium">
                                {order.customer_name}
                              </Typography>
                            </Box>
                          )}
                          {order.table_number && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Restaurant fontSize="small" color="secondary" />
                              <Typography variant="body2" color="secondary.main" fontWeight="bold">
                                {order.table_number}
                              </Typography>
                            </Box>
                          )}
                          {!order.customer_name && !order.table_number && (
                            <Typography variant="body2" color="text.secondary">
                              N/A
                            </Typography>
                          )}
                          <Chip
                            label={order.is_card_payment ? 'Card' : 'Cash'}
                            size="small"
                            color={order.is_card_payment ? 'info' : 'success'}
                            variant="outlined"
                            sx={{ mt: 0.2, alignSelf: 'flex-start', height: 20, fontSize: '0.68rem' }}
                          />
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {formatDateTime(order.date)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight="bold">
                          {formatPrice(order.total_amount)}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        {isLoaded ? (
                          <Chip
                            label="Currently Loaded"
                            size="small"
                            color="success"
                            variant="outlined"
                          />
                        ) : (
                          <Chip
                            label="Active"
                            size="small"
                            color="warning"
                          />
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <Box
                          sx={{
                            display: 'flex',
                            gap: 1.1,
                            justifyContent: 'center',
                            '& .MuiIconButton-root': {
                              width: 48,
                              height: 48,
                              p: 1.1,
                            },
                            '& .MuiSvgIcon-root': {
                              fontSize: '1.6rem',
                            },
                          }}
                        >
                          <Tooltip title="Load Order">
                            <IconButton
                              size="large"
                              color="primary"
                              onClick={() => handleLoadOrder(order)}
                              disabled={isLoaded}
                            >
                              <PlayArrow />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Cancel Order">
                            <IconButton
                              size="large"
                              color="error"
                              onClick={() => handleCancelOrder(order.id)}
                              disabled={cancellingOrderId === order.id}
                            >
                              <Cancel />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>

      <Dialog
        open={cancelConfirmOpen}
        onClose={() => {
          if (cancellingOrderId) return;
          setCancelConfirmOpen(false);
          setOrderToCancel(null);
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Confirm Cancel Order</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to cancel this active order?</Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setCancelConfirmOpen(false);
              setOrderToCancel(null);
            }}
            disabled={!!cancellingOrderId}
          >
            Keep Order
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={confirmCancelOrder}
            disabled={!!cancellingOrderId}
          >
            {cancellingOrderId ? 'Cancelling...' : 'Cancel Order'}
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
};

export default ActiveOrdersDialog;
