import { getSupabaseClient } from '../supabaseClient';

export const fetchLiveDashboardData = async () => {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return {
      isConnected: false,
      error: 'Supabase URL and Public Anon Key are not configured yet. Please configure them in Settings.'
    };
  }

  try {
    // Parallel fetching from all cloud tables
    const [
      ordersRes,
      lineItemsRes,
      stockBatchesRes,
      itemsRes,
      itemVariantsRes,
      categoriesRes,
      variantsRes,
      returnsRes,
      inOutRes
    ] = await Promise.all([
      supabase.from('orders').select('*').order('date', { ascending: false }),
      supabase.from('item_variant_order').select('*'),
      supabase.from('stock_batch').select('*'),
      supabase.from('item').select('*'),
      supabase.from('item_variant').select('*'),
      supabase.from('category').select('*'),
      supabase.from('variant').select('*'),
      supabase.from('returns').select('*'),
      supabase.from('in_out').select('*')
    ]);

    if (ordersRes.error) throw ordersRes.error;

    return buildLiveAnalytics({
      orders: ordersRes.data || [],
      item_variant_orders: lineItemsRes.data || [],
      stock_batches: stockBatchesRes.data || [],
      items: itemsRes.data || [],
      item_variants: itemVariantsRes.data || [],
      categories: categoriesRes.data || [],
      variants: variantsRes.data || [],
      returns: returnsRes.data || [],
      in_out: inOutRes.data || []
    });
  } catch (error) {
    console.error("Error fetching live data from Supabase:", error);
    return {
      isConnected: false,
      error: error.message || 'Could not query Supabase tables. Please verify your Project URL and Anon Key.'
    };
  }
};

const buildLiveAnalytics = ({
  orders,
  item_variant_orders,
  stock_batches,
  items,
  item_variants,
  categories,
  variants,
  returns,
  in_out
}) => {
  // Lookup mappings
  const itemMap = new Map((items || []).map(i => [i.id, i]));
  const categoryMap = new Map((categories || []).map(c => [c.id, c.name]));
  const variantMap = new Map((variants || []).map(v => [v.id, v.variant_name]));
  const batchMap = new Map((stock_batches || []).map(b => [b.id, b]));

  // Filter Active Orders
  const validOrders = (orders || []).filter(o => o.status !== 'cancelled' && o.status !== 'voided');

  // Sales Revenue & Orders count
  const totalRevenue = validOrders.reduce((sum, o) => sum + (parseFloat(o.total_amount) || 0), 0);
  const totalOrdersCount = validOrders.length;
  const avgOrderValue = totalOrdersCount > 0 ? totalRevenue / totalOrdersCount : 0;

  // Expenses & Refunds
  const totalRefunds = (returns || []).reduce((sum, r) => sum + (parseFloat(r.total_refund_amount) || 0), 0);
  const totalExpenses = (in_out || [])
    .filter(io => io.type === 'OUT')
    .reduce((sum, io) => sum + (parseFloat(io.amount) || 0), 0);

  // Cost of Goods Sold (COGS) & Line items sold
  let totalCOGS = 0;
  let totalItemsSold = 0;
  const productPerformance = new Map();

  (item_variant_orders || []).forEach(line => {
    const qty = parseInt(line.qty) || 0;
    const unitPrice = parseFloat(line.unit_price) || 0;
    const lineRevenue = qty * unitPrice;

    // Find buy price from stock_batch or fallback 60%
    const batch = batchMap.get(line.stock_batch_id);
    const buyPrice = batch ? (parseFloat(batch.buy_price) || 0) : unitPrice * 0.6;
    const lineCost = qty * buyPrice;

    totalCOGS += lineCost;
    totalItemsSold += qty;

    const ivId = line.item_variant_id;
    if (ivId) {
      const existing = productPerformance.get(ivId) || {
        soldQty: 0,
        revenue: 0,
        cost: 0,
        profit: 0
      };
      existing.soldQty += qty;
      existing.revenue += lineRevenue;
      existing.cost += lineCost;
      existing.profit += (lineRevenue - lineCost);
      productPerformance.set(ivId, existing);
    }
  });

  const grossProfit = totalRevenue - totalCOGS;
  const netProfit = grossProfit - totalExpenses - totalRefunds;
  const profitMarginPercent = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : '0.0';

  // Process Item Variants list with stock, pricing, margins
  const productsList = (item_variants || []).map(iv => {
    const item = itemMap.get(iv.item_id) || {};
    const categoryName = categoryMap.get(item.category_id) || 'General';
    const variantName = variantMap.get(iv.variant_id) || '';

    // Find stock batches associated with item_variant
    const batches = (stock_batches || []).filter(sb => sb.item_variant_id === iv.id);
    const remainingQty = batches.reduce((sum, sb) => sum + (parseInt(sb.remaining_qty) || 0), 0);
    const primaryBatch = batches[0] || {};

    const buyPrice = parseFloat(primaryBatch.buy_price) || 0;
    const sellPrice = parseFloat(primaryBatch.sell_price) || 0;
    const margin = sellPrice > 0 ? (((sellPrice - buyPrice) / sellPrice) * 100).toFixed(1) : 0;
    const perf = productPerformance.get(iv.id) || { soldQty: 0, revenue: 0, profit: 0 };

    return {
      id: iv.id,
      item_id: item.id,
      name: item.name ? `${item.name} ${variantName ? `(${variantName})` : ''}`.trim() : `Item #${iv.id}`,
      rawName: item.name || 'Unnamed Item',
      variantName,
      category: categoryName,
      barcode: iv.barcode || 'N/A',
      buyPrice,
      sellPrice,
      remainingQty,
      profitMargin: margin,
      soldQty: perf.soldQty,
      revenue: perf.revenue,
      totalProfit: perf.profit,
      isLowStock: remainingQty > 0 && remainingQty <= 10,
      isOutOfStock: remainingQty <= 0
    };
  });

  // Top products
  const topByVolume = [...productsList].sort((a, b) => b.soldQty - a.soldQty).slice(0, 5);
  const topByProfit = [...productsList].sort((a, b) => b.totalProfit - a.totalProfit).slice(0, 5);

  // Revenue & Profit Trends by date
  const trendMap = new Map();
  validOrders.forEach(order => {
    if (!order.date) return;
    const dateStr = order.date.substring(0, 10);
    const existing = trendMap.get(dateStr) || { date: dateStr, revenue: 0, ordersCount: 0 };
    existing.revenue += parseFloat(order.total_amount) || 0;
    existing.ordersCount += 1;
    trendMap.set(dateStr, existing);
  });

  const revenueTrends = Array.from(trendMap.values())
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(-7)
    .map(t => {
      const estimatedProfit = Math.round(t.revenue * (parseFloat(profitMarginPercent) / 100 || 0.45));
      const formattedDate = new Date(t.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      return {
        date: t.date,
        label: formattedDate,
        revenue: Math.round(t.revenue),
        profit: estimatedProfit,
        orders: t.ordersCount
      };
    });

  // Payment method totals
  let cashTotal = 0;
  let cardTotal = 0;
  validOrders.forEach(o => {
    if (o.is_card_payment) {
      cardTotal += parseFloat(o.total_amount) || 0;
    } else {
      cashTotal += parseFloat(o.total_amount) || 0;
    }
  });

  return {
    isConnected: true,
    overview: {
      totalRevenue,
      netProfit,
      grossProfit,
      cogs: totalCOGS,
      totalExpenses,
      totalRefunds,
      profitMarginPercent,
      totalOrdersCount,
      totalItemsSold,
      avgOrderValue
    },
    revenueTrends,
    products: productsList,
    behavior: {
      topByVolume,
      topByProfit,
      cashTotal,
      cardTotal,
      paymentCashPercent: totalRevenue > 0 ? ((cashTotal / totalRevenue) * 100).toFixed(1) : 50,
      paymentCardPercent: totalRevenue > 0 ? ((cardTotal / totalRevenue) * 100).toFixed(1) : 50
    },
    recentOrders: validOrders.slice(0, 8)
  };
};
