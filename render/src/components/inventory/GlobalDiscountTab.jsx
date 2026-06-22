import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Alert,
  CircularProgress,
} from '@mui/material';
import { Save as SaveIcon } from '@mui/icons-material';

const GlobalDiscountTab = ({
  globalDiscountSettings,
  setGlobalDiscountSettings,
  loadingGlobalDiscount,
  savingGlobalDiscount,
  onSave,
}) => (
  <Box>
    <Card sx={{ maxWidth: 700, mx: 'auto', mt: 2 }}>
      <CardContent>
        <Typography variant="h5" fontWeight="bold" gutterBottom>
          Global Discount Settings
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Configure a global discount that applies to all orders meeting the minimum order amount.
        </Typography>

        {loadingGlobalDiscount ? (
          <Box display="flex" justifyContent="center" p={4}>
            <CircularProgress />
          </Box>
        ) : (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Global Discount Active</InputLabel>
                <Select
                  value={globalDiscountSettings.is_global_discount_active ? 'yes' : 'no'}
                  label="Global Discount Active"
                  onChange={(e) =>
                    setGlobalDiscountSettings({
                      ...globalDiscountSettings,
                      is_global_discount_active: e.target.value === 'yes',
                    })
                  }
                >
                  <MenuItem value="no">No - Disabled</MenuItem>
                  <MenuItem value="yes">Yes - Enabled</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth disabled={!globalDiscountSettings.is_global_discount_active}>
                <InputLabel>Discount Type</InputLabel>
                <Select
                  value={globalDiscountSettings.global_discount_type || 'percentage'}
                  label="Discount Type"
                  onChange={(e) =>
                    setGlobalDiscountSettings({ ...globalDiscountSettings, global_discount_type: e.target.value })
                  }
                >
                  <MenuItem value="fixed">Fixed Amount (Rs.)</MenuItem>
                  <MenuItem value="percentage">Percentage (%)</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label={
                  globalDiscountSettings.global_discount_type === 'percentage'
                    ? 'Discount Value (%)'
                    : 'Discount Value (Rs.)'
                }
                type="number"
                value={globalDiscountSettings.global_discount_value}
                onChange={(e) =>
                  setGlobalDiscountSettings({ ...globalDiscountSettings, global_discount_value: e.target.value })
                }
                disabled={!globalDiscountSettings.is_global_discount_active}
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Minimum Order Amount (Rs.)"
                type="number"
                value={globalDiscountSettings.min_order_amount}
                onChange={(e) =>
                  setGlobalDiscountSettings({ ...globalDiscountSettings, min_order_amount: e.target.value })
                }
                disabled={!globalDiscountSettings.is_global_discount_active}
                inputProps={{ min: 0, step: 0.01 }}
                helperText="Global discount will only apply to orders above this amount. Set to 0 for no minimum."
              />
            </Grid>

            {globalDiscountSettings.is_global_discount_active && (
              <Grid item xs={12}>
                <Alert severity="info">
                  {globalDiscountSettings.global_discount_type === 'percentage'
                    ? `A ${globalDiscountSettings.global_discount_value}% discount will be applied to all orders`
                    : `A Rs. ${parseFloat(globalDiscountSettings.global_discount_value || 0).toFixed(2)} discount will be applied to all orders`}
                  {parseFloat(globalDiscountSettings.min_order_amount) > 0
                    ? ` above Rs. ${parseFloat(globalDiscountSettings.min_order_amount).toFixed(2)}.`
                    : '.'}
                </Alert>
              </Grid>
            )}

            <Grid item xs={12}>
              <Box display="flex" justifyContent="flex-end">
                <Button
                  variant="contained"
                  onClick={onSave}
                  disabled={savingGlobalDiscount}
                  startIcon={savingGlobalDiscount ? <CircularProgress size={20} /> : <SaveIcon />}
                  sx={{ px: 4 }}
                >
                  {savingGlobalDiscount ? 'Saving...' : 'Save Settings'}
                </Button>
              </Box>
            </Grid>
          </Grid>
        )}
      </CardContent>
    </Card>
  </Box>
);

export default GlobalDiscountTab;
