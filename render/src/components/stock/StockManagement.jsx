import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Button,
  TextField,
  InputAdornment,
  TablePagination,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  CircularProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Inventory2 as InventoryIcon,
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import {
  fetchUnits,
  fetchStockCategories,
  fetchSuppliers,
  fetchProducts,
  fetchTransactions,
  setSearchTerm,
  setDateRange,
  setTransactionType,
  filterTransactions,
} from '../../store/slices/stockSlice';

// Import dialogs and components
import UnitDialog from './dialogs/UnitDialog';
import CategoryDialog from './dialogs/CategoryDialog';
import SupplierDialog from './dialogs/SupplierDialog';
import ProductDialog from './dialogs/ProductDialog';
import TransactionDialog from './dialogs/TransactionDialog';
import TransactionTable from './components/TransactionTable';
import ProductTable from './components/ProductTable';

const StockManagement = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const {
    units,
    stockCategories,
    suppliers,
    products,
    filteredTransactions,
    loading,
    searchTerm,
    dateRange,
    transactionType,
  } = useSelector((state) => state.stock);

  const [currentTab, setCurrentTab] = useState(0);
  
  // Dialog states
  const [unitDialog, setUnitDialog] = useState({ open: false, data: null });
  const [categoryDialog, setCategoryDialog] = useState({ open: false, data: null });
  const [supplierDialog, setSupplierDialog] = useState({ open: false, data: null });
  const [productDialog, setProductDialog] = useState({ open: false, data: null });
  const [transactionDialog, setTransactionDialog] = useState({ open: false, type: null, data: null });

  // Pagination for transactions
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  useEffect(() => {
    dispatch(fetchUnits());
    dispatch(fetchStockCategories());
    dispatch(fetchSuppliers());
    dispatch(fetchProducts());
    dispatch(fetchTransactions());
  }, [dispatch]);

  useEffect(() => {
    dispatch(filterTransactions());
  }, [searchTerm, dateRange, transactionType, dispatch]);

  const handleTabChange = (event, newValue) => {
    setCurrentTab(newValue);
  };

  const handleSearchChange = (e) => {
    dispatch(setSearchTerm(e.target.value));
  };

  const handleDateChange = (field, value) => {
    dispatch(setDateRange({ ...dateRange, [field]: value }));
  };

  const handleTypeChange = (e) => {
    dispatch(setTransactionType(e.target.value));
  };

  const handleAddUnit = () => {
    setUnitDialog({ open: true, data: null });
  };

  const handleAddCategory = () => {
    setCategoryDialog({ open: true, data: null });
  };

  const handleAddSupplier = () => {
    setSupplierDialog({ open: true, data: null });
  };

  const handleAddProduct = () => {
    setProductDialog({ open: true, data: null });
  };

  const handleEditProduct = (product) => {
    setProductDialog({ open: true, data: product });
  };

  const handleTransactionIn = () => {
    setTransactionDialog({ open: true, type: 'IN', data: null });
  };

  const handleTransactionOut = () => {
    setTransactionDialog({ open: true, type: 'OUT', data: null });
  };

  const handleEditTransaction = (transaction) => {
    setTransactionDialog({ open: true, type: transaction.type, data: transaction });
  };

  const handleRefresh = () => {
    dispatch(fetchUnits());
    dispatch(fetchStockCategories());
    dispatch(fetchSuppliers());
    dispatch(fetchProducts());
    dispatch(fetchTransactions());
    toast.success('Data refreshed successfully');
  };

  const handleRefreshUnits = () => {
    dispatch(fetchUnits());
  };

  const handleRefreshCategories = () => {
    dispatch(fetchStockCategories());
  };

  const handleRefreshSuppliers = () => {
    dispatch(fetchSuppliers());
  };

  const handleRefreshProducts = () => {
    dispatch(fetchProducts());
    dispatch(fetchTransactions());
  };

  const handleRefreshTransactions = () => {
    dispatch(fetchTransactions());
    dispatch(fetchProducts());
  };

  // Pagination handlers
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const paginatedTransactions = Array.isArray(filteredTransactions) 
    ? filteredTransactions.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
    : [];

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box display="flex" alignItems="center" gap={2}>
          <InventoryIcon sx={{ fontSize: 40, color: 'primary.main' }} />
          <Typography variant="h4" fontWeight="bold">
            Stock Management
          </Typography>
        </Box>
        <Button variant="outlined" onClick={handleRefresh}>
          Refresh
        </Button>
      </Box>

      {/* Action Buttons */}
      <Box display="flex" gap={2} mb={3} flexWrap="wrap">
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAddCategory}
          sx={{ 
            bgcolor: '#1976d2',
            '&:hover': { bgcolor: '#1565c0' },
            color: 'white',
            fontWeight: 600
          }}
        >
          Add Category
        </Button>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAddSupplier}
          sx={{ 
            bgcolor: '#1976d2',
            '&:hover': { bgcolor: '#1565c0' },
            color: 'white',
            fontWeight: 600
          }}
        >
          Add Supplier
        </Button>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAddUnit}
          sx={{ 
            bgcolor: '#1976d2',
            '&:hover': { bgcolor: '#1565c0' },
            color: 'white',
            fontWeight: 600
          }}
        >
          Add Unit
        </Button>
        <Box sx={{ width: '20px' }} />
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAddProduct}
          sx={{ 
            bgcolor: '#9c27b0',
            '&:hover': { bgcolor: '#7b1fa2' },
            color: 'white',
            fontWeight: 600
          }}
        >
          Add Product
        </Button>
        <Box sx={{ width: '20px' }} />
        <Button
          variant="contained"
          onClick={handleTransactionIn}
          sx={{ 
            bgcolor: '#2e7d32',
            '&:hover': { bgcolor: '#1b5e20' },
            color: 'white',
            fontWeight: 600,
            minWidth: '80px'
          }}
        >
          IN
        </Button>
        <Button
          variant="contained"
          onClick={handleTransactionOut}
          sx={{ 
            bgcolor: '#d32f2f',
            '&:hover': { bgcolor: '#c62828' },
            color: 'white',
            fontWeight: 600,
            minWidth: '80px'
          }}
        >
          OUT
        </Button>
      </Box>

      {/* Tabs */}
      <Tabs value={currentTab} onChange={handleTabChange} sx={{ mb: 3 }}>
        <Tab label="Stock Transaction" />
        <Tab label="Product Table" />
      </Tabs>

      {/* Stock Transaction Tab */}
      {currentTab === 0 && (
        <Box>
          <Typography variant="h6" fontWeight="bold" mb={2}>
            Stock Transaction
          </Typography>

          {/* Filters */}
          <Box display="flex" gap={2} mb={3} flexWrap="wrap" alignItems="center">
            <TextField
              placeholder="Search by product or supplier name..."
              value={searchTerm}
              onChange={handleSearchChange}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
              sx={{ flexGrow: 1, minWidth: 250 }}
            />
            <TextField
              type="date"
              label="From"
              value={dateRange.from || ''}
              onChange={(e) => handleDateChange('from', e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ 
                minWidth: 150,
                '& .MuiInputBase-root': {
                  color: 'text.primary',
                },
                '& .MuiSvgIcon-root': {
                  color: 'action.active',
                }
              }}
            />
            <TextField
              type="date"
              label="To"
              value={dateRange.to || ''}
              onChange={(e) => handleDateChange('to', e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ 
                minWidth: 150,
                '& .MuiInputBase-root': {
                  color: 'text.primary',
                },
                '& .MuiSvgIcon-root': {
                  color: 'action.active',
                }
              }}
            />
            <FormControl>
              <RadioGroup
                row
                value={transactionType}
                onChange={handleTypeChange}
              >
                <FormControlLabel value="ALL" control={<Radio />} label="All" />
                <FormControlLabel value="IN" control={<Radio />} label="IN" />
                <FormControlLabel value="OUT" control={<Radio />} label="OUT" />
              </RadioGroup>
            </FormControl>
          </Box>

          {/* Loading State */}
          {loading ? (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight={300}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              {/* Transaction Table */}
              <TransactionTable
                transactions={paginatedTransactions}
                onRefresh={handleRefreshTransactions}
                onEdit={handleEditTransaction}
              />

              {/* Pagination */}
              <TablePagination
                component="div"
                count={Array.isArray(filteredTransactions) ? filteredTransactions.length : 0}
                page={page}
                onPageChange={handleChangePage}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={handleChangeRowsPerPage}
                rowsPerPageOptions={[10, 25, 50]}
              />
            </>
          )}
        </Box>
      )}

      {/* Product Table Tab */}
      {currentTab === 1 && (
        <Box>
          <Typography variant="h6" fontWeight="bold" mb={2}>
            Product Table
          </Typography>

          {/* Product Table */}
          <ProductTable
            products={products}
            onEdit={handleEditProduct}
            onRefresh={handleRefreshProducts}
          />
        </Box>
      )}

      {/* Dialogs */}
      <UnitDialog
        open={unitDialog.open}
        data={unitDialog.data}
        onClose={() => setUnitDialog({ open: false, data: null })}
        onRefresh={handleRefreshUnits}
        units={units}
      />

      <CategoryDialog
        open={categoryDialog.open}
        data={categoryDialog.data}
        onClose={() => setCategoryDialog({ open: false, data: null })}
        onRefresh={handleRefreshCategories}
        categories={stockCategories}
      />

      <SupplierDialog
        open={supplierDialog.open}
        data={supplierDialog.data}
        onClose={() => setSupplierDialog({ open: false, data: null })}
        onRefresh={handleRefreshSuppliers}
        suppliers={suppliers}
      />

      <ProductDialog
        open={productDialog.open}
        data={productDialog.data}
        onClose={() => setProductDialog({ open: false, data: null })}
        onRefresh={handleRefreshProducts}
        categories={stockCategories}
        units={units}
      />

      <TransactionDialog
        open={transactionDialog.open}
        type={transactionDialog.type}
        data={transactionDialog.data}
        onClose={() => setTransactionDialog({ open: false, type: null, data: null })}
        onRefresh={handleRefreshTransactions}
        products={products}
        suppliers={suppliers}
        userId={user?.id}
      />
    </Box>
  );
};

export default StockManagement;
