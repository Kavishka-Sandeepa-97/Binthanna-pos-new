import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { ordersAPI } from '../../services/api';

const toNumber = (value, fallback = 0) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toOptionalNumber = (value) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const buildOrderLineKey = (itemVariantId, price, preferredBatchId = null) => {
  const normalizedPrice = toNumber(price, 0).toFixed(2);
  const batchPart = preferredBatchId !== null && preferredBatchId !== undefined ? preferredBatchId : 'auto';
  return `${itemVariantId}:${batchPart}:${normalizedPrice}`;
};

const createEmptyOrder = () => ({
  id: null,
  items: [],
  subtotal: 0,
  discount: 0,
  additionalCharges: 0,
  total: 0,
  customerName: '',
  tableNumber: '',
  orderType: 'dine-in',
  isEditing: false,
  originalStatus: null,
  barcode: null,
  isReturnOrder: false,
  originalOrderId: null,
  returnReason: '',
  returnedItems: [],
  returnCreditTotal: 0,
  paymentMethod: 'cash',
});

const calculateReturnCredit = (returnedItems = []) => {
  return returnedItems.reduce((sum, item) => {
    const qty = toNumber(item.qty, 0);
    const unitPrice = toNumber(item.unit_price, 0);
    return sum + (qty * unitPrice);
  }, 0);
};

const recalculateCurrentOrder = (order) => {
  order.subtotal = order.items.reduce((sum, item) => {
    const itemTotal = toNumber(item.total, 0);
    return sum + itemTotal;
  }, 0);

  if (order.isReturnOrder) {
    order.discount = 0;
    order.returnCreditTotal = calculateReturnCredit(order.returnedItems);
    order.total = order.subtotal + toNumber(order.additionalCharges, 0) - order.returnCreditTotal;
    return;
  }

  order.returnCreditTotal = 0;
  order.total = order.subtotal + toNumber(order.additionalCharges, 0) - toNumber(order.discount, 0);
};

// Async thunks for order operations
export const fetchActiveOrders = createAsyncThunk(
  'orders/fetchActiveOrders',
  async (_, { rejectWithValue }) => {
    try {
      const response = await ordersAPI.getActive();
      return response.orders || response || [];
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const createOrder = createAsyncThunk(
  'orders/createOrder',
  async (orderData, { rejectWithValue, getState }) => {
    try {
      const { auth } = getState();
      if (auth.user?.role === 'cashier' && !auth.activeShift) {
        return rejectWithValue('You must open a cashier shift before processing orders. Please open a shift from your profile menu.');
      }

      const response = await ordersAPI.create(orderData);
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const updateOrder = createAsyncThunk(
  'orders/updateOrder',
  async ({ orderId, orderData }, { rejectWithValue, getState }) => {
    try {
      const { auth } = getState();
      if (auth.user?.role === 'cashier' && !auth.activeShift) {
        return rejectWithValue('You must open a cashier shift before processing orders. Please open a shift from your profile menu.');
      }

      const response = await ordersAPI.update(orderId, orderData);
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const updateOrderStatus = createAsyncThunk(
  'orders/updateOrderStatus',
  async ({ orderId, status }, { rejectWithValue }) => {
    try {
      const response = await ordersAPI.updateStatus(orderId, status);
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

const orderSlice = createSlice({
  name: 'order',
  initialState: {
    currentOrder: createEmptyOrder(),
    activeOrders: [],
    orderHistory: [],
    loading: false,
    error: null,
  },
  reducers: {
    loadOrderForEdit: (state, action) => {
      const order = action.payload;
      const sourceItems = Array.isArray(order.items) ? order.items : [];

      const positiveItems = sourceItems
        .filter((item) => toNumber(item.quantity || item.qty, 0) > 0)
        .map((item, index) => {
          const qty = toNumber(item.quantity || item.qty, 0);
          const unitPrice = toNumber(item.price || item.unit_price, 0);
          const originalPrice = toNumber(item.original_price || item.price || item.unit_price, unitPrice);
          const preferredBatchId = item.preferred_batch_id || null;
          return {
            lineKey: item.id ? `order-item-${item.id}` : `${buildOrderLineKey(item.item_variant_id, unitPrice, preferredBatchId)}:${index}`,
            itemVariantId: item.item_variant_id,
            itemName: item.item_name,
            variantName: item.variant_name,
            price: unitPrice,
            originalPrice,
            quantity: qty,
            total: qty * unitPrice,
            barcode: item.barcode,
            discountSource: item.discount_source || null,
            discountType: item.item_discount_type || item.discount_type || null,
            discountValue: toNumber(item.item_discount_value || item.discount_value, 0),
            discountAmount: toNumber(item.item_discount_amount || item.discount_amount, 0),
            preferredBatchId,
            maxVariantStock: null,
            maxBatchQty: null,
          };
        });

      const returnedItems = sourceItems
        .filter((item) => toNumber(item.quantity || item.qty, 0) < 0)
        .map((item) => ({
          source_order_item_id: item.source_order_item_id || item.id || null,
          item_variant_id: item.item_variant_id,
          item_name: item.item_name,
          variant_name: item.variant_name,
          qty: Math.abs(toNumber(item.quantity || item.qty, 0)),
          unit_price: toNumber(item.unit_price || item.price, 0),
          original_price: toNumber(item.original_price || item.unit_price || item.price, 0),
          batch_allocations: item.batch_allocations || [],
        }));

      state.currentOrder = {
        id: order.id,
        items: positiveItems,
        subtotal: 0,
        discount: toNumber(order.discount_value, 0),
        additionalCharges: toNumber(order.additional_charges, 0),
        total: toNumber(order.total_amount, 0),
        customerName: order.customer_name || '',
        tableNumber: order.table_number || '',
        orderType: order.order_type || 'dine-in',
        isEditing: true,
        originalStatus: order.status,
        barcode: order.barcode || null,
        isReturnOrder: !!order.is_return,
        originalOrderId: order.original_order_id || null,
        returnReason: order.credit_reason || '',
        returnedItems,
        returnCreditTotal: 0,
        paymentMethod: order.is_card_payment ? 'card' : 'cash',
      };

      recalculateCurrentOrder(state.currentOrder);
    },

    loadActiveOrder: (state, action) => {
      const order = action.payload;
      const sourceItems = Array.isArray(order.items) ? order.items : [];

      const positiveItems = sourceItems
        .filter((item) => toNumber(item.quantity || item.qty, 0) > 0)
        .map((item, index) => {
          const qty = toNumber(item.quantity || item.qty, 0);
          const unitPrice = toNumber(item.sell_price || item.unit_price || item.price, 0);
          const originalPrice = toNumber(item.original_price || item.unit_price || item.price, unitPrice);
          const preferredBatchId = item.preferred_batch_id || null;
          return {
            lineKey: item.id ? `order-item-${item.id}` : `${buildOrderLineKey(item.item_variant_id, unitPrice, preferredBatchId)}:${index}`,
            itemVariantId: item.item_variant_id,
            itemName: item.item_name,
            variantName: item.variant_name,
            price: unitPrice,
            originalPrice,
            quantity: qty,
            total: qty * unitPrice,
            category: item.category_name || '',
            discountSource: item.discount_source || null,
            discountType: item.item_discount_type || item.discount_type || null,
            discountValue: toNumber(item.item_discount_value || item.discount_value, 0),
            discountAmount: toNumber(item.item_discount_amount || item.discount_amount, 0),
            preferredBatchId,
            maxVariantStock: null,
            maxBatchQty: null,
          };
        });

      const returnedItems = sourceItems
        .filter((item) => toNumber(item.quantity || item.qty, 0) < 0)
        .map((item) => ({
          source_order_item_id: item.source_order_item_id || item.id || null,
          item_variant_id: item.item_variant_id,
          item_name: item.item_name,
          variant_name: item.variant_name,
          qty: Math.abs(toNumber(item.quantity || item.qty, 0)),
          unit_price: toNumber(item.unit_price || item.price, 0),
          original_price: toNumber(item.original_price || item.unit_price || item.price, 0),
          batch_allocations: item.batch_allocations || [],
        }));

      state.currentOrder = {
        id: order.id,
        items: positiveItems,
        subtotal: 0,
        discount: toNumber(order.discount_value, 0),
        additionalCharges: toNumber(order.additional_charges, 0),
        total: toNumber(order.total_amount, 0),
        customerName: order.customer_name || '',
        tableNumber: order.table_number || '',
        orderType: 'dine-in',
        isEditing: false,
        originalStatus: order.status,
        barcode: order.barcode || null,
        isReturnOrder: !!order.is_return,
        originalOrderId: order.original_order_id || null,
        returnReason: order.credit_reason || '',
        returnedItems,
        returnCreditTotal: 0,
        paymentMethod: order.is_card_payment ? 'card' : 'cash',
      };

      recalculateCurrentOrder(state.currentOrder);
    },

    startReturnOrder: (state, action) => {
      const {
        originalOrderId,
        customerName = '',
        returnReason = '',
        returnedItems = [],
      } = action.payload || {};

      state.currentOrder = {
        ...createEmptyOrder(),
        isReturnOrder: true,
        originalOrderId: originalOrderId || null,
        customerName,
        returnReason,
        returnedItems: returnedItems.map((item) => ({
          source_order_item_id: item.source_order_item_id || item.order_item_id || null,
          item_variant_id: item.item_variant_id,
          item_name: item.item_name,
          variant_name: item.variant_name,
          qty: toNumber(item.qty, 0),
          unit_price: toNumber(item.unit_price, 0),
          original_price: toNumber(item.original_price, toNumber(item.unit_price, 0)),
          batch_allocations: Array.isArray(item.batch_allocations) ? item.batch_allocations : [],
        })),
      };

      recalculateCurrentOrder(state.currentOrder);
    },

    setReturnReason: (state, action) => {
      state.currentOrder.returnReason = action.payload || '';
    },

    addItemToOrder: (state, action) => {
      const {
        itemVariant,
        quantity = 1,
        globalDiscountSettings,
        preferredBatchId = null,
        batchRemainingQty = null,
      } = action.payload;

      const safeQuantity = Math.max(1, parseInt(quantity, 10) || 1);
      const isQtyManaged = itemVariant.is_qty_managed !== 0 && itemVariant.is_qty_managed !== false;
      const maxVariantStock = isQtyManaged ? toOptionalNumber(itemVariant.total_stock ?? itemVariant.totalStock) : null;
      const variantExistingQty = state.currentOrder.items
        .filter((item) => item.itemVariantId === itemVariant.id)
        .reduce((sum, item) => sum + toNumber(item.quantity, 0), 0);

      if (maxVariantStock !== null && (variantExistingQty + safeQuantity) > maxVariantStock) {
        return;
      }

      const originalPrice = toNumber(itemVariant.selling_price || itemVariant.sellingPrice, 0);
      let discountSource = null;
      let discountType = null;
      let discountValue = 0;
      let discountAmount = 0;
      let finalPrice = originalPrice;

      if (!state.currentOrder.isReturnOrder) {
        const globalActive =
          globalDiscountSettings &&
          globalDiscountSettings.is_global_discount_active &&
          toNumber(globalDiscountSettings.global_discount_value, 0) > 0;

        if (!globalActive && itemVariant.is_discount_active && itemVariant.discount_type && toNumber(itemVariant.discount_value, 0) > 0) {
          discountSource = 'item';
          discountType = itemVariant.discount_type;
          discountValue = toNumber(itemVariant.discount_value, 0);
          discountAmount = discountType === 'percentage'
            ? Math.round((originalPrice * discountValue / 100) * 100) / 100
            : discountValue;
          finalPrice = Math.max(0, originalPrice - discountAmount);
        } else if (!globalActive && itemVariant.brand_discount_active && itemVariant.brand_discount_type && toNumber(itemVariant.brand_discount_value, 0) > 0) {
          discountSource = 'brand';
          discountType = itemVariant.brand_discount_type;
          discountValue = toNumber(itemVariant.brand_discount_value, 0);
          discountAmount = discountType === 'percentage'
            ? Math.round((originalPrice * discountValue / 100) * 100) / 100
            : discountValue;
          finalPrice = Math.max(0, originalPrice - discountAmount);
        }
      }

      const lineKey = buildOrderLineKey(itemVariant.id, finalPrice, preferredBatchId);
      const existingItem = state.currentOrder.items.find((item) => item.lineKey === lineKey);
      const maxBatchQty = preferredBatchId ? toOptionalNumber(batchRemainingQty) : null;

      if (existingItem) {
        if (maxBatchQty !== null && (toNumber(existingItem.quantity, 0) + safeQuantity) > maxBatchQty) {
          return;
        }

        existingItem.quantity += safeQuantity;
        existingItem.total = existingItem.quantity * existingItem.price;
        if (existingItem.maxVariantStock === null && maxVariantStock !== null) {
          existingItem.maxVariantStock = maxVariantStock;
        }
        if (existingItem.maxBatchQty === null && maxBatchQty !== null) {
          existingItem.maxBatchQty = maxBatchQty;
        }
        recalculateCurrentOrder(state.currentOrder);
        return;
      }

      state.currentOrder.items.push({
        lineKey,
        itemVariantId: itemVariant.id,
        itemName: itemVariant.item_name || itemVariant.itemName,
        variantName: itemVariant.variant_name || itemVariant.variantName,
        price: finalPrice,
        originalPrice,
        quantity: safeQuantity,
        total: finalPrice * safeQuantity,
        category: itemVariant.category_name || itemVariant.categoryName,
        discountSource,
        discountType,
        discountValue,
        discountAmount,
        itemDiscountActive: !!itemVariant.is_discount_active,
        itemDiscountType: itemVariant.discount_type,
        itemDiscountValue: toNumber(itemVariant.discount_value, 0),
        brandDiscountActive: !!itemVariant.brand_discount_active,
        brandDiscountType: itemVariant.brand_discount_type,
        brandDiscountValue: toNumber(itemVariant.brand_discount_value, 0),
        preferredBatchId: preferredBatchId || null,
        maxVariantStock,
        maxBatchQty,
      });

      recalculateCurrentOrder(state.currentOrder);
    },

    removeItemFromOrder: (state, action) => {
      const lineKey = action.payload;
      state.currentOrder.items = state.currentOrder.items.filter(
        (item) => item.lineKey !== lineKey
      );
      if (state.currentOrder.items.length === 0) {
        state.currentOrder = createEmptyOrder();
      } else {
        recalculateCurrentOrder(state.currentOrder);
      }
    },

    updateItemQuantity: (state, action) => {
      const { lineKey, quantity } = action.payload;
      const item = state.currentOrder.items.find(
        (orderItem) => orderItem.lineKey === lineKey
      );

      if (item && quantity > 0) {
        item.quantity = quantity;
        item.total = item.quantity * toNumber(item.price, 0);
        recalculateCurrentOrder(state.currentOrder);
      }
    },

    setDiscount: (state, action) => {
      if (state.currentOrder.isReturnOrder) {
        return;
      }
      state.currentOrder.discount = toNumber(action.payload, 0);
      recalculateCurrentOrder(state.currentOrder);
    },

    resetItemDiscount: (state, action) => {
      if (state.currentOrder.isReturnOrder) {
        return;
      }

      const lineKey = action.payload;
      const item = state.currentOrder.items.find(
        (orderItem) => orderItem.lineKey === lineKey
      );
      if (!item) {
        return;
      }

      const originalPrice = item.originalPrice != null ? item.originalPrice : item.price;
      item.price = originalPrice;
      item.discountSource = null;
      item.discountType = null;
      item.discountValue = 0;
      item.discountAmount = 0;
      item.total = item.quantity * originalPrice;

      recalculateCurrentOrder(state.currentOrder);
    },

    updateItemDiscount: (state, action) => {
      if (state.currentOrder.isReturnOrder) {
        return;
      }

      const { lineKey, discountType, discountValue } = action.payload;
      const item = state.currentOrder.items.find(
        (orderItem) => orderItem.lineKey === lineKey
      );
      if (!item) {
        return;
      }

      const originalPrice = toNumber(item.originalPrice || item.price, 0);
      const safeDiscountValue = toNumber(discountValue, 0);
      let discountAmount = 0;
      if (discountType === 'percentage') {
        discountAmount = Math.round((originalPrice * safeDiscountValue / 100) * 100) / 100;
      } else if (discountType === 'fixed') {
        discountAmount = safeDiscountValue;
      }

      item.discountSource = 'manual';
      item.discountType = discountType;
      item.discountValue = safeDiscountValue;
      item.discountAmount = discountAmount;
      item.price = Math.max(0, originalPrice - discountAmount);
      item.total = item.quantity * item.price;

      recalculateCurrentOrder(state.currentOrder);
    },

    setAdditionalCharges: (state, action) => {
      state.currentOrder.additionalCharges = toNumber(action.payload, 0);
      recalculateCurrentOrder(state.currentOrder);
    },

    setCustomerInfo: (state, action) => {
      const { customerName, tableNumber, orderType } = action.payload;
      state.currentOrder.customerName = customerName || '';
      if (tableNumber !== undefined) {
        state.currentOrder.tableNumber = tableNumber || '';
      }
      state.currentOrder.orderType = orderType || 'dine-in';
    },

    clearCurrentOrder: (state) => {
      state.currentOrder = createEmptyOrder();
    },

    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchActiveOrders.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchActiveOrders.fulfilled, (state, action) => {
        state.loading = false;
        state.activeOrders = action.payload;
      })
      .addCase(fetchActiveOrders.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(createOrder.pending, (state) => {
        state.loading = true;
      })
      .addCase(createOrder.fulfilled, (state, action) => {
        state.loading = false;
        state.activeOrders.push(action.payload);
        state.currentOrder = createEmptyOrder();
      })
      .addCase(createOrder.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(updateOrderStatus.fulfilled, (state, action) => {
        const { orderId, status } = action.meta.arg;
        const index = state.activeOrders.findIndex(
          (order) => order.id === orderId
        );
        if (index !== -1) {
          if (status === 'completed' || status === 'cancelled') {
            state.activeOrders.splice(index, 1);
          } else {
            state.activeOrders[index].status = status;
          }
        }
      });
  },
});

export const {
  loadOrderForEdit,
  loadActiveOrder,
  startReturnOrder,
  setReturnReason,
  addItemToOrder,
  removeItemFromOrder,
  updateItemQuantity,
  setDiscount,
  resetItemDiscount,
  updateItemDiscount,
  setAdditionalCharges,
  setCustomerInfo,
  clearCurrentOrder,
  clearError,
} = orderSlice.actions;

export default orderSlice.reducer;