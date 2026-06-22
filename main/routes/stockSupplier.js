const express = require('express');
const router = express.Router();
const { getDatabase } = require('../database/init');

// Get all suppliers
router.get('/', (req, res) => {
  const db = getDatabase();
  try {
    const rows = db.prepare('SELECT * FROM stock_supplier ORDER BY name').all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get supplier by ID
router.get('/:id', (req, res) => {
  const db = getDatabase();
  const { id } = req.params;
  
  try {
    const row = db.prepare('SELECT * FROM stock_supplier WHERE id = ?').get(id);
    if (!row) {
      return res.status(404).json({ error: 'Supplier not found' });
    }
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create new supplier
router.post('/', (req, res) => {
  const db = getDatabase();
  const { name, description } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Supplier name is required' });
  }
  
  try {
    const result = db.prepare('INSERT INTO stock_supplier (name, description) VALUES (?, ?)').run(name, description || null);
    res.status(201).json({
      id: result.lastInsertRowid,
      name,
      description,
      message: 'Supplier created successfully'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update supplier
router.put('/:id', (req, res) => {
  const db = getDatabase();
  const { id } = req.params;
  const { name, description } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Supplier name is required' });
  }
  
  try {
    const result = db.prepare('UPDATE stock_supplier SET name = ?, description = ? WHERE id = ?').run(name, description || null, id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Supplier not found' });
    }
    res.json({ message: 'Supplier updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete supplier
router.delete('/:id', (req, res) => {
  const db = getDatabase();
  const { id } = req.params;
  
  try {
    // Check if supplier has transactions
    const row = db.prepare('SELECT COUNT(*) as count FROM stock_transaction WHERE supplier_id = ?').get(id);
    if (row && row.count > 0) {
      return res.status(409).json({ 
        error: 'Cannot delete supplier with existing transactions' 
      });
    }
    
    const result = db.prepare('DELETE FROM stock_supplier WHERE id = ?').run(id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Supplier not found' });
    }
    res.json({ message: 'Supplier deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
