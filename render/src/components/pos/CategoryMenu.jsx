import React, { useState, useCallback } from 'react';
import {
  Box,
  Button,
  Menu,
  MenuItem,
  ListItemText,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ChevronRight as ChevronRightIcon,
  Category as CategoryIcon,
} from '@mui/icons-material';

const CategoryMenu = ({ categories, selectedCategory, onCategorySelect, containerSx }) => {
  const [mainAnchorEl, setMainAnchorEl] = useState(null);
  
  // Track active path for highlighting parent categories
  const [activePath, setActivePath] = useState([]);
  
  // Level 1 submenu (main category -> subcategories)
  const [level1Anchor, setLevel1Anchor] = useState(null);
  const [level1Category, setLevel1Category] = useState(null);
  
  // Level 2 submenu (subcategory -> deep subcategories)
  const [level2Anchor, setLevel2Anchor] = useState(null);
  const [level2Category, setLevel2Category] = useState(null);

  const handleMainClick = (event) => {
    setMainAnchorEl(event.currentTarget);
  };

  const handleMainClose = () => {
    setMainAnchorEl(null);
    setLevel1Anchor(null);
    setLevel1Category(null);
    setLevel2Anchor(null);
    setLevel2Category(null);
    setActivePath([]);
  };

  const handleCategorySelect = (category) => {
    onCategorySelect(category);
    handleMainClose();
  };

  // Open level 1 submenu
  const openLevel1 = useCallback((event, category) => {
    // Close level 2 first
    setLevel2Anchor(null);
    setLevel2Category(null);
    
    setLevel1Anchor(event.currentTarget);
    setLevel1Category(category);
    setActivePath([category.id]);
  }, []);

  // Open level 2 submenu
  const openLevel2 = useCallback((event, category) => {
    setLevel2Anchor(event.currentTarget);
    setLevel2Category(category);
    setActivePath(prev => [prev[0], category.id]);
  }, []);

  const isInActivePath = (categoryId) => activePath.includes(categoryId);

  return (
    <Box sx={{ p: 2, borderBottom: '2px solid #f0f0f0', ...containerSx }}>
      <Button
        onClick={handleMainClick}
        variant="contained"
        endIcon={<ExpandMoreIcon />}
        startIcon={<CategoryIcon />}
        size="small"
        sx={{
          textTransform: 'uppercase',
          fontWeight: 700,
          fontSize: '0.78rem',
          px: 2.5,
          height: 32,
          borderRadius: 12,
          background: '#E53935',
          color: 'white',
          '&:hover': { background: '#C62828' },
        }}
      >
        Category
      </Button>

      {/* Main Menu */}
      <Menu
        anchorEl={mainAnchorEl}
        open={Boolean(mainAnchorEl)}
        onClose={handleMainClose}
        sx={{ '& .MuiPaper-root': { minWidth: 220, maxHeight: 500 } }}
      >
        <MenuItem
          onClick={() => handleCategorySelect(null)}
          selected={selectedCategory === null}
          sx={{ '&:hover': { backgroundColor: '#f5f5f5' } }}
        >
          <ListItemText primary="All Categories" />
        </MenuItem>
        
        {categories.map((category) => {
          const hasSubs = category.subcategories?.length > 0;
          const isActive = isInActivePath(category.id);
          
          return (
            <MenuItem
              key={category.id}
              onClick={(e) => hasSubs ? openLevel1(e, category) : handleCategorySelect(category)}
              onMouseEnter={(e) => hasSubs && openLevel1(e, category)}
              selected={selectedCategory === category.id}
              sx={{
                backgroundColor: isActive ? '#ffebee' : 'transparent',
                color: isActive ? '#E53935' : 'inherit',
                fontWeight: isActive ? 600 : 400,
                '&:hover': { backgroundColor: isActive ? '#ffcdd2' : '#f5f5f5' },
              }}
            >
              <ListItemText 
                primary={category.name}
                primaryTypographyProps={{ fontWeight: isActive ? 600 : 400 }}
              />
              {hasSubs && <ChevronRightIcon sx={{ ml: 2, color: isActive ? '#E53935' : 'inherit' }} />}
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
            minWidth: 250, 
            maxHeight: 500 
          },
        }}
      >
        {level1Category?.subcategories?.map((subcat) => {
          const hasDeepSubs = subcat.subcategories?.length > 0;
          const isActive = isInActivePath(subcat.id);
          
          return (
            <MenuItem
              key={subcat.id}
              onClick={(e) => hasDeepSubs ? openLevel2(e, subcat) : handleCategorySelect(subcat)}
              onMouseEnter={(e) => hasDeepSubs && openLevel2(e, subcat)}
              selected={selectedCategory === subcat.id}
              sx={{
                backgroundColor: isActive ? '#ffebee' : 'transparent',
                color: isActive ? '#E53935' : 'inherit',
                '&:hover': { backgroundColor: isActive ? '#ffcdd2' : '#f5f5f5' },
              }}
            >
              <ListItemText 
                primary={subcat.name}
                primaryTypographyProps={{ fontWeight: isActive ? 600 : 400 }}
              />
              {hasDeepSubs && <ChevronRightIcon sx={{ ml: 2, color: isActive ? '#E53935' : 'inherit' }} />}
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
            maxHeight: 500 
          },
        }}
      >
        {level2Category?.subcategories?.map((deepSubcat) => (
          <MenuItem
            key={deepSubcat.id}
            onClick={() => handleCategorySelect(deepSubcat)}
            selected={selectedCategory === deepSubcat.id}
            sx={{ '&:hover': { backgroundColor: '#f5f5f5' } }}
          >
            <ListItemText primary={deepSubcat.name} />
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
};

export default CategoryMenu;
