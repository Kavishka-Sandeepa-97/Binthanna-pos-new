import React, { useState, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Card,
  CardContent,
  Chip,
  Alert,
  Divider,
  Grid,
} from '@mui/material';
import {
  Add as AddIcon,
  Remove as RemoveIcon,
  PhotoCamera as PhotoCameraIcon,
  Close as CloseIcon,
  LocalOffer as LocalOfferIcon,
} from '@mui/icons-material';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import api from '../../services/api';

const AddItemWithVariants = ({ open, onClose, categories, variants }) => {
  const dispatch = useDispatch();
  const [itemData, setItemData] = useState({
    name: '',
    category: '',
    description: '',
    image: null,
    imagePreview: null,
  });
  
  const [variantsList, setVariantsList] = useState([
    {
      id: Date.now(),
      variantName: '',
      barcode: '',
      sellingPrice: '',
      buyingPrice: '',
      initialQuantity: '',
      description: '',
      expiryDate: '',
      isDiscountActive: false,
      discountType: 'percentage',
      discountValue: '',
    }
  ]);
  
  const [loading, setLoading] = useState(false);
  const [existingVariants, setExistingVariants] = useState([]);
  const [loadingVariants, setLoadingVariants] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchExistingVariants();
  }, []);

  const fetchExistingVariants = async () => {
    setLoadingVariants(true);
    try {
      const response = await api.variants.getAll();
      setExistingVariants(response);
    } catch (error) {
      console.error('Error fetching variants:', error);
      toast.error('Error loading variants');
    } finally {
      setLoadingVariants(false);
    }
  };

  const handleAddVariant = () => {
    setVariantsList([...variantsList, {
      id: Date.now(),
      variantName: '',
      barcode: '',
      sellingPrice: '',
      buyingPrice: '',
      initialQuantity: '',
      description: '',
      expiryDate: '',
      isDiscountActive: false,
      discountType: 'percentage',
      discountValue: '',
    }]);
  };

  const handleRemoveVariant = (id) => {
    if (variantsList.length > 1) {
      setVariantsList(variantsList.filter(v => v.id !== id));
    }
  };

  const handleVariantChange = (id, field, value) => {
    setVariantsList(variantsList.map(variant => 
      variant.id === id ? { ...variant, [field]: value } : variant
    ));
  };

  const handleItemDataChange = (field, value) => {
    setItemData({ ...itemData, [field]: value });
  };

  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setItemData({
        ...itemData,
        image: file,
        imagePreview: URL.createObjectURL(file),
      });
    }
  };

  const validateForm = () => {
    if (!itemData.name.trim()) {
      toast.error('Item name is required');
      return false;
    }
    
    if (!itemData.category) {
      toast.error('Category is required');
      return false;
    }

    for (let i = 0; i < variantsList.length; i++) {
      const variant = variantsList[i];
      if (!variant.variantName.trim()) {
        toast.error(`Variant name is required for variant ${i + 1}`);
        return false;
      }
      if (!variant.sellingPrice || parseFloat(variant.sellingPrice) <= 0) {
        toast.error(`Valid selling price is required for variant ${i + 1}`);
        return false;
      }
      if (parseFloat(variant.initialQuantity) < 0) {
        toast.error(`Initial quantity cannot be negative for variant ${i + 1}`);
        return false;
      }
    }

    return true;
  };

  const handleSaveItem = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('name', itemData.name);
      formData.append('category', itemData.category);

      if (itemData.image) {
        formData.append('image', itemData.image);
      }

      const variantsData = variantsList.map(variant => ({
        variantName: variant.variantName,
        barcode: variant.barcode || '',
        sellingPrice: parseFloat(variant.sellingPrice),
        buyingPrice: parseFloat(variant.buyingPrice) || 0,
        initialQuantity: parseInt(variant.initialQuantity) || 0,
        description: variant.description || '',
        expiryDate: variant.expiryDate || null,
        isDiscountActive: variant.isDiscountActive || false,
        discountType: variant.discountType || 'percentage',
        discountValue: parseFloat(variant.discountValue) || 0,
      }));

      formData.append('variants', JSON.stringify(variantsData));

      await api.items.createWithVariants(formData);
      toast.success('Item with variants created successfully!');
      onClose();
      // Reset form
      setItemData({
        name: '',
        category: '',
        image: null,
        imagePreview: null,
      });
      setVariantsList([{
        id: Date.now(),
        variantName: '',
        barcode: '',
        sellingPrice: '',
        buyingPrice: '',
        initialQuantity: '',
        description: '',
        expiryDate: '',
        isDiscountActive: false,
        discountType: 'percentage',
        discountValue: '',
      }]);
    } catch (error) {
      console.error('Error creating item:', error);
      toast.error('Error creating item');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Add Item with Multiple Variants</Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>Item Details</Typography>
          
          <TextField
            fullWidth
            label="Item Name"
            value={itemData.name}
            onChange={(e) => handleItemDataChange('name', e.target.value)}
            sx={{ mb: 2 }}
          />
          
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Category</InputLabel>
            <Select
              value={itemData.category}
              onChange={(e) => handleItemDataChange('category', e.target.value)}
            >
              {categories.map(cat => (
                <MenuItem key={cat.id} value={cat.name}>{cat.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          

          
          <Button
            variant="outlined"
            component="label"
            startIcon={<PhotoCameraIcon />}
          >
            Upload Image
            <input
              type="file"
              hidden
              accept="image/*"
              onChange={handleImageUpload}
              ref={fileInputRef}
            />
          </Button>
          
          {itemData.imagePreview && (
            <Box sx={{ mt: 2 }}>
              <img 
                src={itemData.imagePreview} 
                alt="Preview" 
                style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: 8 }}
              />
            </Box>
          )}
        </Box>

        <Divider sx={{ my: 2 }} />

        <Box>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">Item Variants</Typography>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={handleAddVariant}
              color="primary"
            >
              Add Variant
            </Button>
          </Box>

          {variantsList.map((variant, index) => (
            <Card key={variant.id} sx={{ mb: 2 }}>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="subtitle1">Item Variant {index + 1}</Typography>
                  <IconButton
                    onClick={() => handleRemoveVariant(variant.id)}
                    disabled={variantsList.length === 1}
                    color="error"
                  >
                    <RemoveIcon />
                  </IconButton>
                </Box>

                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Variant Name</InputLabel>
                      <Select
                        value={variant.variantName}
                        onChange={(e) => handleVariantChange(variant.id, 'variantName', e.target.value)}
                        label="Item Variant Name"
                        disabled={loadingVariants}
                      >
                        {existingVariants.map((v) => (
                          <MenuItem key={v.id} value={v.variant_name}>
                            {v.variant_name}
                          </MenuItem>
                        ))}
                        <MenuItem value="" disabled>
                          {loadingVariants ? 'Loading...' : 'Select a variant'}
                        </MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Barcode"
                      value={variant.barcode}
                      onChange={(e) => handleVariantChange(variant.id, 'barcode', e.target.value)}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      label="Selling Price"
                      type="number"
                      value={variant.sellingPrice}
                      onChange={(e) => handleVariantChange(variant.id, 'sellingPrice', e.target.value)}
                      size="small"
                      inputProps={{ min: 0, step: 0.01 }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      label="Buying Price"
                      type="number"
                      value={variant.buyingPrice}
                      onChange={(e) => handleVariantChange(variant.id, 'buyingPrice', e.target.value)}
                      size="small"
                      inputProps={{ min: 0, step: 0.01 }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      label="Initial Quantity"
                      type="number"
                      value={variant.initialQuantity}
                      onChange={(e) => handleVariantChange(variant.id, 'initialQuantity', e.target.value)}
                      size="small"
                      inputProps={{ min: 0 }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      label="Expiry Date"
                      type="date"
                      value={variant.expiryDate}
                      onChange={(e) => handleVariantChange(variant.id, 'expiryDate', e.target.value)}
                      size="small"
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={8}>
                    <TextField
                      fullWidth
                      label="Description"
                      value={variant.description}
                      onChange={(e) => handleVariantChange(variant.id, 'description', e.target.value)}
                      multiline
                      rows={2}
                      size="small"
                    />
                  </Grid>

                  {/* Discount Section */}
                  <Grid item xs={12}>
                    <Divider sx={{ my: 1 }} />
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      <LocalOfferIcon color="secondary" fontSize="small" />
                      <Typography variant="subtitle2" color="secondary">Discount Settings</Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Discount Active</InputLabel>
                      <Select
                        value={variant.isDiscountActive ? 'yes' : 'no'}
                        onChange={(e) => handleVariantChange(variant.id, 'isDiscountActive', e.target.value === 'yes')}
                        label="Discount Active"
                      >
                        <MenuItem value="no">No</MenuItem>
                        <MenuItem value="yes">Yes</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <FormControl fullWidth size="small" disabled={!variant.isDiscountActive}>
                      <InputLabel>Discount Type</InputLabel>
                      <Select
                        value={variant.discountType || 'percentage'}
                        onChange={(e) => handleVariantChange(variant.id, 'discountType', e.target.value)}
                        label="Discount Type"
                      >
                        <MenuItem value="fixed">Fixed (Rs.)</MenuItem>
                        <MenuItem value="percentage">Percentage (%)</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <TextField
                      fullWidth
                      label={variant.discountType === 'percentage' ? 'Discount (%)' : 'Discount (Rs.)'}
                      type="number"
                      value={variant.discountValue}
                      onChange={(e) => handleVariantChange(variant.id, 'discountValue', e.target.value)}
                      size="small"
                      disabled={!variant.isDiscountActive}
                      inputProps={{ min: 0, step: 0.01 }}
                    />
                  </Grid>
                  {variant.isDiscountActive && variant.sellingPrice && variant.discountValue ? (
                    <Grid item xs={12} sm={3}>
                      <Alert severity="info" sx={{ py: 0 }}>
                        Final: Rs. {variant.discountType === 'percentage'
                          ? (parseFloat(variant.sellingPrice) - (parseFloat(variant.sellingPrice) * parseFloat(variant.discountValue) / 100)).toFixed(2)
                          : (parseFloat(variant.sellingPrice) - parseFloat(variant.discountValue)).toFixed(2)
                        }
                      </Alert>
                    </Grid>
                  ) : null}
                </Grid>
              </CardContent>
            </Card>
          ))}
        </Box>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>Cancel</Button>
        <Button 
          onClick={handleSaveItem} 
          variant="contained" 
          disabled={loading}
        >
          {loading ? 'Saving...' : 'Save Item'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddItemWithVariants;