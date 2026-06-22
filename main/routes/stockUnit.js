const express = require('express');
const router = express.Router();
const { getDatabase } = require('../database/init');

// Get all units
router.get('/', (req, res) => {
  const db = getDatabase();
  try {
    const rows = db.prepare('SELECT * FROM stock_unit ORDER BY name').all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get unit by ID
router.get('/:id', (req, res) => {
  const db = getDatabase();
  const { id } = req.params;
  
  try {
    const row = db.prepare('SELECT * FROM stock_unit WHERE id = ?').get(id);
    if (!row) {
      return res.status(404).json({ error: 'Unit not found' });
    }
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create new unit
router.post('/', (req, res) => {
  const db = getDatabase();
  const { name } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Unit name is required' });
  }
  
  try {
    const result = db.prepare('INSERT INTO stock_unit (name) VALUES (?)').run(name);
    res.status(201).json({
      id: result.lastInsertRowid,
      name,
      message: 'Unit created successfully'
    });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'Unit name already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// Update unit
router.put('/:id', (req, res) => {
  const db = getDatabase();
  const { id } = req.params;
  const { name } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Unit name is required' });
  }
  
  try {
    const result = db.prepare('UPDATE stock_unit SET name = ? WHERE id = ?').run(name, id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Unit not found' });
    }
    res.json({ message: 'Unit updated successfully' });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'Unit name already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// Delete unit
router.delete('/:id', (req, res) => {
  const db = getDatabase();
  const { id } = req.params;
  
  try {
    // Check if unit is being used by products
    const row = db.prepare('SELECT COUNT(*) as count FROM stock_product WHERE unit_id = ?').get(id);
    if (row && row.count > 0) {
      return res.status(409).json({ 
        error: 'Cannot delete unit that is being used by products' 
      });
    }
    
    const result = db.prepare('DELETE FROM stock_unit WHERE id = ?').run(id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Unit not found' });
    }
    res.json({ message: 'Unit deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
