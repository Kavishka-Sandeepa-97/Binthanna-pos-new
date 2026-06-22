# Cosmetic Shop POS System - API Documentation

## Overview
This is a comprehensive REST API for a cosmetic shop POS system built with Express.js and SQLite.

## Database Schema
The system implements the following entities:
- **Staff** - User management with roles (admin/cashier)
- **Category** - Product categories
- **Item** - Products/Items
- **Variant** - Item variants (sizes, types, colors, etc.)
- **Item Variant** - Specific item variants with barcodes
- **Order** - Customer orders
- **Item Variant Order** - Order line items
- **Sell Price History** - Price tracking

## API Endpoints

### Staff Management
- `GET /api/staff` - Get all staff members
- `GET /api/staff/:id` - Get staff by ID
- `POST /api/staff` - Create new staff member
- `PUT /api/staff/:id` - Update staff member
- `DELETE /api/staff/:id` - Delete staff member
- `POST /api/staff/login` - Staff login with PIN

### Category Management
- `GET /api/categories` - Get all categories
- `GET /api/categories/:id` - Get category by ID
- `POST /api/categories` - Create new category
- `PUT /api/categories/:id` - Update category
- `DELETE /api/categories/:id` - Delete category
- `GET /api/categories/:id/items` - Get items in category

### Item Management
- `GET /api/items` - Get all items with category info
- `GET /api/items/:id` - Get item by ID with variants
- `POST /api/items` - Create new item
- `PUT /api/items/:id` - Update item
- `DELETE /api/items/:id` - Delete item
- `GET /api/items/search/:query` - Search items

### Variant Management
- `GET /api/variants` - Get all variants
- `GET /api/variants/:id` - Get variant by ID
- `POST /api/variants` - Create new variant
- `PUT /api/variants/:id` - Update variant
- `DELETE /api/variants/:id` - Delete variant

### Item Variant Management
- `GET /api/item-variants` - Get all item variants with details
- `GET /api/item-variants/:id` - Get item variant by ID
- `POST /api/item-variants` - Create new item variant
- `PUT /api/item-variants/:id` - Update item variant
- `DELETE /api/item-variants/:id` - Delete item variant
- `GET /api/item-variants/barcode/:barcode` - Search by barcode
- `POST /api/item-variants/:id/price` - Set selling price

### Order Management
- `GET /api/orders` - Get all orders (with filters)
- `GET /api/orders/:id` - Get order by ID with items
- `POST /api/orders` - Create new order
- `PUT /api/orders/:id/status` - Update order status
- `GET /api/orders/reports/daily` - Daily sales report

### Cashier Shift Management
- `GET /api/cashier-shifts` - Get all shifts
- `GET /api/cashier-shifts/active/:user_id` - Get active shift for user
- `POST /api/cashier-shifts/open` - Open new shift
- `PUT /api/cashier-shifts/:id/close` - Close shift
- `PUT /api/cashier-shifts/:id/cash` - Update cash on hand

### In/Out Management
- `GET /api/in-out` - Get all transactions
- `POST /api/in-out` - Create new transaction
- `GET /api/in-out/summary` - Get summary report

## Features Implemented

### ✅ Database Structure
- Complete SQLite schema
- Foreign key relationships
- Data validation and constraints
- Default data seeding

### ✅ Authentication
- Staff login with PIN
- Role-based access (admin/cashier)
- User management
- Cashier shift management

### ✅ Product Management
- Categories and items
- Variants and item variants
- Barcode support
- Image support for items
- Price history tracking

### ✅ Order Processing
- Complete order creation
- Order status management
- Discount support (fixed/percentage)
- Cash handling

### ✅ Reporting
- Daily sales reports
- Top selling items
- In/Out transaction tracking

### ✅ Error Handling
- Comprehensive error responses
- Data validation
- Relationship integrity checks

## Default Data
- Default admin user: PIN `1234`
- Default categories: Electronics, Clothing, Accessories, Desserts, Snacks, Tobacco, Other

## Next Steps for Custom Shop Customization
1. Update default categories (Makeup, Skincare, Hair Care, Fragrances, etc.)
2. Add brand management features
3. Implement batch/expiry date tracking
4. Add customer loyalty program
5. Create product recommendation system

## Hardware Integration Ready
The API is structured to support:
- Cash drawer integration
- Barcode scanner (product lookup)
- Receipt printing
- Customer display systems

## Testing
Use the health check endpoint: `GET /api/health`

All endpoints return JSON responses with appropriate HTTP status codes.