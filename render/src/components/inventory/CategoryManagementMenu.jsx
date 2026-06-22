import React, { useState, useCallback } from 'react';
import {
  Box,
  Button,
  Menu,
  MenuItem,
  ListItemText,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Typography,
  CircularProgress,
  Divider,
  FormControl,
  InputLabel,
  Select,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ChevronRight as ChevronRightIcon,
  Category as CategoryIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import { useDispatch } from 'react-redux';
import { toast } from 'react-toastify';
import { fetchCategories } from '../../store/slices/inventorySlice';
import api from '../../services/api';

const CategoryManagementMenu = ({ categories, containerSx }) => {
  const dispatch = useDispatch();
  const [mainAnchorEl, setMainAnchorEl] = useState(null);
  
  // Track active path for highlighting parent categories
  const [activePath, setActivePath] = useState([]);
  
  // Track hovered item to show action buttons
  const [hoveredItem, setHoveredItem] = useState(null);
  
  // Level 1 submenu (main category -> subcategories)
  const [level1Anchor, setLevel1Anchor] = useState(null);
  const [level1Category, setLevel1Category] = useState(null);
  
  // Level 2 submenu (subcategory -> deep subcategories)
  const [level2Anchor, setLevel2Anchor] = useState(null);
  const [level2Category, setLevel2Category] = useState(null);

  // Level 3 submenu (deep subcat -> deeper subcategories)
  const [level3Anchor, setLevel3Anchor] = useState(null);
  const [level3Category, setLevel3Category] = useState(null);

  // Dialog states
  const [categoryDialog, setCategoryDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryFormData, setCategoryFormData] = useState({ name: '', parent_id: null });
  const [loadingCategory, setLoadingCategory] = useState(false);

  // Delete confirmation
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState(null);

  const handleMainClick = (event) => {
    setMainAnchorEl(event.currentTarget);
  };

  const handleMainClose = () => {
    setMainAnchorEl(null);
    setLevel1Anchor(null);
    setLevel1Category(null);
    setLevel2Anchor(null);
    setLevel2Category(null);
    setLevel3Anchor(null);
    setLevel3Category(null);
    setActivePath([]);
    setHoveredItem(null);
  };

  // Open level 1 submenu
  const openLevel1 = useCallback((event, category) => {
    // Close deeper levels
    setLevel2Anchor(null);
    setLevel2Category(null);
    setLevel3Anchor(null);
    setLevel3Category(null);
    
    setLevel1Anchor(event.currentTarget);
    setLevel1Category(category);
    setActivePath([category.id]);
  }, []);

  // Open level 2 submenu
  const openLevel2 = useCallback((event, category) => {
    // Close deeper levels
    setLevel3Anchor(null);
    setLevel3Category(null);

    setLevel2Anchor(event.currentTarget);
    setLevel2Category(category);
    setActivePath(prev => [prev[0], category.id]);
  }, []);

  // Open level 3 submenu
  const openLevel3 = useCallback((event, category) => {
    setLevel3Anchor(event.currentTarget);
    setLevel3Category(category);
    setActivePath(prev => [prev[0], prev[1], category.id]);
  }, []);

  const isInActivePath = (categoryId) => activePath.includes(categoryId);

  // Add new category (top level or subcategory)
  const handleAddCategory = (parentId = null, parentCategory = null, e) => {
    if (e) e.stopPropagation();
    setEditingCategory(null);
    setCategoryFormData({ 
      name: '', 
      parent_id: parentId,
      parentName: parentCategory?.name || null
    });
    setCategoryDialog(true);
    handleMainClose();
  };

  // Edit category
  const handleEditCategory = (category, e) => {
    e.stopPropagation();
    setEditingCategory(category);
    setCategoryFormData({ 
      name: category.name, 
      parent_id: category.parent_id,
      parentName: null
    });
    setCategoryDialog(true);
    handleMainClose();
  };

  // Delete category
  const handleDeleteCategory = (category, e) => {
    e.stopPropagation();
    setCategoryToDelete(category);
    setDeleteDialog(true);
    handleMainClose();
  };

  const handleCloseCategoryDialog = () => {
    setCategoryDialog(false);
    setEditingCategory(null);
    setCategoryFormData({ name: '', parent_id: null });
  };

  const handleSaveCategory = async () => {
    if (!categoryFormData.name.trim()) {
      toast.error('Category name is required');
      return;
    }

    setLoadingCategory(true);
    try {
      const data = {
        name: categoryFormData.name.trim(),
        parent_id: categoryFormData.parent_id
      };

      if (editingCategory) {
        await api.categories.update(editingCategory.id, data);
        toast.success('Category updated successfully');
      } else {
        await api.categories.create(data);
        toast.success('Category added successfully');
      }
      dispatch(fetchCategories());
      handleCloseCategoryDialog();
    } catch (error) {
      toast.error(`Error: ${error.message || 'Failed to save category'}`);
    } finally {
      setLoadingCategory(false);
    }
  };

  const confirmDeleteCategory = async () => {
    if (!categoryToDelete) return;

    setLoadingCategory(true);
    try {
      await api.categories.delete(categoryToDelete.id);
      toast.success('Category deleted successfully');
      dispatch(fetchCategories());
      setDeleteDialog(false);
      setCategoryToDelete(null);
    } catch (error) {
      toast.error(`Error: ${error.message || 'Failed to delete category'}`);
    } finally {
      setLoadingCategory(false);
    }
  };

  // Flatten categories for parent selection
  const getFlatCategories = (cats, level = 0, result = []) => {
    cats.forEach(cat => {
      result.push({ ...cat, level });
      if (cat.subcategories?.length > 0) {
        getFlatCategories(cat.subcategories, level + 1, result);
      }
    });
    return result;
  };

  const flatCategories = getFlatCategories(categories);

  // Action buttons that appear on hover
  const ActionButtons = ({ category, parentCategory }) => (
    <Box 
      sx={{ 
        display: 'flex', 
        gap: 0.25, 
        ml: 1,
        opacity: hoveredItem === category.id ? 1 : 0,
        transition: 'opacity 0.15s ease',
      }}
    >
      <IconButton 
        size="small" 
        onClick={(e) => handleAddCategory(category.id, category, e)}
        sx={{ 
          p: 0.4,
          color: '#4caf50',
          '&:hover': { backgroundColor: '#e8f5e9' }
        }}
        title="Add Subcategory"
      >
        <AddIcon sx={{ fontSize: 18 }} />
      </IconButton>
      <IconButton 
        size="small" 
        onClick={(e) => handleEditCategory(category, e)}
        sx={{ 
          p: 0.4,
          color: '#2196f3',
          '&:hover': { backgroundColor: '#e3f2fd' }
        }}
        title="Edit"
      >
        <EditIcon sx={{ fontSize: 18 }} />
      </IconButton>
      <IconButton 
        size="small" 
        onClick={(e) => handleDeleteCategory(category, e)}
        sx={{ 
          p: 0.4,
          color: '#f44336',
          '&:hover': { backgroundColor: '#ffebee' }
        }}
        title="Delete"
      >
        <DeleteIcon sx={{ fontSize: 18 }} />
      </IconButton>
    </Box>
  );

  return (
    <Box sx={{ ...containerSx }}>
      <Button
        onClick={handleMainClick}
        variant="contained"
        endIcon={<ExpandMoreIcon />}
        startIcon={<CategoryIcon />}
        sx={{
          textTransform: 'none',
          fontWeight: 600,
          fontSize: '0.875rem',
          px: 3,
          py: 1,
          borderRadius: 2,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
          '&:hover': { 
            background: 'linear-gradient(135deg, #5a6fd6 0%, #6a4190 100%)',
            boxShadow: '0 6px 20px rgba(102, 126, 234, 0.5)',
          },
        }}
      >
        Manage Categories
      </Button>

      {/* Main Menu */}
      <Menu
        anchorEl={mainAnchorEl}
        open={Boolean(mainAnchorEl)}
        onClose={handleMainClose}
        sx={{ '& .MuiPaper-root': { minWidth: 240, maxHeight: 500, borderRadius: 2, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' } }}
      >
        {/* Add New Main Category - Top with + icon */}
        <Box 
          sx={{ 
            px: 2, 
            py: 1.5, 
            borderBottom: '1px solid #e0e0e0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#fafafa'
          }}
        >
          <Typography variant="subtitle2" color="text.secondary" fontWeight={600}>
            Categories
          </Typography>
          <IconButton 
            size="small" 
            onClick={(e) => handleAddCategory(null, null, e)}
            sx={{ 
              p: 0.5,
              color: 'white',
              backgroundColor: '#4caf50',
              '&:hover': { backgroundColor: '#43a047' }
            }}
            title="Add New Category"
          >
            <AddIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>
        
        {categories.map((category) => {
          const hasSubs = category.subcategories?.length > 0;
          const isActive = isInActivePath(category.id);
          
          return (
            <MenuItem
              key={category.id}
              onMouseEnter={(e) => {
                setHoveredItem(category.id);
                if (hasSubs) openLevel1(e, category);
              }}
              onMouseLeave={() => setHoveredItem(null)}
              sx={{
                backgroundColor: isActive ? '#ffebee' : 'transparent',
                color: isActive ? '#E53935' : 'inherit',
                fontWeight: isActive ? 600 : 400,
                py: 1,
                '&:hover': { backgroundColor: isActive ? '#ffcdd2' : '#f5f5f5' },
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
                <ListItemText 
                  primary={category.name}
                  primaryTypographyProps={{ 
                    fontWeight: isActive ? 600 : 400,
                    fontSize: '0.9rem',
                    textTransform: 'uppercase',
                  }}
                />
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <ActionButtons category={category} />
                {hasSubs && <ChevronRightIcon sx={{ color: isActive ? '#E53935' : '#999', ml: 0.5 }} />}
              </Box>
            </MenuItem>
          );
        })}
      </Menu>

      {/* Level 1 Submenu */}
      <Menu
        anchorEl={level1Anchor}
        open={Boolean(level1Anchor)}
        onClose={() => {}}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        hideBackdrop
        disableAutoFocus
        disableEnforceFocus
        sx={{
          pointerEvents: 'none',
          '& .MuiPaper-root': { 
            pointerEvents: 'auto',
            minWidth: 260, 
            maxHeight: 500,
            borderRadius: 2,
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)'
          },
        }}
      >
        {/* Add Subcategory - Top with + icon */}
        {level1Category && (
          <Box 
            sx={{ 
              px: 2, 
              py: 1.5, 
              borderBottom: '1px solid #e0e0e0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#fafafa'
            }}
          >
            <Typography variant="subtitle2" color="text.secondary" fontWeight={600} noWrap sx={{ maxWidth: 180 }}>
              {level1Category.name}
            </Typography>
            <IconButton 
              size="small" 
              onClick={(e) => handleAddCategory(level1Category.id, level1Category, e)}
              sx={{ 
                p: 0.5,
                color: 'white',
                backgroundColor: '#4caf50',
                '&:hover': { backgroundColor: '#43a047' }
              }}
              title="Add Subcategory"
            >
              <AddIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Box>
        )}

        {level1Category?.subcategories?.map((subcat) => {
          const hasDeepSubs = subcat.subcategories?.length > 0;
          const isActive = isInActivePath(subcat.id);
          
          return (
            <MenuItem
              key={subcat.id}
              onMouseEnter={(e) => {
                setHoveredItem(subcat.id);
                if (hasDeepSubs) openLevel2(e, subcat);
              }}
              onMouseLeave={() => setHoveredItem(null)}
              sx={{
                backgroundColor: isActive ? '#ffebee' : 'transparent',
                color: isActive ? '#E53935' : 'inherit',
                py: 1,
                '&:hover': { backgroundColor: isActive ? '#ffcdd2' : '#f5f5f5' },
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
                <ListItemText 
                  primary={subcat.name}
                  primaryTypographyProps={{ 
                    fontWeight: isActive ? 600 : 400,
                    fontSize: '0.875rem'
                  }}
                />
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <ActionButtons category={subcat} />
                {hasDeepSubs && <ChevronRightIcon sx={{ color: isActive ? '#E53935' : '#999', ml: 0.5 }} />}
              </Box>
            </MenuItem>
          );
        })}
      </Menu>

      {/* Level 2 Submenu */}
      <Menu
        anchorEl={level2Anchor}
        open={Boolean(level2Anchor)}
        onClose={() => {}}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        hideBackdrop
        disableAutoFocus
        disableEnforceFocus
        sx={{
          pointerEvents: 'none',
          '& .MuiPaper-root': { 
            pointerEvents: 'auto',
            minWidth: 220, 
            maxHeight: 500,
            borderRadius: 2,
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)'
          },
        }}
      >
        {/* Add Subcategory - Top with + icon */}
        {level2Category && (
          <Box 
            sx={{ 
              px: 2, 
              py: 1.5, 
              borderBottom: '1px solid #e0e0e0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#fafafa'
            }}
          >
            <Typography variant="subtitle2" color="text.secondary" fontWeight={600} noWrap sx={{ maxWidth: 150 }}>
              {level2Category.name}
            </Typography>
            <IconButton 
              size="small" 
              onClick={(e) => handleAddCategory(level2Category.id, level2Category, e)}
              sx={{ 
                p: 0.5,
                color: 'white',
                backgroundColor: '#4caf50',
                '&:hover': { backgroundColor: '#43a047' }
              }}
              title="Add Subcategory"
            >
              <AddIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Box>
        )}

        {level2Category?.subcategories?.map((deepSubcat) => {
          const hasMoreSubs = deepSubcat.subcategories?.length > 0;
          const isActive = isInActivePath(deepSubcat.id);

          return (
            <MenuItem
              key={deepSubcat.id}
              onMouseEnter={(e) => {
                setHoveredItem(deepSubcat.id);
                if (hasMoreSubs) openLevel3(e, deepSubcat);
              }}
              onMouseLeave={() => setHoveredItem(null)}
              sx={{ 
                py: 1,
                backgroundColor: isActive ? '#ffebee' : 'transparent',
                color: isActive ? '#E53935' : 'inherit',
                '&:hover': { backgroundColor: isActive ? '#ffcdd2' : '#f5f5f5' },
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
                <ListItemText 
                  primary={deepSubcat.name}
                  primaryTypographyProps={{ 
                    fontSize: '0.875rem',
                    fontWeight: isActive ? 600 : 400
                  }}
                />
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <ActionButtons category={deepSubcat} />
                {hasMoreSubs && <ChevronRightIcon sx={{ color: isActive ? '#E53935' : '#999', ml: 0.5 }} />}
              </Box>
            </MenuItem>
          );
        })}
      </Menu>

      {/* Level 3 Submenu */}
      <Menu
        anchorEl={level3Anchor}
        open={Boolean(level3Anchor)}
        onClose={() => {}}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        hideBackdrop
        disableAutoFocus
        disableEnforceFocus
        sx={{
          pointerEvents: 'none',
          '& .MuiPaper-root': { 
            pointerEvents: 'auto',
            minWidth: 200, 
            maxHeight: 500,
            borderRadius: 2,
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)'
          },
        }}
      >
        {/* Add Subcategory - Top with + icon */}
        {level3Category && (
          <Box 
            sx={{ 
              px: 2, 
              py: 1.5, 
              borderBottom: '1px solid #e0e0e0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#fafafa'
            }}
          >
            <Typography variant="subtitle2" color="text.secondary" fontWeight={600} noWrap sx={{ maxWidth: 130 }}>
              {level3Category.name}
            </Typography>
            <IconButton 
              size="small" 
              onClick={(e) => handleAddCategory(level3Category.id, level3Category, e)}
              sx={{ 
                p: 0.5,
                color: 'white',
                backgroundColor: '#4caf50',
                '&:hover': { backgroundColor: '#43a047' }
              }}
              title="Add Subcategory"
            >
              <AddIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Box>
        )}

        {level3Category?.subcategories?.map((deeperSubcat) => (
          <MenuItem
            key={deeperSubcat.id}
            onMouseEnter={() => setHoveredItem(deeperSubcat.id)}
            onMouseLeave={() => setHoveredItem(null)}
            sx={{ 
              py: 1,
              '&:hover': { backgroundColor: '#f5f5f5' },
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <ListItemText 
              primary={deeperSubcat.name}
              primaryTypographyProps={{ fontSize: '0.875rem' }}
            />
            <ActionButtons category={deeperSubcat} />
          </MenuItem>
        ))}
      </Menu>

      {/* Add/Edit Category Dialog */}
      <Dialog open={categoryDialog} onClose={handleCloseCategoryDialog} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white'
        }}>
          {editingCategory ? 'Edit Category' : 'Add New Category'}
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 1 }}>
            <TextField
              fullWidth
              label="Category Name"
              value={categoryFormData.name}
              onChange={(e) => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
              autoFocus
              required
              placeholder="Enter category name"
            />
            
            {categoryFormData.parentName && !editingCategory && (
              <Typography variant="body2" color="text.secondary">
                This will be added as a subcategory of: <strong>{categoryFormData.parentName}</strong>
              </Typography>
            )}

            {editingCategory && (
              <FormControl fullWidth>
                <InputLabel>Parent Category (Optional)</InputLabel>
                <Select
                  value={categoryFormData.parent_id || ''}
                  label="Parent Category (Optional)"
                  onChange={(e) => setCategoryFormData({ 
                    ...categoryFormData, 
                    parent_id: e.target.value || null 
                  })}
                >
                  <MenuItem value="">
                    <em>None (Main Category)</em>
                  </MenuItem>
                  {flatCategories
                    .filter(cat => cat.id !== editingCategory?.id)
                    .map(cat => (
                      <MenuItem 
                        key={cat.id} 
                        value={cat.id}
                        sx={{ pl: 2 + cat.level * 2 }}
                      >
                        {'—'.repeat(cat.level)} {cat.name}
                      </MenuItem>
                    ))
                  }
                </Select>
              </FormControl>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={handleCloseCategoryDialog} disabled={loadingCategory}>
            Cancel
          </Button>
          <Button
            onClick={handleSaveCategory}
            variant="contained"
            startIcon={loadingCategory ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
            disabled={loadingCategory || !categoryFormData.name.trim()}
            sx={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              '&:hover': { background: 'linear-gradient(135deg, #5a6fd6 0%, #6a4190 100%)' },
            }}
          >
            {loadingCategory ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialog}
        onClose={() => !loadingCategory && setDeleteDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ color: '#f44336' }}>
          Confirm Delete Category
        </DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete <strong>"{categoryToDelete?.name}"</strong>?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            This action cannot be undone. Categories with items cannot be deleted.
          </Typography>
          {categoryToDelete?.subcategories?.length > 0 && (
            <Typography variant="body2" color="warning.main" sx={{ mt: 1 }}>
              ⚠️ This category has {categoryToDelete.subcategories.length} subcategories. 
              Please delete or move them first.
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button 
            onClick={() => setDeleteDialog(false)} 
            disabled={loadingCategory}
          >
            Cancel
          </Button>
          <Button
            onClick={confirmDeleteCategory}
            variant="contained"
            color="error"
            disabled={loadingCategory}
            startIcon={loadingCategory && <CircularProgress size={20} color="inherit" />}
          >
            {loadingCategory ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CategoryManagementMenu;
