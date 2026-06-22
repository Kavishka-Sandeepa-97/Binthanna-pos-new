import { configureStore } from '@reduxjs/toolkit';
import authSlice from './slices/authSlice';
import orderSlice from './slices/orderSlice';
import inventorySlice from './slices/inventorySlice';
import uiSlice from './slices/uiSlice';
import cashierShiftSlice from './slices/cashierShiftSlice';
import stockSlice from './slices/stockSlice';

export const store = configureStore({
  reducer: {
    auth: authSlice,
    order: orderSlice,
    inventory: inventorySlice,
    ui: uiSlice,
    cashierShift: cashierShiftSlice,
    stock: stockSlice,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST'],
      },
    }),
});

// Type definitions removed - not needed in JavaScript
// For TypeScript projects, these would be:
// export type RootState = ReturnType<typeof store.getState>;
// export type AppDispatch = typeof store.dispatch;