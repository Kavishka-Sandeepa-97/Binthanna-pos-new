const express = require('express');
const router = express.Router();
const { getDatabase, getCurrentUTCTimestamp } = require('../database/init');

// Get all item variants with details
router.get('/', (req, res) => {
  const db = getDatabase();
  try {
    const rows = db.prepare(`
      SELECT iv.*, i.name as item_name, NULL as gender,
             i.category_id as category_id, v.variant_name, c.name as category_name,
             b.id as brand_id, b.brand_name as brand_name,
             b.is_discount_active as brand_discount_active,
             b.discount_type as brand_discount_type,
             b.discount_value as brand_discount_value,
             COALESCE(SUM(sb.remaining_qty), 0) as total_stock,
             COALESCE(sbp.sell_price, 0) as selling_price,
             i.id as item_id_ref,
             COALESCE(iv.created_at, i.created_at) as created_at,
             iv.is_discount_active, iv.discount_type, iv.discount_value
      FROM item i
      LEFT JOIN item_variant iv ON i.id = iv.item_id
      LEFT JOIN variant v ON iv.variant_id = v.id
      JOIN category c ON i.category_id = c.id
      LEFT JOIN brand b ON i.brand_id = b.id
      LEFT JOIN stock_batch sb ON iv.id = sb.item_variant_id
      LEFT JOIN (
        SELECT item_variant_id, sell_price,
               ROW_NUMBER() OVER (
                 PARTITION BY item_variant_id
                 ORDER BY
                   CASE WHEN remaining_qty > 0 THEN 0 ELSE 1 END,
                   CASE WHEN expire_date IS NULL THEN 1 ELSE 0 END,
                   DATE(expire_date) ASC,
                   created_at ASC,
                   id ASC
               ) as rn
        FROM stock_batch
      ) sbp ON iv.id = sbp.item_variant_id AND sbp.rn = 1
      GROUP BY i.id, iv.id
      ORDER BY COALESCE(iv.created_at, i.created_at) DESC, i.name, v.variant_name
    `).all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get item variant by ID
router.get('/:id', (req, res) => {
  const db = getDatabase();
  const { id } = req.params;

  try {
    const row = db.prepare(`
      SELECT iv.*, i.name as item_name, i.image, NULL as gender,
             i.category_id as category_id, v.variant_name, c.name as category_name,
             b.id as brand_id, b.brand_name as brand_name,
             b.is_discount_active as brand_discount_active,
             b.discount_type as brand_discount_type,
             b.discount_value as brand_discount_value,
             COALESCE(SUM(sb.remaining_qty), 0) as total_stock,
             COALESCE(sbp.sell_price, 0) as selling_price,
             iv.is_discount_active, iv.discount_type, iv.discount_value
      FROM item_variant iv
      JOIN item i ON iv.item_id = i.id
      JOIN variant v ON iv.variant_id = v.id
      JOIN category c ON i.category_id = c.id
      LEFT JOIN brand b ON i.brand_id = b.id
      LEFT JOIN stock_batch sb ON iv.id = sb.item_variant_id
      LEFT JOIN (
        SELECT item_variant_id, sell_price,
               ROW_NUMBER() OVER (
                 PARTITION BY item_variant_id
                 ORDER BY
                   CASE WHEN remaining_qty > 0 THEN 0 ELSE 1 END,
                   CASE WHEN expire_date IS NULL THEN 1 ELSE 0 END,
                   DATE(expire_date) ASC,
                   created_at ASC,
                   id ASC
               ) as rn
        FROM stock_batch
      ) sbp ON iv.id = sbp.item_variant_id AND sbp.rn = 1
      WHERE iv.id = ?
      GROUP BY iv.id
    `).get(id);

    if (!row) {
      return res.status(404).json({ error: 'Item variant not found' });
    }

    const availableBatches = db.prepare(`
      SELECT id, remaining_qty, sell_price, buy_price, expire_date, created_at
      FROM stock_batch
      WHERE item_variant_id = ? AND remaining_qty > 0
      ORDER BY
        CASE WHEN expire_date IS NULL THEN 1 ELSE 0 END,
        DATE(expire_date) ASC,
        created_at ASC,
        id ASC
    `).all(id);

    res.json({
      ...row,
      selling_price: availableBatches.length > 0 ? availableBatches[0].sell_price : (row.selling_price || 0),
      available_batches: availableBatches,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create new item variant
router.post('/', (req, res) => {
  const db = getDatabase();
  const { variant_id, item_id, barcode } = req.body;

  if (!variant_id || !item_id) {
    return res.status(400).json({ error: 'Variant ID and Item ID are required' });
  }

  try {
    // Check if variant exists
    const variant = db.prepare('SELECT id FROM variant WHERE id = ?').get(variant_id);
    if (!variant) {
      return res.status(404).json({ error: 'Variant not found' });
    }

    // Check if item exists
    const item = db.prepare('SELECT id FROM item WHERE id = ?').get(item_id);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const { is_discount_active, discount_type, discount_value } = req.body;
    const result = db.prepare('INSERT INTO item_variant (variant_id, item_id, barcode, is_discount_active, discount_type, discount_value, created_at, is_synced) VALUES (?, ?, ?, ?, ?, ?, ?, 0)').run(variant_id, item_id, barcode, is_discount_active ? 1 : 0, discount_type || null, parseFloat(discount_value) || 0, getCurrentUTCTimestamp());
    const newVariantId = result.lastInsertRowid;

    res.status(201).json({
      id: newVariantId,
      variant_id,
      item_id,
      barcode,
      message: 'Item variant created successfully. Add stock batch with selling price next.'
    });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'Barcode already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// Update item variant
router.put('/:id', (req, res) => {
  const db = getDatabase();
  const { id } = req.params;
  const { variant_id, item_id, barcode, is_discount_active, discount_type, discount_value } = req.body;

  let updateFields = [];
  let values = [];

  if (variant_id) {
    updateFields.push('variant_id = ?');
    values.push(variant_id);
  }
  if (item_id) {
    updateFields.push('item_id = ?');
    values.push(item_id);
  }
  if (barcode !== undefined) {
    updateFields.push('barcode = ?');
    values.push(barcode);
  }
  if (is_discount_active !== undefined) {
    updateFields.push('is_discount_active = ?');
    values.push(is_discount_active ? 1 : 0);
  }
  if (discount_type !== undefined) {
    updateFields.push('discount_type = ?');
    values.push(discount_type || null);
  }
  if (discount_value !== undefined) {
    updateFields.push('discount_value = ?');
    values.push(parseFloat(discount_value) || 0);
  }

  if (updateFields.length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  updateFields.push('is_synced = 0');
  updateFields.push('updated_at = ?');
  values.push(getCurrentUTCTimestamp());

  values.push(id);

  try {
    const result = db.prepare(`UPDATE item_variant SET ${updateFields.join(', ')} WHERE id = ?`).run(...values);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Item variant not found' });
    }
    res.json({ message: 'Item variant updated successfully' });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'Barcode already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// Delete item variant
router.delete('/:id', (req, res) => {
  const db = getDatabase();
  const { id } = req.params;

  try {
    // Check if item variant has stock or orders
    const stockRow = db.prepare('SELECT COUNT(*) as stock_count FROM stock_batch WHERE item_variant_id = ?').get(id);
    const orderRow = db.prepare('SELECT COUNT(*) as order_count FROM item_variant_order WHERE item_variant_id = ?').get(id);

    if (stockRow.stock_count > 0 || orderRow.order_count > 0) {
      return res.status(409).json({
        error: 'Cannot delete item variant with existing stock or orders.'
      });
    }

    const result = db.prepare('DELETE FROM item_variant WHERE id = ?').run(id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Item variant not found' });
    }
    res.json({ message: 'Item variant deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Search item variants by barcode
router.get('/barcode/:barcode', (req, res) => {
  const db = getDatabase();
  const { barcode } = req.params;

  try {
    const row = db.prepare(`
      SELECT iv.*, i.name as item_name, i.image, NULL as gender,
             v.variant_name, c.name as category_name,
             b.id as brand_id, b.brand_name as brand_name,
             b.is_discount_active as brand_discount_active,
             b.discount_type as brand_discount_type,
             b.discount_value as brand_discount_value,
             iv.is_discount_active, iv.discount_type, iv.discount_value
      FROM item_variant iv
      JOIN item i ON iv.item_id = i.id
      JOIN variant v ON iv.variant_id = v.id
      JOIN category c ON i.category_id = c.id
      LEFT JOIN brand b ON i.brand_id = b.id
      WHERE iv.barcode = ?
    `).get(barcode);

    if (!row) {
      return res.status(404).json({ error: 'Item variant not found' });
    }

    // Get stock separately
    const stockRow = db.prepare(`
      SELECT COALESCE(SUM(remaining_qty), 0) as total_stock
      FROM stock_batch
      WHERE item_variant_id = ?
    `).get(row.id);

    // Get available batches in FIFO order (expiry first, then created_at)
    const availableBatches = db.prepare(`
      SELECT id, remaining_qty, sell_price, buy_price, expire_date, created_at
      FROM stock_batch
      WHERE item_variant_id = ? AND remaining_qty > 0
      ORDER BY
        CASE WHEN expire_date IS NULL THEN 1 ELSE 0 END,
        DATE(expire_date) ASC,
        created_at ASC,
        id ASC
    `).all(row.id);

    // Combine all data - selling_price is the FIFO (oldest) batch price
    const result = {
      ...row,
      total_stock: stockRow?.total_stock || 0,
      selling_price: availableBatches.length > 0 ? availableBatches[0].sell_price : 0,
      available_batches: availableBatches,
    };

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Set selling price for item variant
router.post('/:id/price', (req, res) => {
  const db = getDatabase();
  const { id } = req.params;
  const { selling_price } = req.body;

  if (selling_price === undefined || selling_price === null || selling_price === '') {
    return res.status(400).json({ error: 'Selling price is required' });
  }

  try {
    const latestBatch = db.prepare(`
      SELECT id
      FROM stock_batch
      WHERE item_variant_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `).get(id);

    if (!latestBatch) {
      return res.status(404).json({ error: 'No stock batch found for this item variant' });
    }

    db.prepare('UPDATE stock_batch SET sell_price = ?, updated_at = ? WHERE id = ?')
      .run(parseFloat(selling_price), getCurrentUTCTimestamp(), latestBatch.id);

    res.status(200).json({
      item_variant_id: id,
      stock_batch_id: latestBatch.id,
      selling_price: parseFloat(selling_price),
      message: 'Latest stock batch price updated successfully'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;