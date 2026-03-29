import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Message } from "../../components/atoms/Message";
import { ConfirmDialog } from "../../components/molecules/ConfirmDialog";
import { useWaveformListPlayer } from "../../hooks/useWaveformListPlayer";
import { apiJson } from "../../lib/api";
import { paginationButtonStyles } from "../../lib/styles/pagination-button";
import type { Voice } from "../../lib/types";
import { useDebouncedValue } from "../shared/hooks";
import { tokenize } from "../shared/tokenize";
import { VoiceCard } from "./components/VoiceCard";
import { VoiceFilterBar } from "./components/VoiceFilterBar";
import { VoicesSkeleton } from "./components/VoicesSkeleton";
import { voiceQueries } from "./queries";

const voicesRoute = getRouteApi("/_app/voices");

type PlayState = "idle" | "loading" | "playing" | "paused" | "stopped";

export function VoicesPage() {
  const { toggle } = useWaveformListPlayer();

  const {
    search: initialQuery,
    source: initialSourceValue,
    page: initialPage,
    sort: initialSort,
    sort_dir: initialSortDir,
    favorites: initialFavorites,
    voice_id: voiceIdParam,
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

  const voicesQuery = useQuery({
    ...voiceQueries.list({ search: debounced, source, sort, sortDir, favorites, page }),
    placeholderData: keepPreviousData,
  });

  const deleteVoice = useMutation({
    mutationKey: voiceQueries.all(),
    mutationFn: (id: string) => apiJson(`/api/voices/${id}`, { method: "DELETE" }),
  });

  const toggleFavorite = useMutation({
    mutationKey: voiceQueries.all(),
    mutationFn: (id: string) => apiJson(`/api/voices/${id}/favorite`, { method: "PATCH" }),
  });

  const renameVoice = useMutation({
    mutationKey: voiceQueries.all(),
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      apiJson(`/api/voices/${id}/name`, { method: "PATCH", json: { name } }),
  });

  const [localError, setLocalError] = useState<string | null>(null);
  const displayError =
    localError ??
    voicesQuery.error?.message ??
    deleteVoice.error?.message ??
    toggleFavorite.error?.message ??
    renameVoice.error?.message ??
    null;

  const [highlightedVoiceId, setHighlightedVoiceId] = useState<string | null>(null);
  const voiceCardRefs = useRef<Map<string, HTMLElement>>(new Map());

  const [deleteTarget, setDeleteTarget] = useState<Voice | null>(null);
  const [playState, setPlayState] = useState<Record<string, PlayState>>({});
  const waveRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => setPage(1), [debounced, source, sort, sortDir, favorites]);

  // Highlight + scroll to voice when voice_id param is present
  useEffect(() => {
    if (!voiceIdParam || voicesQuery.isPending || !voicesQuery.data) return;

    const match = voicesQuery.data.voices.find((v) => v.id === voiceIdParam);
    if (match) {
      setHighlightedVoiceId(voiceIdParam);
      requestAnimationFrame(() => {
        const el = voiceCardRefs.current.get(voiceIdParam);
        el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    } else {
      setQuery("");
      setSource("all");
      setFavorites("all");
      setPage(1);
    }
  }, [voiceIdParam, voicesQuery.isPending, voicesQuery.data]);

  // Auto-clear highlight after 2 seconds for fade-out
  useEffect(() => {
    if (!highlightedVoiceId) return;
    const timer = setTimeout(() => setHighlightedVoiceId(null), 2000);
    return () => clearTimeout(timer);
  }, [highlightedVoiceId]);

  useEffect(() => {
    void navigate({
      search: {
        search: debounced.trim() || "",
        source: source !== "all" ? source : "all",
        sort: sort !== "created_at" ? sort : "created_at",
        sort_dir: sortDir !== "desc" ? sortDir : "desc",
        favorites: favorites === "true" ? "true" : "all",
        page: page !== 1 ? page : 1,
        voice_id: voiceIdParam,
      },
      replace: true,
    });
  }, [debounced, page, navigate, source, sort, sortDir, favorites, voiceIdParam]);

  const onPreview = useCallback(
    async (voice: Voice) => {
      const container = waveRefs.current[voice.id];
      if (!container) return;
      setLocalError(null);
      await toggle({
        id: voice.id,
        container,
        audioUrl: `/api/voices/${voice.id}/preview`,
        onState: (state) => {
          const next: PlayState = state;
          setPlayState((prev) => ({ ...prev, [voice.id]: next }));
        },
        onError: (message) => {
          setLocalError(message);
        },
      });
    },
    [toggle],
  );

  const showLoading = voicesQuery.isFetching && !voicesQuery.isPending;

  return (
    <div className="space-y-8" aria-busy={voicesQuery.isPending}>
      <h2 className="text-balance text-center text-3xl font-pixel font-medium uppercase tracking-[2px] md:text-4xl">
        Voices
      </h2>

      {displayError ? <Message variant="error">{displayError}</Message> : null}

      <VoiceFilterBar
        query={query}
        onQueryChange={setQuery}
        source={source}
        onSourceChange={setSource}
        sort={sort}
        sortDir={sortDir}
        onSortChange={(s, d) => {
          setSort(s);
          setSortDir(d);
        }}
        favorites={favorites}
        onFavoritesChange={setFavorites}
      />

      {voicesQuery.isPending ? <VoicesSkeleton /> : null}

      {!voicesQuery.isPending && voicesQuery.data && voicesQuery.data.voices.length === 0 ? (
        <div className="flex min-h-[50dvh] items-center justify-center border border-border bg-subtle p-6 text-center text-sm text-muted-foreground shadow-elevated">
          No voices found.
        </div>
      ) : null}

      {voicesQuery.data && (voicesQuery.isPending || voicesQuery.data.voices.length > 0) ? (
        <div
          className={`grid min-h-[50dvh] content-start gap-4${showLoading ? " pointer-events-none opacity-60" : ""}`}
        >
          {voicesQuery.data?.voices.map((v) => (
            <VoiceCard
              key={v.id}
              voice={v}
              tokens={tokens}
              playState={playState[v.id] ?? "idle"}
              busyDelete={deleteVoice.isPending && deleteVoice.variables === v.id}
              busyFavorite={toggleFavorite.isPending && toggleFavorite.variables === v.id}
              busyRename={renameVoice.isPending && renameVoice.variables?.id === v.id}
              highlighted={v.id === highlightedVoiceId}
              cardRef={(el) => {
                if (el) voiceCardRefs.current.set(v.id, el);
                else voiceCardRefs.current.delete(v.id);
              }}
              waveRef={(el) => {
                waveRefs.current[v.id] = el;
              }}
              onPreview={() => void onPreview(v)}
              onDelete={() => setDeleteTarget(v)}
              onToggleFavorite={() => toggleFavorite.mutate(v.id)}
              onRename={(name) => renameVoice.mutate({ id: v.id, name })}
            />
          ))}
        </div>
      ) : null}

      {!voicesQuery.isPending && voicesQuery.data && voicesQuery.data.pagination.pages > 1 ? (
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            className={paginationButtonStyles().base()}
            disabled={voicesQuery.data.pagination.page <= 1}
            onClick={() => setPage((p: number) => Math.max(1, p - 1))}
          >
            Prev
          </button>
          <div className="text-xs text-faint">
            Page {voicesQuery.data.pagination.page} of {voicesQuery.data.pagination.pages}
          </div>
          <button
            type="button"
            className={paginationButtonStyles().base()}
            disabled={voicesQuery.data.pagination.page >= voicesQuery.data.pagination.pages}
            onClick={() => setPage((p: number) => p + 1)}
          >
            Next
          </button>
        </div>
      ) : null}

      <ConfirmDialog
        title="Delete voice"
        message={deleteTarget ? `Delete voice "${deleteTarget.name}"` : ""}
        confirmLabel="Delete"
        isOpen={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        onConfirm={() => {
          if (deleteTarget) deleteVoice.mutate(deleteTarget.id);
        }}
      />
    </div>
  );
}
