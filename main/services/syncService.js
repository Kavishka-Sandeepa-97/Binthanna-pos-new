// Polyfill global WebSocket for Supabase Realtime client initialization in Node.js
if (typeof global.WebSocket === 'undefined') {
  global.WebSocket = class MockWebSocket {
    constructor() {
      // Realtime websocket connection is not needed for POS data uploading,
      // but supabase-js client checks for its existence during creation.
    }
  };
}

const { createClient } = require('@supabase/supabase-js');
const { getDatabase } = require('../database/init');

// Foreign Key Mapping for Self-Healing Dependency Resolution
const FOREIGN_KEY_MAP = {
  cashier_shift: [
    { col: 'user_id', parentTable: 'users', parentCol: 'id' }
  ],
  category: [
    { col: 'parent_id', parentTable: 'category', parentCol: 'id' }
  ],
  item: [
    { col: 'category_id', parentTable: 'category', parentCol: 'id' },
    { col: 'brand_id', parentTable: 'brand', parentCol: 'id' }
  ],
  item_variant: [
    { col: 'variant_id', parentTable: 'variant', parentCol: 'id' },
    { col: 'item_id', parentTable: 'item', parentCol: 'id' }
  ],
  orders: [
    { col: 'user_id', parentTable: 'users', parentCol: 'id' }
  ],
  item_variant_order: [
    { col: 'item_variant_id', parentTable: 'item_variant', parentCol: 'id' },
    { col: 'order_id', parentTable: 'orders', parentCol: 'id' },
    { col: 'stock_batch_id', parentTable: 'stock_batch', parentCol: 'id' }
  ],
  returns: [
    { col: 'user_id', parentTable: 'users', parentCol: 'id' },
    { col: 'item_variant_order_id', parentTable: 'item_variant_order', parentCol: 'id' },
    { col: 'order_id', parentTable: 'orders', parentCol: 'id' }
  ],
  sell_price_history: [
    { col: 'item_variant_id', parentTable: 'item_variant', parentCol: 'id' },
    { col: 'user_id', parentTable: 'users', parentCol: 'id' },
    { col: 'stock_batch_id', parentTable: 'stock_batch', parentCol: 'id' }
  ],
  in_out: [
    { col: 'user_id', parentTable: 'users', parentCol: 'id' }
  ],
  stock_batch: [
    { col: 'item_variant_id', parentTable: 'item_variant', parentCol: 'id' },
    { col: 'supplier_id', parentTable: 'supplier', parentCol: 'id' }
  ],
  stock_product: [
    { col: 'category_id', parentTable: 'stock_category', parentCol: 'id' },
    { col: 'unit_id', parentTable: 'stock_unit', parentCol: 'id' }
  ],
  stock_transaction: [
    { col: 'product_id', parentTable: 'stock_product', parentCol: 'id' },
    { col: 'supplier_id', parentTable: 'stock_supplier', parentCol: 'id' },
    { col: 'user_id', parentTable: 'users', parentCol: 'id' }
  ]
};

const handleForeignKeyFailure = (db, table, rows) => {
  const mappings = FOREIGN_KEY_MAP[table];
  if (!mappings) return;

  db.transaction(() => {
    for (const map of mappings) {
      const parentIds = rows
        .map(row => row[map.col])
        .filter(id => id !== null && id !== undefined);

      if (parentIds.length > 0) {
        // Build placeholders for SQL IN clause
        const placeholders = parentIds.map(() => '?').join(',');
        try {
          console.log(`[Sync] Marking missing parent records in "${map.parentTable}" as unsynced (IDs: ${parentIds.join(', ')})`);
          db.prepare(`UPDATE ${map.parentTable} SET is_synced = 0 WHERE ${map.parentCol} IN (${placeholders})`).run(...parentIds);
        } catch (err) {
          console.error(`[Sync] Failed to mark parents in "${map.parentTable}" as unsynced:`, err.message);
        }
      }
    }
  })();
};

const resetLocalSyncFlags = (db) => {
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

  db.transaction(() => {
    for (const table of tables) {
      try {
        db.prepare(`UPDATE ${table} SET is_synced = 0`).run();
      } catch (err) {
        console.error(`[Sync] Failed to reset sync flag for table ${table}:`, err.message);
      }
    }
    // Also clear deletions logs queue
    try {
      db.prepare('DELETE FROM deleted_records').run();
    } catch (err) {
      console.error('[Sync] Failed to clear deleted_records:', err.message);
    }
  })();
};


let syncInterval = null;
let lastRunTime = 0;

/**
 * Perform a database sync from SQLite to Supabase.
 */
const runSync = async () => {
  const db = getDatabase();
  if (!db) {
    console.log('[Sync] Database not initialized');
    return;
  }

  // 1. Fetch current sync settings
  let settings;
  try {
    settings = db.prepare('SELECT * FROM sync_settings WHERE id = 1').get();
  } catch (err) {
    console.error('[Sync] Failed to read sync settings:', err.message);
    return;
  }

  if (!settings || !settings.is_enabled) {
    console.log('[Sync] Sync is disabled');
    return;
  }

  const { supabase_url, supabase_key } = settings;
  if (!supabase_url || !supabase_key) {
    console.log('[Sync] Missing Supabase URL or API Key');
    db.prepare("UPDATE sync_settings SET last_sync_status = 'error', last_sync_error = 'Missing credentials' WHERE id = 1").run();
    return;
  }

  // Update status to syncing
  db.prepare("UPDATE sync_settings SET last_sync_status = 'syncing', last_sync_error = NULL WHERE id = 1").run();

  try {
    // 2. Initialize Supabase client
    const supabase = createClient(supabase_url, supabase_key, {
      auth: { persistSession: false }
    });

    // 3. Test Connection (Ping)
    const { data: pingData, error: pingError } = await supabase.from('users').select('id').limit(1);
    if (pingError) {
      if (pingError.message && pingError.message.includes('fetch failed')) {
        throw new Error('Could not connect to Supabase. Please check your internet connection and Supabase URL.');
      } else {
        throw new Error(`Authentication/Connection failed: ${pingError.message}`);
      }
    }

    if (!pingData || pingData.length === 0) {
      console.log('[Sync] Cloud database appears to be empty (0 users found). Resetting all local sync flags to force full upload...');
      resetLocalSyncFlags(db);
    }

    // 4. Sync deletions first
    const deletions = db.prepare('SELECT id, table_name, record_id FROM deleted_records WHERE is_synced = 0').all();
    console.log(`[Sync] Found ${deletions.length} deleted records to sync`);

    for (const del of deletions) {
      const idCol = del.table_name === 'global_discount_settings' ? 'key_value' : 'id';
      const { error } = await supabase
        .from(del.table_name)
        .delete()
        .eq(idCol, del.record_id);

      // Treat successful deletes or "record not found" as success
      if (!error || error.code === 'PGRST116' || error.message.includes('not found')) {
        db.prepare('UPDATE deleted_records SET is_synced = 1 WHERE id = ?').run(del.id);
      } else {
        throw new Error(`Delete failed on table "${del.table_name}" for ID ${del.record_id}: ${error.message}`);
      }
    }

    // 5. Sync insertions and updates in correct dependency order
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
      'supplier',
      'stock_batch',
      'item_variant_order',
      'returns',
      'sell_price_history',
      'in_out',
      'stock_unit',
      'stock_category',
      'stock_supplier',
      'stock_product',
      'stock_transaction'
    ];

    const boolKeys = [
      'is_active',
      'is_qty_managed',
      'is_discount_active',
      'is_global_discount_active',
      'is_card_payment',
      'is_enabled'
    ];

    for (const table of tables) {
      const rows = db.prepare(`SELECT * FROM ${table} WHERE is_synced = 0`).all();
      if (rows.length > 0) {
        console.log(`[Sync] Syncing ${rows.length} rows for table "${table}"`);

        // Format data to match Postgres expectations
        const cleanedRows = rows.map(row => {
          const cleaned = { ...row };
          delete cleaned.is_synced; // Remove local tracking column

          // Clean empty fields and boolean types
          Object.keys(cleaned).forEach(key => {
            if (cleaned[key] === '') {
              cleaned[key] = null;
            }
            if (boolKeys.includes(key) && cleaned[key] !== undefined && cleaned[key] !== null) {
              cleaned[key] = !!cleaned[key];
            }
          });
          return cleaned;
        });

        // Batch Upsert to Supabase
        const { error } = await supabase.from(table).upsert(cleanedRows);
        if (error) {
          if (error.message && error.message.includes('violates foreign key constraint')) {
            console.warn(`[Sync] Foreign key violation on table "${table}". Attempting to mark parent records as unsynced...`);
            handleForeignKeyFailure(db, table, cleanedRows);
          }
          throw new Error(`Upload failed on table "${table}": ${error.message}`);
        }

        // Update local rows as synced
        const idCol = table === 'global_discount_settings' ? 'key_value' : 'id';
        const ids = rows.map(r => r[idCol]);
        const stmt = db.prepare(`UPDATE ${table} SET is_synced = 1 WHERE ${idCol} = ?`);

        const updateTx = db.transaction((idList) => {
          for (const id of idList) {
            stmt.run(id);
          }
        });
        updateTx(ids);
      }
    }

    // 6. Update sync status to success
    db.prepare(`
      UPDATE sync_settings 
      SET last_sync_status = 'success', 
          last_sync_at = datetime('now', 'localtime'), 
          last_sync_error = NULL 
      WHERE id = 1
    `).run();
    console.log('[Sync] Database sync completed successfully');

  } catch (error) {
    console.error('[Sync] Sync process failed:', error.message);
    db.prepare(`
      UPDATE sync_settings 
      SET last_sync_status = 'error', 
          last_sync_error = ? 
      WHERE id = 1
    `).run(error.message);
  }
};

/**
 * Starts the periodic sync scheduler
 */
const startSyncScheduler = () => {
  if (syncInterval) {
    clearInterval(syncInterval);
  }

  console.log('[Sync] Initializing background sync scheduler...');
  
  // Trigger initial sync attempt on startup
  setTimeout(() => {
    runSync().catch(err => console.error('[Sync] Startup sync failed:', err));
  }, 5000); // Delay slightly to let the application stabilize

  // Check every 1 minute
  syncInterval = setInterval(async () => {
    const db = getDatabase();
    if (!db) return;

    try {
      const settings = db.prepare('SELECT is_enabled, last_sync_status FROM sync_settings WHERE id = 1').get();
      if (!settings || !settings.is_enabled) {
        return;
      }

      const now = Date.now();
      const intervalMs = 15 * 60 * 1000; // 15 minutes

      // Sync if 15 minutes elapsed or if sync status was manually queued/triggered
      if (now - lastRunTime >= intervalMs || settings.last_sync_status === 'pending') {
        lastRunTime = now;
        await runSync();
      }
    } catch (err) {
      console.error('[Sync] Scheduler check failed:', err.message);
    }
  }, 60000);
};

/**
 * Stops the scheduler
 */
const stopSyncScheduler = () => {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
    console.log('[Sync] Sync scheduler stopped');
  }
};

/**
 * Manually trigger sync immediately
 */
const triggerManualSync = () => {
  console.log('[Sync] Manual sync triggered');
  // Run asynchronously
  runSync().catch(err => console.error('[Sync] Manual sync failed:', err));
};

module.exports = {
  startSyncScheduler,
  stopSyncScheduler,
  triggerManualSync,
  runSync
};
