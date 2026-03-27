import { getRouteApi } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button as AriaButton, Input, Label, SearchField } from "react-aria-components";
import { Button, button } from "../../components/atoms/Button";
import { Message } from "../../components/atoms/Message";
import { Skeleton } from "../../components/atoms/Skeleton";
import {
  AutocompleteSelect,
  type AutocompleteSelectItem,
} from "../../components/molecules/AutocompleteSelect";
import { SortSelect } from "../../components/molecules/SortSelect";
import { useWaveformListPlayer } from "../../hooks/useWaveformListPlayer";
import { apiJson } from "../../lib/api";
import { formatCreatedAt } from "../../lib/format";
import { resolveProtectedMediaUrl, triggerDownload } from "../../lib/protectedMedia";
import { input } from "../../lib/recipes/input";
import { paginationButton } from "../../lib/recipes/pagination-button";
import { statusBadge } from "../../lib/recipes/status-badge";
import type {
  Generation,
  GenerationsResponse,
  RegenerateResponse,
  VoicesResponse,
} from "../../lib/types";
import { useDebouncedValue } from "../shared/hooks";

const historyRoute = getRouteApi("/_app/history");

function tokenize(query: string) {
  return query.trim().split(/\s+/).filter(Boolean);
}

const PER_PAGE = 20;
const STATUS_ITEMS: AutocompleteSelectItem[] = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "processing", label: "Processing" },
  { id: "completed", label: "Completed" },
  { id: "failed", label: "Failed" },
  { id: "cancelled", label: "Cancelled" },
];
const SORT_OPTIONS = [
  { id: "created_at:desc", label: "↓ Date" },
  { id: "created_at:asc", label: "↑ Date" },
  { id: "duration_seconds:desc", label: "↓ Duration" },
  { id: "duration_seconds:asc", label: "↑ Duration" },
  { id: "voice_name:desc", label: "↓ Name" },
  { id: "voice_name:asc", label: "↑ Name" },
];

const HISTORY_SKELETON_VARIANTS = [
  { id: "ready-a", showMeta: true },
  { id: "active-a", showMeta: false },
  { id: "ready-b", showMeta: true },
  { id: "ready-c", showMeta: true },
] as const;

function Highlight({ text, tokens }: { text: string; tokens: string[] }) {
  if (tokens.length === 0) return <>{text}</>;
  const lower = text.toLowerCase();
  const ranges: Array<[number, number]> = [];
  for (const t of tokens) {
    const needle = t.toLowerCase();
    if (!needle) continue;
    let idx = 0;
    while (idx < lower.length) {
      const found = lower.indexOf(needle, idx);
      if (found === -1) break;
      ranges.push([found, found + needle.length]);
      idx = found + needle.length;
    }
  }
  if (ranges.length === 0) return <>{text}</>;
  ranges.sort((a, b) => a[0] - b[0]);

  const merged: Array<[number, number]> = [];
  for (const r of ranges) {
    const prev = merged[merged.length - 1];
    if (!prev || r[0] > prev[1]) merged.push(r);
    else prev[1] = Math.max(prev[1], r[1]);
  }

  const out: React.ReactNode[] = [];
  let cursor = 0;
  merged.forEach(([s, e]) => {
    if (cursor < s) out.push(<span key={`t-${cursor}-${s}`}>{text.slice(cursor, s)}</span>);
    out.push(
      <mark key={`m-${s}-${e}`} className="bg-foreground text-background px-0.5">
        {text.slice(s, e)}
      </mark>,
    );
    cursor = e;
  });
  if (cursor < text.length) out.push(<span key={`t-${cursor}-end`}>{text.slice(cursor)}</span>);
  return <>{out}</>;
}

function generationAudioUrl(gen: Generation) {
  if (!gen.audio_path) return null;
  return gen.audio_path;
}

type PlayState = "idle" | "loading" | "playing" | "paused" | "stopped";

function HistoryCardSkeleton({ showMeta = true }: { showMeta?: boolean }) {
  return (
    <div className="bg-background p-4 shadow-elevated">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 max-w-48 flex-1" />
          </div>

          <div className="mt-3 space-y-2">
            <Skeleton className="h-3 w-full max-w-3xl" />
            <Skeleton className="h-3 w-5/6 max-w-2xl" />
            <Skeleton className="h-3 w-2/3 max-w-xl" />
          </div>

          {showMeta ? (
            <div className="mt-3 flex flex-wrap gap-3">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-28" />
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 md:justify-self-end">
          <Skeleton className="h-8 w-18" />
          <Skeleton className="h-8 w-22" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-18" />
        </div>
      </div>

      <div className="mt-4">
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  );
}

function HistorySkeleton() {
  return (
    <div className="grid gap-4" aria-hidden="true">
      {HISTORY_SKELETON_VARIANTS.map(({ id, showMeta }) => (
        <HistoryCardSkeleton key={id} showMeta={showMeta} />
      ))}
    </div>
  );
}

export function HistoryPage() {
  const navigate = historyRoute.useNavigate();
  const { toggle } = useWaveformListPlayer();

  const {
    search: initialQuery,
    status: initialStatusParam,
    page: initialPage,
    sort: initialSort,
    sort_dir: initialSortDir,
    voice_id: initialVoiceIdParam,
  } = historyRoute.useSearch();
  const initialStatus = initialStatusParam ?? "all";
  const initialVoiceId = initialVoiceIdParam ?? "all";

  const [query, setQuery] = useState(initialQuery);
  const debounced = useDebouncedValue(query, 250);
  const tokens = useMemo(() => tokenize(debounced), [debounced]);

  const [status, setStatus] = useState<"all" | string>(initialStatus);
  const [sort, setSort] = useState(initialSort);
  const [sortDir, setSortDir] = useState<"asc" | "desc">(initialSortDir);
  const [voiceId, setVoiceId] = useState(initialVoiceId);
  const [voiceItems, setVoiceItems] = useState<AutocompleteSelectItem[]>([
    { id: "all", label: "All Voices" },
  ]);
  const [page, setPage] = useState(initialPage);

  const [data, setData] = useState<GenerationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [playState, setPlayState] = useState<Record<string, PlayState>>({});
  const waveRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const refreshTimerRef = useRef<number | null>(null);
  const loadAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiJson<VoicesResponse>("/api/voices?per_page=100")
      .then((res) => {
        if (cancelled) return;
        const items: AutocompleteSelectItem[] = [
          { id: "all", label: "All Voices" },
          ...res.voices.map((v) => ({ id: v.id, label: v.name })),
        ];
        setVoiceItems(items);
      })
      .catch(() => {
        /* voice list is best-effort for the filter */
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
      if (debounced.trim()) qs.set("search", debounced.trim());
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
  }, [debounced, page, status, voiceId, sort, sortDir]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return () => loadAbortRef.current?.abort();
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset paging when search/status/filter/sort changes
  useEffect(() => setPage(1), [debounced, status, voiceId, sort, sortDir]);

  useEffect(() => {
    void navigate({
      search: {
        search: debounced.trim() || "",
        status: status !== "all" ? status : undefined,
        voice_id: voiceId !== "all" ? voiceId : undefined,
        sort: sort !== "created_at" ? sort : "created_at",
        sort_dir: sortDir !== "desc" ? sortDir : "desc",
        page: page !== 1 ? page : 1,
      },
      replace: true,
    });
  }, [debounced, page, navigate, status, voiceId, sort, sortDir]);

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

  async function onDelete(gen: Generation) {
    if (!confirm("Delete generation?")) return;
    try {
      await apiJson(`/api/generations/${gen.id}`, { method: "DELETE" });
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete generation.");
    }
  }

  async function onRegenerate(gen: Generation) {
    try {
      const res = await apiJson<RegenerateResponse>(`/api/generations/${gen.id}/regenerate`, {
        method: "POST",
      });
      navigate({ to: res.redirect_url });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to regenerate.");
    }
  }

  async function onPlay(gen: Generation, audioUrl: string) {
    const container = waveRefs.current[gen.id];
    if (!container) return;
    setError(null);
    await toggle({
      id: gen.id,
      container,
      audioUrl,
      onState: (state) => {
        const next: PlayState = state;
        setPlayState((prev) => ({ ...prev, [gen.id]: next }));
      },
      onError: (message) => {
        setError(message);
      },
    });
  }

  async function onDownload(audioUrl: string) {
    try {
      const resolvedUrl = await resolveProtectedMediaUrl(audioUrl);
      triggerDownload(resolvedUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to download audio.");
    }
  }

  return (
    <div className="space-y-8" aria-busy={loading}>
      <h2 className="text-balance text-center text-3xl font-pixel font-medium uppercase tracking-[2px] md:text-4xl">
        History
      </h2>

      {error ? <Message variant="error">{error}</Message> : null}

      <div className="flex flex-wrap items-end gap-3">
        <SearchField
          value={query}
          onChange={setQuery}
          aria-label="Search history"
          className="group relative min-w-48 flex-1"
        >
          <Label className="mb-2 block label-style">Search</Label>
          <Input
            autoComplete="off"
            placeholder="Search history..."
            className={input({ className: "pr-9 [&::-webkit-search-cancel-button]:hidden" })}
          />
          <AriaButton className="absolute right-2 top-[38px] flex h-6 w-6 items-center justify-center text-muted-foreground hovered:text-foreground group-data-[empty]:hidden">
            ×
          </AriaButton>
        </SearchField>
        <AutocompleteSelect
          label="Status"
          items={STATUS_ITEMS}
          selectedKey={status}
          onSelectionChange={setStatus}
          searchLabel="Search statuses"
          searchPlaceholder="Search..."
        >
          {(item) => item.label}
        </AutocompleteSelect>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SortSelect
          items={SORT_OPTIONS}
          selectedKey={`${sort}:${sortDir}`}
          onSelectionChange={(key) => {
            const [s, d] = key.split(":");
            setSort(s);
            setSortDir(d as "asc" | "desc");
          }}
          aria-label="Sort history"
          placeholder="Sort by"
        />
        <AutocompleteSelect
          items={voiceItems}
          selectedKey={voiceId}
          onSelectionChange={setVoiceId}
          searchLabel="Search voices"
          searchPlaceholder="Search..."
          size="compact"
          placeholder="All Voices"
        >
          {(item) => item.label}
        </AutocompleteSelect>
      </div>

      {loading && !data ? <HistorySkeleton /> : null}

      {!loading && data && data.generations.length === 0 ? (
        <div className="flex min-h-[50dvh] items-center justify-center border border-border bg-subtle p-6 text-center text-sm text-muted-foreground shadow-elevated">
          No generations found.
        </div>
      ) : null}

      {!loading ? (
        <div className="grid gap-4">
          {data?.generations.map((g) => {
            const audioUrl = generationAudioUrl(g);
            const isReady = g.status === "completed" && Boolean(audioUrl);
            const state = playState[g.id] ?? "idle";
            const playLabel =
              state === "loading" ? "Loading..." : state === "playing" ? "Stop" : "Play";
            const playDisabled = state === "loading";

            return (
              <div key={g.id} className="border border-border bg-background p-4 shadow-elevated">
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={statusBadge({ status: g.status })}>{g.status}</span>
                      <div className="truncate text-sm font-semibold">
                        <Highlight text={g.voice_name ?? "Unknown voice"} tokens={tokens} />
                      </div>
                    </div>

                    <div className="mt-2 text-sm text-muted-foreground">
                      <Highlight
                        text={g.text.slice(0, 160) + (g.text.length > 160 ? "..." : "")}
                        tokens={tokens}
                      />
                    </div>

                    {g.error_message ? (
                      <div className="mt-2 text-sm text-status-error">
                        {g.error_message.slice(0, 160)}
                        {g.error_message.length > 160 ? "..." : ""}
                      </div>
                    ) : null}

                    <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-faint">
                      {formatCreatedAt(g.created_at) ? (
                        <span>{formatCreatedAt(g.created_at)}</span>
                      ) : null}
                      {g.duration_seconds != null ? (
                        <span>Duration: {g.duration_seconds.toFixed(1)}s</span>
                      ) : null}
                      {g.generation_time_seconds != null ? (
                        <span>Gen time: {g.generation_time_seconds.toFixed(1)}s</span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2 md:justify-self-end">
                    {isReady && audioUrl ? (
                      <>
                        <button
                          type="button"
                          className={paginationButton().base()}
                          disabled={playDisabled}
                          aria-pressed={state === "playing"}
                          aria-controls={`gen-wave-${g.id}`}
                          onClick={() => void onPlay(g, audioUrl)}
                        >
                          {playLabel}
                        </button>
                        <button
                          type="button"
                          className={button({
                            variant: "secondary",
                            size: "sm",
                          }).base()}
                          onClick={() => void onDownload(audioUrl)}
                        >
                          Download
                        </button>
                      </>
                    ) : (
                      <span className="text-xs text-faint">
                        {g.status === "processing" || g.status === "pending" ? "Generating..." : ""}
                      </span>
                    )}
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onPress={() => void onRegenerate(g)}
                    >
                      Regenerate
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onPress={() => void onDelete(g)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>

                <div className="mt-4">
                  <div
                    ref={(el) => {
                      waveRefs.current[g.id] = el;
                    }}
                    id={`gen-wave-${g.id}`}
                    className="hidden"
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {!loading && data ? (
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            className={paginationButton().base()}
            disabled={data.pagination.page <= 1}
            onClick={() => setPage((p: number) => Math.max(1, p - 1))}
          >
            Prev
          </button>
          <div className="text-xs text-faint">
            Page {data.pagination.page} of {data.pagination.pages}
          </div>
          <button
            type="button"
            className={paginationButton().base()}
            disabled={data.pagination.page >= data.pagination.pages}
            onClick={() => setPage((p: number) => p + 1)}
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}
