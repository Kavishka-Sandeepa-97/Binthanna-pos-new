const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');

let db;
let isInitialized = false;

// Utility function to get current UTC timestamp in SQLite format
const getCurrentUTCTimestamp = () => {
  return new Date().toISOString();
};

const initializeDatabase = () => {
  if (isInitialized) {
    return;
  }

  const dbPath = path.join(app.getPath('userData'), 'binthanna.db');
  
  try {
    db = new Database(dbPath);
    
    // Configure database for better performance
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('cache_size = 2000');
    db.pragma('busy_timeout = 5000');
    
    isInitialized = true;
    createTables();
    addSyncColumnsIfMissing();
    createIndexes();
    createSyncTriggers();
    
    console.log('Database initialized successfully at:', dbPath);
  } catch (err) {
    console.error('Database connection failed:', err.message);
  }
};

const createTables = () => {
  // Check if the old 'staff' table exists. If so, drop the old tables to apply the new schema.
  const hasStaffTable = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'staff'").get();
  if (hasStaffTable) {
    console.log("Old schema detected. Dropping old tables to recreate the database...");
    const tablesToDrop = [
      'order_item_batch_allocation',
      'in_out',
      'cashier_shift',
      'returns',
      'sell_price_history',
      'item_variant_order',
      'orders',
      'stock_batch',
      'supplier',
      'item_variant',
      'variant',
      'item',
      'category',
      'brand',
      'global_discount_settings',
      'staff',
      'users'
    ];
    tablesToDrop.forEach(table => {
      try {
        db.exec(`DROP TABLE IF EXISTS ${table}`);
      } catch (e) {
        console.error(`Error dropping table ${table}:`, e.message);
      }
    });
  }

  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      username TEXT UNIQUE,
      pin TEXT NOT NULL,
      role TEXT CHECK(role IN ('admin', 'cashier')) NOT NULL,
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_synced BOOLEAN DEFAULT 0
    )
  `);

  // Cashier Shift table
  db.exec(`
    CREATE TABLE IF NOT EXISTS cashier_shift (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      initial_cash_onhand DECIMAL(10,2),
      current_cash_onhand DECIMAL(10,2),
      open_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      close_at DATETIME,
      description TEXT,
      status TEXT CHECK(status IN ('open', 'closed')) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_synced BOOLEAN DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Brand table
  db.exec(`
    CREATE TABLE IF NOT EXISTS brand (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      brand_name TEXT NOT NULL UNIQUE,
      description TEXT,
      is_discount_active BOOLEAN DEFAULT 0,
      discount_type TEXT CHECK(discount_type IN ('fixed', 'percentage')),
      discount_value DECIMAL(10,2) DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_synced BOOLEAN DEFAULT 0
    )
  `);

  // Category table
  db.exec(`
    CREATE TABLE IF NOT EXISTS category (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      parent_id INTEGER NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_synced BOOLEAN DEFAULT 0,
      FOREIGN KEY (parent_id) REFERENCES category(id)
    )
  `);

  // Item table
  db.exec(`
    CREATE TABLE IF NOT EXISTS item (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL,
      brand_id INTEGER,
      name TEXT NOT NULL,
      image TEXT,
      is_qty_managed BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_synced BOOLEAN DEFAULT 0,
      FOREIGN KEY (category_id) REFERENCES category(id),
      FOREIGN KEY (brand_id) REFERENCES brand(id)
    )
  `);

  // Variant table
  db.exec(`
    CREATE TABLE IF NOT EXISTS variant (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      variant_name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_synced BOOLEAN DEFAULT 0
    )
  `);

  // Item Variant table
  db.exec(`
    CREATE TABLE IF NOT EXISTS item_variant (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      variant_id INTEGER NOT NULL,
      item_id INTEGER NOT NULL,
      barcode TEXT UNIQUE,
      is_discount_active BOOLEAN DEFAULT 0,
      discount_type TEXT CHECK(discount_type IN ('fixed', 'percentage')),
      discount_value DECIMAL(10,2) DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_synced BOOLEAN DEFAULT 0,
      FOREIGN KEY (variant_id) REFERENCES variant(id),
      FOREIGN KEY (item_id) REFERENCES item(id)
    )
  `);

  // Global Discount Settings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS global_discount_settings (
      key_value TEXT PRIMARY KEY,
      is_global_discount_active BOOLEAN DEFAULT 0,
      global_discount_type TEXT CHECK(global_discount_type IN ('fixed', 'percentage')),
      global_discount_value DECIMAL(10,2) DEFAULT 0,
      min_order_amount DECIMAL(10,2) DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_synced BOOLEAN DEFAULT 0
    )
  `);

  // Order table
  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      date DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      additional_charges DECIMAL(10,2) DEFAULT 0,
      total_amount DECIMAL(10,2) NOT NULL,
      customer_name TEXT,
      table_number TEXT,
      status TEXT CHECK(status IN ('active', 'completed', 'cancelled')) DEFAULT 'active',
      tender_cash DECIMAL(10,2),
      discount_type TEXT CHECK(discount_type IN ('fixed', 'percent')),
      discount_value DECIMAL(10,2) DEFAULT 0,
      is_card_payment BOOLEAN DEFAULT 0,
      barcode TEXT UNIQUE,
      credit_from_return DECIMAL(10,2) DEFAULT 0,
      is_synced BOOLEAN DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Item Variant Order table
  db.exec(`
    CREATE TABLE IF NOT EXISTS item_variant_order (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_variant_id INTEGER NOT NULL,
      order_id INTEGER NOT NULL,
      stock_batch_id INTEGER,
      qty INTEGER NOT NULL,
      unit_price DECIMAL(10,2) NOT NULL,
      discount_source TEXT,
      discount_type TEXT,
      discount_value DECIMAL(10,2) DEFAULT 0,
      discount_amount DECIMAL(10,2) DEFAULT 0,
      original_price DECIMAL(10,2),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_synced BOOLEAN DEFAULT 0,
      FOREIGN KEY (item_variant_id) REFERENCES item_variant(id),
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (stock_batch_id) REFERENCES stock_batch(id)
    )
  `);

  // Returns table
  db.exec(`
    CREATE TABLE IF NOT EXISTS returns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      qty INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      total_refund_amount DECIMAL(10,2) NOT NULL,
      item_variant_order_id INTEGER NOT NULL,
      order_id INTEGER NOT NULL,
      reason TEXT,
      is_synced BOOLEAN DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (item_variant_order_id) REFERENCES item_variant_order(id),
      FOREIGN KEY (order_id) REFERENCES orders(id)
    )
  `);

  // Sell Price History table
  db.exec(`
    CREATE TABLE IF NOT EXISTS sell_price_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_variant_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      stock_batch_id INTEGER,
      selling_price DECIMAL(10,2) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_synced BOOLEAN DEFAULT 0,
      FOREIGN KEY (item_variant_id) REFERENCES item_variant(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (stock_batch_id) REFERENCES stock_batch(id)
    )
  `);

  // In/Out Transaction table for restaurant expenses/revenue
  db.exec(`
    CREATE TABLE IF NOT EXISTS in_out (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT CHECK(type IN ('IN', 'OUT')) NOT NULL,
      description TEXT NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      user_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_synced BOOLEAN DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Supplier table
  db.exec(`
    CREATE TABLE IF NOT EXISTS supplier (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone_number TEXT,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_synced BOOLEAN DEFAULT 0
    )
  `);

  // Stock Batch table
  db.exec(`
    CREATE TABLE IF NOT EXISTS stock_batch (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_variant_id INTEGER NOT NULL,
      buy_price DECIMAL(10,2) NOT NULL,
      sell_price DECIMAL(10,2) NOT NULL DEFAULT 0,
      initial_qty INTEGER NOT NULL,
      remaining_qty INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      description TEXT,
      expire_date DATE,
      supplier_id INTEGER,
      is_synced BOOLEAN DEFAULT 0,
      FOREIGN KEY (item_variant_id) REFERENCES item_variant(id),
      FOREIGN KEY (supplier_id) REFERENCES supplier(id)
    )
  `);

  // Stock Unit table (for stock management)
  db.exec(`
    CREATE TABLE IF NOT EXISTS stock_unit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      is_synced BOOLEAN DEFAULT 0
    )
  `);

  // Stock Category table
  db.exec(`
    CREATE TABLE IF NOT EXISTS stock_category (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      is_synced BOOLEAN DEFAULT 0
    )
  `);

  // Stock Supplier table
  db.exec(`
    CREATE TABLE IF NOT EXISTS stock_supplier (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      is_synced BOOLEAN DEFAULT 0
    )
  `);

  // Stock Product table
  db.exec(`
    CREATE TABLE IF NOT EXISTS stock_product (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category_id INTEGER NOT NULL,
      unit_id INTEGER NOT NULL,
      current_qty DECIMAL(10,2) DEFAULT 0,
      is_synced BOOLEAN DEFAULT 0,
      FOREIGN KEY (category_id) REFERENCES stock_category(id),
      FOREIGN KEY (unit_id) REFERENCES stock_unit(id)
    )
  `);

  // Stock Transaction table
  db.exec(`
    CREATE TABLE IF NOT EXISTS stock_transaction (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      supplier_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      description TEXT,
      type TEXT CHECK(type IN ('IN', 'OUT')) NOT NULL,
      price DECIMAL(10,2),
      qty DECIMAL(10,2) NOT NULL,
      user_id INTEGER NOT NULL,
      is_synced BOOLEAN DEFAULT 0,
      FOREIGN KEY (product_id) REFERENCES stock_product(id),
      FOREIGN KEY (supplier_id) REFERENCES stock_supplier(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // sync_settings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS sync_settings (
      id INTEGER PRIMARY KEY,
      is_enabled BOOLEAN DEFAULT 0,
      supabase_url TEXT DEFAULT '',
      supabase_key TEXT DEFAULT '',
      last_sync_at DATETIME,
      last_sync_status TEXT DEFAULT 'idle',
      last_sync_error TEXT
    )
  `);

  // deleted_records table
  db.exec(`
    CREATE TABLE IF NOT EXISTS deleted_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT NOT NULL,
      record_id INTEGER NOT NULL,
      deleted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_synced BOOLEAN DEFAULT 0
    )
  `);

  // Insert default admin user
  insertDefaultData();
};

// Create indexes for performance optimization
const createIndexes = () => {
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_category_parent ON category(parent_id)',
    'CREATE INDEX IF NOT EXISTS idx_item_category ON item(category_id)',
    'CREATE INDEX IF NOT EXISTS idx_item_brand ON item(brand_id)',
    'CREATE INDEX IF NOT EXISTS idx_item_name ON item(name)',
    'CREATE INDEX IF NOT EXISTS idx_item_variant_item ON item_variant(item_id)',
    'CREATE INDEX IF NOT EXISTS idx_item_variant_variant ON item_variant(variant_id)',
    'CREATE INDEX IF NOT EXISTS idx_item_variant_barcode ON item_variant(barcode)',
    'CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)',
    'CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(date)',
    'CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_item_variant_order_order ON item_variant_order(order_id)',
    'CREATE INDEX IF NOT EXISTS idx_item_variant_order_variant ON item_variant_order(item_variant_id)',
    'CREATE INDEX IF NOT EXISTS idx_cashier_shift_user ON cashier_shift(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_cashier_shift_status ON cashier_shift(status)',
    'CREATE INDEX IF NOT EXISTS idx_cashier_shift_open_at ON cashier_shift(open_at)',
    'CREATE INDEX IF NOT EXISTS idx_stock_batch_item_variant ON stock_batch(item_variant_id)',
    'CREATE INDEX IF NOT EXISTS idx_stock_batch_supplier ON stock_batch(supplier_id)',
    'CREATE INDEX IF NOT EXISTS idx_stock_batch_expire_date ON stock_batch(expire_date)',
    'CREATE INDEX IF NOT EXISTS idx_stock_batch_variant_created ON stock_batch(item_variant_id, created_at DESC, id DESC)',
    // Composite indexes for frequent JOIN + aggregate patterns
    'CREATE INDEX IF NOT EXISTS idx_stock_batch_variant_remaining ON stock_batch(item_variant_id, remaining_qty)',
    'CREATE INDEX IF NOT EXISTS idx_orders_status_date ON orders(status, date)',
    // Return order related indexes
    'CREATE INDEX IF NOT EXISTS idx_orders_barcode ON orders(barcode)',
    'CREATE INDEX IF NOT EXISTS idx_returns_order ON returns(order_id)',
    'CREATE INDEX IF NOT EXISTS idx_returns_item_variant_order ON returns(item_variant_order_id)',
    'CREATE INDEX IF NOT EXISTS idx_returns_user ON returns(user_id)',
    // Stock management indexes
    'CREATE INDEX IF NOT EXISTS idx_stock_product_category ON stock_product(category_id)',
    'CREATE INDEX IF NOT EXISTS idx_stock_transaction_product ON stock_transaction(product_id)',
    'CREATE INDEX IF NOT EXISTS idx_stock_transaction_created ON stock_transaction(created_at)'
  ];

  const hasSellPriceHistoryTable = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get('sell_price_history');

  if (hasSellPriceHistoryTable) {
    indexes.push('CREATE INDEX IF NOT EXISTS idx_sell_price_variant ON sell_price_history(item_variant_id)');
    indexes.push('CREATE INDEX IF NOT EXISTS idx_sell_price_created ON sell_price_history(created_at)');
    indexes.push('CREATE INDEX IF NOT EXISTS idx_sell_price_variant_id_desc ON sell_price_history(item_variant_id, id DESC)');
  }

  indexes.forEach(index => {
    db.exec(index);
  });
};

const insertDefaultData = () => {
  // Check if admin exists in users table
  const admin = db.prepare('SELECT id FROM users WHERE role = ?').get('admin');
  
  if (!admin) {
    // Insert default admin
    db.prepare('INSERT INTO users (name, username, pin, role) VALUES (?, ?, ?, ?)').run('Admin', 'admin', '1234', 'admin');
  }

  // Insert default categories with hierarchical structure
  const insertCategoryStmt = db.prepare('INSERT OR IGNORE INTO category (name, parent_id) VALUES (?, ?)');
  const getCategoryIdStmt = db.prepare('SELECT id FROM category WHERE name = ?');
  
  // Main Categories
  const mainCategories = [
    'FOOD',
    'BEVERAGES',
    'BAR'
  ];
  
  mainCategories.forEach(cat => {
    insertCategoryStmt.run(cat, null);
  });
  
  // FOOD subcategories
  const foodId = getCategoryIdStmt.get('FOOD')?.id;
  if (foodId) {
    const foodSub = [
      'Rice & Fried Rice',
      'Kottu',
      'Noodles & Pasta',
      'Curries & Side Dishes',
      'Appetizers & Starters',
      'Desserts'
    ];
    foodSub.forEach(sub => insertCategoryStmt.run(sub, foodId));
  }
  
  // BEVERAGES subcategories
  const beveragesId = getCategoryIdStmt.get('BEVERAGES')?.id;
  if (beveragesId) {
    const beveragesSub = [
      'Soft Drinks',
      'Fresh Juices',
      'Tea & Coffee'
    ];
    beveragesSub.forEach(sub => insertCategoryStmt.run(sub, beveragesId));
  }
  
  // BAR subcategories
  const barId = getCategoryIdStmt.get('BAR')?.id;
  if (barId) {
    const barSub = [
      'Beer',
      'Arrack',
      'Whiskey',
      'Wine',
      'Cocktails',
      'Cigarettes',
      'Bites & Snacks'
    ];
    barSub.forEach(sub => insertCategoryStmt.run(sub, barId));
  }

  // Insert default sync settings
  const syncSettings = db.prepare('SELECT id FROM sync_settings WHERE id = 1').get();
  if (!syncSettings) {
    db.prepare('INSERT INTO sync_settings (id, is_enabled, supabase_url, supabase_key, last_sync_status) VALUES (1, 0, ?, ?, ?)')
      .run('', '', 'idle');
  }
};

// Create sync delete triggers for all tables
const createSyncTriggers = () => {
  const tables = [
    'users',
    'cashier_shift',
    'brand',
    'category',
    'item',
    'variant',
    'item_variant',
    'orders',
    'item_variant_order',
    'returns',
    'sell_price_history',
    'in_out',
    'supplier',
    'stock_batch',
    'stock_unit',
    'stock_category',
    'stock_supplier',
    'stock_product',
    'stock_transaction'
  ];

  tables.forEach(table => {
    db.exec(`DROP TRIGGER IF EXISTS trg_${table}_sync_delete`);
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS trg_${table}_sync_delete
      AFTER DELETE ON ${table}
      BEGIN
        INSERT INTO deleted_records (table_name, record_id, is_synced)
        VALUES ('${table}', OLD.id, 0);
      END;
    `);
  });
};

// Automatically add missing is_synced column to old tables
const addSyncColumnsIfMissing = () => {
  const tables = [
    'users',
    'cashier_shift',
    'brand',
    'category',
    'item',
    'variant',
    'item_variant',
    'global_discount_settings',
    'orders',
    'item_variant_order',
    'returns',
    'sell_price_history',
    'in_out',
    'supplier',
    'stock_batch',
    'stock_unit',
    'stock_category',
    'stock_supplier',
    'stock_product',
    'stock_transaction'
  ];

  tables.forEach(table => {
    try {
      const columns = db.prepare(`PRAGMA table_info(${table})`).all();
      const hasSyncedCol = columns.some(col => col.name === 'is_synced');
      if (!hasSyncedCol) {
        console.log(`Adding missing 'is_synced' column to table: ${table}`);
        db.exec(`ALTER TABLE ${table} ADD COLUMN is_synced BOOLEAN DEFAULT 0`);
      }
    } catch (err) {
      console.error('Error checking/adding sync column for table ' + table + ':', err.message);
    }
  });
};

// Close database connection properly
const closeDatabase = () => {
  return new Promise((resolve, reject) => {
    if (!db) {
      resolve();
      return;
    }

    try {
      db.close();
      db = null;
      isInitialized = false;
      resolve();
    } catch (err) {
      reject(err);
    }
  });
};

const getDatabase = () => {
  return db;
};

const generateUniqueBarcode = () => {
  const buildRandomBarcode = () => Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
  const fallbackBarcode = buildRandomBarcode();

  if (!db) {
    return fallbackBarcode;
  }

  try {
    const checkBarcode = db.prepare('SELECT id FROM orders WHERE barcode = ? LIMIT 1');

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const candidate = buildRandomBarcode();

      const existing = checkBarcode.get(candidate);
      if (!existing) {
        return candidate;
      }
    }
  } catch (error) {
    return fallbackBarcode;
  }

  return fallbackBarcode;
};

// Manual backup function (call when needed)
const backupDatabase = () => {
  if (!db) return null;
  
  const fs = require('fs');
  
  const dbPath = path.join(app.getPath('userData'), 'binthanna.db');
  const backupPath = path.join(
    app.getPath('userData'), 
    `binthanna_backup_${Date.now()}.db`
  );
  
  try {
    fs.copyFileSync(dbPath, backupPath);
    return backupPath;
  } catch (error) {
    return null;
  }
};

module.exports = {
  initializeDatabase,
  getDatabase,
  closeDatabase,
  backupDatabase,
  getCurrentUTCTimestamp,
  generateUniqueBarcode,
};