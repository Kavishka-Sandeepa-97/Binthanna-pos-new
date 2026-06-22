const express = require('express');
const router = express.Router();
const { getDatabase, getCurrentUTCTimestamp } = require('../database/init');

// Get all items with category info
router.get('/', (req, res) => {
  const db = getDatabase();
  try {
    const rows = db.prepare(`
      SELECT i.*, c.name as category_name 
      FROM item i 
      JOIN category c ON i.category_id = c.id 
      ORDER BY c.name, i.name
    `).all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get item by ID with variants
router.get('/:id', (req, res) => {
  const db = getDatabase();
  const { id } = req.params;

  try {
    // Get item details
    const item = db.prepare(`
      SELECT i.*, c.name as category_name 
      FROM item i 
      JOIN category c ON i.category_id = c.id 
      WHERE i.id = ?
    `).get(id);

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Get item variants
    const variants = db.prepare(`
      SELECT iv.*, v.variant_name, 
             COALESCE(SUM(sb.remaining_qty), 0) as total_stock,
             COALESCE(sbp.sell_price, 0) as selling_price
      FROM item_variant iv
      JOIN variant v ON iv.variant_id = v.id
      LEFT JOIN stock_batch sb ON iv.id = sb.item_variant_id
      LEFT JOIN (
        SELECT item_variant_id, sell_price,
               ROW_NUMBER() OVER (PARTITION BY item_variant_id ORDER BY created_at DESC, id DESC) as rn
        FROM stock_batch
      ) sbp ON iv.id = sbp.item_variant_id AND sbp.rn = 1
      WHERE iv.item_id = ?
      GROUP BY iv.id, sbp.sell_price
      ORDER BY v.variant_name
    `).all(id);

    res.json({
      ...item,
      variants: variants
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create new item
router.post('/', (req, res) => {
  const db = getDatabase();
  const { category_id, brand_id, name, image, is_qty_managed } = req.body;

  if (!category_id || !name) {
    return res.status(400).json({ error: 'Category ID and name are required' });
  }

  try {
    // Check if category exists
    const category = db.prepare('SELECT id FROM category WHERE id = ?').get(category_id);
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Check if brand exists (if provided)
    if (brand_id) {
      const brand = db.prepare('SELECT id FROM brand WHERE id = ?').get(brand_id);
      if (!brand) {
        return res.status(404).json({ error: 'Brand not found' });
      }
    }

    const qtyManaged = is_qty_managed !== undefined ? (parseBoolean(is_qty_managed, true) ? 1 : 0) : 1;

    const result = db.prepare('INSERT INTO item (category_id, brand_id, name, image, is_qty_managed, created_at, is_synced) VALUES (?, ?, ?, ?, ?, ?, 0)').run(category_id, brand_id || null, name, image, qtyManaged, getCurrentUTCTimestamp());
    
    res.status(201).json({
      id: result.lastInsertRowid,
      category_id,
      brand_id,
      name,
      image,
      is_qty_managed: qtyManaged,
      message: 'Item created successfully'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Helper to parse boolean values
const parseBoolean = (value, fallback = false) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'boolean') return value;
  const str = String(value).toLowerCase().trim();
  return str === 'true' || str === '1' || str === 'yes';
};

// Update item
router.put('/:id', (req, res) => {
  const db = getDatabase();
  const { id } = req.params;
  const { category_id, brand_id, name, image, is_qty_managed } = req.body;

  let updateFields = [];
  let values = [];

  if (category_id) {
    updateFields.push('category_id = ?');
    values.push(category_id);
  }
  if (brand_id !== undefined) {
    updateFields.push('brand_id = ?');
    values.push(brand_id || null);
  }
  if (name) {
    updateFields.push('name = ?');
    values.push(name);
  }
  if (image !== undefined) {
    updateFields.push('image = ?');
    values.push(image);
  }
  if (is_qty_managed !== undefined) {
    updateFields.push('is_qty_managed = ?');
    values.push(parseBoolean(is_qty_managed, true) ? 1 : 0);
  }

  if (updateFields.length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  updateFields.push('is_synced = 0');
  updateFields.push('updated_at = ?');
  values.push(getCurrentUTCTimestamp());

  values.push(id);

  try {
    const result = db.prepare(`UPDATE item SET ${updateFields.join(', ')} WHERE id = ?`).run(...values);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json({ message: 'Item updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete item
router.delete('/:id', (req, res) => {
  const db = getDatabase();
  const { id } = req.params;

  try {
    // Check if item has variants
    const row = db.prepare('SELECT COUNT(*) as count FROM item_variant WHERE item_id = ?').get(id);

    if (row.count > 0) {
      return res.status(409).json({
        error: 'Cannot delete item with existing variants. Please delete variants first.'
      });
    }

    const result = db.prepare('DELETE FROM item WHERE id = ?').run(id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json({ message: 'Item deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Search items
router.get('/search/:query', (req, res) => {
  const db = getDatabase();
  const { query } = req.params;

  try {
    const rows = db.prepare(`
      SELECT i.*, c.name as category_name 
      FROM item i 
      JOIN category c ON i.category_id = c.id 
      WHERE i.name LIKE ? OR c.name LIKE ?
      ORDER BY i.name
    `).all(`%${query}%`, `%${query}%`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;