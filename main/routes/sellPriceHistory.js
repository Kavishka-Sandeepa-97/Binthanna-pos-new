const express = require('express');
const { getDatabase, getCurrentUTCTimestamp } = require('../database/init');

const router = express.Router();

// Get sell price history for a specific item variant
router.get('/:variantId', (req, res) => {
    const db = getDatabase();
    const { variantId } = req.params;

    console.log('=== Fetching price history for variant ID:', variantId);

    try {
        const rows = db.prepare(`
            SELECT 
                sph.id,
                sph.selling_price,
                sph.created_at,
                sph.item_variant_id,
                s.name as staff_name
            FROM sell_price_history sph
            LEFT JOIN users s ON sph.user_id = s.id
            WHERE sph.item_variant_id = ?
            ORDER BY sph.created_at DESC
        `).all(variantId);

        console.log(`=== Found ${rows ? rows.length : 0} price history records`);
        console.log('=== Data:', JSON.stringify(rows, null, 2));

        res.json(rows || []);
    } catch (err) {
        console.error('=== Database error:', err.message);
        res.status(500).json({
            error: 'Database error',
            details: err.message
        });
    }
});

// Update sell price (create new history entry)
router.post('/update', (req, res) => {
    const db = getDatabase();
    const { item_variant_id, selling_price, user_id = 1 } = req.body;

    if (!item_variant_id || !selling_price) {
        return res.status(400).json({
            error: 'item_variant_id and selling_price are required'
        });
    }

    console.log('=== Updating price for variant:', item_variant_id, 'New price:', selling_price);

    try {
        const result = db.prepare(`
            INSERT INTO sell_price_history (item_variant_id, user_id, selling_price, created_at) 
            VALUES (?, ?, ?, ?)
        `).run(item_variant_id, user_id, parseFloat(selling_price), getCurrentUTCTimestamp());

        console.log('=== Price updated successfully, history ID:', result.lastInsertRowid);

        res.json({
            message: 'Sell price updated successfully',
            historyId: result.lastInsertRowid
        });
    } catch (err) {
        console.error('=== Error updating sell price:', err.message);
        res.status(500).json({
            error: 'Failed to update sell price',
            details: err.message
        });
    }
});

module.exports = router;
