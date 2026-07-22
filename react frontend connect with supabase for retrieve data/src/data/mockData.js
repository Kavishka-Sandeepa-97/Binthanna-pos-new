// Comprehensive Realistic Dataset for Binthanna POS (Offline/Demo Mode)
export const mockData = {
  items: [
    { id: 101, name: 'Chicken Kottu (Full)', category_id: 1, brand_id: 1, image: null, is_qty_managed: true },
    { id: 102, name: 'Special Seafood Fried Rice', category_id: 1, brand_id: 1, image: null, is_qty_managed: true },
    { id: 103, name: 'Devilled Chicken Portion', category_id: 2, brand_id: 1, image: null, is_qty_managed: true },
    { id: 104, name: 'Fresh Mango Smoothie', category_id: 3, brand_id: 2, image: null, is_qty_managed: true },
    { id: 105, name: 'Ceylon Ginger Tea', category_id: 3, brand_id: 2, image: null, is_qty_managed: false },
    { id: 106, name: 'Cheese Burger Combo', category_id: 4, brand_id: 1, image: null, is_qty_managed: true },
    { id: 107, name: 'Crispy French Fries (L)', category_id: 4, brand_id: 1, image: null, is_qty_managed: true },
  ],

  categories: [
    { id: 1, name: 'Main Dishes' },
    { id: 2, name: 'Portions & Sides' },
    { id: 3, name: 'Beverages' },
    { id: 4, name: 'Fast Food' }
  ],

  item_variants: [
    { id: 201, item_id: 101, variant_id: 1, barcode: '8901001', is_discount_active: false, discount_type: null, discount_value: 0 },
    { id: 202, item_id: 102, variant_id: 2, barcode: '8901002', is_discount_active: true, discount_type: 'percentage', discount_value: 5 },
    { id: 203, item_id: 103, variant_id: 1, barcode: '8901003', is_discount_active: false, discount_type: null, discount_value: 0 },
    { id: 204, item_id: 104, variant_id: 1, barcode: '8901004', is_discount_active: false, discount_type: null, discount_value: 0 },
    { id: 205, item_id: 105, variant_id: 1, barcode: '8901005', is_discount_active: false, discount_type: null, discount_value: 0 },
    { id: 206, item_id: 106, variant_id: 2, barcode: '8901006', is_discount_active: false, discount_type: null, discount_value: 0 },
    { id: 207, item_id: 107, variant_id: 2, barcode: '8901007', is_discount_active: false, discount_type: null, discount_value: 0 },
  ],

  variants: [
    { id: 1, variant_name: 'Regular' },
    { id: 2, variant_name: 'Large' },
    { id: 3, variant_name: 'Family Pack' }
  ],

  stock_batches: [
    { id: 301, item_variant_id: 201, buy_price: 850.00, sell_price: 1450.00, initial_qty: 150, remaining_qty: 42, expire_date: '2026-12-31' },
    { id: 302, item_variant_id: 202, buy_price: 1100.00, sell_price: 1800.00, initial_qty: 120, remaining_qty: 18, expire_date: '2026-12-31' },
    { id: 303, item_variant_id: 203, buy_price: 900.00, sell_price: 1550.00, initial_qty: 80, remaining_qty: 6, expire_date: '2026-12-31' }, // Low stock!
    { id: 304, item_variant_id: 204, buy_price: 250.00, sell_price: 650.00, initial_qty: 200, remaining_qty: 85, expire_date: '2026-08-15' },
    { id: 305, item_variant_id: 205, buy_price: 40.00, sell_price: 150.00, initial_qty: 500, remaining_qty: 340, expire_date: '2027-01-01' },
    { id: 306, item_variant_id: 206, buy_price: 750.00, sell_price: 1350.00, initial_qty: 100, remaining_qty: 29, expire_date: '2026-09-20' },
    { id: 307, item_variant_id: 207, buy_price: 220.00, sell_price: 550.00, initial_qty: 150, remaining_qty: 2, expire_date: '2026-08-30' }, // Low stock!
  ],

  // Past 7 Days Orders
  orders: [
    { id: 5001, date: '2026-07-22T12:30:00Z', total_amount: 4700.00, customer_name: 'Kamal Perera', table_number: 'Table 04', status: 'active', is_card_payment: false, tender_cash: 5000.00, additional_charges: 0 },
    { id: 5002, date: '2026-07-22T11:15:00Z', total_amount: 3250.00, customer_name: 'Saman Silva', table_number: 'Table 02', status: 'active', is_card_payment: true, tender_cash: 3250.00, additional_charges: 0 },
    { id: 5003, date: '2026-07-22T10:05:00Z', total_amount: 1450.00, customer_name: 'Nimali K.', table_number: 'Takeaway', status: 'active', is_card_payment: false, tender_cash: 1500.00, additional_charges: 0 },
    { id: 5004, date: '2026-07-21T19:40:00Z', total_amount: 8600.00, customer_name: 'VIP Group', table_number: 'Table 08', status: 'active', is_card_payment: true, tender_cash: 8600.00, additional_charges: 0 },
    { id: 5005, date: '2026-07-21T18:10:00Z', total_amount: 2900.00, customer_name: 'Sunil D.', table_number: 'Table 01', status: 'active', is_card_payment: false, tender_cash: 3000.00, additional_charges: 0 },
    { id: 5006, date: '2026-07-20T20:15:00Z', total_amount: 6450.00, customer_name: 'Dilshan R.', table_number: 'Table 05', status: 'active', is_card_payment: false, tender_cash: 7000.00, additional_charges: 0 },
    { id: 5007, date: '2026-07-20T14:20:00Z', total_amount: 4100.00, customer_name: 'Family Booking', table_number: 'Table 06', status: 'active', is_card_payment: true, tender_cash: 4100.00, additional_charges: 0 },
    { id: 5008, date: '2026-07-19T13:00:00Z', total_amount: 5200.00, customer_name: 'Ashan F.', table_number: 'Table 03', status: 'active', is_card_payment: false, tender_cash: 5500.00, additional_charges: 0 },
    { id: 5009, date: '2026-07-18T19:00:00Z', total_amount: 7800.00, customer_name: 'Chathura M.', table_number: 'Table 07', status: 'active', is_card_payment: true, tender_cash: 7800.00, additional_charges: 0 },
    { id: 5010, date: '2026-07-17T21:30:00Z', total_amount: 9400.00, customer_name: 'Weekend Crowd', table_number: 'Table 10', status: 'active', is_card_payment: false, tender_cash: 10000.00, additional_charges: 0 }
  ],

  item_variant_orders: [
    { id: 6001, order_id: 5001, item_variant_id: 201, stock_batch_id: 301, qty: 2, unit_price: 1450.00, original_price: 1450.00, discount_amount: 0 },
    { id: 6002, order_id: 5001, item_variant_id: 202, stock_batch_id: 302, qty: 1, unit_price: 1800.00, original_price: 1800.00, discount_amount: 0 },
    { id: 6003, order_id: 5002, item_variant_id: 206, stock_batch_id: 306, qty: 2, unit_price: 1350.00, original_price: 1350.00, discount_amount: 0 },
    { id: 6004, order_id: 5002, item_variant_id: 207, stock_batch_id: 307, qty: 1, unit_price: 550.00, original_price: 550.00, discount_amount: 0 },
    { id: 6005, order_id: 5003, item_variant_id: 201, stock_batch_id: 301, qty: 1, unit_price: 1450.00, original_price: 1450.00, discount_amount: 0 },
    { id: 6006, order_id: 5004, item_variant_id: 202, stock_batch_id: 302, qty: 3, unit_price: 1800.00, original_price: 1800.00, discount_amount: 0 },
    { id: 6007, order_id: 5004, item_variant_id: 203, stock_batch_id: 303, qty: 2, unit_price: 1550.00, original_price: 1550.00, discount_amount: 0 },
    { id: 6008, order_id: 5004, item_variant_id: 204, stock_batch_id: 304, qty: 2, unit_price: 650.00, original_price: 650.00, discount_amount: 0 }
  ],

  returns: [
    { id: 7001, order_id: 5002, item_variant_order_id: 6004, qty: 1, total_refund_amount: 550.00, reason: 'Customer changed order' }
  ],

  in_out: [
    { id: 8001, type: 'OUT', description: 'Gas Cylinder refill', amount: 3500.00, created_at: '2026-07-21T09:00:00Z' },
    { id: 8002, type: 'OUT', description: 'Fresh Vegetables market purchase', amount: 4800.00, created_at: '2026-07-22T07:30:00Z' }
  ]
};
