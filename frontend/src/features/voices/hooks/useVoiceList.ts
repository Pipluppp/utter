import { useCallback, useEffect, useRef, useState } from "react";
import { apiJson } from "../../../lib/api";
import type { VoicesResponse } from "../../../lib/types";
import { useDeferredLoading } from "../../shared/hooks";

const PER_PAGE = 10;

export type VoiceListFilters = {
  search: string;
  source: "all" | "uploaded" | "designed";
  sort: string;
  sortDir: "asc" | "desc";
  favorites: "all" | "true";
  page: number;
};

export type UseVoiceListResult = {
  data: VoicesResponse | null;
  loading: boolean;
  showLoading: boolean;
  error: string | null;
  reload: () => void;
  setError: (error: string | null) => void;
};

export function useVoiceList(filters: VoiceListFilters): UseVoiceListResult {
  const { search, source, sort, sortDir, favorites, page } = filters;

  const [data, setData] = useState<VoicesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const showLoading = useDeferredLoading(loading);
  const [error, setError] = useState<string | null>(null);
  const loadAbortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    loadAbortRef.current?.abort();
    const controller = new AbortController();
    loadAbortRef.current = controller;

    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      qs.set("page", String(page));
      qs.set("per_page", String(PER_PAGE));
      if (search.trim()) qs.set("search", search.trim());
      if (source !== "all") qs.set("source", source);
      if (sort !== "created_at") qs.set("sort", sort);
      if (sortDir !== "desc") qs.set("sort_dir", sortDir);
      if (favorites === "true") qs.set("favorites", "true");
      const res = await apiJson<VoicesResponse>(`/api/voices?${qs.toString()}`, {
        signal: controller.signal,
      });
      setData(res);
    } catch (e) {
      if (controller.signal.aborted) return;
      setError(e instanceof Error ? e.message : "Failed to load voices.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
      if (loadAbortRef.current === controller) loadAbortRef.current = null;
    }
  }, [search, page, source, sort, sortDir, favorites]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return () => loadAbortRef.current?.abort();
  }, []);

  const reload = useCallback(() => {
    void load();
  }, [load]);

  return { data, loading, showLoading, error, reload, setError };
}
