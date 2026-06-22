import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

// Helper function to get all category IDs including subcategories
const getAllCategoryIds = (category) => {
  const ids = [category.id];
  if (category.subcategories && category.subcategories.length > 0) {
    category.subcategories.forEach(subcat => {
      ids.push(...getAllCategoryIds(subcat));
    });
  }
  return ids;
};

// Helper function to find category by ID in hierarchical structure
const findCategoryById = (categories, id) => {
  for (const cat of categories) {
    if (cat.id === id) return cat;
    if (cat.subcategories && cat.subcategories.length > 0) {
      const found = findCategoryById(cat.subcategories, id);
      if (found) return found;
    }
  }
  return null;
};

// Async thunks for inventory operations
export const fetchCategories = createAsyncThunk(
  'inventory/fetchCategories',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.enhanced.getCategories();
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchItemVariants = createAsyncThunk(
  'inventory/fetchItemVariants',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.enhanced.getItemVariants();
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchVariants = createAsyncThunk(
  'inventory/fetchVariants',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.variants.getAll();
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const searchItemVariants = createAsyncThunk(
  'inventory/searchItemVariants',
  async (query, { rejectWithValue }) => {
    try {
      const response = await api.itemVariants.search(query);
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const searchByBarcode = createAsyncThunk(
  'inventory/searchByBarcode',
  async (barcode, { rejectWithValue }) => {
    try {
      const response = await api.itemVariants.searchByBarcode(barcode);
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchItemsByCategory = createAsyncThunk(
  'inventory/fetchItemsByCategory',
  async (categoryId, { rejectWithValue }) => {
    try {
      const response = await api.itemVariants.getByCategoryId(categoryId);
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

const inventorySlice = createSlice({
  name: 'inventory',
  initialState: {
    categories: [],
    variants: [],
    itemVariants: [],
    filteredItems: [],
    selectedCategory: null, // Changed from 'all' to null
    selectedBrand: null,
    selectedGender: 'ALL',
    searchTerm: '',
    loading: false,
    error: null,
    barcodeResult: null,
  },
  reducers: {
    setSelectedCategory: (state, action) => {
      state.selectedCategory = action.payload;
      // Category filter is applied in filterItems
    },
    setSelectedBrand: (state, action) => {
      state.selectedBrand = action.payload;
    },
    setSelectedGender: (state, action) => {
      state.selectedGender = action.payload;
    },
    setSearchTerm: (state, action) => {
      state.searchTerm = action.payload;
    },
    resetFilters: (state) => {
      state.selectedCategory = null;
      state.selectedBrand = null;
      state.selectedGender = 'ALL';
      state.searchTerm = '';
      state.filteredItems = state.itemVariants;
    },
    filterItems: (state) => {
      let filtered = state.itemVariants;

      // Filter by category
      if (state.selectedCategory) {
        const category = findCategoryById(state.categories, state.selectedCategory);
        if (category) {
          const categoryIds = getAllCategoryIds(category);
          filtered = filtered.filter(item => categoryIds.includes(item.category_id));
        } else {
          // Fallback to name-based filtering
          filtered = filtered.filter(item =>
            (item.category_name || '').toLowerCase() === (state.selectedCategory || '').toLowerCase()
          );
        }
      }

      // Filter by brand
      if (state.selectedBrand) {
        const brandLower = (state.selectedBrand || '').toLowerCase();
        filtered = filtered.filter(item =>
          (item.brand_name || '').toLowerCase() === brandLower
        );
      }

      // Filter by gender
      if (state.selectedGender && state.selectedGender !== 'ALL') {
        const genderLower = (state.selectedGender || '').toLowerCase();
        filtered = filtered.filter(item =>
          (item.gender || '').toLowerCase() === genderLower
        );
      }

      // Filter by search term (safe checks)
      if (state.searchTerm) {
        const searchLower = (state.searchTerm || '').toLowerCase();
        filtered = filtered.filter(item => {
          const name = (item.item_name || item.name || '').toString().toLowerCase();
          const variant = (item.variant_name || item.variant || '').toString().toLowerCase();
          const category = (item.category_name || '').toString().toLowerCase();
          const barcode = (item.barcode || '').toString().toLowerCase();
          return (
            name.includes(searchLower) ||
            variant.includes(searchLower) ||
            category.includes(searchLower) ||
            barcode.includes(searchLower)
          );
        });
      }

      state.filteredItems = filtered;
    },
    clearBarcodeResult: (state) => {
      state.barcodeResult = null;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch categories
      .addCase(fetchCategories.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchCategories.fulfilled, (state, action) => {
        state.loading = false;
        state.categories = action.payload;
      })
      .addCase(fetchCategories.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Fetch variants
      .addCase(fetchVariants.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchVariants.fulfilled, (state, action) => {
        state.loading = false;
        state.variants = action.payload;
      })
      .addCase(fetchVariants.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Fetch item variants
      .addCase(fetchItemVariants.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchItemVariants.fulfilled, (state, action) => {
        state.loading = false;
        state.itemVariants = action.payload;
        state.filteredItems = action.payload;
      })
      .addCase(fetchItemVariants.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Search item variants
      .addCase(searchItemVariants.fulfilled, (state, action) => {
        state.filteredItems = action.payload;
      })
      // Search by barcode
      .addCase(searchByBarcode.pending, (state) => {
        state.loading = true;
      })
      .addCase(searchByBarcode.fulfilled, (state, action) => {
        state.loading = false;
        state.barcodeResult = action.payload;
      })
      .addCase(searchByBarcode.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.barcodeResult = null;
      });
  },
});

export const {
  setSelectedCategory,
  setSelectedBrand,
  setSelectedGender,
  resetFilters,
  setSearchTerm,
  filterItems,
  clearBarcodeResult,
  clearError,
} = inventorySlice.actions;

export default inventorySlice.reducer;