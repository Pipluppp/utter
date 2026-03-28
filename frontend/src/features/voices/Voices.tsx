import { getRouteApi } from "@tanstack/react-router";
import { Star, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Button as AriaButton,
  Input,
  Label,
  SearchField,
  ToggleButton,
} from "react-aria-components";
import { Button } from "../../components/atoms/Button";
import { buttonStyle } from "../../components/atoms/Button.styles";
import { Link } from "../../components/atoms/Link";
import { Message } from "../../components/atoms/Message";
import { Skeleton } from "../../components/atoms/Skeleton";
import { ConfirmDialog } from "../../components/molecules/ConfirmDialog";
import { InlineEditable } from "../../components/molecules/InlineEditable";
import { SegmentedControl } from "../../components/molecules/SegmentedControl";
import { SortSelect } from "../../components/molecules/SortSelect";
import { useWaveformListPlayer } from "../../hooks/useWaveformListPlayer";
import { apiJson } from "../../lib/api";
import { formatCreatedAt } from "../../lib/format";
import { inputStyles } from "../../lib/styles/input";
import { paginationButtonStyles } from "../../lib/styles/pagination-button";
import type { Voice, VoicesResponse } from "../../lib/types";
import { useDebouncedValue } from "../shared/hooks";

const voicesRoute = getRouteApi("/_app/voices");

function tokenize(query: string) {
  return query.trim().split(/\s+/).filter(Boolean);
}

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

function snippet(value: string | null, maxLen: number, fallback: string) {
  if (!value) return fallback;
  return value.length > maxLen ? `${value.slice(0, maxLen)}...` : value;
}

type PlayState = "idle" | "loading" | "playing" | "paused" | "stopped";

const PER_PAGE = 10;
const SOURCE_ITEMS = [
  { id: "all", label: "All" },
  { id: "uploaded", label: "Clone" },
  { id: "designed", label: "Designed" },
];
const SORT_OPTIONS = [
  { id: "created_at:desc", label: "↓ Date" },
  { id: "created_at:asc", label: "↑ Date" },
  { id: "name:desc", label: "↓ Name" },
  { id: "name:asc", label: "↑ Name" },
  { id: "generation_count:desc", label: "↓ Usage" },
  { id: "generation_count:asc", label: "↑ Usage" },
];
const VOICE_SKELETON_VARIANTS = [
  { id: "designed-a", showPrompt: true },
  { id: "clone-a", showPrompt: false },
  { id: "designed-b", showPrompt: true },
  { id: "clone-b", showPrompt: false },
] as const;

function VoiceCardSkeleton({ showPrompt = true }: { showPrompt?: boolean }) {
  return (
    <div className="bg-background p-4 shadow-elevated">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-18" />
            <Skeleton className="h-5 max-w-56 flex-1" />
          </div>

          <div className="mt-3 space-y-3">
            <div>
              <Skeleton className="h-3 w-44" />
              <div className="mt-2 space-y-2">
                <Skeleton className="h-3 w-full max-w-3xl" />
                <Skeleton className="h-3 w-4/5 max-w-2xl" />
              </div>
            </div>

            {showPrompt ? (
              <div>
                <Skeleton className="h-3 w-28" />
                <div className="mt-2 space-y-2">
                  <Skeleton className="h-3 w-full max-w-2xl" />
                  <Skeleton className="h-3 w-3/4 max-w-xl" />
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 md:justify-self-end">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-18" />
          <Skeleton className="h-8 w-18" />
        </div>
      </div>

      <div className="mt-4">
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  );
}

function VoicesSkeleton() {
  return (
    <div className="grid gap-4" aria-hidden="true">
      {VOICE_SKELETON_VARIANTS.map(({ id, showPrompt }) => (
        <VoiceCardSkeleton key={id} showPrompt={showPrompt} />
      ))}
    </div>
  );
}

export function VoicesPage() {
  const { toggle } = useWaveformListPlayer();

  const {
    search: initialQuery,
    source: initialSourceValue,
    page: initialPage,
    sort: initialSort,
    sort_dir: initialSortDir,
    favorites: initialFavorites,
  } = voicesRoute.useSearch();
  const navigate = voicesRoute.useNavigate();

  const [query, setQuery] = useState(initialQuery);
  const debounced = useDebouncedValue(query, 250);
  const tokens = useMemo(() => tokenize(debounced), [debounced]);

  const [source, setSource] = useState<"all" | "uploaded" | "designed">(initialSourceValue);
  const [sort, setSort] = useState(initialSort);
  const [sortDir, setSortDir] = useState<"asc" | "desc">(initialSortDir);
  const [favorites, setFavorites] = useState(initialFavorites);
  const [page, setPage] = useState(initialPage);
  const [data, setData] = useState<VoicesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [busyDelete, setBusyDelete] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Voice | null>(null);
  const [busyFavorite, setBusyFavorite] = useState<string | null>(null);
  const [busyRename, setBusyRename] = useState<string | null>(null);
  const [playState, setPlayState] = useState<Record<string, PlayState>>({});
  const waveRefs = useRef<Record<string, HTMLDivElement | null>>({});
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
      if (debounced.trim()) qs.set("search", debounced.trim());
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
  }, [debounced, page, source, sort, sortDir, favorites]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return () => loadAbortRef.current?.abort();
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset paging when search/source/sort/filter changes
  useEffect(() => setPage(1), [debounced, source, sort, sortDir, favorites]);

  useEffect(() => {
    void navigate({
      search: {
        search: debounced.trim() || "",
        source: source !== "all" ? source : "all",
        sort: sort !== "created_at" ? sort : "created_at",
        sort_dir: sortDir !== "desc" ? sortDir : "desc",
        favorites: favorites === "true" ? "true" : "all",
        page: page !== 1 ? page : 1,
      },
      replace: true,
    });
  }, [debounced, page, navigate, source, sort, sortDir, favorites]);

  async function onDelete(voice: Voice) {
    setBusyDelete(voice.id);
    try {
      await apiJson(`/api/voices/${voice.id}`, { method: "DELETE" });
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete voice.");
    } finally {
      setBusyDelete(null);
    }
  }

  async function onToggleFavorite(voice: Voice) {
    setBusyFavorite(voice.id);
    setError(null);
    try {
      await apiJson(`/api/voices/${voice.id}/favorite`, { method: "PATCH" });
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update favorite.");
    } finally {
      setBusyFavorite(null);
    }
  }

  async function onRename(voice: Voice, name: string) {
    setBusyRename(voice.id);
    setError(null);
    try {
      await apiJson(`/api/voices/${voice.id}/name`, {
        method: "PATCH",
        json: { name },
      });
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to rename voice.");
    } finally {
      setBusyRename(null);
    }
  }

  async function onPreview(voice: Voice) {
    const container = waveRefs.current[voice.id];
    if (!container) return;
    setError(null);
    await toggle({
      id: voice.id,
      container,
      audioUrl: `/api/voices/${voice.id}/preview`,
      onState: (state) => {
        const next: PlayState = state;
        setPlayState((prev) => ({ ...prev, [voice.id]: next }));
      },
      onError: (message) => {
        setError(message);
      },
    });
  }

  return (
    <div className="space-y-8" aria-busy={loading}>
      <h2 className="text-balance text-center text-3xl font-pixel font-medium uppercase tracking-[2px] md:text-4xl">
        Voices
      </h2>

      {error ? <Message variant="error">{error}</Message> : null}

      <div className="flex flex-wrap items-end gap-3">
        <SearchField
          value={query}
          onChange={setQuery}
          aria-label="Search voices"
          className="group relative min-w-48 flex-1"
        >
          <Label className="mb-2 block label-style">Search</Label>
          <Input
            autoComplete="off"
            placeholder="Search voices..."
            className={inputStyles({ className: "pr-9 [&::-webkit-search-cancel-button]:hidden" })}
          />
          <AriaButton className="absolute right-2 top-[38px] flex h-6 w-6 items-center justify-center text-muted-foreground data-[hovered]:text-foreground data-[pressed]:text-foreground group-data-[empty]:hidden">
            ×
          </AriaButton>
        </SearchField>
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
          aria-label="Sort voices"
          placeholder="Sort by"
        />
        <SegmentedControl
          items={SOURCE_ITEMS}
          selectedKey={source}
          onSelectionChange={(key) => setSource(key as "all" | "uploaded" | "designed")}
          aria-label="Source filter"
        />
        <div className="ml-auto">
          <ToggleButton
            isSelected={favorites === "true"}
            onChange={(isSelected) => setFavorites(isSelected ? "true" : "all")}
            aria-label={favorites === "true" ? "Show all voices" : "Show favorites only"}
            className={({ isSelected }) =>
              `flex min-h-[30px] items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold tracking-wide transition-colors press-scale-sm ${
                isSelected
                  ? "border-foreground bg-foreground text-background data-[hovered]:bg-foreground/80 data-[pressed]:bg-foreground/80"
                  : "border-border text-muted-foreground data-[hovered]:bg-muted data-[hovered]:text-foreground data-[pressed]:bg-muted data-[pressed]:text-foreground"
              }`
            }
          >
            {({ isSelected }) => (
              <>
                <Star size={12} className={isSelected ? "fill-current" : ""} />
                <span className="hidden sm:inline">Favorites</span>
              </>
            )}
          </ToggleButton>
        </div>
      </div>

      {loading && !data ? <VoicesSkeleton /> : null}

      {!loading && data && data.voices.length === 0 ? (
        <div className="flex min-h-[50dvh] items-center justify-center border border-border bg-subtle p-6 text-center text-sm text-muted-foreground shadow-elevated">
          No voices found.
        </div>
      ) : null}

      {!loading ? (
        <div className="grid min-h-[50dvh] content-start gap-4">
          {data?.voices.map((v) => {
            const state = playState[v.id] ?? "idle";
            const label =
              state === "idle"
                ? "Preview"
                : state === "loading"
                  ? "Loading..."
                  : state === "playing"
                    ? "Stop"
                    : "Play";
            const disabled = state === "loading";

            return (
              <div key={v.id} className="border border-border bg-background p-4 shadow-elevated">
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <ToggleButton
                        isSelected={v.is_favorite}
                        onChange={() => void onToggleFavorite(v)}
                        isDisabled={busyFavorite === v.id}
                        aria-label={v.is_favorite ? "Remove from favorites" : "Add to favorites"}
                        className={({ isSelected }) =>
                          `shrink-0 press-scale text-muted-foreground data-[hovered]:text-foreground data-[pressed]:text-foreground data-[disabled]:opacity-50${isSelected ? " text-foreground" : ""}`
                        }
                      >
                        {({ isSelected }) => (
                          <Star
                            size={16}
                            className={isSelected ? "fill-current text-foreground" : ""}
                          />
                        )}
                      </ToggleButton>
                      <span className="border border-border bg-subtle px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {v.source === "designed" ? "DESIGNED" : "CLONE"}
                      </span>
                      <InlineEditable
                        value={v.name}
                        onSave={(name) => onRename(v, name)}
                        isDisabled={busyRename === v.id}
                        aria-label={`Rename voice ${v.name}`}
                        className="text-sm font-semibold"
                      >
                        {() => <Highlight text={v.name} tokens={tokens} />}
                      </InlineEditable>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-faint">
                      {formatCreatedAt(v.created_at) ? (
                        <span>{formatCreatedAt(v.created_at)}</span>
                      ) : null}
                      <span>
                        {v.generation_count} generation{v.generation_count !== 1 ? "s" : ""}
                      </span>
                    </div>

                    <div className="mt-3 space-y-3">
                      <div>
                        <div className="text-[11px] uppercase tracking-wide text-faint">
                          {v.source === "designed"
                            ? "Preview text (saved transcript)"
                            : "Reference transcript"}
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          <Highlight
                            text={snippet(v.reference_transcript, 120, "No transcript")}
                            tokens={tokens}
                          />
                        </div>
                      </div>

                      {v.source === "designed" ? (
                        <div>
                          <div className="text-[11px] uppercase tracking-wide text-faint">
                            Design prompt
                          </div>
                          <div className="mt-1 text-sm text-muted-foreground">
                            <Highlight
                              text={snippet(v.description, 120, "No prompt")}
                              tokens={tokens}
                            />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2 md:justify-self-end">
                    <Link
                      to="/generate"
                      search={{ voice: v.id }}
                      className={buttonStyle({
                        variant: "secondary",
                        size: "sm",
                      })}
                    >
                      Generate
                    </Link>
                    <Button
                      variant="secondary"
                      size="sm"
                      onPress={() => void onPreview(v)}
                      isDisabled={disabled}
                      aria-pressed={state === "playing"}
                      aria-controls={`voice-wave-${v.id}`}
                    >
                      {label}
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      square
                      onPress={() => setDeleteTarget(v)}
                      isDisabled={busyDelete === v.id}
                      aria-label="Delete voice"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>

                <div className="mt-4">
                  <div
                    ref={(el) => {
                      waveRefs.current[v.id] = el;
                    }}
                    id={`voice-wave-${v.id}`}
                    className="hidden"
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {!loading && data && data.pagination.pages > 1 ? (
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            className={paginationButtonStyles().base()}
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
            className={paginationButtonStyles().base()}
            disabled={data.pagination.page >= data.pagination.pages}
            onClick={() => setPage((p: number) => p + 1)}
          >
            Next
          </button>
        </div>
      ) : null}

      <ConfirmDialog
        title="Delete voice"
        message={deleteTarget ? `Delete voice "${deleteTarget.name}"?` : ""}
        confirmLabel="Delete"
        isOpen={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        onConfirm={() => {
          if (deleteTarget) void onDelete(deleteTarget);
        }}
      />
    </div>
  );
}
