import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import imageCompression from 'browser-image-compression';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  CircularProgress,
  Avatar,
  Badge,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  Checkbox,
  FormControlLabel,
  FormHelperText,
  InputAdornment,
  Menu,
  TablePagination,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  PhotoCamera as PhotoCameraIcon,
  Image as ImageIcon,
  Close as CloseIcon,
  Refresh as RefreshIcon,
  ArrowDropDown as ArrowDropDownIcon,
  ChevronRight as ChevronRightIcon,
} from '@mui/icons-material';
import { useDispatch } from 'react-redux';
import { toast } from 'react-toastify';
import { fetchItemVariants } from '../../store/slices/inventorySlice';
import api from '../../services/api';

const getCategoryIcon = (categoryName) => {
  const iconMap = { Desserts: '🍰', Snacks: '🍿', Tobacco: '🚬', Other: '📦' };
  return iconMap[categoryName] || '📦';
};

const ItemManagementTab = ({ categories, itemVariants, loading }) => {
  const dispatch = useDispatch();

  // ── local search state (isolated from parent — prevents parent re-render on type) ──
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [savingItem, setSavingItem] = useState(false);
  const [brands, setBrands] = useState([]);
  const [itemFormData, setItemFormData] = useState({
    name: '',
    category_id: '',
    category_name: '',
    brand_id: '',
    gender: 'UNISEX',
    is_qty_managed: true,
    image: null,
    imagePreview: null,
  });
  const [formFieldTouched, setFormFieldTouched] = useState({ name: false, category: false });
  const itemFileInputRef = useRef(null);

  // Category menu states
  const [categoryAnchorEl, setCategoryAnchorEl] = useState(null);
  const [level1Anchor, setLevel1Anchor] = useState(null);
  const [level1Category, setLevel1Category] = useState(null);
  const [level2Anchor, setLevel2Anchor] = useState(null);
  const [level2Category, setLevel2Category] = useState(null);
  const [activePath, setActivePath] = useState([]);

  useEffect(() => {
    api.brands.getAll().then(setBrands).catch(console.error);
  }, []);

  // O(n) deduplication — Fix 4
  const filteredUniqueItems = useMemo(() => {
    const lower = searchTerm.toLowerCase();
    const filtered = searchTerm
      ? itemVariants.filter(item => {
          const itemName = (item.item_name || item.name || '').toLowerCase();
          const categoryName = (item.category_name || item.category || '').toLowerCase();
          const variantName = (item.variant_name || item.variant || '').toLowerCase();
          return itemName.includes(lower) || categoryName.includes(lower) || variantName.includes(lower);
        })
      : itemVariants;

    const seen = new Set();
    return filtered.filter(item => {
      const id = item.item_id_ref || item.id;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [itemVariants, searchTerm]);

  const paginatedItems = useMemo(
    () => filteredUniqueItems.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [filteredUniqueItems, page, rowsPerPage]
  );

  const closeCategoryMenus = useCallback(() => {
    setCategoryAnchorEl(null);
    setLevel1Anchor(null);
    setLevel1Category(null);
    setLevel2Anchor(null);
    setLevel2Category(null);
    setActivePath([]);
  }, []);

  const handleCategorySelect = useCallback((category) => {
    setItemFormData(prev => ({ ...prev, category_id: category.id, category_name: category.name }));
    closeCategoryMenus();
  }, [closeCategoryMenus]);

  const openLevel1 = useCallback((event, category) => {
    setLevel2Anchor(null);
    setLevel2Category(null);
    setLevel1Anchor(event.currentTarget);
    setLevel1Category(category);
    setActivePath([category.id]);
  }, []);

  const openLevel2 = useCallback((event, category) => {
    setLevel2Anchor(event.currentTarget);
    setLevel2Category(category);
    setActivePath(prev => [prev[0], category.id]);
  }, []);

  const isInActivePath = (id) => activePath.includes(id);

  const resetForm = () => {
    setItemFormData({ name: '', category_id: '', category_name: '', brand_id: '', gender: 'UNISEX', is_qty_managed: true, image: null, imagePreview: null });
    setFormFieldTouched({ name: false, category: false });
    closeCategoryMenus();
  };

  const handleAddNewItem = () => { setEditingItem(null); resetForm(); setDialogOpen(true); };

  const handleEditItemInline = async (item) => {
    setEditingItem(item);
    setItemFormData({
      name: item.item_name || item.name || '',
      category_id: item.category_id || '',
      category_name: item.category_name || item.category || '',
      brand_id: item.brand_id || '',
      gender: item.gender || 'UNISEX',
      is_qty_managed: item.is_qty_managed !== undefined ? !!item.is_qty_managed : true,
      image: null,
      imagePreview: null,
    });
    setFormFieldTouched({ name: false, category: false });
    setDialogOpen(true);
    // Fetch image lazily (not included in bulk list to keep payload small)
    try {
      const itemId = item.item_id_ref || item.id;
      const fullItem = await api.items.getById(itemId);
      if (fullItem) {
        setItemFormData(prev => ({
          ...prev,
          imagePreview: fullItem.image || prev.imagePreview,
          is_qty_managed: fullItem.is_qty_managed !== undefined ? !!fullItem.is_qty_managed : prev.is_qty_managed
        }));
      }
    } catch { /* image just won't prefill — user can re-upload */ }
  };

  const handleCloseDialog = () => { setDialogOpen(false); setEditingItem(null); resetForm(); };

  const handleImageUploadInline = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please select a valid image file'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Image size should be less than 5MB'); return; }
    try {
      const compressed = await imageCompression(file, { maxSizeMB: 1, maxWidthOrHeight: 1920, quality: 0.85, useWebWorker: true });
      const reader = new FileReader();
      reader.onload = (e) => setItemFormData(prev => ({ ...prev, image: compressed, imagePreview: e.target.result }));
      reader.readAsDataURL(compressed);
    } catch { toast.error('Failed to compress image'); }
  };

  const removeImageInline = () => {
    setItemFormData(prev => ({ ...prev, image: null, imagePreview: null }));
    if (itemFileInputRef.current) itemFileInputRef.current.value = '';
  };

  const handleSaveItemInline = async () => {
    if (!itemFormData.name.trim()) {
      toast.error('Item name is required.');
      setFormFieldTouched(prev => ({ ...prev, name: true }));
      return;
    }
    if (!itemFormData.category_id) {
      toast.error('Category selection is required.');
      setFormFieldTouched(prev => ({ ...prev, category: true }));
      return;
    }
    setSavingItem(true);
    try {
      const itemData = {
        name: itemFormData.name,
        category_id: itemFormData.category_id,
        brand_id: itemFormData.brand_id || null,
        gender: itemFormData.gender,
        is_qty_managed: itemFormData.is_qty_managed ? 1 : 0,
        image: itemFormData.imagePreview,
      };
      if (editingItem) {
        const itemId = editingItem.item_id_ref || editingItem.id;
        if (!itemId) throw new Error('Item ID not found');
        await api.items.update(itemId, itemData);
        toast.success('Item updated successfully');
      } else {
        await api.items.create(itemData);
        toast.success('Item added successfully');
      }
      dispatch(fetchItemVariants());
      handleCloseDialog();
    } catch (error) {
      toast.error('Error saving item: ' + error.message);
    } finally {
      setSavingItem(false);
    }
  };

  const handleDeleteItemInline = async (item) => {
    if (!window.confirm('Are you sure you want to delete this item?')) return;
    try {
      const itemId = item.item_id_ref || item.id;
      await api.items.delete(itemId);
      toast.success('Item deleted successfully');
      dispatch(fetchItemVariants());
    } catch (error) {
      toast.error('Failed to delete item: ' + error.message);
    }
  };

  return (
    <>
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
            <Typography variant="h6" fontWeight="bold">Item Management</Typography>
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddNewItem}>
              Add New Item
            </Button>
          </Box>

          <Box display="flex" gap={2} mb={3}>
            <TextField
              fullWidth
              placeholder="Search items by name or category..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
              size="small"
            />
            <Tooltip title="Refresh items">
              <IconButton
                onClick={() => { dispatch(fetchItemVariants()); toast.success('Items refreshed'); }}
                color="primary"
                sx={{ border: '1px solid', borderColor: 'primary.main', borderRadius: 1 }}
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>

          {loading ? (
            <Box display="flex" justifyContent="center" p={3}><CircularProgress /></Box>
          ) : filteredUniqueItems.length === 0 ? (
            <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" p={5}>
              <Typography variant="body1" color="text.secondary">
                {searchTerm ? 'No items found matching your search' : 'No items available'}
              </Typography>
            </Box>
          ) : (
            <>
              <List>
                {paginatedItems.map((item) => (
                  <React.Fragment key={item.item_id_ref || item.id}>
                    <ListItem>
                      <Box display="flex" alignItems="center" gap={2} sx={{ flexGrow: 1 }}>
                        <Avatar src={item.image} sx={{ width: 50, height: 50 }}>
                          {getCategoryIcon(item.category_name || item.category)}
                        </Avatar>
                        <ListItemText
                          primary={<Typography variant="body1" fontWeight="bold">{item.item_name || item.name}</Typography>}
                          secondary={
                            <Box display="flex" gap={1} alignItems="center" flexWrap="wrap">
                              <Chip label={item.category_name || item.category} size="small" />
                              {item.brand_name && <Chip label={item.brand_name} size="small" variant="outlined" color="primary" />}
                              {(item.is_qty_managed === 0 || item.is_qty_managed === false) && (
                                <Chip label="Qty Not Managed" size="small" color="warning" variant="outlined" />
                              )}
                            </Box>
                          }
                        />
                      </Box>
                      <ListItemSecondaryAction>
                        <IconButton edge="end" onClick={() => handleEditItemInline(item)}>
                          <EditIcon />
                        </IconButton>
                        <IconButton edge="end" onClick={() => handleDeleteItemInline(item)} color="error">
                          <DeleteIcon />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                    <Divider />
                  </React.Fragment>
                ))}
              </List>
              <TablePagination
                component="div"
                count={filteredUniqueItems.length}
                page={page}
                onPageChange={(_, newPage) => setPage(newPage)}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
                rowsPerPageOptions={[10, 25, 50]}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Item Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingItem ? 'Edit Item' : 'Add New Item'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 1 }}>
            <TextField
              fullWidth
              label="Item Name"
              value={itemFormData.name}
              onChange={(e) => setItemFormData({ ...itemFormData, name: e.target.value })}
              onBlur={() => setFormFieldTouched(prev => ({ ...prev, name: true }))}
              required
              error={formFieldTouched.name && !itemFormData.name.trim()}
              helperText={formFieldTouched.name && !itemFormData.name.trim() ? 'Item name is required' : ''}
              autoFocus
            />

            {/* Category */}
            <Box>
              <FormControl fullWidth required error={formFieldTouched.category && !itemFormData.category_id}>
                <InputLabel>Category *</InputLabel>
                <Select
                  value={itemFormData.category_id || ''}
                  label="Category *"
                  open={false}
                  onClick={(e) => setCategoryAnchorEl(e.currentTarget)}
                  onBlur={() => setFormFieldTouched(prev => ({ ...prev, category: true }))}
                  renderValue={() => itemFormData.category_name || ''}
                  IconComponent={ArrowDropDownIcon}
                  sx={{ cursor: 'pointer' }}
                >
                  <MenuItem value="">Select Category</MenuItem>
                </Select>
                {formFieldTouched.category && !itemFormData.category_id && (
                  <FormHelperText>Category selection is required</FormHelperText>
                )}
              </FormControl>

              <Menu anchorEl={categoryAnchorEl} open={Boolean(categoryAnchorEl)} onClose={closeCategoryMenus} sx={{ '& .MuiPaper-root': { minWidth: 220, maxHeight: 400 } }}>
                {categories.map((category) => {
                  const hasSubs = category.subcategories?.length > 0;
                  const isActive = isInActivePath(category.id);
                  return (
                    <MenuItem
                      key={category.id}
                      onClick={(e) => hasSubs ? openLevel1(e, category) : handleCategorySelect(category)}
                      onMouseEnter={(e) => hasSubs && openLevel1(e, category)}
                      selected={itemFormData.category_id === category.id}
                      sx={{ backgroundColor: isActive ? '#e3f2fd' : 'transparent', color: isActive ? 'primary.main' : 'inherit', fontWeight: isActive ? 600 : 400 }}
                    >
                      <Box display="flex" alignItems="center" gap={1} sx={{ flexGrow: 1 }}>
                        <span>{getCategoryIcon(category.name)}</span>{category.name}
                      </Box>
                      {hasSubs && <ChevronRightIcon sx={{ color: isActive ? 'primary.main' : 'inherit' }} />}
                    </MenuItem>
                  );
                })}
              </Menu>

              <Menu anchorEl={level1Anchor} open={Boolean(level1Anchor)} onClose={() => {}} anchorOrigin={{ vertical: 'top', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'left' }} hideBackdrop disableAutoFocus disableEnforceFocus sx={{ pointerEvents: 'none', '& .MuiPaper-root': { pointerEvents: 'auto', minWidth: 220, maxHeight: 400 } }}>
                {level1Category?.subcategories?.map((subcat) => {
                  const hasDeepSubs = subcat.subcategories?.length > 0;
                  const isActive = isInActivePath(subcat.id);
                  return (
                    <MenuItem
                      key={subcat.id}
                      onClick={(e) => hasDeepSubs ? openLevel2(e, subcat) : handleCategorySelect(subcat)}
                      onMouseEnter={(e) => hasDeepSubs && openLevel2(e, subcat)}
                      selected={itemFormData.category_id === subcat.id}
                      sx={{ backgroundColor: isActive ? '#e3f2fd' : 'transparent', color: isActive ? 'primary.main' : 'inherit' }}
                    >
                      <Box display="flex" alignItems="center" gap={1} sx={{ flexGrow: 1 }}>{subcat.name}</Box>
                      {hasDeepSubs && <ChevronRightIcon sx={{ color: isActive ? 'primary.main' : 'inherit' }} />}
                    </MenuItem>
                  );
                })}
              </Menu>

              <Menu anchorEl={level2Anchor} open={Boolean(level2Anchor)} onClose={() => {}} anchorOrigin={{ vertical: 'top', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'left' }} hideBackdrop disableAutoFocus disableEnforceFocus sx={{ pointerEvents: 'none', '& .MuiPaper-root': { pointerEvents: 'auto', minWidth: 200, maxHeight: 400 } }}>
                {level2Category?.subcategories?.map((deepSubcat) => (
                  <MenuItem key={deepSubcat.id} onClick={() => handleCategorySelect(deepSubcat)} selected={itemFormData.category_id === deepSubcat.id}>
                    {deepSubcat.name}
                  </MenuItem>
                ))}
              </Menu>
            </Box>

            {/* Brand */}
            <FormControl fullWidth>
              <InputLabel>Brand</InputLabel>
              <Select value={itemFormData.brand_id} label="Brand" onChange={(e) => setItemFormData({ ...itemFormData, brand_id: e.target.value })}>
                <MenuItem value=""><em>None</em></MenuItem>
                {brands.map((brand) => <MenuItem key={brand.id} value={brand.id}>{brand.brand_name}</MenuItem>)}
              </Select>
            </FormControl>

            {/* Quantity Management Option */}
            <FormControlLabel
              control={
                <Checkbox
                  checked={itemFormData.is_qty_managed}
                  onChange={(e) => setItemFormData({ ...itemFormData, is_qty_managed: e.target.checked })}
                  color="primary"
                />
              }
              label="Manage Quantity (Track stock & batches)"
            />



            {/* Image Upload */}
            <Box>
              <Typography variant="subtitle1" gutterBottom>Item Image</Typography>
              <Box display="flex" alignItems="center" gap={2}>
                <Box>
                  {itemFormData.imagePreview ? (
                    <Badge overlap="circular" anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
                      badgeContent={
                        <Tooltip title="Remove image">
                          <IconButton size="small" onClick={removeImageInline} sx={{ bgcolor: 'error.main', color: 'white', '&:hover': { bgcolor: 'error.dark' } }}>
                            <CloseIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      }
                    >
                      <Avatar src={itemFormData.imagePreview} sx={{ width: 80, height: 80 }} />
                    </Badge>
                  ) : (
                    <Avatar sx={{ width: 80, height: 80, bgcolor: 'grey.200', fontSize: '2rem' }}>
                      {itemFormData.category_name ? getCategoryIcon(itemFormData.category_name) : <ImageIcon />}
                    </Avatar>
                  )}
                </Box>
                <Box>
                  <input type="file" accept="image/*" onChange={handleImageUploadInline} style={{ display: 'none' }} ref={itemFileInputRef} />
                  <Button variant="outlined" startIcon={<PhotoCameraIcon />} onClick={() => itemFileInputRef.current?.click()}>
                    Upload Image
                  </Button>
                  <Typography variant="caption" display="block" color="text.secondary">
                    Max 5MB. If no image is uploaded, category icon will be used.
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSaveItemInline} variant="contained" disabled={savingItem} startIcon={savingItem && <CircularProgress size={20} />}>
            {savingItem ? 'Saving...' : (editingItem ? 'Update' : 'Add')} Item
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ItemManagementTab;
