import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TablePagination,
  Alert,
} from '@mui/material';
import {
  History,
  Refresh,
  Restaurant,
  Person,
  Print,
  Receipt,
  Edit,
  Visibility,
  Delete,
  Cancel,
  LocalOffer,
  Close,
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import htmlPrintService from '../../services/htmlPrintService';
import { loadOrderForEdit, fetchActiveOrders } from '../../store/slices/orderSlice';
import { fetchActiveShift } from '../../store/slices/cashierShiftSlice';
import { setActiveShift } from '../../store/slices/authSlice';

const OrderHistoryDialog = ({ open, onClose }) => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editedItems, setEditedItems] = useState([]);
  const [savingOrder, setSavingOrder] = useState(false);
  const [cancellingOrderId, setCancellingOrderId] = useState(null);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [orderToCancel, setOrderToCancel] = useState(null);

  // Filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [productSearch, setProductSearch] = useState('');

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalOrders, setTotalOrders] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);

  useEffect(() => {
    if (open) {
      fetchOrders();
    }
  }, [open, page, rowsPerPage, dateFrom, dateTo, statusFilter, productSearch]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page + 1,
        limit: rowsPerPage,
      });

      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);
      if (statusFilter) params.append('status', statusFilter);
      if (productSearch) params.append('item_search', productSearch);

      const response = await fetch(`http://localhost:3001/api/orders?${params}`);
      const data = await response.json();

      setOrders(data.orders || []);
      setTotalOrders(data.pagination?.total || 0);
      setTotalAmount(data.totalAmount || 0);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      toast.error('Failed to load order history');
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = async (order, isEdit = false) => {
    try {
      const response = await fetch(`http://localhost:3001/api/orders/${order.id}`);
      const fullOrder = await response.json();
      setSelectedOrder(fullOrder);
      setEditedItems(fullOrder.items || []);
      setEditMode(isEdit);
      setPreviewOpen(true);
    } catch (error) {
      console.error('Failed to load order details:', error);
      toast.error('Failed to load order details');
    }
  };

  const handleEditOrder = async (order, e) => {
    e.stopPropagation();
    try {
      // Fetch full order details
      const response = await fetch(`http://localhost:3001/api/orders/${order.id}`);
      const fullOrder = await response.json();
      
      // Load order into Redux state
      dispatch(loadOrderForEdit(fullOrder));
      
      // Close dialog and navigate to POS
      onClose();
      navigate('/pos');
      
      toast.info('Order loaded for editing. Update items and click "Update Order" to save changes.');
    } catch (error) {
      console.error('Failed to load order for editing:', error);
      toast.error('Failed to load order for editing');
    }
  };

  const handlePreviewOrder = (order, e) => {
    e.stopPropagation();
    handleRowClick(order, false);
  };

  const refreshCashOnHand = async () => {
    if (!user?.id || user.role !== 'cashier') {
      return;
    }

    try {
      const activeShift = await dispatch(fetchActiveShift(user.id)).unwrap();
      dispatch(setActiveShift(activeShift || null));
    } catch (_error) {}
  };

  const handleCancelOrder = async (order, e) => {
    e.stopPropagation();

    if (order.status === 'cancelled') {
      return;
    }

    setOrderToCancel(order);
    setCancelConfirmOpen(true);
  };

  const confirmCancelOrder = async () => {
    const order = orderToCancel;
    if (!order) {
      return;
    }

    setCancellingOrderId(order.id);
    try {
      const response = await fetch(`http://localhost:3001/api/orders/${order.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Failed to cancel order');
      }

      toast.success(data.message || `Order #${order.id} cancelled successfully`);
      if (selectedOrder?.id === order.id) {
        setSelectedOrder((previous) => (previous ? { ...previous, status: 'cancelled' } : previous));
      }

      setCancelConfirmOpen(false);
      setOrderToCancel(null);
      await fetchOrders();
      dispatch(fetchActiveOrders());
      await refreshCashOnHand();
    } catch (error) {
      console.error('Failed to cancel order:', error);
      toast.error(error.message || 'Failed to cancel order');
    } finally {
      setCancellingOrderId(null);
    }
  };

  const handleUpdateItemQuantity = (index, newQty) => {
    if (newQty <= 0) return;
    const updated = [...editedItems];
    updated[index] = { ...updated[index], quantity: newQty, qty: newQty };
    setEditedItems(updated);
  };

  const handleRemoveItem = (index) => {
    const updated = editedItems.filter((_, i) => i !== index);
    setEditedItems(updated);
  };

  const handleSaveEditedOrder = async () => {
    if (editedItems.length === 0) {
      toast.error('Order must have at least one item');
      return;
    }

    setSavingOrder(true);
    try {
      // Calculate new total
      const newTotal = editedItems.reduce((sum, item) => {
        const qty = parseFloat(item.quantity || item.qty || 0);
        const price = parseFloat(item.price || item.unit_price || 0);
        return sum + (qty * price);
      }, 0);

      // Update order
      const response = await fetch(`http://localhost:3001/api/orders/${selectedOrder.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: editedItems.map(item => ({
            item_variant_id: item.item_variant_id,
            qty: item.quantity || item.qty,
            unit_price: item.price || item.unit_price,
            discount_source: item.discount_source || null,
            discount_type: item.item_discount_type || null,
            discount_value: item.item_discount_value || 0,
            discount_amount: item.item_discount_amount || 0,
            original_price: item.original_price || item.price || item.unit_price
          })),
          total_amount: newTotal
        })
      });

      if (!response.ok) throw new Error('Failed to update order');

      toast.success('Order updated successfully!');
      setPreviewOpen(false);
      setEditMode(false);
      fetchOrders(); // Refresh the list
    } catch (error) {
      console.error('Failed to update order:', error);
      toast.error('Failed to update order: ' + error.message);
    } finally {
      setSavingOrder(false);
    }
  };

  const handlePrintBill = async () => {
    if (!selectedOrder) return;

    try {
      const orderData = {
        ...selectedOrder,
        items: selectedOrder.items || [],
        cashier: selectedOrder.staff_name || 'System',
        paymentMethod: selectedOrder.is_card_payment ? 'card' : 'cash',
        amountPaid: selectedOrder.is_card_payment
          ? parseFloat(selectedOrder.total_amount || 0)
          : parseFloat(selectedOrder.tender_cash || 0),
        tender_cash: selectedOrder.tender_cash
      };

      const storeInfo = {
        name: 'Binthanna Restaurant',
        address: 'Kekirihena Mahaoya',
        phone: '076 670 2231',
        receiptFooter: 'Thank you for your visit!'
      };

      // Use the same printer selection path as Place Order printing.
      const preferredPrinterName = 'XP-80C (copy 2)';
      const savedPrinter = localStorage.getItem('selectedPrinter');
      if (!savedPrinter) {
        localStorage.setItem('selectedPrinter', preferredPrinterName);
      }

      let billResult;

      if (htmlPrintService.canDirectPrint()) {
        billResult = await htmlPrintService.printDirectThermal(orderData, storeInfo);
      } else {
        billResult = await htmlPrintService.printBillHTML(orderData, storeInfo);
      }

      if (billResult.success) {
        toast.success('Bill printed successfully');
      } else {
        toast.error(billResult.message || 'Bill printing failed');
      }
    } catch (error) {
      toast.error(`Failed to print bill: ${error.message}`);
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
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'success';
      case 'active': return 'warning';
      case 'cancelled': return 'error';
      default: return 'default';
    }
  };

  const isItemMatching = (item) => {
    if (!productSearch || !productSearch.trim()) return false;
    const searchLower = productSearch.toLowerCase();
    const barcode = (item.barcode || '').toLowerCase();
    const itemName = (item.item_name || '').toLowerCase();
    return barcode.includes(searchLower) || itemName.includes(searchLower);
  };

  const handlePageChange = (event, newPage) => {
    setPage(newPage);
  };

  const handleRowsPerPageChange = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleFilterChange = () => {
    setPage(0); // Reset to first page when filters change
    fetchOrders();
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <History />
              Order History
            </Box>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Button
                onClick={fetchOrders}
                color="primary"
                variant="outlined"
                size="medium"
                disabled={loading}
                startIcon={<Refresh />}
              >
                Refresh
              </Button>
              <Button
                onClick={onClose}
                color="inherit"
                variant="outlined"
                size="medium"
              >
                Close
              </Button>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ overflow: 'visible' }}>
          {/* Filters */}
          <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <TextField
              label="From Date"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              InputLabelProps={{ shrink: true }}
              size="small"
              sx={{ minWidth: 150 }}
            />
            <TextField
              label="To Date"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              InputLabelProps={{ shrink: true }}
              size="small"
              sx={{ minWidth: 150 }}
            />
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                label="Status"
                MenuProps={{
                  PaperProps: {
                    style: {
                      maxHeight: 300,
                    },
                  },
                }}
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="cancelled">Cancelled</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Search by Product"
              type="text"
              placeholder="Barcode or Item Name"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              size="small"
              sx={{ minWidth: 200 }}
            />
            <Button 
              variant="contained" 
              onClick={handleFilterChange}
              size="medium"
            >
              Apply Filters
            </Button>
          </Box>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : orders.length === 0 ? (
            <Box sx={{ textAlign: 'center', p: 4, color: 'text.secondary' }}>
              <History sx={{ fontSize: 60, mb: 2, opacity: 0.3 }} />
              <Typography variant="h6">No orders found</Typography>
              <Typography variant="body2">
                Try adjusting your filters
              </Typography>
            </Box>
          ) : (
            <>
              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'grey.100' }}>
                      <TableCell><strong>Order #</strong></TableCell>
                      <TableCell><strong>Table / Customer</strong></TableCell>
                      <TableCell><strong>Date & Time</strong></TableCell>
                      <TableCell align="right"><strong>Total</strong></TableCell>
                      <TableCell align="center"><strong>Status</strong></TableCell>
                      <TableCell align="center"><strong>Actions</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {orders.map((order) => (
                      <TableRow
                        key={order.id}
                        sx={{
                          '&:hover': { bgcolor: 'action.hover' },
                        }}
                      >
                        <TableCell>
                          <Typography variant="body2" fontWeight="bold">
                            #{order.id}
                          </Typography>
                          {order.is_return ? (
                            <Chip
                              label="Return"
                              size="small"
                              color="secondary"
                              variant="outlined"
                              sx={{ mt: 0.5, height: 20, fontSize: '0.7rem' }}
                            />
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <Box>
                            {order.customer_name && (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Person fontSize="small" color="action" />
                                <Typography variant="body2">
                                  {order.customer_name}
                                </Typography>
                              </Box>
                            )}
                            {!order.customer_name && (
                              <Typography variant="body2" color="text.secondary">
                                N/A
                              </Typography>
                            )}
                            <Chip
                              label={order.is_card_payment ? 'Card' : 'Cash'}
                              size="small"
                              color={order.is_card_payment ? 'info' : 'success'}
                              variant="outlined"
                              sx={{ mt: 0.6, height: 20, fontSize: '0.68rem' }}
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
                          <Chip
                            label={order.is_return ? `return-${order.status}` : order.status}
                            size="small"
                            color={getStatusColor(order.status)}
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
                            <Button
                              size="medium"
                              variant="outlined"
                              color="primary"
                              onClick={(e) => handleEditOrder(order, e)}
                              disabled={!!order.is_return || order.status === 'cancelled'}
                              sx={{ minWidth: 80 }}
                            >
                              Edit
                            </Button>
                            <Button
                              size="medium"
                              variant="outlined"
                              color="info"
                              onClick={(e) => handlePreviewOrder(order, e)}
                              sx={{ minWidth: 80 }}
                            >
                              Preview
                            </Button>
                            <Button
                              size="medium"
                              variant="outlined"
                              color="error"
                              onClick={(e) => handleCancelOrder(order, e)}
                              disabled={order.status === 'cancelled' || cancellingOrderId === order.id}
                              sx={{ minWidth: 80 }}
                            >
                              Cancel
                            </Button>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <TablePagination
                component="div"
                count={totalOrders}
                page={page}
                onPageChange={handlePageChange}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={handleRowsPerPageChange}
                rowsPerPageOptions={[5, 10, 25, 50]}
              />

              {/* Total Amount */}
              <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
                <Typography variant="h6" align="center">
                  Total Orders: {totalOrders} | Total Amount: {formatPrice(totalAmount)}
                </Typography>
              </Box>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={cancelConfirmOpen}
        onClose={() => {
          if (cancellingOrderId) return;
          setCancelConfirmOpen(false);
          setOrderToCancel(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Confirm Cancel Order</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to cancel {orderToCancel?.is_return ? 'return order' : 'order'} #{orderToCancel?.id}?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            This will restore stock allocations and adjust cashier shift cash on hand if needed.
          </Typography>
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
            onClick={confirmCancelOrder}
            color="error"
            variant="contained"
            disabled={!!cancellingOrderId}
          >
            {cancellingOrderId ? 'Cancelling...' : 'Cancel Order'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Order Preview Dialog */}
      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6">
              Order #{selectedOrder?.id} {selectedOrder?.is_return ? '(Return)' : ''} - {editMode ? 'Edit Order' : 'Preview'}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              {!editMode && (
                <>
                  <Button
                    variant="contained"
                    startIcon={<Receipt />}
                    onClick={handlePrintBill}
                    size="small"
                  >
                    Print Bill
                  </Button>
                </>
              )}
              <Button
                onClick={() => setPreviewOpen(false)}
                color="inherit"
                variant="outlined"
                size="medium"
                sx={{ ml: 1 }}
              >
                Close
              </Button>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ overflow: 'visible' }}>
          {selectedOrder && (
            <Box>
              {/* Order Info */}
              <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Chip
                  label={`Status: ${selectedOrder.status}`}
                  color={getStatusColor(selectedOrder.status)}
                />
                {selectedOrder.is_return ? (
                  <Chip label="Return Order" color="secondary" variant="outlined" />
                ) : null}
                {selectedOrder.original_order_id ? (
                  <Chip label={`Original Order: #${selectedOrder.original_order_id}`} variant="outlined" />
                ) : null}
                {selectedOrder.credit_reason ? (
                  <Chip label={`Reason: ${selectedOrder.credit_reason}`} variant="outlined" />
                ) : null}
                {selectedOrder.customer_name && (
                  <Chip icon={<Person />} label={selectedOrder.customer_name} />
                )}
                <Chip label={`Date: ${formatDateTime(selectedOrder.date)}`} />
              </Box>

              {/* Order Items */}
              {editMode && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  <strong>Edit Mode:</strong> Update quantities or remove items. Changes will affect inventory and order total.
                </Alert>
              )}
              <Typography variant="h6" gutterBottom>Order Items</Typography>
              <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Item</strong></TableCell>
                      <TableCell align="center"><strong>Barcode</strong></TableCell>
                      <TableCell align="center"><strong>Qty</strong></TableCell>
                      <TableCell align="right"><strong>Unit Price</strong></TableCell>
                      <TableCell align="center"><strong>Discount</strong></TableCell>
                      <TableCell align="right"><strong>Total</strong></TableCell>
                      {editMode && <TableCell align="center"><strong>Actions</strong></TableCell>}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(editMode ? editedItems : (selectedOrder.items || [])).map((item, index) => {
                      const qty = parseFloat(item.quantity || item.qty || 0);
                      const price = parseFloat(item.price || item.unit_price || 0);
                      const isMatching = isItemMatching(item);
                      return (
                        <TableRow 
                          key={index}
                          sx={{ 
                            bgcolor: isMatching && productSearch ? 'rgba(255, 193, 7, 0.2)' : 'inherit',
                            '&:hover': { bgcolor: isMatching && productSearch ? 'rgba(255, 193, 7, 0.3)' : 'action.hover' }
                          }}
                        >
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Box>
                                <Typography variant="body2" fontWeight="bold">
                                  {item.item_name}
                                </Typography>
                                {item.variant_name && (
                                  <Typography variant="caption" color="text.secondary">
                                    {item.variant_name}
                                  </Typography>
                                )}
                              </Box>
                              {isMatching && productSearch && (
                                <Chip 
                                  label="Match" 
                                  size="small" 
                                  color="warning"
                                  variant="filled"
                                />
                              )}
                            </Box>
                          </TableCell>
                          <TableCell align="center">
                            <Typography variant="caption" sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                              {item.barcode || 'N/A'}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            {editMode ? (
                              <TextField
                                type="number"
                                size="small"
                                value={qty}
                                onChange={(e) => handleUpdateItemQuantity(index, parseFloat(e.target.value) || 0)}
                                inputProps={{ min: 1, style: { textAlign: 'center', width: '60px' } }}
                              />
                            ) : (
                              qty
                            )}
                          </TableCell>
                          <TableCell align="right">
                            {item.original_price && parseFloat(item.original_price) > price ? (
                              <Box>
                                <Typography variant="caption" sx={{ textDecoration: 'line-through', color: 'text.secondary' }}>
                                  {formatPrice(item.original_price)}
                                </Typography>
                                <Typography variant="body2">{formatPrice(price)}</Typography>
                              </Box>
                            ) : (
                              formatPrice(price)
                            )}
                          </TableCell>
                          <TableCell align="center">
                            {item.item_discount_amount && parseFloat(item.item_discount_amount) > 0 ? (
                              <Chip
                                icon={<LocalOffer />}
                                label={`${item.discount_source || ''} ${item.item_discount_type === 'percentage' ? `${item.item_discount_value}%` : formatPrice(item.item_discount_value)}`}
                                size="small"
                                color={item.discount_source === 'item' ? 'secondary' : item.discount_source === 'brand' ? 'primary' : item.discount_source === 'manual' ? 'warning' : 'success'}
                                variant="outlined"
                              />
                            ) : (
                              <Typography variant="caption" color="text.secondary">-</Typography>
                            )}
                          </TableCell>
                          <TableCell align="right">{formatPrice(qty * price)}</TableCell>
                          {editMode && (
                            <TableCell align="center">
                              <Tooltip title="Remove item">
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => handleRemoveItem(index)}
                                  disabled={editedItems.length === 1}
                                >
                                  <Delete fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Order Summary */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom>Order Summary</Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table>
                    <TableBody>
                      {/* Subtotal */}
                      <TableRow>
                        <TableCell><strong>Subtotal</strong></TableCell>
                        <TableCell align="right">
                          {formatPrice((editMode ? editedItems : (selectedOrder.items || [])).reduce((sum, item) => {
                            const qty = parseFloat(item.quantity || item.qty || 0);
                            const price = parseFloat(item.original_price || item.price || item.unit_price || 0);
                            return sum + (qty * price);
                          }, 0))}
                        </TableCell>
                      </TableRow>

                      {/* Item Discounts */}
                      {(() => {
                        const totalItemDiscounts = (selectedOrder.items || []).reduce((sum, item) => {
                          const qty = parseFloat(item.quantity || item.qty || 0);
                          const amt = parseFloat(item.item_discount_amount || 0);
                          return sum + (amt * qty);
                        }, 0);
                        return totalItemDiscounts > 0 ? (
                          <TableRow>
                            <TableCell sx={{ color: 'error.main' }}>Item Discounts</TableCell>
                            <TableCell align="right" sx={{ color: 'error.main' }}>
                              - {formatPrice(totalItemDiscounts)}
                            </TableCell>
                          </TableRow>
                        ) : null;
                      })()}

                      {/* Additional Charges */}
                      <TableRow>
                        <TableCell>Additional Charges</TableCell>
                        <TableCell align="right">
                          {selectedOrder.additional_charges && parseFloat(selectedOrder.additional_charges) > 0 ? formatPrice(selectedOrder.additional_charges) : '00'}
                        </TableCell>
                      </TableRow>

                      {/* Discount */}
                      {(() => {
                        const subtotal = (selectedOrder.items || []).reduce((sum, item) => sum + (item.qty * item.unit_price), 0);
                        const additionalCharges = parseFloat(selectedOrder.additional_charges || 0);
                        const discountValue = parseFloat(selectedOrder.discount_value || 0);
                        let actualDiscount = 0;
                        if (selectedOrder.discount_type === 'percent') {
                          actualDiscount = (subtotal * discountValue) / 100;
                        } else if (selectedOrder.discount_type === 'fixed') {
                          actualDiscount = discountValue;
                        }
                        return actualDiscount > 0 ? (
                          <TableRow>
                            <TableCell>Discount</TableCell>
                            <TableCell align="right" sx={{ color: 'error.main' }}>
                              {selectedOrder.discount_type === 'percent' ? `${discountValue}% / ${formatPrice(actualDiscount)}` : `-${formatPrice(actualDiscount)}`}
                            </TableCell>
                          </TableRow>
                        ) : null;
                      })()}

                      {/* Cash Tender */}
                      {selectedOrder.tender_cash && parseFloat(selectedOrder.tender_cash) > 0 && (
                        <TableRow>
                          <TableCell>Cash Tendered</TableCell>
                          <TableCell align="right">
                            {formatPrice(selectedOrder.tender_cash)}
                          </TableCell>
                        </TableRow>
                      )}

                      {/* Change */}
                      {selectedOrder.tender_cash && selectedOrder.tender_cash > selectedOrder.total_amount && (
                        <TableRow>
                          <TableCell>Change</TableCell>
                          <TableCell align="right" sx={{ color: 'success.main' }}>
                            {formatPrice(selectedOrder.tender_cash - selectedOrder.total_amount)}
                          </TableCell>
                        </TableRow>
                      )}

                      {/* Total */}
                      <TableRow sx={{ bgcolor: 'grey.100' }}>
                        <TableCell><strong>Total Amount</strong></TableCell>
                        <TableCell align="right">
                          <Typography variant="h6" color="primary" fontWeight="bold">
                            {formatPrice(selectedOrder.total_amount)}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          {editMode && (
            <>
              <Button 
                onClick={() => {
                  setEditMode(false);
                  setEditedItems(selectedOrder.items || []);
                }}
                disabled={savingOrder}
                variant="outlined"
                size="large"
                sx={{ minWidth: 120 }}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSaveEditedOrder}
                variant="contained"
                color="primary"
                disabled={savingOrder || editedItems.length === 0}
                size="large"
                sx={{ minWidth: 120 }}
              >
                {savingOrder ? 'Saving...' : 'Save Changes'}
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
};

export default OrderHistoryDialog;