import React, { useState, useMemo } from 'react';
import useDebounce from '../../hooks/useDebounce';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Paper,
  TextField,
  InputAdornment,
  IconButton,
  Chip,
  Tooltip,
} from '@mui/material';
import {
  Search as SearchIcon,
  Edit as EditIcon,
  Add as AddIcon,
  ListAlt as ListAltIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';

const getStockStatus = (item) => {
  if (item.is_qty_managed === 0 || item.is_qty_managed === false) {
    return { label: 'Qty Not Managed', color: 'success' };
  }
  const stock = item.total_stock || item.stock || 0;
  if (stock === 0) return { label: 'Out of Stock', color: 'error' };
  if (stock <= (item.minStock || 5)) return { label: 'Low Stock', color: 'warning' };
  return { label: 'In Stock', color: 'success' };
};

const InventoryItemsTable = ({
  itemVariants,
  onRefresh,
  onEditItem,
  onAddStock,
  onViewStockBatch,
  onDeleteItem,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const debouncedSearch = useDebounce(searchTerm, 250);

  const filteredItems = useMemo(() => {
    if (!debouncedSearch) return itemVariants;
    const lower = debouncedSearch.toLowerCase();
    return itemVariants.filter(item => {
      const itemName = (item.item_name || item.name || '').toLowerCase();
      const variantName = (item.variant_name || item.variant || '').toLowerCase();
      const categoryName = (item.category_name || item.category || '').toLowerCase();
      const barcodeValue = item.barcode || '';
      return (
        itemName.includes(lower) ||
        variantName.includes(lower) ||
        categoryName.includes(lower) ||
        barcodeValue.includes(debouncedSearch)
      );
    });
  }, [itemVariants, debouncedSearch]);

  const paginatedItems = useMemo(
    () => filteredItems.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [filteredItems, page, rowsPerPage]
  );

  const handleChangePage = (_, newPage) => setPage(newPage);
  const handleChangeRowsPerPage = (e) => {
    setRowsPerPage(parseInt(e.target.value, 10));
    setPage(0);
  };
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setPage(0);
  };

  return (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6" fontWeight="bold">
            Inventory Items
          </Typography>
        </Box>

        <Box display="flex" gap={2} mb={2}>
          <TextField
            placeholder="Search items..."
            value={searchTerm}
            onChange={handleSearchChange}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            sx={{ flexGrow: 1 }}
            size="small"
          />
          <Tooltip title="Refresh items">
            <IconButton
              onClick={onRefresh}
              color="primary"
              sx={{ border: '1px solid', borderColor: 'primary.main', borderRadius: 1 }}
            >
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>

        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Item Name</TableCell>
                <TableCell>Variant</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Barcode</TableCell>
                <TableCell>Date Added</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Typography variant="body2" color="text.secondary" py={2}>
                      {searchTerm ? 'No items match your search' : 'No items available'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedItems.map((item) => {
                  const status = getStockStatus(item);
                  return (
                    <TableRow key={item.id || `item-${item.item_id_ref}`}>
                      <TableCell>{item.item_name || item.name || '-'}</TableCell>
                      <TableCell>{item.variant_name || item.variant || '-'}</TableCell>
                      <TableCell>
                        <Chip label={item.category_name || item.category || '-'} size="small" />
                      </TableCell>
                      <TableCell>
                        <Chip label={status.label} color={status.color} size="small" />
                      </TableCell>
                      <TableCell>{item.barcode || '-'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {item.created_at ? (
                          <>
                            <div>{new Date(item.created_at).toLocaleDateString()}</div>
                            <div style={{ fontSize: '0.75em', color: '#888' }}>
                              {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </>
                        ) : '-'}
                      </TableCell>
                      <TableCell
                        sx={{
                          whiteSpace: 'nowrap',
                          py: 1,
                          '& .MuiIconButton-root': {
                            width: 52,
                            height: 52,
                            p: 1.3,
                            borderRadius: 1.5,
                          },
                          '& .MuiSvgIcon-root': { fontSize: '1.7rem' },
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.1 }}>
                          <Tooltip title="Edit Item">
                            <IconButton size="large" onClick={() => onEditItem(item)}>
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title={item.is_qty_managed === 0 || item.is_qty_managed === false ? "Qty Not Managed" : "Add Stock"}>
                            <span>
                              <IconButton 
                                size="large" 
                                color="secondary" 
                                onClick={() => onAddStock(item)}
                                disabled={item.is_qty_managed === 0 || item.is_qty_managed === false}
                              >
                                <AddIcon />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title="View Stock Details">
                            <IconButton size="large" color="info" onClick={() => onViewStockBatch(item)}>
                              <ListAltIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete Item">
                            <IconButton size="large" color="error" onClick={() => onDeleteItem(item.id)}>
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          component="div"
          count={filteredItems.length}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[10, 25, 50, 100]}
          labelRowsPerPage="Per page:"
        />
      </CardContent>
    </Card>
  );
};

export default InventoryItemsTable;
