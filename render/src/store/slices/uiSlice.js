import { createSlice } from '@reduxjs/toolkit';

const uiSlice = createSlice({
  name: 'ui',
  initialState: {
    sidebarOpen: true,
    currentView: 'pos', // dashboard, pos, orders, inventory, reports, settings
    theme: 'light',
    notifications: [],
    modals: {
      orderDetails: { open: false, orderId: null },
      customerInfo: { open: false },
      payment: { open: false },
      barcode: { open: false },
      userManagement: { open: false },
      settings: { open: false },
    },
    loading: {
      global: false,
      orders: false,
      inventory: false,
    },
  },
  reducers: {
    setSidebarOpen: (state, action) => {
      state.sidebarOpen = action.payload;
    },
    setCurrentView: (state, action) => {
      state.currentView = action.payload;
    },
    setTheme: (state, action) => {
      state.theme = action.payload;
    },
    addNotification: (state, action) => {
      const notification = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        ...action.payload,
      };
      state.notifications.unshift(notification);
      
      // Keep only last 50 notifications
      if (state.notifications.length > 50) {
        state.notifications = state.notifications.slice(0, 50);
      }
    },
    removeNotification: (state, action) => {
      state.notifications = state.notifications.filter(
        notification => notification.id !== action.payload
      );
    },
    clearNotifications: (state) => {
      state.notifications = [];
    },
    openModal: (state, action) => {
      const { modalName, data } = action.payload;
      if (state.modals[modalName]) {
        state.modals[modalName].open = true;
        if (data) {
          Object.assign(state.modals[modalName], data);
        }
      }
    },
    closeModal: (state, action) => {
      const modalName = action.payload;
      if (state.modals[modalName]) {
        state.modals[modalName].open = false;
        // Reset modal data
        Object.keys(state.modals[modalName]).forEach(key => {
          if (key !== 'open') {
            state.modals[modalName][key] = null;
          }
        });
      }
    },
    closeAllModals: (state) => {
      Object.keys(state.modals).forEach(modalName => {
        state.modals[modalName].open = false;
        Object.keys(state.modals[modalName]).forEach(key => {
          if (key !== 'open') {
            state.modals[modalName][key] = null;
          }
        });
      });
    },
    setLoading: (state, action) => {
      const { type, loading } = action.payload;
      if (state.loading[type] !== undefined) {
        state.loading[type] = loading;
      }
    },
  },
});

export const {
  setSidebarOpen,
  setCurrentView,
  setTheme,
  addNotification,
  removeNotification,
  clearNotifications,
  openModal,
  closeModal,
  closeAllModals,
  setLoading,
} = uiSlice.actions;

export default uiSlice.reducer;