import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Tooltip,
  Alert,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Inventory as InventoryIcon,
  Warning as WarningIcon,
  LocalShipping as SupplierIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { reportsAPI, stockAPI } from '../../services/api';
import { toast } from 'react-toastify';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

const StockReports = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [period, setPeriod] = useState('month');
  const [startDate, setStartDate] = useState(dayjs().subtract(1, 'month'));
  const [endDate, setEndDate] = useState(dayjs());
  const [transactionType, setTransactionType] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [stockTransactions, setStockTransactions] = useState([]);
  const [stockLevels, setStockLevels] = useState([]);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [supplierPurchases, setSupplierPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchStockReports = async () => {
    setLoading(true);
    try {
      const params = {};

      if (period === 'custom') {
        params.start_date = startDate.format('YYYY-MM-DD');
        params.end_date = endDate.format('YYYY-MM-DD');
      } else {
        params.period = period;
      }

      if (transactionType) params.type = transactionType;
      if (supplierId) params.supplier_id = supplierId;

      const [
        transactionsRes,
        levelsRes,
        lowStockRes,
        supplierPurchasesRes,
        suppliersRes
      ] = await Promise.all([
        reportsAPI.getStockTransactions(params),
        reportsAPI.getStockLevels(),
        reportsAPI.getLowStock({ threshold: 10 }),
        reportsAPI.getSupplierPurchases(params),
        stockAPI.suppliers.getAll(),
      ]);

      setStockTransactions(transactionsRes.data || []);
      setStockLevels(levelsRes.data || []);
      setLowStockItems(lowStockRes.data || []);
      setSupplierPurchases(supplierPurchasesRes.data || []);
      setSuppliers(suppliersRes || []);
    } catch (error) {
      console.error('Error fetching stock reports:', error);
      toast.error('Failed to load stock reports data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStockReports();
  }, [period, startDate, endDate, transactionType, supplierId]);

  const handlePeriodChange = (event) => {
    setPeriod(event.target.value);
  };

  const handleTransactionTypeChange = (event) => {
    setTransactionType(event.target.value);
  };

  const handleSupplierChange = (event) => {
    setSupplierId(event.target.value);
  };

  const handleDownloadReport = (type) => {
    let csvContent = '';
    let filename = '';

    switch (type) {
      case 'transactions':
        csvContent = 'Date,Product,Category,Type,Quantity,Price,Supplier,Staff\n' +
          stockTransactions.map(row =>
            `"${row.created_at}","${row.product_name}","${row.category_name}","${row.type}",${row.qty},${row.price},"${row.supplier_name || ''}","${row.staff_name}"`
          ).join('\n');
        filename = 'stock_transactions_report.csv';
        break;
      case 'levels':
        csvContent = 'Product,Category,Unit,Current Qty\n' +
          stockLevels.map(row =>
            `"${row.name}","${row.category_name}","${row.unit_name}",${row.current_qty || 0}`
          ).join('\n');
        filename = 'stock_levels_report.csv';
        break;
      case 'low-stock':
        csvContent = 'Product,Category,Unit,Current Qty\n' +
          lowStockItems.map(row =>
            `"${row.name}","${row.category_name}","${row.unit_name}",${row.current_qty || 0}`
          ).join('\n');
        filename = 'low_stock_report.csv';
        break;
      case 'supplier-purchases':
        csvContent = 'Supplier,Transactions,Total Quantity,Total Amount\n' +
          supplierPurchases.map(row =>
            `"${row.supplier_name}",${row.transaction_count},${row.total_quantity},${row.total_amount}`
          ).join('\n');
        filename = 'supplier_purchases_report.csv';
        break;
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount || 0);
  };

  const totalTransactions = stockTransactions.length;
  const lowStockCount = lowStockItems.length;

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box p={3}>
        <Typography variant="h4" fontWeight="bold" mb={3}>
          Stock Reports
        </Typography>

        {/* Filters */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={2}>
                <FormControl fullWidth>
                  <InputLabel>Period</InputLabel>
                  <Select value={period} onChange={handlePeriodChange}>
                    <MenuItem value="today">Today</MenuItem>
                    <MenuItem value="week">This Week</MenuItem>
                    <MenuItem value="month">This Month</MenuItem>
                    <MenuItem value="year">This Year</MenuItem>
                    <MenuItem value="custom">Custom Range</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              {period === 'custom' && (
                <>
                  <Grid item xs={12} sm={2}>
                    <DatePicker
                      label="Start Date"
                      value={startDate}
                      onChange={setStartDate}
                      renderInput={(params) => <TextField {...params} fullWidth />}
                    />
                  </Grid>
                  <Grid item xs={12} sm={2}>
                    <DatePicker
                      label="End Date"
                      value={endDate}
                      onChange={setEndDate}
                      renderInput={(params) => <TextField {...params} fullWidth />}
                    />
                  </Grid>
                </>
              )}
              <Grid item xs={12} sm={2}>
                <FormControl fullWidth>
                  <InputLabel>Type</InputLabel>
                  <Select value={transactionType} onChange={handleTransactionTypeChange}>
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="IN">Stock In</MenuItem>
                    <MenuItem value="OUT">Stock Out</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={2}>
                <FormControl fullWidth>
                  <InputLabel>Supplier</InputLabel>
                  <Select value={supplierId} onChange={handleSupplierChange}>
                    <MenuItem value="">All Suppliers</MenuItem>
                    {suppliers.map((supplier) => (
                      <MenuItem key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={2}>
                <Button
                  variant="contained"
                  onClick={fetchStockReports}
                  disabled={loading}
                  fullWidth
                >
                  {loading ? 'Loading...' : 'Refresh'}
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <Grid container spacing={3} mb={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" mb={1}>
                  <InventoryIcon color="primary" sx={{ mr: 1 }} />
                  <Typography variant="h6">Total Transactions</Typography>
                </Box>
                <Typography variant="h4" color="primary">
                  {totalTransactions}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" mb={1}>
                  <WarningIcon color="warning" sx={{ mr: 1 }} />
                  <Typography variant="h6">Low Stock Items</Typography>
                </Box>
                <Typography variant="h4" color="warning.main">
                  {lowStockCount}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Tabs for different report views */}
        <Card>
          <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
            <Tab label="Stock Transactions" />
            <Tab label="Current Stock Levels" />
            <Tab label="Low Stock Alert" />
            <Tab label="Supplier Analysis" />
          </Tabs>

          <CardContent>
            {activeTab === 0 && (
              <Box>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6">Stock Transactions</Typography>
                  <Tooltip title="Download CSV">
                    <IconButton onClick={() => handleDownloadReport('transactions')}>
                      <DownloadIcon />
                    </IconButton>
                  </Tooltip>
                </Box>
                <TableContainer component={Paper}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Date</TableCell>
                        <TableCell>Product</TableCell>
                        <TableCell>Category</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell align="right">Quantity</TableCell>
                        <TableCell align="right">Price</TableCell>
                        <TableCell>Supplier</TableCell>
                        <TableCell>Staff</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {stockTransactions.map((row, index) => (
                        <TableRow key={index}>
                          <TableCell>{new Date(row.created_at).toLocaleDateString('en-US', { timeZone: 'Asia/Colombo' })}</TableCell>
                          <TableCell>{row.product_name}</TableCell>
                          <TableCell>{row.category_name}</TableCell>
                          <TableCell>
                            <Chip
                              label={row.type}
                              color={row.type === 'IN' ? 'success' : 'error'}
                              size="small"
                            />
                          </TableCell>
                          <TableCell align="right">{row.qty}</TableCell>
                          <TableCell align="right">{formatCurrency(row.price)}</TableCell>
                          <TableCell>{row.supplier_name || '-'}</TableCell>
                          <TableCell>{row.staff_name}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}

            {activeTab === 1 && (
              <Box>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6">Current Stock Levels</Typography>
                  <Tooltip title="Download CSV">
                    <IconButton onClick={() => handleDownloadReport('levels')}>
                      <DownloadIcon />
                    </IconButton>
                  </Tooltip>
                </Box>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={stockLevels.slice(0, 20)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <RechartsTooltip />
                    <Bar dataKey="current_qty" fill="#8884d8" name="Current Stock" />
                  </BarChart>
                </ResponsiveContainer>
                <TableContainer component={Paper} sx={{ mt: 2 }}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Product</TableCell>
                        <TableCell>Category</TableCell>
                        <TableCell>Unit</TableCell>
                        <TableCell align="right">Current Stock</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {stockLevels.map((row, index) => (
                        <TableRow key={index}>
                          <TableCell>{row.name}</TableCell>
                          <TableCell>{row.category_name}</TableCell>
                          <TableCell>{row.unit_name}</TableCell>
                          <TableCell align="right">
                            <Chip
                              label={row.current_qty?.toFixed(2) || '0.00'}
                              color={row.current_qty <= 10 ? 'warning' : 'default'}
                              size="small"
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}

            {activeTab === 2 && (
              <Box>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6">Low Stock Alert</Typography>
                  <Tooltip title="Download CSV">
                    <IconButton onClick={() => handleDownloadReport('low-stock')}>
                      <DownloadIcon />
                    </IconButton>
                  </Tooltip>
                </Box>
                {lowStockItems.length === 0 ? (
                  <Alert severity="success">All items are sufficiently stocked!</Alert>
                ) : (
                  <>
                    <Alert severity="warning" sx={{ mb: 2 }}>
                      {lowStockItems.length} items are running low on stock.
                    </Alert>
                    <TableContainer component={Paper}>
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell>Product</TableCell>
                            <TableCell>Category</TableCell>
                            <TableCell>Unit</TableCell>
                            <TableCell align="right">Current Stock</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {lowStockItems.map((row, index) => (
                            <TableRow key={index}>
                              <TableCell>{row.name}</TableCell>
                              <TableCell>{row.category_name}</TableCell>
                              <TableCell>{row.unit_name}</TableCell>
                              <TableCell align="right">
                                <Chip
                                  label={row.current_qty?.toFixed(2) || '0.00'}
                                  color="error"
                                  size="small"
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </>
                )}
              </Box>
            )}

            {activeTab === 3 && (
              <Box>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6">Supplier Purchase Analysis</Typography>
                  <Tooltip title="Download CSV">
                    <IconButton onClick={() => handleDownloadReport('supplier-purchases')}>
                      <DownloadIcon />
                    </IconButton>
                  </Tooltip>
                </Box>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={8}>
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={supplierPurchases} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="supplier_name" angle={-45} textAnchor="end" height={100} />
                        <YAxis tickFormatter={formatCurrency} width={80} />
                        <RechartsTooltip formatter={(value) => formatCurrency(value)} />
                        <Bar dataKey="total_amount" fill="#82ca9d" name="Total Amount" />
                      </BarChart>
                    </ResponsiveContainer>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <ResponsiveContainer width="100%" height={400}>
                      <PieChart>
                        <Pie
                          data={supplierPurchases}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ supplier_name, percent }) => `${supplier_name} ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="total_amount"
                        >
                          {supplierPurchases.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip formatter={(value) => formatCurrency(value)} />
                      </PieChart>
                    </ResponsiveContainer>
                  </Grid>
                </Grid>
                <TableContainer component={Paper} sx={{ mt: 2 }}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Supplier</TableCell>
                        <TableCell align="right">Transactions</TableCell>
                        <TableCell align="right">Total Quantity</TableCell>
                        <TableCell align="right">Total Amount</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {supplierPurchases.map((row, index) => (
                        <TableRow key={index}>
                          <TableCell>{row.supplier_name}</TableCell>
                          <TableCell align="right">{row.transaction_count}</TableCell>
                          <TableCell align="right">{row.total_quantity}</TableCell>
                          <TableCell align="right">{formatCurrency(row.total_amount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}
          </CardContent>
        </Card>
      </Box>
    </LocalizationProvider>
  );
};

export default StockReports;
