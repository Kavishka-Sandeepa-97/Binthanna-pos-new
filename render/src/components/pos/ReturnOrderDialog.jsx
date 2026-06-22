import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
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
import { startReturnOrder } from '../../store/slices/orderSlice';

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
  const [query, setQuery] = useState('');
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loadingOrderDetails, setLoadingOrderDetails] = useState(false);
  const [returnableItems, setReturnableItems] = useState([]);
  const [selectedQtyByItem, setSelectedQtyByItem] = useState({});
  const [reason, setReason] = useState('');

  const fetchOrders = async (searchTerm = '') => {
    setLoadingOrders(true);
    setSelectedOrder(null);
    setReturnableItems([]);
    setSelectedQtyByItem({});
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
      const unitPrice = parseFloat(item.unit_price || 0) || 0;
      return sum + (qty * unitPrice);
    }, 0);
  }, [returnableItems, selectedQtyByItem]);

  const selectedItemsCount = useMemo(() => {
    return returnableItems.filter((item) => (parseFloat(selectedQtyByItem[item.order_item_id] || 0) || 0) > 0).length;
  }, [returnableItems, selectedQtyByItem]);

  const handleStartReturn = () => {
    if (!selectedOrder) {
      return;
    }

    const returnedItems = returnableItems
      .map((item) => {
        const qty = parseFloat(selectedQtyByItem[item.order_item_id] || 0) || 0;
        if (qty <= 0) {
          return null;
        }

        return {
          source_order_item_id: item.order_item_id,
          item_variant_id: item.item_variant_id,
          item_name: item.item_name,
          variant_name: item.variant_name,
          qty,
          unit_price: parseFloat(item.unit_price || 0) || 0,
          original_price: parseFloat(item.original_price || item.unit_price || 0) || 0,
          batch_allocations: splitAllocationsByReturnQty(item.batch_allocations || [], qty),
        };
      })
      .filter(Boolean);

    if (returnedItems.length === 0) {
      toast.error('Select at least one item to return');
      return;
    }

    dispatch(startReturnOrder({
      originalOrderId: selectedOrder.id,
      customerName: selectedOrder.customer_name || '',
      returnReason: reason,
      returnedItems,
    }));

    toast.success(`Return started for Order #${selectedOrder.id}`);
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
              onClick={handleStartReturn}
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
                        <TableCell align="right">Price</TableCell>
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
                            </TableCell>
                            <TableCell align="right">{item.sold_qty}</TableCell>
                            <TableCell align="right">{item.already_returned_qty}</TableCell>
                            <TableCell align="right">{maxQty}</TableCell>
                            <TableCell align="right">{formatPrice(item.unit_price)}</TableCell>
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
  );
};

export default ReturnOrderDialog;
