const express = require('express');
const router = express.Router();
const { getDatabase, getCurrentUTCTimestamp } = require('../database/init');

// Get all in/out transactions
router.get('/', (req, res) => {
  const db = getDatabase();
  const { page = 1, limit = 50, type, start_date, end_date } = req.query;

  try {
    let query = `
      SELECT io.*, s.name as staff_name
      FROM in_out io
      LEFT JOIN users s ON io.user_id = s.id
    `;
    let conditions = [];
    let params = [];

    if (type && ['IN', 'OUT'].includes(type.toUpperCase())) {
      conditions.push('io.type = ?');
      params.push(type.toUpperCase());
    }

    if (start_date) {
      conditions.push('DATE(io.created_at) >= ?');
      params.push(start_date);
    }

    if (end_date) {
      conditions.push('DATE(io.created_at) <= ?');
      params.push(end_date);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY io.created_at DESC';

    // Add pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    query += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const rows = db.prepare(query).all(...params);

    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) as total FROM in_out io';
    if (conditions.length > 0) {
      countQuery += ' WHERE ' + conditions.join(' AND ');
    }

    const countResult = db.prepare(countQuery).get(...params.slice(0, -2));

    res.json({
      data: rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult.total,
        pages: Math.ceil(countResult.total / parseInt(limit))
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get in/out transaction by ID
router.get('/:id', (req, res) => {
  const db = getDatabase();
  const { id } = req.params;

  try {
    const row = db.prepare(`
      SELECT io.*, s.name as staff_name
      FROM in_out io
      LEFT JOIN users s ON io.user_id = s.id
      WHERE io.id = ?
    `).get(id);

    if (!row) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create new in/out transaction
router.post('/', (req, res) => {
  const db = getDatabase();
  const { type, description, amount, staff_id, user_id } = req.body;
  const userId = user_id || staff_id;

  if (!type || !description || !amount || !userId) {
    return res.status(400).json({ error: 'Type, description, amount, and user_id are required' });
  }

  if (!['IN', 'OUT'].includes(type.toUpperCase())) {
    return res.status(400).json({ error: 'Type must be either IN or OUT' });
  }

  if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
    return res.status(400).json({ error: 'Amount must be a positive number' });
  }

  try {
    // Verify user exists
    const user = db.prepare('SELECT id FROM users WHERE id = ? AND is_active = 1').get(userId);
    if (!user) {
      return res.status(400).json({ error: 'Invalid or inactive user member' });
    }

    const result = db.prepare('INSERT INTO in_out (type, description, amount, user_id, created_at, is_synced) VALUES (?, ?, ?, ?, ?, 0)').run(type.toUpperCase(), description, parseFloat(amount), userId, getCurrentUTCTimestamp());

    // Update cashier shift cash amount
    const cashAdjustment = type.toUpperCase() === 'IN' ? parseFloat(amount) : -parseFloat(amount);
    try {
      db.prepare(`
        UPDATE cashier_shift 
        SET current_cash_onhand = current_cash_onhand + ?, is_synced = 0, updated_at = ?
        WHERE user_id = ? AND status = 'open'
      `).run(cashAdjustment, getCurrentUTCTimestamp(), userId);
    } catch (err) {
      console.error('Error updating cashier cash:', err);
    }

    res.status(201).json({
      id: result.lastInsertRowid,
      type: type.toUpperCase(),
      description,
      amount: parseFloat(amount),
      user_id: userId,
      staff_id: userId,
      created_at: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update in/out transaction
router.put('/:id', (req, res) => {
  const db = getDatabase();
  const { id } = req.params;
  const { type, description, amount, staff_id, user_id } = req.body;
  const userId = user_id || staff_id;

  try {
    // First get the current transaction details to reverse the old cash impact
    const oldTransaction = db.prepare('SELECT type, amount, user_id FROM in_out WHERE id = ?').get(id);
    if (!oldTransaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    let updateFields = [];
    let values = [];

    if (type && ['IN', 'OUT'].includes(type.toUpperCase())) {
      updateFields.push('type = ?');
      values.push(type.toUpperCase());
    }

    if (description) {
      updateFields.push('description = ?');
      values.push(description);
    }

    if (amount && !isNaN(parseFloat(amount)) && parseFloat(amount) > 0) {
      updateFields.push('amount = ?');
      values.push(parseFloat(amount));
    }

    if (userId) {
      // Verify user exists
      const user = db.prepare('SELECT id FROM users WHERE id = ? AND is_active = 1').get(userId);
      if (!user) {
        return res.status(400).json({ error: 'Invalid or inactive user' });
      }
      updateFields.push('user_id = ?');
      values.push(userId);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    updateFields.push('is_synced = 0');
    updateFields.push('updated_at = ?');
    values.push(getCurrentUTCTimestamp());

    values.push(id);

    const result = db.prepare(`UPDATE in_out SET ${updateFields.join(', ')} WHERE id = ?`).run(...values);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // Reverse old cash impact
    const oldCashAdjustment = oldTransaction.type === 'IN' ? -parseFloat(oldTransaction.amount) : parseFloat(oldTransaction.amount);
    
    // Get new transaction details for new cash impact
    const newType = type ? type.toUpperCase() : oldTransaction.type;
    const newAmount = amount ? parseFloat(amount) : oldTransaction.amount;
    const newUserId = userId || oldTransaction.user_id;
    
    const newCashAdjustment = newType === 'IN' ? parseFloat(newAmount) : -parseFloat(newAmount);

    // Update cashier shift cash amount (reverse old + apply new)
    const totalCashAdjustment = oldCashAdjustment + newCashAdjustment;
    
    try {
      db.prepare(`
        UPDATE cashier_shift 
        SET current_cash_onhand = current_cash_onhand + ?, is_synced = 0, updated_at = ?
        WHERE user_id = ? AND status = 'open'
      `).run(totalCashAdjustment, getCurrentUTCTimestamp(), newUserId);
    } catch (err) {
      console.error('Error updating cashier cash on update:', err);
    }

    res.json({ message: 'Transaction updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete in/out transaction
router.delete('/:id', (req, res) => {
  const db = getDatabase();
  const { id } = req.params;

  try {
    // First get the transaction details to reverse the cash impact
    const transaction = db.prepare('SELECT type, amount, user_id FROM in_out WHERE id = ?').get(id);
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // Reverse the cash impact
    const cashAdjustment = transaction.type === 'IN' ? -parseFloat(transaction.amount) : parseFloat(transaction.amount);
    
    const result = db.prepare('DELETE FROM in_out WHERE id = ?').run(id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // Update cashier shift cash amount (reverse the transaction)
    try {
      db.prepare(`
        UPDATE cashier_shift 
        SET current_cash_onhand = current_cash_onhand + ?, is_synced = 0, updated_at = ?
        WHERE user_id = ? AND status = 'open'
      `).run(cashAdjustment, getCurrentUTCTimestamp(), transaction.user_id);
    } catch (err) {
      console.error('Error updating cashier cash on delete:', err);
    }

    res.json({ message: 'Transaction deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get summary statistics
router.get('/summary/stats', (req, res) => {
  const db = getDatabase();
  const { start_date, end_date } = req.query;

  try {
    let dateCondition = '';
    let params = [];

    if (start_date && end_date) {
      dateCondition = 'AND DATE(created_at) BETWEEN ? AND ?';
      params = [start_date, end_date];
    } else if (start_date) {
      dateCondition = 'AND DATE(created_at) >= ?';
      params = [start_date];
    } else if (end_date) {
      dateCondition = 'AND DATE(created_at) <= ?';
      params = [end_date];
    }

    const query = `
      SELECT
        type,
        COUNT(*) as count,
        SUM(amount) as total_amount
      FROM in_out
      WHERE 1=1 ${dateCondition}
      GROUP BY type
    `;

    const rows = db.prepare(query).all(...params);

    const stats = {
      IN: { count: 0, total_amount: 0 },
      OUT: { count: 0, total_amount: 0 }
    };

    rows.forEach(row => {
      stats[row.type] = {
        count: row.count,
        total_amount: parseFloat(row.total_amount) || 0
      };
    });

    stats.net_amount = stats.IN.total_amount - stats.OUT.total_amount;

    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;