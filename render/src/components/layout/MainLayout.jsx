import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Avatar,
  Menu,
  MenuItem,
  Button,
  Tooltip,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  InputAdornment,
  Divider,
} from '@mui/material';
import {
  PointOfSale,
  Inventory,
  Receipt,
  Analytics,
  Settings,
  Logout,
  Person,
  AccountBalanceWallet,
  PlayArrow,
  Stop,
  Refresh,
  Storefront,
} from '@mui/icons-material';
import { logout } from '../../store/slices/authSlice';
import { setCurrentView } from '../../store/slices/uiSlice';
import { closeCashierShift, openCashierShift, fetchActiveShift } from '../../store/slices/cashierShiftSlice';
import { setActiveShift, clearActiveShift } from '../../store/slices/authSlice';

const MainLayout = ({ children }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const isPosRoute = location.pathname === '/pos';
  
  const { user, activeShift } = useSelector((state) => state.auth);
  
  const [anchorEl, setAnchorEl] = useState(null);

  // Shift management state
  const [openShiftDialog, setOpenShiftDialog] = useState(false);
  const [closeShiftDialog, setCloseShiftDialog] = useState(false);
  const [shiftAmount, setShiftAmount] = useState('');
  const [shiftDescription, setShiftDescription] = useState('');

  const navItems = [
    { text: 'POS', icon: <PointOfSale />, path: '/pos', view: 'pos' },
    { text: 'Inventory', icon: <Inventory />, path: '/inventory', view: 'inventory' },
    { text: 'In/Out', icon: <Receipt />, path: '/inout', view: 'inout' },
    { text: 'Reports', icon: <Analytics />, path: '/reports', view: 'reports' },
    { text: 'Stock Manage', icon: <Inventory />, path: '/stock', view: 'stock', color: '#FF9800', hoverBg: 'rgba(255, 152, 0, 0.15)' },
    { text: 'Stock Report', icon: <Analytics />, path: '/stock-report', view: 'stock-report', color: '#E91E63', hoverBg: 'rgba(233, 30, 99, 0.15)' },
    { text: 'Settings', icon: <Settings />, path: '/settings', view: 'settings' },
  ];

  const handleMenuClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
    handleMenuClose();
  };

  // Shift management functions
  const handleOpenShift = () => {
    setOpenShiftDialog(true);
    handleMenuClose();
  };

  const handleCloseShift = () => {
    setCloseShiftDialog(true);
    handleMenuClose();
  };

  const handleConfirmOpenShift = async () => {
    const amount = parseFloat(shiftAmount);
    if (isNaN(amount) || amount < 0) {
      alert('Please enter a valid amount');
      return;
    }

    try {
      const result = await dispatch(openCashierShift({
        user_id: user.id,
        initial_cash_onhand: amount,
        description: shiftDescription.trim() || 'Shift opened',
      }));

      if (result.type === 'cashierShift/open/fulfilled') {
        dispatch(setActiveShift(result.payload));
        setOpenShiftDialog(false);
        setShiftAmount('');
        setShiftDescription('');
      }
    } catch (error) {
      console.error('Error opening shift:', error);
      alert('Failed to open shift. Please try again.');
    }
  };

  const handleConfirmCloseShift = async () => {
    try {
      const result = await dispatch(closeCashierShift({
        id: activeShift.id,
        closeData: {
          current_cash_onhand: activeShift?.current_cash_onhand || 0,
          description: shiftDescription.trim() || 'Shift closed',
        },
      }));

      if (result.type === 'cashierShift/close/fulfilled') {
        dispatch(clearActiveShift());
        setCloseShiftDialog(false);
        setShiftAmount('');
        setShiftDescription('');
      }
    } catch (error) {
      console.error('Error closing shift:', error);
      alert('Failed to close shift. Please try again.');
    }
  };

  const handleRefreshCash = async () => {
    if (!user?.id) return;
    
    try {
      const result = await dispatch(fetchActiveShift(user.id));
      if (result.type === 'cashierShift/fetchActive/fulfilled') {
        dispatch(setActiveShift(result.payload));
      }
    } catch (error) {
      console.error('Error refreshing cash:', error);
    }
  };

  const handleNavigation = (path, view) => {
    navigate(path);
    dispatch(setCurrentView(view));
  };

  const isActive = (path) => location.pathname === path;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Top Navbar */}
      <AppBar 
        position="fixed" 
        elevation={0}
        sx={{ 
          background: 'linear-gradient(135deg, #2C3E50 0%, #34495E 50%, #2C3E50 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between', px: { xs: 1, sm: 2 } }}>
          {/* Left Side - Logo */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Storefront sx={{ fontSize: 28, color: '#4ECDC4' }} />
            <Typography
              variant="h6"
              sx={{
                fontWeight: 'bold',
                background: 'linear-gradient(45deg, #4ECDC4, #44A08D)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                display: { xs: 'none', sm: 'block' },
              }}
            >
              POS
            </Typography>
          </Box>

          {/* Center - Navigation Items */}
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: { xs: 0.5, sm: 1, md: 2 },
            flex: 1,
            justifyContent: 'center',
          }}>
            {navItems.map((item) => (
              <Tooltip key={item.path} title={item.text}>
                <Button
                  onClick={() => handleNavigation(item.path, item.view)}
                  sx={{
                    color: isActive(item.path) ? (item.color || '#4ECDC4') : (item.color || 'rgba(255,255,255,0.8)'),
                    backgroundColor: isActive(item.path) ? (item.hoverBg || 'rgba(76, 205, 196, 0.15)') : 'transparent',
                    borderRadius: 2,
                    px: { xs: 1, sm: 2 },
                    py: 1,
                    minWidth: 'auto',
                    display: 'flex',
                    flexDirection: { xs: 'column', md: 'row' },
                    alignItems: 'center',
                    gap: { xs: 0.3, md: 1 },
                    textTransform: 'none',
                    fontWeight: isActive(item.path) ? 600 : 400,
                    fontSize: { xs: '0.65rem', sm: '0.75rem', md: '0.875rem' },
                    transition: 'all 0.2s ease',
                    borderBottom: isActive(item.path) ? `2px solid ${item.color || '#4ECDC4'}` : '2px solid transparent',
                    '&:hover': {
                      backgroundColor: item.hoverBg || 'rgba(76, 205, 196, 0.1)',
                      color: item.color || '#4ECDC4',
                    },
                  }}
                >
                  {React.cloneElement(item.icon, { 
                    sx: { fontSize: { xs: 20, sm: 22, md: 20 } } 
                  })}
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      display: { xs: 'block' },
                      fontSize: 'inherit',
                    }}
                  >
                    {item.text}
                  </Typography>
                </Button>
              </Tooltip>
            ))}
          </Box>

          {/* Right Side - Cash & Profile */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 2 } }}>
            {/* Cash on Hand Display */}
            {user?.role === 'cashier' && (
              <Box 
                sx={{ 
                  display: 'flex', 
                  alignItems: 'center',
                  backgroundColor: 'rgba(76, 205, 196, 0.15)',
                  borderRadius: 2,
                  px: { xs: 1, sm: 1.5 },
                  py: 0.5,
                  border: '1px solid rgba(76, 205, 196, 0.3)',
                }}
              >
                <AccountBalanceWallet sx={{ fontSize: { xs: 16, sm: 18 }, mr: 0.5, color: '#4ECDC4' }} />
                <Typography 
                  variant="body2" 
                  sx={{ 
                    color: 'white', 
                    fontWeight: 600,
                    fontSize: { xs: '0.75rem', sm: '0.875rem' },
                  }}
                >
                  Rs. {activeShift ? activeShift.current_cash_onhand?.toFixed(2) : '0.00'}
                </Typography>
                <Tooltip title="Refresh">
                  <IconButton 
                    onClick={handleRefreshCash} 
                    size="small" 
                    sx={{ 
                      p: 0.3, 
                      ml: 0.5,
                      color: 'rgba(255,255,255,0.7)', 
                      '&:hover': { color: '#4ECDC4' } 
                    }}
                  >
                    <Refresh sx={{ fontSize: 14 }} />
                  </IconButton>
                </Tooltip>
              </Box>
            )}

            {/* Profile Avatar & Menu */}
            <Tooltip title={user?.name || 'Account'}>
              <IconButton onClick={handleMenuClick} sx={{ p: 0.5 }}>
                <Avatar
                  sx={{
                    bgcolor: '#4ECDC4',
                    color: 'white',
                    width: { xs: 32, sm: 36 },
                    height: { xs: 32, sm: 36 },
                    fontSize: { xs: '0.875rem', sm: '1rem' },
                    fontWeight: 600,
                    border: '2px solid rgba(255,255,255,0.2)',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      transform: 'scale(1.05)',
                      boxShadow: '0 0 12px rgba(76, 205, 196, 0.5)',
                    },
                  }}
                >
                  {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                </Avatar>
              </IconButton>
            </Tooltip>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Profile Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        PaperProps={{
          elevation: 8,
          sx: {
            overflow: 'visible',
            filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
            mt: 1.5,
            minWidth: 220,
            borderRadius: 2,
            '&:before': {
              content: '""',
              display: 'block',
              position: 'absolute',
              top: 0,
              right: 14,
              width: 10,
              height: 10,
              bgcolor: 'background.paper',
              transform: 'translateY(-50%) rotate(45deg)',
              zIndex: 0,
            },
          },
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        {/* User Info */}
        <Box sx={{ px: 2, py: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar sx={{ bgcolor: '#4ECDC4', width: 40, height: 40 }}>
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </Avatar>
            <Box>
              <Typography variant="subtitle2" fontWeight={600}>
                {user?.name || 'User'}
              </Typography>
              <Chip
                label={user?.role || 'Staff'}
                size="small"
                color={user?.role === 'admin' ? 'primary' : 'default'}
                sx={{ fontSize: '0.7rem', height: 20 }}
              />
            </Box>
          </Box>
        </Box>
        
        <Divider />
        
        <MenuItem onClick={() => { navigate('/settings?tab=profile'); handleMenuClose(); }}>
          <Person fontSize="small" sx={{ mr: 1.5, color: 'text.secondary' }} />
          Profile Settings
        </MenuItem>
        
        {/* Cashier Shift Management */}
        {user?.role === 'cashier' && (
          <>
            <Divider />
            {activeShift ? (
              <MenuItem onClick={handleCloseShift} sx={{ color: 'warning.main' }}>
                <Stop fontSize="small" sx={{ mr: 1.5 }} />
                Close Shift
              </MenuItem>
            ) : (
              <MenuItem onClick={handleOpenShift} sx={{ color: 'success.main' }}>
                <PlayArrow fontSize="small" sx={{ mr: 1.5 }} />
                Open Shift
              </MenuItem>
            )}
          </>
        )}
        
        <Divider />
        
        <MenuItem onClick={handleLogout} sx={{ color: 'error.main' }}>
          <Logout fontSize="small" sx={{ mr: 1.5 }} />
          Logout
        </MenuItem>
      </Menu>

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          bgcolor: '#f5f7fa',
          minHeight: '100vh',
          pt: '64px', // Account for AppBar height
        }}
      >
        <Box sx={{ p: isPosRoute ? 0 : { xs: 1.5, sm: 2, md: 3 } }}>
          {children}
        </Box>
      </Box>

      {/* Open Shift Dialog */}
      <Dialog 
        open={openShiftDialog} 
        onClose={() => setOpenShiftDialog(false)} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PlayArrow color="success" />
            Open Cashier Shift
          </Box>
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Initial Cash Amount"
            type="number"
            fullWidth
            value={shiftAmount}
            onChange={(e) => setShiftAmount(e.target.value)}
            InputProps={{
              startAdornment: <InputAdornment position="start">Rs.</InputAdornment>,
            }}
            sx={{ mt: 1 }}
          />
          <TextField
            margin="dense"
            label="Description (Optional)"
            fullWidth
            value={shiftDescription}
            onChange={(e) => setShiftDescription(e.target.value)}
            placeholder="Starting cash for the shift"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpenShiftDialog(false)} variant="outlined">
            Cancel
          </Button>
          <Button onClick={handleConfirmOpenShift} variant="contained" color="success">
            Open Shift
          </Button>
        </DialogActions>
      </Dialog>

      {/* Close Shift Dialog */}
      <Dialog 
        open={closeShiftDialog} 
        onClose={() => setCloseShiftDialog(false)} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Stop color="warning" />
            Close Cashier Shift
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box 
            sx={{ 
              p: 2, 
              mb: 2, 
              mt: 1,
              backgroundColor: 'rgba(76, 205, 196, 0.1)', 
              borderRadius: 2,
              border: '1px solid rgba(76, 205, 196, 0.3)',
            }}
          >
            <Typography variant="body2" color="text.secondary">
              Current Cash on Hand
            </Typography>
            <Typography variant="h5" fontWeight={600} color="primary">
              Rs. {activeShift?.current_cash_onhand?.toFixed(2) || '0.00'}
            </Typography>
          </Box>
          <TextField
            margin="dense"
            label="Description (Optional)"
            fullWidth
            value={shiftDescription}
            onChange={(e) => setShiftDescription(e.target.value)}
            placeholder="Reason for closing shift or notes"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCloseShiftDialog(false)} variant="outlined">
            Cancel
          </Button>
          <Button onClick={handleConfirmCloseShift} variant="contained" color="warning">
            Close Shift
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MainLayout;
