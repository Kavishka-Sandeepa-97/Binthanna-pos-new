import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Avatar,
  Chip,
  LinearProgress,
  IconButton,
  Button,
  Alert,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  AttachMoney,
  Receipt,
  Inventory,
  People,
  Cake,
  Fastfood,
  SmokeFree,
  Category,
  Refresh,
  Analytics,
} from '@mui/icons-material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';

const Dashboard = () => {
  const { user } = useSelector((state) => state.auth);
  const [dashboardData, setDashboardData] = useState({
    todaySales: 0,
    totalOrders: 0,
    activeOrders: 0,
    lowStockItems: 0,
    salesTrend: [],
    categoryBreakdown: [],
    recentOrders: [],
    topItems: [],
  });
  const [loading, setLoading] = useState(true);

  const categoryIcons = {
    'Desserts': <Cake />,
    'Snacks': <Fastfood />,
    'Tobacco': <SmokeFree />,
    'Other': <Category />,
  };

  const COLORS = ['#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'];

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Simulate API calls - replace with actual API calls
      const mockData = {
        todaySales: 15420.50,
        totalOrders: 47,
        activeOrders: 8,
        lowStockItems: 12,
        salesTrend: [
          { time: '09:00', sales: 1200 },
          { time: '10:00', sales: 1800 },
          { time: '11:00', sales: 2400 },
          { time: '12:00', sales: 3200 },
          { time: '13:00', sales: 4100 },
          { time: '14:00', sales: 3800 },
          { time: '15:00', sales: 2900 },
          { time: '16:00', sales: 2200 },
          { time: '17:00', sales: 2800 },
          { time: '18:00', sales: 3600 },
          { time: '19:00', sales: 4200 },
          { time: '20:00', sales: 3900 },
        ],
        categoryBreakdown: [
          { name: 'Electronics', value: 40, amount: 6939 },
          { name: 'Clothing', value: 30, amount: 3855 },
          { name: 'Accessories', value: 20, amount: 2313 },
          { name: 'Other', value: 10, amount: 1542 },
        ],
        recentOrders: [
          { id: 1, table: 'T-05', amount: 2450, status: 'completed', time: '2 min ago' },
          { id: 2, table: 'T-12', amount: 1890, status: 'active', time: '5 min ago' },
          { id: 3, table: 'T-08', amount: 3200, status: 'completed', time: '8 min ago' },
          { id: 4, table: 'T-03', amount: 1650, status: 'active', time: '12 min ago' },
          { id: 5, table: 'T-15', amount: 2100, status: 'completed', time: '15 min ago' },
        ],
        topItems: [
          { name: 'Product A', category: 'Electronics', sold: 23, revenue: 3450 },
          { name: 'Product B', category: 'Clothing', sold: 31, revenue: 1240 },
          { name: 'Product C', category: 'Accessories', sold: 18, revenue: 1800 },
          { name: 'Product D', category: 'Other', sold: 12, revenue: 960 },
        ],
      };

      setDashboardData(mockData);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return `Rs. ${parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'warning';
      case 'completed': return 'success';
      case 'cancelled': return 'error';
      default: return 'default';
    }
  };

  if (loading) {
    return (
      <Box>
        <Typography variant="h4" fontWeight="bold" gutterBottom>
          Dashboard
        </Typography>
        <LinearProgress sx={{ mb: 3 }} />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            Dashboard
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Welcome back, {user?.name}! Here's what's happening at your restaurant today.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={fetchDashboardData}
          sx={{ borderRadius: 2 }}
        >
          Refresh
        </Button>
      </Box>

      {/* Key Metrics */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h4" fontWeight="bold">
                    {formatCurrency(dashboardData.todaySales)}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.8 }}>
                    Today's Sales
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)' }}>
                  <AttachMoney />
                </Avatar>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                <TrendingUp sx={{ fontSize: 16, mr: 0.5 }} />
                <Typography variant="caption">+12.5% from yesterday</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ background: 'linear-gradient(135deg, #4ECDC4 0%, #44A08D 100%)', color: 'white' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h4" fontWeight="bold">
                    {dashboardData.totalOrders}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.8 }}>
                    Total Orders
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)' }}>
                  <Receipt />
                </Avatar>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                <TrendingUp sx={{ fontSize: 16, mr: 0.5 }} />
                <Typography variant="caption">+8.2% from yesterday</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ background: 'linear-gradient(135deg, #FF6B6B 0%, #EE5A52 100%)', color: 'white' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h4" fontWeight="bold">
                    {dashboardData.activeOrders}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.8 }}>
                    Active Orders
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)' }}>
                  <Restaurant />
                </Avatar>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                <Typography variant="caption">Currently being prepared</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ background: 'linear-gradient(135deg, #FFA726 0%, #FF7043 100%)', color: 'white' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h4" fontWeight="bold">
                    {dashboardData.lowStockItems}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.8 }}>
                    Low Stock Items
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)' }}>
                  <Inventory />
                </Avatar>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                <Typography variant="caption">Requires attention</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Charts Row */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* Sales Trend */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                Sales Trend (Today)
              </Typography>
              <Box sx={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dashboardData.salesTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip formatter={(value) => [formatCurrency(value), 'Sales']} />
                    <Line 
                      type="monotone" 
                      dataKey="sales" 
                      stroke="#4ECDC4" 
                      strokeWidth={3}
                      dot={{ fill: '#4ECDC4', strokeWidth: 2, r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Category Breakdown */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                Sales by Category
              </Typography>
              <Box sx={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dashboardData.categoryBreakdown}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}%`}
                    >
                      {dashboardData.categoryBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${value}%`, 'Percentage']} />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Bottom Row */}
      <Grid container spacing={3}>
        {/* Recent Orders */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                Recent Orders
              </Typography>
              <Box sx={{ maxHeight: 300, overflowY: 'auto' }}>
                {dashboardData.recentOrders.map((order) => (
                  <Box
                    key={order.id}
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      p: 2,
                      border: '1px solid #e0e0e0',
                      borderRadius: 2,
                      mb: 1,
                    }}
                  >
                    <Box>
                      <Typography variant="subtitle2" fontWeight="bold">
                        {order.table}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {order.time}
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography variant="subtitle2" fontWeight="bold">
                        {formatCurrency(order.amount)}
                      </Typography>
                      <Chip
                        label={order.status}
                        color={getStatusColor(order.status)}
                        size="small"
                      />
                    </Box>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Top Selling Items */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                Top Selling Items
              </Typography>
              <Box sx={{ maxHeight: 300, overflowY: 'auto' }}>
                {dashboardData.topItems.map((item, index) => (
                  <Box
                    key={index}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      p: 2,
                      border: '1px solid #e0e0e0',
                      borderRadius: 2,
                      mb: 1,
                    }}
                  >
                    <Avatar sx={{ bgcolor: COLORS[index % COLORS.length], mr: 2 }}>
                      {categoryIcons[item.category] || <Category />}
                    </Avatar>
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="subtitle2" fontWeight="bold">
                        {item.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {item.category} • {item.sold} sold
                      </Typography>
                    </Box>
                    <Typography variant="subtitle2" fontWeight="bold" color="primary">
                      {formatCurrency(item.revenue)}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;