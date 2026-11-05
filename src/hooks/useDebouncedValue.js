import { useEffect, useState } from 'react';
const SEARCH_DEBOUNCE_MS = 450;
function useDebouncedValue(value, delay = SEARCH_DEBOUNCE_MS) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timeout);
  }, [value, delay]);
  return debouncedValue;
}
export { SEARCH_DEBOUNCE_MS, useDebouncedValue };
