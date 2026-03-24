import { useMemo, useState } from "react";
import { ToggleButton, ToggleButtonGroup } from "react-aria-components";
import { WaveformPlayer } from "../../components/audio/WaveformPlayer";
import { buttonStyles } from "../../components/ui/Button";
import type { UtterDemo } from "../../content/utterDemo";
import { cn } from "../../lib/cn";

export function DemoClipCard({ demo, className }: { demo: UtterDemo; className?: string }) {
  const [mode, setMode] = useState<"original" | "clone">("original");
  const canClone = Boolean(demo.outputAudioUrl);

  const activeAudioUrl = useMemo(() => {
    if (mode === "clone" && demo.outputAudioUrl) return demo.outputAudioUrl;
    return demo.audioUrl;
  }, [demo.audioUrl, demo.outputAudioUrl, mode]);

  return (
    <article
      className={cn(
        "mx-auto w-full max-w-[560px]",
        "border border-border bg-background shadow-elevated hover:bg-subtle",
        "transition-[background-color,border-color,box-shadow] duration-300 ease-out motion-reduce:transition-none",
        "hover:border-border-strong hover:shadow-[0_10px_28px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_12px_36px_rgba(0,0,0,0.50)]",
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
              loading="lazy"
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
            <ToggleButton
              id="original"
              className="cursor-pointer px-3 py-2 text-[12px] uppercase tracking-wide transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background bg-background text-foreground hover:bg-subtle selected:bg-foreground selected:text-background"
            >
              Original
            </ToggleButton>
            <ToggleButton
              id="clone"
              isDisabled={!canClone}
              className={cn(
                "cursor-pointer px-3 py-2 text-[12px] uppercase tracking-wide transition-colors",
                "border-l border-border",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                "bg-background text-foreground hover:bg-subtle selected:bg-foreground selected:text-background",
                "disabled:cursor-not-allowed disabled:bg-muted disabled:text-faint disabled:hover:bg-muted",
              )}
            >
              Clone
            </ToggleButton>
          </ToggleButtonGroup>

          {activeAudioUrl ? (
            <a href={activeAudioUrl} className={buttonStyles({ variant: "secondary", size: "sm" })}>
              Download
            </a>
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
