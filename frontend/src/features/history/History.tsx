import { getRouteApi } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../../components/atoms/Button";
import { Message } from "../../components/atoms/Message";
import type { AutocompleteSelectItem } from "../../components/molecules/AutocompleteSelect";
import { ConfirmDialog } from "../../components/molecules/ConfirmDialog";
import { useWaveformListPlayer } from "../../hooks/useWaveformListPlayer";
import type { Generation } from "../../lib/types";
import { useDebouncedValue } from "../shared/hooks";
import { useVoiceOptions } from "../shared/hooks/useVoiceOptions";
import { tokenize } from "../shared/tokenize";
import { HistoryCard } from "./components/HistoryCard";
import { HistoryFilterBar } from "./components/HistoryFilterBar";
import { HistorySkeleton } from "./components/HistorySkeleton";
import { useGenerationActions } from "./hooks/useGenerationActions";
import { useGenerationList } from "./hooks/useGenerationList";

const historyRoute = getRouteApi("/_app/history");

type PlayState = "idle" | "loading" | "playing" | "paused" | "stopped";

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
  const [page, setPage] = useState(initialPage);

  // Voice options for the filter dropdown
  const { voices } = useVoiceOptions();
  const voiceItems = useMemo<AutocompleteSelectItem[]>(
    () => [
      { id: "all", label: "All Voices" },
      ...voices.map((v) => ({ id: v.id, label: v.label })),
    ],
    [voices],
  );

  const genList = useGenerationList({
    search: debounced,
    status,
    voiceId,
    sort,
    sortDir,
    page,
  });

  const handleError = useCallback((msg: string) => genList.setError(msg), [genList.setError]);

  const actions = useGenerationActions(genList.reload, handleError, navigate);

  const [deleteTarget, setDeleteTarget] = useState<Generation | null>(null);
  const [playState, setPlayState] = useState<Record<string, PlayState>>({});
  const waveRefs = useRef<Record<string, HTMLDivElement | null>>({});

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

  async function onPlay(gen: Generation, audioUrl: string) {
    const container = waveRefs.current[gen.id];
    if (!container) return;
    genList.setError(null);
    await toggle({
      id: gen.id,
      container,
      audioUrl,
      onState: (state) => {
        const next: PlayState = state;
        setPlayState((prev) => ({ ...prev, [gen.id]: next }));
      },
      onError: (message) => {
        genList.setError(message);
      },
    });
  }

  return (
    <div className="space-y-8" aria-busy={genList.loading}>
      <h2 className="text-balance text-center text-3xl font-pixel font-medium uppercase tracking-[2px] md:text-4xl">
        History
      </h2>

      {genList.error ? <Message variant="error">{genList.error}</Message> : null}

      <HistoryFilterBar
        query={query}
        onQueryChange={setQuery}
        status={status}
        onStatusChange={setStatus}
        voiceId={voiceId}
        voiceItems={voiceItems}
        onVoiceIdChange={setVoiceId}
        sort={sort}
        sortDir={sortDir}
        onSortChange={(s, d) => {
          setSort(s);
          setSortDir(d);
        }}
      />

      {genList.loading && !genList.data ? <HistorySkeleton /> : null}

      {!genList.loading && genList.data && genList.data.generations.length === 0 ? (
        <div className="flex min-h-[50dvh] items-center justify-center border border-border bg-subtle p-6 text-center text-sm text-muted-foreground shadow-elevated">
          No generations found.
        </div>
      ) : null}

      {genList.data && (genList.loading || genList.data.generations.length > 0) ? (
        <div
          className={`grid min-h-[50dvh] content-start gap-4${genList.showLoading ? " pointer-events-none opacity-60" : ""}`}
        >
          {genList.data?.generations.map((g) => (
            <HistoryCard
              key={g.id}
              generation={g}
              tokens={tokens}
              playState={playState[g.id] ?? "idle"}
              waveRef={(el) => {
                waveRefs.current[g.id] = el;
              }}
              onPlay={() => {
                const audioUrl = g.audio_path;
                if (audioUrl) void onPlay(g, audioUrl);
              }}
              onDownload={() => {
                if (g.audio_path) void actions.download(g.audio_path);
              }}
              onRegenerate={() => void actions.regenerate(g)}
              onDelete={() => setDeleteTarget(g)}
            />
          ))}
        </div>
      ) : null}

      {!genList.loading && genList.data && genList.data.pagination.pages > 1 ? (
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="secondary"
            size="sm"
            isDisabled={genList.data.pagination.page <= 1}
            onPress={() => setPage((p: number) => Math.max(1, p - 1))}
          >
            Prev
          </Button>
          <div className="text-xs text-faint">
            Page {genList.data.pagination.page} of {genList.data.pagination.pages}
          </div>
          <Button
            variant="secondary"
            size="sm"
            isDisabled={genList.data.pagination.page >= genList.data.pagination.pages}
            onPress={() => setPage((p: number) => p + 1)}
          >
            Next
          </Button>
        </div>
      ) : null}

      <ConfirmDialog
        title="Delete generation"
        message="Delete this generation? This cannot be undone."
        confirmLabel="Delete"
        isOpen={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        onConfirm={() => {
          if (deleteTarget) void actions.deleteGeneration(deleteTarget);
        }}
      />
    </div>
  );
}
