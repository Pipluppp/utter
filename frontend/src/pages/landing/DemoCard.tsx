import type { UtterDemo } from '../../content/utterDemo'
import { cn } from '../../lib/cn'

export function DemoCard({
  demo,
  active,
  transcriptPreview,
  onSelect,
}: {
  demo: UtterDemo
  active: boolean
  transcriptPreview?: string
  onSelect: () => void
}) {
  return (
    <button
      id={`demo-${demo.id}`}
      data-demo-id={demo.id}
      type="button"
      onClick={onSelect}
      className={cn(
        'group w-full text-left',
        'border border-border bg-background hover:bg-subtle',
        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        active && 'border-border-strong bg-subtle',
      )}
    >
      <div className="grid gap-4 p-4 md:grid-cols-[160px_1fr]">
        <div className="relative">
          <div className="aspect-[4/3] overflow-hidden border border-border bg-muted">
            {demo.imageUrl ? (
              <img
                src={demo.imageUrl}
                alt=""
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover grayscale transition group-hover:grayscale-0"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-faint">
                Audio demo
              </div>
            )}
          </div>
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold uppercase tracking-wide">
                {demo.title}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {demo.vibe}
              </div>
            </div>
            <div className="text-xs uppercase tracking-wide text-faint">
              {demo.languageLabel}
            </div>
          </div>

          <div className="mt-3 text-xs text-faint">
            {demo.audioUrl ? 'Playable clip' : 'Text sample'}{' '}
            <span className="mx-2 text-border">/</span>
            {demo.transcriptUrl ? 'Transcript' : 'No transcript'}
          </div>

          {transcriptPreview ? (
            <div className="mt-3 line-clamp-3 text-xs text-muted-foreground">
              {transcriptPreview}
            </div>
          ) : null}
        </div>
      </div>
    </button>
  )
}
