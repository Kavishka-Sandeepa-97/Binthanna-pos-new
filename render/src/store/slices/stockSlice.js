import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

// Async thunks for stock operations

// Units
export const fetchUnits = createAsyncThunk(
  'stock/fetchUnits',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.stock.units.getAll();
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Stock Categories
export const fetchStockCategories = createAsyncThunk(
  'stock/fetchStockCategories',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.stock.categories.getAll();
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Suppliers
export const fetchSuppliers = createAsyncThunk(
  'stock/fetchSuppliers',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.stock.suppliers.getAll();
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Products
export const fetchProducts = createAsyncThunk(
  'stock/fetchProducts',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.stock.products.getAll();
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Transactions
export const fetchTransactions = createAsyncThunk(
  'stock/fetchTransactions',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await api.stock.transactions.getAll(params);
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

const stockSlice = createSlice({
  name: 'stock',
  initialState: {
    units: [],
    stockCategories: [],
    suppliers: [],
    products: [],
    transactions: [],
    filteredTransactions: [],
    loading: false,
    error: null,
    searchTerm: '',
    dateRange: {
      from: null,
      to: null,
    },
    transactionType: 'ALL', // ALL, IN, OUT
  },
  reducers: {
    setSearchTerm: (state, action) => {
      state.searchTerm = action.payload;
    },
    setDateRange: (state, action) => {
      state.dateRange = action.payload;
    },
    setTransactionType: (state, action) => {
      state.transactionType = action.payload;
    },
    filterTransactions: (state) => {
      let filtered = state.transactions;

      // Filter by type
      if (state.transactionType !== 'ALL') {
        filtered = filtered.filter(t => t.type === state.transactionType);
      }

      // Filter by search term (product name or supplier name)
      if (state.searchTerm) {
        const searchLower = state.searchTerm.toLowerCase();
        filtered = filtered.filter(t =>
          t.product_name?.toLowerCase().includes(searchLower) ||
          t.supplier_name?.toLowerCase().includes(searchLower)
        );
      }

      // Filter by date range
      if (state.dateRange.from) {
        filtered = filtered.filter(t => {
          const transactionDate = new Date(t.created_at);
          const fromDate = new Date(state.dateRange.from);
          return transactionDate >= fromDate;
        });
      }

      if (state.dateRange.to) {
        filtered = filtered.filter(t => {
          const transactionDate = new Date(t.created_at);
          const toDate = new Date(state.dateRange.to);
          toDate.setHours(23, 59, 59, 999); // Include the entire day
          return transactionDate <= toDate;
        });
      }

      state.filteredTransactions = filtered;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch units
      .addCase(fetchUnits.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchUnits.fulfilled, (state, action) => {
        state.loading = false;
        state.units = action.payload;
      })
      .addCase(fetchUnits.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Fetch stock categories
      .addCase(fetchStockCategories.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchStockCategories.fulfilled, (state, action) => {
        state.loading = false;
        state.stockCategories = action.payload;
      })
      .addCase(fetchStockCategories.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Fetch suppliers
      .addCase(fetchSuppliers.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchSuppliers.fulfilled, (state, action) => {
        state.loading = false;
        state.suppliers = action.payload;
      })
      .addCase(fetchSuppliers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Fetch products
      .addCase(fetchProducts.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchProducts.fulfilled, (state, action) => {
        state.loading = false;
        state.products = action.payload;
      })
      .addCase(fetchProducts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Fetch transactions
      .addCase(fetchTransactions.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchTransactions.fulfilled, (state, action) => {
        state.loading = false;
        // Handle both array response and object with transactions property
        if (Array.isArray(action.payload)) {
          state.transactions = action.payload;
          state.filteredTransactions = action.payload;
        } else if (action.payload.transactions) {
          state.transactions = action.payload.transactions;
          state.filteredTransactions = action.payload.transactions;
        } else {
          state.transactions = [];
          state.filteredTransactions = [];
        }
      })
      .addCase(fetchTransactions.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const {
  setSearchTerm,
  setDateRange,
  setTransactionType,
  filterTransactions,
  clearError,
} = stockSlice.actions;

export default stockSlice.reducer;
