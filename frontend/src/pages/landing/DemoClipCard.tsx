import { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Button, buttonStyles } from '../../components/ui/Button'
import type { UtterDemo } from '../../content/utterDemo'
import { cn } from '../../lib/cn'
import { fetchTextUtf8 } from '../../lib/fetchTextUtf8'

function formatTime(seconds: number) {
  const s = Math.max(0, Math.floor(seconds))
  const mm = Math.floor(s / 60)
  const ss = String(s % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

export function DemoClipCard({
  demo,
  className,
}: {
  demo: UtterDemo
  className?: string
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const rafRef = useRef<number | null>(null)

  const [transcript, setTranscript] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const [ready, setReady] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)

  const canPlay = Boolean(demo.audioUrl)

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  useEffect(() => {
    if (!demo.transcriptUrl) {
      setTranscript(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const text = await fetchTextUtf8(demo.transcriptUrl as string)
        if (cancelled) return
        setTranscript(text)
      } catch {
        if (cancelled) return
        setTranscript('')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [demo.transcriptUrl])

  const transcriptPreview = useMemo(() => {
    if (!transcript?.trim()) return null
    const t = transcript.trim()
    return `${t.slice(0, 240)}${t.length > 240 ? '…' : ''}`
  }, [transcript])

  function stopTick() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
  }

  function tick() {
    const el = audioRef.current
    if (!el) return
    setCurrentTime(el.currentTime || 0)
    rafRef.current = requestAnimationFrame(tick)
  }

  function pauseOtherDemos(current: HTMLAudioElement) {
    const all = document.querySelectorAll<HTMLAudioElement>(
      'audio[data-utter-demo-audio]',
    )
    for (const el of all) {
      if (el !== current && !el.paused) el.pause()
    }
  }

  function togglePlay() {
    const el = audioRef.current
    if (!el) return
    if (el.paused) {
      pauseOtherDemos(el)
      void el.play()
    } else {
      el.pause()
    }
  }

  async function copyText() {
    if (!transcript?.trim()) return
    try {
      await navigator.clipboard.writeText(transcript)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 900)
    } catch {
      // ignore
    }
  }

  const timeLabel = ready
    ? `${formatTime(currentTime)} / ${formatTime(duration)}`
    : '0:00 / 0:00'

  const hasTranscript = Boolean(transcript?.trim())

  return (
    <article
      className={cn(
        'border border-border bg-background',
        'hover:bg-subtle',
        className,
      )}
    >
      <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0">
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
                loading="lazy"
                decoding="async"
                className="h-52 w-full object-cover grayscale transition hover:grayscale-0"
              />
            </div>
          ) : (
            <div className="mt-4 border border-border bg-muted p-6 text-xs text-faint">
              No still available for this demo.
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              type="button"
              onClick={togglePlay}
              disabled={!canPlay}
            >
              {playing ? 'Pause' : 'Play'}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              type="button"
              onClick={copyText}
              disabled={!hasTranscript}
            >
              {copied ? 'Copied' : 'Copy text'}
            </Button>
            {demo.audioUrl ? (
              <a
                href={demo.audioUrl}
                className={buttonStyles({ variant: 'secondary', size: 'sm' })}
              >
                Download
              </a>
            ) : null}
          </div>

          {demo.audioUrl ? (
            <div className="mt-3 border border-border bg-background p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs uppercase tracking-wide text-faint">
                  {timeLabel}
                </div>
                <div className="text-[11px] uppercase tracking-wide text-faint">
                  {ready ? 'Ready' : 'Loading'}
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={duration || 0}
                step={0.01}
                value={currentTime}
                onChange={(e) => {
                  const next = Number(e.target.value)
                  setCurrentTime(next)
                  if (audioRef.current) audioRef.current.currentTime = next
                }}
                disabled={!ready}
                className={cn(
                  'mt-2 w-full accent-foreground',
                  !ready && 'cursor-not-allowed opacity-60',
                )}
                aria-label={`Seek ${demo.title}`}
              />

              {/* biome-ignore lint/a11y/useMediaCaption: transcript is shown when available; demos are short clips */}
              <audio
                ref={audioRef}
                data-utter-demo-audio={demo.id}
                preload="none"
                src={demo.audioUrl}
                onLoadedMetadata={(e) => {
                  setDuration(e.currentTarget.duration || 0)
                  setReady(true)
                }}
                onPlay={(e) => {
                  pauseOtherDemos(e.currentTarget)
                  setPlaying(true)
                  tick()
                }}
                onPause={() => {
                  setPlaying(false)
                  stopTick()
                }}
                onEnded={() => {
                  setPlaying(false)
                  stopTick()
                }}
              />
            </div>
          ) : null}

          {demo.transcriptUrl ? (
            <div className="mt-4 border border-border bg-subtle p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-semibold uppercase tracking-wide">
                  Transcript
                </div>
                <div className="text-[11px] uppercase tracking-wide text-faint">
                  {hasTranscript
                    ? `${transcript?.length ?? 0} chars`
                    : 'Missing'}
                </div>
              </div>
              <div className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">
                {transcriptPreview ?? 'Transcript unavailable for this demo.'}
              </div>
            </div>
          ) : null}
        </div>

        <div className="border border-border bg-subtle p-4">
          <div className="text-xs font-semibold uppercase tracking-wide">
            Try it
          </div>
          <div className="mt-3 space-y-2">
            <NavLink
              to={`/clone?demo=${encodeURIComponent(demo.id)}`}
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
                hasTranscript
                  ? `/generate?demo=${encodeURIComponent(demo.id)}`
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

          <div className="mt-4 border-t border-border pt-4 text-xs text-faint">
            {demo.suggestedCloneName ? (
              <div>
                Suggested name:{' '}
                <span className="text-foreground">
                  {demo.suggestedCloneName}
                </span>
              </div>
            ) : null}
            <div className="mt-2">
              Tip: keep clips clean; transcripts help alignment.
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}
