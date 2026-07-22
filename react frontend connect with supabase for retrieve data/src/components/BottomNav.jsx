import React from 'react';
import { Paper, BottomNavigation, BottomNavigationAction } from '@mui/material';
import { LayoutDashboard, TrendingUp, Package, Lightbulb, Settings } from 'lucide-react';

export const BottomNav = ({ activeTab, setActiveTab }) => {
  return (
    <Paper
      elevation={8}
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1100,
        margin: '0 auto',
        maxWidth: 500,
      }}
    >
      <BottomNavigation
        value={activeTab}
        onChange={(event, newValue) => setActiveTab(newValue)}
        showLabels
        sx={{
          height: 64,
          '& .MuiBottomNavigationAction-root': {
            minWidth: 'auto',
            padding: '6px 0',
            color: 'text.secondary',
            '&.Mui-selected': {
              color: 'primary.main',
            },
          },
          '& .MuiBottomNavigationAction-label': {
            fontSize: '0.72rem',
            fontWeight: 600,
            '&.Mui-selected': {
              fontSize: '0.75rem',
            },
          },
        }}
      >
        <BottomNavigationAction label="Overview" value="dashboard" icon={<LayoutDashboard size={20} />} />
        <BottomNavigationAction label="Trends" value="trends" icon={<TrendingUp size={20} />} />
        <BottomNavigationAction label="Products" value="products" icon={<Package size={20} />} />
        <BottomNavigationAction label="Behavior" value="behavior" icon={<Lightbulb size={20} />} />
        <BottomNavigationAction label="Config" value="settings" icon={<Settings size={20} />} />
      </BottomNavigation>
    </Paper>
  );
};
