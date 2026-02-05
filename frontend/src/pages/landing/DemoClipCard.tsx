import { useMemo, useState } from 'react'
import { WaveformPlayer } from '../../components/audio/WaveformPlayer'
import { buttonStyles } from '../../components/ui/Button'
import type { UtterDemo } from '../../content/utterDemo'
import { cn } from '../../lib/cn'

export function DemoClipCard({
  demo,
  className,
}: {
  demo: UtterDemo
  className?: string
}) {
  const [mode, setMode] = useState<'original' | 'clone'>('original')
  const canClone = Boolean(demo.outputAudioUrl)

  const activeAudioUrl = useMemo(() => {
    if (mode === 'clone' && demo.outputAudioUrl) return demo.outputAudioUrl
    return demo.audioUrl
  }, [demo.audioUrl, demo.outputAudioUrl, mode])

  return (
    <article
      className={cn(
        'mx-auto w-full max-w-[560px]',
        'border border-border bg-background shadow-elevated hover:bg-subtle',
        'transition-[background-color,border-color,box-shadow] duration-300 ease-out motion-reduce:transition-none',
        'hover:border-border-strong hover:shadow-[0_10px_28px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_12px_36px_rgba(0,0,0,0.50)]',
        className,
      )}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold uppercase tracking-wide">
              {demo.title}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {demo.vibe}
            </div>
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
          <div className="inline-flex overflow-hidden border border-border bg-background">
            <button
              type="button"
              className={cn(
                'px-3 py-2 text-[12px] uppercase tracking-wide transition-colors',
                'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                mode === 'original'
                  ? 'bg-foreground text-background'
                  : 'bg-background text-foreground hover:bg-subtle',
              )}
              aria-pressed={mode === 'original'}
              onClick={() => setMode('original')}
            >
              Original
            </button>
            <button
              type="button"
              className={cn(
                'px-3 py-2 text-[12px] uppercase tracking-wide transition-colors',
                'border-l border-border',
                'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                mode === 'clone'
                  ? 'bg-foreground text-background'
                  : 'bg-background text-foreground hover:bg-subtle',
                !canClone &&
                  'cursor-not-allowed bg-muted text-faint hover:bg-muted',
              )}
              disabled={!canClone}
              aria-pressed={mode === 'clone'}
              onClick={() => setMode('clone')}
            >
              Clone
            </button>
          </div>

          {activeAudioUrl ? (
            <a
              href={activeAudioUrl}
              className={buttonStyles({ variant: 'secondary', size: 'sm' })}
            >
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
  )
}
