const API_BASE_URL = 'http://localhost:3002/api';

// Helper function to get auth token
const getAuthToken = () => {
  return localStorage.getItem('token');
};

// Helper function to make authenticated requests
const makeRequest = async (url, options = {}) => {
  const token = getAuthToken();
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(`${API_BASE_URL}${url}`, config);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      // Use the error message from the server if available, otherwise provide a user-friendly message
      const errorMessage = errorData.error || errorData.message || getDefaultErrorMessage(response.status);
      throw new Error(errorMessage);
    }

    return await response.json();
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
};

// Helper function to provide user-friendly error messages
const getDefaultErrorMessage = (status) => {
  switch (status) {
    case 400:
      return 'Invalid request. Please check your input.';
    case 401:
      return 'Invalid username or PIN. Please try again.';
    case 403:
      return 'You do not have permission to perform this action.';
    case 404:
      return 'The requested resource was not found.';
    case 409:
      return 'This item already exists.';
    case 500:
      return 'Server error. Please try again later.';
    default:
      return 'An unexpected error occurred. Please try again.';
  }
};

// Authentication API
export const authAPI = {
  login: async (credentials) => {
    return makeRequest('/staff/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  },

  logout: async () => {
    return makeRequest('/auth/logout', {
      method: 'POST',
    });
  },

  checkAuth: async () => {
    return makeRequest('/auth/me');
  },
};

// Staff API
export const staffAPI = {
  getAll: async () => {
    return makeRequest('/staff');
  },

  getById: async (id) => {
    return makeRequest(`/staff/${id}`);
  },

  create: async (staffData) => {
    return makeRequest('/staff', {
      method: 'POST',
      body: JSON.stringify(staffData),
    });
  },

  update: async (id, staffData) => {
    return makeRequest(`/staff/${id}`, {
      method: 'PUT',
      body: JSON.stringify(staffData),
    });
  },

  updateOwnPin: async (userId, currentPin, newPin) => {
    return makeRequest('/staff/me/pin', {
      method: 'PUT',
      body: JSON.stringify({ userId, currentPin, newPin }),
    });
  },

  delete: async (id) => {
    return makeRequest(`/staff/${id}`, {
      method: 'DELETE',
    });
  },
};

// Categories API
export const categoriesAPI = {
  getAll: async () => {
    return makeRequest('/categories');
  },

  create: async (categoryData) => {
    return makeRequest('/categories', {
      method: 'POST',
      body: JSON.stringify(categoryData),
    });
  },

  update: async (id, categoryData) => {
    return makeRequest(`/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(categoryData),
    });
  },

  delete: async (id) => {
    return makeRequest(`/categories/${id}`, {
      method: 'DELETE',
    });
  },
};

// Brands API
export const brandsAPI = {
  getAll: async () => {
    return makeRequest('/brands');
  },

  getById: async (id) => {
    return makeRequest(`/brands/${id}`);
  },

  create: async (brandData) => {
    return makeRequest('/brands', {
      method: 'POST',
      body: JSON.stringify(brandData),
    });
  },

  update: async (id, brandData) => {
    return makeRequest(`/brands/${id}`, {
      method: 'PUT',
      body: JSON.stringify(brandData),
    });
  },

  delete: async (id) => {
    return makeRequest(`/brands/${id}`, {
      method: 'DELETE',
    });
  },
};

// Items API
export const itemsAPI = {
  getAll: async () => {
    return makeRequest('/items');
  },

  getById: async (id) => {
    return makeRequest(`/items/${id}`);
  },

  create: async (itemData) => {
    return makeRequest('/items', {
      method: 'POST',
      body: JSON.stringify(itemData),
    });
  },

  createWithVariants: async (formData) => {
    return makeRequest('/items/create-with-variants', {
      method: 'POST',
      body: formData,
      // Don't set Content-Type header for FormData
      headers: {},
    });
  },

  update: async (id, itemData) => {
    return makeRequest(`/items/${id}`, {
      method: 'PUT',
      body: JSON.stringify(itemData),
    });
  },

  delete: async (id) => {
    return makeRequest(`/items/${id}`, {
      method: 'DELETE',
    });
  },
};

// Variants API
export const variantsAPI = {
  getAll: async () => {
    return makeRequest('/variants');
  },

  getById: async (id) => {
    return makeRequest(`/variants/${id}`);
  },

  create: async (variantData) => {
    return makeRequest('/variants', {
      method: 'POST',
      body: JSON.stringify(variantData),
    });
  },

  update: async (id, variantData) => {
    return makeRequest(`/variants/${id}`, {
      method: 'PUT',
      body: JSON.stringify(variantData),
    });
  },

  delete: async (id) => {
    return makeRequest(`/variants/${id}`, {
      method: 'DELETE',
    });
  },
};

// Item Variants API
export const itemVariantsAPI = {
  getAll: async () => {
    return makeRequest('/item-variants');
  },

  getByItemId: async (itemId) => {
    return makeRequest(`/item-variants/item/${itemId}`);
  },

  getByCategoryId: async (categoryId) => {
    return makeRequest(`/item-variants/category/${categoryId}`);
  },

  searchByBarcode: async (barcode) => {
    return makeRequest(`/item-variants/barcode/${barcode}`);
  },

  search: async (query) => {
    return makeRequest(`/item-variants/search?q=${encodeURIComponent(query)}`);
  },

  create: async (variantData) => {
    return makeRequest('/item-variants', {
      method: 'POST',
      body: JSON.stringify(variantData),
    });
  },

  update: async (id, variantData) => {
    return makeRequest(`/item-variants/${id}`, {
      method: 'PUT',
      body: JSON.stringify(variantData),
    });
  },

  updateFull: async (id, formData) => {
    return makeRequest(`/item-variants/${id}/update-full`, {
      method: 'PUT',
      body: formData,
      headers: {}, // Let browser set Content-Type for FormData
    });
  },

  delete: async (id) => {
    return makeRequest(`/item-variants/${id}`, {
      method: 'DELETE',
    });
  },

  updateStock: async (id, stockData) => {
    return makeRequest(`/item-variants/${id}/stock`, {
      method: 'PUT',
      body: JSON.stringify(stockData),
    });
  },
};

// Orders API
export const ordersAPI = {
  getAll: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return makeRequest(`/orders${queryString ? `?${queryString}` : ''}`);
  },

  getById: async (id) => {
    return makeRequest(`/orders/${id}`);
  },

  getActive: async () => {
    return makeRequest('/orders?status=active');
  },

  create: async (orderData) => {
    return makeRequest('/orders', {
      method: 'POST',
      body: JSON.stringify(orderData),
    });
  },

  update: async (id, orderData) => {
    return makeRequest(`/orders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(orderData),
    });
  },

  updateStatus: async (id, status) => {
    return makeRequest(`/orders/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  },

  searchReturnable: async ({ query = '', limit = 20 } = {}) => {
    const params = new URLSearchParams();
    if (query) {
      params.append('q', query);
    }
    if (limit) {
      params.append('limit', limit);
    }
    return makeRequest(`/orders/return-search${params.toString() ? `?${params.toString()}` : ''}`);
  },

  getReturnableDetails: async (id) => {
    return makeRequest(`/orders/${id}/returnable-items`);
  },

  delete: async (id) => {
    return makeRequest(`/orders/${id}`, {
      method: 'DELETE',
    });
  },

  // Generate receipts
  generateBill: async (orderId) => {
    return makeRequest(`/orders/${orderId}/bill`, {
      method: 'POST',
    });
  },
};

// Stock API
export const stockAPI = {
  getAll: async () => {
    return makeRequest('/stock');
  },

  getLowStock: async () => {
    return makeRequest('/stock/low-stock');
  },

  updateStock: async (itemVariantId, stockData) => {
    return makeRequest('/stock', {
      method: 'POST',
      body: JSON.stringify({
        itemVariantId,
        ...stockData,
      }),
    });
  },

  getStockHistory: async (itemVariantId) => {
    return makeRequest(`/stock/movements/${itemVariantId}`);
  },

  getStockBatches: async (itemVariantId) => {
    return makeRequest(`/stock/batches/${itemVariantId}`);
  },

  addBatch: async (batchData) => {
    return makeRequest('/stock-batch/add', {
      method: 'POST',
      body: JSON.stringify(batchData),
    });
  },

  updateBatch: async (batchId, batchData) => {
    return makeRequest(`/stock/${batchId}`, {
      method: 'PUT',
      body: JSON.stringify(batchData),
    });
  },

  // Units
  units: {
    getAll: async () => {
      return makeRequest('/stock-unit');
    },
    getById: async (id) => {
      return makeRequest(`/stock-unit/${id}`);
    },
    create: async (data) => {
      return makeRequest('/stock-unit', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    update: async (id, data) => {
      return makeRequest(`/stock-unit/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    delete: async (id) => {
      return makeRequest(`/stock-unit/${id}`, {
        method: 'DELETE',
      });
    },
  },

  // Stock Categories
  categories: {
    getAll: async () => {
      return makeRequest('/stock-category');
    },
    getById: async (id) => {
      return makeRequest(`/stock-category/${id}`);
    },
    create: async (data) => {
      return makeRequest('/stock-category', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    update: async (id, data) => {
      return makeRequest(`/stock-category/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    delete: async (id) => {
      return makeRequest(`/stock-category/${id}`, {
        method: 'DELETE',
      });
    },
  },

  // Suppliers
  suppliers: {
    getAll: async () => {
      return makeRequest('/stock-supplier');
    },
    getById: async (id) => {
      return makeRequest(`/stock-supplier/${id}`);
    },
    create: async (data) => {
      return makeRequest('/stock-supplier', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    update: async (id, data) => {
      return makeRequest(`/stock-supplier/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    delete: async (id) => {
      return makeRequest(`/stock-supplier/${id}`, {
        method: 'DELETE',
      });
    },
  },

  // Products
  products: {
    getAll: async () => {
      return makeRequest('/stock-product');
    },
    getById: async (id) => {
      return makeRequest(`/stock-product/${id}`);
    },
    create: async (data) => {
      return makeRequest('/stock-product', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    update: async (id, data) => {
      return makeRequest(`/stock-product/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    delete: async (id) => {
      return makeRequest(`/stock-product/${id}`, {
        method: 'DELETE',
      });
    },
  },

  // Transactions
  transactions: {
    getAll: async (params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return makeRequest(`/stock-transaction${queryString ? `?${queryString}` : ''}`);
    },
    getById: async (id) => {
      return makeRequest(`/stock-transaction/${id}`);
    },
    create: async (data) => {
      return makeRequest('/stock-transaction', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    update: async (id, data) => {
      return makeRequest(`/stock-transaction/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    delete: async (id) => {
      return makeRequest(`/stock-transaction/${id}`, {
        method: 'DELETE',
      });
    },
  },
};

// In/Out Transactions API
export const inOutAPI = {
  getAll: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return makeRequest(`/in-out${queryString ? `?${queryString}` : ''}`);
  },

  getById: async (id) => {
    return makeRequest(`/in-out/${id}`);
  },

  create: async (transactionData) => {
    return makeRequest('/in-out', {
      method: 'POST',
      body: JSON.stringify(transactionData),
    });
  },

  update: async (id, transactionData) => {
    return makeRequest(`/in-out/${id}`, {
      method: 'PUT',
      body: JSON.stringify(transactionData),
    });
  },

  delete: async (id) => {
    return makeRequest(`/in-out/${id}`, {
      method: 'DELETE',
    });
  },

  getStats: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return makeRequest(`/in-out/summary/stats${queryString ? `?${queryString}` : ''}`);
  },
};

// Cashier Shift API
export const cashierShiftAPI = {
  getAll: async () => {
    return makeRequest('/cashier-shifts');
  },

  getById: async (id) => {
    return makeRequest(`/cashier-shifts/${id}`);
  },

  getOpenShifts: async () => {
    return makeRequest('/cashier-shifts/status/open');
  },

  getMyShifts: async (userId) => {
    const shifts = await makeRequest('/cashier-shifts');
    return shifts.filter(shift => shift.staff_id === userId);
  },

  getActiveShift: async (userId) => {
    const openShifts = await makeRequest('/cashier-shifts/status/open');
    return openShifts.find(shift => shift.staff_id === userId) || null;
  },

  openShift: async (shiftData) => {
    return makeRequest('/cashier-shifts', {
      method: 'POST',
      body: JSON.stringify(shiftData),
    });
  },

  closeShift: async (id, closeData) => {
    return makeRequest(`/cashier-shifts/${id}/close`, {
      method: 'PUT',
      body: JSON.stringify(closeData),
    });
  },

  updateShift: async (id, shiftData) => {
    return makeRequest(`/cashier-shifts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(shiftData),
    });
  },

  deleteShift: async (id) => {
    return makeRequest(`/cashier-shifts/${id}`, {
      method: 'DELETE',
    });
  },
};

// Utility functions for offline support
export const offlineUtils = {
  // Store data locally when offline
  storeOfflineData: (key, data) => {
    try {
      localStorage.setItem(`offline_${key}`, JSON.stringify({
        data,
        timestamp: Date.now(),
      }));
    } catch (error) {
      console.error('Failed to store offline data:', error);
    }
  },

  // Retrieve offline data
  getOfflineData: (key) => {
    try {
      const stored = localStorage.getItem(`offline_${key}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Return data if it's less than 1 hour old
        if (Date.now() - parsed.timestamp < 3600000) {
          return parsed.data;
        }
      }
    } catch (error) {
      console.error('Failed to retrieve offline data:', error);
    }
    return null;
  },

  // Clear offline data
  clearOfflineData: (key) => {
    try {
      localStorage.removeItem(`offline_${key}`);
    } catch (error) {
      console.error('Failed to clear offline data:', error);
    }
  },

  // Check if online
  isOnline: () => navigator.onLine,
};

// Enhanced API functions with offline support
export const enhancedAPI = {
  // Get categories with offline fallback
  getCategories: async () => {
    try {
      const data = await categoriesAPI.getAll();
      offlineUtils.storeOfflineData('categories', data);
      return data;
    } catch (error) {
      if (!offlineUtils.isOnline()) {
        const offlineData = offlineUtils.getOfflineData('categories');
        if (offlineData) {
          return offlineData;
        }
      }
      throw error;
    }
  },

  // Get item variants with offline fallback
  getItemVariants: async () => {
    try {
      const data = await itemVariantsAPI.getAll();
      offlineUtils.storeOfflineData('itemVariants', data);
      return data;
    } catch (error) {
      if (!offlineUtils.isOnline()) {
        const offlineData = offlineUtils.getOfflineData('itemVariants');
        if (offlineData) {
          return offlineData;
        }
      }
      throw error;
    }
  },

  // Create order with offline queue
  createOrder: async (orderData) => {
    try {
      return await ordersAPI.create(orderData);
    } catch (error) {
      if (!offlineUtils.isOnline()) {
        // Store order in offline queue
        const offlineOrders = JSON.parse(localStorage.getItem('offline_orders') || '[]');
        offlineOrders.push({
          ...orderData,
          id: `offline_${Date.now()}`,
          createdAt: new Date().toISOString(),
          isOffline: true,
        });
        localStorage.setItem('offline_orders', JSON.stringify(offlineOrders));
        return { success: true, isOffline: true };
      }
      throw error;
    }
  },

  // Sync offline orders when back online
  syncOfflineOrders: async () => {
    const offlineOrders = JSON.parse(localStorage.getItem('offline_orders') || '[]');
    const syncResults = [];

    for (const order of offlineOrders) {
      try {
        const result = await ordersAPI.create(order);
        syncResults.push({ success: true, order, result });
      } catch (error) {
        syncResults.push({ success: false, order, error });
      }
    }

    // Clear successfully synced orders
    const failedOrders = syncResults
      .filter(result => !result.success)
      .map(result => result.order);

    localStorage.setItem('offline_orders', JSON.stringify(failedOrders));

    return syncResults;
  },
};

// Reports API
export const reportsAPI = {
  // POS Reports
  getRevenue: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return makeRequest(`/reports/pos/revenue?${queryString}`);
  },

  getTopProducts: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return makeRequest(`/reports/pos/top-products?${queryString}`);
  },

  getCategorySales: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return makeRequest(`/reports/pos/category-sales?${queryString}`);
  },

  // Stock Reports
  getStockTransactions: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return makeRequest(`/reports/stock/transactions?${queryString}`);
  },

  getStockLevels: async () => {
    return makeRequest('/reports/stock/levels');
  },

  getLowStock: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return makeRequest(`/reports/stock/low-stock?${queryString}`);
  },

  getSupplierPurchases: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return makeRequest(`/reports/stock/supplier-purchases?${queryString}`);
  },

  getInventoryValuation: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return makeRequest(`/reports/stock/valuation?${queryString}`);
  },

  getDailyOrders: async (date, params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return makeRequest(`/reports/pos/daily-orders/${date}${queryString ? `?${queryString}` : ''}`);
  },
};

// Database API
export const databaseAPI = {
  reset: async () => {
    return makeRequest('/database/reset', {
      method: 'POST',
    });
  },
};

// Global Discount Settings API
export const globalDiscountAPI = {
  get: async () => {
    return makeRequest('/global-discount-settings');
  },
  update: async (settings) => {
    return makeRequest('/global-discount-settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  },
};

// Sync API
export const syncAPI = {
  getSettings: async () => {
    return makeRequest('/sync/settings');
  },
  updateSettings: async (settings) => {
    return makeRequest('/sync/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  },
  triggerSync: async () => {
    return makeRequest('/sync/trigger', {
      method: 'POST',
    });
  },
};

export default {
  auth: authAPI,
  staff: staffAPI,
  users: staffAPI,
  categories: categoriesAPI,
  brands: brandsAPI,
  items: itemsAPI,
  variants: variantsAPI,
  itemVariants: itemVariantsAPI,
  orders: ordersAPI,
  stock: stockAPI,
  inOut: inOutAPI,
  cashierShift: cashierShiftAPI,
  reports: reportsAPI,
  database: databaseAPI,
  offline: offlineUtils,
  enhanced: enhancedAPI,
  globalDiscount: globalDiscountAPI,
  sync: syncAPI,
};