import React, { useState } from 'react';
import {
  Box,
  Paper,
  TextField,
  Typography,
  Chip,
  Grid,
  Card,
  CardContent,
  InputAdornment,
  Divider,
} from '@mui/material';
import { Search, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

export const ProductsView = ({ data }) => {
  const { products } = data;
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState('all'); // all, in_stock, low_stock, out_stock

  const formatLKR = (val) => {
    return new Intl.NumberFormat('en-LK', {
      style: 'currency',
      currency: 'LKR',
      maximumFractionDigits: 0
    }).format(val || 0);
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.barcode.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.category.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (filterMode === 'in_stock') return p.remainingQty > 0;
    if (filterMode === 'low_stock') return p.isLowStock;
    if (filterMode === 'out_stock') return p.isOutOfStock;

    return true;
  });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Search Bar & Stock Filter Chips */}
      <Paper sx={{ p: 2, position: 'sticky', top: 60, zIndex: 90 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search by product name, category or barcode..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search size={18} />
              </InputAdornment>
            ),
          }}
          sx={{ mb: 1.5 }}
        />

        <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', pb: 0.5, scrollbarWidth: 'none' }}>
          <Chip
            label={`All Items (${products.length})`}
            color={filterMode === 'all' ? 'primary' : 'default'}
            onClick={() => setFilterMode('all')}
            size="small"
            clickable
          />
          <Chip
            label="In Stock"
            color={filterMode === 'in_stock' ? 'primary' : 'default'}
            onClick={() => setFilterMode('in_stock')}
            size="small"
            clickable
          />
          <Chip
            icon={<AlertTriangle size={12} />}
            label="Low Stock"
            color={filterMode === 'low_stock' ? 'warning' : 'default'}
            onClick={() => setFilterMode('low_stock')}
            size="small"
            clickable
          />
          <Chip
            icon={<XCircle size={12} />}
            label="Out of Stock"
            color={filterMode === 'out_stock' ? 'error' : 'default'}
            onClick={() => setFilterMode('out_stock')}
            size="small"
            clickable
          />
        </Box>
      </Paper>

      {/* Products List Cards */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {filteredProducts.length === 0 ? (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              No products found matching your search.
            </Typography>
          </Paper>
        ) : (
          filteredProducts.map((prod) => (
            <Card key={prod.id} variant="outlined">
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                      {prod.name}
                    </Typography>
                    <Typography variant="caption" color="primary.light" sx={{ fontWeight: 600 }}>
                      {prod.category}
                    </Typography>
                  </Box>

                  <Chip
                    icon={prod.isOutOfStock ? <XCircle size={12} /> : prod.isLowStock ? <AlertTriangle size={12} /> : <CheckCircle size={12} />}
                    label={prod.isOutOfStock ? 'Out of Stock' : prod.isLowStock ? `Low (${prod.remainingQty})` : `In Stock (${prod.remainingQty})`}
                    color={prod.isOutOfStock ? 'error' : prod.isLowStock ? 'warning' : 'success'}
                    size="small"
                    sx={{ height: 22, fontSize: '0.68rem', fontWeight: 700 }}
                  />
                </Box>

                <Grid container spacing={1} sx={{ bgcolor: 'rgba(255, 255, 255, 0.03)', p: 1, borderRadius: 2, my: 1 }}>
                  <Grid item xs={4}>
                    <Typography variant="caption" color="text.secondary" display="block">Selling Price</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary' }}>{formatLKR(prod.sellPrice)}</Typography>
                  </Grid>
                  <Grid item xs={4}>
                    <Typography variant="caption" color="text.secondary" display="block">Buy Cost</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary' }}>{formatLKR(prod.buyPrice)}</Typography>
                  </Grid>
                  <Grid item xs={4}>
                    <Typography variant="caption" color="text.secondary" display="block">Profit Margin</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: 'secondary.main' }}>{prod.profitMargin}%</Typography>
                  </Grid>
                </Grid>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    🏷️ Barcode: <strong>{prod.barcode}</strong>
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Sold: <strong>{prod.soldQty}</strong> units ({formatLKR(prod.revenue)})
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          ))
        )}
      </Box>
    </Box>
  );
};
