import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { Refresh } from '@mui/icons-material';
import { toast } from 'react-toastify';
import { ordersAPI } from '../../services/api';
import { startReturnOrder, fetchActiveOrders } from '../../store/slices/orderSlice';
import { fetchItemVariants } from '../../store/slices/inventorySlice';
import { fetchActiveShift } from '../../store/slices/cashierShiftSlice';
import { setActiveShift } from '../../store/slices/authSlice';

const splitAllocationsByReturnQty = (allocations = [], requestedQty) => {
  let remaining = requestedQty;
  const picked = [];

  for (const allocation of allocations) {
    if (remaining <= 0) {
      break;
    }

    const allocationQty = Math.min(remaining, parseFloat(allocation.qty || 0) || 0);
    if (allocationQty <= 0) {
      continue;
    }

    picked.push({
      qty: allocationQty,
      batch_buy_price: parseFloat(allocation.batch_buy_price || 0) || 0,
      batch_sell_price: parseFloat(allocation.batch_sell_price || 0) || 0,
      sold_unit_price: parseFloat(allocation.sold_unit_price || 0) || 0,
    });

    remaining -= allocationQty;
  }

  return picked;
};

const ReturnOrderDialog = ({ open, onClose }) => {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  
  const [query, setQuery] = useState('');
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loadingOrderDetails, setLoadingOrderDetails] = useState(false);
  const [returnableItems, setReturnableItems] = useState([]);
  const [selectedQtyByItem, setSelectedQtyByItem] = useState({});
  const [itemReasons, setItemReasons] = useState({});
  const [reason, setReason] = useState('');
  const [actionTypeDialogOpen, setActionTypeDialogOpen] = useState(false);
  const [processingReturn, setProcessingReturn] = useState(false);
  const [confirmRefundDialogOpen, setConfirmRefundDialogOpen] = useState(false);
  const [returnedItemsToProcess, setReturnedItemsToProcess] = useState([]);

  const fetchOrders = async (searchTerm = '') => {
    setLoadingOrders(true);
    setSelectedOrder(null);
    setReturnableItems([]);
    setSelectedQtyByItem({});
    setItemReasons({});
    try {
      const rows = await ordersAPI.searchReturnable({ query: searchTerm, limit: 30 });
      setOrders(Array.isArray(rows) ? rows : []);
    } catch (error) {
      toast.error(`Failed to search orders: ${error.message}`);
    } finally {
      setLoadingOrders(false);
    }
  };

  useEffect(() => {
    if (!open) {
      return;
    }
    fetchOrders('');
  }, [open]);

  const handleSearch = () => {
    fetchOrders(query.trim());
  };

  const handleSelectOrder = async (order) => {
    setLoadingOrderDetails(true);
    try {
      const details = await ordersAPI.getReturnableDetails(order.id);
      const items = Array.isArray(details.items) ? details.items : [];

      setSelectedOrder(details.order || order);
      setReturnableItems(items);
      setSelectedQtyByItem({});
      setItemReasons({});
      setReason('');
    } catch (error) {
      toast.error(`Failed to load returnable items: ${error.message}`);
    } finally {
      setLoadingOrderDetails(false);
    }
  };

  const totalSelectedCredit = useMemo(() => {
    return returnableItems.reduce((sum, item) => {
      const qty = parseFloat(selectedQtyByItem[item.order_item_id] || 0) || 0;
      const unitPrice = parseFloat(item.net_unit_price || item.unit_price || 0) || 0;
      return sum + (qty * unitPrice);
    }, 0);
  }, [returnableItems, selectedQtyByItem]);

  const selectedItemsCount = useMemo(() => {
    return returnableItems.filter((item) => (parseFloat(selectedQtyByItem[item.order_item_id] || 0) || 0) > 0).length;
  }, [returnableItems, selectedQtyByItem]);

  const handleStartReturnClick = () => {
    if (!selectedOrder) {
      return;
    }

    const hasSelection = returnableItems.some(
      (item) => (parseFloat(selectedQtyByItem[item.order_item_id] || 0) || 0) > 0
    );

    if (!hasSelection) {
      toast.error('Select at least one item to return');
      return;
    }

    setActionTypeDialogOpen(true);
  };

  const handleConfirmRefundOnly = async (returnedItems) => {
    if (!user) {
      toast.error('Cashier session not found');
      return;
    }
    setProcessingReturn(true);
    try {
      const orderData = {
        staff_id: user.id,
        items: [],
        return_items: returnedItems.map(item => ({
          source_order_item_id: item.source_order_item_id,
          item_variant_id: item.item_variant_id,
          qty: item.qty,
          unit_price: item.unit_price,
          original_price: item.original_price,
          batch_allocations: item.batch_allocations,
          description: item.reason || reason || null,
        })),
        additional_charges: 0,
        customer_name: selectedOrder.customer_name || '',
        tender_cash: 0,
        is_card_payment: false,
        discount_type: null,
        discount_value: 0,
        status: 'completed',
        is_return: true,
        original_order_id: selectedOrder.id,
        credit_reason: reason || null,
      };

      const result = await ordersAPI.create(orderData);
      toast.success(`Refund processed successfully. Return Order #${result.id} completed.`);
      
      dispatch(fetchItemVariants());
      dispatch(fetchActiveOrders());
      if (user?.id && user.role === 'cashier') {
        try {
          const activeShiftData = await dispatch(fetchActiveShift(user.id)).unwrap();
          dispatch(setActiveShift(activeShiftData || null));
        } catch (_) {}
      }
      
      setActionTypeDialogOpen(false);
      onClose();
    } catch (error) {
      toast.error(`Failed to process refund: ${error.message}`);
    } finally {
      setProcessingReturn(false);
    }
  };

  const handleConfirmExchange = (returnedItems) => {
    dispatch(startReturnOrder({
      originalOrderId: selectedOrder.id,
      customerName: selectedOrder.customer_name || '',
      returnReason: reason,
      returnedItems,
    }));

    toast.success(`Exchange order started. Add items to checkout.`);
    setActionTypeDialogOpen(false);
    onClose();
  };

  const formatPrice = (value) => {
    const number = parseFloat(value || 0);
    return `Rs. ${Number.isFinite(number) ? number.toFixed(2) : '0.00'}`;
  };

  const formatDate = (value) => {
    if (!value) {
      return '-';
    }
    const date = new Date(value);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="h6">Return Order</Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button variant="outlined" onClick={onClose} size="medium">
                Close
              </Button>
              <Button
                variant="contained"
                onClick={handleStartReturnClick}
                disabled={!selectedOrder || selectedItemsCount === 0}
                size="medium"
              >
                Start Return Order
              </Button>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ overflow: 'visible' }}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
            <TextField
              label="Search Order ID or Barcode"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              size="small"
              fullWidth
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  handleSearch();
                }
              }}
            />
            <Button variant="contained" onClick={handleSearch} disabled={loadingOrders}>
              Search
            </Button>
            <IconButton onClick={() => fetchOrders('')} disabled={loadingOrders}>
              <Refresh />
            </IconButton>
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1.3fr' }, gap: 2 }}>
            <Paper variant="outlined" sx={{ p: 1.5, minHeight: 360 }}>
              <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
                Completed Orders
              </Typography>

              {loadingOrders ? (
                <Box sx={{ py: 6, textAlign: 'center' }}>
                  <CircularProgress size={28} />
                </Box>
              ) : orders.length === 0 ? (
                <Alert severity="info">No completed orders found.</Alert>
              ) : (
                <TableContainer sx={{ maxHeight: 420 }}>
                  <Table stickyHeader size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Order</TableCell>
                        <TableCell>Barcode</TableCell>
                        <TableCell>Date</TableCell>
                        <TableCell align="right">Total</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {orders.map((order) => (
                        <TableRow
                          key={order.id}
                          hover
                          selected={selectedOrder?.id === order.id}
                          sx={{ cursor: 'pointer' }}
                          onClick={() => handleSelectOrder(order)}
                        >
                          <TableCell>
                            <Typography variant="body2" fontWeight="bold">#{order.id}</Typography>
                            <Typography variant="caption" color="text.secondary">{order.customer_name || 'N/A'}</Typography>
                          </TableCell>
                          <TableCell>{order.barcode || '-'}</TableCell>
                          <TableCell>{formatDate(order.date)}</TableCell>
                          <TableCell align="right">{formatPrice(order.total_amount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Paper>

            <Paper variant="outlined" sx={{ p: 1.5, minHeight: 360 }}>
              <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
                Return Items {selectedOrder ? `for Order #${selectedOrder.id}` : ''}
              </Typography>

              {loadingOrderDetails ? (
                <Box sx={{ py: 6, textAlign: 'center' }}>
                  <CircularProgress size={28} />
                </Box>
              ) : !selectedOrder ? (
                <Alert severity="info">Select an order to choose return items.</Alert>
              ) : returnableItems.length === 0 ? (
                <Alert severity="warning">No returnable items remain in this order.</Alert>
              ) : (
                <>
                  <TableContainer sx={{ maxHeight: 360 }}>
                    <Table stickyHeader size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Item</TableCell>
                          <TableCell align="right">Sold</TableCell>
                          <TableCell align="right">Returned</TableCell>
                          <TableCell align="right">Available</TableCell>
                          <TableCell align="right">Net Price</TableCell>
                          <TableCell align="right">Return Qty</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {returnableItems.map((item) => {
                          const maxQty = parseFloat(item.max_returnable_qty || 0) || 0;
                          const selectedQty = parseFloat(selectedQtyByItem[item.order_item_id] || 0) || 0;
                          return (
                            <TableRow key={item.order_item_id}>
                              <TableCell>
                                <Typography variant="body2" fontWeight="bold">{item.item_name}</Typography>
                                <Typography variant="caption" color="text.secondary">{item.variant_name}</Typography>
                                {selectedQty > 0 && (
                                  <TextField
                                    placeholder="Reason for return"
                                    size="small"
                                    variant="standard"
                                    value={itemReasons[item.order_item_id] || ''}
                                    onChange={(event) => {
                                      setItemReasons((prev) => ({
                                        ...prev,
                                        [item.order_item_id]: event.target.value,
                                      }));
                                    }}
                                    fullWidth
                                    sx={{ mt: 0.5 }}
                                  />
                                )}
                              </TableCell>
                              <TableCell align="right">{item.sold_qty}</TableCell>
                              <TableCell align="right">{item.already_returned_qty}</TableCell>
                              <TableCell align="right">{maxQty}</TableCell>
                              <TableCell align="right">
                                {parseFloat(item.original_price || 0) > parseFloat(item.net_unit_price || item.unit_price || 0) ? (
                                  <Box>
                                    <Typography variant="body2" sx={{ textDecoration: 'line-through', color: 'text.secondary' }}>
                                      {formatPrice(item.original_price)}
                                    </Typography>
                                    {parseFloat(item.discount_amount || 0) > 0 && (
                                      <Typography variant="caption" color="error" display="block" sx={{ fontSize: '0.7rem' }}>
                                        -{formatPrice(item.discount_amount)} ({item.discount_source || 'Item'})
                                      </Typography>
                                    )}
                                    {parseFloat(item.order_discount_per_unit || 0) > 0 && (
                                      <Typography variant="caption" color="warning.main" display="block" sx={{ fontSize: '0.7rem' }}>
                                        -{formatPrice(item.order_discount_per_unit)} (Global/Order)
                                      </Typography>
                                    )}
                                    <Typography variant="body2" fontWeight="bold" color="success.main">
                                      {formatPrice(item.net_unit_price)}
                                    </Typography>
                                  </Box>
                                ) : (
                                  formatPrice(item.unit_price)
                                )}
                              </TableCell>
                              <TableCell align="right" sx={{ width: 120 }}>
                                <TextField
                                  type="number"
                                  size="small"
                                  value={selectedQtyByItem[item.order_item_id] || ''}
                                  onChange={(event) => {
                                    const value = event.target.value;
                                    if (value === '') {
                                      setSelectedQtyByItem((prev) => ({ ...prev, [item.order_item_id]: '' }));
                                      return;
                                    }

                                    const numeric = parseFloat(value);
                                    if (!Number.isFinite(numeric) || numeric < 0) {
                                      return;
                                    }

                                    if (numeric > maxQty) {
                                      return;
                                    }

                                    setSelectedQtyByItem((prev) => ({ ...prev, [item.order_item_id]: numeric }));
                                  }}
                                  inputProps={{ min: 0, max: maxQty, step: 1 }}
                                />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  <Divider sx={{ my: 2 }} />

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="body2">Selected Items: {selectedItemsCount}</Typography>
                    <Typography variant="body2" fontWeight="bold">Return Credit: {formatPrice(totalSelectedCredit)}</Typography>
                  </Box>

                  <TextField
                    label="Return Reason (optional)"
                    fullWidth
                    size="small"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                  />
                </>
              )}
            </Paper>
          </Box>
        </DialogContent>
      </Dialog>

      <Dialog open={actionTypeDialogOpen} onClose={() => setActionTypeDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold' }}>Select Return Action</DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2 }}>
            How would you like to process this return for Order #{selectedOrder?.id}?
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, my: 1 }}>
            <Paper variant="outlined" sx={{ p: 2, bgcolor: '#f5f5f5' }}>
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                Option 1: Refund & Add to Stock (Refund Only)
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Process the return immediately. Stock will be restored, and cash of {formatPrice(totalSelectedCredit)} will be refunded/deducted from your shift cash.
              </Typography>
            </Paper>
            <Paper variant="outlined" sx={{ p: 2, bgcolor: '#f5f5f5' }}>
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                Option 2: Exchange (Use Credit for New Order)
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Transfer return credit of {formatPrice(totalSelectedCredit)} to the POS cart. You can then add new sale items and checkout. Stock will be restored upon checkout.
              </Typography>
            </Paper>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button
            variant="outlined"
            color="inherit"
            onClick={() => setActionTypeDialogOpen(false)}
            disabled={processingReturn}
            sx={{
              color: 'text.secondary',
              borderColor: 'divider',
              '&:hover': {
                borderColor: 'text.secondary',
                bgcolor: 'action.hover',
              },
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              const returnedItems = returnableItems
                .map((item) => {
                  const qty = parseFloat(selectedQtyByItem[item.order_item_id] || 0) || 0;
                  if (qty <= 0) return null;
                  return {
                    source_order_item_id: item.order_item_id,
                    item_variant_id: item.item_variant_id,
                    item_name: item.item_name,
                    variant_name: item.variant_name,
                    qty,
                    unit_price: parseFloat(item.net_unit_price || item.unit_price || 0) || 0,
                    original_price: parseFloat(item.original_price || item.unit_price || 0) || 0,
                    batch_allocations: splitAllocationsByReturnQty(item.batch_allocations || [], qty),
                    reason: itemReasons[item.order_item_id] || '',
                  };
                })
                .filter(Boolean);
              setReturnedItemsToProcess(returnedItems);
              setConfirmRefundDialogOpen(true);
            }}
            disabled={processingReturn}
            sx={{
              bgcolor: 'secondary.main',
              color: 'white',
              '&:hover': {
                bgcolor: 'secondary.dark',
              },
            }}
          >
            Refund & Add to Stock
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              const returnedItems = returnableItems
                .map((item) => {
                  const qty = parseFloat(selectedQtyByItem[item.order_item_id] || 0) || 0;
                  if (qty <= 0) return null;
                  return {
                    source_order_item_id: item.order_item_id,
                    item_variant_id: item.item_variant_id,
                    item_name: item.item_name,
                    variant_name: item.variant_name,
                    qty,
                    unit_price: parseFloat(item.net_unit_price || item.unit_price || 0) || 0,
                    original_price: parseFloat(item.original_price || item.unit_price || 0) || 0,
                    batch_allocations: splitAllocationsByReturnQty(item.batch_allocations || [], qty),
                    reason: itemReasons[item.order_item_id] || '',
                  };
                })
                .filter(Boolean);
              handleConfirmExchange(returnedItems);
            }}
            disabled={processingReturn}
            sx={{
              bgcolor: 'primary.main',
              color: 'rgba(0, 0, 0, 0.87)',
              '&:hover': {
                bgcolor: 'primary.dark',
              },
            }}
          >
            Exchange
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmRefundDialogOpen} onClose={() => setConfirmRefundDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold' }}>Confirm Refund</DialogTitle>
        <DialogContent>
          <Typography variant="body1">
            Are you sure you want to refund <strong>{formatPrice(totalSelectedCredit)}</strong> and add these items back to stock immediately?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
            This action will automatically adjust your cashier shift cash, update inventory, and complete the return. This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button
            variant="outlined"
            color="inherit"
            onClick={() => setConfirmRefundDialogOpen(false)}
            disabled={processingReturn}
            sx={{
              color: 'text.secondary',
              borderColor: 'divider',
              '&:hover': {
                borderColor: 'text.secondary',
                bgcolor: 'action.hover',
              },
            }}
          >
            No, Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              handleConfirmRefundOnly(returnedItemsToProcess);
              setConfirmRefundDialogOpen(false);
            }}
            disabled={processingReturn}
            sx={{
              bgcolor: 'secondary.main',
              color: 'white',
              '&:hover': {
                bgcolor: 'secondary.dark',
              },
            }}
          >
            {processingReturn ? <CircularProgress size={24} /> : 'Yes, Confirm Refund'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ReturnOrderDialog;
