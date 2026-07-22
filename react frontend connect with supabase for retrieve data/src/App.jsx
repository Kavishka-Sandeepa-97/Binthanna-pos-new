import React, { useState, useEffect, useCallback } from 'react';
import { ThemeProvider, CssBaseline, Box, Container, CircularProgress, Typography, Button, Alert } from '@mui/material';
import { darkTheme } from './theme';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { DashboardView } from './components/DashboardView';
import { RevenueTrendsView } from './components/RevenueTrendsView';
import { ProductsView } from './components/ProductsView';
import { BehaviorView } from './components/BehaviorView';
import { SettingsView } from './components/SettingsView';
import { fetchLiveDashboardData } from './services/supabaseService';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async (showRefreshingSpinner = false) => {
    if (showRefreshingSpinner) setRefreshing(true);
    try {
      const result = await fetchLiveDashboardData();
      setData(result);
    } catch (err) {
      console.error("Data loading error:", err);
      setData({ isConnected: false, error: err.message });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getTabTitle = () => {
    switch (activeTab) {
      case 'dashboard': return 'Sales Overview';
      case 'trends': return 'Revenue & Profit Trends';
      case 'products': return 'Products & Pricing';
      case 'behavior': return 'Sales Behavior Insights';
      case 'settings': return 'Supabase Configuration';
      default: return 'Binthanna Analytics';
    }
  };

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Box className="mobile-app-shell">
        <Header
          isConnected={data?.isConnected ?? false}
          onRefresh={() => loadData(true)}
          isRefreshing={refreshing}
          activeTabTitle={getTabTitle()}
        />

        <Box component="main" className="app-main-content">
          {loading ? (
            <Box className="loading-state">
              <CircularProgress size={40} sx={{ mb: 2 }} />
              <Typography variant="body2" color="text.secondary">
                Querying live Supabase PostgreSQL tables...
              </Typography>
            </Box>
          ) : data && !data.isConnected && activeTab !== 'settings' ? (
            <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Alert severity="warning">
                {data.error || 'Supabase URL and Anon Key are not configured yet.'}
              </Alert>
              <Button
                variant="contained"
                color="primary"
                onClick={() => setActiveTab('settings')}
              >
                Configure Supabase Connection Now
              </Button>
            </Box>
          ) : data ? (
            <>
              {activeTab === 'dashboard' && <DashboardView data={data} />}
              {activeTab === 'trends' && <RevenueTrendsView data={data} />}
              {activeTab === 'products' && <ProductsView data={data} />}
              {activeTab === 'behavior' && <BehaviorView data={data} />}
              {activeTab === 'settings' && (
                <SettingsView
                  isConnected={data.isConnected}
                  onSaveSuccess={() => loadData(true)}
                />
              )}
            </>
          ) : (
            <Box className="error-state">
              <Typography variant="body1" color="error" sx={{ mb: 2 }}>
                Failed to initialize application data.
              </Typography>
              <Button variant="contained" onClick={() => loadData(true)}>
                Retry Loading
              </Button>
            </Box>
          )}
        </Box>

        <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
      </Box>
    </ThemeProvider>
  );
}

export default App;
