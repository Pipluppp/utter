import { getRouteApi } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Message } from "../../components/atoms/Message";
import { ConfirmDialog } from "../../components/molecules/ConfirmDialog";
import { useWaveformListPlayer } from "../../hooks/useWaveformListPlayer";
import { paginationButtonStyles } from "../../lib/styles/pagination-button";
import type { Voice } from "../../lib/types";
import { useDebouncedValue } from "../shared/hooks";
import { tokenize } from "../shared/tokenize";
import { VoiceCard } from "./components/VoiceCard";
import { VoiceFilterBar } from "./components/VoiceFilterBar";
import { VoicesSkeleton } from "./components/VoicesSkeleton";
import { useVoiceList } from "./hooks/useVoiceList";
import { useVoiceMutations } from "./hooks/useVoiceMutations";

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

  const voiceList = useVoiceList({
    search: debounced,
    source,
    sort,
    sortDir,
    favorites,
    page,
  });

  const handleError = useCallback((msg: string) => voiceList.setError(msg), [voiceList.setError]);

  const mutations = useVoiceMutations(voiceList.reload, handleError);

  const [highlightedVoiceId, setHighlightedVoiceId] = useState<string | null>(null);
  const voiceCardRefs = useRef<Map<string, HTMLElement>>(new Map());

  const [deleteTarget, setDeleteTarget] = useState<Voice | null>(null);
  const [playState, setPlayState] = useState<Record<string, PlayState>>({});
  const waveRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => setPage(1), [debounced, source, sort, sortDir, favorites]);

  // Highlight + scroll to voice when voice_id param is present
  useEffect(() => {
    if (!voiceIdParam || voiceList.loading || !voiceList.data) return;

    const match = voiceList.data.voices.find((v) => v.id === voiceIdParam);
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
  }, [voiceIdParam, voiceList.loading, voiceList.data]);

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

  async function onPreview(voice: Voice) {
    const container = waveRefs.current[voice.id];
    if (!container) return;
    voiceList.setError(null);
    await toggle({
      id: voice.id,
      container,
      audioUrl: `/api/voices/${voice.id}/preview`,
      onState: (state) => {
        const next: PlayState = state;
        setPlayState((prev) => ({ ...prev, [voice.id]: next }));
      },
      onError: (message) => {
        voiceList.setError(message);
      },
    });
  }

  return (
    <div className="space-y-8" aria-busy={voiceList.loading}>
      <h2 className="text-balance text-center text-3xl font-pixel font-medium uppercase tracking-[2px] md:text-4xl">
        Voices
      </h2>

      {voiceList.error ? <Message variant="error">{voiceList.error}</Message> : null}

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

      {voiceList.loading && !voiceList.data ? <VoicesSkeleton /> : null}

      {!voiceList.loading && voiceList.data && voiceList.data.voices.length === 0 ? (
        <div className="flex min-h-[50dvh] items-center justify-center border border-border bg-subtle p-6 text-center text-sm text-muted-foreground shadow-elevated">
          No voices found.
        </div>
      ) : null}

      {voiceList.data && (voiceList.loading || voiceList.data.voices.length > 0) ? (
        <div
          className={`grid min-h-[50dvh] content-start gap-4${voiceList.showLoading ? " pointer-events-none opacity-60" : ""}`}
        >
          {voiceList.data?.voices.map((v) => (
            <VoiceCard
              key={v.id}
              voice={v}
              tokens={tokens}
              playState={playState[v.id] ?? "idle"}
              busyDelete={mutations.busyDelete === v.id}
              busyFavorite={mutations.busyFavorite === v.id}
              busyRename={mutations.busyRename === v.id}
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
              onToggleFavorite={() => void mutations.toggleFavorite(v)}
              onRename={(name) => void mutations.renameVoice(v, name)}
            />
          ))}
        </div>
      ) : null}

      {!voiceList.loading && voiceList.data && voiceList.data.pagination.pages > 1 ? (
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            className={paginationButtonStyles().base()}
            disabled={voiceList.data.pagination.page <= 1}
            onClick={() => setPage((p: number) => Math.max(1, p - 1))}
          >
            Prev
          </button>
          <div className="text-xs text-faint">
            Page {voiceList.data.pagination.page} of {voiceList.data.pagination.pages}
          </div>
          <button
            type="button"
            className={paginationButtonStyles().base()}
            disabled={voiceList.data.pagination.page >= voiceList.data.pagination.pages}
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
          if (deleteTarget) void mutations.deleteVoice(deleteTarget);
        }}
      />
    </div>
  );
}
