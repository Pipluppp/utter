import { Star, Trash2 } from "lucide-react";
import { ToggleButton } from "react-aria-components";
import { Button } from "../../../components/atoms/Button";
import { buttonStyle } from "../../../components/atoms/Button.styles";
import { AppLink, Link } from "../../../components/atoms/Link";
import { InlineEditable } from "../../../components/molecules/InlineEditable";
import { formatCreatedAt } from "../../../lib/format";
import type { Voice } from "../../../lib/types";
import { Highlight } from "../../shared/Highlight";

type PlayState = "idle" | "loading" | "playing" | "paused" | "stopped";

function snippet(value: string | null, maxLen: number, fallback: string) {
  if (!value) return fallback;
  return value.length > maxLen ? `${value.slice(0, maxLen)}...` : value;
}

export interface VoiceCardProps {
  voice: Voice;
  tokens: string[];
  playState: PlayState;
  busyDelete: boolean;
  busyFavorite: boolean;
  busyRename: boolean;
  highlighted: boolean;
  cardRef: (el: HTMLElement | null) => void;
  waveRef: (el: HTMLDivElement | null) => void;
  onPreview: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
  onRename: (name: string) => void;
}

export function VoiceCard({
  voice: v,
  tokens,
  playState: state,
  busyDelete,
  busyFavorite,
  busyRename,
  highlighted,
  cardRef,
  waveRef,
  onPreview,
  onDelete,
  onToggleFavorite,
  onRename,
}: VoiceCardProps) {
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
    <div
      ref={cardRef}
      className={`border border-border bg-background p-4 shadow-elevated transition-shadow duration-500${highlighted ? " ring-2 ring-ring" : ""}`}
    >
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ToggleButton
              isSelected={v.is_favorite}
              onChange={() => void onToggleFavorite()}
              isDisabled={busyFavorite}
              aria-label={v.is_favorite ? "Remove from favorites" : "Add to favorites"}
              className={({ isSelected }) =>
                `shrink-0 press-scale text-muted-foreground data-[hovered]:text-foreground data-[pressed]:text-foreground data-[disabled]:opacity-50${isSelected ? " text-foreground" : ""}`
              }
            >
              {({ isSelected }) => (
                <Star size={16} className={isSelected ? "fill-current text-foreground" : ""} />
              )}
            </ToggleButton>
            <span className="border border-border bg-subtle px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              {v.source === "designed" ? "DESIGNED" : "CLONE"}
            </span>
            <InlineEditable
              value={v.name}
              onSave={(name) => onRename(name)}
              isDisabled={busyRename}
              aria-label={`Rename voice ${v.name}`}
              className="text-sm font-semibold"
            >
              {() => <Highlight text={v.name} tokens={tokens} />}
            </InlineEditable>
          </div>

          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-faint/70">
            {formatCreatedAt(v.created_at) ? <span>{formatCreatedAt(v.created_at)}</span> : null}
            {v.generation_count > 0 ? (
              <AppLink
                to="/history"
                search={{ voice_id: v.id }}
                aria-label={`View generations for ${v.name}`}
                className="underline decoration-faint/40 underline-offset-2 hover:text-foreground hover:decoration-foreground/40"
              >
                {v.generation_count} generation{v.generation_count !== 1 ? "s" : ""}
              </AppLink>
            ) : (
              <span>0 generations</span>
            )}
          </div>

          <div className="mt-3 space-y-3">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-faint/60">
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
                <div className="text-[11px] uppercase tracking-wide text-faint/60">
                  Design prompt
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  <Highlight text={snippet(v.description, 120, "No prompt")} tokens={tokens} />
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
            onPress={() => void onPreview()}
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
            onPress={() => onDelete()}
            isDisabled={busyDelete}
            aria-label="Delete voice"
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </div>

      <div className="mt-4">
        <div ref={waveRef} id={`voice-wave-${v.id}`} className="hidden" />
      </div>
    </div>
  );
}
