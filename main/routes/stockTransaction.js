const express = require('express');
const router = express.Router();
const { getDatabase, getCurrentUTCTimestamp } = require('../database/init');

// Get all transactions with product and supplier info
router.get('/', (req, res) => {
  const db = getDatabase();
  const { type, from_date, to_date, product_id } = req.query;
  
  let query = `
    SELECT 
      st.*,
      sp.name as product_name,
      ss.name as supplier_name,
      u.name as user_name,
      sc.name as category_name,
      un.name as unit_name
    FROM stock_transaction st
    LEFT JOIN stock_product sp ON st.product_id = sp.id
    LEFT JOIN stock_supplier ss ON st.supplier_id = ss.id
    LEFT JOIN users u ON st.user_id = u.id
    LEFT JOIN stock_category sc ON sp.category_id = sc.id
    LEFT JOIN stock_unit un ON sp.unit_id = un.id
    WHERE 1=1
  `;
  
  const params = [];
  
  if (type && type !== 'ALL') {
    query += ' AND st.type = ?';
    params.push(type);
  }
  
  if (from_date) {
    query += ' AND DATE(st.created_at) >= DATE(?)';
    params.push(from_date);
  }
  
  if (to_date) {
    query += ' AND DATE(st.created_at) <= DATE(?)';
    params.push(to_date);
  }
  
  if (product_id) {
    query += ' AND st.product_id = ?';
    params.push(product_id);
  }
  
  query += ' ORDER BY st.created_at DESC';
  
  try {
    const rows = db.prepare(query).all(...params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get transaction by ID
router.get('/:id', (req, res) => {
  const db = getDatabase();
  const { id } = req.params;
  
  try {
    const row = db.prepare(
      `SELECT 
        st.*,
        sp.name as product_name,
        ss.name as supplier_name,
        u.name as user_name
      FROM stock_transaction st
      LEFT JOIN stock_product sp ON st.product_id = sp.id
      LEFT JOIN stock_supplier ss ON st.supplier_id = ss.id
      LEFT JOIN users u ON st.user_id = u.id
      WHERE st.id = ?`
    ).get(id);
    
    if (!row) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create new transaction
router.post('/', (req, res) => {
  const db = getDatabase();
  const { product_id, supplier_id, type, qty, price, description, user_id } = req.body;
  
  // Validate required fields
  if (!product_id || !type || !qty || !user_id) {
    return res.status(400).json({ 
      error: 'Product, type, quantity, and user are required' 
    });
  }
  
  // Validate type
  if (!['IN', 'OUT'].includes(type)) {
    return res.status(400).json({ 
      error: 'Type must be either IN or OUT' 
    });
  }
  
  // Validate quantity is positive
  if (parseFloat(qty) <= 0) {
    return res.status(400).json({ 
      error: 'Quantity must be greater than 0' 
    });
  }
  
  // For IN transactions, price is required
  if (type === 'IN' && !price) {
    return res.status(400).json({ 
      error: 'Price is required for IN transactions' 
    });
  }
  
  // For IN transactions, validate price is positive
  if (type === 'IN' && parseFloat(price) <= 0) {
    return res.status(400).json({ 
      error: 'Price must be greater than 0' 
    });
  }
  
  const runTransaction = db.transaction(() => {
    // 1. Insert transaction record
    const insertResult = db.prepare(
      `INSERT INTO stock_transaction 
       (product_id, supplier_id, type, qty, price, description, user_id, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      product_id,
      supplier_id || null,
      type,
      parseFloat(qty),
      price ? parseFloat(price) : null,
      description || null,
      user_id,
      getCurrentUTCTimestamp()
    );
    
    const transactionId = insertResult.lastInsertRowid;
    
    // 2. Update product quantity
    const qtyChange = type === 'IN' ? parseFloat(qty) : -parseFloat(qty);
    db.prepare(
      'UPDATE stock_product SET current_qty = current_qty + ? WHERE id = ?'
    ).run(qtyChange, product_id);
    
    // 3. Verify stock is not negative
    const productRow = db.prepare(
      'SELECT current_qty FROM stock_product WHERE id = ?'
    ).get(product_id);
    
    if (!productRow) {
      throw new Error('Product not found');
    }
    
    if (productRow.current_qty < 0) {
      throw new Error('Insufficient stock. Cannot complete OUT transaction.');
    }
    
    return {
      id: transactionId,
      new_qty: productRow.current_qty
    };
  });
  
  try {
    const result = runTransaction();
    res.status(201).json({
      id: result.id,
      message: 'Transaction created successfully',
      new_qty: result.new_qty
    });
  } catch (err) {
    if (err.message.includes('Insufficient stock')) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

// Update transaction
router.put('/:id', (req, res) => {
  const db = getDatabase();
  const { id } = req.params;
  const { product_id, supplier_id, type, qty, price, description, user_id } = req.body;
  
  // Validate required fields
  if (!product_id || !type || !qty || !user_id) {
    return res.status(400).json({ 
      error: 'Product, type, quantity, and user are required' 
    });
  }
  
  // Validate type
  if (!['IN', 'OUT'].includes(type)) {
    return res.status(400).json({ 
      error: 'Type must be either IN or OUT' 
    });
  }
  
  // Validate quantity is positive
  if (parseFloat(qty) <= 0) {
    return res.status(400).json({ 
      error: 'Quantity must be greater than 0' 
    });
  }
  
  // For IN transactions, price is required
  if (type === 'IN' && !price) {
    return res.status(400).json({ 
      error: 'Price is required for IN transactions' 
    });
  }
  
  // Find transaction
  const oldTransaction = db.prepare('SELECT * FROM stock_transaction WHERE id = ?').get(id);
  if (!oldTransaction) {
    return res.status(404).json({ error: 'Transaction not found' });
  }
  
  const runTransaction = db.transaction(() => {
    // 1. Reverse the old quantity change from the old product
    const oldQtyChange = oldTransaction.type === 'IN' ? -parseFloat(oldTransaction.qty) : parseFloat(oldTransaction.qty);
    db.prepare(
      'UPDATE stock_product SET current_qty = current_qty + ? WHERE id = ?'
    ).run(oldQtyChange, oldTransaction.product_id);
    
    // 2. Update the transaction record
    db.prepare(
      `UPDATE stock_transaction 
       SET product_id = ?, supplier_id = ?, type = ?, qty = ?, price = ?, description = ?, user_id = ?
       WHERE id = ?`
    ).run(
      product_id,
      supplier_id || null,
      type,
      parseFloat(qty),
      price ? parseFloat(price) : null,
      description || null,
      user_id,
      id
    );
    
    // 3. Apply the new quantity change to the new product
    const newQtyChange = type === 'IN' ? parseFloat(qty) : -parseFloat(qty);
    db.prepare(
      'UPDATE stock_product SET current_qty = current_qty + ? WHERE id = ?'
    ).run(newQtyChange, product_id);
    
    // 4. Check if the new product quantity is negative
    const newProductRow = db.prepare('SELECT current_qty FROM stock_product WHERE id = ?').get(product_id);
    if (!newProductRow || newProductRow.current_qty < 0) {
      throw new Error('Insufficient stock. Cannot complete update.');
    }
    
    // 5. Also check the old product if it's different
    if (oldTransaction.product_id !== product_id) {
      const oldProductRow = db.prepare('SELECT current_qty FROM stock_product WHERE id = ?').get(oldTransaction.product_id);
      if (!oldProductRow || oldProductRow.current_qty < 0) {
        throw new Error('Cannot update. Would result in negative stock for original product.');
      }
    }
    
    return newProductRow.current_qty;
  });
  
  try {
    const newQty = runTransaction();
    res.json({ 
      message: 'Transaction updated successfully',
      new_qty: newQty
    });
  } catch (err) {
    if (err.message.includes('Insufficient stock') || err.message.includes('negative stock')) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

// Delete transaction
router.delete('/:id', (req, res) => {
  const db = getDatabase();
  const { id } = req.params;
  
  // Find transaction
  const transaction = db.prepare('SELECT * FROM stock_transaction WHERE id = ?').get(id);
  if (!transaction) {
    return res.status(404).json({ error: 'Transaction not found' });
  }
  
  const runTransaction = db.transaction(() => {
    // 1. Reverse the quantity change
    const qtyChange = transaction.type === 'IN' ? -parseFloat(transaction.qty) : parseFloat(transaction.qty);
    db.prepare(
      'UPDATE stock_product SET current_qty = current_qty + ? WHERE id = ?'
    ).run(qtyChange, transaction.product_id);
    
    // 2. Check if quantity becomes negative
    const productRow = db.prepare('SELECT current_qty FROM stock_product WHERE id = ?').get(transaction.product_id);
    if (!productRow || productRow.current_qty < 0) {
      throw new Error('Cannot delete transaction. Would result in negative stock.');
    }
    
    // 3. Delete the transaction
    db.prepare('DELETE FROM stock_transaction WHERE id = ?').run(id);
    
    return productRow.current_qty;
  });
  
  try {
    const newQty = runTransaction();
    res.json({ 
      message: 'Transaction deleted successfully',
      new_qty: newQty
    });
  } catch (err) {
    if (err.message.includes('negative stock')) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
