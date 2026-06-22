// SIMPLIFIED - Get sell price history for an item variant
server.get('/api/sell-price-history/:variantId', (req, res) => {
    const db = getDatabase();
    const { variantId } = req.params;

    console.log('=== Fetching price history for variant ID:', variantId);

    try {
        const rows = db.prepare(`
            SELECT 
                id,
                selling_price,
                created_at,
                user_id as staff_id
            FROM sell_price_history
            WHERE item_variant_id = ?
            ORDER BY created_at DESC
        `).all(variantId);

        console.log(`=== Found ${rows ? rows.length : 0} price history records`);
        res.json(rows || []);
    } catch (err) {
        console.error('=== Database error:', err.message);
        res.status(500).json({
            error: 'Database error',
            details: err.message
        });
    }
});

// SIMPLIFIED - Update sell price
server.post('/api/sell-price-history/update', (req, res) => {
    const db = getDatabase();
    const { item_variant_id, selling_price, staff_id = 1, user_id } = req.body;
    const finalUserId = user_id || staff_id;

    if (!item_variant_id || !selling_price) {
        return res.status(400).json({
            error: 'item_variant_id and selling_price are required'
        });
    }

    console.log('=== Updating price for variant:', item_variant_id, 'New price:', selling_price);

    try {
        const result = db.prepare(`
            INSERT INTO sell_price_history (item_variant_id, user_id, selling_price) 
            VALUES (?, ?, ?)
        `).run(item_variant_id, finalUserId, parseFloat(selling_price));

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
