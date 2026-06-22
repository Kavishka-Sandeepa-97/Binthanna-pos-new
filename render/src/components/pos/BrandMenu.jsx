import React, { useState } from 'react';
import {
  Box,
  Button,
  Menu,
  MenuItem,
  ListItemText,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  LocalOffer as BrandIcon,
} from '@mui/icons-material';

const BrandMenu = ({ brands, selectedBrand, onBrandSelect }) => {
  const [anchorEl, setAnchorEl] = useState(null);

  const handleClick = (event) => setAnchorEl(event.currentTarget);
  const handleClose = () => setAnchorEl(null);

  const handleSelect = (brand) => {
    onBrandSelect(brand);
    handleClose();
  };

  return (
    <Box>
      <Button
        onClick={handleClick}
        variant="contained"
        endIcon={<ExpandMoreIcon />}
        startIcon={<BrandIcon />}
        size="small"
        sx={{
          textTransform: 'uppercase',
          fontWeight: 700,
          fontSize: '0.78rem',
          px: 2.5,
          height: 32,
          borderRadius: 12,
          background: '#4CAF50',
          color: 'white',
          '&:hover': { background: '#388E3C' },
        }}
      >
        Brand
      </Button>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        sx={{ '& .MuiPaper-root': { minWidth: 220, maxHeight: 500 } }}
      >
        <MenuItem
          onClick={() => handleSelect(null)}
          selected={selectedBrand === null}
          sx={{ '&:hover': { backgroundColor: '#f5f5f5' } }}
        >
          <ListItemText primary="All Brands" />
        </MenuItem>

        {brands.map((brand) => (
          <MenuItem
            key={brand}
            onClick={() => handleSelect(brand)}
            selected={selectedBrand === brand}
            sx={{ '&:hover': { backgroundColor: '#f5f5f5' } }}
          >
            <ListItemText primary={brand} />
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
};

export default BrandMenu;
