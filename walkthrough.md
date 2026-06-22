# Developer Documentation: POS SQLite to Supabase Sync Architecture

This document describes the synchronization system implemented in the Binthanna Restaurant POS application. It acts as a comprehensive reference guide for other developers or AI assistants to understand the design patterns, code structure, and databases involved.

---

## 1. Architecture Overview (Offline-First Design)

The system is designed as an **offline-first application**:
* **Primary Database (Local):** **SQLite** (`better-sqlite3`) runs locally on the POS machine. All transactional and master data operations are executed directly against this database. The application does not require internet connectivity to perform billing, stock operations, or cashier management.
* **Secondary Database (Cloud):** **Supabase (PostgreSQL)** serves as a cloud-based, read-only mirror of the local database. A mobile app or web dashboard queries this cloud database to display business analytics.
* **Data Flow Direction:** One-way synchronization from **Local SQLite ➡️ Supabase Cloud**. No writes or edits are fetched from Supabase back to the local database, eliminating standard multi-master conflict resolution issues.

---

## 2. Sync Mechanism & Design Patterns

### A. Delta Syncing (`is_synced` Flag)
Every sync-enabled table in SQLite contains an `is_synced` column (`BOOLEAN DEFAULT 0`).
* **Inserts:** When a row is inserted, `is_synced` is set to `0`.
* **Updates:** When a row is modified via backend routes, `is_synced` is reset to `0`.
* **Upload:** The background service queries rows where `is_synced = 0`, upserts them to Supabase, and updates their local `is_synced` status to `1`.

### B. Delete Tracking (SQLite Triggers / Log Queue)
Because standard SQL `DELETE` queries remove rows entirely, we cannot track what was deleted by simply inspecting remaining rows. Instead of modifying all application controllers to use "soft deletes", we utilize database-level triggers:
* **Log Table:** A `deleted_records` table logs the table name and the primary key (`record_id`) of deleted rows.
* **Triggers:** A trigger (`AFTER DELETE`) is dynamically attached to all sync-enabled tables in SQLite.
* **Syncing Deletes:** The background sync service reads unsynced deletes, calls the Supabase API to delete matching IDs, and marks the logs as synced.

### C. Dependency-Ordered Synchronization
To prevent Foreign Key constraint failures in PostgreSQL, the tables are synchronized in a strict sequential order based on their relationships:
1. `users` (independent)
2. `cashier_shift` (depends on `users`)
3. `brand` (independent)
4. `category` (hierarchical self-references)
5. `item` (depends on `category`, `brand`)
6. `variant` (independent)
7. `item_variant` (depends on `variant`, `item`)
8. `global_discount_settings` (independent)
9. `orders` (depends on `users`)
10. `supplier` (independent)
11. `stock_batch` (depends on `item_variant`, `supplier`)
12. `item_variant_order` (depends on `item_variant`, `orders`, `stock_batch`)
13. `returns` (depends on `users`, `item_variant_order`, `orders`)
14. `sell_price_history` (depends on `item_variant`, `users`, `stock_batch`)
15. `in_out` (depends on `users`)
16. `stock_unit` (independent)
17. `stock_category` (independent)
18. `stock_supplier` (independent)
19. `stock_product` (depends on `stock_category`, `stock_unit`)
20. `stock_transaction` (depends on `stock_product`, `stock_supplier`, `users`)

---

## 3. Directory Map & File Changes

The synchronization codebase spans the following files:

### Backend (Electron / Express / Node.js)
1. **[main/database/init.js](file:///d:/Binthanna/new/main/database/init.js)**
   * Defines database schemas for `sync_settings` and `deleted_records`.
   * Inserts default sync config `(id = 1, is_enabled = 0)` on initialization.
   * `createSyncTriggers()`: Loops through tables and dynamically creates `AFTER DELETE` triggers.
   * `addSyncColumnsIfMissing()`: Safe database migration function. On app start, it inspects existing local SQLite tables and appends the `is_synced` column if missing, preventing errors on existing installations.
2. **[main/services/syncService.js](file:///d:/Binthanna/new/main/services/syncService.js)**
   * Core synchronization logic.
   * **Node WebSocket Polyfill:** Injects a mock `WebSocket` class onto `global` to bypass Supabase JS Client initialization checks (which throw in Node 18 since WebSockets aren't natively present and are only needed for real-time channels which this POS doesn't use).
   * `runSync()`: Connects to Supabase, checks internet connectivity, processes deletions, batch-upserts data, maps SQLite data types (converting integer flags to Javascript booleans), and logs execution statuses (e.g. `'syncing'`, `'success'`, `'error'`).
   * `startSyncScheduler()` / `stopSyncScheduler()`: Background interval timer checking sync status every 60 seconds (executing sync every 15 minutes or when manually triggered).
3. **[main/routes/sync.js](file:///d:/Binthanna/new/main/routes/sync.js)**
   * Express endpoints to retrieve (`GET /api/sync/settings`), save (`PUT /api/sync/settings`), and manually run (`POST /api/sync/trigger`) sync routines.
4. **[main/server.js](file:///d:/Binthanna/new/main/server.js)**
   * Registers `/api/sync` route middleware.
5. **[main/main.js](file:///d:/Binthanna/new/main/main.js)**
   * Starts sync scheduler background loops on window creation (`createWindow()`).
   * Gracefully triggers a final database sync and clears intervals when the application is closing (`app.on('before-quit')`).

### Frontend (React / MUI)
1. **[render/src/services/api.js](file:///d:/Binthanna/new/render/src/services/api.js)**
   * Adds `api.sync` helper methods wrapper (`getSettings`, `updateSettings`, `triggerSync`).
2. **[render/src/components/settings/Settings.jsx](file:///d:/Binthanna/new/render/src/components/settings/Settings.jsx)**
   * Implements a custom **Cloud Sync** tab panel in the POS Settings UI.
   * Toggle switches to turn sync on/off, input fields for Supabase credentials (masked API Keys), status indicators (loading spinners, success logs, or warning error banners), and a **Sync Now** trigger button.
   * Implements optimized polling: checks sync statuses every 5 seconds when the sync tab is active, while preserving the user's active keyboard inputs/typing and avoiding draft reset overlaps.

---

## 4. How to Set Up Supabase (Database Schema Setup)

Copy and execute the following PostgreSQL script in the **Supabase SQL Editor** to generate the sync schemas:

```sql
-- 1. Users
CREATE TABLE IF NOT EXISTS users (
  id BIGINT PRIMARY KEY,
  name TEXT NOT NULL,
  username TEXT,
  pin TEXT NOT NULL,
  role TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Cashier Shift
CREATE TABLE IF NOT EXISTS cashier_shift (
  id BIGINT PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  initial_cash_onhand DECIMAL(10,2),
  current_cash_onhand DECIMAL(10,2),
  open_at TIMESTAMP WITH TIME ZONE,
  close_at TIMESTAMP WITH TIME ZONE,
  description TEXT,
  status TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Brand
CREATE TABLE IF NOT EXISTS brand (
  id BIGINT PRIMARY KEY,
  brand_name TEXT NOT NULL,
  description TEXT,
  is_discount_active BOOLEAN DEFAULT FALSE,
  discount_type TEXT,
  discount_value DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Category
CREATE TABLE IF NOT EXISTS category (
  id BIGINT PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id BIGINT REFERENCES category(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Item
CREATE TABLE IF NOT EXISTS item (
  id BIGINT PRIMARY KEY,
  category_id BIGINT REFERENCES category(id) ON DELETE SET NULL,
  brand_id BIGINT REFERENCES brand(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  image TEXT,
  is_qty_managed BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Variant
CREATE TABLE IF NOT EXISTS variant (
  id BIGINT PRIMARY KEY,
  variant_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Item Variant
CREATE TABLE IF NOT EXISTS item_variant (
  id BIGINT PRIMARY KEY,
  variant_id BIGINT REFERENCES variant(id) ON DELETE CASCADE,
  item_id BIGINT REFERENCES item(id) ON DELETE CASCADE,
  barcode TEXT,
  is_discount_active BOOLEAN DEFAULT FALSE,
  discount_type TEXT,
  discount_value DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Global Discount Settings
CREATE TABLE IF NOT EXISTS global_discount_settings (
  key_value TEXT PRIMARY KEY,
  is_global_discount_active BOOLEAN DEFAULT FALSE,
  global_discount_type TEXT,
  global_discount_value DECIMAL(10,2) DEFAULT 0,
  min_order_amount DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. Orders
CREATE TABLE IF NOT EXISTS orders (
  id BIGINT PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  additional_charges DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,
  customer_name TEXT,
  table_number TEXT,
  status TEXT DEFAULT 'active',
  tender_cash DECIMAL(10,2),
  discount_type TEXT,
  discount_value DECIMAL(10,2) DEFAULT 0,
  is_card_payment BOOLEAN DEFAULT FALSE,
  barcode TEXT,
  credit_from_return DECIMAL(10,2) DEFAULT 0
);

-- 10. Item Variant Order
CREATE TABLE IF NOT EXISTS item_variant_order (
  id BIGINT PRIMARY KEY,
  item_variant_id BIGINT REFERENCES item_variant(id) ON DELETE SET NULL,
  order_id BIGINT REFERENCES orders(id) ON DELETE CASCADE,
  stock_batch_id BIGINT,
  qty INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  discount_source TEXT,
  discount_type TEXT,
  discount_value DECIMAL(10,2) DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  original_price DECIMAL(10,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 11. Returns
CREATE TABLE IF NOT EXISTS returns (
  id BIGINT PRIMARY KEY,
  qty INTEGER NOT NULL,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  total_refund_amount DECIMAL(10,2) NOT NULL,
  item_variant_order_id BIGINT REFERENCES item_variant_order(id) ON DELETE SET NULL,
  order_id BIGINT REFERENCES orders(id) ON DELETE SET NULL,
  reason TEXT
);

-- 12. Sell Price History
CREATE TABLE IF NOT EXISTS sell_price_history (
  id BIGINT PRIMARY KEY,
  item_variant_id BIGINT REFERENCES item_variant(id) ON DELETE CASCADE,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  stock_batch_id BIGINT,
  selling_price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 13. In/Out Expense
CREATE TABLE IF NOT EXISTS in_out (
  id BIGINT PRIMARY KEY,
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 14. Supplier
CREATE TABLE IF NOT EXISTS supplier (
  id BIGINT PRIMARY KEY,
  name TEXT NOT NULL,
  phone_number TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 15. Stock Batch
CREATE TABLE IF NOT EXISTS stock_batch (
  id BIGINT PRIMARY KEY,
  item_variant_id BIGINT REFERENCES item_variant(id) ON DELETE CASCADE,
  buy_price DECIMAL(10,2) NOT NULL,
  sell_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  initial_qty INTEGER NOT NULL,
  remaining_qty INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  description TEXT,
  expire_date DATE,
  supplier_id BIGINT REFERENCES supplier(id) ON DELETE SET NULL,
  is_returned BOOLEAN DEFAULT FALSE
);

-- 16. Stock Unit
CREATE TABLE IF NOT EXISTS stock_unit (
  id BIGINT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

-- 17. Stock Category
CREATE TABLE IF NOT EXISTS stock_category (
  id BIGINT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

-- 18. Stock Supplier
CREATE TABLE IF NOT EXISTS stock_supplier (
  id BIGINT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT
);

-- 19. Stock Product
CREATE TABLE IF NOT EXISTS stock_product (
  id BIGINT PRIMARY KEY,
  name TEXT NOT NULL,
  category_id BIGINT REFERENCES stock_category(id) ON DELETE RESTRICT,
  unit_id BIGINT REFERENCES stock_unit(id) ON DELETE RESTRICT,
  current_qty DECIMAL(10,2) DEFAULT 0
);

-- 20. Stock Transaction
CREATE TABLE IF NOT EXISTS stock_transaction (
  id BIGINT PRIMARY KEY,
  product_id BIGINT REFERENCES stock_product(id) ON DELETE CASCADE,
  supplier_id BIGINT REFERENCES stock_supplier(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  description TEXT,
  type TEXT NOT NULL,
  price DECIMAL(10,2),
  qty DECIMAL(10,2) NOT NULL,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL
);
```

---

## 5. Troubleshooting & Maintenance Queries

### A. Resetting Cloud Data (Supabase Truncate)
To delete all data on Supabase tables to perform a completely fresh synchronization from scratch, run this in your **Supabase SQL Editor**:

```sql
TRUNCATE TABLE 
  users, 
  cashier_shift, 
  brand, 
  category, 
  item, 
  variant, 
  item_variant, 
  global_discount_settings, 
  orders, 
  item_variant_order, 
  returns, 
  sell_price_history, 
  in_out, 
  supplier, 
  stock_batch, 
  stock_unit, 
  stock_category, 
  stock_supplier, 
  stock_product, 
  stock_transaction 
CASCADE;
```

### B. Force SQLite to Resync All Local Data
If cloud data is truncated, local tables still have `is_synced = 1`. To force SQLite to mark all records as unsynced so that the scheduler uploads all existing local data again, execute this query in your **SQLite Database Editor** on the POS machine:

```sql
-- Reset sync flags
UPDATE users SET is_synced = 0;
UPDATE cashier_shift SET is_synced = 0;
UPDATE brand SET is_synced = 0;
UPDATE category SET is_synced = 0;
UPDATE item SET is_synced = 0;
UPDATE variant SET is_synced = 0;
UPDATE item_variant SET is_synced = 0;
UPDATE global_discount_settings SET is_synced = 0;
UPDATE orders SET is_synced = 0;
UPDATE item_variant_order SET is_synced = 0;
UPDATE returns SET is_synced = 0;
UPDATE sell_price_history SET is_synced = 0;
UPDATE in_out SET is_synced = 0;
UPDATE supplier SET is_synced = 0;
UPDATE stock_batch SET is_synced = 0;
UPDATE stock_unit SET is_synced = 0;
UPDATE stock_category SET is_synced = 0;
UPDATE stock_supplier SET is_synced = 0;
UPDATE stock_product SET is_synced = 0;
UPDATE stock_transaction SET is_synced = 0;

-- Clear deletions logs queue
DELETE FROM deleted_records;
```
