import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  InputAdornment,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Divider,
  TablePagination,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
} from '@mui/icons-material';

const VariantManagementTab = ({
  variants,
  loadingVariants,
  onAddVariant,
  onEditVariant,
  onDeleteVariant,
}) => {
  const [searchText, setSearchText] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const filtered = variants.filter(v =>
    v.variant_name.toLowerCase().includes(searchText.toLowerCase())
  );
  const paginated = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h6" fontWeight="bold">Variant Management</Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={onAddVariant}>Add Variant</Button>
        </Box>
        <TextField
          placeholder="Search variants..."
          value={searchText}
          onChange={(e) => { setSearchText(e.target.value); setPage(0); }}
          size="small"
          sx={{ mb: 2, width: 280 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
        {loadingVariants ? (
          <Box display="flex" justifyContent="center" p={3}><CircularProgress /></Box>
        ) : (
          <>
            <List>
              {paginated.map((variant) => (
                <React.Fragment key={variant.id}>
                  <ListItem>
                    <ListItemText
                      primary={<Typography variant="body1">{variant.variant_name}</Typography>}
                      secondary="Examples: 250ml, Large, Small, etc."
                    />
                    <ListItemSecondaryAction>
                      <IconButton edge="end" onClick={() => onEditVariant(variant)}><EditIcon /></IconButton>
                      <IconButton edge="end" onClick={() => onDeleteVariant(variant.id)}><DeleteIcon /></IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                  <Divider />
                </React.Fragment>
              ))}
              {filtered.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                  No variants found
                </Typography>
              )}
            </List>
            <TablePagination
              component="div"
              count={filtered.length}
              page={page}
              onPageChange={(_, newPage) => setPage(newPage)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
              rowsPerPageOptions={[5, 10, 25]}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default VariantManagementTab;
