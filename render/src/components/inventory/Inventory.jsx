import React, { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import imageCompression from 'browser-image-compression';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Chip,
  IconButton,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Alert,
  CircularProgress,
  Avatar,
  Badge,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Inventory as InventoryIcon,
  Warning as WarningIcon,
  TrendingDown as TrendingDownIcon,
  Save as SaveIcon,
  PhotoCamera as PhotoCameraIcon,
  Image as ImageIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { fetchCategories, fetchVariants, fetchItemVariants } from '../../store/slices/inventorySlice';
import api from '../../services/api';
import CategoryManagementMenu from './CategoryManagementMenu';
import BrandManagementMenu from './BrandManagementMenu';
import htmlPrintService from '../../services/htmlPrintService';

// Sub-components
import InventoryItemsTable from './InventoryItemsTable';
import ItemManagementTab from './ItemManagementTab';
import AddProductDialog from './AddProductDialog';
import { AddStockDialog, StockBatchDialog, EditStockBatchDialog, BarcodePrintDialog } from './StockDialogs';
import GlobalDiscountTab from './GlobalDiscountTab';
import VariantManagementTab from './VariantManagementTab';

const Inventory = () => {
  const dispatch = useDispatch();
  const { categories, variants, itemVariants, loading } = useSelector((state) => state.inventory);
  const { user } = useSelector((state) => state.auth);
  const [currentTab, setCurrentTab] = useState(0);

  // Edit item dialog (overview table)
  const fileInputRef = useRef(null);
  const [editItemDialog, setEditItemDialog] = useState(false);
  const [deleteItemDialog, setDeleteItemDialog] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [deletingItem, setDeletingItem] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [newItem, setNewItem] = useState({ name: '', category: '', variant: '', image: null, imagePreview: null });
  const [savingItem, setSavingItem] = useState(false);
  const [fieldTouched, setFieldTouched] = useState({ name: false, category: false, variant: false });

  // Variant management
  const [variantDialog, setVariantDialog] = useState(false);
  const [selectedVariantEdit, setSelectedVariantEdit] = useState(null);
  const [newVariant, setNewVariant] = useState({ variant_name: '' });
  const [deleteVariantConfirmDialog, setDeleteVariantConfirmDialog] = useState(false);
  const [variantToDelete, setVariantToDelete] = useState(null);
  const [loadingVariants, setLoadingVariants] = useState(false);

  // Stock
  const [addStockDialog, setAddStockDialog] = useState(false);
  const [selectedItemForStock, setSelectedItemForStock] = useState(null);
  const [newStockData, setNewStockData] = useState({ buyingPrice: '', sellingPrice: '', quantity: '', description: '', expiryDate: '' });

  const [stockBatchDialog, setStockBatchDialog] = useState(false);
  const [selectedItemForStockBatch, setSelectedItemForStockBatch] = useState(null);
  const [stockBatchData, setStockBatchData] = useState([]);
  const [stockMovementsData, setStockMovementsData] = useState([]);
  const [loadingStockBatch, setLoadingStockBatch] = useState(false);
  const [stockFilters, setStockFilters] = useState({ type: 'stockIn' });
  const [dateFilters, setDateFilters] = useState({ fromDate: '', toDate: '' });

  const [editStockBatchDialog, setEditStockBatchDialog] = useState(false);
  const [editingStockBatch, setEditingStockBatch] = useState(null);
  const [editStockBatchData, setEditStockBatchData] = useState({ initial_qty: '', remaining_qty: '', buy_price: '', sell_price: '', expire_date: '', description: '' });
  const [savingStockBatch, setSavingStockBatch] = useState(false);

  // Low / Out of stock dialogs
  const [lowStockDialog, setLowStockDialog] = useState(false);
  const [outOfStockDialog, setOutOfStockDialog] = useState(false);

  // Barcode print
  const [barcodePrintDialog, setBarcodePrintDialog] = useState(false);
  const [selectedItemForBarcode, setSelectedItemForBarcode] = useState(null);
  const [barcodePrintQuantity, setBarcodePrintQuantity] = useState(1);

  // Add Final Selling Product dialog
  const [addItemVariantDialog, setAddItemVariantDialog] = useState(false);

  // Global discount
  const [globalDiscountSettings, setGlobalDiscountSettings] = useState({ is_global_discount_active: false, global_discount_type: 'percentage', global_discount_value: 0, min_order_amount: 0 });
  const [loadingGlobalDiscount, setLoadingGlobalDiscount] = useState(false);
  const [savingGlobalDiscount, setSavingGlobalDiscount] = useState(false);

  useEffect(() => {
    dispatch(fetchCategories());
    dispatch(fetchVariants());
    dispatch(fetchItemVariants());
  }, [dispatch]);

  // ── Memoized derived lists (Fix 3) ──────────────────────────────────────────
  const lowStockItems = useMemo(
    () => itemVariants.filter(item => { const s = item.total_stock || item.stock || 0; return s <= (item.minStock || 5) && s > 0; }),
    [itemVariants]
  );
  const outOfStockItems = useMemo(
    () => itemVariants.filter(item => (item.total_stock || item.stock || 0) === 0),
    [itemVariants]
  );

  const filteredStockData = useMemo(() => {
    let dataSource;
    if (stockFilters.type === 'stockIn') {
      dataSource = stockBatchData;
    } else {
      dataSource = stockMovementsData.filter(m => m.type === 'OUT');
    }
    if (!dateFilters.fromDate && !dateFilters.toDate) return dataSource;
    return dataSource.filter(movement => {
      const d = movement.date ? new Date(movement.date) : movement.created_at ? new Date(movement.created_at) : null;
      if (!d) return false;
      if (dateFilters.fromDate) { const f = new Date(dateFilters.fromDate); f.setHours(0,0,0,0); if (d < f) return false; }
      if (dateFilters.toDate) { const t = new Date(dateFilters.toDate); t.setHours(23,59,59,999); if (d > t) return false; }
      return true;
    });
  }, [stockBatchData, stockMovementsData, stockFilters, dateFilters]);

  const generateRandomBarcode = useCallback(() => '200' + Math.floor(100000 + Math.random() * 900000).toString(), []);

  const handleTabChange = (_, newValue) => {
    setCurrentTab(newValue);
    if (newValue === 5) fetchGlobalDiscountSettings();
  };

  // Global Discount
  const fetchGlobalDiscountSettings = async () => {
    setLoadingGlobalDiscount(true);
    try {
      const settings = await api.globalDiscount.get();
      setGlobalDiscountSettings({ is_global_discount_active: !!settings.is_global_discount_active, global_discount_type: settings.global_discount_type || 'percentage', global_discount_value: settings.global_discount_value || 0, min_order_amount: settings.min_order_amount || 0 });
    } catch { toast.error('Failed to load global discount settings'); }
    finally { setLoadingGlobalDiscount(false); }
  };

  const handleSaveGlobalDiscount = async () => {
    setSavingGlobalDiscount(true);
    try { await api.globalDiscount.update(globalDiscountSettings); toast.success('Global discount settings saved successfully'); }
    catch { toast.error('Failed to save global discount settings'); }
    finally { setSavingGlobalDiscount(false); }
  };

  // Variant Management
  const handleAddVariant = () => { setSelectedVariantEdit(null); setNewVariant({ variant_name: '' }); setVariantDialog(true); };
  const handleEditVariant = (v) => { setSelectedVariantEdit(v); setNewVariant({ variant_name: v.variant_name }); setVariantDialog(true); };
  const handleCloseVariantDialog = () => { setVariantDialog(false); setSelectedVariantEdit(null); setNewVariant({ variant_name: '' }); };
  const handleSaveVariant = async () => {
    if (!newVariant.variant_name) { toast.error('Variant name is required'); return; }
    setLoadingVariants(true);
    try {
      if (selectedVariantEdit) { await api.variants.update(selectedVariantEdit.id, newVariant); toast.success('Variant updated successfully'); }
      else { await api.variants.create(newVariant); toast.success('Variant added successfully'); }
      dispatch(fetchVariants());
      handleCloseVariantDialog();
    } catch (e) { toast.error(`Error: ${e.message || 'Failed to save variant'}`); }
    finally { setLoadingVariants(false); }
  };
  const handleDeleteVariant = (id) => { setVariantToDelete(id); setDeleteVariantConfirmDialog(true); };
  const confirmDeleteVariant = async () => {
    setLoadingVariants(true);
    try { await api.variants.delete(variantToDelete); toast.success('Variant deleted successfully'); dispatch(fetchVariants()); setDeleteVariantConfirmDialog(false); setVariantToDelete(null); }
    catch (e) { toast.error(`Error: ${e.message || 'Failed to delete variant'}`); }
    finally { setLoadingVariants(false); }
  };

  // Overview table handlers
  const handleAddItem = () => {
    setAddItemVariantDialog(true);
  };

  const handleCloseAddItemVariantDialog = useCallback(() => {
    setAddItemVariantDialog(false);
  }, []);

  const handleSaveItemVariant = useCallback(async (formData) => {
    if (!formData.item_id || !formData.variant_id) { toast.error('Please select both item and variant'); return; }
    if (!formData.buyingPrice || !formData.quantity || !formData.sellingPrice) { toast.error('Please fill in buying price, selling price, and quantity'); return; }
    try {
      const itemVariantResponse = await api.itemVariants.create({ item_id: formData.item_id, variant_id: formData.variant_id, barcode: formData.barcode || null, staff_id: user?.id, is_discount_active: formData.isDiscountActive || false, discount_type: formData.discountType || 'percentage', discount_value: parseFloat(formData.discountValue) || 0 });
      await api.stock.addBatch({ item_variant_id: itemVariantResponse.id, buyingPrice: parseFloat(formData.buyingPrice), sellingPrice: parseFloat(formData.sellingPrice), quantity: parseInt(formData.quantity), description: formData.description || null, expire_date: formData.expireDate || null });
      toast.success('Product added successfully with stock!');
      dispatch(fetchItemVariants());
      setAddItemVariantDialog(false);
    } catch (e) { toast.error('Failed to add product: ' + e.message); }
  }, [dispatch, user?.id]);

  const handleVariantCreated = useCallback(() => {
    dispatch(fetchVariants());
  }, [dispatch]);

  const handleAddStockClick = (item) => {
    if (!item.id) { toast.warning('Please add a variant to this item first.'); return; }
    setSelectedItemForStock(item);
    setNewStockData({ buyingPrice: '', sellingPrice: (item.selling_price || 0).toString(), quantity: '', description: '', expiryDate: '' });
    setAddStockDialog(true);
  };

  const handleSaveNewStock = async () => {
    if (!newStockData.quantity || !newStockData.buyingPrice || !newStockData.sellingPrice) { toast.error('Quantity, buying price, and selling price are required'); return; }
    try {
      await api.stock.addBatch({ item_variant_id: selectedItemForStock.id, quantity: parseInt(newStockData.quantity), buyingPrice: parseFloat(newStockData.buyingPrice), sellingPrice: parseFloat(newStockData.sellingPrice), description: newStockData.description || '', expire_date: newStockData.expiryDate || null });
      toast.success('Stock batch added successfully');
      dispatch(fetchItemVariants());
      setAddStockDialog(false);
    } catch (e) { toast.error(`Error: ${e.message || 'Failed to add stock'}`); }
  };

  const handleViewStockBatch = async (item) => {
    setSelectedItemForStockBatch(item);
    setLoadingStockBatch(true);
    setStockBatchDialog(true);
    setStockFilters({ type: 'stockIn' });
    setDateFilters({ fromDate: '', toDate: '' });
    try {
      const [stockBatches, stockMovements] = await Promise.all([api.stock.getStockBatches(item.id), api.stock.getStockHistory(item.id)]);
      setStockBatchData(stockBatches || []);
      setStockMovementsData(stockMovements || []);
    } catch { toast.error('Failed to load stock data'); setStockBatchData([]); setStockMovementsData([]); }
    finally { setLoadingStockBatch(false); }
  };

  const handleEditStockBatch = (stockBatch) => {
    if (user?.role !== 'admin') { toast.error('Only administrators can edit stock batches'); return; }
    setEditingStockBatch(stockBatch);
    setEditStockBatchData({ initial_qty: stockBatch.initial_qty || stockBatch.quantity || '', remaining_qty: stockBatch.remaining_qty !== undefined ? stockBatch.remaining_qty : '', buy_price: stockBatch.buy_price || '', sell_price: stockBatch.sell_price || stockBatch.price || '', expire_date: stockBatch.expire_date ? stockBatch.expire_date.split('T')[0] : '', description: stockBatch.description || '' });
    setEditStockBatchDialog(true);
  };

  const handleSaveStockBatchEdit = async () => {
    const initialQty = parseFloat(editStockBatchData.initial_qty);
    const remainingQty = parseFloat(editStockBatchData.remaining_qty);
    const buyPrice = editStockBatchData.buy_price ? parseFloat(editStockBatchData.buy_price) : undefined;
    const sellPrice = editStockBatchData.sell_price ? parseFloat(editStockBatchData.sell_price) : undefined;
    if (!editStockBatchData.initial_qty || editStockBatchData.remaining_qty === '') { toast.error('Both quantities are required'); return; }
    if (isNaN(initialQty) || isNaN(remainingQty)) { toast.error('Please enter valid numbers for quantities'); return; }
    if (initialQty <= 0) { toast.error('Initial quantity must be greater than 0'); return; }
    if (remainingQty < 0) { toast.error('Remaining quantity cannot be negative'); return; }
    if (remainingQty > initialQty) { toast.error('Remaining quantity cannot be greater than initial quantity'); return; }
    if (buyPrice !== undefined && (isNaN(buyPrice) || buyPrice < 0)) { toast.error('Please enter a valid buying price'); return; }
    if (sellPrice !== undefined && (isNaN(sellPrice) || sellPrice < 0)) { toast.error('Please enter a valid selling price'); return; }
    setSavingStockBatch(true);
    try {
      const updateData = { initial_qty: initialQty, remaining_qty: remainingQty };
      if (buyPrice !== undefined) updateData.buy_price = buyPrice;
      if (sellPrice !== undefined) updateData.sell_price = sellPrice;
      if (editStockBatchData.expire_date) updateData.expire_date = editStockBatchData.expire_date;
      if (editStockBatchData.description) updateData.description = editStockBatchData.description;
      await api.stock.updateBatch(editingStockBatch.id, updateData);
      toast.success('Stock batch updated successfully');
      setEditStockBatchDialog(false);
      if (selectedItemForStockBatch) {
        const stockBatches = await api.stock.getStockBatches(selectedItemForStockBatch.id);
        setStockBatchData(stockBatches || []);
      }
    } catch { toast.error('Failed to update stock batch'); }
    finally { setSavingStockBatch(false); }
  };

  const handleEditItem = async (item) => {
    setSelectedItem(item);
    setNewItem({ name: item.item_name || item.name || '', category: item.category_name || item.category || '', variant: item.variant_name || item.variant || '', image: null, imagePreview: null, barcode: item.barcode || '', buyingPrice: (item.buying_price || '').toString(), initialQuantity: (item.total_stock || item.stock || '').toString(), description: item.description || '', isDiscountActive: !!item.is_discount_active, discountType: item.discount_type || 'percentage', discountValue: (item.discount_value || '').toString() });
    setEditItemDialog(true);
    // Fetch image lazily (not included in bulk list to keep payload small)
    try {
      const itemId = item.item_id_ref || item.id;
      const fullItem = await api.items.getById(itemId);
      if (fullItem?.image) {
        setNewItem(prev => ({ ...prev, imagePreview: fullItem.image }));
      }
    } catch { /* image just won't prefill — user can re-upload */ }
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please select a valid image file'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Image size should be less than 5MB'); return; }
    try {
      const compressed = await imageCompression(file, { maxSizeMB: 1, maxWidthOrHeight: 1920, quality: 0.85, useWebWorker: true });
      const reader = new FileReader();
      reader.onload = (e) => setNewItem(prev => ({ ...prev, image: compressed, imagePreview: e.target.result }));
      reader.readAsDataURL(compressed);
    } catch { toast.error('Failed to compress image'); }
  };

  const removeImage = () => { setNewItem(prev => ({ ...prev, image: null, imagePreview: null })); if (fileInputRef.current) fileInputRef.current.value = ''; };

  const handleSaveItem = async () => {
    if (!newItem.name.trim()) { toast.error('Item name is required.'); setFieldTouched(prev => ({ ...prev, name: true })); return; }
    if (!newItem.category) { toast.error('Category selection is required.'); setFieldTouched(prev => ({ ...prev, category: true })); return; }
    if (!newItem.variant) { toast.error('Variant selection is required.'); setFieldTouched(prev => ({ ...prev, variant: true })); return; }
    setSavingItem(true);
    try {
      const formData = new FormData();
      formData.append('name', newItem.name);
      formData.append('category', newItem.category);
      formData.append('variant', newItem.variant);
      formData.append('barcode', newItem.barcode || '');
      formData.append('buyingPrice', newItem.buyingPrice || '');
      formData.append('initialQuantity', newItem.initialQuantity || '');
      formData.append('description', newItem.description || '');
      formData.append('isDiscountActive', newItem.isDiscountActive ? '1' : '0');
      formData.append('discountType', newItem.discountType || 'percentage');
      formData.append('discountValue', newItem.discountValue || '0');
      if (newItem.image) formData.append('image', newItem.image);
      if (selectedItem) { await api.itemVariants.updateFull(selectedItem.id, formData); toast.success('Item updated successfully'); }
      else { toast.error('Add functionality moved to "Add New Final Selling Product"'); }
      dispatch(fetchItemVariants());
      setEditItemDialog(false);
      setSelectedItem(null);
    } catch (e) { toast.error('Error saving item: ' + e.message); }
    finally { setSavingItem(false); }
  };

  const handleDeleteItem = (itemId) => {
    setItemToDelete(itemId);
    setDeleteItemDialog(true);
  };

  const confirmDeleteItem = async () => {
    if (!itemToDelete) return;

    setDeletingItem(true);
    try {
      await api.itemVariants.delete(itemToDelete);
      toast.success('Item deleted successfully');
      dispatch(fetchItemVariants());
      setDeleteItemDialog(false);
      setItemToDelete(null);
    } catch {
      toast.error('Failed to delete item');
    } finally {
      setDeletingItem(false);
    }
  };

  const handleOpenBarcodePrint = (item, stockBatch = null) => {
    if (!item?.barcode) { toast.warning('This item does not have a barcode'); return; }
    const selectedForPrint = {
      ...item,
      selling_price: stockBatch?.sell_price ?? stockBatch?.price ?? item.selling_price ?? item.price ?? 0,
      batch_reference: stockBatch?.id || null,
    };
    setSelectedItemForBarcode(selectedForPrint);
    setBarcodePrintQuantity(1);
    setBarcodePrintDialog(true);
  };

  const handlePrintBarcodeLabels = async () => {
    if (!selectedItemForBarcode) return;
    try {
      const result = await htmlPrintService.printBarcodeLabels(
        selectedItemForBarcode,
        barcodePrintQuantity,
        null,
        { previewBeforePrint: true }
      );
      if (result.success) { toast.success(result.message); setBarcodePrintDialog(false); }
      else toast.error(result.message || 'Failed to print barcode labels');
    } catch (e) { toast.error(`Print error: ${e.message}`); }
  };

  const InventoryOverview = () => (
    <Grid container spacing={3} mb={3}>
      <Grid item xs={12} md={4}>
        <Card>
          <CardContent>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography variant="h4" fontWeight="bold">{itemVariants.length}</Typography>
                <Typography variant="body2" color="text.secondary">Total Items</Typography>
              </Box>
              <InventoryIcon color="primary" sx={{ fontSize: 40 }} />
            </Box>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} md={4}>
        <Card sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' }, transition: 'all 0.2s' }} onClick={() => setLowStockDialog(true)}>
          <CardContent>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography variant="h4" fontWeight="bold" color="warning.main">{lowStockItems.length}</Typography>
                <Typography variant="body2" color="text.secondary">Low Stock (Click to View)</Typography>
              </Box>
              <WarningIcon color="warning" sx={{ fontSize: 40 }} />
            </Box>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} md={4}>
        <Card sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' }, transition: 'all 0.2s' }} onClick={() => setOutOfStockDialog(true)}>
          <CardContent>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography variant="h4" fontWeight="bold" color="error.main">{outOfStockItems.length}</Typography>
                <Typography variant="body2" color="text.secondary">Out of Stock (Click to View)</Typography>
              </Box>
              <TrendingDownIcon color="error" sx={{ fontSize: 40 }} />
            </Box>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );

  const CategoryManagement = () => (
    <Card>
      <CardContent>
        <Box display="flex" flexDirection="column" alignItems="flex-start" gap={2}>
          <Typography variant="h6" fontWeight="bold">Category Management</Typography>
          <CategoryManagementMenu categories={categories} />
        </Box>
      </CardContent>
    </Card>
  );



  return (
    <Box p={3}>
      <Typography variant="h4" fontWeight="bold" mb={3}>Inventory Management</Typography>

      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Tabs value={currentTab} onChange={handleTabChange}>
          <Tab label="Overview" />
          <Tab label="Categories" />
          <Tab label="Brands" />
          <Tab label="Variants" />
          <Tab label="ITEM" />
          <Tab label="Global Discount" />
        </Tabs>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddItem} sx={{ bgcolor: '#4CAF50', '&:hover': { bgcolor: '#388E3C' }, fontWeight: 'bold', px: 3 }}>
          Add New Final Selling Product
        </Button>
      </Box>

      {/* Overview Tab */}
      {currentTab === 0 && (
        <>
          <InventoryOverview />
          {/* Fix 1: paginated table component */}
          <InventoryItemsTable
            itemVariants={itemVariants}
            onRefresh={() => { dispatch(fetchItemVariants()); toast.success('Items refreshed'); }}
            onEditItem={handleEditItem}
            onAddStock={handleAddStockClick}
            onViewStockBatch={handleViewStockBatch}
            onDeleteItem={handleDeleteItem}
          />
        </>
      )}

      {currentTab === 1 && <CategoryManagement />}
      {currentTab === 2 && <BrandManagementMenu />}
      {currentTab === 3 && (
        <VariantManagementTab
          variants={variants}
          loadingVariants={loadingVariants}
          onAddVariant={handleAddVariant}
          onEditVariant={handleEditVariant}
          onDeleteVariant={handleDeleteVariant}
        />
      )}

      {/* Fix 2: ItemManagementTab has its own local search state */}
      {currentTab === 4 && (
        <ItemManagementTab
          categories={categories}
          itemVariants={itemVariants}
          loading={loading}
        />
      )}

      {currentTab === 5 && (
        <GlobalDiscountTab
          globalDiscountSettings={globalDiscountSettings}
          setGlobalDiscountSettings={setGlobalDiscountSettings}
          loadingGlobalDiscount={loadingGlobalDiscount}
          savingGlobalDiscount={savingGlobalDiscount}
          onSave={handleSaveGlobalDiscount}
        />
      )}

      {/* ── Dialogs ─────────────────────────────────────────────────────── */}

      {/* Add Final Selling Product */}
      <AddProductDialog
        open={addItemVariantDialog}
        onClose={handleCloseAddItemVariantDialog}
        itemVariants={itemVariants}
        variants={variants}
        onSave={handleSaveItemVariant}
        generateBarcode={generateRandomBarcode}
        onVariantCreated={handleVariantCreated}
      />

      {/* Add Stock */}
      <AddStockDialog
        open={addStockDialog}
        onClose={() => setAddStockDialog(false)}
        selectedItem={selectedItemForStock}
        newStockData={newStockData}
        setNewStockData={setNewStockData}
        onSave={handleSaveNewStock}
      />

      {/* Stock Batch Details */}
      <StockBatchDialog
        open={stockBatchDialog}
        onClose={() => setStockBatchDialog(false)}
        selectedItem={selectedItemForStockBatch}
        loadingStockBatch={loadingStockBatch}
        filteredStockData={filteredStockData}
        stockFilters={stockFilters}
        setStockFilters={setStockFilters}
        dateFilters={dateFilters}
        setDateFilters={setDateFilters}
        onEditStockBatch={handleEditStockBatch}
        onPrintStockBatchBarcode={(batch) => handleOpenBarcodePrint(selectedItemForStockBatch, batch)}
      />

      {/* Edit Stock Batch */}
      <EditStockBatchDialog
        open={editStockBatchDialog}
        onClose={() => setEditStockBatchDialog(false)}
        editingStockBatch={editingStockBatch}
        editStockBatchData={editStockBatchData}
        setEditStockBatchData={setEditStockBatchData}
        onSave={handleSaveStockBatchEdit}
        saving={savingStockBatch}
      />

      {/* Barcode Print */}
      <BarcodePrintDialog
        open={barcodePrintDialog}
        onClose={() => { setBarcodePrintDialog(false); setSelectedItemForBarcode(null); setBarcodePrintQuantity(1); }}
        selectedItem={selectedItemForBarcode}
        barcodePrintQuantity={barcodePrintQuantity}
        setBarcodePrintQuantity={setBarcodePrintQuantity}
        onPrint={handlePrintBarcodeLabels}
      />

      {/* Delete Item Confirmation */}
      <Dialog
        open={deleteItemDialog}
        onClose={() => {
          if (deletingItem) return;
          setDeleteItemDialog(false);
          setItemToDelete(null);
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Confirm Delete Item</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this item? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setDeleteItemDialog(false);
              setItemToDelete(null);
            }}
            disabled={deletingItem}
          >
            Cancel
          </Button>
          <Button
            onClick={confirmDeleteItem}
            color="error"
            variant="contained"
            disabled={deletingItem}
          >
            {deletingItem ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Item Dialog (from overview table) */}
      <Dialog open={editItemDialog} onClose={() => { setEditItemDialog(false); setSelectedItem(null); }} maxWidth="md" fullWidth>
        <DialogTitle>{selectedItem ? 'Edit Item' : 'Add New Item'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField fullWidth label="Item Name" value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} onBlur={() => setFieldTouched(prev => ({ ...prev, name: true }))} required error={fieldTouched.name && !newItem.name.trim()} helperText={fieldTouched.name && !newItem.name.trim() ? 'Item name is required' : ''} />
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom>Item Image</Typography>
              <Box display="flex" alignItems="center" gap={2}>
                <Box>
                  {newItem.imagePreview ? (
                    <Badge overlap="circular" anchorOrigin={{ vertical: 'top', horizontal: 'right' }} badgeContent={<Tooltip title="Remove image"><IconButton size="small" onClick={removeImage} sx={{ bgcolor: 'error.main', color: 'white', '&:hover': { bgcolor: 'error.dark' } }}><CloseIcon fontSize="small" /></IconButton></Tooltip>}>
                      <Avatar src={newItem.imagePreview} sx={{ width: 80, height: 80 }} />
                    </Badge>
                  ) : (
                    <Avatar sx={{ width: 80, height: 80, bgcolor: 'grey.200', fontSize: '2rem' }}>
                      {newItem.category ? <span>{newItem.category[0]}</span> : <ImageIcon />}
                    </Avatar>
                  )}
                </Box>
                <Box>
                  <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} ref={fileInputRef} />
                  <Button variant="outlined" startIcon={<PhotoCameraIcon />} onClick={() => fileInputRef.current?.click()}>Upload Image</Button>
                  <Typography variant="caption" display="block" color="text.secondary">Max 5MB.</Typography>
                </Box>
              </Box>
            </Grid>
            {!selectedItem && (
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth required error={fieldTouched.category && !newItem.category}>
                  <InputLabel>Category *</InputLabel>
                  <Select value={newItem.category} label="Category *" onChange={(e) => setNewItem({ ...newItem, category: e.target.value })} onBlur={() => setFieldTouched(prev => ({ ...prev, category: true }))}>
                    {categories.map((c) => <MenuItem key={c.id} value={c.name}>{c.name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
            )}
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth required error={fieldTouched.variant && !newItem.variant}>
                <InputLabel>Variant *</InputLabel>
                <Select value={newItem.variant} label="Variant *" onChange={(e) => setNewItem({ ...newItem, variant: e.target.value })} onBlur={() => setFieldTouched(prev => ({ ...prev, variant: true }))}>
                  {variants.map((v) => <MenuItem key={v.id} value={v.variant_name}>{v.variant_name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Barcode"
                value={newItem.barcode || ''}
                onChange={(e) => setNewItem({ ...newItem, barcode: e.target.value })}
                placeholder="Enter barcode"
                helperText="Leave empty to remove barcode"
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
                  value={newItem.isDiscountActive ? 'yes' : 'no'}
                  label="Discount Active"
                  onChange={(e) => setNewItem({ ...newItem, isDiscountActive: e.target.value === 'yes' })}
                >
                  <MenuItem value="no">No</MenuItem>
                  <MenuItem value="yes">Yes</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth disabled={!newItem.isDiscountActive}>
                <InputLabel>Discount Type</InputLabel>
                <Select
                  value={newItem.discountType || 'percentage'}
                  label="Discount Type"
                  onChange={(e) => setNewItem({ ...newItem, discountType: e.target.value })}
                >
                  <MenuItem value="fixed">Fixed (Rs.)</MenuItem>
                  <MenuItem value="percentage">Percentage (%)</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label={newItem.discountType === 'percentage' ? 'Discount (%)' : 'Discount (Rs.)'}
                type="number"
                value={newItem.discountValue || ''}
                onChange={(e) => setNewItem({ ...newItem, discountValue: e.target.value })}
                disabled={!newItem.isDiscountActive}
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>
            <Grid item xs={12}>
              <Alert severity="info">
                Selling price is now handled per stock batch. Use "View Stock Details" to update batch selling prices.
              </Alert>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setEditItemDialog(false); setSelectedItem(null); setFieldTouched({ name: false, category: false, variant: false }); }}>Cancel</Button>
          <Button onClick={handleSaveItem} variant="contained" disabled={savingItem} startIcon={savingItem && <CircularProgress size={20} />}>
            {savingItem ? 'Saving...' : (selectedItem ? 'Update' : 'Add')} Item
          </Button>
        </DialogActions>
      </Dialog>

      {/* Variant Dialog */}
      <Dialog open={variantDialog} onClose={handleCloseVariantDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{selectedVariantEdit ? 'Edit Variant' : 'Add New Variant'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField fullWidth label="Variant Name" value={newVariant.variant_name} onChange={(e) => setNewVariant({ ...newVariant, variant_name: e.target.value })} placeholder="e.g., 10ml, 50ml, 100ml, Red, Vanilla, Rose, Large, Small" autoFocus />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseVariantDialog}>Cancel</Button>
          <Button onClick={handleSaveVariant} variant="contained" startIcon={<SaveIcon />} disabled={loadingVariants}>{loadingVariants ? 'Saving...' : 'Save'}</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Variant Confirmation */}
      <Dialog open={deleteVariantConfirmDialog} onClose={() => setDeleteVariantConfirmDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Confirm Delete Variant</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this variant? This action cannot be undone and may affect existing items.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteVariantConfirmDialog(false)}>Cancel</Button>
          <Button onClick={confirmDeleteVariant} variant="contained" color="error" disabled={loadingVariants}>{loadingVariants ? 'Deleting...' : 'Delete'}</Button>
        </DialogActions>
      </Dialog>

      {/* Low Stock Dialog */}
      <Dialog open={lowStockDialog} onClose={() => setLowStockDialog(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}><WarningIcon color="warning" />Low Stock Items ({lowStockItems.length})</Box>
        </DialogTitle>
        <DialogContent>
          {lowStockItems.length === 0 ? (
            <Box textAlign="center" py={4}><Typography variant="body1" color="text.secondary">No low stock items found</Typography></Box>
          ) : (
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Item</TableCell><TableCell>Variant</TableCell><TableCell>Category</TableCell><TableCell>Barcode</TableCell><TableCell align="right">Current Stock</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {lowStockItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.item_name || item.name}</TableCell>
                      <TableCell>{item.variant_name || item.variant}</TableCell>
                      <TableCell>{item.category_name || item.category}</TableCell>
                      <TableCell>{item.barcode || '-'}</TableCell>
                      <TableCell align="right"><Chip label={item.total_stock || item.stock || 0} color="warning" size="small" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions><Button onClick={() => setLowStockDialog(false)}>Close</Button></DialogActions>
      </Dialog>

      {/* Out of Stock Dialog */}
      <Dialog open={outOfStockDialog} onClose={() => setOutOfStockDialog(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}><TrendingDownIcon color="error" />Out of Stock Items ({outOfStockItems.length})</Box>
        </DialogTitle>
        <DialogContent>
          {outOfStockItems.length === 0 ? (
            <Box textAlign="center" py={4}><Typography variant="body1" color="text.secondary">No out of stock items found</Typography></Box>
          ) : (
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Item</TableCell><TableCell>Variant</TableCell><TableCell>Category</TableCell><TableCell>Barcode</TableCell><TableCell align="right">Current Stock</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {outOfStockItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.item_name || item.name}</TableCell>
                      <TableCell>{item.variant_name || item.variant}</TableCell>
                      <TableCell>{item.category_name || item.category}</TableCell>
                      <TableCell>{item.barcode || '-'}</TableCell>
                      <TableCell align="right"><Chip label="0" color="error" size="small" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions><Button onClick={() => setOutOfStockDialog(false)}>Close</Button></DialogActions>
      </Dialog>
    </Box>
  );
};

export default Inventory;
