# Barcode Scanner Feature - Implementation Guide

## Overview
The POS Interface now includes automatic barcode scanning functionality. When a barcode scanner is used, items are automatically added to the order without manual search and clicking.

## How It Works

### 1. **Barcode Detection (useBarcodeScanner Hook)**
- **File**: `render/src/hooks/useBarcodeScanner.js`
- Listens to all keyboard input globally (no focus required)
- Distinguishes between barcode scans and manual typing:
  - **Barcode scan**: All characters received within 100ms intervals
  - **Manual typing**: Characters with >100ms gaps reset the buffer
- Collects characters until `Enter` key is pressed
- Triggers callback with the complete barcode

### 2. **Item Lookup via API**
- **Endpoint**: `POST /api/itemVariant/barcode/:barcode`
- Returns full item details including:
  - Item name, variant name
  - Selling price
  - Stock quantity
  - Category information
  - Image

### 3. **Order Addition**
- If product found: Automatically adds item to order with quantity 1
- If product has stock: Item is added successfully
- If product out of stock: Shows error toast notification
- If barcode not found: Shows "Product Not Found" dialog (auto-closes in 0.5 seconds)

### 4. **User Feedback**
- **Success**: Green toast notification + success snackbar showing item details
- **Failure**: Red error toast + "Product Not Found" dialog
- **Scanning Status**: Blue info alert shows current barcode being scanned

## Implementation Details

### Files Created/Modified

#### 1. New Hook: `useBarcodeScanner.js`
```javascript
// Usage
const { isScanning, currentBarcode, resetBarcode } = useBarcodeScanner(
  (barcode) => handleBarcodeScanned(barcode)
);
```

**Features:**
- Global keyboard listener with capture phase
- Fast input detection (<100ms)
- Manual typing detection (>100ms resets)
- Character validation (alphanumeric + barcode chars)
- Enter key handler

#### 2. New Component: `BarcodeNotFoundDialog.jsx`
- Displays when barcode doesn't match any product
- Shows the scanned barcode for reference
- Auto-closes after 0.5 seconds
- Cannot be dismissed manually

#### 3. Updated: `POSInterface.jsx`
```javascript
// New states added
const [barcodeNotFoundOpen, setBarcodeNotFoundOpen] = useState(false);
const [failedBarcode, setFailedBarcode] = useState('');
const [barcodeLoading, setBarcodeLoading] = useState(false);
const [successMessage, setSuccessMessage] = useState(null);

// New function
const handleBarcodeScanned = useCallback(async (barcode) => {
  // Fetch from API
  // Check stock
  // Add to order
  // Show feedback
}, [dispatch]);

// New UI elements
- Barcode scanning status alert
- Success notification snackbar
- BarcodeNotFoundDialog component
- Updated search placeholder
```

## Database Requirements

### Item Variant Table
Must have the following fields:
- `id`: Unique identifier
- `barcode`: Unique barcode string (UNIQUE constraint)
- `item_id`: Foreign key to item
- `variant_id`: Foreign key to variant
- `item_name`: Name of the item
- `variant_name`: Name of the variant
- `selling_price`: Current selling price
- `total_stock`: Available stock quantity

## Testing the Feature

### Step 1: Ensure Barcodes Are Set
Make sure your item variants have barcodes assigned:

```sql
-- Check if barcodes exist
SELECT id, barcode, item_name, variant_name FROM item_variant WHERE barcode IS NOT NULL;

-- Update an item with a test barcode if needed
UPDATE item_variant SET barcode = '123456789' WHERE id = 1;
```

### Step 2: Test Barcode Scanning

#### Manual Testing (Without Physical Scanner)
1. Open POS Interface
2. Click anywhere in the window to ensure focus
3. Type a barcode (e.g., `123456789`)
4. Press `Enter`

**Expected Results:**
- ✅ If barcode exists and has stock: Item adds to order with green success notification
- ❌ If barcode doesn't exist: "Product Not Found" dialog appears, auto-closes after 0.5s
- ⚠️ If item out of stock: Red error notification

#### Physical Barcode Scanner Testing
1. Connect your barcode scanner to the system
2. Configure scanner settings (usually no special config needed - acts like keyboard)
3. Focus POS interface
4. Scan a product barcode
5. Scanner will type barcode + press Enter automatically
6. Item should be added to order

### Step 3: Test Error Scenarios

**Test Case 1: Invalid Barcode**
- Scan: `999999999` (non-existent)
- Expected: "Product Not Found" dialog shows, closes after 0.5s

**Test Case 2: Out of Stock Item**
- Ensure an item with a barcode has 0 stock
- Scan its barcode
- Expected: "Item is out of stock" error message

**Test Case 3: Manual vs Automatic Typing**
- Type slowly: `1234` (wait 150ms between chars) + Enter
  - Expected: Resets, item not found
- Type fast: `1234` (<100ms between chars) + Enter
  - Expected: Searches for item with barcode `1234`
- Scan with barcode gun
  - Expected: Item found and added

## API Endpoint Details

### Get Item by Barcode
**Endpoint:** `GET /api/itemVariant/barcode/:barcode`

**Parameters:**
- `barcode` (string): The barcode to search for

**Response (Success - 200):**
```json
{
  "id": 1,
  "barcode": "123456789",
  "item_id": 5,
  "variant_id": 2,
  "item_name": "Product A",
  "variant_name": "Medium",
  "category_name": "Electronics",
  "selling_price": 150.00,
  "total_stock": 25,
  "image": "path/to/image.jpg"
}
```

**Response (Not Found - 404):**
```json
{
  "error": "Item variant not found"
}
```

## Configuration

### Timing Adjustments
To change the detection sensitivity, modify in `useBarcodeScanner.js`:

```javascript
// Current: 100ms threshold between characters
if (timeDiff > 100) {
  barcodeRef.current = '';
}

// Adjust to 80ms for faster detection
if (timeDiff > 80) {
  barcodeRef.current = '';
}
```

### Auto-Close Duration
To change the "Product Not Found" dialog auto-close time, modify in `BarcodeNotFoundDialog.jsx`:

```javascript
// Current: 500ms (0.5 seconds)
const timer = setTimeout(() => {
  onClose();
}, 500);

// Change to 1000ms (1 second)
const timer = setTimeout(() => {
  onClose();
}, 1000);
```

## Barcode Scanner Configuration Tips

### Recommended Scanner Settings
1. **Prefix Character**: None (leave empty)
2. **Suffix Character**: Enter key (usually default)
3. **Typing Speed**: Default (usually 40-60ms per character)
4. **Beep on Success**: Enabled (optional)
5. **Beep on Error**: Enabled (optional)

### Common Scanner Types

**USB Keyboard Scanner:**
- Connect via USB
- Acts as keyboard input
- No driver installation needed
- Just start scanning

**Bluetooth Barcode Scanner:**
- Pair with device first
- Configure prefix/suffix in scanner settings
- Set suffix to "Enter" key
- Compatible with this implementation

**Serial Port Scanner:**
- Requires serial to USB adapter
- May need additional configuration
- Not directly supported in this implementation
- Consider keyboard emulation mode

## Troubleshooting

### Issue: Barcode not being recognized
**Solution:**
1. Verify barcode exists in database: `SELECT * FROM item_variant WHERE barcode = 'XXX';`
2. Check barcode is not in manual typing mode (type slowly to test)
3. Ensure Enter suffix is configured on scanner
4. Check browser console for errors

### Issue: Item not adding to order
**Solution:**
1. Check if item is out of stock
2. Verify API endpoint is accessible
3. Check browser network tab for API errors
4. Ensure item has selling_price value
5. Check Redux actions are dispatching correctly

### Issue: Dialog not auto-closing
**Solution:**
1. Clear browser cache
2. Check browser console for errors
3. Verify React version compatibility
4. Check if setTimeout is being cleared properly

## Future Enhancements

1. **Batch Scanning**: Support scanning multiple items before processing
2. **Quantity Input**: Scan barcode + quantity for bulk additions
3. **Sound Feedback**: Beep on successful/failed scans
4. **History**: Show recent scanned items
5. **Offline Mode**: Cache barcodes for offline scanning
6. **Scanner Settings UI**: Allow users to configure detection sensitivity

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review browser console for errors
3. Verify database has correct barcode values
4. Test with manual typing first
5. Contact development team with specific error messages
