import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  TextField,
  Switch,
  FormControlLabel,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  Divider,
  Alert,
  MenuItem,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@mui/material';
import {
  Person as PersonIcon,
  Security as SecurityIcon,
  Store as StoreIcon,
  Print as PrintIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Save as SaveIcon,
  AccountBalanceWallet,
  Refresh,
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import api from '../../services/api';
import PrinterSettings from './PrinterSettings';

const Settings = () => {
  const { user } = useSelector((state) => state.auth);
  const location = useLocation();
  const [currentTab, setCurrentTab] = useState(0);
  const [loading, setLoading] = useState(false);
  
  // User management state
  const [userDialog, setUserDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [newUser, setNewUser] = useState({
    name: '',
    username: '',
    pin: '',
    role: 'cashier',
    is_active: true,
  });

  const [users, setUsers] = useState([]);

  // Cashier shift state
  const [cashierShifts, setCashierShifts] = useState([]);
  const [shiftLoading, setShiftLoading] = useState(false);

  // Profile/PIN update state
  const [pinDialog, setPinDialog] = useState(false);
  const [pinData, setPinData] = useState({
    currentPin: '',
    newPin: '',
    confirmPin: '',
  });

  const [storeSettings, setStoreSettings] = useState({
    storeName: 'Binthanna Restaurant',
    address: '123 Main Street, City, Country',
    phone: '+1 234 567 8900',
    email: 'info@binthanna.com',
    taxRate: '10',
    currency: 'USD',
    receiptFooter: 'Thank you for dining with us!',
  });

  useEffect(() => {
    fetchUsers();
    fetchCashierShifts();
  }, []);

  useEffect(() => {
    // If URL contains ?tab=profile (or other), open that tab
    const params = new URLSearchParams(location.search);
    const tabValue = params.get('tab');
    if (tabValue) {
      const tabMap = {
        profile: 0,
        users: 1,
        cashierShifts: 2,
        store: 3,
        printer: 4,
      };
      if (tabMap[tabValue] !== undefined) {
        setCurrentTab(tabMap[tabValue]);
      }
    }
  }, [location.search]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const staffList = await api.staff.getAll();
      setUsers(staffList);
    } catch (error) {
      toast.error(error.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const fetchCashierShifts = async () => {
    try {
      setShiftLoading(true);
      const shifts = await api.cashierShift.getAll();
      setCashierShifts(shifts);
    } catch (error) {
      toast.error(error.message || 'Failed to load cashier shifts');
    } finally {
      setShiftLoading(false);
    }
  };

  const handleTabChange = (event, newValue) => {
    setCurrentTab(newValue);
  };

  const handleAddUser = () => {
    setSelectedUser(null);
    setNewUser({
      name: '',
      username: '',
      pin: '',
      role: 'cashier',
      is_active: true,
    });
    setUserDialog(true);
  };

  const handleEditUser = (user) => {
    setSelectedUser(user);
    setNewUser({
      name: user.name,
      username: user.username,
      pin: '',
      role: user.role,
      is_active: user.is_active,
    });
    setUserDialog(true);
  };

  const handleSaveUser = async () => {
    // Validation
    if (!newUser.name || !newUser.username || (!selectedUser && !newUser.pin)) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (newUser.pin && newUser.pin.length < 4) {
      toast.error('PIN must be at least 4 characters long');
      return;
    }

    try {
      setLoading(true);
      
      if (selectedUser) {
        // Update existing user
        const updateData = {
          name: newUser.name,
          username: newUser.username,
          role: newUser.role,
          is_active: newUser.is_active,
        };
        
        // Only include PIN if it's being changed
        if (newUser.pin) {
          updateData.pin = newUser.pin;
        }
        
        await api.staff.update(selectedUser.id, updateData);
        toast.success('User updated successfully');
      } else {
        // Create new user
        await api.staff.create({
          name: newUser.name,
          username: newUser.username,
          pin: newUser.pin,
          role: newUser.role,
        });
        toast.success('User created successfully');
      }
      
      setUserDialog(false);
      fetchUsers();
    } catch (error) {
      toast.error(error.message || 'Failed to save user');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId, username) => {
    if (username === 'Admin') {
      toast.error('Cannot delete the default admin user');
      return;
    }
    
    if (window.confirm(`Are you sure you want to delete user "${username}"?`)) {
      try {
        setLoading(true);
        await api.staff.delete(userId);
        toast.success('User deleted successfully');
        fetchUsers();
      } catch (error) {
        toast.error(error.message || 'Failed to delete user');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleToggleUserStatus = async (userId, currentStatus, username) => {
    if (username === 'Admin') {
      toast.error('Cannot deactivate the default admin user');
      return;
    }
    
    try {
      setLoading(true);
      await api.staff.update(userId, { is_active: !currentStatus });
      toast.success(`User ${!currentStatus ? 'activated' : 'deactivated'} successfully`);
      fetchUsers();
    } catch (error) {
      toast.error(error.message || 'Failed to update user status');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePin = async () => {
    // Validation
    if (!pinData.currentPin || !pinData.newPin || !pinData.confirmPin) {
      toast.error('Please fill in all fields');
      return;
    }

    if (pinData.newPin.length < 4) {
      toast.error('PIN must be at least 4 characters long');
      return;
    }

    if (pinData.newPin !== pinData.confirmPin) {
      toast.error('New PIN and confirmation do not match');
      return;
    }

    try {
      setLoading(true);
      
      // Update PIN using dedicated endpoint
      await api.staff.updateOwnPin(user.id, pinData.currentPin, pinData.newPin);
      
      toast.success('PIN updated successfully');
      setPinDialog(false);
      setPinData({ currentPin: '', newPin: '', confirmPin: '' });
    } catch (error) {
      toast.error(error.message || 'Failed to update PIN. Please check your current PIN.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveStoreSettings = () => {
    // Here you would call an API to save store settings
    toast.success('Store settings saved successfully');
  };

  const UserManagement = () => (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h6" fontWeight="bold">
            User Management
          </Typography>
          {user?.role === 'admin' && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleAddUser}
              disabled={loading}
            >
              Add User
            </Button>
          )}
        </Box>

        {user?.role !== 'admin' && (
          <Alert severity="info" sx={{ mb: 3 }}>
            Only administrators can manage users. You can update your PIN in the Profile tab.
          </Alert>
        )}

        {loading && (
          <Box display="flex" justifyContent="center" p={3}>
            <CircularProgress />
          </Box>
        )}

        {!loading && (
          <List>
            {users.map((userItem) => (
              <React.Fragment key={userItem.id}>
                <ListItem>
                  <ListItemText
                    primary={
                      <Box display="flex" alignItems="center" gap={1}>
                        <Typography variant="body1">{userItem.name}</Typography>
                        {userItem.username && (
                          <Typography variant="body2" color="text.secondary">(@{userItem.username})</Typography>
                        )}
                        <Chip 
                          label={userItem.role} 
                          color={userItem.role === 'admin' ? 'primary' : 'default'}
                          size="small"
                        />
                        <Chip 
                          label={userItem.is_active ? 'Active' : 'Inactive'} 
                          color={userItem.is_active ? 'success' : 'error'}
                          size="small"
                        />
                      </Box>
                    }
                    secondary={`Created: ${new Date(userItem.created_at).toLocaleDateString()}`}
                  />
                  {user?.role === 'admin' && (
                    <ListItemSecondaryAction>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={userItem.is_active}
                            onChange={() => handleToggleUserStatus(userItem.id, userItem.is_active, userItem.name)}
                            disabled={loading || userItem.name === 'Admin'}
                          />
                        }
                        label=""
                      />
                      <IconButton
                        edge="end"
                        onClick={() => handleEditUser(userItem)}
                        sx={{ mr: 1 }}
                        disabled={loading}
                      >
                        <EditIcon />
                      </IconButton>
                      {userItem.name !== 'Admin' && (
                        <IconButton
                          edge="end"
                          color="error"
                          onClick={() => handleDeleteUser(userItem.id, userItem.name)}
                          disabled={loading}
                        >
                          <DeleteIcon />
                        </IconButton>
                      )}
                    </ListItemSecondaryAction>
                  )}
                </ListItem>
                <Divider />
              </React.Fragment>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );

  const StoreSettings = () => (
    <Card>
      <CardContent>
        <Typography variant="h6" fontWeight="bold" mb={3}>
          Store Information
        </Typography>
        
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Store Name"
              value={storeSettings.storeName}
              onChange={(e) => setStoreSettings({ ...storeSettings, storeName: e.target.value })}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Phone Number"
              value={storeSettings.phone}
              onChange={(e) => setStoreSettings({ ...storeSettings, phone: e.target.value })}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Address"
              multiline
              rows={2}
              value={storeSettings.address}
              onChange={(e) => setStoreSettings({ ...storeSettings, address: e.target.value })}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={storeSettings.email}
              onChange={(e) => setStoreSettings({ ...storeSettings, email: e.target.value })}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              select
              label="Currency"
              value={storeSettings.currency}
              onChange={(e) => setStoreSettings({ ...storeSettings, currency: e.target.value })}
            >
              <MenuItem value="USD">USD ($)</MenuItem>
              <MenuItem value="EUR">EUR (€)</MenuItem>
              <MenuItem value="GBP">GBP (£)</MenuItem>
              <MenuItem value="LKR">LKR (Rs)</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Tax Rate (%)"
              type="number"
              value={storeSettings.taxRate}
              onChange={(e) => setStoreSettings({ ...storeSettings, taxRate: e.target.value })}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Receipt Footer"
              multiline
              rows={2}
              value={storeSettings.receiptFooter}
              onChange={(e) => setStoreSettings({ ...storeSettings, receiptFooter: e.target.value })}
            />
          </Grid>
          <Grid item xs={12}>
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={handleSaveStoreSettings}
            >
              Save Store Settings
            </Button>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );

  const ProfileSettings = () => (
    <Card>
      <CardContent>
        <Typography variant="h6" fontWeight="bold" mb={3}>
          Profile Settings
        </Typography>
        
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Full Name"
              value={user?.name || ''}
              disabled
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Username"
              value={user?.username || ''}
              disabled
              helperText="Username cannot be changed"
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Role"
              value={user?.role || ''}
              disabled
            />
          </Grid>
          <Grid item xs={12}>
            <Button
              variant="contained"
              startIcon={<SecurityIcon />}
              onClick={() => setPinDialog(true)}
              disabled={loading}
            >
              Change PIN
            </Button>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );

  const CashierShifts = () => (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h6" fontWeight="bold">
            Cashier Shift History
          </Typography>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={fetchCashierShifts}
            disabled={shiftLoading}
            size="small"
          >
            Refresh
          </Button>
        </Box>

        {user?.role !== 'admin' && (
          <Alert severity="info" sx={{ mb: 3 }}>
            Showing your cashier shift history. Administrators can view all users' shifts.
          </Alert>
        )}

        {shiftLoading ? (
          <Box display="flex" justifyContent="center" p={3}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Cashier</TableCell>
                  <TableCell>Opened At</TableCell>
                  <TableCell>Closed At</TableCell>
                  <TableCell align="right">Initial Cash</TableCell>
                  <TableCell align="right">Final Cash</TableCell>
                  <TableCell align="right">Difference</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {cashierShifts
                  .filter(shift => user?.role === 'admin' || shift.staff_id === user?.id)
                  .map((shift) => (
                    <TableRow key={shift.id}>
                      <TableCell>{shift.user_name}</TableCell>
                      <TableCell>{new Date(shift.open_at).toLocaleString()}</TableCell>
                      <TableCell>
                        {shift.close_at ? new Date(shift.close_at).toLocaleString() : '-'}
                      </TableCell>
                      <TableCell align="right">{shift.initial_cash_onhand?.toFixed(2)}</TableCell>
                      <TableCell align="right">
                        {shift.close_at ? `${shift.current_cash_onhand?.toFixed(2)}` : '-'}
                      </TableCell>
                      <TableCell align="right">
                        {shift.close_at ? (
                          <Typography
                            color={
                              shift.current_cash_onhand - shift.initial_cash_onhand >= 0
                                ? 'success.main'
                                : 'error.main'
                            }
                          >
                            {(shift.current_cash_onhand - shift.initial_cash_onhand).toFixed(2)}
                          </Typography>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={shift.status}
                          color={shift.status === 'open' ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                {cashierShifts.filter(shift => user?.role === 'admin' || shift.staff_id === user?.id).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      No cashier shifts found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>
    </Card>
  );

  return (
    <Box p={3}>
      <Typography variant="h4" fontWeight="bold" mb={3}>
        Settings
      </Typography>

      <Tabs value={currentTab} onChange={handleTabChange} sx={{ mb: 3 }}>
        <Tab icon={<PersonIcon />} label="Profile" />
        <Tab icon={<SecurityIcon />} label="Users" />
        <Tab icon={<AccountBalanceWallet />} label="Cashier Shifts" />
        <Tab icon={<StoreIcon />} label="Store" />
        <Tab icon={<PrintIcon />} label="Printer" />
      </Tabs>

      {currentTab === 0 && <ProfileSettings />}
      {currentTab === 1 && <UserManagement />}
      {currentTab === 2 && <CashierShifts />}
      {currentTab === 3 && <StoreSettings />}
      {currentTab === 4 && <PrinterSettings />}

      {/* Add/Edit User Dialog */}
      <Dialog 
        open={userDialog} 
        onClose={() => !loading && setUserDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {selectedUser ? 'Edit User' : 'Add New User'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Full Name"
                value={newUser.name}
                onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                disabled={loading || selectedUser?.name === 'Admin'}
                helperText="Display name for the user"
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Username"
                value={newUser.username}
                onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                disabled={loading || selectedUser?.username === 'admin'}
                helperText="Used for login (cannot contain spaces)"
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label={selectedUser ? 'New PIN (leave blank to keep current)' : 'PIN'}
                type="password"
                value={newUser.pin}
                onChange={(e) => setNewUser({ ...newUser, pin: e.target.value })}
                helperText="Minimum 4 characters"
                required={!selectedUser}
                disabled={loading}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                select
                label="Role"
                value={newUser.role}
                onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                disabled={loading || selectedUser?.name === 'Admin'}
              >
                <MenuItem value="admin">Administrator</MenuItem>
                <MenuItem value="cashier">Cashier</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={newUser.is_active}
                    onChange={(e) => setNewUser({ ...newUser, is_active: e.target.checked })}
                    disabled={loading || selectedUser?.name === 'Admin'}
                  />
                }
                label="Active User"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUserDialog(false)} disabled={loading}>
            Cancel
          </Button>
          <Button 
            onClick={handleSaveUser}
            variant="contained"
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : (selectedUser ? 'Update' : 'Create')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Change PIN Dialog */}
      <Dialog 
        open={pinDialog} 
        onClose={() => !loading && setPinDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Change PIN
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Current PIN"
                type="password"
                value={pinData.currentPin}
                onChange={(e) => setPinData({ ...pinData, currentPin: e.target.value })}
                disabled={loading}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="New PIN"
                type="password"
                value={pinData.newPin}
                onChange={(e) => setPinData({ ...pinData, newPin: e.target.value })}
                helperText="Minimum 4 characters"
                disabled={loading}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Confirm New PIN"
                type="password"
                value={pinData.confirmPin}
                onChange={(e) => setPinData({ ...pinData, confirmPin: e.target.value })}
                disabled={loading}
                required
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPinDialog(false)} disabled={loading}>
            Cancel
          </Button>
          <Button 
            onClick={handleUpdatePin}
            variant="contained"
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : 'Update PIN'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Settings;