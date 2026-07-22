import React, { useState } from 'react';
import { Box, Paper, Typography, Grid, Chip, Card, CardContent } from '@mui/material';
import { TrendingUp, Calendar, Info } from 'lucide-react';

export const RevenueTrendsView = ({ data }) => {
  const { revenueTrends, overview } = data;
  const [selectedBar, setSelectedBar] = useState(null);

  const formatLKR = (val) => {
    return new Intl.NumberFormat('en-LK', {
      style: 'currency',
      currency: 'LKR',
      maximumFractionDigits: 0
    }).format(val || 0);
  };

  const maxRevenue = Math.max(...revenueTrends.map(t => t.revenue), 1000);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Revenue & Profit Bar Chart Container */}
      <Paper sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="h6" sx={{ fontSize: '1.05rem' }}>
            Revenue & Net Profit Trends
          </Typography>
          <Chip label="Daily View" size="small" color="primary" variant="outlined" />
        </Box>
        
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontSize: '0.8rem' }}>
          Interactive bar visualization comparing sales revenue vs net profit margins.
        </Typography>

        {/* Custom Mobile Interactive Bar Chart */}
        <Box sx={{ height: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 1, pt: 2, pb: 1, borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
          {revenueTrends.map((item, idx) => {
            const revPercent = Math.max(10, (item.revenue / maxRevenue) * 100);
            const profitPercent = Math.max(6, (item.profit / maxRevenue) * 100);
            const isSelected = selectedBar?.date === item.date;

            return (
              <Box
                key={item.date || idx}
                onClick={() => setSelectedBar(item)}
                sx={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  height: '100%',
                  justifyContent: 'flex-end',
                  cursor: 'pointer',
                  p: 0.5,
                  borderRadius: 2,
                  bgcolor: isSelected ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
                  transition: 'background-color 0.2s',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 0.5, height: '100%', width: '100%', justifyContent: 'center' }}>
                  {/* Revenue Bar */}
                  <Box
                    sx={{
                      width: 12,
                      height: `${revPercent}%`,
                      bgcolor: 'primary.main',
                      borderRadius: '4px 4px 0 0',
                      boxShadow: '0 0 8px rgba(59, 130, 246, 0.4)',
                      transition: 'height 0.4s ease',
                    }}
                  />
                  {/* Profit Bar */}
                  <Box
                    sx={{
                      width: 12,
                      height: `${profitPercent}%`,
                      bgcolor: 'secondary.main',
                      borderRadius: '4px 4px 0 0',
                      boxShadow: '0 0 8px rgba(16, 185, 129, 0.4)',
                      transition: 'height 0.4s ease',
                    }}
                  />
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', mt: 1, whiteSpace: 'nowrap' }}>
                  {item.label}
                </Typography>
              </Box>
            );
          })}
        </Box>

        {/* Legend */}
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 3, mt: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 12, height: 12, bgcolor: 'primary.main', borderRadius: 0.5 }} />
            <Typography variant="caption" color="text.secondary">Sales Revenue</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 12, height: 12, bgcolor: 'secondary.main', borderRadius: 0.5 }} />
            <Typography variant="caption" color="text.secondary">Net Profit</Typography>
          </Box>
        </Box>

        {/* Selected Day Details Card */}
        {selectedBar ? (
          <Card sx={{ mt: 2, bgcolor: 'rgba(30, 41, 59, 0.9)', borderColor: 'primary.main' }}>
            <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  📅 {selectedBar.label} Summary
                </Typography>
                <Chip label="Close" size="small" onClick={() => setSelectedBar(null)} />
              </Box>

              <Grid container spacing={1}>
                <Grid item xs={4}>
                  <Typography variant="caption" color="text.secondary" display="block">Revenue</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: 'primary.light' }}>{formatLKR(selectedBar.revenue)}</Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="caption" color="text.secondary" display="block">Net Profit</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: 'secondary.light' }}>{formatLKR(selectedBar.profit)}</Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="caption" color="text.secondary" display="block">Orders Count</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{selectedBar.orders} orders</Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        ) : (
          <Typography variant="caption" color="text.secondary" align="center" display="block" sx={{ mt: 1.5 }}>
            💡 Tap any day bar above to see specific revenue & profit breakdown.
          </Typography>
        )}
      </Paper>

      {/* Aggregate Statistics */}
      <Grid container spacing={2}>
        <Grid item xs={6}>
          <Paper sx={{ p: 1.5 }}>
            <Typography variant="caption" color="text.secondary">Period Sales</Typography>
            <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.1rem', color: 'primary.light' }}>
              {formatLKR(overview.totalRevenue)}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={6}>
          <Paper sx={{ p: 1.5 }}>
            <Typography variant="caption" color="text.secondary">Avg Daily Revenue</Typography>
            <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.1rem', color: 'secondary.light' }}>
              {formatLKR(revenueTrends.length > 0 ? overview.totalRevenue / revenueTrends.length : 0)}
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};
