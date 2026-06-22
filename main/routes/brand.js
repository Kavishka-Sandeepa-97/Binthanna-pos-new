const express = require('express');
const router = express.Router();
const { getDatabase, getCurrentUTCTimestamp } = require('../database/init');

// Get all brands
router.get('/', (req, res) => {
  const db = getDatabase();
  try {
    const rows = db.prepare('SELECT * FROM brand ORDER BY brand_name').all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get brand by ID
router.get('/:id', (req, res) => {
  const db = getDatabase();
  const { id } = req.params;
  
  try {
    const row = db.prepare('SELECT * FROM brand WHERE id = ?').get(id);
    if (!row) {
      return res.status(404).json({ error: 'Brand not found' });
    }
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create new brand
router.post('/', (req, res) => {
  const db = getDatabase();
  const { brand_name, description, is_discount_active, discount_type, discount_value } = req.body;
  
  if (!brand_name) {
    return res.status(400).json({ error: 'Brand name is required' });
  }
  
  try {
    const result = db.prepare('INSERT INTO brand (brand_name, description, is_discount_active, discount_type, discount_value, created_at, is_synced) VALUES (?, ?, ?, ?, ?, ?, 0)').run(
      brand_name,
      description || null,
      is_discount_active ? 1 : 0,
      discount_type || null,
      parseFloat(discount_value) || 0,
      getCurrentUTCTimestamp()
    );
    res.status(201).json({
      id: result.lastInsertRowid,
      brand_name,
      description,
      is_discount_active: is_discount_active ? 1 : 0,
      discount_type: discount_type || null,
      discount_value: parseFloat(discount_value) || 0,
      message: 'Brand created successfully'
    });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'Brand name already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// Update brand
router.put('/:id', (req, res) => {
  const db = getDatabase();
  const { id } = req.params;
  const { brand_name, description, is_discount_active, discount_type, discount_value } = req.body;
  
  if (!brand_name) {
    return res.status(400).json({ error: 'Brand name is required' });
  }
  
  try {
    // Check if brand exists
    const brand = db.prepare('SELECT * FROM brand WHERE id = ?').get(id);
    if (!brand) {
      return res.status(404).json({ error: 'Brand not found' });
    }
    
    // Update brand
    db.prepare('UPDATE brand SET brand_name = ?, description = ?, is_discount_active = ?, discount_type = ?, discount_value = ?, is_synced = 0, updated_at = ? WHERE id = ?').run(
      brand_name,
      description || null,
      is_discount_active ? 1 : 0,
      discount_type || null,
      parseFloat(discount_value) || 0,
      getCurrentUTCTimestamp(),
      id
    );
    
    res.json({
      id: parseInt(id),
      brand_name,
      description,
      is_discount_active: is_discount_active ? 1 : 0,
      discount_type: discount_type || null,
      discount_value: parseFloat(discount_value) || 0,
      message: 'Brand updated successfully'
    });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'Brand name already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// Delete brand
router.delete('/:id', (req, res) => {
  const db = getDatabase();
  const { id } = req.params;
  
  try {
    // Check if brand exists
    const brand = db.prepare('SELECT * FROM brand WHERE id = ?').get(id);
    if (!brand) {
      return res.status(404).json({ error: 'Brand not found' });
    }
    
    // Check if brand is used by any items
    const itemsUsingBrand = db.prepare('SELECT COUNT(*) as count FROM item WHERE brand_id = ?').get(id);
    if (itemsUsingBrand.count > 0) {
      return res.status(400).json({ 
        error: `Cannot delete brand. It is being used by ${itemsUsingBrand.count} item(s).` 
      });
    }
    
    // Delete brand
    db.prepare('DELETE FROM brand WHERE id = ?').run(id);
    
    res.json({ message: 'Brand deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
