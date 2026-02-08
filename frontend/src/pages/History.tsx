import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useWaveformListPlayer } from '../components/audio/useWaveformListPlayer'
import { Button, buttonStyles } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Label } from '../components/ui/Label'
import { Message } from '../components/ui/Message'
import { Select } from '../components/ui/Select'
import { apiJson } from '../lib/api'
import { cn } from '../lib/cn'
import type {
  Generation,
  GenerationsResponse,
  RegenerateResponse,
} from '../lib/types'
import { useDebouncedValue } from './hooks'

function tokenize(query: string) {
  return query.trim().split(/\s+/).filter(Boolean)
}

const PER_PAGE = 20

function Highlight({ text, tokens }: { text: string; tokens: string[] }) {
  if (tokens.length === 0) return <>{text}</>
  const lower = text.toLowerCase()
  const ranges: Array<[number, number]> = []
  for (const t of tokens) {
    const needle = t.toLowerCase()
    if (!needle) continue
    let idx = 0
    while (idx < lower.length) {
      const found = lower.indexOf(needle, idx)
      if (found === -1) break
      ranges.push([found, found + needle.length])
      idx = found + needle.length
    }
  }
  if (ranges.length === 0) return <>{text}</>
  ranges.sort((a, b) => a[0] - b[0])

  const merged: Array<[number, number]> = []
  for (const r of ranges) {
    const prev = merged[merged.length - 1]
    if (!prev || r[0] > prev[1]) merged.push(r)
    else prev[1] = Math.max(prev[1], r[1])
  }

  const out: React.ReactNode[] = []
  let cursor = 0
  merged.forEach(([s, e]) => {
    if (cursor < s)
      out.push(<span key={`t-${cursor}-${s}`}>{text.slice(cursor, s)}</span>)
    out.push(
      <mark
        key={`m-${s}-${e}`}
        className="bg-foreground text-background px-0.5"
      >
        {text.slice(s, e)}
      </mark>,
    )
    cursor = e
  })
  if (cursor < text.length)
    out.push(<span key={`t-${cursor}-end`}>{text.slice(cursor)}</span>)
  return <>{out}</>
}

function generationAudioUrl(gen: Generation) {
  if (!gen.audio_path) return null
  return gen.audio_path
}

type PlayState = 'idle' | 'loading' | 'playing' | 'paused' | 'stopped'

export function HistoryPage() {
  const navigate = useNavigate()
  const { toggle } = useWaveformListPlayer()

  const [searchParams, setSearchParams] = useSearchParams()
  const initialQuery = searchParams.get('search') ?? ''
  const initialStatus = searchParams.get('status') ?? 'all'
  const initialPageRaw = searchParams.get('page')
  const initialPage = Math.max(1, Number(initialPageRaw ?? '1') || 1)

  const [query, setQuery] = useState(initialQuery)
  const debounced = useDebouncedValue(query, 250)
  const tokens = useMemo(() => tokenize(debounced), [debounced])

  const [status, setStatus] = useState<'all' | string>(initialStatus)
  const [page, setPage] = useState(initialPage)

  const [data, setData] = useState<GenerationsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [playState, setPlayState] = useState<Record<string, PlayState>>({})
  const waveRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const refreshTimerRef = useRef<number | null>(null)
  const loadAbortRef = useRef<AbortController | null>(null)

  const load = useCallback(async () => {
    loadAbortRef.current?.abort()
    const controller = new AbortController()
    loadAbortRef.current = controller

    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams()
      qs.set('page', String(page))
      qs.set('per_page', String(PER_PAGE))
      if (debounced.trim()) qs.set('search', debounced.trim())
      if (status !== 'all') qs.set('status', status)
      const res = await apiJson<GenerationsResponse>(
        `/api/generations?${qs.toString()}`,
        { signal: controller.signal },
      )
      setData(res)
    } catch (e) {
      if (controller.signal.aborted) return
      setError(e instanceof Error ? e.message : 'Failed to load history.')
    } finally {
      if (!controller.signal.aborted) setLoading(false)
      if (loadAbortRef.current === controller) loadAbortRef.current = null
    }
  }, [debounced, page, status])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    return () => loadAbortRef.current?.abort()
  }, [])

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset paging when search/status changes
  useEffect(() => setPage(1), [debounced, status])

  useEffect(() => {
    const qs = new URLSearchParams()
    if (debounced.trim()) qs.set('search', debounced.trim())
    if (status !== 'all') qs.set('status', status)
    if (page !== 1) qs.set('page', String(page))
    setSearchParams(qs, { replace: true })
  }, [debounced, page, setSearchParams, status])

  useEffect(() => {
    if (refreshTimerRef.current) {
      window.clearInterval(refreshTimerRef.current)
      refreshTimerRef.current = null
    }

    const hasActive = data?.generations.some(
      (g) => g.status === 'pending' || g.status === 'processing',
    )
    if (!hasActive) return

    refreshTimerRef.current = window.setInterval(() => void load(), 5000)
    return () => {
      if (refreshTimerRef.current) window.clearInterval(refreshTimerRef.current)
    }
  }, [data, load])

  async function onDelete(gen: Generation) {
    if (!confirm('Delete generation?')) return
    try {
      await apiJson(`/api/generations/${gen.id}`, { method: 'DELETE' })
      void load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete generation.')
    }
  }

  async function onRegenerate(gen: Generation) {
    try {
      const res = await apiJson<RegenerateResponse>(
        `/api/generations/${gen.id}/regenerate`,
        { method: 'POST' },
      )
      navigate(res.redirect_url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to regenerate.')
    }
  }

  async function onPlay(gen: Generation, audioUrl: string) {
    const container = waveRefs.current[gen.id]
    if (!container) return
    await toggle({
      id: gen.id,
      container,
      audioUrl,
      onState: (state) => {
        const next: PlayState = state
        setPlayState((prev) => ({ ...prev, [gen.id]: next }))
      },
    })
  }

  return (
    <div className="space-y-8">
      <h2 className="text-balance text-center text-xl font-pixel font-medium uppercase tracking-[2px]">
        History
      </h2>

      {error ? <Message variant="error">{error}</Message> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="history-search">Search</Label>
          <Input
            id="history-search"
            type="search"
            name="search"
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search history…"
          />
        </div>
        <div>
          <Label htmlFor="history-status">Status</Label>
          <Select
            id="history-status"
            name="status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : null}

      {!loading && data && data.generations.length === 0 ? (
        <div className="border border-border bg-subtle p-6 text-center text-sm text-muted-foreground shadow-elevated">
          No generations found.
        </div>
      ) : null}

      <div className="grid gap-4">
        {data?.generations.map((g) => {
          const audioUrl = generationAudioUrl(g)
          const isReady = g.status === 'completed' && Boolean(audioUrl)
          const state = playState[g.id] ?? 'idle'
          const playLabel =
            state === 'loading'
              ? 'Loading…'
              : state === 'playing'
                ? 'Stop'
                : 'Play'
          const playDisabled = state === 'loading'

          return (
            <div
              key={g.id}
              className="border border-border bg-background p-4 shadow-elevated"
            >
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'border px-2 py-0.5 text-[10px] uppercase tracking-wide',
                        g.status === 'completed' &&
                          'border-border bg-subtle text-muted-foreground',
                        (g.status === 'pending' || g.status === 'processing') &&
                          'border-border bg-muted text-muted-foreground',
                        g.status === 'failed' &&
                          'border-red-500/40 bg-red-500/10 text-red-700 dark:border-red-400/40 dark:bg-red-400/10 dark:text-red-300',
                        g.status === 'cancelled' &&
                          'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-200',
                      )}
                    >
                      {g.status}
                    </span>
                    <div className="truncate text-sm font-semibold">
                      <Highlight
                        text={g.voice_name ?? 'Unknown voice'}
                        tokens={tokens}
                      />
                    </div>
                  </div>

                  <div className="mt-2 text-sm text-muted-foreground">
                    <Highlight
                      text={
                        g.text.slice(0, 160) + (g.text.length > 160 ? '…' : '')
                      }
                      tokens={tokens}
                    />
                  </div>

                  {g.error_message ? (
                    <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                      {g.error_message.slice(0, 160)}
                      {g.error_message.length > 160 ? '…' : ''}
                    </div>
                  ) : null}

                  <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-faint">
                    {g.duration_seconds != null ? (
                      <span>Duration: {g.duration_seconds.toFixed(1)}s</span>
                    ) : null}
                    {g.generation_time_seconds != null ? (
                      <span>
                        Gen time: {g.generation_time_seconds.toFixed(1)}s
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2 md:justify-self-end">
                  {isReady && audioUrl ? (
                    <>
                      <button
                        type="button"
                        className={cn(
                          buttonStyles({ variant: 'secondary', size: 'sm' }),
                          'disabled:opacity-50',
                        )}
                        disabled={playDisabled}
                        aria-pressed={state === 'playing'}
                        aria-controls={`gen-wave-${g.id}`}
                        onClick={() => void onPlay(g, audioUrl)}
                      >
                        {playLabel}
                      </button>
                      <a
                        className={buttonStyles({
                          variant: 'secondary',
                          size: 'sm',
                        })}
                        href={audioUrl}
                      >
                        Download
                      </a>
                    </>
                  ) : (
                    <span className="text-xs text-faint">
                      {g.status === 'processing' || g.status === 'pending'
                        ? 'Generating…'
                        : ''}
                    </span>
                  )}
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => void onRegenerate(g)}
                  >
                    Regenerate
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => void onDelete(g)}
                  >
                    Delete
                  </Button>
                </div>
              </div>

              <div className="mt-4">
                <div
                  ref={(el) => {
                    waveRefs.current[g.id] = el
                  }}
                  id={`gen-wave-${g.id}`}
                  className="hidden"
                />
              </div>
            </div>
          )
        })}
      </div>

      {data ? (
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            className={cn(
              buttonStyles({ variant: 'secondary', size: 'sm' }),
              'disabled:opacity-50',
            )}
            disabled={data.pagination.page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Prev
          </button>
          <div className="text-xs text-faint">
            Page {data.pagination.page} of {data.pagination.pages}
          </div>
          <button
            type="button"
            className={cn(
              buttonStyles({ variant: 'secondary', size: 'sm' }),
              'disabled:opacity-50',
            )}
            disabled={data.pagination.page >= data.pagination.pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  )
}
