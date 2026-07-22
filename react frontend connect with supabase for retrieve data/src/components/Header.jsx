import React from 'react';
import { AppBar, Toolbar, Typography, Chip, IconButton, Box, CircularProgress } from '@mui/material';
import { RefreshCw, Cloud, CloudOff } from 'lucide-react';

export const Header = ({ isConnected, onRefresh, isRefreshing, activeTabTitle }) => {
  return (
    <AppBar position="sticky" color="default" elevation={1} sx={{ backgroundColor: 'rgba(10, 15, 29, 0.95)', backdropFilter: 'blur(12px)' }}>
      <Toolbar sx={{ justifyContent: 'space-between', px: 2, py: 0.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 38,
              height: 38,
              borderRadius: 2.5,
              backgroundColor: 'rgba(59, 130, 246, 0.15)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.2rem',
            }}
          >
            📊
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontSize: '1.05rem', lineHeight: 1.2, fontWeight: 700 }}>
              Binthanna Analytics
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
              {activeTabTitle || 'Supabase POS Retrieval'}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip
            icon={isConnected ? <Cloud size={14} /> : <CloudOff size={14} />}
            label={isConnected ? 'Supabase Live' : 'Offline / Unconfigured'}
            color={isConnected ? 'success' : 'warning'}
            variant="outlined"
            size="small"
            sx={{ height: 26, fontSize: '0.7rem', fontWeight: 700 }}
          />

          <IconButton
            size="small"
            color="primary"
            onClick={onRefresh}
            disabled={isRefreshing}
            sx={{
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 2.5,
              p: 0.8,
            }}
          >
            {isRefreshing ? <CircularProgress size={18} color="inherit" /> : <RefreshCw size={18} />}
          </IconButton>
        </Box>
      </Toolbar>
    </AppBar>
  );
};
