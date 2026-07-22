import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import { getSupabaseConfig, saveSupabaseConfig, testSupabaseConnection } from '../supabaseClient';
import { Save, CheckCircle, Database } from 'lucide-react';

export const SettingsView = ({ isConnected, onSaveSuccess }) => {
  const [url, setUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [status, setStatus] = useState(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    const { url: currentUrl, anonKey: currentKey } = getSupabaseConfig();
    setUrl(currentUrl);
    setAnonKey(currentKey);
  }, []);

  const handleTestAndSave = async (e) => {
    e.preventDefault();
    const trimmedUrl = url.trim();
    const trimmedKey = anonKey.trim();

    if (!trimmedUrl || !trimmedKey) {
      setStatus({ type: 'error', message: 'Please enter both the Supabase Project URL and Public Anon Key.' });
      return;
    }

    setTesting(true);
    setStatus(null);

    const testRes = await testSupabaseConnection(trimmedUrl, trimmedKey);
    setTesting(false);

    if (testRes.success) {
      saveSupabaseConfig(trimmedUrl, trimmedKey);
      setStatus({ type: 'success', message: 'Successfully connected to Supabase PostgreSQL database!' });
      if (onSaveSuccess) onSaveSuccess();
    } else {
      setStatus({ type: 'error', message: `Connection failed: ${testRes.message}. Please check your credentials.` });
    }
  };

  const handleClear = () => {
    saveSupabaseConfig('', '');
    setUrl('');
    setAnonKey('');
    setStatus({ type: 'info', message: 'Cleared saved Supabase configuration.' });
    if (onSaveSuccess) onSaveSuccess();
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" sx={{ fontSize: '1.05rem', mb: 0.5 }}>
          ⚙️ Supabase Cloud Configuration
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontSize: '0.8rem' }}>
          Enter your Supabase Project URL and Public Anon Key to query real-time store sales directly from your cloud PostgreSQL database.
        </Typography>

        {status && (
          <Alert severity={status.type} sx={{ mb: 2, fontSize: '0.82rem' }}>
            {status.message}
          </Alert>
        )}

        <Box component="form" onSubmit={handleTestAndSave} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            fullWidth
            size="small"
            label="Supabase Project URL"
            placeholder="https://xyzcompany.supabase.co"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />

          <TextField
            fullWidth
            size="small"
            label="Supabase Public Anon Key"
            type="password"
            placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
            value={anonKey}
            onChange={(e) => setAnonKey(e.target.value)}
          />

          <Button
            type="submit"
            variant="contained"
            color="primary"
            disabled={testing}
            startIcon={testing ? <CircularProgress size={18} color="inherit" /> : <Save size={18} />}
          >
            {testing ? 'Testing Connection...' : 'Test Connection & Save'}
          </Button>

          {(url || anonKey) && (
            <Button variant="outlined" color="inherit" onClick={handleClear} size="small">
              Clear Credentials
            </Button>
          )}
        </Box>
      </Paper>

      {/* Supabase Schema Reference */}
      <Paper sx={{ p: 2, bgcolor: 'rgba(30, 41, 59, 0.5)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Database size={18} color="#60a5fa" />
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            PostgreSQL Cloud Tables Queried
          </Typography>
        </Box>

        <List disablePadding sx={{ fontSize: '0.78rem' }}>
          <ListItem sx={{ py: 0.5 }}>
            <ListItemText
              primary="orders"
              secondary="Stores transaction totals, date, status, payment mode, table_number"
            />
          </ListItem>
          <ListItem sx={{ py: 0.5 }}>
            <ListItemText
              primary="item_variant_order & stock_batch"
              secondary="Line item quantity, unit prices, cost buy_price, and stock remaining"
            />
          </ListItem>
          <ListItem sx={{ py: 0.5 }}>
            <ListItemText
              primary="item, item_variant, category"
              secondary="Product names, variants, barcodes, and category hierarchy"
            />
          </ListItem>
          <ListItem sx={{ py: 0.5 }}>
            <ListItemText
              primary="returns & in_out"
              secondary="Refund deductions and cash expense outputs"
            />
          </ListItem>
        </List>
      </Paper>
    </Box>
  );
};
