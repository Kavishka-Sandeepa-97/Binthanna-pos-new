import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Divider,
  Slider,
} from '@mui/material';
import { Print, CheckCircle, Error, TextFields } from '@mui/icons-material';
import htmlPrintService from '../../services/htmlPrintService';
import { toast } from 'react-toastify';

const PrinterSettings = () => {
  const quickReceiptPrinters = ['XP-80C (copy 2)', 'XP-80C (copy 4)'];
  const [printers, setPrinters] = useState([]);
  const [selectedPrinter, setSelectedPrinter] = useState(() => {
    // Load saved printer from localStorage
    const saved = localStorage.getItem('selectedPrinter');
    return saved || '';
  });
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [printerStatus, setPrinterStatus] = useState(null);
  const [receiptFont, setReceiptFont] = useState(() => localStorage.getItem('receiptFontFamily') || 'Arial');
  const [receiptFontWeight, setReceiptFontWeight] = useState(() => localStorage.getItem('receiptFontWeight') || 'bold');
  const [receiptFontSize, setReceiptFontSize] = useState(() => parseInt(localStorage.getItem('receiptFontSize') || '13'));

  const fontOptions = [
    { value: 'Arial', label: 'Arial' },
    { value: 'Helvetica', label: 'Helvetica' },
    { value: 'Tahoma', label: 'Tahoma' },
    { value: 'Verdana', label: 'Verdana' },
    { value: 'Trebuchet MS', label: 'Trebuchet MS' },
    { value: 'Segoe UI', label: 'Segoe UI' },
    { value: 'Consolas', label: 'Consolas (Monospace)' },
    { value: 'Courier New', label: 'Courier New (Monospace)' },
    { value: 'Lucida Console', label: 'Lucida Console (Monospace)' },
  ];

  // Get IPC Renderer
  const getIpcRenderer = () => {
    try {
      if (typeof window !== 'undefined' && window.require) {
        const { ipcRenderer } = window.require('electron');
        return ipcRenderer;
      }
      return null;
    } catch (error) {
      console.error('Failed to get ipcRenderer:', error);
      return null;
    }
  };

  useEffect(() => {
    loadPrinters();
    // printer status checks removed because raw/ESC-POS printing service was replaced
  }, []);

  const loadPrinters = async () => {
    const ipcRenderer = getIpcRenderer();
    
    if (!ipcRenderer) {
      toast.warning('Printer features are only available in desktop app');
      return;
    }

    setLoading(true);
    try {
      const availablePrinters = await ipcRenderer.invoke('get-printers');
      setPrinters(availablePrinters);
      
      // Check if we have a saved printer that still exists
      const savedPrinter = localStorage.getItem('selectedPrinter');
      const savedExists = savedPrinter && availablePrinters.find(p => p.name === savedPrinter);
      
      if (savedExists) {
        setSelectedPrinter(savedPrinter);
      } else if (availablePrinters.length > 0) {
        const preferredPrinterName = 'XP-80C (copy 2)';
        const preferred = availablePrinters.find((printer) => printer.name === preferredPrinterName);
        const fallback = preferred ? preferred.name : availablePrinters[0].name;

        // Auto-select preferred thermal printer when available.
        setSelectedPrinter(fallback);
        localStorage.setItem('selectedPrinter', fallback);
      }
    } catch (error) {
      console.error('Error loading printers:', error);
      toast.error('Failed to load printers');
    } finally {
      setLoading(false);
    }
  };

  // Printer status checks for native printers are removed because
  // the app now defaults to browser-based printing. Desktop printer
  // discovery is still shown when running under Electron.

  const handlePrinterChange = (event) => {
    const newPrinter = event.target.value;
    setSelectedPrinter(newPrinter);
    localStorage.setItem('selectedPrinter', newPrinter);
    toast.success(`Printer set to: ${newPrinter}`);
  };

  const handleQuickPrinterSelect = (printerName) => {
    setSelectedPrinter(printerName);
    localStorage.setItem('selectedPrinter', printerName);

    const found = printers.some((printer) => printer.name === printerName);
    if (found) {
      toast.success(`Printer set to: ${printerName}`);
    } else {
      toast.warning(`Saved ${printerName}. If it does not print, click Refresh Printers.`);
    }
  };

  const handleFontChange = (event) => {
    const font = event.target.value;
    setReceiptFont(font);
    localStorage.setItem('receiptFontFamily', font);
  };

  const handleFontWeightChange = (event) => {
    const weight = event.target.value;
    setReceiptFontWeight(weight);
    localStorage.setItem('receiptFontWeight', weight);
  };

  const handleFontSizeChange = (event, newValue) => {
    setReceiptFontSize(newValue);
    localStorage.setItem('receiptFontSize', String(newValue));
  };

  const handleTestPrint = async () => {
    setTesting(true);
    try {
      // Use direct thermal printing for selected printer
      const sampleOrder = {
        id: 'TEST-PRINT',
        items: [
          { itemName: 'Test Item 1', quantity: 2, price: 150.00 },
          { itemName: 'Test Item 2', quantity: 1, price: 250.00 }
        ],
        cashier: 'System',
        paymentMethod: 'cash',
        tender_cash: 600.00
      };
      const storeInfo = {
        name: 'BINTHANNA RESTAURANT',
        address: 'Kekirihena Mahaoya',
        phone: '076 670 2231',
        receiptFooter: 'Thank you for your visit!'
      };
      
      const result = await htmlPrintService.printDirectThermal(sampleOrder, storeInfo);
      if (result.success) {
        toast.success(`Test receipt sent to: ${selectedPrinter}`);
      } else {
        toast.error(result.message || 'Could not print test receipt');
      }
    } catch (error) {
      toast.error(`Test print error: ${error.message}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Print /> Printer Settings
        </Typography>
        
        <Divider sx={{ my: 2 }} />

        {!getIpcRenderer() && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Printer features are only available when running as a desktop application
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel>Select Printer</InputLabel>
              <Select
                value={selectedPrinter}
                onChange={handlePrinterChange}
                label="Select Printer"
                disabled={!getIpcRenderer()}
              >
                {printers.length === 0 ? (
                  <MenuItem value="">No printers found</MenuItem>
                ) : (
                  printers.map((printer) => (
                    <MenuItem key={printer.name} value={printer.name}>
                      {printer.displayName || printer.name} 
                      {printer.isDefault && ' (Default)'}
                    </MenuItem>
                  ))
                )}
              </Select>
            </FormControl>

            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 700 }}>
                Quick Switch (XP-80C)
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {quickReceiptPrinters.map((printerName) => {
                  const isSelected = selectedPrinter === printerName;
                  return (
                    <Button
                      key={printerName}
                      size="small"
                      variant={isSelected ? 'contained' : 'outlined'}
                      onClick={() => handleQuickPrinterSelect(printerName)}
                      disabled={!getIpcRenderer()}
                      sx={{ textTransform: 'none' }}
                    >
                      {printerName}
                    </Button>
                  );
                })}
              </Box>
            </Box>

            {printerStatus && (
              <Alert 
                severity={printerStatus.connected ? 'success' : 'error'} 
                icon={printerStatus.connected ? <CheckCircle /> : <Error />}
                sx={{ mb: 2 }}
              >
                Printer Status: {printerStatus.connected ? 'Connected' : 'Not Connected'}
                <br />
                <Typography variant="caption">
                  Current Printer: {printerStatus.model}
                </Typography>
              </Alert>
            )}

            {selectedPrinter && (
              <Alert severity="info" icon={<Print />} sx={{ mb: 2 }}>
                <Typography variant="body2">
                  <strong>Selected Printer:</strong> {selectedPrinter}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  This printer will be used for all receipt printing
                </Typography>
              </Alert>
            )}

            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="outlined"
                onClick={loadPrinters}
                disabled={!getIpcRenderer() || loading}
              >
                Refresh Printers
              </Button>
              
              <Button
                variant="contained"
                startIcon={testing ? <CircularProgress size={20} /> : <Print />}
                onClick={handleTestPrint}
                disabled={!getIpcRenderer() || testing || !selectedPrinter}
              >
                {testing ? 'Printing...' : 'Test Print'}
              </Button>
            </Box>

            <Divider sx={{ my: 3 }} />

            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TextFields /> Receipt Font Settings
            </Typography>

            <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
              <FormControl sx={{ minWidth: 200, flex: 1 }}>
                <InputLabel>Font</InputLabel>
                <Select
                  value={receiptFont}
                  onChange={handleFontChange}
                  label="Font"
                >
                  {fontOptions.map((f) => (
                    <MenuItem key={f.value} value={f.value} sx={{ fontFamily: f.value }}>
                      {f.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl sx={{ minWidth: 150 }}>
                <InputLabel>Font Weight</InputLabel>
                <Select
                  value={receiptFontWeight}
                  onChange={handleFontWeightChange}
                  label="Font Weight"
                >
                  <MenuItem value="normal">Normal</MenuItem>
                  <MenuItem value="bold">Bold</MenuItem>
                  <MenuItem value="900">Extra Bold</MenuItem>
                </Select>
              </FormControl>
            </Box>

            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" gutterBottom>Font Size: {receiptFontSize}px</Typography>
              <Slider
                value={receiptFontSize}
                onChange={handleFontSizeChange}
                min={10}
                max={18}
                step={1}
                marks
                valueLabelDisplay="auto"
                sx={{ maxWidth: 300 }}
              />
            </Box>

            <Box sx={{ 
              border: '1px solid #ccc', 
              borderRadius: 1, 
              p: 2, 
              mb: 2, 
              maxWidth: 360,
              backgroundColor: '#fff'
            }}>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                Preview:
              </Typography>
              <Box sx={{ 
                fontFamily: `'${receiptFont}', Arial, sans-serif`, 
                fontWeight: receiptFontWeight, 
                fontSize: `${receiptFontSize}px`,
                color: '#000'
              }}>
                <Box sx={{ textAlign: 'center', fontWeight: 900, fontSize: '18px', mb: 0.5 }}>BINTHANNA RESTAURANT</Box>
                <Box sx={{ textAlign: 'center', fontSize: '11px' }}>Colombo, Sri Lanka</Box>
                <Box sx={{ borderTop: '1px dashed #000', my: 1 }} />
                <Box>Order #: 123</Box>
                <Box>Date: 3/12/2026 10:30 AM</Box>
                <Box sx={{ borderTop: '1px dashed #000', my: 1 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Sample Item</span>
                  <span>1</span>
                  <span>Rs 500.00</span>
                </Box>
                <Box sx={{ borderTop: '1px dashed #000', my: 1 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900 }}>
                  <span>TOTAL</span>
                  <span>Rs 500.00</span>
                </Box>
              </Box>
            </Box>

            <Box sx={{ mt: 3 }}>
              <Typography variant="body2" color="text.secondary">
                <strong>Note:</strong> Make sure your printer is turned on and properly connected.
                For thermal printers, ensure the paper is loaded correctly.
              </Typography>
            </Box>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default PrinterSettings;
