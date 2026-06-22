import { useState, useEffect } from 'react';

/**
 * Custom hook for debouncing values
 * Prevents excessive API calls and re-renders
 * @param {any} value - The value to debounce
 * @param {number} delay - Delay in milliseconds (default: 300ms)
 * @returns {any} - The debounced value
 */
function useDebounce(value, delay = 300) {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        // Set up the timeout
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        // Cleanup function to prevent memory leaks
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]); // Only re-run if value or delay changes

    return debouncedValue;
}

export default useDebounce;
