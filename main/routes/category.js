const express = require('express');
const router = express.Router();
const { getDatabase, getCurrentUTCTimestamp } = require('../database/init');

// Get all categories (hierarchical structure)
router.get('/', (req, res) => {
  const db = getDatabase();
  try {
    const allCategories = db.prepare('SELECT * FROM category ORDER BY name').all();
    
    // Build hierarchical structure
    const categoryMap = {};
    const rootCategories = [];
    
    // First pass: create map of all categories
    allCategories.forEach(cat => {
      categoryMap[cat.id] = { ...cat, subcategories: [] };
    });
    
    // Second pass: build hierarchy
    allCategories.forEach(cat => {
      if (cat.parent_id === null) {
        rootCategories.push(categoryMap[cat.id]);
      } else if (categoryMap[cat.parent_id]) {
        categoryMap[cat.parent_id].subcategories.push(categoryMap[cat.id]);
      }
    });
    
    res.json(rootCategories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all categories (flat structure)
router.get('/flat', (req, res) => {
  const db = getDatabase();
  try {
    const rows = db.prepare('SELECT * FROM category ORDER BY name').all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get category by ID
router.get('/:id', (req, res) => {
  const db = getDatabase();
  const { id } = req.params;
  
  try {
    const row = db.prepare('SELECT * FROM category WHERE id = ?').get(id);
    if (!row) {
      return res.status(404).json({ error: 'Category not found' });
    }
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create new category
router.post('/', (req, res) => {
  const db = getDatabase();
  const { name, parent_id } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Category name is required' });
  }
  
  try {
    const result = db.prepare('INSERT INTO category (name, parent_id, created_at, is_synced) VALUES (?, ?, ?, 0)').run(
      name, 
      parent_id || null, 
      getCurrentUTCTimestamp()
    );
    res.status(201).json({
      id: result.lastInsertRowid,
      name,
      parent_id: parent_id || null,
      message: 'Category created successfully'
    });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'Category name already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// Update category
router.put('/:id', (req, res) => {
  const db = getDatabase();
  const { id } = req.params;
  const { name, parent_id } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Category name is required' });
  }
  
  try {
    const result = db.prepare('UPDATE category SET name = ?, parent_id = ?, is_synced = 0, updated_at = ? WHERE id = ?').run(
      name, 
      parent_id || null, 
      getCurrentUTCTimestamp(),
      id
    );
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    res.json({ message: 'Category updated successfully' });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'Category name already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// Delete category
router.delete('/:id', (req, res) => {
  const db = getDatabase();
  const { id } = req.params;
  
  try {
    // Check if category has items
    const row = db.prepare('SELECT COUNT(*) as count FROM item WHERE category_id = ?').get(id);
    
    if (row.count > 0) {
      return res.status(409).json({ 
        error: 'Cannot delete category with existing items. Please move or delete items first.' 
      });
    }
    
    const result = db.prepare('DELETE FROM category WHERE id = ?').run(id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    res.json({ message: 'Category deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get items in a category
router.get('/:id/items', (req, res) => {
  const db = getDatabase();
  const { id } = req.params;
  
  try {
    const rows = db.prepare(`
      SELECT i.*, c.name as category_name 
      FROM item i 
      JOIN category c ON i.category_id = c.id 
      WHERE i.category_id = ?
    `).all(id);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;