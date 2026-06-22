import { useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook for detecting barcode scanner input
 * 
 * Features:
 * - Detects fast barcode scans (< 100ms per complete code)
 * - Ignores manual typing (> 100ms between characters)
 * - Works globally WITHOUT focus requirement
 * - Uses keydown event for better global capture
 * - Triggers callback when Enter key is pressed after barcode
 * 
 * Usage:
 * const { isScanning } = useBarcodeScanner((barcode) => {
 *   handleBarcode(barcode);
 * });
 */

const useBarcodeScanner = (onBarcodeScanned) => {
  const barcodeRef = useRef('');
  const lastTimeRef = useRef(Date.now());
  const timeoutRef = useRef(null);
  const isInputFocusedRef = useRef(false);

  const resetBarcode = useCallback(() => {
    barcodeRef.current = '';
  }, []);

  const handleKeyDown = useCallback(
    (event) => {
      // Check if an input, textarea, or contenteditable is focused
      const target = event.target;
      const isInputElement =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true';

      // If it's an input field and it's a search/text input, let normal typing happen
      if (isInputElement && (target.type === 'text' || target.type === 'search')) {
        isInputFocusedRef.current = true;
        return;
      }

      isInputFocusedRef.current = false;

      const now = Date.now();
      const timeDiff = now - lastTimeRef.current;

      // If more than 100ms since last keypress, likely manual typing - reset buffer
      if (timeDiff > 100) {
        barcodeRef.current = '';
      }

      lastTimeRef.current = now;

      // Handle Enter key - process barcode
      if (event.key === 'Enter') {
        if (barcodeRef.current.length > 0 && !isInputFocusedRef.current) {
          event.preventDefault();
          event.stopPropagation();
          
          // Call the callback with the scanned barcode
          if (onBarcodeScanned) {
            onBarcodeScanned(barcodeRef.current);
          }

          // Reset barcode
          resetBarcode();
        }
        return;
      }

      // Ignore if input is focused - let normal typing happen in input fields
      if (isInputFocusedRef.current) {
        return;
      }

      // Handle all printable characters (including numbers, letters, special barcode chars)
      if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
        barcodeRef.current += event.key;
      }
    },
    [onBarcodeScanned, resetBarcode]
  );

  useEffect(() => {
    // Add global keydown listener with capture phase
    window.addEventListener('keydown', handleKeyDown, true);

    // Cleanup function
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [handleKeyDown]);

  return {
    isScanning: barcodeRef.current.length > 0,
    currentBarcode: barcodeRef.current,
    resetBarcode
  };
};

export default useBarcodeScanner;
