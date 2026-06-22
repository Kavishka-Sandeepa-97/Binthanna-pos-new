import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { cashierShiftAPI } from '../../services/api';
import { setActiveShift } from './authSlice';

// Async thunks for cashier shift operations
export const fetchCashierShifts = createAsyncThunk(
  'cashierShift/fetchAll',
  async (_, { rejectWithValue }) => {
    try {
      const response = await cashierShiftAPI.getAll();
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchActiveShift = createAsyncThunk(
  'cashierShift/fetchActive',
  async (userId, { rejectWithValue }) => {
    try {
      const response = await cashierShiftAPI.getActiveShift(userId);
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const openCashierShift = createAsyncThunk(
  'cashierShift/open',
  async (shiftData, { rejectWithValue }) => {
    try {
      const response = await cashierShiftAPI.openShift(shiftData);
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const closeCashierShift = createAsyncThunk(
  'cashierShift/close',
  async ({ id, closeData }, { rejectWithValue }) => {
    try {
      const response = await cashierShiftAPI.closeShift(id, closeData);
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const updateCashierShift = createAsyncThunk(
  'cashierShift/update',
  async ({ id, shiftData }, { rejectWithValue }) => {
    try {
      const response = await cashierShiftAPI.updateShift(id, shiftData);
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

const cashierShiftSlice = createSlice({
  name: 'cashierShift',
  initialState: {
    shifts: [],
    loading: false,
    error: null,
  },
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    updateCashAmount: (state, action) => {
      // This action is no longer needed since activeShift is managed by authSlice
      // Keeping it for backward compatibility but it won't do anything
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch all shifts
      .addCase(fetchCashierShifts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCashierShifts.fulfilled, (state, action) => {
        state.loading = false;
        state.shifts = action.payload;
      })
      .addCase(fetchCashierShifts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Fetch active shift
      .addCase(fetchActiveShift.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchActiveShift.fulfilled, (state, action) => {
        state.loading = false;
        // activeShift is now managed by authSlice
      })
      .addCase(fetchActiveShift.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Open shift
      .addCase(openCashierShift.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(openCashierShift.fulfilled, (state, action) => {
        state.loading = false;
        // activeShift is now managed by authSlice
        // Add to shifts list
        state.shifts.unshift(action.payload);
      })
      .addCase(openCashierShift.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Close shift
      .addCase(closeCashierShift.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(closeCashierShift.fulfilled, (state, action) => {
        state.loading = false;
        // Update the shift in the list
        const index = state.shifts.findIndex(shift => shift.id === action.meta.arg.id);
        if (index !== -1) {
          state.shifts[index].status = 'closed';
          state.shifts[index].close_at = new Date().toISOString();
          state.shifts[index].current_cash_onhand = action.meta.arg.closeData.current_cash_onhand;
        }
        // activeShift clearing is now handled by authSlice
      })
      .addCase(closeCashierShift.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Update shift
      .addCase(updateCashierShift.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateCashierShift.fulfilled, (state, action) => {
        state.loading = false;
        // Update active shift if it's the one being updated
        if (state.activeShift && state.activeShift.id === action.meta.arg.id) {
          state.activeShift = { ...state.activeShift, ...action.payload };
        }
        // Update in shifts list
        const index = state.shifts.findIndex(shift => shift.id === action.meta.arg.id);
        if (index !== -1) {
          state.shifts[index] = { ...state.shifts[index], ...action.payload };
        }
      })
      .addCase(updateCashierShift.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearError, updateCashAmount } = cashierShiftSlice.actions;

export default cashierShiftSlice.reducer;