import { Trash2 } from "lucide-react";
import { Button } from "../../../components/atoms/Button";
import { AppLink } from "../../../components/atoms/Link";
import { formatCreatedAt } from "../../../lib/format";
import { statusBadgeStyles } from "../../../lib/styles/status-badge";
import type { Generation } from "../../../lib/types";
import { Highlight } from "../../shared/Highlight";

type PlayState = "idle" | "loading" | "playing" | "paused" | "stopped";

function generationAudioUrl(gen: Generation) {
  if (!gen.audio_path) return null;
  return gen.audio_path;
}

export interface HistoryCardProps {
  generation: Generation;
  tokens: string[];
  playState: PlayState;
  waveRef: (el: HTMLDivElement | null) => void;
  onPlay: () => void;
  onDownload: () => void;
  onRegenerate: () => void;
  onDelete: () => void;
}

export function HistoryCard({
  generation: g,
  tokens,
  playState: state,
  waveRef,
  onPlay,
  onDownload,
  onRegenerate,
  onDelete,
}: HistoryCardProps) {
  const audioUrl = generationAudioUrl(g);
  const isReady = g.status === "completed" && Boolean(audioUrl);
  const playLabel = state === "loading" ? "Loading..." : state === "playing" ? "Stop" : "Play";
  const playDisabled = state === "loading";

  return (
    <div className="border border-border bg-background p-4 shadow-elevated">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={statusBadgeStyles({ status: g.status })}>{g.status}</span>
            {g.voice_name != null ? (
              <AppLink
                to="/voices"
                search={{ voice_id: g.voice_id }}
                aria-label={`View voice ${g.voice_name}`}
                className="truncate text-sm font-semibold hover:underline"
              >
                {g.voice_name}
              </AppLink>
            ) : (
              <div className="truncate text-sm font-semibold">Unknown voice</div>
            )}
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
            {formatCreatedAt(g.created_at) ? <span>{formatCreatedAt(g.created_at)}</span> : null}
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
              <Button
                variant="secondary"
                size="sm"
                isDisabled={playDisabled}
                aria-pressed={state === "playing"}
                aria-controls={`gen-wave-${g.id}`}
                onPress={onPlay}
              >
                {playLabel}
              </Button>
              <Button variant="secondary" size="sm" onPress={onDownload}>
                Download
              </Button>
            </>
          ) : (
            <span className="text-xs text-faint">
              {g.status === "processing" || g.status === "pending" ? "Generating..." : ""}
            </span>
          )}
          <Button type="button" variant="secondary" size="sm" onPress={onRegenerate}>
            Regenerate
          </Button>
          <Button
            variant="primary"
            size="sm"
            square
            aria-label="Delete generation"
            onPress={onDelete}
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </div>

      <div className="mt-4">
        <div ref={waveRef} id={`gen-wave-${g.id}`} className="hidden" />
      </div>
    </div>
  );
}
