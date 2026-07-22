import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  List,
  ListItem,
  ListItemText,
  Chip,
  LinearProgress,
  Card,
  CardContent,
} from '@mui/material';
import { Flame, Star, CreditCard, Wallet } from 'lucide-react';

export const BehaviorView = ({ data }) => {
  const { behavior } = data;

  const formatLKR = (val) => {
    return new Intl.NumberFormat('en-LK', {
      style: 'currency',
      currency: 'LKR',
      maximumFractionDigits: 0
    }).format(val || 0);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Top Volume Sellers Leaderboard */}
      <Paper sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Flame color="#f59e0b" size={20} />
          <Typography variant="h6" sx={{ fontSize: '1.05rem' }}>
            Top Selling Products
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, fontSize: '0.8rem' }}>
          Ranked by highest quantity of units sold across POS transactions.
        </Typography>

        <List disablePadding>
          {behavior.topByVolume.map((item, index) => (
            <ListItem
              key={item.id}
              sx={{
                bgcolor: 'rgba(255, 255, 255, 0.03)',
                borderRadius: 2,
                mb: 1,
                p: 1.5,
              }}
            >
              <Chip
                label={`#${index + 1}`}
                color={index === 0 ? 'warning' : index === 1 ? 'default' : 'default'}
                size="small"
                sx={{ mr: 1.5, fontWeight: 800 }}
              />
              <ListItemText
                primary={<Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{item.name}</Typography>}
                secondary={<Typography variant="caption" color="text.secondary">{item.category} • {item.soldQty} units sold</Typography>}
              />
              <Typography variant="body2" sx={{ fontWeight: 700, color: 'primary.light' }}>
                {formatLKR(item.revenue)}
              </Typography>
            </ListItem>
          ))}
        </List>
      </Paper>

      {/* Top Profit Contribution */}
      <Paper sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Star color="#10b981" size={20} />
          <Typography variant="h6" sx={{ fontSize: '1.05rem' }}>
            Highest Profit Margin Drivers
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, fontSize: '0.8rem' }}>
          Items contributing the largest total net profit volume.
        </Typography>

        <List disablePadding>
          {behavior.topByProfit.map((item, index) => (
            <ListItem
              key={item.id}
              sx={{
                bgcolor: 'rgba(255, 255, 255, 0.03)',
                borderRadius: 2,
                mb: 1,
                p: 1.5,
              }}
            >
              <Chip label="⭐" size="small" variant="outlined" sx={{ mr: 1.5 }} />
              <ListItemText
                primary={<Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{item.name}</Typography>}
                secondary={<Typography variant="caption" color="text.secondary">Profit Margin: {item.profitMargin}%</Typography>}
              />
              <Typography variant="body2" sx={{ fontWeight: 700, color: 'secondary.main' }}>
                {formatLKR(item.totalProfit)}
              </Typography>
            </ListItem>
          ))}
        </List>
      </Paper>

      {/* Cash vs Card Split */}
      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" sx={{ fontSize: '1.05rem', mb: 1 }}>
          💳 Payment Method Breakdown
        </Typography>

        <Box sx={{ width: '100%', height: 10, borderRadius: 5, overflow: 'hidden', display: 'flex', bgcolor: 'rgba(255, 255, 255, 0.08)', my: 1.5 }}>
          <Box sx={{ width: `${behavior.paymentCashPercent}%`, bgcolor: 'secondary.main', height: '100%' }} />
          <Box sx={{ width: `${behavior.paymentCardPercent}%`, bgcolor: 'primary.main', height: '100%' }} />
        </Box>

        <Grid container spacing={2}>
          <Grid item xs={6}>
            <Card variant="outlined">
              <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Wallet size={16} color="#34d399" />
                  <Typography variant="caption" color="text.secondary">Cash Payments</Typography>
                </Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'secondary.light' }}>
                  {formatLKR(behavior.cashTotal)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {behavior.paymentCashPercent}% of Total
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={6}>
            <Card variant="outlined">
              <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <CreditCard size={16} color="#60a5fa" />
                  <Typography variant="caption" color="text.secondary">Card Payments</Typography>
                </Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'primary.light' }}>
                  {formatLKR(behavior.cardTotal)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {behavior.paymentCardPercent}% of Total
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
};
