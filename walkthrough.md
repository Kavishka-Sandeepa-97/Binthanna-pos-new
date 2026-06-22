# Walkthrough: Database Cloud Sync System

We have successfully implemented a database synchronization system that replicates your local SQLite database to a cloud Supabase database. This enables dashboard analytics on mobile phones or other devices while maintaining a fast, offline-capable local POS system.

---

## What We Built

1. **Delete Log and Triggers:** Created `deleted_records` table and `AFTER DELETE` triggers in SQLite to track all record deletions locally without altering any existing application route logic.
2. **Settings Database Table:** Added a `sync_settings` table to securely store sync configuration (URL, Secret Key, enabled state, status, last sync timestamp, and error logs).
3. **Background Sync Service:** Built a Node.js sync service (`main/services/syncService.js`) running in the Electron main process. It pings Supabase and batch-uploads newly created/updated data (where `is_synced = 0`) and propagates tracked deletions.
4. **API Endpoints:** Created Express routes (`/api/sync/settings`, `/api/sync/trigger`) to handle settings updates and manual sync requests.
5. **Settings UI Dashboard:** Added a new **Cloud Sync** tab to the Settings page in the React POS UI, providing toggle controls, credential fields, real-time sync status chips, error logs, and a "Sync Now" button.

---

## Step 1: Create Supabase Tables

Follow these steps to set up the tables on your Supabase database:

1. Log in to your [Supabase Dashboard](https://supabase.com/dashboard).
2. Create a new project (e.g. named `Binthanna POS`).
3. Click on your project and select **SQL Editor** from the left-hand navigation menu.
4. Click **New Query** -> **Blank Query**.
5. Copy and paste the following SQL script into the editor, then click **Run**:

```sql
-- Disable Row Level Security (RLS) or set permissive policies for testing. 
-- Since we are connecting using the service_role key from POS, RLS is automatically bypassed for sync uploads.
-- If you want your React mobile dashboard to read the tables, enable RLS and add a SELECT policy for Authenticated or Anon users.

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

## Step 2: Retrieve API Keys and Configure Sync

1. Go to your **Supabase Dashboard** -> **Project Settings** (Gear icon in left panel).
2. Go to **API**.
3. Under **Project API keys**, copy:
   - **Project URL**
   - **service_role key** (Click *Reveal* to show it). *Warning: Do not share the service role key publicly! It is safe inside the Electron POS database, but do not post it online.*
4. Start your local POS application.
5. Navigate to **Settings** in the POS sidebar.
6. Click the new **Cloud Sync** tab.
7. Switch the toggle on to **Enable Sync**.
8. Paste the **Project URL** and the **service_role API Key** in their respective fields.
9. Click **Save Settings**.

---

## Step 3: Test Synchronization

1. In the **Cloud Sync** tab, click **Sync Now**.
2. The status chip should show **Syncing...** and then change to **Synced Successfully** once it completes (usually 1-3 seconds).
3. If there is a connection issue, it will display **Sync Error** with a detailed error log directly in the panel.
4. Once successful, visit your Supabase dashboard **Table Editor** to view your synchronized SQLite tables and POS transactions!

---

## Resetting Cloud Data (Supabase Truncate)

If you ever need to clear all data from Supabase to perform a clean resync from scratch, copy and run this SQL script in your **Supabase SQL Editor**:

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
