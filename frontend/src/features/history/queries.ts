import { queryOptions } from "@tanstack/react-query";
import { apiJson } from "../../lib/api";
import type { GenerationsResponse } from "../../lib/types";

const PER_PAGE = 10;

export type GenerationListFilters = {
  search: string;
  status: string;
  voiceId: string;
  sort: string;
  sortDir: "asc" | "desc";
  page: number;
};

export function buildGenQs(f: GenerationListFilters): string {
  const qs = new URLSearchParams();
  qs.set("page", String(f.page));
  qs.set("per_page", String(PER_PAGE));
  if (f.search.trim()) qs.set("search", f.search.trim());
  if (f.status !== "all") qs.set("status", f.status);
  if (f.voiceId !== "all") qs.set("voice_id", f.voiceId);
  if (f.sort !== "created_at") qs.set("sort", f.sort);
  if (f.sortDir !== "desc") qs.set("sort_dir", f.sortDir);
  return qs.toString();
}

export const generationQueries = {
  all: () => ["generations"] as const,
  lists: () => [...generationQueries.all(), "list"] as const,
  list: (filters: GenerationListFilters) =>
    queryOptions({
      queryKey: [...generationQueries.lists(), filters] as const,
      queryFn: ({ signal }) =>
        apiJson<GenerationsResponse>(`/api/generations?${buildGenQs(filters)}`, { signal }),
    }),
};
