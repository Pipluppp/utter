import { queryOptions } from "@tanstack/react-query";
import { apiJson } from "../../lib/api";
import type { VoicesResponse } from "../../lib/types";

export const PER_PAGE = 10;

export type VoiceListFilters = {
  search: string;
  source: "all" | "uploaded" | "designed";
  sort: string;
  sortDir: "asc" | "desc";
  favorites: "all" | "true";
  page: number;
};

export function buildVoiceListQs(f: VoiceListFilters): string {
  const qs = new URLSearchParams();
  qs.set("page", String(f.page));
  qs.set("per_page", String(PER_PAGE));
  if (f.search.trim()) qs.set("search", f.search.trim());
  if (f.source !== "all") qs.set("source", f.source);
  if (f.sort !== "created_at") qs.set("sort", f.sort);
  if (f.sortDir !== "desc") qs.set("sort_dir", f.sortDir);
  if (f.favorites === "true") qs.set("favorites", "true");
  return qs.toString();
}

export const voiceQueries = {
  all: () => ["voices"] as const,
  lists: () => [...voiceQueries.all(), "list"] as const,
  list: (filters: VoiceListFilters) =>
    queryOptions({
      queryKey: [...voiceQueries.lists(), filters] as const,
      queryFn: ({ signal }) =>
        apiJson<VoicesResponse>(`/api/voices?${buildVoiceListQs(filters)}`, { signal }),
    }),
  options: () =>
    queryOptions({
      queryKey: [...voiceQueries.all(), "options"] as const,
      queryFn: () => apiJson<VoicesResponse>("/api/voices"),
      staleTime: 1000 * 60, // 60s
    }),
};
