import { useEffect, useRef, useState } from 'react'
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

  const transcriptUrl = demo.transcriptUrl
  const [transcript, setTranscript] = useState<string | null>(null)
  const [loadingTranscript, setLoadingTranscript] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState<string | null>(null)

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

  async function ensureTranscriptLoaded() {
    if (!transcriptUrl) return ''
    if (typeof transcript === 'string') return transcript
    if (loadingTranscript) return ''

    setLoadingTranscript(true)
    setCopyError(null)
    try {
      const text = await fetchTextUtf8(transcriptUrl as string)
      setTranscript(text)
      return text
    } catch {
      setTranscript('')
      return ''
    } finally {
      setLoadingTranscript(false)
    }
  }

  async function copyText() {
    if (!transcriptUrl) return
    try {
      const text = (await ensureTranscriptLoaded()).trim()
      if (!text) {
        setCopyError('No text')
        window.setTimeout(() => setCopyError(null), 900)
        return
      }
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 900)
    } catch {
      setCopyError('Failed')
      window.setTimeout(() => setCopyError(null), 900)
    }
  }

  const timeLabel = ready
    ? `${formatTime(currentTime)} / ${formatTime(duration)}`
    : '0:00 / 0:00'

  const canCopy = Boolean(transcriptUrl)

  return (
    <article
      className={cn(
        'mx-auto w-full max-w-[560px]',
        'border border-border bg-background hover:bg-subtle',
        'transform-gpu transition-transform md:hover:-translate-y-0.5',
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
            disabled={!canCopy || loadingTranscript}
          >
            {copied ? 'Copied' : copyError ? copyError : 'Copy text'}
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

            {/* biome-ignore lint/a11y/useMediaCaption: demos are short clips; transcript is copy-only */}
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
      </div>
    </article>
  )
}
