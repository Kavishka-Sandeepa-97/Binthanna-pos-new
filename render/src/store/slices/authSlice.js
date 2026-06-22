import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

// Async thunks for authentication
export const loginUser = createAsyncThunk(
  'auth/loginUser',
  async ({ username, pin }, { rejectWithValue }) => {
    try {
      const response = await api.auth.login({ username, pin });
      
      if (response.id && response.name && response.role) {
        // Store user data in localStorage
        const userData = {
          id: response.id,
          name: response.name,
          role: response.role
        };
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('isAuthenticated', 'true');
        
        // Check for active cashier shift (only for cashiers)
        let activeShift = null;
        if (response.role === 'cashier') {
          try {
            activeShift = await api.cashierShift.getActiveShift(response.id);
          } catch (shiftError) {
            console.warn('Could not fetch active shift:', shiftError);
            // Don't fail login if shift check fails
          }
        }
        
        return {
          user: userData,
          activeShift: activeShift,
          message: response.message
        };
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      // Return user-friendly error messages
      const errorMessage = error.message || 'Login failed. Please try again.';
      return rejectWithValue(errorMessage);
    }
  }
);

export const checkAuth = createAsyncThunk(
  'auth/checkAuth',
  async (_, { rejectWithValue }) => {
    try {
      const isAuthenticated = localStorage.getItem('isAuthenticated');
      const storedUser = localStorage.getItem('user');
      
      if (!isAuthenticated || !storedUser || isAuthenticated !== 'true') {
        throw new Error('No authentication found');
      }
      
      try {
        const user = JSON.parse(storedUser);
        
        // Check for active cashier shift (only for cashiers)
        let activeShift = null;
        if (user.role === 'cashier') {
          try {
            activeShift = await api.cashierShift.getActiveShift(user.id);
          } catch (shiftError) {
            console.warn('Could not fetch active shift:', shiftError);
            // Don't fail auth check if shift check fails
          }
        }
        
        return {
          user: user,
          activeShift: activeShift,
        };
      } catch (error) {
        localStorage.removeItem('isAuthenticated');
        localStorage.removeItem('user');
        throw new Error('Invalid user data');
      }
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const logoutUser = createAsyncThunk(
  'auth/logoutUser',
  async (_, { rejectWithValue }) => {
    try {
      localStorage.removeItem('isAuthenticated');
      localStorage.removeItem('user');
      
      return true;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null,
    activeShift: null,
    isAuthenticated: false,
    loading: false,
    error: null,
  },
  reducers: {
    logout: (state) => {
      state.user = null;
      state.activeShift = null;
      state.isAuthenticated = false;
      state.error = null;
      localStorage.removeItem('isAuthenticated');
      localStorage.removeItem('user');
    },
    clearError: (state) => {
      state.error = null;
    },
    setActiveShift: (state, action) => {
      state.activeShift = action.payload;
    },
    clearActiveShift: (state) => {
      state.activeShift = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Login
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.activeShift = action.payload.activeShift;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.isAuthenticated = false;
      })
      // Check Auth
      .addCase(checkAuth.fulfilled, (state, action) => {
        state.user = action.payload.user;
        state.activeShift = action.payload.activeShift;
        state.isAuthenticated = true;
        state.loading = false;
      })
      .addCase(checkAuth.rejected, (state) => {
        state.user = null;
        state.activeShift = null;
        state.isAuthenticated = false;
      })
      // Logout
      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null;
        state.activeShift = null;
        state.isAuthenticated = false;
        state.loading = false;
      });
  },
});

export const { logout, clearError, setActiveShift, clearActiveShift } = authSlice.actions;
export default authSlice.reducer;