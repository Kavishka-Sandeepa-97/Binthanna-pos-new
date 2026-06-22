const express = require('express');
const router = express.Router();
const { getDatabase } = require('../database/init');

// Get all products with category and unit info
router.get('/', (req, res) => {
  const db = getDatabase();
  try {
    const rows = db.prepare(
      `SELECT 
        sp.*,
        sc.name as category_name,
        u.name as unit_name
      FROM stock_product sp
      LEFT JOIN stock_category sc ON sp.category_id = sc.id
      LEFT JOIN stock_unit u ON sp.unit_id = u.id
      ORDER BY sp.name`
    ).all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get product by ID
router.get('/:id', (req, res) => {
  const db = getDatabase();
  const { id } = req.params;
  
  try {
    const row = db.prepare(
      `SELECT 
        sp.*,
        sc.name as category_name,
        u.name as unit_name
      FROM stock_product sp
      LEFT JOIN stock_category sc ON sp.category_id = sc.id
      LEFT JOIN stock_unit u ON sp.unit_id = u.id
      WHERE sp.id = ?`
    ).get(id);
    
    if (!row) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create new product
router.post('/', (req, res) => {
  const db = getDatabase();
  const { name, category_id, unit_id, current_qty } = req.body;
  
  if (!name || !category_id || !unit_id) {
    return res.status(400).json({ 
      error: 'Product name, category, and unit are required' 
    });
  }
  
  try {
    const result = db.prepare(
      'INSERT INTO stock_product (name, category_id, unit_id, current_qty) VALUES (?, ?, ?, ?)'
    ).run(name, category_id, unit_id, current_qty || 0);
    
    res.status(201).json({
      id: result.lastInsertRowid,
      name,
      category_id,
      unit_id,
      current_qty: current_qty || 0,
      message: 'Product created successfully'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update product
router.put('/:id', (req, res) => {
  const db = getDatabase();
  const { id } = req.params;
  const { name, category_id, unit_id } = req.body;
  
  if (!name || !category_id || !unit_id) {
    return res.status(400).json({ 
      error: 'Product name, category, and unit are required' 
    });
  }
  
  try {
    const result = db.prepare(
      'UPDATE stock_product SET name = ?, category_id = ?, unit_id = ? WHERE id = ?'
    ).run(name, category_id, unit_id, id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json({ message: 'Product updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete product
router.delete('/:id', (req, res) => {
  const db = getDatabase();
  const { id } = req.params;
  
  try {
    // Check if product has transactions
    const row = db.prepare('SELECT COUNT(*) as count FROM stock_transaction WHERE product_id = ?').get(id);
    if (row && row.count > 0) {
      return res.status(409).json({ 
        error: 'Cannot delete product with existing transactions' 
      });
    }
    
    const result = db.prepare('DELETE FROM stock_product WHERE id = ?').run(id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json({ message: 'Product deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
