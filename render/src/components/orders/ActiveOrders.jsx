import React, { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  Divider,
  IconButton,
  TextField,
  MenuItem,
  Fab,
  Badge,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Edit as EditIcon,
  Receipt as ReceiptIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  TableRestaurant as TableIcon,
} from '@mui/icons-material';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { fetchActiveOrders, updateOrderStatus } from '../../store/slices/orderSlice';

const ActiveOrders = () => {
  const dispatch = useDispatch();
  const { activeOrders, loading } = useSelector((state) => state.order);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editedItems, setEditedItems] = useState([]);

  useEffect(() => {
    dispatch(fetchActiveOrders());

    // Cleanup function
    return () => {
      // Cleanup on unmount
    };
  }, [dispatch]);

  const handleRefresh = useCallback(() => {
    dispatch(fetchActiveOrders());
    toast.success('Orders refreshed');
  }, [dispatch]);

  const handleEditOrder = useCallback((order) => {
    setSelectedOrder(order);
    setEditedItems([...order.items]);
    setEditDialogOpen(true);
  }, []);

  const handleUpdateQuantity = (itemId, change) => {
    setEditedItems(prev =>
      prev.map(item =>
        item.id === itemId
          ? { ...item, quantity: Math.max(0, item.quantity + change) }
          : item
      ).filter(item => item.quantity > 0)
    );
  };

  const handleSaveChanges = async () => {
    try {
      // Here you would call an API to update the order
      // For now, we'll just show a success message
      toast.success('Order updated successfully');
      setEditDialogOpen(false);
      dispatch(fetchActiveOrders());
    } catch (error) {
      toast.error('Failed to update order');
    }
  };

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      await dispatch(updateOrderStatus({ orderId, status: newStatus }));
      toast.success(`Order status updated to ${newStatus}`);
    } catch (error) {
      toast.error('Failed to update order status');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'warning';
      case 'preparing': return 'info';
      case 'ready': return 'success';
      case 'served': return 'default';
      default: return 'default';
    }
  };

  const calculateTotal = (items) => {
    return items.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight="bold">
          Active Orders
        </Typography>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={handleRefresh}
          disabled={loading}
        >
          Refresh
        </Button>
      </Box>

      <Grid container spacing={3}>
        {activeOrders.map((order) => (
          <Grid item xs={12} md={6} lg={4} key={order.id}>
            <Card
              elevation={3}
              sx={{
                height: '100%',
                border: order.status === 'ready' ? '2px solid #4caf50' : 'none',
                position: 'relative'
              }}
            >
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Typography variant="h6" fontWeight="bold">
                      Order #{order.id}
                    </Typography>
                  </Box>
                </Box>

                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Chip
                    label={order.status.toUpperCase()}
                    color={getStatusColor(order.status)}
                    size="small"
                  />
                </Box>

                <Typography variant="body2" color="text.secondary" mb={1}>
                  Customer: {order.customerName}
                </Typography>

                <Typography variant="body2" color="text.secondary" mb={2}>
                  Time: {new Date(order.createdAt).toLocaleTimeString()}
                </Typography>

                <Divider sx={{ my: 2 }} />

                <List dense>
                  {order.items.slice(0, 3).map((item, index) => (
                    <ListItem key={index} sx={{ px: 0 }}>
                      <ListItemText
                        primary={`${item.quantity}x ${item.name}`}
                        secondary={item.variant}
                      />
                      <Typography variant="body2">
                        ${(item.price * item.quantity).toFixed(2)}
                      </Typography>
                    </ListItem>
                  ))}
                  {order.items.length > 3 && (
                    <ListItem sx={{ px: 0 }}>
                      <ListItemText
                        primary={`+${order.items.length - 3} more items`}
                        sx={{ fontStyle: 'italic' }}
                      />
                    </ListItem>
                  )}
                </List>

                <Divider sx={{ my: 2 }} />

                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6" fontWeight="bold">
                    Total: ${calculateTotal(order.items).toFixed(2)}
                  </Typography>
                </Box>

                <Box display="flex" gap={1} flexWrap="wrap">
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<EditIcon />}
                    onClick={() => handleEditOrder(order)}
                  >
                    Edit
                  </Button>

                  {order.status === 'pending' && (
                    <Button
                      size="small"
                      variant="contained"
                      color="info"
                      onClick={() => handleStatusChange(order.id, 'preparing')}
                    >
                      Start Preparing
                    </Button>
                  )}

                  {order.status === 'preparing' && (
                    <Button
                      size="small"
                      variant="contained"
                      color="success"
                      onClick={() => handleStatusChange(order.id, 'ready')}
                    >
                      Mark Ready
                    </Button>
                  )}

                  {order.status === 'ready' && (
                    <Button
                      size="small"
                      variant="contained"
                      color="primary"
                      onClick={() => handleStatusChange(order.id, 'served')}
                    >
                      Mark Served
                    </Button>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {activeOrders.length === 0 && !loading && (
        <Box
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          minHeight="400px"
        >
          <TableIcon sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            No active orders
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Orders will appear here when customers place them
          </Typography>
        </Box>
      )}

      {/* Edit Order Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Edit Order #{selectedOrder?.id}
        </DialogTitle>
        <DialogContent>
          <List>
            {editedItems.map((item, index) => (
              <ListItem key={index}>
                <ListItemText
                  primary={item.name}
                  secondary={item.variant}
                />
                <Box display="flex" alignItems="center" gap={1}>
                  <IconButton
                    size="small"
                    onClick={() => handleUpdateQuantity(item.id, -1)}
                  >
                    <RemoveIcon />
                  </IconButton>
                  <Typography variant="body1" sx={{ minWidth: 30, textAlign: 'center' }}>
                    {item.quantity}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={() => handleUpdateQuantity(item.id, 1)}
                  >
                    <AddIcon />
                  </IconButton>
                  <Typography variant="body2" sx={{ minWidth: 80, textAlign: 'right' }}>
                    ${(item.price * item.quantity).toFixed(2)}
                  </Typography>
                </Box>
              </ListItem>
            ))}
          </List>

          <Divider sx={{ my: 2 }} />

          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">
              Total: ${calculateTotal(editedItems).toFixed(2)}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSaveChanges}
            variant="contained"
          >
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ActiveOrders;