import React from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress,
} from '@mui/material';
import { DollarSign, TrendingUp, ShoppingBag, CreditCard, Wallet } from 'lucide-react';

export const DashboardView = ({ data }) => {
  const { overview, recentOrders } = data;

  const formatLKR = (val) => {
    return new Intl.NumberFormat('en-LK', {
      style: 'currency',
      currency: 'LKR',
      maximumFractionDigits: 0
    }).format(val || 0);
  };

  const cogsPercent = overview.totalRevenue > 0 ? (overview.cogs / overview.totalRevenue) * 100 : 50;
  const expensesPercent = overview.totalRevenue > 0 ? (overview.totalExpenses / overview.totalRevenue) * 100 : 10;
  const profitPercent = overview.totalRevenue > 0 ? Math.max(0, (overview.netProfit / overview.totalRevenue) * 100) : 40;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Top Overview KPI Cards */}
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <Card
            sx={{
              background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.25) 0%, rgba(18, 25, 44, 0.95) 100%)',
              borderColor: 'rgba(59, 130, 246, 0.4)',
            }}
          >
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Total Sales Revenue
                </Typography>
                <DollarSign size={20} color="#60a5fa" />
              </Box>
              <Typography variant="h4" sx={{ color: '#60a5fa', my: 1, fontWeight: 800 }}>
                {formatLKR(overview.totalRevenue)}
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="caption" color="text.secondary">
                  {overview.totalOrdersCount} Completed Orders
                </Typography>
                <Chip
                  label={`Avg Order: ${formatLKR(overview.avgOrderValue)}`}
                  size="small"
                  color="primary"
                  variant="outlined"
                  sx={{ fontSize: '0.7rem' }}
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={6}>
          <Card>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="caption" color="text.secondary">
                  Net Profit
                </Typography>
                <TrendingUp size={16} color="#34d399" />
              </Box>
              <Typography variant="h6" sx={{ color: 'secondary.main', my: 0.5, fontWeight: 700, fontSize: '1.15rem' }}>
                {formatLKR(overview.netProfit)}
              </Typography>
              <Chip
                label={`${overview.profitMarginPercent}% Margin`}
                size="small"
                color="success"
                sx={{ height: 22, fontSize: '0.65rem', fontWeight: 700 }}
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={6}>
          <Card>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="caption" color="text.secondary">
                  Items Sold
                </Typography>
                <ShoppingBag size={16} color="#06b6d4" />
              </Box>
              <Typography variant="h6" sx={{ color: 'text.primary', my: 0.5, fontWeight: 700, fontSize: '1.15rem' }}>
                {overview.totalItemsSold} Units
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                Total Items Checked Out
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Financial Progress & Breakdown */}
      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" sx={{ mb: 1, fontSize: '0.95rem' }}>
          Financial Cost & Profit Breakdown
        </Typography>

        <Box sx={{ width: '100%', height: 12, borderRadius: 6, overflow: 'hidden', display: 'flex', bgcolor: 'rgba(255, 255, 255, 0.08)', my: 1.5 }}>
          <Box sx={{ width: `${cogsPercent}%`, bgcolor: 'primary.main', height: '100%' }} title="COGS" />
          <Box sx={{ width: `${expensesPercent}%`, bgcolor: 'error.main', height: '100%' }} title="Expenses" />
          <Box sx={{ width: `${profitPercent}%`, bgcolor: 'secondary.main', height: '100%' }} title="Net Profit" />
        </Box>

        <Grid container spacing={1} sx={{ mt: 0.5 }}>
          <Grid item xs={4}>
            <Typography variant="caption" color="text.secondary" display="block">Cost of Goods</Typography>
            <Typography variant="body2" sx={{ fontWeight: 700, color: 'primary.light' }}>{formatLKR(overview.cogs)}</Typography>
          </Grid>
          <Grid item xs={4}>
            <Typography variant="caption" color="text.secondary" display="block">Expenses & Refunds</Typography>
            <Typography variant="body2" sx={{ fontWeight: 700, color: 'error.light' }}>{formatLKR(overview.totalExpenses + overview.totalRefunds)}</Typography>
          </Grid>
          <Grid item xs={4}>
            <Typography variant="caption" color="text.secondary" display="block">Net Profit</Typography>
            <Typography variant="body2" sx={{ fontWeight: 700, color: 'secondary.light' }}>{formatLKR(overview.netProfit)}</Typography>
          </Grid>
        </Grid>
      </Paper>

      {/* Recent Local Orders Table */}
      <Paper sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
          <Typography variant="subtitle1" sx={{ fontSize: '0.95rem' }}>
            Recent Local Orders Stream
          </Typography>
          <Chip label={`${recentOrders.length} Recent`} size="small" variant="outlined" />
        </Box>

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontSize: '0.72rem', py: 1 }}>Customer / Location</TableCell>
                <TableCell align="right" sx={{ fontSize: '0.72rem', py: 1 }}>Payment</TableCell>
                <TableCell align="right" sx={{ fontSize: '0.72rem', py: 1 }}>Amount</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {recentOrders.map((order) => (
                <TableRow key={order.id} hover>
                  <TableCell sx={{ py: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.82rem' }}>
                      {order.customer_name || 'Walk-in Customer'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                      {order.table_number || 'Takeaway'} • {new Date(order.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Typography>
                  </TableCell>

                  <TableCell align="right" sx={{ py: 1 }}>
                    <Chip
                      icon={order.is_card_payment ? <CreditCard size={12} /> : <Wallet size={12} />}
                      label={order.is_card_payment ? 'Card' : 'Cash'}
                      size="small"
                      color={order.is_card_payment ? 'primary' : 'success'}
                      variant="outlined"
                      sx={{ height: 20, fontSize: '0.65rem' }}
                    />
                  </TableCell>

                  <TableCell align="right" sx={{ py: 1, fontWeight: 700, fontSize: '0.85rem' }}>
                    {formatLKR(order.total_amount)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
};
