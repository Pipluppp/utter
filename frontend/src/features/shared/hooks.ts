import { useCallback, useEffect, useState } from "react";
import { apiJson } from "../../lib/api";
import type { CreditsUsageResponse } from "../../lib/types";

export function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(t);
  }, [delayMs, value]);
  return debounced;
}

export function useCreditsUsage(windowDays = 30) {
  const [data, setData] = useState<CreditsUsageResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiJson<CreditsUsageResponse>(
        `/api/credits/usage?window_days=${windowDays}`,
      );
      setData(res);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load credits usage");
    } finally {
      setLoading(false);
    }
  }, [windowDays]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
