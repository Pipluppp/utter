import { useCallback, useEffect, useRef, useState } from "react";
import { apiJson } from "../../../lib/api";
import type { GenerationsResponse } from "../../../lib/types";
import { useDeferredLoading } from "../../shared/hooks";

const PER_PAGE = 10;

export type GenerationListFilters = {
  search: string;
  status: string;
  voiceId: string;
  sort: string;
  sortDir: "asc" | "desc";
  page: number;
};

export type UseGenerationListResult = {
  data: GenerationsResponse | null;
  loading: boolean;
  showLoading: boolean;
  error: string | null;
  reload: () => void;
  setError: (error: string | null) => void;
};

export function useGenerationList(filters: GenerationListFilters): UseGenerationListResult {
  const { search, status, voiceId, sort, sortDir, page } = filters;

  const [data, setData] = useState<GenerationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const showLoading = useDeferredLoading(loading);
  const [error, setError] = useState<string | null>(null);
  const loadAbortRef = useRef<AbortController | null>(null);
  const refreshTimerRef = useRef<number | null>(null);

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
      if (status !== "all") qs.set("status", status);
      if (voiceId !== "all") qs.set("voice_id", voiceId);
      if (sort !== "created_at") qs.set("sort", sort);
      if (sortDir !== "desc") qs.set("sort_dir", sortDir);
      const res = await apiJson<GenerationsResponse>(`/api/generations?${qs.toString()}`, {
        signal: controller.signal,
      });
      setData(res);
    } catch (e) {
      if (controller.signal.aborted) return;
      setError(e instanceof Error ? e.message : "Failed to load history.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
      if (loadAbortRef.current === controller) loadAbortRef.current = null;
    }
  }, [search, page, status, voiceId, sort, sortDir]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return () => loadAbortRef.current?.abort();
  }, []);

  // Conditional polling: auto-refresh when active generations exist
  useEffect(() => {
    if (refreshTimerRef.current) {
      window.clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }

    const hasActive = data?.generations.some(
      (g) => g.status === "pending" || g.status === "processing",
    );
    if (!hasActive) return;

    refreshTimerRef.current = window.setInterval(() => void load(), 5000);
    return () => {
      if (refreshTimerRef.current) window.clearInterval(refreshTimerRef.current);
    };
  }, [data, load]);

  const reload = useCallback(() => {
    void load();
  }, [load]);

  return { data, loading, showLoading, error, reload, setError };
}
