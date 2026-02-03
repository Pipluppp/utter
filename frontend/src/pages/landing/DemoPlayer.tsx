import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { cn } from '../../lib/cn'

function formatTime(seconds: number) {
  const s = Math.max(0, Math.floor(seconds))
  const mm = Math.floor(s / 60)
  const ss = String(s % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

export function DemoPlayer({
  title,
  audioUrl,
  transcript,
  onCopyTranscript,
  className,
}: {
  title: string
  audioUrl?: string
  transcript?: string
  onCopyTranscript?: () => void
  className?: string
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const rafRef = useRef<number | null>(null)

  const [ready, setReady] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)

  const canPlay = Boolean(audioUrl)

  const timeLabel = useMemo(() => {
    if (!ready) return '0:00 / 0:00'
    return `${formatTime(currentTime)} / ${formatTime(duration)}`
  }, [currentTime, duration, ready])

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset player state when audioUrl changes
  useEffect(() => {
    setReady(false)
    setPlaying(false)
    setDuration(0)
    setCurrentTime(0)
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
  }, [audioUrl])

  function tick() {
    const el = audioRef.current
    if (!el) return
    setCurrentTime(el.currentTime || 0)
    rafRef.current = requestAnimationFrame(tick)
  }

  function stopTick() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
  }

  function togglePlay() {
    const el = audioRef.current
    if (!el) return
    if (el.paused) {
      void el.play()
    } else {
      el.pause()
    }
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold uppercase tracking-wide">
            {title}
          </div>
          <div className="mt-1 text-xs text-faint">{timeLabel}</div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            type="button"
            onClick={togglePlay}
            disabled={!canPlay}
          >
            {playing ? 'Pause' : 'Play'}
          </Button>
          {onCopyTranscript ? (
            <Button
              size="sm"
              variant="secondary"
              type="button"
              onClick={onCopyTranscript}
              disabled={!transcript || transcript.trim().length === 0}
            >
              Copy text
            </Button>
          ) : null}
        </div>
      </div>

      <div className="border border-border bg-background p-3">
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
            'w-full accent-foreground',
            !ready && 'cursor-not-allowed opacity-60',
          )}
          aria-label="Seek"
        />
      </div>

      {audioUrl ? (
        // biome-ignore lint/a11y/useMediaCaption: short demo clips; transcript is shown alongside when available
        <audio
          ref={audioRef}
          preload="none"
          src={audioUrl}
          onLoadedMetadata={(e) => {
            setDuration(e.currentTarget.duration || 0)
            setReady(true)
          }}
          onPlay={() => {
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
      ) : null}
    </div>
  )
}
