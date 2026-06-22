const express = require('express');
const router = express.Router();
const { getDatabase } = require('../database/init');

// Get all stock categories
router.get('/', (req, res) => {
  const db = getDatabase();
  try {
    const rows = db.prepare('SELECT * FROM stock_category ORDER BY name').all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get stock category by ID
router.get('/:id', (req, res) => {
  const db = getDatabase();
  const { id } = req.params;
  
  try {
    const row = db.prepare('SELECT * FROM stock_category WHERE id = ?').get(id);
    if (!row) {
      return res.status(404).json({ error: 'Stock category not found' });
    }
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create new stock category
router.post('/', (req, res) => {
  const db = getDatabase();
  const { name } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Category name is required' });
  }
  
  try {
    const result = db.prepare('INSERT INTO stock_category (name) VALUES (?)').run(name);
    res.status(201).json({
      id: result.lastInsertRowid,
      name,
      message: 'Stock category created successfully'
    });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'Category name already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// Update stock category
router.put('/:id', (req, res) => {
  const db = getDatabase();
  const { id } = req.params;
  const { name } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Category name is required' });
  }
  
  try {
    const result = db.prepare('UPDATE stock_category SET name = ? WHERE id = ?').run(name, id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Stock category not found' });
    }
    res.json({ message: 'Stock category updated successfully' });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'Category name already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// Delete stock category
router.delete('/:id', (req, res) => {
  const db = getDatabase();
  const { id } = req.params;
  
  try {
    // Check if category has products
    const row = db.prepare('SELECT COUNT(*) as count FROM stock_product WHERE category_id = ?').get(id);
    if (row && row.count > 0) {
      return res.status(409).json({ 
        error: 'Cannot delete category with existing products' 
      });
    }
    
    const result = db.prepare('DELETE FROM stock_category WHERE id = ?').run(id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Stock category not found' });
    }
    res.json({ message: 'Stock category deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
