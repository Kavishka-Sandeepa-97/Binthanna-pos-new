const express = require('express');
const router = express.Router();
const { getDatabase } = require('../database/init');

// Helper function to format date as YYYY-MM-DD in local time
const formatLocalDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper function to get date range based on period
const getDateRange = (period, startDate, endDate) => {
  const now = new Date();
  let start, end;

  if (startDate && endDate && startDate !== 'null' && endDate !== 'null') {
    // Parse dates as local time
    start = new Date(startDate + 'T00:00:00');
    end = new Date(endDate + 'T23:59:59');
  } else {
    switch (period) {
      case 'today':
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        start = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)); // Start of day in UTC
        end = new Date(today.getTime() + (24 * 60 * 60 * 1000) - (today.getTimezoneOffset() * 60000) - 1000); // End of day in UTC
        break;
      case 'week':
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        weekStart.setHours(0, 0, 0, 0);
        start = new Date(weekStart.getTime() - (weekStart.getTimezoneOffset() * 60000));
        end = new Date(weekStart.getTime() + (7 * 24 * 60 * 60 * 1000) - (weekStart.getTimezoneOffset() * 60000) - 1000);
        break;
      case 'month':
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        start = new Date(monthStart.getTime() - (monthStart.getTimezoneOffset() * 60000));
        end = new Date(monthEnd.getTime() + (24 * 60 * 60 * 1000) - (monthEnd.getTimezoneOffset() * 60000) - 1000);
        break;
      case 'year':
        const yearStart = new Date(now.getFullYear(), 0, 1);
        const yearEnd = new Date(now.getFullYear(), 11, 31);
        start = new Date(yearStart.getTime() - (yearStart.getTimezoneOffset() * 60000));
        end = new Date(yearEnd.getTime() + (24 * 60 * 60 * 1000) - (yearEnd.getTimezoneOffset() * 60000) - 1000);
        break;
      default:
        // Last 30 days by default
        end = new Date(now.getTime() - (now.getTimezoneOffset() * 60000) + (24 * 60 * 60 * 1000) - 1000);
        start = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000) - (now.getTimezoneOffset() * 60000));
    }
  }

  // Ensure dates are valid
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new Error('Invalid date range');
  }

  return {
    start: formatLocalDate(start),
    end: formatLocalDate(end)
  };
};

const completedSalesCte = `
  WITH completed_sales AS (
    SELECT
      ivo.item_variant_id,
      ivo.order_id,
      ivo.qty,
      ivo.unit_price AS sold_unit_price,
      COALESCE(sb.buy_price, 0) AS buy_unit_price
    FROM item_variant_order ivo
    LEFT JOIN stock_batch sb ON ivo.stock_batch_id = sb.id
    JOIN orders o ON ivo.order_id = o.id
    WHERE o.status = 'completed'
      AND DATE(o.date) >= ?
      AND DATE(o.date) <= ?
  )
`;

// POS Reports

// Revenue report
router.get('/pos/revenue', (req, res) => {
  const db = getDatabase();
  const { period, start_date, end_date, group_by = 'day' } = req.query;

  const { start, end } = getDateRange(period, start_date, end_date);

  let groupFormat;
  switch (group_by) {
    case 'month':
      groupFormat = "strftime('%Y-%m', date)";
      break;
    case 'week':
      groupFormat = "strftime('%Y-%W', date)";
      break;
    case 'year':
      groupFormat = "strftime('%Y', date)";
      break;
    default:
      groupFormat = "strftime('%Y-%m-%d', date)";
  }

  try {
    const query = `
      WITH filtered_orders AS (
        SELECT
          id,
          total_amount,
          ${groupFormat} AS period
        FROM orders
        WHERE status = 'completed'
          AND DATE(date) >= ?
          AND DATE(date) <= ?
      ),
      order_costs AS (
        SELECT
          ivo.order_id,
          SUM(ivo.qty * COALESCE(sb.buy_price, 0)) AS total_cogs
        FROM item_variant_order ivo
        JOIN filtered_orders fo ON fo.id = ivo.order_id
        LEFT JOIN stock_batch sb ON ivo.stock_batch_id = sb.id
        GROUP BY ivo.order_id
      )
      SELECT
        fo.period AS period,
        COUNT(DISTINCT fo.id) AS order_count,
        ROUND(SUM(fo.total_amount), 2) AS total_revenue,
        ROUND(SUM(COALESCE(oc.total_cogs, 0)), 2) AS total_cogs,
        ROUND(SUM(fo.total_amount - COALESCE(oc.total_cogs, 0)), 2) AS total_profit,
        ROUND(MIN(fo.total_amount), 2) AS min_order,
        ROUND(MAX(fo.total_amount), 2) AS max_order,
        CASE
          WHEN SUM(fo.total_amount) != 0
          THEN ROUND((SUM(fo.total_amount - COALESCE(oc.total_cogs, 0)) / SUM(fo.total_amount)) * 100, 2)
          ELSE 0
        END AS margin_percent
      FROM filtered_orders fo
      LEFT JOIN order_costs oc ON oc.order_id = fo.id
      GROUP BY fo.period
      ORDER BY period DESC
    `;

    const rows = db.prepare(query).all(start, end);
    res.json({ data: rows, dateRange: { start, end } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Top selling products
router.get('/pos/top-products', (req, res) => {
  const db = getDatabase();
  const { period, start_date, end_date, limit = 10 } = req.query;

  const { start, end } = getDateRange(period, start_date, end_date);

  try {
    const rows = db.prepare(`
      ${completedSalesCte}
      SELECT
        i.name as item_name,
        v.variant_name,
        iv.barcode,
        SUM(cs.qty) as total_quantity,
        ROUND(SUM(cs.qty * cs.sold_unit_price), 2) as total_revenue,
        ROUND(SUM(cs.qty * cs.buy_unit_price), 2) as total_cogs,
        ROUND(SUM(cs.qty * (cs.sold_unit_price - cs.buy_unit_price)), 2) as gross_profit,
        CASE
          WHEN SUM(cs.qty * cs.buy_unit_price) > 0
          THEN ROUND((SUM(cs.qty * (cs.sold_unit_price - cs.buy_unit_price)) / SUM(cs.qty * cs.buy_unit_price)) * 100, 2)
          ELSE 0
        END as margin_percent,
        COUNT(DISTINCT cs.order_id) as order_count
      FROM completed_sales cs
      JOIN item_variant iv ON cs.item_variant_id = iv.id
      JOIN item i ON iv.item_id = i.id
      JOIN variant v ON iv.variant_id = v.id
      GROUP BY iv.id
      ORDER BY total_quantity DESC
      LIMIT ?
    `).all(start, end, parseInt(limit));
    
    res.json({ data: rows, dateRange: { start, end } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Category sales report
router.get('/pos/category-sales', (req, res) => {
  const db = getDatabase();
  const { period, start_date, end_date } = req.query;

  const { start, end } = getDateRange(period, start_date, end_date);

  try {
    const rows = db.prepare(`
      ${completedSalesCte}
      SELECT
        c.name as category_name,
        COUNT(DISTINCT cs.order_id) as order_count,
        SUM(cs.qty) as total_quantity,
        ROUND(SUM(cs.qty * cs.sold_unit_price), 2) as total_revenue,
        ROUND(SUM(cs.qty * cs.buy_unit_price), 2) as total_cogs,
        ROUND(SUM(cs.qty * (cs.sold_unit_price - cs.buy_unit_price)), 2) as gross_profit,
        CASE
          WHEN SUM(cs.qty * cs.buy_unit_price) > 0
          THEN ROUND((SUM(cs.qty * (cs.sold_unit_price - cs.buy_unit_price)) / SUM(cs.qty * cs.buy_unit_price)) * 100, 2)
          ELSE 0
        END as margin_percent
      FROM completed_sales cs
      JOIN item_variant iv ON cs.item_variant_id = iv.id
      JOIN item i ON iv.item_id = i.id
      JOIN category c ON i.category_id = c.id
      GROUP BY c.id
      ORDER BY total_revenue DESC
    `).all(start, end);
    
    res.json({ data: rows, dateRange: { start, end } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stock Reports

// Stock transaction report (Legacy or custom - updated to point to users)
router.get('/stock/transactions', (req, res) => {
  const db = getDatabase();
  const { period, start_date, end_date, type, supplier_id } = req.query;

  const { start, end } = getDateRange(period, start_date, end_date);

  try {
    let query = `
      SELECT
        st.*,
        sp.name as product_name,
        sc.name as category_name,
        u.name as unit_name,
        ss.name as supplier_name,
        s.name as staff_name
      FROM stock_transaction st
      JOIN stock_product sp ON st.product_id = sp.id
      JOIN stock_category sc ON sp.category_id = sc.id
      JOIN stock_unit u ON sp.unit_id = u.id
      LEFT JOIN stock_supplier ss ON st.supplier_id = ss.id
      JOIN users s ON st.user_id = s.id
      WHERE DATE(st.created_at) >= ?
        AND DATE(st.created_at) <= ?
    `;

    const params = [start, end];

    if (type) {
      query += ' AND st.type = ?';
      params.push(type);
    }

    if (supplier_id) {
      query += ' AND st.supplier_id = ?';
      params.push(supplier_id);
    }

    query += ' ORDER BY st.created_at DESC';

    const rows = db.prepare(query).all(...params);
    res.json({ data: rows, dateRange: { start, end } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Current stock levels (Legacy or custom)
router.get('/stock/levels', (req, res) => {
  const db = getDatabase();

  try {
    const rows = db.prepare(`
      SELECT
        sp.*,
        sc.name as category_name,
        u.name as unit_name
      FROM stock_product sp
      JOIN stock_category sc ON sp.category_id = sc.id
      JOIN stock_unit u ON sp.unit_id = u.id
      ORDER BY sp.name
    `).all();
    
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Low stock report (Legacy or custom)
router.get('/stock/low-stock', (req, res) => {
  const db = getDatabase();
  const { threshold = 10 } = req.query;

  try {
    const rows = db.prepare(`
      SELECT
        sp.*,
        sc.name as category_name,
        u.name as unit_name
      FROM stock_product sp
      JOIN stock_category sc ON sp.category_id = sc.id
      JOIN stock_unit u ON sp.unit_id = u.id
      WHERE sp.current_qty <= ?
      ORDER BY sp.current_qty ASC
    `).all(parseFloat(threshold));
    
    res.json({ data: rows, threshold });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Supplier purchase report (Legacy or custom)
router.get('/stock/supplier-purchases', (req, res) => {
  const db = getDatabase();
  const { period, start_date, end_date } = req.query;

  const { start, end } = getDateRange(period, start_date, end_date);

  try {
    const rows = db.prepare(`
      SELECT
        ss.id as supplier_id,
        ss.name as supplier_name,
        COALESCE(COUNT(st.id), 0) as transaction_count,
        COALESCE(SUM(st.qty), 0) as total_quantity,
        COALESCE(SUM(st.price * st.qty), 0) as total_amount
      FROM stock_supplier ss
      LEFT JOIN stock_transaction st ON ss.id = st.supplier_id 
        AND st.type = 'IN'
        AND DATE(st.created_at) >= ?
        AND DATE(st.created_at) <= ?
      GROUP BY ss.id, ss.name
      ORDER BY total_amount DESC
    `).all(start, end);
    
    res.json({ data: rows, dateRange: { start, end } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Inventory Valuation Report
router.get('/stock/valuation', (req, res) => {
  const db = getDatabase();
  const { period, start_date, end_date } = req.query;

  let stockBatchFilter = '';
  let params = [];
  let dateRange = null;
  
  if ((period && period !== 'all') || (start_date && end_date)) {
    const { start, end } = getDateRange(period, start_date, end_date);
    stockBatchFilter = 'AND DATE(sb.created_at) >= ? AND DATE(sb.created_at) <= ?';
    params = [start, end];
    dateRange = { start, end };
  }

  try {
    const rows = db.prepare(`
      SELECT 
        i.name as item_name,
        v.variant_name,
        c.name as category_name,
        b.brand_name,
        iv.barcode,
        
        -- Stock Information
        COALESCE(SUM(sb.remaining_qty), 0) as current_stock,
        COALESCE(SUM(sb.initial_qty), 0) as total_purchased,
        
        -- Cost Analysis
        CASE 
          WHEN SUM(sb.remaining_qty) > 0 
          THEN ROUND(SUM(sb.buy_price * sb.remaining_qty) / SUM(sb.remaining_qty), 2)
          ELSE COALESCE(AVG(sb.buy_price), 0)
        END as avg_buy_price,
        
        ROUND(COALESCE(SUM(sb.buy_price * sb.remaining_qty), 0), 2) as total_cost_investment,
        
        -- Selling Information  
        CASE 
          WHEN SUM(sb.remaining_qty) > 0 
          THEN ROUND(SUM(COALESCE(sb.sell_price, 0) * sb.remaining_qty) / SUM(sb.remaining_qty), 2)
          ELSE COALESCE(AVG(sb.sell_price), 0)
        END as current_selling_price,
        ROUND(COALESCE(SUM(COALESCE(sb.sell_price, 0) * sb.remaining_qty), 0), 2) as potential_revenue,
        
        -- Profit Analysis
        ROUND(
          COALESCE(SUM((COALESCE(sb.sell_price, 0) - sb.buy_price) * sb.remaining_qty), 0), 2
        ) as potential_profit,
        
        CASE 
          WHEN SUM(sb.buy_price * sb.remaining_qty) > 0 
          THEN ROUND(
            (COALESCE(SUM((COALESCE(sb.sell_price, 0) - sb.buy_price) * sb.remaining_qty), 0) / 
             COALESCE(SUM(sb.buy_price * sb.remaining_qty), 1)) * 100, 2
          )
          ELSE 0
        END as profit_margin_percent,
        
        -- Last Updated
        MAX(sb.created_at) as last_stock_update,
        MAX(COALESCE(sb.updated_at, sb.created_at)) as price_last_updated
        
      FROM item i
      JOIN item_variant iv ON i.id = iv.item_id
      JOIN variant v ON iv.variant_id = v.id
      JOIN category c ON i.category_id = c.id
      LEFT JOIN brand b ON i.brand_id = b.id
      LEFT JOIN stock_batch sb ON iv.id = sb.item_variant_id ${stockBatchFilter}
      
      GROUP BY iv.id, i.name, v.variant_name, c.name, b.brand_name, iv.barcode
      HAVING current_stock > 0
      ORDER BY iv.created_at DESC
    `).all(...params);

    const summaryRow = db.prepare(`
      SELECT
        COUNT(DISTINCT iv.id) as total_items,
        COALESCE(SUM(sb.remaining_qty), 0) as total_stock_units,
        ROUND(COALESCE(SUM(sb.buy_price * sb.remaining_qty), 0), 2) as total_investment,
        ROUND(COALESCE(SUM(COALESCE(sb.sell_price, 0) * sb.remaining_qty), 0), 2) as total_potential_revenue,
        ROUND(COALESCE(SUM((COALESCE(sb.sell_price, 0) - sb.buy_price) * sb.remaining_qty), 0), 2) as total_potential_profit
      FROM item_variant iv
      LEFT JOIN stock_batch sb ON iv.id = sb.item_variant_id ${stockBatchFilter}
      WHERE COALESCE(sb.remaining_qty, 0) > 0
    `).get(...params);

    const toAmount = (value) => Number(Number(value || 0).toFixed(2));

    const summary = {
      total_items: Number(summaryRow?.total_items || 0),
      total_stock_units: Number(summaryRow?.total_stock_units || 0),
      total_investment: toAmount(summaryRow?.total_investment),
      total_potential_revenue: toAmount(summaryRow?.total_potential_revenue),
      total_potential_profit: toAmount(summaryRow?.total_potential_profit),
      overall_profit_margin: 0,
    };

    if (summary.total_investment > 0) {
      summary.overall_profit_margin = Number(
        ((summary.total_potential_profit / summary.total_investment) * 100).toFixed(2)
      );
    }

    res.json({ 
      data: rows, 
      summary: summary,
      dateRange: dateRange,
      generated_at: new Date().toISOString()
    });
  } catch (err) {
    console.error('Inventory valuation report error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Daily orders detail
router.get('/pos/daily-orders/:date', (req, res) => {
  const db = getDatabase();
  const { date } = req.params;

  try {
    const selectedDate = new Date(date + 'T00:00:00');
    if (isNaN(selectedDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
    }

    const dateStart = formatLocalDate(new Date(selectedDate.getTime() - (selectedDate.getTimezoneOffset() * 60000)));

    const orderCosts = db.prepare(`
      SELECT
        o.id AS order_id,
        ROUND(SUM(ivo.qty * COALESCE(sb.buy_price, 0)), 2) AS total_cogs
      FROM orders o
      JOIN item_variant_order ivo ON o.id = ivo.order_id
      LEFT JOIN stock_batch sb ON ivo.stock_batch_id = sb.id
      WHERE o.status = 'completed'
        AND DATE(o.date) = ?
      GROUP BY o.id
    `).all(dateStart);

    const orderCostMap = orderCosts.reduce((acc, row) => {
      acc[row.order_id] = Number(row.total_cogs || 0);
      return acc;
    }, {});

    // Fetch all orders for the date
    const orders = db.prepare(`
      SELECT
        o.id,
        'ORD-' || CAST(o.id AS TEXT) as order_number,
        o.status,
        o.total_amount,
        COALESCE(o.discount_value, 0) as discount_amount,
        o.tender_cash,
        COALESCE(o.tender_cash, 0) - o.total_amount as change_amount,
        CASE WHEN (SELECT COUNT(*) FROM returns r WHERE r.order_id = o.id) > 0 THEN 1 ELSE 0 END as is_return,
        o.is_card_payment,
        o.customer_name,
        o.date,
        o.user_id as staff_id,
        s.name as staff_name
      FROM orders o
      LEFT JOIN users s ON o.user_id = s.id
      WHERE o.status = 'completed'
        AND DATE(o.date) = ?
      ORDER BY o.date DESC
    `).all(dateStart);

    // For each order, fetch its items
    const ordersWithItems = orders.map(order => {
      const items = db.prepare(`
        SELECT
          ivo.id as item_variant_order_id,
          ivo.item_variant_id,
          ivo.qty,
          ivo.unit_price,
          (ivo.qty * ivo.unit_price) as line_total,
          iv.barcode,
          i.name as item_name,
          v.variant_name,
          c.name as category_name,
          b.brand_name
        FROM item_variant_order ivo
        JOIN item_variant iv ON ivo.item_variant_id = iv.id
        JOIN item i ON iv.item_id = i.id
        JOIN variant v ON iv.variant_id = v.id
        JOIN category c ON i.category_id = c.id
        LEFT JOIN brand b ON i.brand_id = b.id
        WHERE ivo.order_id = ?
      `).all(order.id);

      const totalCogs = Number(orderCostMap[order.id] || 0);
      const totalRevenue = Number(order.total_amount || 0);
      const totalProfit = Number((totalRevenue - totalCogs).toFixed(2));

      return {
        ...order,
        items: items,
        total_cogs: Number(totalCogs.toFixed(2)),
        total_profit: totalProfit,
        payment_type: order.is_card_payment ? 'Card' : 'Cash',
        order_type: order.is_return ? 'Return' : 'Regular',
      };
    });

    // Calculate summary for the day
    const summary = db.prepare(`
      SELECT
        COUNT(*) as total_orders,
        SUM(total_amount) as total_revenue,
        SUM(CASE WHEN is_card_payment = 0 THEN total_amount ELSE 0 END) as cash_revenue,
        SUM(CASE WHEN is_card_payment = 1 THEN total_amount ELSE 0 END) as card_revenue,
        (SELECT COALESCE(SUM(total_refund_amount), 0) FROM returns r WHERE DATE(r.created_at) = ?) as return_revenue,
        SUM(total_amount) as regular_revenue,
        MIN(total_amount) as min_order,
        MAX(total_amount) as max_order,
        ROUND(AVG(total_amount), 2) as avg_order
      FROM orders
      WHERE status = 'completed'
        AND DATE(date) = ?
    `).get(dateStart, dateStart);

    const summaryRevenue = Number(summary?.total_revenue || 0);
    const summaryCogs = Number(
      ordersWithItems.reduce((sum, order) => sum + Number(order.total_cogs || 0), 0).toFixed(2)
    );
    const summaryProfit = Number((summaryRevenue - summaryCogs).toFixed(2));
    const summaryMargin = summaryRevenue !== 0
      ? Number(((summaryProfit / summaryRevenue) * 100).toFixed(2))
      : 0;

    const toAmount = (value) => Number(Number(value || 0).toFixed(2));
    const normalizedSummary = {
      total_orders: Number(summary?.total_orders || 0),
      total_revenue: toAmount(summary?.total_revenue),
      total_cogs: toAmount(summaryCogs),
      total_profit: toAmount(summaryProfit),
      margin_percent: toAmount(summaryMargin),
      cash_revenue: toAmount(summary?.cash_revenue),
      card_revenue: toAmount(summary?.card_revenue),
      return_revenue: toAmount(summary?.return_revenue),
      regular_revenue: toAmount(summary?.regular_revenue),
      min_order: toAmount(summary?.min_order),
      max_order: toAmount(summary?.max_order),
      avg_order: toAmount(summary?.avg_order),
    };

    res.json({
      date: dateStart,
      orders: ordersWithItems,
      summary: normalizedSummary,
    });
  } catch (err) {
    console.error('Daily orders detail error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;