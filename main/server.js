const express = require('express');
const cors = require('cors');
const path = require('path');
const { app } = require('electron');
const multer = require('multer'); // Import multer
const compression = require('compression'); // Add compression

// Import routes
const usersRoutes = require('./routes/users');
const categoryRoutes = require('./routes/category');
const brandRoutes = require('./routes/brand');
const itemRoutes = require('./routes/item');
const variantRoutes = require('./routes/variant');
const itemVariantRoutes = require('./routes/itemVariant');
const orderRoutes = require('./routes/order');
const inOutRoutes = require('./routes/inOut');
const cashierShiftRoutes = require('./routes/cashierShift');
const reportsRoutes = require('./routes/reports');

// Stock management routes
const stockUnitRoutes = require('./routes/stockUnit');
const stockCategoryRoutes = require('./routes/stockCategory');
const stockSupplierRoutes = require('./routes/stockSupplier');
const stockProductRoutes = require('./routes/stockProduct');
const stockTransactionRoutes = require('./routes/stockTransaction');

// Import database initialization
const { initializeDatabase } = require('./database/init');
const { getDatabase, getCurrentUTCTimestamp } = require('./database/init'); // Import getDatabase

const server = express();

// Configure Multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(app.getPath('userData'), 'uploads');
    require('fs').mkdirSync(uploadPath, { recursive: true }); // Ensure directory exists
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  },
});
// Add file size limit (5MB max) and file filter
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max file size
  },
  fileFilter: (req, file, cb) => {
    // Accept images only
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
      return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
  }
});

// Middleware
server.use(compression()); // Enable gzip compression
server.use(cors());
server.use(express.json({ limit: '10mb' })); // Limit JSON payload size
server.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request timeout middleware (30 seconds)
server.use((req, res, next) => {
  req.setTimeout(30000); // 30 seconds
  res.setTimeout(30000);
  next();
});

// Serve static images
server.use('/uploads', express.static(path.join(app.getPath('userData'), 'uploads')));

// Initialize database
initializeDatabase();

// Routes
server.use('/api/users', usersRoutes);
server.use('/api/staff', usersRoutes);
server.use('/api/categories', categoryRoutes);
server.use('/api/brands', brandRoutes);
server.use('/api/items', itemRoutes);
server.use('/api/variants', variantRoutes);
server.use('/api/item-variants', itemVariantRoutes);
server.use('/api/orders', orderRoutes);
server.use('/api/in-out', inOutRoutes);
server.use('/api/cashier-shifts', cashierShiftRoutes);

// Reports routes
server.use('/api/reports', reportsRoutes);

// Stock management routes
server.use('/api/stock-unit', stockUnitRoutes);
server.use('/api/stock-category', stockCategoryRoutes);
server.use('/api/stock-supplier', stockSupplierRoutes);
server.use('/api/stock-product', stockProductRoutes);
server.use('/api/stock-transaction', stockTransactionRoutes);

// New route for creating item with variant and image
server.post('/api/item-variants/create-full', upload.single('image'), (req, res) => {
  const db = getDatabase();
  const { name, category, variant, barcode, sellingPrice, buyingPrice, initialQuantity, description, expiryDate } = req.body;
  const imagePath = req.file ? req.file.path : null;

  if (!name || !category || !variant || !sellingPrice || !initialQuantity) {
    return res.status(400).json({ error: 'Missing required fields: name, category, variant, sellingPrice, initialQuantity' });
  }

  const transaction = db.transaction(() => {
    // 1. Get category_id
    const categoryRow = db.prepare('SELECT id FROM category WHERE name = ?').get(category);
    if (!categoryRow) {
      throw new Error('Category not found');
    }
    const category_id = categoryRow.id;

    // 2. Insert into item table
    const itemResult = db.prepare(
      'INSERT INTO item (category_id, name, image, created_at) VALUES (?, ?, ?, ?)'
    ).run(category_id, name, imagePath, getCurrentUTCTimestamp());
    const item_id = itemResult.lastInsertRowid;

    // 3. Get or create variant_id
    let variant_id;
    const variantRow = db.prepare('SELECT id FROM variant WHERE variant_name = ?').get(variant);
    if (variantRow) {
      variant_id = variantRow.id;
    } else {
      const variantResult = db.prepare(
        'INSERT INTO variant (variant_name, created_at) VALUES (?, ?)'
      ).run(variant, getCurrentUTCTimestamp());
      variant_id = variantResult.lastInsertRowid;
    }

    // 4. Insert into item_variant table
    let item_variant_id;
    try {
      const ivResult = db.prepare(
        'INSERT INTO item_variant (variant_id, item_id, barcode, created_at) VALUES (?, ?, ?, ?)'
      ).run(variant_id, item_id, barcode, getCurrentUTCTimestamp());
      item_variant_id = ivResult.lastInsertRowid;
    } catch (err) {
      if (err.message.includes('UNIQUE constraint failed: item_variant.barcode')) {
        throw new Error('Barcode already exists. Please use a different barcode.');
      }
      throw err;
    }

    // 5. Insert into stock_batch with batch-wise sell price
    const stockResult = db.prepare(
      'INSERT INTO stock_batch (item_variant_id, initial_qty, remaining_qty, buy_price, sell_price, description, expire_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      item_variant_id,
      parseInt(initialQuantity),
      parseInt(initialQuantity),
      parseFloat(buyingPrice || 0),
      parseFloat(sellingPrice || 0),
      description || null,
      expiryDate || null,
      getCurrentUTCTimestamp()
    );

    return item_variant_id;
  });

  try {
    const item_variant_id = transaction();
    res.status(201).json({ message: 'Item, variant, and stock created successfully', item_variant_id });
  } catch (error) {
    console.error('Transaction failed:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// New route for creating item with multiple variants
server.post('/api/items/create-with-variants', upload.single('image'), (req, res) => {
  const db = getDatabase();
  const { name, category } = req.body;
  const variants = JSON.parse(req.body.variants || '[]');
  const imagePath = req.file ? req.file.path : null;

  if (!name || !category || !variants || variants.length === 0) {
    return res.status(400).json({ error: 'Missing required fields: name, category, variants array' });
  }

  const transaction = db.transaction(() => {
    // 1. Get category_id
    const categoryRow = db.prepare('SELECT id FROM category WHERE name = ?').get(category);
    if (!categoryRow) {
      throw new Error('Category not found');
    }
    const category_id = categoryRow.id;

    // 2. Insert into item table
    const itemResult = db.prepare(
      'INSERT INTO item (category_id, name, image, created_at) VALUES (?, ?, ?, ?)'
    ).run(category_id, name, imagePath, getCurrentUTCTimestamp());
    const item_id = itemResult.lastInsertRowid;

    const createdVariants = [];

    // 3. Process each variant
    for (const variantData of variants) {
      const { variantName, barcode, sellingPrice, buyingPrice, initialQuantity, description, expiryDate, isDiscountActive, discountType, discountValue } = variantData;

      if (!variantName || !sellingPrice) {
        throw new Error(`Variant ${variantName || 'unnamed'} is missing required fields`);
      }

      // Get or create variant_id
      let variant_id;
      const variantRow = db.prepare('SELECT id FROM variant WHERE variant_name = ?').get(variantName);
      if (variantRow) {
        variant_id = variantRow.id;
      } else {
        const variantResult = db.prepare(
          'INSERT INTO variant (variant_name, created_at) VALUES (?, ?)'
        ).run(variantName, getCurrentUTCTimestamp());
        variant_id = variantResult.lastInsertRowid;
      }

      // Insert into item_variant table
      let item_variant_id;
      try {
        const ivResult = db.prepare(
          'INSERT INTO item_variant (variant_id, item_id, barcode, is_discount_active, discount_type, discount_value, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).run(variant_id, item_id, barcode, isDiscountActive ? 1 : 0, discountType || null, parseFloat(discountValue) || 0, getCurrentUTCTimestamp());
        item_variant_id = ivResult.lastInsertRowid;
      } catch (err) {
        if (err.message.includes('UNIQUE constraint failed: item_variant.barcode')) {
          throw new Error(`Barcode ${barcode} already exists`);
        }
        throw err;
      }

      // Insert into stock_batch with batch-wise sell price
      const stockResult = db.prepare(
        'INSERT INTO stock_batch (item_variant_id, initial_qty, remaining_qty, buy_price, sell_price, description, expire_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(
        item_variant_id,
        parseInt(initialQuantity || 0),
        parseInt(initialQuantity || 0),
        parseFloat(buyingPrice || 0),
        parseFloat(sellingPrice || 0),
        description || null,
        expiryDate || null,
        getCurrentUTCTimestamp()
      );

      createdVariants.push({
        item_variant_id,
        variantName,
        barcode,
        sellingPrice: parseFloat(sellingPrice),
        initialQuantity: parseInt(initialQuantity || 0)
      });
    }

    return { item_id, createdVariants };
  });

  try {
    const result = transaction();
    res.status(201).json({
      message: 'Item with variants created successfully',
      item_id: result.item_id,
      created_variants: result.createdVariants
    });
  } catch (error) {
    console.error('Transaction failed:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Add stock batch to existing item variant
server.post('/api/stock-batch/add', (req, res) => {
  const db = getDatabase();
  const { item_variant_id, buyingPrice, sellingPrice, quantity, description, expire_date } = req.body;

  if (!item_variant_id || !quantity || !buyingPrice || sellingPrice === undefined || sellingPrice === null || sellingPrice === '') {
    return res.status(400).json({ error: 'Missing required fields: item_variant_id, quantity, buyingPrice, sellingPrice' });
  }

  const transaction = db.transaction(() => {
    // Create new stock batch
    const result = db.prepare(
      'INSERT INTO stock_batch (item_variant_id, buy_price, sell_price, initial_qty, remaining_qty, description, expire_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      item_variant_id,
      parseFloat(buyingPrice),
      parseFloat(sellingPrice),
      parseInt(quantity),
      parseInt(quantity),
      description || null,
      expire_date || null,
      getCurrentUTCTimestamp()
    );
    return result.lastInsertRowid;
  });

  try {
    const stock_batch_id = transaction();
    res.status(201).json({
      message: 'Stock batch added successfully',
      stock_batch_id
    });
  } catch (error) {
    console.error('Transaction failed:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get stock batches for an item variant
server.get('/api/stock/batches/:itemVariantId', (req, res) => {
  const db = getDatabase();
  const { itemVariantId } = req.params;

  try {
    const batches = db.prepare(`
      SELECT sb.*, s.name as supplier_name
      FROM stock_batch sb
      LEFT JOIN supplier s ON sb.supplier_id = s.id
      WHERE sb.item_variant_id = ?
      ORDER BY sb.created_at DESC
    `).all(itemVariantId);
    
    res.json(batches);
  } catch (error) {
    console.error('Error fetching stock batches:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update stock batch
server.put('/api/stock/:id', (req, res) => {
  const db = getDatabase();
  const { id } = req.params;
  const { initial_qty, remaining_qty, buy_price, sell_price, expire_date, description } = req.body;

  try {
    // Build dynamic update query based on provided fields
    const updates = [];
    const values = [];

    if (initial_qty !== undefined) {
      updates.push('initial_qty = ?');
      values.push(parseFloat(initial_qty));
    }
    if (remaining_qty !== undefined) {
      updates.push('remaining_qty = ?');
      values.push(parseFloat(remaining_qty));
    }
    if (buy_price !== undefined) {
      updates.push('buy_price = ?');
      values.push(parseFloat(buy_price));
    }
    if (sell_price !== undefined) {
      updates.push('sell_price = ?');
      values.push(parseFloat(sell_price));
    }
    if (expire_date !== undefined) {
      updates.push('expire_date = ?');
      values.push(expire_date || null);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description || null);
    }
    
    updates.push('updated_at = ?');
    values.push(getCurrentUTCTimestamp());

    if (updates.length === 1) { // Only updated_at, no actual changes
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);
    
    const query = `UPDATE stock_batch SET ${updates.join(', ')} WHERE id = ?`;
    const result = db.prepare(query).run(...values);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Stock batch not found' });
    }

    res.json({ message: 'Stock batch updated successfully' });
  } catch (error) {
    console.error('Error updating stock batch:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get stock movements/history for an item variant
server.get('/api/stock/movements/:itemVariantId', (req, res) => {
  const db = getDatabase();
  const { itemVariantId } = req.params;

  try {
    // Get order-related movements (stock out)
    const movements = db.prepare(`
      SELECT 
        'OUT' as type,
        ivo.qty as quantity,
        ivo.unit_price as price,
        sb.buy_price as buy_price,
        sb.sell_price as sell_price,
        o.date as created_at,
        o.id as reference_id,
        'Order #' || o.id || COALESCE(' / Batch #' || ivo.stock_batch_id, '') as description,
        u.name as staff_name
      FROM item_variant_order ivo
      JOIN orders o ON ivo.order_id = o.id
      JOIN users u ON o.user_id = u.id
      LEFT JOIN stock_batch sb ON sb.id = ivo.stock_batch_id
      WHERE ivo.item_variant_id = ? AND o.status = 'completed'

      UNION ALL

      SELECT 
        'IN' as type,
        sb.initial_qty as quantity,
        sb.sell_price as price,
        sb.buy_price as buy_price,
        sb.sell_price as sell_price,
        sb.created_at,
        sb.id as reference_id,
        COALESCE(sb.description, 'Stock Added') as description,
        'System' as staff_name
      FROM stock_batch sb
      WHERE sb.item_variant_id = ?
      
      ORDER BY created_at DESC
    `).all(itemVariantId, itemVariantId);
    
    res.json(movements);
  } catch (error) {
    console.error('Error fetching stock movements:', error);
    res.status(500).json({ error: error.message });
  }
});


// Update item variant with full data (item, variant, price, etc.)
server.put('/api/item-variants/:id/update-full', upload.single('image'), (req, res) => {
  const db = getDatabase();
  const { id } = req.params;
  const { name, category, variant, barcode, sellingPrice, buyingPrice, initialQuantity, description, isDiscountActive, discountType, discountValue } = req.body;
  const imagePath = req.file ? req.file.path : null;

  if (!name || !category || !variant) {
    return res.status(400).json({ error: 'Missing required fields: name, category, variant' });
  }

  const transaction = db.transaction(() => {
    // 1. Get current item variant data
    const currentData = db.prepare(`
      SELECT iv.*, i.id as item_id, i.name as item_name, i.category_id, v.variant_name
      FROM item_variant iv
      JOIN item i ON iv.item_id = i.id
      JOIN variant v ON iv.variant_id = v.id
      WHERE iv.id = ?
    `).get(id);

    if (!currentData) {
      throw new Error('Item variant not found');
    }

    // 2. Get category_id
    const categoryRow = db.prepare('SELECT id FROM category WHERE name = ?').get(category);
    if (!categoryRow) {
      throw new Error('Category not found');
    }
    const category_id = categoryRow.id;

    // 3. Update item table
    if (imagePath) {
      db.prepare('UPDATE item SET name = ?, category_id = ?, image = ? WHERE id = ?')
        .run(name, category_id, imagePath, currentData.item_id);
    } else {
      db.prepare('UPDATE item SET name = ?, category_id = ? WHERE id = ?')
        .run(name, category_id, currentData.item_id);
    }

    // 4. Get or create variant_id
    let variant_id;
    const variantRow = db.prepare('SELECT id FROM variant WHERE variant_name = ?').get(variant);
    if (variantRow) {
      variant_id = variantRow.id;
    } else {
      const variantResult = db.prepare(
        'INSERT INTO variant (variant_name, created_at) VALUES (?, ?)'
      ).run(variant, getCurrentUTCTimestamp());
      variant_id = variantResult.lastInsertRowid;
    }

    // 5. Update item_variant table
    const normalizedBarcode = (typeof barcode === 'string' && barcode.trim() === '') || barcode === undefined ? null : barcode;
    try {
      db.prepare('UPDATE item_variant SET variant_id = ?, barcode = ?, is_discount_active = ?, discount_type = ?, discount_value = ? WHERE id = ?')
        .run(variant_id, normalizedBarcode, isDiscountActive === '1' || isDiscountActive === true ? 1 : 0, discountType || null, parseFloat(discountValue) || 0, id);
    } catch (err) {
      if (err.message.includes('UNIQUE constraint failed: item_variant.barcode')) {
        throw new Error('Barcode already exists. Please use a different barcode.');
      }
      throw err;
    }

    // 6. Update stock if initialQuantity is provided and different
    if (initialQuantity && buyingPrice !== undefined) {
      const existingStock = db.prepare(
        'SELECT SUM(remaining_qty) as total FROM stock_batch WHERE item_variant_id = ?'
      ).get(id);

      const latestBatch = db.prepare(
        'SELECT sell_price FROM stock_batch WHERE item_variant_id = ? ORDER BY created_at DESC, id DESC LIMIT 1'
      ).get(id);

      const resolvedSellPrice =
        sellingPrice !== undefined && sellingPrice !== null && sellingPrice !== ''
          ? parseFloat(sellingPrice)
          : parseFloat(latestBatch?.sell_price || 0);
      
      const newQuantity = parseInt(initialQuantity);
      const currentTotal = existingStock?.total || 0;

      if (newQuantity !== currentTotal) {
        const difference = newQuantity - currentTotal;
        if (difference > 0) {
          const stockResult = db.prepare(
            'INSERT INTO stock_batch (item_variant_id, initial_qty, remaining_qty, buy_price, sell_price, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
          ).run(
            id,
            difference,
            difference,
            parseFloat(buyingPrice || 0),
            resolvedSellPrice,
            description || null,
            getCurrentUTCTimestamp()
          );
        }
      }
    }

    return id;
  });

  try {
    const item_variant_id = transaction();
    res.json({ message: 'Item variant updated successfully', item_variant_id });
  } catch (error) {
    console.error('Update transaction failed:', error.message);
    if (error.message === 'Item variant not found' || error.message === 'Category not found') {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Sell price history endpoint deprecated (pricing is batch-wise in stock_batch)
server.get('/api/sell-price-history/:variantId', (req, res) => {
  res.status(410).json({
    error: 'sell_price_history is deprecated. Use stock batch endpoints for pricing.'
  });
});

// Update sell price endpoint deprecated (pricing is batch-wise in stock_batch)
server.post('/api/update-sell-price', (req, res) => {
  res.status(410).json({
    error: 'update-sell-price is deprecated. Update stock batch sell_price instead.'
  });
});

// Health check
server.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'POS API is running' });
});

// Error handling middleware
server.use((err, req, res, next) => {
  console.error(err.stack);

  // Handle multer errors
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size too large. Maximum 5MB allowed.' });
    }
    return res.status(400).json({ error: err.message });
  }

  res.status(500).json({ error: 'Something went wrong!' });
});

// ===== Global Discount Settings Routes =====

// Get global discount settings
server.get('/api/global-discount-settings', (req, res) => {
  const db = getDatabase();
  try {
    let settings = db.prepare('SELECT * FROM global_discount_settings WHERE key_value = ?').get('default');
    if (!settings) {
      // Insert default settings
      db.prepare('INSERT INTO global_discount_settings (key_value, is_global_discount_active, global_discount_type, global_discount_value, min_order_amount) VALUES (?, ?, ?, ?, ?)').run('default', 0, 'percentage', 0, 0);
      settings = {
        key_value: 'default',
        is_global_discount_active: 0,
        global_discount_type: 'percentage',
        global_discount_value: 0,
        min_order_amount: 0
      };
    }
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update global discount settings
server.put('/api/global-discount-settings', (req, res) => {
  const db = getDatabase();
  const { is_global_discount_active, global_discount_type, global_discount_value, min_order_amount } = req.body;

  try {
    // Check if settings exist
    const existing = db.prepare('SELECT key_value FROM global_discount_settings WHERE key_value = ?').get('default');
    if (existing) {
      db.prepare(`
        UPDATE global_discount_settings 
        SET is_global_discount_active = ?, global_discount_type = ?, global_discount_value = ?, min_order_amount = ?
        WHERE key_value = ?
      `).run(
        is_global_discount_active ? 1 : 0,
        global_discount_type || 'percentage',
        parseFloat(global_discount_value) || 0,
        parseFloat(min_order_amount) || 0,
        'default'
      );
    } else {
      db.prepare('INSERT INTO global_discount_settings (key_value, is_global_discount_active, global_discount_type, global_discount_value, min_order_amount) VALUES (?, ?, ?, ?, ?)').run(
        'default',
        is_global_discount_active ? 1 : 0,
        global_discount_type || 'percentage',
        parseFloat(global_discount_value) || 0,
        parseFloat(min_order_amount) || 0
      );
    }
    res.json({ message: 'Global discount settings updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = server;