import { useCallback, useEffect, useRef, useState } from 'react'
import WaveSurfer from 'wavesurfer.js'
import { useTheme } from '../../app/theme/ThemeProvider'

type Active = { id: string; container: HTMLElement }

export function useWaveformListPlayer() {
  const wsRef = useRef<WaveSurfer | null>(null)
  const activeRef = useRef<Active | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const { resolvedTheme } = useTheme()

  const stopAll = useCallback(() => {
    wsRef.current?.destroy()
    wsRef.current = null

    if (activeRef.current) {
      activeRef.current.container.innerHTML = ''
      activeRef.current.container.classList.add('hidden')
    }

    activeRef.current = null
    setActiveId(null)
  }, [])

  const toggle = useCallback(
    async ({
      id,
      container,
      audioUrl,
      onState,
    }: {
      id: string
      container: HTMLElement
      audioUrl: string
      onState?: (state: 'loading' | 'playing' | 'paused' | 'stopped') => void
    }) => {
      if (activeRef.current?.id === id && wsRef.current) {
        if (wsRef.current.isPlaying()) {
          wsRef.current.pause()
          onState?.('paused')
        } else {
          wsRef.current.play()
          onState?.('playing')
        }
        return
      }

      stopAll()
      activeRef.current = { id, container }
      setActiveId(id)
      onState?.('loading')

      container.classList.remove('hidden')
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
        container,
        waveColor,
        progressColor,
        cursorColor: 'transparent',
        barWidth: 2,
        barGap: 2,
        barRadius: 0,
        height: 48,
        normalize: true,
        url: audioUrl,
      })
      wsRef.current = ws

      ws.on('ready', () => {
        ws.play()
        onState?.('playing')
      })
      ws.on('pause', () => onState?.('paused'))
      ws.on('play', () => onState?.('playing'))
      ws.on('finish', () => onState?.('stopped'))
      ws.on('error', () => {
        stopAll()
      })
    },
    [resolvedTheme, stopAll],
  )

  useEffect(() => stopAll, [stopAll])

  return { activeId, toggle, stopAll }
}
