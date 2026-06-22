import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  InputAdornment,
  IconButton,
  Fade,
  CircularProgress,
  Container,
  Paper,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Restaurant,
  Person,
  Lock,
} from '@mui/icons-material';
import { loginUser, clearError } from '../../store/slices/authSlice';
import InitialCashDialog from './InitialCashDialog';

const LoginPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading, error, isAuthenticated, user, activeShift } = useSelector((state) => state.auth);

  const [formData, setFormData] = useState({
    username: '',
    pin: '',
  });
  const [showPin, setShowPin] = useState(false);
  const [fadeIn, setFadeIn] = useState(false);
  const [showInitialCashDialog, setShowInitialCashDialog] = useState(false);

  useEffect(() => {
    setFadeIn(true);
    if (isAuthenticated && user) {
      // Check if cashier needs to open a shift
      if (user.role === 'cashier' && !activeShift) {
        setShowInitialCashDialog(true);
      } else {
        navigate('/dashboard');
      }
    }
  }, [isAuthenticated, user, activeShift, navigate]);

  useEffect(() => {
    let timer;
    if (error) {
      timer = setTimeout(() => {
        dispatch(clearError());
      }, 5000);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [error, dispatch]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.username && formData.pin) {
      console.log('Attempting login with:', { username: formData.username, pin: '****' });
      const result = await dispatch(loginUser(formData));
      console.log('Login result:', result);
      // Clear form if login failed
      if (result.type === 'auth/loginUser/rejected') {
        console.log('Login failed, clearing form');
        setFormData({ username: '', pin: '' });
      }
    }
  };

  // Format error message for better readability
  const getErrorMessage = (error) => {
    if (!error) return '';
    
    // Remove technical jargon and make it user-friendly
    if (error.includes('401') || error.includes('Unauthorized')) {
      return 'Invalid username or PIN. Please check your credentials.';
    }
    if (error.includes('403') || error.includes('Forbidden') || error.includes('deactivated')) {
      return 'Your account has been deactivated. Please contact an administrator.';
    }
    if (error.includes('Network') || error.includes('fetch')) {
      return 'Cannot connect to server. Please check your connection.';
    }
    
    // Return the error as-is if it's already user-friendly
    return error;
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 2,
        overflow: 'auto',
      }}
    >
      <Container maxWidth="sm">
        <Fade in={fadeIn} timeout={800}>
          <Paper
            elevation={24}
            sx={{
              borderRadius: 4,
              overflow: 'hidden',
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(10px)',
              maxWidth: 500,
              margin: '0 auto',
            }}
          >
            {/* Header */}
            <Box
              sx={{
                background: 'linear-gradient(45deg, #FF6B6B, #4ECDC4)',
                color: 'white',
                padding: 3,
                textAlign: 'center',
              }}
            >
              <Restaurant sx={{ fontSize: 50, mb: 1 }} />
              <Typography variant="h4" fontWeight="bold" gutterBottom>
                Binthanna Restaurant
              </Typography>
              <Typography variant="body1" sx={{ opacity: 0.9 }}>
                Restaurant POS System
              </Typography>
            </Box>

            <CardContent sx={{ padding: 3 }}>
              {error && (
                <Fade in={true} timeout={300}>
                  <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
                    {getErrorMessage(error)}
                  </Alert>
                </Fade>
              )}

              <form onSubmit={handleSubmit}>
                <TextField
                  fullWidth
                  name="username"
                  label="Username"
                  value={formData.username}
                  onChange={handleChange}
                  margin="normal"
                  variant="outlined"
                  required
                  autoComplete="username"
                  helperText="Enter your username (not your full name)"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Person color="primary" />
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                    },
                  }}
                />

                <TextField
                  fullWidth
                  name="pin"
                  label="PIN"
                  type={showPin ? 'text' : 'password'}
                  value={formData.pin}
                  onChange={handleChange}
                  margin="normal"
                  variant="outlined"
                  required
                  autoComplete="current-password"
                  helperText="Enter your PIN to login"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Lock color="primary" />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowPin(!showPin)}
                          edge="end"
                        >
                          {showPin ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                    },
                  }}
                />

                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  size="large"
                  disabled={loading || !formData.username || !formData.pin}
                  sx={{
                    mt: 2,
                    mb: 2,
                    height: 48,
                    borderRadius: 2,
                    background: 'linear-gradient(45deg, #FF6B6B, #4ECDC4)',
                    fontSize: '1rem',
                    fontWeight: 'bold',
                    '&:hover': {
                      background: 'linear-gradient(45deg, #FF5252, #26C6DA)',
                    },
                    '&:disabled': {
                      background: '#ccc',
                    },
                  }}
                >
                  {loading ? (
                    <CircularProgress size={24} color="inherit" />
                  ) : (
                    'Sign In'
                  )}
                </Button>
              </form>

              {/* Footer */}
              <Box sx={{ mt: 3, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  © 2026 Binthanna Restaurant. All rights reserved.
                </Typography>
              </Box>
            </CardContent>
          </Paper>
        </Fade>
      </Container>

      {/* Initial Cash Dialog for Cashiers */}
      <InitialCashDialog
        open={showInitialCashDialog}
        onClose={() => {
          setShowInitialCashDialog(false);
          navigate('/dashboard');
        }}
      />
    </Box>
  );
};

export default LoginPage;