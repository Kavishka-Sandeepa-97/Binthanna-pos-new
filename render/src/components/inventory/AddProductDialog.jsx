import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Grid,
  TextField,
  Typography,
  Box,
  Divider,
  InputAdornment,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import { Add as AddIcon, Refresh as RefreshIcon, AddCircleOutline as AddCircleOutlineIcon } from '@mui/icons-material';
import { Autocomplete } from '@mui/material';
import { toast } from 'react-toastify';
import api from '../../services/api';

const DATE_DISPLAY_PATTERN = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
const DATE_YEAR_FIRST_PATTERN = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/;

const parseExpiryDateInput = (value) => {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return { isoValue: '', displayValue: '' };
  }

  const normalizedValue = trimmedValue.replace(/[.\-\s]+/g, '/').replace(/\/+/g, '/');

  let day;
  let month;
  let year;

  const displayMatch = normalizedValue.match(DATE_DISPLAY_PATTERN);
  const isoMatch = normalizedValue.match(DATE_YEAR_FIRST_PATTERN);

  if (displayMatch) {
    [, day, month, year] = displayMatch;
  } else if (isoMatch) {
    [, year, month, day] = isoMatch;
  } else {
    return null;
  }

  const normalizedDay = day.padStart(2, '0');
  const normalizedMonth = month.padStart(2, '0');
  const parsedDate = new Date(Number(year), Number(normalizedMonth) - 1, Number(normalizedDay));

  if (
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.getFullYear() !== Number(year) ||
    parsedDate.getMonth() !== Number(normalizedMonth) - 1 ||
    parsedDate.getDate() !== Number(normalizedDay)
  ) {
    return null;
  }

  return {
    isoValue: `${year}-${normalizedMonth}-${normalizedDay}`,
    displayValue: `${normalizedDay}/${normalizedMonth}/${year}`,
  };
};

const formatExpiryDateForDisplay = (value) => {
  const parsedValue = parseExpiryDateInput(value);
  return parsedValue ? parsedValue.displayValue : value;
};

const AddProductDialog = ({
  open,
  onClose,
  itemVariants,
  variants,
  onSave,
  generateBarcode,
  onVariantCreated,
}) => {
  const buildEmptyFormData = useCallback(() => ({
    item_id: '',
    variant_id: '',
    barcode: typeof generateBarcode === 'function' ? generateBarcode() : '',
    sellingPrice: '',
    buyingPrice: '',
    quantity: '',
    expireDate: '',
    description: '',
    isDiscountActive: false,
    discountType: 'percentage',
    discountValue: '',
  }), [generateBarcode]);

  const [formData, setFormData] = useState(() => buildEmptyFormData());
  const [expireDateInput, setExpireDateInput] = useState('');
  const [expireDateError, setExpireDateError] = useState('');
  const [itemSearchText, setItemSearchText] = useState('');
  const [variantSearchText, setVariantSearchText] = useState('');
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [confirmAddOpen, setConfirmAddOpen] = useState(false);
  const [pendingFormData, setPendingFormData] = useState(null);
  const [quickVariantName, setQuickVariantName] = useState('');
  const [quickAdding, setQuickAdding] = useState(false);
  const formContentRef = useRef(null);
  const itemInputRef = useRef(null);
  const scannerRef = useRef({
    buffer: '',
    startedAt: 0,
    lastKeyAt: 0,
    maxKeyInterval: 0,
    resetTimer: null,
  });
  const MAX_AUTOCOMPLETE_RESULTS = 120;
  const SCAN_RESET_DELAY_MS = 90;
  const SCAN_MAX_KEY_INTERVAL_MS = 45;
  const SCAN_MIN_LENGTH = 8;
  const SCAN_MAX_LENGTH = 24;

  useEffect(() => {
    if (!open) return;
    setFormData(buildEmptyFormData());
    setExpireDateInput('');
    setExpireDateError('');
    setItemSearchText('');
    setVariantSearchText('');
    setConfirmAddOpen(false);
    setPendingFormData(null);
  }, [open, buildEmptyFormData]);

  useEffect(() => {
    if (!open) return;

    const focusItemInput = () => {
      const target = itemInputRef.current;
      if (target instanceof HTMLInputElement) {
        target.focus();
        target.select();
      }
    };

    // Dialog mount/transition can steal focus, so retry once after mount.
    const timer = window.setTimeout(focusItemInput, 120);
    requestAnimationFrame(focusItemInput);

    return () => {
      window.clearTimeout(timer);
    };
  }, [open]);

  const handleQuickAddVariant = async () => {
    if (!quickVariantName.trim()) return;
    setQuickAdding(true);
    try {
      const created = await api.variants.create({ variant_name: quickVariantName.trim() });
      setFormData((prev) => ({ ...prev, variant_id: created.id }));
      onVariantCreated();
      setQuickAddOpen(false);
      setQuickVariantName('');
      toast.success(`Variant "${created.variant_name}" added and selected`);
    } catch (e) {
      toast.error(`Failed to add variant: ${e.message}`);
    } finally {
      setQuickAdding(false);
    }
  };
  const uniqueItems = useMemo(() => {
    const seen = new Set();
    return itemVariants.reduce((acc, item) => {
      const itemId = item.item_id_ref || item.id;
      if (!seen.has(itemId)) {
        seen.add(itemId);
        acc.push({
          id: itemId,
          name: item.item_name || item.name,
          category: item.category_name || item.category,
          is_qty_managed: item.is_qty_managed !== undefined ? item.is_qty_managed : 1,
        });
      }
      return acc;
    }, []);
  }, [itemVariants]);

  const searchableItems = useMemo(
    () => uniqueItems.map((item) => ({
      ...item,
      _searchName: (item.name || '').toLowerCase(),
      _searchCategory: (item.category || '').toLowerCase(),
      _searchId: String(item.id || ''),
    })),
    [uniqueItems]
  );

  const searchableVariants = useMemo(
    () => variants.map((variant) => ({
      ...variant,
      _searchName: (variant.variant_name || '').toLowerCase(),
      _searchId: String(variant.id || ''),
    })),
    [variants]
  );

  const selectedItem = searchableItems.find(i => i.id === formData.item_id) || null;
  const selectedVariant = searchableVariants.find(v => v.id === formData.variant_id) || null;
  const isQtyManaged = selectedItem ? (selectedItem.is_qty_managed !== 0 && selectedItem.is_qty_managed !== false) : true;

  const getNavigableFields = useCallback(() => {
    if (!formContentRef.current) return [];

    return Array.from(formContentRef.current.querySelectorAll('[data-nav-index]'))
      .filter((element) => {
        if (!(element instanceof HTMLElement)) return false;
        if (element.hasAttribute('disabled')) return false;
        if (element.getAttribute('aria-disabled') === 'true') return false;
        if (element.tabIndex === -1) return false;
        return true;
      })
      .sort((a, b) => Number(a.getAttribute('data-nav-index')) - Number(b.getAttribute('data-nav-index')));
  }, []);

  const focusAdjacentField = useCallback((currentElement, step) => {
    const fields = getNavigableFields();
    const currentIndex = fields.indexOf(currentElement);
    if (currentIndex === -1) return false;

    const targetIndex = currentIndex + step;
    if (targetIndex < 0 || targetIndex >= fields.length) return false;

    const target = fields[targetIndex];
    if (target instanceof HTMLElement) {
      target.focus();
      return true;
    }
    return false;
  }, [getNavigableFields]);

  const isTextCaretAtBoundary = (element, direction) => {
    if (!(element instanceof HTMLInputElement) && !(element instanceof HTMLTextAreaElement)) {
      return true;
    }

    try {
      const start = element.selectionStart;
      const end = element.selectionEnd;
      if (start == null || end == null) return true;

      if (direction === 'previous') {
        return start === 0 && end === 0;
      }

      const valueLength = element.value?.length || 0;
      return start === valueLength && end === valueLength;
    } catch {
      return true;
    }
  };

  const requestSaveConfirmation = useCallback(() => {
    const normalizedExpireDate = parseExpiryDateInput(expireDateInput);

    if (expireDateInput.trim() && !normalizedExpireDate) {
      setExpireDateError('Use DD/MM/YYYY format');
      toast.error('Please enter expiry date as DD/MM/YYYY');
      return;
    }

    if (!formData.item_id || !formData.variant_id) {
      toast.error('Please select both item and variant');
      return;
    }

    const item = searchableItems.find(i => i.id === formData.item_id);
    const isQtyManaged = item ? (item.is_qty_managed !== 0 && item.is_qty_managed !== false) : true;

    if (!formData.buyingPrice) {
      toast.error(isQtyManaged ? 'Please fill in buying price' : 'Please fill in buying price / estimated cost');
      return;
    }

    if (!formData.sellingPrice) {
      toast.error('Please fill in selling price');
      return;
    }

    if (isQtyManaged && !formData.quantity) {
      toast.error('Please fill in quantity');
      return;
    }

    const nextFormData = {
      ...formData,
      expireDate: normalizedExpireDate?.isoValue || '',
      buyingPrice: formData.buyingPrice,
      quantity: isQtyManaged ? formData.quantity : 0,
    };

    setExpireDateError('');
    setExpireDateInput(normalizedExpireDate?.displayValue || '');
    setFormData(nextFormData);
    setPendingFormData(nextFormData);
    setConfirmAddOpen(true);
  }, [expireDateInput, formData, searchableItems]);

  const handleExpireDateChange = useCallback((event) => {
    const nextValue = event.target.value;
    setExpireDateInput(nextValue);
    setExpireDateError('');
    setPendingFormData(null);

    if (!nextValue.trim()) {
      setFormData((prev) => ({ ...prev, expireDate: '' }));
    }
  }, []);

  const handleExpireDateBlur = useCallback(() => {
    const normalizedExpireDate = parseExpiryDateInput(expireDateInput);

    if (!expireDateInput.trim()) {
      setExpireDateError('');
      setFormData((prev) => ({ ...prev, expireDate: '' }));
      return;
    }

    if (!normalizedExpireDate) {
      setExpireDateError('Use DD/MM/YYYY format');
      return;
    }

    setExpireDateError('');
    setExpireDateInput(normalizedExpireDate.displayValue);
    setFormData((prev) => ({ ...prev, expireDate: normalizedExpireDate.isoValue }));
  }, [expireDateInput]);

  const handleFormKeyNavigation = useCallback((event) => {
    if (quickAddOpen) return;
    if (event.altKey || event.ctrlKey || event.metaKey) return;

    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (!target.hasAttribute('data-nav-index')) return;

    const isComboBox = target.getAttribute('role') === 'combobox';
    const isExpanded = target.getAttribute('aria-expanded') === 'true';

    if (event.key === 'Enter') {
      if (isExpanded) return;
      if (target instanceof HTMLTextAreaElement && event.shiftKey) return;

      if (target.getAttribute('data-nav-index') === '3') {
        const normalizedExpireDate = parseExpiryDateInput(expireDateInput);

        if (expireDateInput.trim() && !normalizedExpireDate) {
          event.preventDefault();
          setExpireDateError('Use DD/MM/YYYY format');
          toast.error('Please enter expiry date as DD/MM/YYYY');
          return;
        }

        if (normalizedExpireDate) {
          setExpireDateError('');
          setExpireDateInput(normalizedExpireDate.displayValue);
          setFormData((prev) => ({ ...prev, expireDate: normalizedExpireDate.isoValue }));
        }
      }

      event.preventDefault();
      const moved = focusAdjacentField(target, 1);
      if (!moved) requestSaveConfirmation();
      return;
    }

    if (event.key === 'ArrowDown') {
      if (isComboBox) return;
      event.preventDefault();
      focusAdjacentField(target, 1);
      return;
    }

    if (event.key === 'ArrowUp') {
      if (isComboBox) return;
      event.preventDefault();
      focusAdjacentField(target, -1);
      return;
    }

    if (event.key === 'ArrowRight') {
      if (!isTextCaretAtBoundary(target, 'next')) return;
      event.preventDefault();
      focusAdjacentField(target, 1);
      return;
    }

    if (event.key === 'ArrowLeft') {
      if (!isTextCaretAtBoundary(target, 'previous')) return;
      event.preventDefault();
      focusAdjacentField(target, -1);
    }
  }, [expireDateInput, focusAdjacentField, quickAddOpen, requestSaveConfirmation]);

  const handleGenerateBarcode = useCallback(() => {
    if (typeof generateBarcode !== 'function') return;
    const nextBarcode = generateBarcode();
    setFormData((prev) => ({ ...prev, barcode: nextBarcode }));
  }, [generateBarcode]);

  const handleBarcodeFocus = useCallback((event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    // Defer selection so focus settles before selecting all text
    requestAnimationFrame(() => {
      target.select();
    });
  }, []);

  const handleSaveClick = () => requestSaveConfirmation();

  const handleConfirmAdd = async () => {
    setConfirmAddOpen(false);
    await onSave(pendingFormData || formData);
  };

  const resetScannerBuffer = useCallback(() => {
    const scanner = scannerRef.current;
    scanner.buffer = '';
    scanner.startedAt = 0;
    scanner.lastKeyAt = 0;
    scanner.maxKeyInterval = 0;
    if (scanner.resetTimer) {
      clearTimeout(scanner.resetTimer);
      scanner.resetTimer = null;
    }
  }, []);

  const handleScannerCapture = useCallback((event) => {
    if (!open || quickAddOpen) return;
    if (event.altKey || event.ctrlKey || event.metaKey) return;

    const scanner = scannerRef.current;
    const now = Date.now();
    const isBarcodeChar = /^[A-Za-z0-9]$/.test(event.key);

    if (isBarcodeChar) {
      const delta = scanner.lastKeyAt ? now - scanner.lastKeyAt : 0;
      if (!scanner.lastKeyAt || delta > SCAN_RESET_DELAY_MS) {
        scanner.buffer = event.key;
        scanner.startedAt = now;
        scanner.maxKeyInterval = 0;
      } else {
        scanner.buffer += event.key;
        scanner.maxKeyInterval = Math.max(scanner.maxKeyInterval, delta);
      }

      scanner.lastKeyAt = now;
      if (scanner.resetTimer) clearTimeout(scanner.resetTimer);
      scanner.resetTimer = setTimeout(() => {
        resetScannerBuffer();
      }, SCAN_RESET_DELAY_MS);
      return;
    }

    if (event.key !== 'Enter') return;

    const scannedValue = scanner.buffer;
    const isScanSpeedValid = scanner.maxKeyInterval <= SCAN_MAX_KEY_INTERVAL_MS;
    const isScanLengthValid = scannedValue.length >= SCAN_MIN_LENGTH && scannedValue.length <= SCAN_MAX_LENGTH;

    resetScannerBuffer();

    if (!isScanLengthValid || !isScanSpeedValid) return;

    event.preventDefault();
    event.stopPropagation();

    setFormData((prev) => ({ ...prev, barcode: scannedValue }));

    const barcodeInput = formContentRef.current?.querySelector('[data-nav-index="2"]');
    if (barcodeInput instanceof HTMLElement) {
      barcodeInput.focus();
    }
  }, [open, quickAddOpen, resetScannerBuffer]);

  useEffect(() => () => {
    resetScannerBuffer();
  }, [resetScannerBuffer]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { borderTop: '4px solid #4CAF50', borderRadius: '8px' } }}
    >
      <DialogTitle sx={{ bgcolor: '#E8F5E9', color: '#2E7D32', fontWeight: 'bold', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: 1 }}>
        <AddIcon sx={{ color: '#4CAF50' }} />
        Add New Final Selling Product
      </DialogTitle>
      <DialogContent ref={formContentRef} sx={{ pt: 3 }} onKeyDownCapture={handleScannerCapture} onKeyDown={handleFormKeyNavigation}>
        <Grid container spacing={2} sx={{ mt: 0 }}>
          {/* Item Selection */}
          <Grid item xs={12} sm={6}>
            <Autocomplete
              options={searchableItems}
              openOnFocus
              getOptionLabel={(option) => option.name || ''}
              value={selectedItem}
              onChange={(_, newValue) => setFormData((prev) => ({ ...prev, item_id: newValue ? newValue.id : '' }))}
              inputValue={itemSearchText}
              onInputChange={(_, newInputValue) => setItemSearchText(newInputValue)}
              filterOptions={(options, { inputValue }) => {
                const filter = (inputValue || '').trim().toLowerCase();
                if (!filter) return options.slice(0, MAX_AUTOCOMPLETE_RESULTS);
                return options
                  .filter((o) =>
                    o._searchName.includes(filter) ||
                    o._searchCategory.includes(filter) ||
                    o._searchId.includes(filter)
                  )
                  .slice(0, MAX_AUTOCOMPLETE_RESULTS);
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Select Item *"
                  placeholder="Search by name, category or ID..."
                  required
                  helperText="Type to search through items"
                  inputRef={itemInputRef}
                  inputProps={{
                    ...params.inputProps,
                    'data-nav-index': '0',
                  }}
                />
              )}
              renderOption={(props, option) => (
                <Box component="li" {...props}>
                  <Box>
                    <Typography variant="body1">{option.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{option.category} • Item ID: {option.id}</Typography>
                  </Box>
                </Box>
              )}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              noOptionsText="No items found"
            />
          </Grid>

          {/* Variant Selection */}
          <Grid item xs={12} sm={6}>
            <Box display="flex" gap={1} alignItems="flex-start">
              <Box flex={1}>
                <Autocomplete
                  options={searchableVariants}
                  getOptionLabel={(option) => option.variant_name || ''}
                  value={searchableVariants.find(v => v.id === formData.variant_id) || null}
                  onChange={(_, newValue) => setFormData((prev) => ({ ...prev, variant_id: newValue ? newValue.id : '' }))}
                  inputValue={variantSearchText}
                  onInputChange={(_, newInputValue) => setVariantSearchText(newInputValue)}
                  filterOptions={(options, { inputValue }) => {
                    const filter = (inputValue || '').trim().toLowerCase();
                    if (!filter) return options.slice(0, MAX_AUTOCOMPLETE_RESULTS);
                    return options
                      .filter((o) =>
                        o._searchName.includes(filter) ||
                        o._searchId.includes(filter)
                      )
                      .slice(0, MAX_AUTOCOMPLETE_RESULTS);
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Select Variant *"
                      placeholder="Search by variant name or ID..."
                      required
                      helperText="Type to search through variants"
                      inputProps={{
                        ...params.inputProps,
                        'data-nav-index': '1',
                      }}
                    />
                  )}
                  renderOption={(props, option) => (
                    <Box component="li" {...props}>
                      <Box>
                        <Typography variant="body1">{option.variant_name}</Typography>
                        <Typography variant="caption" color="text.secondary">Variant ID: {option.id}</Typography>
                      </Box>
                    </Box>
                  )}
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  noOptionsText="No variants found"
                />
              </Box>
              <Tooltip title="Add New Variant">
                <IconButton onClick={() => setQuickAddOpen(true)} sx={{ mt: 1, color: 'success.main' }}>
                  <AddCircleOutlineIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </Grid>

          {/* Quick Add Variant Dialog */}
          <Dialog open={quickAddOpen} onClose={() => { setQuickAddOpen(false); setQuickVariantName(''); }} maxWidth="xs" fullWidth>
            <DialogTitle sx={{ fontWeight: 'bold' }}>Add New Variant</DialogTitle>
            <DialogContent>
              <TextField
                autoFocus
                fullWidth
                label="Variant Name"
                value={quickVariantName}
                onChange={(e) => setQuickVariantName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleQuickAddVariant(); }}
                placeholder="e.g., 10ml, 50ml, Large, Small"
                sx={{ mt: 1 }}
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => { setQuickAddOpen(false); setQuickVariantName(''); }}>Cancel</Button>
              <Button
                onClick={handleQuickAddVariant}
                variant="contained"
                disabled={quickAdding || !quickVariantName.trim()}
                startIcon={quickAdding ? <CircularProgress size={16} /> : null}
              >
                {quickAdding ? 'Adding...' : 'Add'}
              </Button>
            </DialogActions>
          </Dialog>

          {/* Barcode */}
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Barcode *"
              value={formData.barcode}
              onChange={(e) => setFormData((prev) => ({ ...prev, barcode: e.target.value }))}
              onFocus={handleBarcodeFocus}
              placeholder="9-digit barcode"
              required
              inputProps={{ 'data-nav-index': '2', autoComplete: 'off', inputMode: 'numeric', spellCheck: false }}
              helperText="Scanner supported: you can scan directly in this popup"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={handleGenerateBarcode} edge="end" title="Generate new barcode">
                      <RefreshIcon />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Grid>

          {/* Expire Date */}
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Expire Date"
              type="text"
              value={expireDateInput}
              onChange={handleExpireDateChange}
              onBlur={handleExpireDateBlur}
              placeholder="DD/MM/YYYY"
              error={!!expireDateError}
              helperText={expireDateError || 'Enter as DD/MM/YYYY'}
              inputProps={{ 'data-nav-index': '3' }}
            />
          </Grid>

          {/* Buying Price */}
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              label="Buying Price / Est. Cost *"
              type="number"
              value={formData.buyingPrice}
              onChange={(e) => setFormData((prev) => ({ ...prev, buyingPrice: e.target.value }))}
              inputProps={{ 'data-nav-index': '4' }}
              InputProps={{ startAdornment: <InputAdornment position="start">Rs.</InputAdornment> }}
              required
            />
          </Grid>

          {/* Selling Price */}
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              label="Selling Price *"
              type="number"
              value={formData.sellingPrice}
              onChange={(e) => setFormData((prev) => ({ ...prev, sellingPrice: e.target.value }))}
              inputProps={{ 'data-nav-index': '5' }}
              InputProps={{ startAdornment: <InputAdornment position="start">Rs.</InputAdornment> }}
              required
            />
          </Grid>

          {/* Quantity */}
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              label={isQtyManaged ? "Quantity *" : "Quantity (Not Managed)"}
              type="number"
              value={isQtyManaged ? formData.quantity : ''}
              onChange={(e) => setFormData((prev) => ({ ...prev, quantity: e.target.value }))}
              inputProps={{ 'data-nav-index': '6' }}
              required={isQtyManaged}
              disabled={!isQtyManaged}
            />
          </Grid>

          {/* Discount Settings */}
          <Grid item xs={12}>
            <Divider sx={{ my: 1 }} />
            <Typography variant="subtitle1" gutterBottom color="secondary" sx={{ fontWeight: 'bold' }}>
              Discount Settings
            </Typography>
          </Grid>
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth>
              <InputLabel>Discount Active</InputLabel>
              <Select
                value={formData.isDiscountActive ? 'yes' : 'no'}
                label="Discount Active"
                onChange={(e) => setFormData((prev) => ({ ...prev, isDiscountActive: e.target.value === 'yes' }))}
                SelectDisplayProps={{ 'data-nav-index': '7' }}
              >
                <MenuItem value="no">No</MenuItem>
                <MenuItem value="yes">Yes</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth disabled={!formData.isDiscountActive}>
              <InputLabel>Discount Type</InputLabel>
              <Select
                value={formData.discountType || 'percentage'}
                label="Discount Type"
                onChange={(e) => setFormData((prev) => ({ ...prev, discountType: e.target.value }))}
                SelectDisplayProps={{ 'data-nav-index': '8' }}
              >
                <MenuItem value="fixed">Fixed (Rs.)</MenuItem>
                <MenuItem value="percentage">Percentage (%)</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              label={formData.discountType === 'percentage' ? 'Discount (%)' : 'Discount (Rs.)'}
              type="number"
              value={formData.discountValue}
              onChange={(e) => setFormData((prev) => ({ ...prev, discountValue: e.target.value }))}
              disabled={!formData.isDiscountActive}
              inputProps={{ min: 0, step: 0.01, 'data-nav-index': '9' }}
            />
          </Grid>
          {formData.isDiscountActive && formData.sellingPrice && formData.discountValue ? (
            <Grid item xs={12}>
              <Alert severity="info">
                Final Price: Rs. {formData.discountType === 'percentage'
                  ? (parseFloat(formData.sellingPrice) - (parseFloat(formData.sellingPrice) * parseFloat(formData.discountValue) / 100)).toFixed(2)
                  : (parseFloat(formData.sellingPrice) - parseFloat(formData.discountValue)).toFixed(2)
                }
              </Alert>
            </Grid>
          ) : null}
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSaveClick} variant="contained" sx={{ bgcolor: '#4CAF50', '&:hover': { bgcolor: '#388E3C' } }}>
          Add Product
        </Button>
      </DialogActions>

      <Dialog
        open={confirmAddOpen}
        onClose={() => { setConfirmAddOpen(false); setPendingFormData(null); }}
        maxWidth="xs"
        fullWidth
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            event.stopPropagation();
            handleConfirmAdd();
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 'bold' }}>Confirm Product Add</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Please confirm details before adding this product.
          </Typography>
          <Box display="grid" gridTemplateColumns="1fr 1fr" gap={1}>
            <Typography variant="body2" color="text.secondary">Item</Typography>
            <Typography variant="body2" fontWeight="bold">{selectedItem?.name || '-'}</Typography>
            <Typography variant="body2" color="text.secondary">Variant</Typography>
            <Typography variant="body2" fontWeight="bold">{selectedVariant?.variant_name || '-'}</Typography>
            <Typography variant="body2" color="text.secondary">Barcode</Typography>
            <Typography variant="body2" fontWeight="bold">{formData.barcode || '-'}</Typography>
            {isQtyManaged && (
              <>
                <Typography variant="body2" color="text.secondary">Buying Price</Typography>
                <Typography variant="body2" fontWeight="bold">Rs. {formData.buyingPrice || '0'}</Typography>
              </>
            )}
            <Typography variant="body2" color="text.secondary">Selling Price</Typography>
            <Typography variant="body2" fontWeight="bold">Rs. {formData.sellingPrice || '0'}</Typography>
            {isQtyManaged && (
              <>
                <Typography variant="body2" color="text.secondary">Quantity</Typography>
                <Typography variant="body2" fontWeight="bold">{formData.quantity || '0'}</Typography>
              </>
            )}
            <Typography variant="body2" color="text.secondary">Expire Date</Typography>
            <Typography variant="body2" fontWeight="bold">{pendingFormData?.expireDate ? formatExpiryDateForDisplay(pendingFormData.expireDate) : '-'}</Typography>
            <Typography variant="body2" color="text.secondary">Discount Active</Typography>
            <Typography variant="body2" fontWeight="bold">{formData.isDiscountActive ? 'Yes' : 'No'}</Typography>
            {formData.isDiscountActive ? (
              <>
                <Typography variant="body2" color="text.secondary">Discount</Typography>
                <Typography variant="body2" fontWeight="bold">
                  {formData.discountType === 'percentage' ? `${formData.discountValue || 0}%` : `Rs. ${formData.discountValue || 0}`}
                </Typography>
              </>
            ) : null}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setConfirmAddOpen(false); setPendingFormData(null); }}>Back</Button>
          <Button onClick={handleConfirmAdd} variant="contained" sx={{ bgcolor: '#4CAF50', '&:hover': { bgcolor: '#388E3C' } }}>
            Confirm Add
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
};

export default React.memo(AddProductDialog);
