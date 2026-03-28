import { useHover } from "@react-aria/interactions";
import { useMemo, useState } from "react";
import { Link, ToggleButton, ToggleButtonGroup } from "react-aria-components";
import { buttonStyle } from "../../components/atoms/Button.styles";
import { WaveformPlayer } from "../../components/organisms/WaveformPlayer";
import type { UtterDemo } from "../../content/utterDemo";
import { cn } from "../../lib/cn";
import { toggleButtonStyles } from "../../lib/styles/toggle-button";

export function DemoClipCard({
  demo,
  className,
  priority,
}: {
  demo: UtterDemo;
  className?: string;
  priority?: boolean;
}) {
  const [mode, setMode] = useState<"original" | "clone">("original");
  const canClone = Boolean(demo.outputAudioUrl);
  const { hoverProps, isHovered } = useHover({});

  const activeAudioUrl = useMemo(() => {
    if (mode === "clone" && demo.outputAudioUrl) return demo.outputAudioUrl;
    return demo.audioUrl;
  }, [demo.audioUrl, demo.outputAudioUrl, mode]);

  return (
    <article
      {...hoverProps}
      data-hovered={isHovered || undefined}
      className={cn(
        "mx-auto w-full max-w-[560px]",
        "border border-border bg-background shadow-elevated",
        "transition-[background-color,border-color,box-shadow] duration-300 ease-out motion-reduce:transition-none",
        isHovered &&
          "bg-subtle border-border-strong shadow-[0_10px_28px_rgba(0,0,0,0.08)] dark:shadow-[0_12px_36px_rgba(0,0,0,0.50)]",
        className,
      )}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold uppercase tracking-wide">
              {demo.title}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">{demo.vibe}</div>
          </div>
          <div className="shrink-0 text-xs uppercase tracking-wide text-faint">
            {demo.languageLabel}
          </div>
        </div>

        {demo.imageUrl ? (
          <div className="mt-4 overflow-hidden border border-border bg-muted">
            <img
              src={demo.imageUrl}
              alt=""
              width={560}
              height={224}
              loading={priority ? undefined : "lazy"}
              fetchPriority={priority ? "high" : undefined}
              decoding="async"
              className="h-56 w-full object-cover grayscale"
            />
          </div>
        ) : (
          <div className="mt-4 border border-border bg-muted p-6 text-xs text-faint">
            No still available for this demo.
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <ToggleButtonGroup
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={new Set([mode])}
            onSelectionChange={(keys) => {
              const next = [...keys][0] as "original" | "clone";
              if (next) setMode(next);
            }}
            className="inline-flex overflow-hidden border border-border bg-background"
          >
            <ToggleButton id="original" className={toggleButtonStyles()}>
              Original
            </ToggleButton>
            <ToggleButton
              id="clone"
              isDisabled={!canClone}
              className={toggleButtonStyles({
                disabled: true,
                className: "border-l border-border",
              })}
            >
              Clone
            </ToggleButton>
          </ToggleButtonGroup>

          {activeAudioUrl ? (
            <Link
              href={activeAudioUrl}
              aria-label={`Download ${demo.title} ${mode} audio`}
              className={buttonStyle({ variant: "secondary", size: "sm" })}
            >
              Download
            </Link>
          ) : null}
        </div>

        {activeAudioUrl ? (
          <div className="mt-3 border border-border bg-background p-3">
            <WaveformPlayer
              key={activeAudioUrl}
              audioUrl={activeAudioUrl}
              group="landing-demos"
              playerId={demo.id}
            />
          </div>
        ) : null}
      </div>
    </article>
  );
}
