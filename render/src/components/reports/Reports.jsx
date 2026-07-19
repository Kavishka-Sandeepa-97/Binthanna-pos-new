import React, { useState, useEffect, useMemo } from 'react';
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
} from '@mui/material';
import {
  Download as DownloadIcon,
  TrendingUp as TrendingUpIcon,
  ShoppingCart as ShoppingCartIcon,
  Category as CategoryIcon,
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
import { reportsAPI } from '../../services/api';
import { toast } from 'react-toastify';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

const Reports = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [period, setPeriod] = useState('all');
  const [startDate, setStartDate] = useState(dayjs().subtract(1, 'month'));
  const [endDate, setEndDate] = useState(dayjs());
  const [revenueData, setRevenueData] = useState([]);
  const [topProductsData, setTopProductsData] = useState([]);
  const [categorySalesData, setCategorySalesData] = useState([]);
  const [productDetailsData, setProductDetailsData] = useState([]);
  const [inventoryValuation, setInventoryValuation] = useState({ data: [], summary: {} });
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [dailyOrdersData, setDailyOrdersData] = useState(null);
  const [dailyOrdersLoading, setDailyOrdersLoading] = useState(false);

  const fetchReportsData = async () => {
    setLoading(true);
    try {
      const params = {};

      if (period === 'custom') {
        params.start_date = startDate.format('YYYY-MM-DD');
        params.end_date = endDate.format('YYYY-MM-DD');
      } else if (period !== 'all') {
        params.period = period;
      }
      // For 'all' period, we don't add any date parameters

      const [revenueRes, topProductsRes, categorySalesRes, productDetailsRes, inventoryValuationRes] = await Promise.all([
        reportsAPI.getRevenue(params),
        reportsAPI.getTopProducts({ ...params, limit: 10 }),
        reportsAPI.getCategorySales(params),
        reportsAPI.getTopProducts({ ...params, limit: 100 }), // Get all products for details view
        reportsAPI.getInventoryValuation(params), // Now includes date filtering
      ]);

      setRevenueData(revenueRes.data || []);
      setTopProductsData(topProductsRes.data || []);
      setCategorySalesData(categorySalesRes.data || []);
      setProductDetailsData(productDetailsRes.data || []);
      setInventoryValuation(inventoryValuationRes || { data: [], summary: {} });
    } catch (error) {
      console.error('Error fetching reports:', error);
      toast.error('Failed to load reports data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportsData();
  }, [period, startDate, endDate]);

  // Filter product details data based on search term
  const filteredProductDetails = useMemo(() => productDetailsData.filter(product => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    const itemName = (product.item_name || '').toLowerCase();
    const variantName = (product.variant_name || '').toLowerCase();
    const barcode = (product.barcode || '').toLowerCase();
    return (
      itemName.includes(searchLower) ||
      variantName.includes(searchLower) ||
      barcode.includes(searchLower)
    );
  }), [productDetailsData, searchTerm]);

  const handlePeriodChange = (event) => {
    setPeriod(event.target.value);
  };

  const handleRevenueRowClick = async (rowData) => {
    setSelectedDate(rowData.period);
    setDetailDialogOpen(true);
    setDailyOrdersData(null);
    setDailyOrdersLoading(true);
    
    try {
      const result = await reportsAPI.getDailyOrders(rowData.period);
      setDailyOrdersData(result);
    } catch (error) {
      console.error('Error fetching daily orders:', error);
      toast.error('Failed to load daily order details');
    } finally {
      setDailyOrdersLoading(false);
    }
  };

  const handleDownloadReport = (type) => {
    // Simple CSV export for now
    let csvContent = '';
    let filename = '';

    switch (type) {
      case 'revenue':
        csvContent = 'Period,Orders,Revenue,COGS,Profit,Margin %,Min Order,Max Order\n' +
          revenueData.map(row =>
            `${row.period},${row.order_count},${row.total_revenue},${row.total_cogs},${row.total_profit},${row.margin_percent},${row.min_order},${row.max_order}`
          ).join('\n');
        filename = 'revenue_report.csv';
        break;
      case 'top-products':
        csvContent = 'Product,Variant,Barcode,Quantity,Revenue,Orders\n' +
          topProductsData.map(row =>
            `"${row.item_name}","${row.variant_name}","${row.barcode}",${row.total_quantity},${row.total_revenue},${row.order_count}`
          ).join('\n');
        filename = 'top_products_report.csv';
        break;
      case 'category-sales':
        csvContent = 'Category,Orders,Quantity,Revenue\n' +
          categorySalesData.map(row =>
            `"${row.category_name}",${row.order_count},${row.total_quantity},${row.total_revenue}`
          ).join('\n');
        filename = 'category_sales_report.csv';
        break;
      case 'daily-orders-breakdown':
        if (!dailyOrdersData || !dailyOrdersData.orders) return;
        csvContent = 'Order #,Type,Payment,Staff,Amount,COGS,Profit,Items,Time\n' +
          dailyOrdersData.orders.map(order => {
            const orderTime = order.date ? new Date(order.date).toLocaleTimeString() : '-';
            const itemCount = order.items ? order.items.length : 0;
            const staffName = (order.staff_name || '').replace(/"/g, '""');
            return `"${order.order_number}","${order.order_type}","${order.payment_type}","${staffName}",${order.total_amount},${order.total_cogs},${order.total_profit},${itemCount},"${orderTime}"`;
          }).join('\n');
        filename = `orders_breakdown_${selectedDate || 'report'}.csv`;
        break;
      case 'daily-items-sold':
        if (!dailyOrdersData || !dailyOrdersData.orders) return;
        csvContent = 'Order #,Product,Variant,Qty,Unit Price,Line Total,Category\n' +
          dailyOrdersData.orders.flatMap(order =>
            (order.items || []).map(item => {
              const itemName = (item.item_name || '').replace(/"/g, '""');
              const variantName = (item.variant_name || '').replace(/"/g, '""');
              const categoryName = (item.category_name || '').replace(/"/g, '""');
              return `"${order.order_number}","${itemName}","${variantName}",${item.qty},${item.unit_price},${item.line_total},"${categoryName}"`;
            })
          ).join('\n');
        filename = `items_sold_${selectedDate || 'report'}.csv`;
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

  const totalRevenue = revenueData.reduce((sum, item) => sum + parseFloat(item.total_revenue || 0), 0);
  const totalOrders = revenueData.reduce((sum, item) => sum + parseInt(item.order_count || 0), 0);
  const totalProfit = revenueData.reduce((sum, item) => sum + parseFloat(item.total_profit || 0), 0);

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box p={3}>
        <Typography variant="h4" fontWeight="bold" mb={3}>
          POS Reports
        </Typography>

        {/* Filters */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={3}>
                <FormControl fullWidth>
                  <InputLabel>Period</InputLabel>
                  <Select value={period} onChange={handlePeriodChange}>
                    <MenuItem value="all">All Time</MenuItem>
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
                  <Grid item xs={12} sm={3}>
                    <DatePicker
                      label="Start Date"
                      value={startDate}
                      onChange={setStartDate}
                      renderInput={(params) => <TextField {...params} fullWidth />}
                    />
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <DatePicker
                      label="End Date"
                      value={endDate}
                      onChange={setEndDate}
                      renderInput={(params) => <TextField {...params} fullWidth />}
                    />
                  </Grid>
                </>
              )}
              <Grid item xs={12} sm={3}>
                <Button
                  variant="contained"
                  onClick={fetchReportsData}
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
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" mb={1}>
                  <TrendingUpIcon color="primary" sx={{ mr: 1 }} />
                  <Typography variant="h6">Total Revenue</Typography>
                </Box>
                <Typography variant="h4" color="primary">
                  {formatCurrency(totalRevenue)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" mb={1}>
                  <ShoppingCartIcon color="secondary" sx={{ mr: 1 }} />
                  <Typography variant="h6">Total Orders</Typography>
                </Box>
                <Typography variant="h4" color="secondary">
                  {totalOrders}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" mb={1}>
                  <CategoryIcon color={totalProfit >= 0 ? 'success' : 'error'} sx={{ mr: 1 }} />
                  <Typography variant="h6">Overall Profit</Typography>
                </Box>
                <Typography variant="h4" color={totalProfit >= 0 ? 'success.main' : 'error.main'}>
                  {formatCurrency(totalProfit)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Tabs for different report views */}
        <Card>
          <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
            <Tab label="Revenue Trend" />
            <Tab label="Top Products" />
            <Tab label="Category Sales" />
            <Tab label="Product Details" />
            <Tab label="Stock Valuation" />
          </Tabs>

          <CardContent>
            {activeTab === 0 && (
              <Box>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6">Revenue Over Time</Typography>
                  <Tooltip title="Download CSV">
                    <IconButton onClick={() => handleDownloadReport('revenue')}>
                      <DownloadIcon />
                    </IconButton>
                  </Tooltip>
                </Box>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={revenueData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" />
                    <YAxis tickFormatter={formatCurrency} width={80} />
                    <RechartsTooltip
                      formatter={(value, name) => {
                        if (name === 'Orders') {
                          return [Number(value || 0), name];
                        }
                        return [formatCurrency(value), name];
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="total_revenue"
                      stroke="#8884d8"
                      name="Revenue"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="order_count"
                      stroke="#82ca9d"
                      name="Orders"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="total_profit"
                      stroke="#ff7043"
                      name="Profit"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
                <Box display="flex" justifyContent="space-between" alignItems="center" mt={4} mb={1.5}>
                  <Typography variant="h6">Revenue Trend Details</Typography>
                  <Tooltip title="Download Excel/CSV">
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<DownloadIcon />}
                      onClick={() => handleDownloadReport('revenue')}
                    >
                      Download Table
                    </Button>
                  </Tooltip>
                </Box>
                <TableContainer component={Paper}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Period</TableCell>
                        <TableCell align="right">Orders</TableCell>
                        <TableCell align="right">Revenue</TableCell>
                        <TableCell align="right">COGS</TableCell>
                        <TableCell align="right">Profit</TableCell>
                        <TableCell align="right">Margin %</TableCell>
                        <TableCell align="right">Min Order</TableCell>
                        <TableCell align="right">Max Order</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {revenueData.map((row) => (
                        <TableRow 
                          key={row.period}
                          onClick={() => handleRevenueRowClick(row)}
                          sx={{
                            cursor: 'pointer',
                            '&:hover': {
                              backgroundColor: '#f5f5f5',
                            },
                          }}
                        >
                          <TableCell>{row.period}</TableCell>
                          <TableCell align="right">{row.order_count}</TableCell>
                          <TableCell align="right">{formatCurrency(row.total_revenue)}</TableCell>
                          <TableCell align="right">{formatCurrency(row.total_cogs)}</TableCell>
                          <TableCell align="right">
                            <Typography fontWeight="bold" color={Number(row.total_profit || 0) >= 0 ? 'success.main' : 'error.main'}>
                              {formatCurrency(row.total_profit)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">{Number(row.margin_percent || 0).toFixed(2)}%</TableCell>
                          <TableCell align="right">{formatCurrency(row.min_order)}</TableCell>
                          <TableCell align="right">{formatCurrency(row.max_order)}</TableCell>
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
                  <Typography variant="h6">Top Selling Products</Typography>
                  <Tooltip title="Download CSV">
                    <IconButton onClick={() => handleDownloadReport('top-products')}>
                      <DownloadIcon />
                    </IconButton>
                  </Tooltip>
                </Box>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={topProductsData.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="item_name" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <RechartsTooltip formatter={(value) => [value, 'Quantity']} />
                    <Bar dataKey="total_quantity" fill="#8884d8" name="Quantity Sold" />
                  </BarChart>
                </ResponsiveContainer>
                <TableContainer component={Paper} sx={{ mt: 2 }}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Product</TableCell>
                        <TableCell>Variant</TableCell>
                        <TableCell>Barcode</TableCell>
                        <TableCell align="right">Quantity</TableCell>
                        <TableCell align="right">Revenue</TableCell>
                        <TableCell align="right">Orders</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {topProductsData.map((row, index) => (
                        <TableRow key={index}>
                          <TableCell>{row.item_name}</TableCell>
                          <TableCell>{row.variant_name}</TableCell>
                          <TableCell>
                            <Chip label={row.barcode} size="small" />
                          </TableCell>
                          <TableCell align="right">{row.total_quantity}</TableCell>
                          <TableCell align="right">{formatCurrency(row.total_revenue)}</TableCell>
                          <TableCell align="right">{row.order_count}</TableCell>
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
                  <Typography variant="h6">Sales by Category</Typography>
                  <Tooltip title="Download CSV">
                    <IconButton onClick={() => handleDownloadReport('category-sales')}>
                      <DownloadIcon />
                    </IconButton>
                  </Tooltip>
                </Box>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={8}>
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={categorySalesData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="category_name" angle={-45} textAnchor="end" height={100} />
                        <YAxis tickFormatter={formatCurrency} />
                        <RechartsTooltip formatter={(value) => formatCurrency(value)} />
                        <Bar dataKey="total_revenue" fill="#82ca9d" name="Revenue" />
                      </BarChart>
                    </ResponsiveContainer>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <ResponsiveContainer width="100%" height={400}>
                      <PieChart>
                        <Pie
                          data={categorySalesData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ category_name, percent }) => `${category_name} ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="total_revenue"
                        >
                          {categorySalesData.map((entry, index) => (
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
                        <TableCell>Category</TableCell>
                        <TableCell align="right">Orders</TableCell>
                        <TableCell align="right">Quantity</TableCell>
                        <TableCell align="right">Revenue</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {categorySalesData.map((row, index) => (
                        <TableRow key={index}>
                          <TableCell>{row.category_name}</TableCell>
                          <TableCell align="right">{row.order_count}</TableCell>
                          <TableCell align="right">{row.total_quantity}</TableCell>
                          <TableCell align="right">{formatCurrency(row.total_revenue)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}

            {activeTab === 3 && (
              <Box>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6">Item Variant Sales Details</Typography>
                  <Box display="flex" gap={1}>
                    <TextField
                      size="small"
                      placeholder="Search product, variant, or barcode..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      sx={{ width: 300 }}
                      InputProps={{
                        startAdornment: (
                          <Box component="span" sx={{ mr: 1, display: 'flex', alignItems: 'center' }}>
                            🔍
                          </Box>
                        ),
                      }}
                    />
                    <Tooltip title="Download CSV">
                      <IconButton onClick={() => handleDownloadReport('product-details')}>
                        <DownloadIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>
                
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={filteredProductDetails.slice(0, 20)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="item_name" 
                      angle={-45} 
                      textAnchor="end" 
                      height={120}
                      tickFormatter={(value, index) => {
                        const item = filteredProductDetails[index];
                        return item ? `${item.item_name} ${item.variant_name}` : value;
                      }}
                    />
                    <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                    <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
                    <RechartsTooltip 
                      formatter={(value, name) => {
                        if (name === 'Quantity') return [value, 'Qty'];
                        if (name === 'Revenue') return [formatCurrency(value), 'Total'];
                        return [value, name];
                      }}
                      labelFormatter={(label, payload) => {
                        if (payload && payload.length > 0) {
                          const data = payload[0].payload;
                          return `${data.item_name} - ${data.variant_name}`;
                        }
                        return label;
                      }}
                    />
                    <Legend />
                    <Bar yAxisId="left" dataKey="total_quantity" fill="#8884d8" name="Quantity" />
                    <Bar yAxisId="right" dataKey="total_revenue" fill="#82ca9d" name="Revenue" />
                  </BarChart>
                </ResponsiveContainer>

                {searchTerm && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 1 }}>
                    Showing {filteredProductDetails.length} of {productDetailsData.length} products
                  </Typography>
                )}

                <TableContainer component={Paper} sx={{ mt: 2, maxHeight: 600 }}>
                  <Table stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell><strong>Product Name</strong></TableCell>
                        <TableCell><strong>Variant</strong></TableCell>
                        <TableCell><strong>Barcode</strong></TableCell>
                        <TableCell align="right"><strong>Qty Sold</strong></TableCell>
                        <TableCell align="right"><strong>Total Revenue</strong></TableCell>
                        <TableCell align="right"><strong>Orders</strong></TableCell>
                        <TableCell align="right"><strong>Avg/Order</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredProductDetails.map((row, index) => (
                        <TableRow key={index} hover>
                          <TableCell>{row.item_name}</TableCell>
                          <TableCell>
                            <Chip label={row.variant_name} size="small" color="primary" variant="outlined" />
                          </TableCell>
                          <TableCell>
                            <Chip label={row.barcode} size="small" />
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" fontWeight="bold">
                              {row.total_quantity}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" color="success.main" fontWeight="bold">
                              {formatCurrency(row.total_revenue)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">{row.order_count}</TableCell>
                          <TableCell align="right">
                            {formatCurrency(row.total_revenue / row.order_count)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}

            {activeTab === 4 && (
              <Box>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Box>
                    <Typography variant="h6">Inventory Valuation Report</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {period === 'all' ? 'All stock purchases' : 
                       period === 'custom' ? `Stock purchased from ${startDate.format('MMM DD')} to ${endDate.format('MMM DD, YYYY')}` :
                       `Stock purchased in the last ${period}`}
                    </Typography>
                  </Box>
                </Box>

                {/* Summary Cards */}
                <Grid container spacing={2} mb={3}>
                  <Grid item xs={12} sm={6} md={3}>
                    <Card sx={{ bgcolor: 'primary.light' }}>
                      <CardContent>
                        <Typography variant="h6" color="primary.main">
                          {inventoryValuation.summary?.total_items || 0}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Total Items
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Card sx={{ bgcolor: 'info.light' }}>
                      <CardContent>
                        <Typography variant="h6" color="info.main">
                          {inventoryValuation.summary?.total_stock_units || 0}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Units in Stock
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Card sx={{ bgcolor: 'warning.light' }}>
                      <CardContent>
                        <Typography variant="h6" color="warning.main">
                          {formatCurrency(inventoryValuation.summary?.total_investment || 0)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Total Investment
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Card sx={{ bgcolor: 'success.light' }}>
                      <CardContent>
                        <Typography variant="h6" color="success.main">
                          {formatCurrency(inventoryValuation.summary?.total_potential_revenue || 0)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Potential Revenue
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>

                {/* Profit Summary */}
                <Grid container spacing={2} mb={3}>
                  <Grid item xs={12} sm={6}>
                    <Card sx={{ bgcolor: inventoryValuation.summary?.total_potential_profit > 0 ? 'success.light' : 'error.light' }}>
                      <CardContent>
                        <Typography variant="h6" color={inventoryValuation.summary?.total_potential_profit > 0 ? 'success.main' : 'error.main'}>
                          {formatCurrency(inventoryValuation.summary?.total_potential_profit || 0)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Potential Profit
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Card sx={{ bgcolor: 'secondary.light' }}>
                      <CardContent>
                        <Typography variant="h6" color="secondary.main">
                          {inventoryValuation.summary?.overall_profit_margin || 0}%
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Overall Margin
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Daily Orders Detail Dialog */}
        <Dialog 
          open={detailDialogOpen} 
          onClose={() => setDetailDialogOpen(false)}
          maxWidth="lg"
          fullWidth
        >
          <DialogTitle>
            Daily Order Details - {selectedDate}
            {dailyOrdersData && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Total Orders: {dailyOrdersData.summary?.total_orders || 0} | Revenue: {formatCurrency(dailyOrdersData.summary?.total_revenue || 0)} | Profit: {formatCurrency(dailyOrdersData.summary?.total_profit || 0)}
              </Typography>
            )}
          </DialogTitle>
          <DialogContent dividers sx={{ maxHeight: '70vh', overflowY: 'auto' }}>
            {dailyOrdersLoading ? (
              <Box display="flex" justifyContent="center" alignItems="center" py={4}>
                <CircularProgress />
              </Box>
            ) : dailyOrdersData ? (
              <Box>
                {/* Summary Statistics */}
                {dailyOrdersData.summary && (
                  <Grid container spacing={2} sx={{ mb: 3 }}>
                    <Grid item xs={12} sm={6} md={3}>
                      <Card>
                        <CardContent sx={{ p: 2 }}>
                          <Typography variant="body2" color="text.secondary">Orders</Typography>
                          <Typography variant="h6">{dailyOrdersData.summary.total_orders}</Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Card>
                        <CardContent sx={{ p: 2 }}>
                          <Typography variant="body2" color="text.secondary">Revenue</Typography>
                          <Typography variant="h6" color="primary">{formatCurrency(dailyOrdersData.summary.total_revenue)}</Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Card>
                        <CardContent sx={{ p: 2 }}>
                          <Typography variant="body2" color="text.secondary">COGS</Typography>
                          <Typography variant="h6" color="warning.main">{formatCurrency(dailyOrdersData.summary.total_cogs)}</Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Card>
                        <CardContent sx={{ p: 2 }}>
                          <Typography variant="body2" color="text.secondary">Profit</Typography>
                          <Typography variant="h6" color={Number(dailyOrdersData.summary.total_profit || 0) >= 0 ? 'success.main' : 'error.main'}>
                            {formatCurrency(dailyOrdersData.summary.total_profit)}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Card>
                        <CardContent sx={{ p: 2 }}>
                          <Typography variant="body2" color="text.secondary">Margin %</Typography>
                          <Typography variant="h6">{Number(dailyOrdersData.summary.margin_percent || 0).toFixed(2)}%</Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Card>
                        <CardContent sx={{ p: 2 }}>
                          <Typography variant="body2" color="text.secondary">Cash</Typography>
                          <Typography variant="h6" color="success.main">{formatCurrency(dailyOrdersData.summary.cash_revenue)}</Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Card>
                        <CardContent sx={{ p: 2 }}>
                          <Typography variant="body2" color="text.secondary">Card</Typography>
                          <Typography variant="h6" color="info.main">{formatCurrency(dailyOrdersData.summary.card_revenue)}</Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Card>
                        <CardContent sx={{ p: 2 }}>
                          <Typography variant="body2" color="text.secondary">Avg Order</Typography>
                          <Typography variant="h6">{formatCurrency(dailyOrdersData.summary.avg_order)}</Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  </Grid>
                )}

                {/* Orders Table */}
                <Box display="flex" justifyContent="space-between" alignItems="center" mt={3} mb={1.5}>
                  <Typography variant="h6">Orders Breakdown</Typography>
                  <Tooltip title="Download Excel/CSV">
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<DownloadIcon />}
                      onClick={() => handleDownloadReport('daily-orders-breakdown')}
                    >
                      Download Orders
                    </Button>
                  </Tooltip>
                </Box>
                <TableContainer component={Paper}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                        <TableCell><strong>Order #</strong></TableCell>
                        <TableCell><strong>Type</strong></TableCell>
                        <TableCell><strong>Payment</strong></TableCell>
                        <TableCell><strong>Staff</strong></TableCell>
                        <TableCell align="right"><strong>Amount</strong></TableCell>
                        <TableCell align="right"><strong>COGS</strong></TableCell>
                        <TableCell align="right"><strong>Profit</strong></TableCell>
                        <TableCell align="right"><strong>Items</strong></TableCell>
                        <TableCell><strong>Time</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {dailyOrdersData.orders && dailyOrdersData.orders.map((order) => {
                        const orderTime = order.date ? new Date(order.date).toLocaleTimeString() : '-';
                        const itemCount = order.items ? order.items.length : 0;
                        return (
                          <TableRow key={order.id} hover>
                            <TableCell>
                              <Chip 
                                label={order.order_number} 
                                size="small" 
                                variant="outlined"
                              />
                            </TableCell>
                            <TableCell>
                              <Chip 
                                label={order.order_type} 
                                size="small"
                                color={order.is_return ? 'error' : 'success'}
                                variant="filled"
                              />
                            </TableCell>
                            <TableCell>
                              <Chip 
                                label={order.payment_type} 
                                size="small"
                                color={order.is_card_payment ? 'info' : 'success'}
                                variant="outlined"
                              />
                            </TableCell>
                            <TableCell>{order.staff_name || '-'}</TableCell>
                            <TableCell align="right">
                              <Typography fontWeight="bold" color="primary">
                                {formatCurrency(order.total_amount)}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">{formatCurrency(order.total_cogs)}</TableCell>
                            <TableCell align="right">
                              <Typography fontWeight="bold" color={Number(order.total_profit || 0) >= 0 ? 'success.main' : 'error.main'}>
                                {formatCurrency(order.total_profit)}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">{itemCount}</TableCell>
                            <TableCell>{orderTime}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>

                {/* Detailed Items View */}
                {dailyOrdersData.orders && dailyOrdersData.orders.length > 0 && (
                  <Box sx={{ mt: 4 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
                      <Typography variant="h6">Items Sold</Typography>
                      <Tooltip title="Download Excel/CSV">
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<DownloadIcon />}
                          onClick={() => handleDownloadReport('daily-items-sold')}
                        >
                          Download Items
                        </Button>
                      </Tooltip>
                    </Box>
                    <TableContainer component={Paper}>
                      <Table size="small">
                        <TableHead>
                          <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                            <TableCell><strong>Order #</strong></TableCell>
                            <TableCell><strong>Product</strong></TableCell>
                            <TableCell><strong>Variant</strong></TableCell>
                            <TableCell align="right"><strong>Qty</strong></TableCell>
                            <TableCell align="right"><strong>Unit Price</strong></TableCell>
                            <TableCell align="right"><strong>Line Total</strong></TableCell>
                            <TableCell><strong>Category</strong></TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {dailyOrdersData.orders.flatMap(order =>
                            (order.items || []).map((item, idx) => (
                              <TableRow key={`${order.id}-${idx}`}>
                                <TableCell>
                                  <Chip 
                                    label={order.order_number}
                                    size="small"
                                    variant="outlined"
                                  />
                                </TableCell>
                                <TableCell>{item.item_name}</TableCell>
                                <TableCell>
                                  <Chip 
                                    label={item.variant_name} 
                                    size="small" 
                                    variant="outlined"
                                  />
                                </TableCell>
                                <TableCell align="right">{item.qty}</TableCell>
                                <TableCell align="right">{formatCurrency(item.unit_price)}</TableCell>
                                <TableCell align="right">
                                  <Typography fontWeight="bold">{formatCurrency(item.line_total)}</Typography>
                                </TableCell>
                                <TableCell>{item.category_name}</TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>
                )}
              </Box>
            ) : (
              <Typography color="text.secondary">No orders found for this date.</Typography>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDetailDialogOpen(false)} variant="contained">
              Close
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default Reports;