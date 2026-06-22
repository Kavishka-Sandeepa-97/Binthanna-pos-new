const express = require('express');
const router = express.Router();
const { getDatabase } = require('../database/init');
const { triggerManualSync, startSyncScheduler, stopSyncScheduler } = require('../services/syncService');

// Get sync settings
router.get('/settings', (req, res) => {
  const db = getDatabase();
  try {
    const row = db.prepare('SELECT * FROM sync_settings WHERE id = 1').get();
    res.json(row || { is_enabled: 0, supabase_url: '', supabase_key: '', last_sync_status: 'idle' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update sync settings
router.put('/settings', (req, res) => {
  const db = getDatabase();
  const { is_enabled, supabase_url, supabase_key } = req.body;

  try {
    const result = db.prepare(`
      UPDATE sync_settings
      SET is_enabled = ?,
          supabase_url = ?,
          supabase_key = ?,
          last_sync_status = 'idle',
          last_sync_error = NULL
      WHERE id = 1
    `).run(
      is_enabled ? 1 : 0,
      supabase_url || '',
      supabase_key || ''
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Sync settings not found' });
    }

    // Toggle background scheduler depending on whether it's enabled now
    if (is_enabled) {
      startSyncScheduler();
    } else {
      stopSyncScheduler();
    }

    res.json({ message: 'Sync settings updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Trigger manual sync
router.post('/trigger', (req, res) => {
  const db = getDatabase();
  try {
    const row = db.prepare('SELECT is_enabled, supabase_url, supabase_key FROM sync_settings WHERE id = 1').get();
    if (!row || !row.is_enabled) {
      return res.status(400).json({ error: 'Sync is disabled. Please enable it in settings first.' });
    }
    if (!row.supabase_url || !row.supabase_key) {
      return res.status(400).json({ error: 'Supabase credentials are not configured.' });
    }

    // Set status to pending so UI shows action starting
    db.prepare("UPDATE sync_settings SET last_sync_status = 'pending', last_sync_error = NULL WHERE id = 1").run();

    // Trigger async sync run
    triggerManualSync();

    res.json({ message: 'Sync triggered successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
