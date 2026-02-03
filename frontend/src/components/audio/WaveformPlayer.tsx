import { useEffect, useMemo, useRef, useState } from 'react'
import WaveSurfer from 'wavesurfer.js'
import { useTheme } from '../../app/theme/ThemeProvider'
import { cn } from '../../lib/cn'

export function WaveformPlayer({
  audioUrl,
  className,
}: {
  audioUrl: string
  className?: string
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const wsRef = useRef<WaveSurfer | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [timeLabel, setTimeLabel] = useState('0:00')

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

    setIsReady(false)
    setIsPlaying(false)
    setTimeLabel('0:00')

    const styles = getComputedStyle(document.documentElement)
    const waveColor =
      styles.getPropertyValue('--color-faint').trim() || '#a0a0a0'
    const progressFallback = resolvedTheme === 'dark' ? '#f5f5f5' : '#111111'
    const progressColor =
      styles.getPropertyValue('--color-foreground').trim() || progressFallback

    const ws = WaveSurfer.create({
      container: el,
      ...baseOptions,
      waveColor,
      progressColor,
      url: audioUrl,
    })
    wsRef.current = ws

    const onReady = () => setIsReady(true)
    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    const onFinish = () => setIsPlaying(false)
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
    ws.on('timeupdate', onTimeUpdate)

    return () => {
      ws.destroy()
      wsRef.current = null
    }
  }, [audioUrl, baseOptions, resolvedTheme])

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

      <div ref={containerRef} />
    </div>
  )
}
