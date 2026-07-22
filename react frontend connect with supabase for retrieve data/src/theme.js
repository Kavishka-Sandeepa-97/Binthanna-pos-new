import { createTheme } from '@mui/material/styles';

export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: '#0a0f1d',
      paper: 'rgba(18, 25, 44, 0.95)',
    },
    primary: {
      main: '#3b82f6', // Bright blue
      light: '#60a5fa',
      dark: '#1d4ed8',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#10b981', // Emerald green
      light: '#34d399',
      dark: '#047857',
    },
    error: {
      main: '#f43f5e',
    },
    warning: {
      main: '#f59e0b',
    },
    info: {
      main: '#06b6d4',
    },
    text: {
      primary: '#f8fafc',
      secondary: '#94a3b8',
    },
  },
  typography: {
    fontFamily: '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    h5: {
      fontFamily: '"Outfit", sans-serif',
      fontWeight: 700,
    },
    h6: {
      fontFamily: '"Outfit", sans-serif',
      fontWeight: 700,
    },
    subtitle1: {
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 14,
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 16,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 700,
          borderRadius: 12,
          padding: '10px 18px',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 600,
          borderRadius: 10,
        },
      },
    },
    MuiBottomNavigation: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(10, 15, 29, 0.95)',
          backdropFilter: 'blur(16px)',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        },
      },
    },
  },
});
