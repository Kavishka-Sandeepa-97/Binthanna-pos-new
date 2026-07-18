import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Select,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Add,
  Remove,
  Delete,
  Payment,
  Person,
  Receipt,
  ShoppingCart,
  Refresh,
  LocalOffer,
  Edit as EditIcon,
  Restaurant,
} from '@mui/icons-material';
import {
  updateItemQuantity,
  removeItemFromOrder,
  setDiscount,
  resetItemDiscount,
  updateItemDiscount,
  clearCurrentOrder,
  createOrder,
  updateOrder,
  fetchActiveOrders,
  setReturnReason,
} from '../../store/slices/orderSlice';
import { fetchItemVariants } from '../../store/slices/inventorySlice';
import { fetchActiveShift } from '../../store/slices/cashierShiftSlice';
import { setActiveShift } from '../../store/slices/authSlice';
import api from '../../services/api';
import { toast } from 'react-toastify';
import htmlPrintService from '../../services/htmlPrintService';
import SetActiveDialog from './SetActiveDialog';

const OrderSummary = ({ view = 'full' }) => {
  const dispatch = useDispatch();
  const { currentOrder, loading } = useSelector((state) => state.order);
  const { user, activeShift } = useSelector((state) => state.auth);

  const [paymentDialog, setPaymentDialog] = useState(false);
  const [setActiveDialogOpen, setSetActiveDialogOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [amountPaid, setAmountPaid] = useState('');
  const [discountType, setDiscountType] = useState('fixed');
  const [discountValue, setDiscountValue] = useState('');
  const [showDiscountControls, setShowDiscountControls] = useState(false);
  const [completedOrder, setCompletedOrder] = useState(null);
  const [previewHtml, setPreviewHtml] = useState('');
  const [editDiscountItem, setEditDiscountItem] = useState(null);
  const [editDiscountType, setEditDiscountType] = useState('percentage');
  const [editDiscountValue, setEditDiscountValue] = useState('');
  const [globalDiscountSettings, setGlobalDiscountSettings] = useState(null);
  const [blinkLineKey, setBlinkLineKey] = useState(null);
  const itemsScrollRef = useRef(null);
  const previousItemsCountRef = useRef(currentOrder.items.length);

  const hasReturnItems = currentOrder.isReturnOrder && (currentOrder.returnedItems || []).length > 0;
  const hasOrderContent = currentOrder.items.length > 0 || hasReturnItems;
  const showItemsSection = view === 'full' || view === 'items';
  const showTotalsSection = view === 'full' || view === 'totals';
  const effectivePaymentMethod = paymentMethod || currentOrder.paymentMethod || 'cash';
  const requiresCashTender = currentOrder.total > 0 && effectivePaymentMethod === 'cash';
  const paidAmount = parseFloat(amountPaid || 0) || 0;
  const change = paidAmount - currentOrder.total;

  const dialogTotal = parseFloat(completedOrder?.total || 0) || 0;
  const previewPaidAmount = parseFloat(completedOrder?.amountPaid ?? amountPaid ?? 0) || 0;
  const dialogChange = previewPaidAmount - dialogTotal;
  const isGlobalDiscountActive = !!globalDiscountSettings?.is_global_discount_active;

  const getStoreInfo = () => ({
    name: 'Binthanna Restaurant',
    address: 'Kekirihena Mahaoya',
    phone: '076 670 2231 ',
    receiptFooter: 'Thank you Come Again..!',
    currencySymbol: 'Rs',
  });

  const globalDiscountIndicatorLabel = isGlobalDiscountActive
    ? `Auto: ${globalDiscountSettings?.global_discount_type === 'percentage'
      ? `${parseFloat(globalDiscountSettings?.global_discount_value || 0)}%`
      : `Rs. ${Number(parseFloat(globalDiscountSettings?.global_discount_value || 0) || 0).toFixed(2)}`}`
    : '';

  const effectiveOrderDiscount = useMemo(() => {
    const safeSubtotal = parseFloat(currentOrder.subtotal || 0) || 0;
    const safeDiscountType = discountType || null;
    const safeDiscountValue = parseFloat(discountValue || 0) || 0;

    if (!safeDiscountType || safeDiscountValue <= 0 || currentOrder.items.length === 0) {
      return {
        discountType: null,
        discountValue: 0,
        discountAmount: 0,
        blockedByMinimum: false,
        minimumOrderAmount: 0,
      };
    }

    const roundToTwo = (value) => Math.round(value * 100) / 100;

    if (globalDiscountSettings?.is_global_discount_active) {
      const globalType = globalDiscountSettings.global_discount_type === 'percentage' ? 'percent' : 'fixed';
      const globalValue = parseFloat(globalDiscountSettings.global_discount_value || 0) || 0;
      const minimumOrderAmount = parseFloat(globalDiscountSettings.min_order_amount || 0) || 0;
      const matchesGlobalConfig =
        safeDiscountType === globalType
        && Math.abs(safeDiscountValue - globalValue) < 0.0001;

      if (matchesGlobalConfig && safeSubtotal < minimumOrderAmount) {
        return {
          discountType: null,
          discountValue: 0,
          discountAmount: 0,
          blockedByMinimum: true,
          minimumOrderAmount,
        };
      }
    }

    const computedAmount = safeDiscountType === 'percent'
      ? roundToTwo((safeDiscountValue / 100) * safeSubtotal)
      : roundToTwo(safeDiscountValue);

    return {
      discountType: safeDiscountType,
      discountValue: safeDiscountValue,
      discountAmount: computedAmount,
      blockedByMinimum: false,
      minimumOrderAmount: 0,
    };
  }, [
    currentOrder.isReturnOrder,
    currentOrder.items.length,
    currentOrder.subtotal,
    discountType,
    discountValue,
    globalDiscountSettings,
  ]);

  useEffect(() => {
    api.globalDiscount.get().then((settings) => {
      setGlobalDiscountSettings(settings);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (globalDiscountSettings?.is_global_discount_active && parseFloat(globalDiscountSettings.global_discount_value) > 0) {
      const gType = globalDiscountSettings.global_discount_type;
      const gValue = parseFloat(globalDiscountSettings.global_discount_value);
      const minOrderAmount = parseFloat(globalDiscountSettings.min_order_amount || 0) || 0;
      const hasItems = currentOrder.items.length > 0;
      const meetsMinOrder = currentOrder.subtotal >= minOrderAmount;
      const uiType = gType === 'percentage' ? 'percent' : 'fixed';

      if (discountType !== uiType) {
        setDiscountType(uiType);
      }
      if (discountValue !== String(gValue)) {
        setDiscountValue(String(gValue));
      }

      const computedDiscount = hasItems && meetsMinOrder
        ? (uiType === 'percent'
          ? Math.round((gValue / 100) * currentOrder.subtotal * 100) / 100
          : Math.round(gValue * 100) / 100)
        : 0;

      if (Math.abs((parseFloat(currentOrder.discount) || 0) - computedDiscount) > 0.001) {
        dispatch(setDiscount(computedDiscount));
      }
    }
  }, [currentOrder.isReturnOrder, currentOrder.discount, globalDiscountSettings, currentOrder.items.length, currentOrder.subtotal, discountType, discountValue, dispatch]);

  useEffect(() => {
    if (!paymentDialog && currentOrder.items.length === 0 && !hasReturnItems && !currentOrder.id) {
      setDiscountType('fixed');
      setDiscountValue('');
      setAmountPaid('');
      setPaymentMethod('cash');
    }
  }, [currentOrder.items.length, currentOrder.id, hasReturnItems, paymentDialog]);

  useEffect(() => {
    if (currentOrder.paymentMethod) {
      setPaymentMethod(currentOrder.paymentMethod);
    }
  }, [currentOrder.paymentMethod]);

  useEffect(() => {
    if (effectivePaymentMethod !== 'cash' && requiresCashTender === false) {
      setAmountPaid('');
    }
  }, [effectivePaymentMethod, requiresCashTender]);

  useEffect(() => {
    const currentCount = currentOrder.items.length;
    const previousCount = previousItemsCountRef.current;

    if (showItemsSection && currentCount > previousCount && itemsScrollRef.current) {
      const newestItem = currentOrder.items[currentOrder.items.length - 1];
      if (newestItem?.lineKey) {
        setBlinkLineKey(newestItem.lineKey);
        setTimeout(() => setBlinkLineKey(null), 900);
      }

      requestAnimationFrame(() => {
        itemsScrollRef.current.scrollTo({
          top: 0,
          behavior: 'auto',
        });
      });
    }

    previousItemsCountRef.current = currentCount;
  }, [currentOrder.items.length, showItemsSection]);

  const formatPrice = (price) => {
    const parsedPrice = parseFloat(price);
    return `Rs. ${Number.isFinite(parsedPrice) ? parsedPrice.toFixed(2) : '0.00'}`;
  };

  const getDiscountVisual = (discountSource) => {
    switch (discountSource) {
      case 'item':
        return { border: '#ef5350', bg: '#ffebee', priceBg: '#ffebee', priceColor: '#b71c1c' };
      case 'brand':
        return { border: '#ab47bc', bg: '#f3e5f5', priceBg: '#f3e5f5', priceColor: '#6a1b9a' };
      case 'manual':
        return { border: '#29b6f6', bg: '#e1f5fe', priceBg: '#e1f5fe', priceColor: '#01579b' };
      case 'global':
        return { border: '#ffb300', bg: '#fff8e1', priceBg: '#fff8e1', priceColor: '#e65100' };
      default:
        return { border: '#e0e0e0', bg: '#ffffff', priceBg: '#e3f2fd', priceColor: '#0d47a1' };
    }
  };

  const isValidDecimalInput = (value) => value === '' || /^\d*\.?\d{0,2}$/.test(value);

  const mapOrderItems = (items) => items.map((item) => ({
    item_variant_id: item.itemVariantId,
    qty: item.quantity,
    unit_price: item.price,
    original_price: item.originalPrice || item.price,
    discount_source: item.discountSource || null,
    discount_type: item.discountType || null,
    discount_value: item.discountValue || 0,
    discount_amount: item.discountAmount || 0,
    preferred_batch_id: item.preferredBatchId || null,
  }));

  const mapReturnItems = (returnedItems) => returnedItems.map((item) => ({
    source_order_item_id: item.source_order_item_id || null,
    item_variant_id: item.item_variant_id,
    qty: item.qty,
    unit_price: item.unit_price,
    original_price: item.original_price || item.unit_price,
    batch_allocations: Array.isArray(item.batch_allocations) ? item.batch_allocations : [],
    description: item.reason || item.description || null,
  }));

  const resetOrderUiState = () => {
    setDiscountType('fixed');
    setDiscountValue('');
    setShowDiscountControls(false);
    setAmountPaid('');
    setPaymentMethod('cash');
    setEditDiscountItem(null);
    setEditDiscountValue('');
    setCompletedOrder(null);
    setPreviewHtml('');
  };

  const refreshCashOnHand = async () => {
    if (!user?.id || user.role !== 'cashier') {
      return;
    }

    try {
      const activeShiftData = await dispatch(fetchActiveShift(user.id)).unwrap();
      dispatch(setActiveShift(activeShiftData || null));
    } catch (_error) {}
  };

  const handleQuantityChange = (item, newQuantity) => {
    const lineKey = item.lineKey;

    if (newQuantity <= 0) {
      dispatch(removeItemFromOrder(lineKey));
    } else {
      const otherVariantQty = currentOrder.items
        .filter((orderItem) => orderItem.itemVariantId === item.itemVariantId && orderItem.lineKey !== lineKey)
        .reduce((sum, orderItem) => sum + (parseFloat(orderItem.quantity || 0) || 0), 0);

      const maxByVariant = item.maxVariantStock !== null && item.maxVariantStock !== undefined
        ? Math.max(0, item.maxVariantStock - otherVariantQty)
        : Number.POSITIVE_INFINITY;

      const maxByBatch = item.preferredBatchId && item.maxBatchQty !== null && item.maxBatchQty !== undefined
        ? item.maxBatchQty
        : Number.POSITIVE_INFINITY;

      const maxAllowed = Math.floor(Math.min(maxByVariant, maxByBatch));

      if (Number.isFinite(maxAllowed) && newQuantity > maxAllowed) {
        const scope = item.preferredBatchId ? 'in the selected batch' : 'in stock';
        toast.error(`Only ${maxAllowed} available ${scope}`);
        return;
      }

      dispatch(updateItemQuantity({ lineKey, quantity: newQuantity }));
    }
  };

  const handleUpdateOrder = async () => {
    if (currentOrder.isReturnOrder) {
      toast.error('Return orders cannot be edited. Please create a new return order.');
      return;
    }

    if (currentOrder.items.length === 0) {
      toast.error('Order must have at least one item');
      return;
    }

    try {
      const orderData = {
        staff_id: user.id,
        items: mapOrderItems(currentOrder.items),
        additional_charges: currentOrder.additionalCharges,
        customer_name: currentOrder.customerName,
        tender_cash: effectivePaymentMethod === 'cash'
          ? (parseFloat(amountPaid) || currentOrder.total)
          : 0,
        is_card_payment: effectivePaymentMethod === 'card',
        discount_type: effectiveOrderDiscount.discountType,
        discount_value: effectiveOrderDiscount.discountValue,
        status: currentOrder.originalStatus || 'completed',
      };

      await dispatch(updateOrder({ orderId: currentOrder.id, orderData })).unwrap();
      toast.success(`Order #${currentOrder.id} updated successfully!`);

      dispatch(fetchItemVariants());
      dispatch(fetchActiveOrders());
      await refreshCashOnHand();
      dispatch(clearCurrentOrder());
      resetOrderUiState();
    } catch (error) {
      toast.error(`Failed to update order: ${error.message}`);
    }
  };

  const handlePlaceOrder = async () => {
    if (!hasOrderContent) {
      return;
    }

    if (requiresCashTender && (!amountPaid || change < 0)) {
      toast.error('Enter a valid tendered amount');
      return;
    }

    if (currentOrder.isReturnOrder && !currentOrder.originalOrderId) {
      toast.error('Return order must be linked to an original order');
      return;
    }

    try {
      let result;
      const tenderCash = requiresCashTender ? parseFloat(amountPaid || 0) : 0;

      if (currentOrder.id && !currentOrder.isReturnOrder) {
        const orderData = {
          staff_id: user.id,
          items: mapOrderItems(currentOrder.items),
          additional_charges: currentOrder.additionalCharges,
          customer_name: currentOrder.customerName,
          table_number: currentOrder.tableNumber || null,
          tender_cash: tenderCash,
          is_card_payment: effectivePaymentMethod === 'card',
          discount_type: effectiveOrderDiscount.discountType,
          discount_value: effectiveOrderDiscount.discountValue,
          status: 'completed',
        };

        result = await dispatch(updateOrder({ orderId: currentOrder.id, orderData })).unwrap();
        toast.success(`Order #${currentOrder.id} completed`);
      } else {
        const orderData = currentOrder.isReturnOrder
          ? {
              staff_id: user.id,
              items: mapOrderItems(currentOrder.items),
              return_items: mapReturnItems(currentOrder.returnedItems || []),
              additional_charges: currentOrder.additionalCharges,
              customer_name: currentOrder.customerName,
              tender_cash: tenderCash,
              is_card_payment: effectivePaymentMethod === 'card',
              discount_type: null,
              discount_value: 0,
              status: 'completed',
              is_return: true,
              original_order_id: currentOrder.originalOrderId,
              credit_reason: currentOrder.returnReason || null,
              credit_applied: Math.max(currentOrder.total, 0),
            }
          : {
              staff_id: user.id,
              items: mapOrderItems(currentOrder.items),
              additional_charges: currentOrder.additionalCharges,
              customer_name: currentOrder.customerName,
              table_number: currentOrder.tableNumber || null,
              tender_cash: tenderCash,
              is_card_payment: effectivePaymentMethod === 'card',
              discount_type: effectiveOrderDiscount.discountType,
              discount_value: effectiveOrderDiscount.discountValue,
              status: 'completed',
            };

        result = await dispatch(createOrder(orderData)).unwrap();
      }

      dispatch(fetchItemVariants());
      dispatch(fetchActiveOrders());
      await refreshCashOnHand();

      setCompletedOrder({
        ...currentOrder,
        id: result.id,
        barcode: result.barcode || currentOrder.barcode || null,
        total: currentOrder.total,
        discount_type: currentOrder.isReturnOrder ? null : effectiveOrderDiscount.discountType,
        discount_value: currentOrder.isReturnOrder ? 0 : effectiveOrderDiscount.discountValue,
        paymentMethod: effectivePaymentMethod,
        amountPaid: effectivePaymentMethod === 'cash' ? tenderCash : currentOrder.total,
        tender_cash: tenderCash,
        is_card_payment: effectivePaymentMethod === 'card',
        cashier: user?.name || 'System',
        is_return: currentOrder.isReturnOrder,
      });

      const orderForPreview = {
        ...currentOrder,
        id: result.id,
        barcode: result.barcode || currentOrder.barcode || null,
        total: currentOrder.total,
        discount_type: currentOrder.isReturnOrder ? null : effectiveOrderDiscount.discountType,
        discount_value: currentOrder.isReturnOrder ? 0 : effectiveOrderDiscount.discountValue,
        paymentMethod: effectivePaymentMethod,
        amountPaid: effectivePaymentMethod === 'cash' ? tenderCash : currentOrder.total,
        tender_cash: tenderCash,
        is_card_payment: effectivePaymentMethod === 'card',
        cashier: user?.name || 'System',
        is_return: currentOrder.isReturnOrder,
      };

      setPreviewHtml(htmlPrintService.getReceiptHTML(orderForPreview, getStoreInfo()));

      if (!requiresCashTender) {
        setAmountPaid('0');
      }

      dispatch(clearCurrentOrder());
      setPaymentDialog(true);
    } catch (error) {
      toast.error(`Failed to complete order: ${error.message}`);
    }
  };

  const handleSetAsActive = async ({ customerName, tableNumber }) => {
    if (currentOrder.isReturnOrder) {
      toast.error('Return orders must be completed directly. Active mode is disabled.');
      return;
    }

    if (currentOrder.items.length === 0) {
      return;
    }

    const orderData = {
      staff_id: user.id,
      items: mapOrderItems(currentOrder.items),
      additional_charges: currentOrder.additionalCharges,
      customer_name: customerName || null,
      table_number: tableNumber || null,
      is_card_payment: effectivePaymentMethod === 'card',
      discount_type: effectiveOrderDiscount.discountType,
      discount_value: effectiveOrderDiscount.discountValue,
      status: 'active',
    };

    try {
      if (currentOrder.id) {
        await dispatch(updateOrder({ orderId: currentOrder.id, orderData })).unwrap();
        toast.success(`Order #${currentOrder.id} updated`);
      } else {
        const result = await dispatch(createOrder(orderData)).unwrap();
        toast.success(`Order #${result.id} set as active`);
      }

      dispatch(clearCurrentOrder());
      dispatch(fetchItemVariants());
      dispatch(fetchActiveOrders());
      resetOrderUiState();
      setSetActiveDialogOpen(false);
    } catch (error) {
      toast.error(`Failed to set order as active: ${error.message}`);
    }
  };

  const handlePaymentConfirm = async () => {
    try {
      const storeInfo = getStoreInfo();

      const orderData = completedOrder || {
        ...currentOrder,
        id: Date.now(),
        paymentMethod,
        amountPaid: parseFloat(amountPaid) || currentOrder.total,
        cashier: user?.name || 'System',
        tender_cash: parseFloat(amountPaid) || currentOrder.total,
      };

      const preferredPrinterName = 'XP-80C (copy 2)';
      const savedPrinter = localStorage.getItem('selectedPrinter');
      const printerToUse = savedPrinter || preferredPrinterName;
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
        toast.success('Bill printed successfully!');
        dispatch(clearCurrentOrder());
        dispatch(fetchActiveOrders());
        setPaymentDialog(false);
        resetOrderUiState();
      } else {
        toast.error(billResult.message || billResult.error || `Printer not connected. Check ${printerToUse}.`);
      }
    } catch (error) {
      toast.error(`Failed to print bill: ${error.message}`);
    }
  };

  const handleClosePreview = () => {
    setPaymentDialog(false);
    resetOrderUiState();
  };

  const returnCreditLines = useMemo(() => {
    return (currentOrder.returnedItems || []).map((item, index) => {
      const qty = parseFloat(item.qty || 0) || 0;
      const unitPrice = parseFloat(item.unit_price || 0) || 0;
      return {
        key: `${item.item_variant_id || 'item'}-${index}`,
        title: `${item.item_name || 'Item'}${item.variant_name ? ` (${item.variant_name})` : ''}`,
        qty,
        unitPrice,
        lineTotal: qty * unitPrice,
      };
    });
  }, [currentOrder.returnedItems]);

  return (
    <>
      <Card
        sx={{
          height: '93vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'auto',
        }}
      >
        <CardContent
          sx={{
            flexGrow: 1,
            display: 'flex',
            flexDirection: 'column',
            p: view === 'items' ? 0 : 2,
            '&:last-child': {
              pb: view === 'items' ? 0 : 2,
            },
          }}
        >
          {showItemsSection && user?.role === 'cashier' && !activeShift && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              <Typography variant="body2">
                <strong>No Active Shift:</strong> You must open a cashier shift to process orders.
              </Typography>
            </Alert>
          )}

          {showItemsSection && currentOrder.isEditing && (
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2">
                <strong>Editing Order #{currentOrder.id}</strong> - Make changes and click "Update Order" to save.
              </Typography>
            </Alert>
          )}

          {showItemsSection && currentOrder.isReturnOrder && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              <Typography variant="body2">
                <strong>Return Order Mode</strong>
                {currentOrder.originalOrderId ? ` - Original Order #${currentOrder.originalOrderId}` : ''}. Add items to exchange.
              </Typography>
            </Alert>
          )}

          {showItemsSection && (currentOrder.id || currentOrder.customerName || currentOrder.tableNumber) && (
            <Box sx={{ mb: 2, px: view === 'items' ? 2 : 0, pt: view === 'items' ? 2 : 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
              <Typography variant="subtitle1" fontWeight="bold">
                {currentOrder.id ? `Order #${currentOrder.id}` : 'Current Order'}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                {currentOrder.customerName ? <Chip icon={<Person />} label={currentOrder.customerName} size="small" /> : null}
                {currentOrder.tableNumber ? <Chip icon={<Restaurant sx={{ fontSize: '0.9rem' }} />} label={currentOrder.tableNumber} color="secondary" size="small" /> : null}
                {currentOrder.barcode ? <Chip label={currentOrder.barcode} size="small" variant="outlined" /> : null}
              </Box>
            </Box>
          )}

          {showItemsSection && (
            <Box ref={itemsScrollRef} className="scrollbar-thin" sx={{ flexGrow: 1, bgcolor: '#f5f5f5', overflowY: 'auto' }}>
            {currentOrder.items.length === 0 ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', color: 'text.secondary' }}>
                <ShoppingCart sx={{ fontSize: 60, mb: 2, opacity: 0.5 }} />
                <Typography variant="body1">No new sale items</Typography>
              </Box>
            ) : (
              <List dense>
                {[...currentOrder.items].reverse().map((item, index) => {
                  const discountVisual = item.discountSource
                    ? getDiscountVisual(item.discountSource)
                    : getDiscountVisual(null);

                  return (
                  <ListItem
                    key={item.lineKey || `${item.itemVariantId}-${index}`}
                    sx={{
                      border: `2px solid ${discountVisual.border}`,
                      borderRadius: 1,
                      mb: 0.8,
                      p: 0.9,
                      bgcolor: discountVisual.bg,
                      height: 124,
                      overflow: 'hidden',
                      transition: 'background-color 220ms ease, box-shadow 220ms ease',
                      '& .MuiListItemText-root': {
                        m: 0,
                      },
                      ...(item.lineKey === blinkLineKey && {
                        animation: 'newItemBlink 0.32s ease-in-out 3',
                        '@keyframes newItemBlink': {
                          '0%': {
                            boxShadow: '0 0 0 rgba(46, 125, 50, 0)',
                            backgroundColor: discountVisual.bg,
                          },
                          '50%': {
                            boxShadow: '0 0 0 4px rgba(46, 125, 50, 0.42)',
                            backgroundColor: '#e8f5e9',
                            borderColor: '#2e7d32',
                          },
                          '100%': {
                            boxShadow: '0 0 0 rgba(46, 125, 50, 0)',
                            backgroundColor: discountVisual.bg,
                          },
                        },
                      }),
                    }}
                  >
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'nowrap', minWidth: 0 }}>
                          <Box
                            sx={{
                              minWidth: 24,
                              height: 24,
                              borderRadius: '50%',
                              bgcolor: '#1976d2',
                              color: '#fff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              flexShrink: 0,
                            }}
                          >
                            {currentOrder.items.length - index}
                          </Box>
                          <Typography variant="subtitle2" fontWeight="bold" noWrap sx={{ lineHeight: 1.2, flex: 1, minWidth: 0 }}>
                            {item.itemName} {item.variantName && <span style={{ fontWeight: 'normal', color: '#666' }}>({item.variantName})</span>}
                          </Typography>
                          {item.discountSource && (
                            <Chip
                              icon={<LocalOffer sx={{ fontSize: '0.6rem !important' }} />}
                              label={`${item.discountSource === 'item' ? 'Item' : item.discountSource === 'brand' ? 'Brand' : item.discountSource === 'manual' ? 'Manual' : 'Global'}: ${item.discountType === 'percentage' ? item.discountValue + '%' : 'Rs.' + item.discountValue}`}
                              size="small"
                              color={item.discountSource === 'item' ? 'error' : item.discountSource === 'brand' ? 'secondary' : item.discountSource === 'manual' ? 'info' : 'warning'}
                              sx={{ height: 22, fontSize: '0.72rem', '& .MuiChip-icon': { ml: '4px' } }}
                            />
                          )}
                        </Box>
                      }
                      secondary={
                        <Box>
                          {item.discountAmount > 0 && item.originalPrice && (
                            <Typography variant="caption" sx={{ color: 'error.main', textDecoration: 'line-through', mr: 1 }}>
                              {formatPrice(item.originalPrice)}
                            </Typography>
                          )}
                          <Typography variant="caption" noWrap sx={{ color: 'text.secondary', display: 'block' }}>
                            Unit: {formatPrice(item.price)}{item.preferredBatchId ? ` | Batch #${item.preferredBatchId}` : ''}
                          </Typography>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.9 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <IconButton
                                size="small"
                                onClick={() => handleQuantityChange(item, item.quantity - 1)}
                                sx={{
                                  width: 36,
                                  height: 36,
                                  borderRadius: 1.2,
                                  border: '1px solid #90a4ae',
                                  bgcolor: '#eceff1',
                                }}
                              >
                                <Remove sx={{ fontSize: '1.1rem', fontWeight: 700 }} />
                              </IconButton>
                              <Typography variant="body2" fontWeight="bold" sx={{ fontSize: '1rem', minWidth: 18, textAlign: 'center' }}>
                                {item.quantity}
                              </Typography>
                              <IconButton
                                size="small"
                                onClick={() => handleQuantityChange(item, item.quantity + 1)}
                                sx={{
                                  width: 36,
                                  height: 36,
                                  borderRadius: 1.2,
                                  border: '1px solid #66bb6a',
                                  bgcolor: '#e8f5e9',
                                }}
                              >
                                <Add sx={{ fontSize: '1.1rem', fontWeight: 700 }} />
                              </IconButton>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                              <Typography
                                variant="body2"
                                fontWeight="bold"
                                sx={{
                                  fontSize: '1rem',
                                  px: 1.1,
                                  py: 0.4,
                                  borderRadius: 1,
                                  bgcolor: discountVisual.priceBg,
                                  color: discountVisual.priceColor,
                                }}
                              >
                                {formatPrice(item.total)}
                              </Typography>
                              <Tooltip title="Edit Discount">
                                <span>
                                  <IconButton
                                    size="small"
                                    color="primary"
                                    onClick={() => {
                                      setEditDiscountItem(item.lineKey);
                                      setEditDiscountType(item.discountType || 'percentage');
                                      setEditDiscountValue(item.discountValue || '');
                                    }}
                                    sx={{ width: 34, height: 34, borderRadius: 1, bgcolor: '#e3f2fd' }}
                                  >
                                    <EditIcon sx={{ fontSize: '1rem' }} />
                                  </IconButton>
                                </span>
                              </Tooltip>
                              <Tooltip title="Reset to original price">
                                <span>
                                  <IconButton
                                    size="small"
                                    color="warning"
                                    disabled={!item.discountSource}
                                    onClick={() => dispatch(resetItemDiscount(item.lineKey))}
                                    sx={{ width: 34, height: 34, borderRadius: 1, bgcolor: '#fff8e1' }}
                                  >
                                    <Refresh sx={{ fontSize: '1rem' }} />
                                  </IconButton>
                                </span>
                              </Tooltip>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => dispatch(removeItemFromOrder(item.lineKey))}
                                sx={{ width: 34, height: 34, borderRadius: 1, bgcolor: '#ffebee' }}
                              >
                                <Delete sx={{ fontSize: '1rem' }} />
                              </IconButton>
                            </Box>
                          </Box>

                          {editDiscountItem === item.lineKey && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5, p: 0.5, bgcolor: '#f0f4ff', borderRadius: 1 }}>
                              <Select
                                size="small"
                                value={editDiscountType}
                                onChange={(event) => setEditDiscountType(event.target.value)}
                                sx={{ minWidth: 80, height: 28, fontSize: '0.75rem' }}
                              >
                                <MenuItem value="percentage">%</MenuItem>
                                <MenuItem value="fixed">Rs.</MenuItem>
                              </Select>
                              <TextField
                                size="small"
                                type="text"
                                value={editDiscountValue}
                                onChange={(event) => {
                                  const nextValue = event.target.value;
                                  if (isValidDecimalInput(nextValue)) {
                                    setEditDiscountValue(nextValue);
                                  }
                                }}
                                placeholder="Value"
                                sx={{ width: 70 }}
                                inputProps={{ inputMode: 'decimal', style: { fontSize: '0.75rem', padding: '4px 8px' } }}
                              />
                              <Button
                                size="small"
                                variant="contained"
                                onClick={() => {
                                  dispatch(updateItemDiscount({
                                    lineKey: item.lineKey,
                                    discountType: editDiscountType,
                                    discountValue: parseFloat(editDiscountValue) || 0,
                                  }));
                                  setEditDiscountItem(null);
                                }}
                                sx={{ minWidth: 40, height: 28, fontSize: '0.7rem', p: 0 }}
                              >
                                OK
                              </Button>
                              <Button size="small" onClick={() => setEditDiscountItem(null)} sx={{ minWidth: 30, height: 28, fontSize: '0.7rem', p: 0 }}>
                                X
                              </Button>
                            </Box>
                          )}
                        </Box>
                      }
                    />
                  </ListItem>
                );
                })}
              </List>
            )}
            </Box>
          )}

          {showItemsSection && hasReturnItems && (
            <Box sx={{ mt: 1, p: 1, border: '1px dashed #d81b60', borderRadius: 1, bgcolor: '#fff4f8' }}>
              <Typography variant="subtitle2" sx={{ color: '#ad1457', mb: 0.5 }}>
                Returned Items Credit
              </Typography>
              {returnCreditLines.map((line) => (
                <Box key={line.key} sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.3 }}>
                  <Typography variant="caption">{line.title} x {line.qty}</Typography>
                  <Typography variant="caption" fontWeight="bold">- {formatPrice(line.lineTotal)}</Typography>
                </Box>
              ))}
              <Divider sx={{ my: 0.7 }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="caption" fontWeight="bold">Total Return Credit</Typography>
                <Typography variant="caption" fontWeight="bold">- {formatPrice(currentOrder.returnCreditTotal)}</Typography>
              </Box>

              <TextField
                size="small"
                label="Return Reason"
                value={currentOrder.returnReason || ''}
                onChange={(event) => dispatch(setReturnReason(event.target.value))}
                fullWidth
                sx={{ mt: 1 }}
              />
            </Box>
          )}

          {showTotalsSection && hasOrderContent && (
            <>
              <Divider sx={{ my: 2 }} />
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="body1">Sale Items</Typography>
                  <Typography variant="body1">{currentOrder.items.length}</Typography>
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, mb: 2 }}>
                  <Typography variant="body1">Payment Method</Typography>
                  <FormControl size="small" sx={{ width: 160 }}>
                    <InputLabel id="pos-payment-method-label">Payment</InputLabel>
                    <Select
                      labelId="pos-payment-method-label"
                      value={effectivePaymentMethod}
                      label="Payment"
                      onChange={(event) => setPaymentMethod(event.target.value)}
                      disabled={currentOrder.total <= 0}
                    >
                      <MenuItem value="cash">Cash</MenuItem>
                      <MenuItem value="card">Card</MenuItem>
                    </Select>
                  </FormControl>
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="body1">Subtotal</Typography>
                  <Typography variant="body1">
                    {formatPrice(
                      currentOrder.items.some((item) => item.discountAmount > 0)
                        ? currentOrder.items.reduce((sum, item) => sum + (item.originalPrice || item.price) * item.quantity, 0)
                        : currentOrder.subtotal
                    )}
                  </Typography>
                </Box>

                {currentOrder.items.some((item) => item.discountAmount > 0) && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant="body2" color="error.main">Item Discounts</Typography>
                    <Typography variant="body2" color="error.main">
                      - {formatPrice(currentOrder.items.reduce((sum, item) => sum + (item.discountAmount || 0) * item.quantity, 0))}
                    </Typography>
                  </Box>
                )}

                {effectiveOrderDiscount.discountAmount > 0 && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant="body2" color="warning.main">
                      {isGlobalDiscountActive ? 'Global Discount' : 'Order Discount'}
                      {effectiveOrderDiscount.discountType === 'percent' ? ` (${effectiveOrderDiscount.discountValue}%)` : ''}
                    </Typography>
                    <Typography variant="body2" color="warning.main" fontWeight={700}>
                      - {formatPrice(effectiveOrderDiscount.discountAmount)}
                    </Typography>
                  </Box>
                )}

                {/*
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, mb: 2 }}>
                  <Typography variant="body1">Additional Charges</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Typography variant="body2">Rs.</Typography>
                    <TextField
                      size="small"
                      type="number"
                      value={currentOrder.additionalCharges || ''}
                      onChange={(event) => dispatch(setAdditionalCharges(parseFloat(event.target.value) || 0))}
                      sx={{ width: 120 }}
                      inputProps={{ min: 0, step: 0.01 }}
                    />
                  </Box>
                </Box>
                */}

                <Box sx={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: showDiscountControls ? 1 : 2 }}>
                  <Button
                    size="small"
                    variant={showDiscountControls ? 'contained' : 'outlined'}
                    onClick={() => setShowDiscountControls((prev) => !prev)}
                    sx={{
                      textTransform: 'none',
                      borderRadius: 2,
                      fontWeight: 700,
                      px: 1.5,
                    }}
                  >
                    {showDiscountControls ? 'Hide Discount' : 'Global Discount'}
                  </Button>

                  {isGlobalDiscountActive && (
                    <Chip
                      label={globalDiscountIndicatorLabel}
                      size="small"
                      color="warning"
                      sx={{ fontWeight: 700 }}
                    />
                  )}
                </Box>

                {showDiscountControls && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography variant="body1">Discount</Typography>
                      {globalDiscountSettings?.is_global_discount_active && (
                        <Chip icon={<LocalOffer sx={{ fontSize: '0.7rem !important' }} />} label="Global" size="small" color="warning" sx={{ height: 20, fontSize: '0.65rem' }} />
                      )}
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Select
                        size="small"
                        value={discountType || 'fixed'}
                        onChange={(event) => {
                          setDiscountType(event.target.value);
                          setDiscountValue('');
                        }}
                        sx={{ width: 100 }}
                        disabled={!!globalDiscountSettings?.is_global_discount_active}
                      >
                        <MenuItem value="fixed">Fixed</MenuItem>
                        <MenuItem value="percent">Percent</MenuItem>
                      </Select>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        {discountType === 'fixed' && <Typography variant="body2">Rs.</Typography>}
                        <TextField
                          size="small"
                          type="text"
                          value={discountValue || ''}
                          disabled={!!globalDiscountSettings?.is_global_discount_active}
                          onChange={(event) => {
                            const inputValue = event.target.value;
                            if (!isValidDecimalInput(inputValue)) {
                              return;
                            }

                            if (discountType === 'percent' && parseFloat(inputValue || 0) > 100) {
                              return;
                            }

                            setDiscountValue(inputValue);
                            if (inputValue) {
                              const numValue = parseFloat(inputValue);
                              if (Number.isFinite(numValue)) {
                                if (discountType === 'percent') {
                                  const discountAmount = Math.round((numValue / 100) * currentOrder.subtotal * 100) / 100;
                                  dispatch(setDiscount(discountAmount));
                                } else {
                                  dispatch(setDiscount(Math.round(numValue * 100) / 100));
                                }
                              }
                            } else {
                              dispatch(setDiscount(0));
                            }
                          }}
                          sx={{ width: 100 }}
                          inputProps={{ inputMode: 'decimal' }}
                        />
                        {discountType === 'percent' && <Typography variant="body2">%</Typography>}
                      </Box>
                    </Box>
                  </Box>
                )}

                {showDiscountControls && effectiveOrderDiscount.blockedByMinimum && (
                  <Typography variant="caption" color="warning.main" sx={{ display: 'block', mb: 2 }}>
                    Global discount applies only for orders above {formatPrice(effectiveOrderDiscount.minimumOrderAmount)}.
                  </Typography>
                )}

                {currentOrder.isReturnOrder && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant="body1">Return Credit</Typography>
                    <Typography variant="body1" color="success.main">- {formatPrice(currentOrder.returnCreditTotal)}</Typography>
                  </Box>
                )}

                <Divider sx={{ my: 2 }} />

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1976d2', padding: '12px 16px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
                  <Typography variant="h6" fontWeight="bold" sx={{ color: '#ffffff' }}>Total</Typography>
                  <Typography variant="h5" fontWeight="bold" sx={{ color: '#ffffff' }}>
                    {formatPrice(currentOrder.total)}
                  </Typography>
                </Box>

                <Divider sx={{ my: 2 }} />

                {requiresCashTender ? (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Typography variant="body2">Cash Tendered</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography variant="body2">Rs.</Typography>
                      <TextField
                        size="small"
                        type="text"
                        value={amountPaid}
                        onChange={(event) => {
                          const value = event.target.value;
                          if (isValidDecimalInput(value)) {
                            setAmountPaid(value);
                          }
                        }}
                        onBlur={(event) => {
                          if (event.target.value) {
                            const rounded = parseFloat(event.target.value).toFixed(2);
                            setAmountPaid(rounded);
                          }
                        }}
                        sx={{ width: 140 }}
                        inputProps={{ inputMode: 'decimal' }}
                      />
                    </Box>
                  </Box>
                ) : (
                  <Alert severity={currentOrder.total < 0 ? 'info' : 'success'} sx={{ mb: 2 }}>
                    {currentOrder.total < 0
                      ? `Refund to customer: ${formatPrice(Math.abs(currentOrder.total))}`
                      : 'No extra cash required for this order.'}
                  </Alert>
                )}

                {requiresCashTender && amountPaid && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: change >= 0 ? '#2e7d32' : '#d32f2f', padding: '12px 16px', borderRadius: '8px', mb: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
                    <Typography variant="h6" fontWeight="bold" sx={{ color: '#ffffff' }}>Change</Typography>
                    <Typography variant="h5" fontWeight="bold" sx={{ color: '#ffffff' }}>
                      {formatPrice(change)}
                    </Typography>
                  </Box>
                )}

                <Divider sx={{ my: 1 }} />
              </Box>

              <Box sx={{ mt: 2 }}>
                {currentOrder.isEditing ? (
                  <>
                    <Button
                      fullWidth
                      variant="contained"
                      size="large"
                      startIcon={<Payment />}
                      onClick={handleUpdateOrder}
                      disabled={loading || currentOrder.items.length === 0 || currentOrder.total <= 0}
                      sx={{
                        mb: 1,
                        borderRadius: 2,
                        background: 'linear-gradient(45deg, #FF9800, #F57C00)',
                        fontSize: '1.1rem',
                        fontWeight: 'bold',
                      }}
                    >
                      Update Order
                    </Button>
                    <Button
                      fullWidth
                      variant="outlined"
                      onClick={() => {
                        dispatch(clearCurrentOrder());
                        resetOrderUiState();
                      }}
                      sx={{ borderRadius: 2, mb: 1 }}
                    >
                      Cancel Edit
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      fullWidth
                      variant="contained"
                      size="large"
                      startIcon={<Payment />}
                      onClick={handlePlaceOrder}
                      disabled={loading || !hasOrderContent || (requiresCashTender && (!amountPaid || change < 0))}
                      sx={{
                        mb: 1,
                        borderRadius: 2,
                        background: currentOrder.isReturnOrder
                          ? 'linear-gradient(45deg, #E91E63, #C2185B)'
                          : 'linear-gradient(45deg, #4ECDC4, #44A08D)',
                        fontSize: '1.1rem',
                        fontWeight: 'bold',
                      }}
                    >
                      {currentOrder.isReturnOrder ? 'Place Return Order' : 'Place Order'}
                    </Button>

                    {!currentOrder.isReturnOrder && (
                      <Button
                        fullWidth
                        variant="contained"
                        size="large"
                        onClick={() => setSetActiveDialogOpen(true)}
                        sx={{
                          mb: 1,
                          borderRadius: 2,
                          background: 'linear-gradient(45deg, #2196F3, #1976D2)',
                          fontSize: '1.1rem',
                          fontWeight: 'bold',
                        }}
                      >
                        Set as Active
                      </Button>
                    )}

                    <Button
                      fullWidth
                      variant="outlined"
                      onClick={() => {
                        dispatch(clearCurrentOrder());
                        resetOrderUiState();
                      }}
                      sx={{ borderRadius: 2 }}
                    >
                      Clear Order
                    </Button>
                  </>
                )}
              </Box>
            </>
          )}

          {showTotalsSection && !hasOrderContent && (
            <Box
              sx={{
                flexGrow: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'text.secondary',
              }}
            >
              <Typography variant="body2">Add items to view totals and actions</Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {showTotalsSection && (
        <SetActiveDialog
          open={setActiveDialogOpen}
          onClose={() => setSetActiveDialogOpen(false)}
          onSave={handleSetAsActive}
          initialCustomerName={currentOrder.customerName}
          initialTableNumber={currentOrder.tableNumber}
        />
      )}

      {showTotalsSection && (
      <Dialog
        open={paymentDialog}
        onClose={handleClosePreview}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            handlePaymentConfirm();
          }
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ position: 'relative', pr: 12 }}>
          Bill Preview
          <Button
            size="small"
            variant="outlined"
            color="inherit"
            onClick={handleClosePreview}
            sx={{ position: 'absolute', right: 16, top: 12 }}
          >
            Cancel
          </Button>
        </DialogTitle>
        <DialogContent>
          <Alert severity="success" sx={{ mb: 2 }}>
            {completedOrder?.is_return ? 'Return order placed successfully!' : 'Order placed successfully!'}
          </Alert>

          <Typography variant="body2" sx={{ mb: 1 }}>
            Order #{completedOrder?.id || '-'}
          </Typography>
          {completedOrder?.barcode && (
            <Typography variant="body2" sx={{ mb: 1 }}>
              Barcode: {completedOrder.barcode}
            </Typography>
          )}
          <Typography variant="body2">
            Total: {formatPrice(dialogTotal)}
          </Typography>

          <Box
            sx={{
              mt: 1.5,
              p: 1.5,
              width: '100%',
              maxWidth: 420,
              mx: 'auto',
              borderRadius: 2,
              background: '#f8f9fb',
              border: '1px solid #d7dde6',
            }}
          >
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                p: 1,
                borderRadius: 1,
                bgcolor: '#eceff3',
                color: '#1f2937',
                mb: 1,
              }}
            >
              <Typography variant="body2" fontWeight={700}>Total</Typography>
              <Typography variant="body1" fontWeight={800}>Rs {dialogTotal.toFixed(2)}</Typography>
            </Box>

            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                p: 1,
                borderRadius: 1,
                bgcolor: '#eceff3',
                color: '#1f2937',
                mb: 1,
              }}
            >
              <Typography variant="body2" fontWeight={700}>Paid</Typography>
              <Typography variant="body1" fontWeight={800}>Rs {previewPaidAmount.toFixed(2)}</Typography>
            </Box>

            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                p: 1,
                borderRadius: 1,
                bgcolor: dialogChange >= 0 ? '#2e7d32' : '#c62828',
                color: '#fff',
              }}
            >
              <Typography variant="body2" fontWeight={700}>Change</Typography>
              <Typography variant="body1" fontWeight={800}>Rs {dialogChange.toFixed(2)}</Typography>
            </Box>

            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                p: 1,
                borderRadius: 1,
                bgcolor: '#eceff3',
                color: '#1f2937',
                mt: 1,
              }}
            >
              <Typography variant="body2" fontWeight={700}>Payment Type</Typography>
              <Typography variant="body1" fontWeight={800} sx={{ textTransform: 'capitalize' }}>
                {completedOrder?.paymentMethod || paymentMethod || 'cash'}
              </Typography>
            </Box>
          </Box>

          <Box
            sx={{
              mt: 2,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              overflow: 'hidden',
              height: 430,
              bgcolor: '#fff',
            }}
          >
            <iframe
              title="Bill Preview"
              srcDoc={previewHtml}
              style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClosePreview}>Cancel</Button>
          <Button
            onClick={handlePaymentConfirm}
            variant="contained"
            startIcon={<Receipt />}
            autoFocus
          >
            Print
          </Button>
        </DialogActions>
      </Dialog>
      )}
    </>
  );
};

export default OrderSummary;