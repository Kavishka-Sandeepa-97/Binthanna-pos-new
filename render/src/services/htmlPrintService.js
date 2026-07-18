// HTML/CSS print service for browser/Electron printing
// Opens a window containing a printable receipt and triggers window.print()

import JsBarcode from 'jsbarcode';

// Helper to get ipcRenderer in Electron environment
const getIpcRenderer = () => {
  try {
    if (typeof window !== 'undefined' && window.require) {
      const { ipcRenderer } = window.require('electron');
      return ipcRenderer;
    }
    return null;
  } catch (error) {
    console.error('Failed to get ipcRenderer:', error);
    return null;
  }
};

// Get receipt font settings from localStorage
const getReceiptFontSettings = () => {
  const fontFamily = localStorage.getItem('receiptFontFamily') || 'Arial';
  const rawWeight = (localStorage.getItem('receiptFontWeight') || 'normal').toString().toLowerCase();
  const rawSize = parseInt(localStorage.getItem('receiptFontSize') || '10', 10);

  // Keep receipt text inside thermal paper width even if saved settings are too large.
  const fontSize = Number.isFinite(rawSize) ? Math.min(10, Math.max(8, rawSize)) : 10;
  const fontWeight = ['normal', 'bold', '900'].includes(rawWeight) ? rawWeight : 'normal';

  return { fontFamily, fontWeight, fontSize };
};

const normalizeReceiptPrinterName = (printerName) => {
  const value = (printerName || '').toString().trim();

  if (['XP-80C (copy 2)', 'XP-80C (copy 4)'].includes(value)) {
    return 'POS80 Printer';
  }

  return value;
};

const normalizeBarcodePrinterName = (printerName) => {
  const value = (printerName || '').toString().trim();

  if (['XP-H500B', 'Xprinter XP-H500B'].includes(value)) {
    return 'Xprinter XP-H500B';
  }

  return value;
};

const generateBarcodeSvgMarkup = (barcodeValue) => {
  if (!barcodeValue || typeof document === 'undefined') {
    return '';
  }

  try {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    JsBarcode(svg, String(barcodeValue), {
      format: 'CODE128',
      width: 1.1,
      height: 20,
      displayValue: false,
      margin: 0,
    });
    return svg.outerHTML;
  } catch (error) {
    console.error('Failed to generate order barcode SVG:', error);
    return '';
  }
};

// Build receipt HTML used by both browser and thermal printing
const buildReceiptHTML = (order = {}, storeInfo = {}) => {
  const { id, barcode, items = [], cashier, paymentMethod, amountPaid, tender_cash, discount_type, discount_value, additional_charges } = order;
  const { fontFamily, fontWeight, fontSize } = getReceiptFontSettings();
  const orderBarcodeSvg = generateBarcodeSvgMarkup(barcode);

  // Calculate totals
  let subtotal = 0;
  let originalSubtotal = 0;
  let totalItemDiscounts = 0;
  items.forEach((it) => {
    const qty = parseFloat(it.quantity || it.qty || 0) || 0;
    const price = parseFloat(it.price || it.unit_price || 0) || 0;
    const origPrice = parseFloat(it.original_price || it.originalPrice || 0) || price;
    subtotal += qty * price;
    originalSubtotal += qty * origPrice;
    totalItemDiscounts += (parseFloat(it.item_discount_amount || it.discount_amount || it.discountAmount || 0) || 0) * qty;
  });

  let discountAmount = 0;
  if (discount_type === 'percent' && discount_value > 0) {
    discountAmount = (subtotal * discount_value) / 100;
  } else if (discount_type === 'fixed' && discount_value > 0) {
    discountAmount = discount_value;
  }

  const additionalCharges = parseFloat(additional_charges || order.additionalCharges || 0) || 0;
  const total = subtotal - discountAmount + additionalCharges;
  const paid = parseFloat(amountPaid || tender_cash || 0) || 0;
  const change = paid - total;
  const currency = 'Rs';

  const styles = `
    <style>
      @media print {
        @page { margin: 0; }
        body { margin: 0; }
      }
      * { box-sizing: border-box; }
      body {
        font-family: '${fontFamily}', Arial, Helvetica, sans-serif;
        font-weight: ${fontWeight};
        font-size: ${fontSize}px;
        line-height: 1.12;
        color: #000;
        -webkit-print-color-adjust: exact;
      }
      .receipt { width: 276px; padding: 4px; }
      .center { text-align: center; }
      .right { text-align: right; }
      h2 { margin: 2px 0; font-size: 16px; font-weight: 900; letter-spacing: 0.4px; }
      .small { font-size: 9px; }
      table { width: 100%; border-collapse: collapse; table-layout: fixed; }
      .items-table col.item-col { width: 62%; }
      .items-table col.qty-col { width: 15%; }
      .items-table col.total-col { width: 23%; }
      .items-table thead th { font-size: 12px; font-weight: 900; padding-bottom: 2px; }
      .items td { padding: 2px 1px; word-wrap: break-word; white-space: normal; font-size: 12px; }
      .items td:first-child { word-break: break-word; }
      .items td:nth-child(2) { text-align: center; }
      .items td:nth-child(3) { text-align: right; white-space: nowrap; }
      .disc-row td { font-size: 8px; color: #333; padding: 1px 0 3px 4px; font-weight: normal; }
      .subtotal-row td { font-size: 9px; font-weight: 500; }
      .discount-summary-row td { font-size: 10px; font-weight: 700; }
      .discount-highlight { font-size: 10px; font-weight: 900; letter-spacing: 0.1px; }
      .sep { border-top: 1px dashed #000; margin: 6px 0; }
      .total-row td { font-size: 12px; font-weight: 900; white-space: nowrap; }
      .change-row { font-size: 12px; font-weight: 900; }
      .receipt-footer { text-align: center; margin-top: 8px; }
      .order-barcode { text-align: center; margin-top: 6px; }
      .order-barcode svg { display: block; margin: 0 auto; max-width: 150px; height: 18px; }
      .order-barcode-number { margin-top: 1px; font-size: 9px; letter-spacing: 0.8px; }
    </style>
  `;

  const itemsHtml = items.map(it => {
    const itemName = (it.item_name || it.itemName || 'Item').toString();
    const variantName = (it.variant_name || it.variantName || '').toString();
    const displayName = variantName ? `${itemName} (${variantName})` : `${itemName}`;
    const qty = parseFloat(it.quantity || it.qty || 0) || 0;
    const price = parseFloat(it.price || it.unit_price || 0) || 0;
    const origPrice = parseFloat(it.original_price || it.originalPrice || price) || price;
    const lineTotal = (qty * price).toFixed(2);
    const discAmtRaw = parseFloat(it.item_discount_amount || it.discount_amount || it.discountAmount || 0) || 0;
    const discType = it.item_discount_type || it.discount_type || it.discountType || '';
    const discVal = parseFloat(it.item_discount_value || it.discount_value || it.discountValue || 0) || 0;
    const discountPerUnit = discAmtRaw > 0 ? discAmtRaw : Math.max(0, origPrice - price);
    const hasDiscount = discountPerUnit > 0;

    let row = `<tr class="items"><td>${displayName}</td><td>${qty}</td><td class="right">${lineTotal}</td></tr>`;

    if (hasDiscount) {
      const discountText = discType === 'percentage' && discVal > 0
        ? `${discVal}%`
        : `${currency} ${discountPerUnit.toFixed(2)}`;

      row += `<tr class="disc-row"><td colspan="3">&nbsp;&nbsp;Unit: ${currency} ${origPrice.toFixed(2)} | Discount: <span class="discount-highlight">${discountText}</span> | Final Unit: ${currency} ${price.toFixed(2)}</td></tr>`;
    } else {
      row += `<tr class="disc-row"><td colspan="3">&nbsp;&nbsp;Unit: ${currency} ${price.toFixed(2)}</td></tr>`;
    }

    return row;
  }).join('');

  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Receipt</title>
        ${styles}
      </head>
      <body>
        <div class="receipt">
          <div class="center">
            <h2>${storeInfo.name || 'STORE'}</h2>
            <div class="small">${storeInfo.address || ''}</div>
            <div class="small">${storeInfo.phone || ''}</div>
          </div>

          <div class="sep"></div>

          <div>
            <div>Order #: ${id || ''}</div>
            <div>Date: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</div>
            <div>Cashier: ${cashier === 'Admin' ? 'System' : (cashier || 'System')}</div>
          </div>

          <div class="sep"></div>

          <table class="items-table">
            <colgroup>
              <col class="item-col" />
              <col class="qty-col" />
              <col class="total-col" />
            </colgroup>
            <thead>
              <tr><th style="text-align:left">Item</th><th>Qty</th><th style="text-align:right">Total</th></tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div class="sep"></div>

          <table>
            <tr class="subtotal-row"><td>Subtotal (before discount)</td><td class="right">${currency} ${totalItemDiscounts > 0 ? originalSubtotal.toFixed(2) : subtotal.toFixed(2)}</td></tr>
            ${totalItemDiscounts > 0 ? `<tr class="discount-summary-row"><td>Item Discounts</td><td class="right">- <span class="discount-highlight">${currency} ${totalItemDiscounts.toFixed(2)}</span></td></tr>` : ''}
            ${discountAmount > 0 ? `<tr class="discount-summary-row"><td>Discount${discount_type === 'percent' ? ` (${discount_value}%)` : ''}</td><td class="right">- <span class="discount-highlight">${currency} ${discountAmount.toFixed(2)}</span></td></tr>` : ''}
            ${additionalCharges > 0 ? `<tr><td>Additional Charge</td><td class="right">${currency} ${additionalCharges.toFixed(2)}</td></tr>` : ''}
            <tr class="total-row"><td>TOTAL</td><td class="right">${currency} ${total.toFixed(2)}</td></tr>
          </table>

          <div class="sep"></div>

          <div>Payment: ${paymentMethod || 'cash'}</div>
          <div>Paid: ${currency} ${paid.toFixed(2)}</div>
          ${paid > 0 ? `<div class="change-row">Change: ${currency} ${change >= 0 ? change.toFixed(2) : '0.00'}</div>` : ''}

          <div class="receipt-footer">
            <div class="small">No cash refund</div>
            <div class="small">${storeInfo.receiptFooter || 'Thank you for your visit !'}</div>
            ${barcode ? `
              <div class="order-barcode">
                ${orderBarcodeSvg}
                <div class="order-barcode-number">${barcode}</div>
              </div>
            ` : ''}
          </div>
        </div>
      </body>
    </html>
  `;
};

const htmlPrintService = {
  canDirectPrint: () => {
    return !!getIpcRenderer();
  },

  getReceiptHTML: (order = {}, storeInfo = {}) => {
    return buildReceiptHTML(order, storeInfo);
  },

  printBillHTML: async (order = {}, storeInfo = {}) => {
    try {
      const html = buildReceiptHTML(order, storeInfo);

      // Open a new window and print
      const printWindow = window.open('', '_blank', 'width=360,height=600');
      if (!printWindow) {
        return { success: false, message: 'Unable to open print window (pop-up blocked).' };
      }

      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();

      // Give the new window a small moment to render before calling print
      setTimeout(() => {
        try {
          printWindow.print();
          // close after printing
          printWindow.close();
        } catch (e) {
          // ignore print errors
        }
      }, 300);

      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  // Direct thermal printer printing (for POS80 and similar receipt printers)
  printDirectThermal: async (order = {}, storeInfo = {}) => {
    try {
      const ipcRenderer = getIpcRenderer();
      const savedPrinter = normalizeReceiptPrinterName(localStorage.getItem('selectedPrinter'));
      
      if (!ipcRenderer) {
        return { success: false, message: 'Direct printing only available in desktop app' };
      }
      
      if (!savedPrinter) {
        return { success: false, message: 'No printer selected. Please go to Settings > Printer Settings' };
      }

      const html = buildReceiptHTML(order, storeInfo);

      // Send HTML to thermal printer via Electron silent print
      const result = await ipcRenderer.invoke('print-receipt', {
        content: html,
        printerName: savedPrinter
      });

      return result;
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  // Print barcode labels for XP-H500B label printer (35mm x 20mm, 3 columns)
  // previewBeforePrint opens print preview first so cashier can confirm before printing.
  printBarcodeLabels: async (item, quantity = 1, printerName = null, options = {}) => {
    try {
      const ipcRenderer = getIpcRenderer();
      const previewBeforePrint = options.previewBeforePrint !== false;
      const barcode = item.barcode || '';
      const price = parseFloat(item.selling_price || item.price || 0);
      const shopName = 'BINTHANNA RESTAURANT';
      
      // Persist a default barcode printer when user has not configured one yet
      const configuredBarcodePrinter = normalizeBarcodePrinterName(localStorage.getItem('barcodePrinter'));
      const defaultBarcodePrinter = 'Xprinter XP-H500B';
      const labelPrinter = normalizeBarcodePrinterName(printerName) || configuredBarcodePrinter || defaultBarcodePrinter;
      if (!configuredBarcodePrinter) {
        localStorage.setItem('barcodePrinter', defaultBarcodePrinter);
      }
      
      // Label dimensions: 35mm x 20mm, 3 columns per row
      // Total width: ~108mm (4.25 in), height per label: ~20mm (0.80 in)
      const labelsPerRow = 3;
      const totalRows = Math.ceil(quantity / labelsPerRow);
      
      // Generate HTML for barcode labels
      const styles = `
        <style>
          @media print {
            @page {
              size: 4.25in 0.78in;
              margin: 0;
            }
            body { margin: 0; padding: 0; }
          }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { 
            font-family: Arial, sans-serif; 
            font-size: 8px;
          }
          .label-row {
            display: flex;
            width: 4.25in;
            height: 0.78in;
            page-break-after: always;
            page-break-inside: avoid;
            break-after: page;
          }
          .label {
            width: 1.42in;
            height: 0.76in;
            padding: 0px 3px 2px 3px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: flex-start;
            text-align: center;
          }
          .label:last-child {
          }
          .shop-name {
            font-size: 10px;
            font-weight: bold;
            margin-top: -2px;
          }
          .barcode-container {
            margin: 0px 0;
          }
          .barcode-container svg {
            max-width: 0.95in;
            height: 22px;
          }
          .barcode-number {
            font-size: 7px;
            font-family: monospace;
            font-weight: 600;
            margin-top: 0px;
            color: #000;
            letter-spacing: 2px;
          }
          .price {
            font-size: 14px;
            font-weight: bold;
            margin-top: 2px;
          }
        </style>
      `;

      // Generate barcode SVG using Code128
      const generateBarcodeSVG = (code) => {
        if (!code) return '';
        try {
          if (typeof document === 'undefined') {
            return '';
          }

          const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          svg.setAttribute('class', 'barcode');

          JsBarcode(svg, String(code), {
            format: 'CODE128',
            width: 1.5,
            height: 25,
            displayValue: false,
            margin: 0
          });

          return svg.outerHTML;
        } catch (error) {
          console.error('Failed to generate barcode SVG:', error);
          return '';
        }
      };

      // Build labels HTML
      let labelsHtml = '';
      let labelCount = 0;
      
      for (let row = 0; row < totalRows; row++) {
        labelsHtml += '<div class="label-row">';
        
        for (let col = 0; col < labelsPerRow && labelCount < quantity; col++) {
          labelsHtml += `
            <div class="label">
              <div class="shop-name">${shopName}</div>
              <div class="barcode-container">
                ${generateBarcodeSVG(barcode)}
              </div>
              <div class="barcode-number">${barcode}</div>
              <div class="price">Rs. ${price.toFixed(2)}</div>
            </div>
          `;
          labelCount++;
        }
        
        // Fill remaining slots with empty labels if needed
        const remaining = labelsPerRow - (labelCount % labelsPerRow || labelsPerRow);
        if (labelCount >= quantity && remaining < labelsPerRow) {
          for (let i = 0; i < remaining; i++) {
            labelsHtml += '<div class="label"></div>';
          }
        }
        
        labelsHtml += '</div>';
      }

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Barcode Labels - ${barcode}</title>
            ${styles}
          </head>
          <body>
            ${labelsHtml}
          </body>
        </html>
      `;

      // For barcode labels, open preview before print by default.
      if (previewBeforePrint) {
        const printWindow = window.open('', '_blank', 'width=620,height=360');
        if (!printWindow) {
          return { success: false, message: 'Unable to open print preview window (pop-up blocked).' };
        }

        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();

        setTimeout(() => {
          try {
            printWindow.print();
          } catch (_error) {}
        }, 400);

        return { success: true, message: `Preview opened for ${quantity} barcode label(s)` };
      }

      // Optional silent mode for desktop app.
      if (ipcRenderer) {
        const result = await ipcRenderer.invoke('print-receipt', {
          content: html,
          printerName: labelPrinter,
        });

        return result.success
          ? { success: true, message: `Printing ${quantity} barcode label(s)` }
          : { success: false, message: result.message || result.error || 'Barcode print failed' };
      }

      // Browser fallback: open print window
      const printWindow = window.open('', '_blank', 'width=450,height=300');
      if (!printWindow) {
        return { success: false, message: 'Unable to open print window (pop-up blocked).' };
      }

      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();

      setTimeout(() => {
        try {
          printWindow.print();
          printWindow.close();
        } catch (_error) {}
      }, 400);

      return { success: true, message: `Printing ${quantity} barcode label(s)` };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
};

export default htmlPrintService;
