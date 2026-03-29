import { useEffect, useState } from "react";

export function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(t);
  }, [delayMs, value]);
  return debounced;
}

/**
 * Returns `true` only after `loading` has been `true` for at least `delayMs`.
 * Prevents flash-of-loading-state on fast responses.
 */
export function useDeferredLoading(loading: boolean, delayMs = 150) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!loading) {
      setShow(false);
      return;
    }
    const t = window.setTimeout(() => setShow(true), delayMs);
    return () => window.clearTimeout(t);
  }, [loading, delayMs]);
  return show;
}
