const express = require('express');
const router = express.Router();
const { getDatabase, getCurrentUTCTimestamp } = require('../database/init');

// Get all cashier shifts
router.get('/', (req, res) => {
  const db = getDatabase();
  try {
    const rows = db.prepare(`
      SELECT cs.*, s.name as user_name, s.username as user_username
      FROM cashier_shift cs
      JOIN users s ON cs.user_id = s.id
      ORDER BY cs.open_at DESC
    `).all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get cashier shift by ID
router.get('/:id', (req, res) => {
  const db = getDatabase();
  const { id } = req.params;

  try {
    const row = db.prepare(`
      SELECT cs.*, s.name as user_name, s.username as user_username
      FROM cashier_shift cs
      JOIN users s ON cs.user_id = s.id
      WHERE cs.id = ?
    `).get(id);
    
    if (!row) {
      return res.status(404).json({ error: 'Cashier shift not found' });
    }
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get active (open) shifts
router.get('/status/open', (req, res) => {
  const db = getDatabase();
  try {
    const rows = db.prepare(`
      SELECT cs.*, s.name as user_name, s.username as user_username
      FROM cashier_shift cs
      JOIN users s ON cs.user_id = s.id
      WHERE cs.status = 'open'
      ORDER BY cs.open_at DESC
    `).all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create new cashier shift (open shift)
router.post('/', (req, res) => {
  const db = getDatabase();
  // Accept both staff_id and user_id for backwards compatibility
  const { staff_id, user_id, initial_cash_onhand, description } = req.body;
  const userId = user_id || staff_id;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  try {
    // Check if user exists
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user already has an open shift
    const existingShift = db.prepare("SELECT id FROM cashier_shift WHERE user_id = ? AND status = 'open'").get(userId);
    if (existingShift) {
      return res.status(400).json({ error: 'User already has an open shift' });
    }

    // Create new shift
    const result = db.prepare(`
      INSERT INTO cashier_shift (user_id, open_at, initial_cash_onhand, current_cash_onhand, description, status, is_synced)
      VALUES (?, ?, ?, ?, ?, 'open', 0)
    `).run(userId, getCurrentUTCTimestamp(), initial_cash_onhand || 0, initial_cash_onhand || 0, description || '');

    res.status(201).json({
      id: result.lastInsertRowid,
      message: 'Cashier shift opened successfully'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Close cashier shift
router.put('/:id/close', (req, res) => {
  const db = getDatabase();
  const { id } = req.params;
  const { current_cash_onhand, description } = req.body;

  if (current_cash_onhand === undefined) {
    return res.status(400).json({ error: 'Current cash on hand is required' });
  }

  try {
    // Check if shift exists and is open
    const shift = db.prepare("SELECT * FROM cashier_shift WHERE id = ? AND status = 'open'").get(id);
    if (!shift) {
      return res.status(404).json({ error: 'Open cashier shift not found' });
    }

    // Close the shift
    const result = db.prepare(`
      UPDATE cashier_shift
      SET current_cash_onhand = ?, close_at = ?, description = ?, status = 'closed', is_synced = 0, updated_at = ?
      WHERE id = ?
    `).run(current_cash_onhand, getCurrentUTCTimestamp(), description || shift.description || '', getCurrentUTCTimestamp(), id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Cashier shift not found' });
    }
    res.json({
      message: 'Cashier shift closed successfully',
      cash_difference: current_cash_onhand - shift.initial_cash_onhand
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update cashier shift
router.put('/:id', (req, res) => {
  const db = getDatabase();
  const { id } = req.params;
  const { current_cash_onhand, description } = req.body;

  try {
    const result = db.prepare(`
      UPDATE cashier_shift
      SET current_cash_onhand = ?, description = ?, is_synced = 0, updated_at = ?
      WHERE id = ? AND status = 'open'
    `).run(current_cash_onhand, description, getCurrentUTCTimestamp(), id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Open cashier shift not found' });
    }
    res.json({ message: 'Cashier shift updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete cashier shift
router.delete('/:id', (req, res) => {
  const db = getDatabase();
  const { id } = req.params;

  try {
    const result = db.prepare('DELETE FROM cashier_shift WHERE id = ?').run(id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Cashier shift not found' });
    }
    res.json({ message: 'Cashier shift deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;