import { useEffect, useState } from "react";

/** The value, but only once it has stopped changing for `delayMs` (e.g. to wait for the end of typing before searching). */
export function useDebounced<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
