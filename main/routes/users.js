const express = require('express');
const router = express.Router();
const { getDatabase, getCurrentUTCTimestamp } = require('../database/init');

// Get all users
router.get('/', (req, res) => {
  const db = getDatabase();
  try {
    const rows = db.prepare('SELECT id, name, username, role, is_active, created_at, is_synced FROM users').all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get user by ID
router.get('/:id', (req, res) => {
  const db = getDatabase();
  const { id } = req.params;
  
  try {
    const row = db.prepare('SELECT id, name, username, role, is_active, created_at, is_synced FROM users WHERE id = ?').get(id);
    if (!row) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create new user
router.post('/', (req, res) => {
  const db = getDatabase();
  const { name, username, pin, role } = req.body;
  
  if (!name || !username || !pin || !role) {
    return res.status(400).json({ error: 'Name, username, PIN, and role are required' });
  }
  
  if (pin.length < 4) {
    return res.status(400).json({ error: 'PIN must be at least 4 characters long' });
  }
  
  if (!['admin', 'cashier'].includes(role)) {
    return res.status(400).json({ error: 'Role must be either admin or cashier' });
  }
  
  try {
    // Check if username already exists
    const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existingUser) {
      return res.status(409).json({ error: 'Username already exists. Please choose a different username.' });
    }
    
    const result = db.prepare('INSERT INTO users (name, username, pin, role, created_at) VALUES (?, ?, ?, ?, ?)').run(name, username, pin, role, getCurrentUTCTimestamp());
    res.status(201).json({
      id: result.lastInsertRowid,
      name,
      username,
      role,
      is_active: true,
      message: 'User created successfully'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update user
router.put('/:id', (req, res) => {
  const db = getDatabase();
  const { id } = req.params;
  const { name, username, pin, role, is_active } = req.body;
  
  if (pin && pin.length < 4) {
    return res.status(400).json({ error: 'PIN must be at least 4 characters long' });
  }
  
  if (role && !['admin', 'cashier'].includes(role)) {
    return res.status(400).json({ error: 'Role must be either admin or cashier' });
  }
  
  try {
    if (username) {
      const existingUser = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(username, id);
      if (existingUser) {
        return res.status(409).json({ error: 'Username already exists. Please choose a different username.' });
      }
    }
    
    let updateFields = [];
    let values = [];
    
    if (name) {
      updateFields.push('name = ?');
      values.push(name);
    }
    if (username) {
      updateFields.push('username = ?');
      values.push(username);
    }
    if (pin) {
      updateFields.push('pin = ?');
      values.push(pin);
    }
    if (role) {
      updateFields.push('role = ?');
      values.push(role);
    }
    if (typeof is_active === 'boolean') {
      updateFields.push('is_active = ?');
      values.push(is_active ? 1 : 0);
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }
    
    updateFields.push('is_synced = 0');
    updateFields.push('updated_at = ?');
    values.push(getCurrentUTCTimestamp());
    
    values.push(id);
    
    const result = db.prepare(`UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`).run(...values);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ message: 'User updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete user
router.delete('/:id', (req, res) => {
  const db = getDatabase();
  const { id } = req.params;
  
  try {
    const result = db.prepare('DELETE FROM users WHERE id = ?').run(id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// User login
router.post('/login', (req, res) => {
  const db = getDatabase();
  const { username, pin } = req.body;
  
  if (!username || !pin) {
    return res.status(400).json({ error: 'Username and PIN are required' });
  }
  
  try {
    const row = db.prepare('SELECT id, name, username, role, is_active FROM users WHERE username = ? AND pin = ?').get(username, pin);
    
    if (!row) {
      const userExists = db.prepare('SELECT id, is_active FROM users WHERE username = ?').get(username);
      
      if (!userExists) {
        return res.status(401).json({ error: 'Invalid username or PIN. Please check your credentials.' });
      } else if (userExists.is_active === 0) {
        return res.status(403).json({ error: 'Your account has been deactivated. Please contact an administrator.' });
      } else {
        return res.status(401).json({ error: 'Invalid username or PIN. Please check your credentials.' });
      }
    }
    
    if (row.is_active === 0) {
      return res.status(403).json({ error: 'Your account has been deactivated. Please contact an administrator.' });
    }
    
    res.json({
      id: row.id,
      name: row.name,
      username: row.username,
      role: row.role,
      message: 'Login successful'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update own PIN
router.put('/me/pin', (req, res) => {
  const db = getDatabase();
  const { userId, currentPin, newPin } = req.body;
  
  if (!userId || !currentPin || !newPin) {
    return res.status(400).json({ error: 'User ID, current PIN, and new PIN are required' });
  }
  
  if (newPin.length < 4) {
    return res.status(400).json({ error: 'PIN must be at least 4 characters long' });
  }
  
  try {
    const user = db.prepare('SELECT id, name FROM users WHERE id = ? AND pin = ?').get(userId, currentPin);
    
    if (!user) {
      return res.status(401).json({ error: 'Current PIN is incorrect' });
    }
    
    db.prepare('UPDATE users SET pin = ?, is_synced = 0, updated_at = ? WHERE id = ?').run(newPin, getCurrentUTCTimestamp(), userId);
    res.json({ message: 'PIN updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
