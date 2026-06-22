const express = require('express');
const router = express.Router();
const { getDatabase, getCurrentUTCTimestamp, generateUniqueBarcode } = require('../database/init');

const isValidOrderStatus = (status) => ['active', 'completed', 'cancelled'].includes(status);

const parsePositiveInteger = (value, label) => {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${label}`);
  }
  return parsed;
};

const parseNonNegativeNumber = (value, label) => {
  const parsed = parseFloat(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Invalid ${label}`);
  }
  return parsed;
};

const parseOptionalNumber = (value, fallback = 0) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseOptionalText = (value) => {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
};

const parseBoolean = (value, fallback = false) => {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no'].includes(normalized)) {
    return false;
  }
  return fallback;
};

const calculateOrderCashImpact = (totalAmount, isCardPayment) => {
  return parseBoolean(isCardPayment, false) ? 0 : parseOptionalNumber(totalAmount, 0);
};

const normalizeOrderItems = (items, { allowEmpty = false } = {}) => {
  if (!Array.isArray(items)) {
    if (allowEmpty) {
      return [];
    }
    throw new Error('Items are required');
  }

  if (!allowEmpty && items.length === 0) {
    throw new Error('Items are required');
  }

  return items.map((item, index) => {
    const row = index + 1;
    const itemVariantId = parsePositiveInteger(item.item_variant_id, `item_variant_id at row ${row}`);
    const qty = parsePositiveInteger(item.qty, `qty at row ${row}`);
    const unitPrice = parseNonNegativeNumber(item.unit_price, `unit_price at row ${row}`);
    const originalPrice = parseOptionalNumber(item.original_price, unitPrice);
    const rawDiscountType = item.discount_type || null;
    const discountType = ['fixed', 'percentage'].includes(rawDiscountType) ? rawDiscountType : null;
    const rawDiscountValue = parseOptionalNumber(item.discount_value, 0);

    const safeDiscountValue = discountType === 'percentage'
      ? Math.min(100, Math.max(0, rawDiscountValue))
      : Math.max(0, rawDiscountValue);

    const computedDiscountAmount = Math.max(0, Math.round((originalPrice - unitPrice) * 100) / 100);

    let preferredBatchId = null;
    if (item.preferred_batch_id !== undefined && item.preferred_batch_id !== null && item.preferred_batch_id !== '') {
      preferredBatchId = parsePositiveInteger(item.preferred_batch_id, `preferred_batch_id at row ${row}`);
    }

    return {
      item_variant_id: itemVariantId,
      qty,
      unit_price: unitPrice,
      original_price: originalPrice,
      discount_source: item.discount_source || null,
      discount_type: discountType,
      discount_value: safeDiscountValue,
      discount_amount: computedDiscountAmount,
      preferred_batch_id: preferredBatchId,
    };
  });
};

const normalizeReturnItems = (returnItems) => {
  if (returnItems === undefined || returnItems === null) {
    return [];
  }

  if (!Array.isArray(returnItems)) {
    throw new Error('return_items must be an array');
  }

  return returnItems.map((item, index) => {
    const row = index + 1;
    const itemVariantId = parsePositiveInteger(item.item_variant_id, `return item_variant_id at row ${row}`);
    const qty = parsePositiveInteger(item.qty, `return qty at row ${row}`);
    const unitPrice = parseNonNegativeNumber(item.unit_price, `return unit_price at row ${row}`);
    const originalPrice = parseOptionalNumber(item.original_price, unitPrice);

    return {
      item_variant_id: itemVariantId,
      qty,
      unit_price: unitPrice,
      original_price: originalPrice,
      source_order_item_id: item.source_order_item_id ? parsePositiveInteger(item.source_order_item_id, `source_order_item_id at row ${row}`) : null,
      batch_buy_price: parseOptionalNumber(item.batch_buy_price, 0),
      batch_sell_price: parseOptionalNumber(item.batch_sell_price, originalPrice),
      description: parseOptionalText(item.description),
    };
  });
};

const calculateDiscountAmount = (subtotal, discountType, discountValue) => {
  if (discountType === 'percent') {
    const safePercent = Math.min(100, Math.max(0, parseOptionalNumber(discountValue, 0)));
    return (subtotal * safePercent) / 100;
  }
  if (discountType === 'fixed') {
    const safeFixed = Math.max(0, parseOptionalNumber(discountValue, 0));
    return Math.min(safeFixed, subtotal);
  }
  return 0;
};

const getGlobalDiscountSettings = (db) => {
  try {
    const row = db.prepare(`
      SELECT
        COALESCE(is_global_discount_active, 0) AS is_global_discount_active,
        COALESCE(global_discount_type, 'percentage') AS global_discount_type,
        COALESCE(global_discount_value, 0) AS global_discount_value,
        COALESCE(min_order_amount, 0) AS min_order_amount
      FROM global_discount_settings
      WHERE key_value = ?
      LIMIT 1
    `).get('default');

    if (!row) {
      return {
        isGlobalDiscountActive: false,
        globalDiscountType: 'percentage',
        globalDiscountValue: 0,
        minOrderAmount: 0,
      };
    }

    return {
      isGlobalDiscountActive: parseBoolean(row.is_global_discount_active, false),
      globalDiscountType: String(row.global_discount_type || 'percentage'),
      globalDiscountValue: parseOptionalNumber(row.global_discount_value, 0),
      minOrderAmount: parseOptionalNumber(row.min_order_amount, 0),
    };
  } catch (_error) {
    return {
      isGlobalDiscountActive: false,
      globalDiscountType: 'percentage',
      globalDiscountValue: 0,
      minOrderAmount: 0,
    };
  }
};

const normalizeOrderDiscountForGlobalRules = (db, {
  subtotal,
  discountType,
  discountValue,
  isReturn = false,
}) => {
  if (isReturn) {
    return {
      discountType: null,
      discountValue: 0,
      discountAmount: 0,
    };
  }

  const safeDiscountType = discountType || null;
  const safeDiscountValue = parseOptionalNumber(discountValue, 0);

  let effectiveDiscountType = safeDiscountType;
  let effectiveDiscountValue = safeDiscountValue;

  const settings = getGlobalDiscountSettings(db);
  if (settings.isGlobalDiscountActive) {
    const globalTypeForOrders = settings.globalDiscountType === 'percentage' ? 'percent' : 'fixed';
    const matchesGlobalConfig =
      safeDiscountType === globalTypeForOrders
      && Math.abs(safeDiscountValue - settings.globalDiscountValue) < 0.0001;

    if (matchesGlobalConfig && subtotal < settings.minOrderAmount) {
      effectiveDiscountType = null;
      effectiveDiscountValue = 0;
    }
  }

  const discountAmount = calculateDiscountAmount(subtotal, effectiveDiscountType, effectiveDiscountValue);

  return {
    discountType: effectiveDiscountType,
    discountValue: effectiveDiscountValue,
    discountAmount,
  };
};

const allocateAndInsertOrderItem = (db, { orderId, item, preferredBatchId = null }) => {
  // Check if item is quantity managed
  const itemInfo = db.prepare(`
    SELECT i.is_qty_managed
    FROM item_variant iv
    JOIN item i ON iv.item_id = i.id
    WHERE iv.id = ?
  `).get(item.item_variant_id);

  const isQtyManaged = itemInfo ? itemInfo.is_qty_managed : 1;

  const insertItem = db.prepare(`
    INSERT INTO item_variant_order (
      item_variant_id,
      order_id,
      stock_batch_id,
      qty,
      unit_price,
      discount_source,
      discount_type,
      discount_value,
      discount_amount,
      original_price,
      is_synced
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `);

  if (!isQtyManaged) {
    // If not quantity managed, insert directly without batch allocation
    insertItem.run(
      item.item_variant_id,
      orderId,
      null,
      item.qty,
      item.unit_price,
      item.discount_source,
      item.discount_type,
      item.discount_value,
      item.discount_amount,
      item.original_price
    );
    return;
  }

  // If quantity is managed, perform batch allocation
  const getBatches = db.prepare(`
    SELECT id, remaining_qty, buy_price, COALESCE(sell_price, 0) AS sell_price
    FROM stock_batch
    WHERE item_variant_id = ? AND remaining_qty > 0
    ORDER BY
      CASE WHEN id = ? THEN 0 ELSE 1 END,
      CASE WHEN expire_date IS NULL THEN 1 ELSE 0 END,
      DATE(expire_date) ASC,
      created_at ASC,
      id ASC
  `);
  const updateBatch = db.prepare('UPDATE stock_batch SET remaining_qty = remaining_qty - ? WHERE id = ?');

  const batches = getBatches.all(item.item_variant_id, preferredBatchId);
  let remainingQty = item.qty;
  let allocatedQty = 0;

  for (const batch of batches) {
    if (remainingQty <= 0) {
      break;
    }

    const deductQty = Math.min(remainingQty, batch.remaining_qty);
    updateBatch.run(deductQty, batch.id);
    
    insertItem.run(
      item.item_variant_id,
      orderId,
      batch.id,
      deductQty,
      item.unit_price,
      item.discount_source,
      item.discount_type,
      item.discount_value,
      item.discount_amount,
      item.original_price
    );

    allocatedQty += deductQty;
    remainingQty -= deductQty;
  }

  if (remainingQty > 0) {
    throw new Error(`Insufficient stock for item variant ${item.item_variant_id}. Requested ${item.qty}, available ${allocatedQty}`);
  }
};

const restoreOrderStock = (db, orderId) => {
  const items = db.prepare(`
    SELECT stock_batch_id, qty
    FROM item_variant_order
    WHERE order_id = ? AND stock_batch_id IS NOT NULL
  `).all(orderId);

  const restoreSoldBatch = db.prepare('UPDATE stock_batch SET remaining_qty = remaining_qty + ? WHERE id = ?');

  for (const item of items) {
    if (item.qty > 0) {
      restoreSoldBatch.run(item.qty, item.stock_batch_id);
    }
  }
};

const validateReturnQuantities = (db, originalOrderId, returnItems) => {
  if (returnItems.length === 0) {
    return;
  }

  const requestedByVariant = returnItems.reduce((acc, item) => {
    const existingQty = acc.get(item.item_variant_id) || 0;
    acc.set(item.item_variant_id, existingQty + item.qty);
    return acc;
  }, new Map());

  const soldQtyStmt = db.prepare(`
    SELECT COALESCE(SUM(qty), 0) AS sold_qty
    FROM item_variant_order
    WHERE order_id = ? AND item_variant_id = ? AND qty > 0
  `);

  const returnedQtyStmt = db.prepare(`
    SELECT COALESCE(SUM(r.qty), 0) AS returned_qty
    FROM returns r
    JOIN item_variant_order ivo ON r.item_variant_order_id = ivo.id
    WHERE r.order_id = ?
      AND ivo.item_variant_id = ?
  `);

  for (const [itemVariantId, requestedQty] of requestedByVariant.entries()) {
    const sold = soldQtyStmt.get(originalOrderId, itemVariantId);
    const alreadyReturned = returnedQtyStmt.get(originalOrderId, itemVariantId);
    const soldQty = parseOptionalNumber(sold?.sold_qty, 0);
    const returnedQty = parseOptionalNumber(alreadyReturned?.returned_qty, 0);
    const availableQty = Math.max(0, soldQty - returnedQty);

    if (requestedQty > availableQty) {
      throw new Error(`Return quantity exceeds available quantity for item variant ${itemVariantId}. Requested ${requestedQty}, available ${availableQty}`);
    }
  }
};

// Get all orders
router.get('/', (req, res) => {
  const db = getDatabase();
  const {
    status,
    date_from,
    date_to,
    search,
    is_return,
    item_search,
    page = 1,
    limit = 10,
  } = req.query;

  const safePage = Math.max(parseInt(page, 10) || 1, 1);
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 200);

  try {
    // If client is filtering for return orders
    if (parseBoolean(is_return, false)) {
      let query = `
        SELECT 
          r.id,
          'RET-' || r.id as barcode,
          r.created_at as date,
          r.total_refund_amount as total_amount,
          'completed' as status,
          u.name as staff_name,
          r.qty,
          r.reason as credit_reason,
          r.order_id as original_order_id
        FROM returns r
        JOIN users u ON r.user_id = u.id
      `;
      const params = [];
      const conditions = [];
      
      if (date_from) {
        conditions.push('DATE(r.created_at) >= ?');
        params.push(date_from);
      }
      if (date_to) {
        conditions.push('DATE(r.created_at) <= ?');
        params.push(date_to);
      }
      if (search && String(search).trim()) {
        const like = `%${String(search).trim()}%`;
        conditions.push('(CAST(r.id AS TEXT) LIKE ? OR r.reason LIKE ?)');
        params.push(like, like);
      }
      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
      }
      query += ' ORDER BY r.created_at DESC';
      
      const offset = (safePage - 1) * safeLimit;
      const countQuery = `SELECT COUNT(*) as total FROM returns r ${conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''}`;
      const countResult = db.prepare(countQuery).get(...params);
      const total = countResult.total;
      
      const rows = db.prepare(`${query} LIMIT ? OFFSET ?`).all(...params, safeLimit, offset);
      
      return res.json({
        orders: rows.map(r => ({ ...r, is_return: true })),
        pagination: {
          page: safePage,
          limit: safeLimit,
          total,
          totalPages: Math.ceil(total / safeLimit)
        },
        totalAmount: rows.reduce((sum, order) => sum + parseFloat(order.total_amount || 0), 0)
      });
    }

    const hasItemSearch = item_search && String(item_search).trim();
    
    let query = `
      SELECT DISTINCT o.*, CASE WHEN s.name = 'Admin' THEN 'System' ELSE s.name END as staff_name,
             CASE WHEN (SELECT COUNT(*) FROM returns r WHERE r.order_id = o.id) > 0 THEN 1 ELSE 0 END as is_return
      FROM orders o
      JOIN users s ON o.user_id = s.id
    `;
    
    if (hasItemSearch) {
      query += `
        JOIN item_variant_order ivo ON o.id = ivo.order_id
        JOIN item_variant iv ON ivo.item_variant_id = iv.id
        JOIN item i ON iv.item_id = i.id
      `;
    }
    
    const params = [];
    const conditions = [];

    if (status) {
      conditions.push('o.status = ?');
      params.push(status);
    }

    if (date_from) {
      conditions.push('DATE(o.date) >= ?');
      params.push(date_from);
    }

    if (date_to) {
      conditions.push('DATE(o.date) <= ?');
      params.push(date_to);
    }

    if (search && String(search).trim()) {
      const likeSearch = `%${String(search).trim()}%`;
      conditions.push('(CAST(o.id AS TEXT) LIKE ? OR o.barcode LIKE ? OR COALESCE(o.customer_name, \'\') LIKE ?)');
      params.push(likeSearch, likeSearch, likeSearch);
    }

    if (hasItemSearch) {
      const likeItemSearch = `%${String(item_search).trim()}%`;
      conditions.push('(iv.barcode LIKE ? OR i.name LIKE ?)');
      params.push(likeItemSearch, likeItemSearch);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ' ORDER BY o.date DESC, o.id DESC';

    let countQuery = 'SELECT COUNT(DISTINCT o.id) as total FROM orders o';
    if (hasItemSearch) {
      countQuery += `
        JOIN item_variant_order ivo ON o.id = ivo.order_id
        JOIN item_variant iv ON ivo.item_variant_id = iv.id
        JOIN item i ON iv.item_id = i.id
      `;
    }
    if (conditions.length > 0) {
      countQuery += ` WHERE ${conditions.join(' AND ')}`;
    }

    const countResult = db.prepare(countQuery).get(...params);
    const total = countResult.total;
    const offset = (safePage - 1) * safeLimit;

    const rows = db.prepare(`${query} LIMIT ? OFFSET ?`).all(...params, safeLimit, offset);
    const totalAmount = rows.reduce((sum, order) => sum + parseFloat(order.total_amount || 0), 0);

    res.json({
      orders: rows,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit)
      },
      totalAmount,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Search recently completed orders that can be returned.
router.get('/return-search', (req, res) => {
  const db = getDatabase();
  const { q = '', limit = 20 } = req.query;
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

  try {
    let query = `
      SELECT
        o.id,
        o.barcode,
        o.date,
        o.total_amount,
        o.customer_name,
        o.status,
        CASE WHEN s.name = 'Admin' THEN 'System' ELSE s.name END as staff_name
      FROM orders o
      JOIN users s ON s.id = o.user_id
      WHERE o.status = 'completed'
        AND (SELECT COUNT(*) FROM returns r WHERE r.order_id = o.id) = 0
    `;

    const params = [];
    if (String(q).trim()) {
      const like = `%${String(q).trim()}%`;
      query += ' AND (CAST(o.id AS TEXT) LIKE ? OR o.barcode LIKE ? OR COALESCE(o.customer_name, \'\') LIKE ?)';
      params.push(like, like, like);
    }

    query += ' ORDER BY o.date DESC, o.id DESC LIMIT ?';
    params.push(safeLimit);

    const rows = db.prepare(query).all(...params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get daily sales summary
router.get('/reports/daily', (req, res) => {
  const db = getDatabase();
  const { date } = req.query;
  const targetDate = date || new Date().toISOString().split('T')[0];

  try {
    const summary = db.prepare(`
      SELECT
        COUNT(*) as total_orders,
        SUM(total_amount) as total_sales,
        SUM(additional_charges) as total_discounts,
        AVG(total_amount) as average_order_value
      FROM orders
      WHERE DATE(date) = ?
        AND status = 'completed'
    `).get(targetDate);

    const topItems = db.prepare(`
      SELECT i.name as item_name, v.variant_name,
             SUM(ivo.qty) as total_qty,
             SUM(ivo.qty * ivo.unit_price) as total_revenue
      FROM item_variant_order ivo
      JOIN orders o ON ivo.order_id = o.id
      JOIN item_variant iv ON ivo.item_variant_id = iv.id
      JOIN item i ON iv.item_id = i.id
      JOIN variant v ON iv.variant_id = v.id
      WHERE DATE(o.date) = ?
        AND o.status = 'completed'
      GROUP BY ivo.item_variant_id
      ORDER BY total_qty DESC
      LIMIT 10
    `).all(targetDate);

    res.json({
      date: targetDate,
      summary,
      top_items: topItems,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get returnable details for a completed order.
router.get('/:id/returnable-items', (req, res) => {
  const db = getDatabase();
  const { id } = req.params;

  try {
    const order = db.prepare(`
      SELECT id, barcode, date, customer_name, total_amount, status,
             CASE WHEN (SELECT COUNT(*) FROM returns r WHERE r.order_id = o.id) > 0 THEN 1 ELSE 0 END as is_return
      FROM orders o
      WHERE id = ?
    `).get(id);

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.status !== 'completed') {
      return res.status(400).json({ error: 'Only completed orders can be returned' });
    }

    if (order.is_return) {
      return res.status(400).json({ error: 'Cannot create return from another return order' });
    }

    const items = db.prepare(`
      SELECT
        ivo.id as order_item_id,
        ivo.item_variant_id,
        ivo.qty,
        ivo.unit_price,
        ivo.original_price,
        i.name as item_name,
        v.variant_name,
        iv.barcode
      FROM item_variant_order ivo
      JOIN item_variant iv ON iv.id = ivo.item_variant_id
      JOIN item i ON i.id = iv.item_id
      JOIN variant v ON v.id = iv.variant_id
      WHERE ivo.order_id = ?
        AND ivo.qty > 0
      ORDER BY ivo.id ASC
    `).all(id);

    const returnTotals = db.prepare(`
      SELECT
        ivo.item_variant_id,
        COALESCE(SUM(r.qty), 0) AS returned_qty
      FROM returns r
      JOIN item_variant_order ivo ON r.item_variant_order_id = ivo.id
      WHERE r.order_id = ?
      GROUP BY ivo.item_variant_id
    `).all(id);

    const returnedQtyMap = returnTotals.reduce((acc, row) => {
      acc[row.item_variant_id] = parseOptionalNumber(row.returned_qty, 0);
      return acc;
    }, {});

    const allocationRows = db.prepare(`
      SELECT
        ivo.id AS order_item_id,
        ivo.stock_batch_id,
        ivo.qty AS qty,
        sb.buy_price AS batch_buy_price,
        sb.sell_price AS batch_sell_price,
        ivo.unit_price AS sold_unit_price,
        sb.expire_date,
        sb.created_at as batch_created_at
      FROM item_variant_order ivo
      LEFT JOIN stock_batch sb ON sb.id = ivo.stock_batch_id
      WHERE ivo.order_id = ?
      ORDER BY ivo.id ASC
    `).all(id);

    const allocationMap = allocationRows.reduce((acc, allocation) => {
      if (!acc[allocation.order_item_id]) {
        acc[allocation.order_item_id] = [];
      }
      acc[allocation.order_item_id].push(allocation);
      return acc;
    }, {});

    const returnableItems = items
      .map((item) => {
        const soldQty = parseOptionalNumber(item.qty, 0);
        const alreadyReturnedQty = parseOptionalNumber(returnedQtyMap[item.item_variant_id], 0);
        const maxReturnableQty = Math.max(0, soldQty - alreadyReturnedQty);

        return {
          ...item,
          sold_qty: soldQty,
          already_returned_qty: alreadyReturnedQty,
          max_returnable_qty: maxReturnableQty,
          batch_allocations: allocationMap[item.order_item_id] || [],
        };
      })
      .filter((item) => item.max_returnable_qty > 0);

    res.json({
      order,
      items: returnableItems,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get order by ID with items
router.get('/:id', (req, res) => {
  const db = getDatabase();
  const { id } = req.params;

  try {
    // 1. Try to find in orders table
    const order = db.prepare(`
      SELECT o.*, CASE WHEN s.name = 'Admin' THEN 'System' ELSE s.name END as staff_name,
             CASE WHEN (SELECT COUNT(*) FROM returns r WHERE r.order_id = o.id) > 0 THEN 1 ELSE 0 END as is_return
      FROM orders o
      JOIN users s ON o.user_id = s.id
      WHERE o.id = ?
    `).get(id);

    if (order) {
      const items = db.prepare(`
        SELECT ivo.*, iv.barcode, i.name as item_name, v.variant_name, c.name as category,
               ivo.discount_source, ivo.discount_type as item_discount_type,
               ivo.discount_value as item_discount_value, ivo.discount_amount as item_discount_amount,
               ivo.original_price
        FROM item_variant_order ivo
        JOIN item_variant iv ON ivo.item_variant_id = iv.id
        JOIN item i ON iv.item_id = i.id
        JOIN variant v ON iv.variant_id = v.id
        JOIN category c ON i.category_id = c.id
        WHERE ivo.order_id = ?
      `).all(id);

      const allocations = db.prepare(`
        SELECT
          ivo.id AS order_item_id,
          ivo.stock_batch_id,
          ivo.qty AS qty,
          sb.buy_price AS batch_buy_price,
          sb.sell_price AS batch_sell_price,
          ivo.unit_price AS sold_unit_price,
          sb.expire_date,
          sb.created_at as batch_created_at
        FROM item_variant_order ivo
        LEFT JOIN stock_batch sb ON ivo.stock_batch_id = sb.id
        WHERE ivo.order_id = ?
        ORDER BY ivo.id ASC
      `).all(id);

      const allocationMap = allocations.reduce((acc, allocation) => {
        if (!acc[allocation.order_item_id]) {
          acc[allocation.order_item_id] = [];
        }
        acc[allocation.order_item_id].push(allocation);
        return acc;
      }, {});

      const itemsWithAllocations = items.map((item) => ({
        ...item,
        batch_allocations: allocationMap[item.id] || []
      }));

      return res.json({
        ...order,
        items: itemsWithAllocations,
      });
    }

    // 2. Try to find in returns table
    const returnRow = db.prepare(`
      SELECT 
        r.id,
        r.order_id as original_order_id,
        'RET-' || r.id as barcode,
        r.created_at as date,
        r.total_refund_amount as total_amount,
        'completed' as status,
        u.name as staff_name,
        r.reason as credit_reason,
        o.customer_name
      FROM returns r
      JOIN users u ON r.user_id = u.id
      JOIN orders o ON r.order_id = o.id
      WHERE r.id = ?
    `).get(id);

    if (returnRow) {
      // Fetch return items
      const items = db.prepare(`
        SELECT 
          ivo.item_variant_id,
          -r.qty as qty,
          ivo.unit_price,
          ivo.original_price,
          i.name as item_name,
          v.variant_name,
          iv.barcode,
          'return' as discount_source
        FROM returns r
        JOIN item_variant_order ivo ON r.item_variant_order_id = ivo.id
        JOIN item_variant iv ON ivo.item_variant_id = iv.id
        JOIN item i ON iv.item_id = i.id
        JOIN variant v ON iv.variant_id = v.id
        WHERE r.id = ?
      `).all(id);
      
      return res.json({
        ...returnRow,
        is_return: true,
        items,
      });
    }

    return res.status(404).json({ error: 'Order or return not found' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create new order (normal or return)
router.post('/', (req, res) => {
  const db = getDatabase();
  const {
    staff_id,
    user_id,
    additional_charges = 0,
    customer_name,
    table_number,
    tender_cash,
    discount_type,
    discount_value = 0,
    status = 'active',
    items,
    is_card_payment = false,
    barcode,
    is_return = false,
    original_order_id,
    credit_reason,
    return_items,
  } = req.body;

  const userId = user_id || staff_id;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  if (!isValidOrderStatus(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const safeIsReturn = parseBoolean(is_return, false);

  let normalizedItems;
  let normalizedReturnItems;
  try {
    normalizedItems = normalizeOrderItems(items, { allowEmpty: safeIsReturn });
    normalizedReturnItems = normalizeReturnItems(return_items);
  } catch (validationError) {
    return res.status(400).json({ error: validationError.message });
  }

  if (!safeIsReturn && normalizedItems.length === 0) {
    return res.status(400).json({ error: 'Items are required' });
  }

  if (safeIsReturn && !original_order_id) {
    return res.status(400).json({ error: 'original_order_id is required for return orders' });
  }

  if (safeIsReturn && normalizedReturnItems.length === 0) {
    return res.status(400).json({ error: 'return_items are required for return orders' });
  }

  if (!safeIsReturn && normalizedReturnItems.length > 0) {
    return res.status(400).json({ error: 'return_items are only allowed for return orders' });
  }

  const safeAdditionalCharges = parseOptionalNumber(additional_charges, 0);
  const safeTenderCash = tender_cash === undefined ? null : parseOptionalNumber(tender_cash, 0);
  const requestedDiscountValue = safeIsReturn ? 0 : parseOptionalNumber(discount_value, 0);
  const requestedDiscountType = safeIsReturn ? null : (discount_type || null);
  let safeOriginalOrderId = null;
  try {
    safeOriginalOrderId = safeIsReturn ? parsePositiveInteger(original_order_id, 'original_order_id') : null;
  } catch (validationError) {
    return res.status(400).json({ error: validationError.message });
  }

  const safeCreditReason = safeIsReturn ? parseOptionalText(credit_reason) : null;
  const generatedBarcode = typeof generateUniqueBarcode === 'function' ? generateUniqueBarcode() : null;
  const orderBarcode = parseOptionalText(barcode)
    || generatedBarcode
    || Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
  const safeIsCardPayment = parseBoolean(is_card_payment, false) ? 1 : 0;

  let subtotal = 0;
  for (const item of normalizedItems) {
    subtotal += item.unit_price * item.qty;
  }

  let returnCreditTotal = 0;
  for (const returnItem of normalizedReturnItems) {
    returnCreditTotal += returnItem.unit_price * returnItem.qty;
  }

  const normalizedDiscount = normalizeOrderDiscountForGlobalRules(db, {
    subtotal,
    discountType: requestedDiscountType,
    discountValue: requestedDiscountValue,
    isReturn: safeIsReturn,
  });

  const discountAmount = normalizedDiscount.discountAmount;
  const totalAmount = subtotal + safeAdditionalCharges - discountAmount - returnCreditTotal;
  const computedCreditApplied = safeIsReturn ? Math.max(totalAmount, 0) : 0;

  const transaction = db.transaction(() => {
    // If it's a return order, we insert records directly into the returns table
    if (safeIsReturn) {
      const originalOrder = db.prepare(`
        SELECT id, status
        FROM orders
        WHERE id = ?
      `).get(safeOriginalOrderId);

      if (!originalOrder) {
        throw new Error('Original order not found');
      }
      if (originalOrder.status !== 'completed') {
        throw new Error('Only completed orders can be returned');
      }

      validateReturnQuantities(db, safeOriginalOrderId, normalizedReturnItems);

      const returnResults = [];
      for (const returnItem of normalizedReturnItems) {
        const originalItem = db.prepare(`
          SELECT id, stock_batch_id, unit_price
          FROM item_variant_order
          WHERE id = ?
        `).get(returnItem.source_order_item_id);

        if (!originalItem) {
          throw new Error(`Original order item not found for source_order_item_id ${returnItem.source_order_item_id}`);
        }

        const refundAmount = returnItem.unit_price * returnItem.qty;
        const result = db.prepare(`
          INSERT INTO returns (
            qty,
            user_id,
            total_refund_amount,
            item_variant_order_id,
            order_id,
            reason,
            is_synced
          ) VALUES (?, ?, ?, ?, ?, ?, 0)
        `).run(
          returnItem.qty,
          userId,
          refundAmount,
          returnItem.source_order_item_id,
          safeOriginalOrderId,
          safeCreditReason || returnItem.description
        );

        // Restore stock batch qty
        if (originalItem.stock_batch_id) {
          db.prepare('UPDATE stock_batch SET remaining_qty = remaining_qty + ?, is_synced = 0, updated_at = ? WHERE id = ?')
            .run(returnItem.qty, getCurrentUTCTimestamp(), originalItem.stock_batch_id);
        }

        returnResults.push(result.lastInsertRowid);
      }

      // Deduct refund from cashier shift cash
      if (status === 'completed') {
        const refundDelta = returnCreditTotal;
        if (refundDelta > 0) {
          db.prepare(`
            UPDATE cashier_shift
            SET current_cash_onhand = current_cash_onhand - ?, is_synced = 0, updated_at = ?
            WHERE user_id = ? AND status = 'open'
          `).run(refundDelta, getCurrentUTCTimestamp(), userId);
        }
      }

      return returnResults[0];
    }

    // Normal order placement
    const orderResult = db.prepare(`
      INSERT INTO orders (
        user_id,
        date,
        additional_charges,
        total_amount,
        customer_name,
        table_number,
        tender_cash,
        discount_type,
        discount_value,
        status,
        is_card_payment,
        barcode,
        credit_from_return,
        is_synced
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `).run(
      userId,
      getCurrentUTCTimestamp(),
      safeAdditionalCharges,
      totalAmount,
      customer_name || null,
      table_number || null,
      safeTenderCash,
      normalizedDiscount.discountType,
      normalizedDiscount.discountValue,
      status,
      safeIsCardPayment,
      orderBarcode,
      0 // credit_from_return
    );

    const orderId = orderResult.lastInsertRowid;

    for (const item of normalizedItems) {
      allocateAndInsertOrderItem(db, {
        orderId,
        item,
        preferredBatchId: item.preferred_batch_id || null,
      });
    }

    if (status === 'completed') {
      const cashDelta = calculateOrderCashImpact(totalAmount, safeIsCardPayment);
      if (cashDelta !== 0) {
        db.prepare(`
          UPDATE cashier_shift
          SET current_cash_onhand = current_cash_onhand + ?, is_synced = 0, updated_at = ?
          WHERE user_id = ? AND status = 'open'
        `).run(cashDelta, getCurrentUTCTimestamp(), userId);
      }
    }

    return orderId;
  });

  try {
    const orderId = transaction();
    res.status(201).json({
      id: orderId,
      total_amount: totalAmount,
      status,
      barcode: orderBarcode,
      is_return: safeIsReturn,
      credit_applied: computedCreditApplied,
      return_credit_total: returnCreditTotal,
      message: 'Order processed successfully',
    });
  } catch (err) {
    if (err.message && err.message.startsWith('Insufficient stock')) {
      return res.status(400).json({ error: err.message });
    }
    if (err.message && err.message.includes('Return quantity exceeds')) {
      return res.status(400).json({ error: err.message });
    }
    if (err.message && (
      err.message === 'Original order not found' ||
      err.message === 'Only completed orders can be returned'
    )) {
      return res.status(400).json({ error: err.message });
    }
    if (err.message && err.message.includes('UNIQUE constraint failed: orders.barcode')) {
      return res.status(409).json({ error: 'Order barcode already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// Update order status
router.put('/:id/status', (req, res) => {
  const db = getDatabase();
  const { id } = req.params;
  const { status } = req.body;

  if (!isValidOrderStatus(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const transaction = db.transaction(() => {
      const order = db.prepare(`
        SELECT total_amount, user_id as staff_id, status as current_status,
               COALESCE(is_card_payment, 0) AS is_card_payment
        FROM orders
        WHERE id = ?
      `).get(id);

      if (!order) {
        throw new Error('Order not found');
      }

      if (order.current_status === status) {
        return { message: `Order already in ${status} status` };
      }

      if (status === 'cancelled' && order.current_status !== 'cancelled') {
        restoreOrderStock(db, id);
      }

      if (status !== 'cancelled' && order.current_status === 'cancelled') {
        const existingItems = db.prepare(`
          SELECT id, item_variant_id, qty, unit_price
          FROM item_variant_order
          WHERE order_id = ?
            AND qty > 0
        `).all(id);

        // Delete existing items variant order rows and recreate allocations
        db.prepare('DELETE FROM item_variant_order WHERE order_id = ?').run(id);

        for (const item of existingItems) {
          allocateAndInsertOrderItem(db, {
            orderId: id,
            item,
          });
        }
      }

      const result = db.prepare('UPDATE orders SET status = ?, is_synced = 0, updated_at = ? WHERE id = ?').run(status, getCurrentUTCTimestamp(), id);
      if (result.changes === 0) {
        throw new Error('Order not found');
      }

      const completedCashAmount = calculateOrderCashImpact(order.total_amount, order.is_card_payment);
      let cashChange = 0;
      if (order.current_status !== 'completed' && status === 'completed') {
        cashChange = completedCashAmount;
      } else if (order.current_status === 'completed' && status !== 'completed') {
        cashChange = -completedCashAmount;
      }

      if (cashChange !== 0) {
        db.prepare(`
          UPDATE cashier_shift
          SET current_cash_onhand = current_cash_onhand + ?, is_synced = 0, updated_at = ?
          WHERE user_id = ? AND status = 'open'
        `).run(cashChange, getCurrentUTCTimestamp(), order.staff_id);
      }

      if (status === 'cancelled') {
        return { message: 'Order cancelled and stock restored successfully' };
      }
      return { message: 'Order status updated successfully' };
    });

    const result = transaction();
    res.json(result);
  } catch (err) {
    if (err.message === 'Order not found') {
      return res.status(404).json({ error: err.message });
    }
    if (err.message && err.message.startsWith('Insufficient stock')) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

// Update order items and details (non-return orders only)
router.put('/:id', (req, res) => {
  const db = getDatabase();
  const { id } = req.params;
  const {
    staff_id,
    user_id,
    additional_charges = 0,
    customer_name,
    table_number,
    discount_type,
    discount_value = 0,
    status,
    tender_cash,
    is_card_payment,
    items,
  } = req.body;

  const resolvedStaffId = user_id || staff_id;

  let normalizedItems;
  try {
    normalizedItems = normalizeOrderItems(items);
  } catch (validationError) {
    return res.status(400).json({ error: validationError.message });
  }

  if (status !== undefined && !isValidOrderStatus(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const safeAdditionalCharges = parseOptionalNumber(additional_charges, 0);
  const requestedDiscountValue = parseOptionalNumber(discount_value, 0);
  const requestedDiscountType = discount_type || null;
  const safeTenderCash = tender_cash === undefined ? null : parseOptionalNumber(tender_cash, 0);
  const safeIsCardPayment = is_card_payment === undefined ? null : (parseBoolean(is_card_payment, false) ? 1 : 0);

  let subtotal = 0;
  for (const item of normalizedItems) {
    subtotal += item.unit_price * item.qty;
  }

  const normalizedDiscount = normalizeOrderDiscountForGlobalRules(db, {
    subtotal,
    discountType: requestedDiscountType,
    discountValue: requestedDiscountValue,
  });

  const discountAmount = normalizedDiscount.discountAmount;
  const totalAmount = subtotal + safeAdditionalCharges - discountAmount;

  try {
    const transaction = db.transaction(() => {
      const oldOrder = db.prepare(`
        SELECT total_amount as old_total, status as old_status, user_id as staff_id, tender_cash,
               COALESCE(is_card_payment, 0) AS old_is_card_payment
        FROM orders
        WHERE id = ?
      `).get(id);

      if (!oldOrder) {
        throw new Error('Order not found');
      }

      const resolvedStatus = status || oldOrder.old_status;
      const finalUserId = resolvedStaffId || oldOrder.staff_id;
      const resolvedTenderCash = safeTenderCash === null ? oldOrder.tender_cash : safeTenderCash;
      const resolvedIsCardPayment = safeIsCardPayment === null ? oldOrder.old_is_card_payment : safeIsCardPayment;

      const updateResult = db.prepare(`
        UPDATE orders
        SET user_id = ?, additional_charges = ?, total_amount = ?,
            customer_name = ?, table_number = ?, discount_type = ?, discount_value = ?, status = ?, tender_cash = ?, is_card_payment = ?,
            is_synced = 0, updated_at = ?
        WHERE id = ?
      `).run(
        finalUserId,
        safeAdditionalCharges,
        totalAmount,
        customer_name || null,
        table_number || null,
        normalizedDiscount.discountType,
        normalizedDiscount.discountValue,
        resolvedStatus,
        resolvedTenderCash,
        resolvedIsCardPayment,
        getCurrentUTCTimestamp(),
        id
      );

      if (updateResult.changes === 0) {
        throw new Error('Order not found');
      }

      if (oldOrder.old_status !== 'cancelled') {
        restoreOrderStock(db, id);
      }

      db.prepare('DELETE FROM item_variant_order WHERE order_id = ?').run(id);

      for (const item of normalizedItems) {
        allocateAndInsertOrderItem(db, {
          orderId: id,
          item,
          preferredBatchId: item.preferred_batch_id || null,
        });
      }

      const oldCompletedCash = oldOrder.old_status === 'completed'
        ? calculateOrderCashImpact(oldOrder.old_total, oldOrder.old_is_card_payment)
        : 0;
      const newCompletedCash = resolvedStatus === 'completed'
        ? calculateOrderCashImpact(totalAmount, resolvedIsCardPayment)
        : 0;

      if (finalUserId === oldOrder.staff_id) {
        const cashChange = newCompletedCash - oldCompletedCash;
        if (cashChange !== 0) {
          db.prepare(`
            UPDATE cashier_shift
            SET current_cash_onhand = current_cash_onhand + ?, is_synced = 0, updated_at = ?
            WHERE user_id = ? AND status = 'open'
          `).run(cashChange, getCurrentUTCTimestamp(), finalUserId);
        }
      } else {
        if (oldCompletedCash !== 0) {
          db.prepare(`
            UPDATE cashier_shift
            SET current_cash_onhand = current_cash_onhand - ?, is_synced = 0, updated_at = ?
            WHERE user_id = ? AND status = 'open'
          `).run(oldCompletedCash, getCurrentUTCTimestamp(), oldOrder.staff_id);
        }
        if (newCompletedCash !== 0) {
          db.prepare(`
            UPDATE cashier_shift
            SET current_cash_onhand = current_cash_onhand + ?, is_synced = 0, updated_at = ?
            WHERE user_id = ? AND status = 'open'
          `).run(newCompletedCash, getCurrentUTCTimestamp(), finalUserId);
        }
      }

      return { id, total_amount: totalAmount };
    });

    const result = transaction();
    res.json({
      id: result.id,
      total_amount: result.total_amount,
      message: 'Order updated successfully',
    });
  } catch (err) {
    if (err.message === 'Order not found') {
      return res.status(404).json({ error: err.message });
    }
    if (err.message && err.message.startsWith('Insufficient stock')) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;