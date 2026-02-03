import { useEffect, useMemo, useRef, useState } from 'react'
import WaveSurfer from 'wavesurfer.js'
import { useTheme } from '../../app/theme/ThemeProvider'
import { cn } from '../../lib/cn'

export function WaveformPlayer({
  audioUrl,
  audioBlob,
  className,
}: {
  audioUrl?: string
  audioBlob?: Blob
  className?: string
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const wsRef = useRef<WaveSurfer | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [timeLabel, setTimeLabel] = useState('0:00')
  const [loadError, setLoadError] = useState<string | null>(null)

  const { resolvedTheme } = useTheme()

  const baseOptions = useMemo(
    () => ({
      cursorColor: 'transparent',
      barWidth: 2,
      barGap: 2,
      barRadius: 0,
      height: 48,
      normalize: true,
    }),
    [],
  )

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    if (!audioUrl && !audioBlob) return

    let cancelled = false

    setIsReady(false)
    setIsPlaying(false)
    setTimeLabel('0:00')
    setLoadError(null)

    const styles = getComputedStyle(document.documentElement)
    const foreground =
      styles.getPropertyValue('--color-foreground').trim() ||
      (resolvedTheme === 'dark' ? '#f5f5f5' : '#111111')
    const mutedForeground =
      styles.getPropertyValue('--color-muted-foreground').trim() ||
      (resolvedTheme === 'dark' ? '#b3b3b3' : '#555555')
    const faint = styles.getPropertyValue('--color-faint').trim() || '#888888'

    const waveColor = resolvedTheme === 'dark' ? foreground : faint
    const progressColor =
      resolvedTheme === 'dark' ? mutedForeground : foreground

    const ws = WaveSurfer.create({
      container: el,
      ...baseOptions,
      waveColor,
      progressColor,
    })
    wsRef.current = ws

    const onReady = () => {
      setIsReady(true)
      setLoadError(null)
    }
    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    const onFinish = () => setIsPlaying(false)
    const onError = (e: unknown) => {
      if (cancelled) return
      const err = e as { name?: unknown; message?: unknown }
      const name = typeof err?.name === 'string' ? err.name : ''
      const message = typeof err?.message === 'string' ? err.message : ''

      // Ignore aborts (common during route changes/unmounts or rapid reloads).
      if (
        name === 'AbortError' ||
        message.toLowerCase().includes('aborted') ||
        message.toLowerCase().includes('signal is aborted')
      ) {
        return
      }

      const msg = e instanceof Error ? e.message : 'Failed to load audio.'
      setLoadError(msg)
      setIsReady(false)
      setIsPlaying(false)
    }
    const onTimeUpdate = () => {
      const t = ws.getCurrentTime()
      const mins = Math.floor(t / 60)
      const secs = Math.floor(t % 60)
      setTimeLabel(`${mins}:${secs.toString().padStart(2, '0')}`)
    }

    ws.on('ready', onReady)
    ws.on('play', onPlay)
    ws.on('pause', onPause)
    ws.on('finish', onFinish)
    ws.on('error', onError)
    ws.on('timeupdate', onTimeUpdate)

    if (audioBlob) {
      ws.loadBlob(audioBlob).catch(onError)
    } else if (audioUrl) {
      ws.load(audioUrl).catch(onError)
    }

    return () => {
      cancelled = true
      ws.destroy()
      wsRef.current = null
    }
  }, [audioBlob, audioUrl, baseOptions, resolvedTheme])

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between">
        <button
          type="button"
          className={cn(
            'border border-border bg-background px-3 py-2 text-[12px] uppercase tracking-wide hover:bg-muted',
            'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            !isReady && 'cursor-not-allowed opacity-50',
          )}
          disabled={!isReady}
          aria-pressed={isPlaying}
          onClick={() => {
            const ws = wsRef.current
            if (!ws) return
            ws.isPlaying() ? ws.pause() : ws.play()
          }}
        >
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <span className="text-xs text-faint">{timeLabel}</span>
      </div>

      {loadError ? (
        <div className="text-xs text-red-700 dark:text-red-400">
          {loadError}
        </div>
      ) : null}

      <div ref={containerRef} />

      {loadError && audioUrl && !isReady ? (
        // biome-ignore lint/a11y/useMediaCaption: Generated previews have no caption track; this is a fallback for playback when WaveSurfer fails.
        <audio controls preload="metadata" className="w-full" src={audioUrl} />
      ) : null}
    </div>
  )
}
