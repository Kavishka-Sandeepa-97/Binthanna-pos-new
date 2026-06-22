const express = require('express');
const router = express.Router();
const { getDatabase, getCurrentUTCTimestamp } = require('../database/init');

// Get all variants
router.get('/', (req, res) => {
  const db = getDatabase();
  try {
    const rows = db.prepare('SELECT * FROM variant ORDER BY variant_name').all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get variant by ID
router.get('/:id', (req, res) => {
  const db = getDatabase();
  const { id } = req.params;
  
  try {
    const row = db.prepare('SELECT * FROM variant WHERE id = ?').get(id);
    if (!row) {
      return res.status(404).json({ error: 'Variant not found' });
    }
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create new variant
router.post('/', (req, res) => {
  const db = getDatabase();
  const { variant_name } = req.body;
  
  if (!variant_name) {
    return res.status(400).json({ error: 'Variant name is required' });
  }
  
  try {
    const result = db.prepare('INSERT INTO variant (variant_name, created_at, is_synced) VALUES (?, ?, 0)').run(variant_name, getCurrentUTCTimestamp());
    res.status(201).json({
      id: result.lastInsertRowid,
      variant_name,
      message: 'Variant created successfully'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update variant
router.put('/:id', (req, res) => {
  const db = getDatabase();
  const { id } = req.params;
  const { variant_name } = req.body;
  
  if (!variant_name) {
    return res.status(400).json({ error: 'Variant name is required' });
  }
  
  try {
    const result = db.prepare('UPDATE variant SET variant_name = ?, is_synced = 0, updated_at = ? WHERE id = ?').run(variant_name, getCurrentUTCTimestamp(), id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Variant not found' });
    }
    res.json({ message: 'Variant updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete variant
router.delete('/:id', (req, res) => {
  const db = getDatabase();
  const { id } = req.params;
  
  try {
    // Check if variant is used in item_variant
    const row = db.prepare('SELECT COUNT(*) as count FROM item_variant WHERE variant_id = ?').get(id);
    
    if (row.count > 0) {
      return res.status(409).json({ 
        error: 'Cannot delete variant that is being used by items. Please remove item variants first.' 
      });
    }
    
    const result = db.prepare('DELETE FROM variant WHERE id = ?').run(id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Variant not found' });
    }
    res.json({ message: 'Variant deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;