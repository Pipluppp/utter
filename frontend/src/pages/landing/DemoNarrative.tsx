import { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, useSearchParams } from 'react-router-dom'
import { Button, buttonStyles } from '../../components/ui/Button'
import { getUtterDemo, UTTER_DEMOS } from '../../content/utterDemo'
import { cn } from '../../lib/cn'
import { fetchTextUtf8 } from '../../lib/fetchTextUtf8'
import { DemoCard } from './DemoCard'
import { DemoPlayer } from './DemoPlayer'

function resolveInitialDemoId(params: URLSearchParams) {
  const fromQs = params.get('demo')
  if (fromQs && getUtterDemo(fromQs)) return fromQs
  return UTTER_DEMOS.find((d) => d.audioUrl)?.id ?? UTTER_DEMOS[0]?.id ?? 'gojo'
}

export function DemoNarrative() {
  const [params, setParams] = useSearchParams()
  const [activeId, setActiveId] = useState(() => resolveInitialDemoId(params))
  const activeDemo = useMemo(() => getUtterDemo(activeId), [activeId])

  const [transcripts, setTranscripts] = useState<Record<string, string>>({})
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const handledScrollObserverRef = useRef(false)

  useEffect(() => {
    const nextId = resolveInitialDemoId(params)
    setActiveId((prev) => (prev === nextId ? prev : nextId))
  }, [params])

  useEffect(() => {
    if (!activeDemo?.transcriptUrl) return
    if (Object.hasOwn(transcripts, activeDemo.id)) return
    const transcriptUrl = activeDemo.transcriptUrl

    let cancelled = false
    void (async () => {
      try {
        const text = await fetchTextUtf8(transcriptUrl)
        if (cancelled) return
        setTranscripts((prev) => ({ ...prev, [activeDemo.id]: text }))
      } catch {
        if (cancelled) return
        setTranscripts((prev) => ({ ...prev, [activeDemo.id]: '' }))
      }
    })()

    return () => {
      cancelled = true
    }
  }, [activeDemo, transcripts])

  useEffect(() => {
    if (handledScrollObserverRef.current) return
    handledScrollObserverRef.current = true

    const cards = UTTER_DEMOS.map((d) =>
      document.getElementById(`demo-${d.id}`),
    ).filter(Boolean) as HTMLElement[]

    if (cards.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort(
            (a, b) =>
              Math.abs(a.boundingClientRect.top) -
              Math.abs(b.boundingClientRect.top),
          )

        const top = visible[0]
        if (!top) return

        const id =
          (top.target as HTMLElement).getAttribute('data-demo-id') ?? null
        if (!id) return

        setActiveId((prev) => (prev === id ? prev : id))
      },
      { rootMargin: '-35% 0px -55% 0px', threshold: [0, 0.2, 0.6] },
    )

    for (const el of cards) observer.observe(el)
    return () => observer.disconnect()
  }, [])

  async function copyTranscript() {
    if (!activeDemo) return
    const text = transcripts[activeDemo.id] ?? ''
    if (!text.trim()) return

    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(activeDemo.id)
      window.setTimeout(() => {
        setCopiedId((prev) => (prev === activeDemo.id ? null : prev))
      }, 900)
    } catch {
      // ignore
    }
  }

  function selectDemo(nextId: string) {
    setActiveId(nextId)
    const next = new URLSearchParams(params)
    next.set('demo', nextId)
    setParams(next, { replace: true })
  }

  const transcript = activeDemo ? transcripts[activeDemo.id] : undefined

  return (
    <section id="demos" className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold uppercase tracking-[2px]">
            Demo clips
          </h2>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Real examples from the `utter_demo/` set: stills, playable audio,
            and the exact text (when available).
          </p>
        </div>
        <NavLink
          to="/clone"
          className={buttonStyles({ variant: 'primary', size: 'sm' })}
        >
          Clone a voice →
        </NavLink>
      </div>

      <div className="grid gap-6 md:grid-cols-[360px_1fr]">
        <div className="md:sticky md:top-24 md:self-start">
          <div className="border border-border bg-background p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs uppercase tracking-wide text-faint">
                Now selected
              </div>
              {activeDemo?.audioUrl ? (
                <a
                  href={activeDemo.audioUrl}
                  className={cn(
                    'text-[11px] uppercase tracking-wide text-muted-foreground hover:text-foreground',
                    'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                  )}
                >
                  Download
                </a>
              ) : null}
            </div>

            {activeDemo?.imageUrl ? (
              <div className="mt-3 overflow-hidden border border-border bg-muted">
                <img
                  src={activeDemo.imageUrl}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-48 w-full object-cover grayscale"
                />
              </div>
            ) : null}

            <DemoPlayer
              className="mt-4"
              title={activeDemo?.title ?? 'Demo'}
              audioUrl={activeDemo?.audioUrl}
              transcript={transcript}
              onCopyTranscript={
                activeDemo?.transcriptUrl ? copyTranscript : undefined
              }
            />

            {activeDemo?.transcriptUrl ? (
              <div className="mt-4 border border-border bg-subtle p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs font-semibold uppercase tracking-wide">
                    Text
                  </div>
                  <div className="text-[11px] uppercase tracking-wide text-faint">
                    {copiedId === activeDemo.id
                      ? 'Copied'
                      : activeDemo.languageLabel}
                  </div>
                </div>
                <div className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">
                  {transcript?.trim()
                    ? transcript
                    : 'Transcript unavailable for this clip.'}
                </div>
              </div>
            ) : null}

            <div className="mt-4 grid gap-2">
              <NavLink
                to={`/clone?demo=${encodeURIComponent(activeDemo?.id ?? '')}`}
                className={buttonStyles({
                  variant: 'primary',
                  size: 'sm',
                  block: true,
                })}
              >
                Use in Clone →
              </NavLink>
              <NavLink
                to={
                  transcript?.trim()
                    ? `/generate?demo=${encodeURIComponent(activeDemo?.id ?? '')}`
                    : '/generate'
                }
                className={buttonStyles({
                  variant: 'secondary',
                  size: 'sm',
                  block: true,
                })}
              >
                Use in Generate →
              </NavLink>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {UTTER_DEMOS.filter((d) => d.id !== 'chunking').map((demo) => (
            <DemoCard
              key={demo.id}
              demo={demo}
              active={demo.id === activeId}
              transcriptPreview={
                transcripts[demo.id]?.trim()
                  ? `${transcripts[demo.id].trim().slice(0, 220)}${
                      transcripts[demo.id].trim().length > 220 ? '…' : ''
                    }`
                  : undefined
              }
              onSelect={() => selectDemo(demo.id)}
            />
          ))}

          <div className="border border-border bg-background p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold uppercase tracking-wide">
                  Long-form text sample
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                  Paste a longer prompt to stress-test chunking and pacing.
                </div>
              </div>
              <Button
                size="sm"
                type="button"
                variant="secondary"
                onClick={async () => {
                  const demo = getUtterDemo('chunking')
                  if (!demo?.transcriptUrl) return
                  try {
                    const text = await fetchTextUtf8(demo.transcriptUrl)
                    await navigator.clipboard.writeText(text)
                  } catch {
                    // ignore
                  }
                }}
              >
                Copy long text
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="border border-border bg-subtle p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm">
            <div className="font-medium uppercase tracking-wide">Next</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Clone a voice from a clip, then generate speech with your saved
              voices.
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <NavLink
              to="/clone"
              className={buttonStyles({ variant: 'primary', size: 'sm' })}
            >
              Clone →
            </NavLink>
            <NavLink
              to="/voices"
              className={buttonStyles({ variant: 'secondary', size: 'sm' })}
            >
              Voices →
            </NavLink>
          </div>
        </div>
      </div>
    </section>
  )
}
