import { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, useSearchParams } from 'react-router-dom'
import { useWaveformListPlayer } from '../components/audio/useWaveformListPlayer'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Label } from '../components/ui/Label'
import { Message } from '../components/ui/Message'
import { Select } from '../components/ui/Select'
import { apiJson } from '../lib/api'
import type { Voice, VoicesResponse } from '../lib/types'
import { useDebouncedValue } from './hooks'

function tokenize(query: string) {
  return query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
}

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
  merged.forEach(([s, e], i) => {
    if (cursor < s) out.push(<span key={`t-${i}`}>{text.slice(cursor, s)}</span>)
    out.push(
      <mark key={`m-${i}`} className="bg-foreground text-background px-0.5">
        {text.slice(s, e)}
      </mark>,
    )
    cursor = e
  })
  if (cursor < text.length) out.push(<span key="end">{text.slice(cursor)}</span>)
  return <>{out}</>
}

function snippet(value: string | null, maxLen: number, fallback: string) {
  if (!value) return fallback
  return value.length > maxLen ? `${value.slice(0, maxLen)}…` : value
}

type PlayState = 'idle' | 'loading' | 'playing' | 'paused' | 'stopped'

export function VoicesPage() {
  const { toggle } = useWaveformListPlayer()

  const [searchParams, setSearchParams] = useSearchParams()
  const initialQuery = searchParams.get('search') ?? ''
  const initialSource = searchParams.get('source')
  const initialPageRaw = searchParams.get('page')

  const initialPage = Math.max(1, Number(initialPageRaw ?? '1') || 1)
  const initialSourceValue =
    initialSource === 'uploaded' || initialSource === 'designed' ? initialSource : 'all'

  const [query, setQuery] = useState(initialQuery)
  const debounced = useDebouncedValue(query, 250)
  const tokens = useMemo(() => tokenize(debounced), [debounced])

  const [source, setSource] = useState<'all' | 'uploaded' | 'designed'>(
    initialSourceValue,
  )
  const [page, setPage] = useState(initialPage)
  const perPage = 20

  const [data, setData] = useState<VoicesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [busyDelete, setBusyDelete] = useState<string | null>(null)
  const [playState, setPlayState] = useState<Record<string, PlayState>>({})
  const waveRefs = useRef<Record<string, HTMLDivElement | null>>({})

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams()
      qs.set('page', String(page))
      qs.set('per_page', String(perPage))
      if (debounced.trim()) qs.set('search', debounced.trim())
      if (source !== 'all') qs.set('source', source)
      const res = await apiJson<VoicesResponse>(`/api/voices?${qs.toString()}`)
      setData(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load voices.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced, page, source])

  useEffect(() => setPage(1), [debounced, source])

  useEffect(() => {
    const qs = new URLSearchParams()
    if (debounced.trim()) qs.set('search', debounced.trim())
    if (source !== 'all') qs.set('source', source)
    if (page !== 1) qs.set('page', String(page))
    setSearchParams(qs, { replace: true })
  }, [debounced, page, setSearchParams, source])

  async function onDelete(voice: Voice) {
    if (!confirm(`Delete voice "${voice.name}"?`)) return
    setBusyDelete(voice.id)
    try {
      await apiJson(`/api/voices/${voice.id}`, { method: 'DELETE' })
      void load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete voice.')
    } finally {
      setBusyDelete(null)
    }
  }

  async function onPreview(voice: Voice) {
    const container = waveRefs.current[voice.id]
    if (!container) return
    await toggle({
      id: voice.id,
      container,
      audioUrl: `/api/voices/${voice.id}/preview`,
      onState: (state) => {
        const next: PlayState = state
        setPlayState((prev) => ({ ...prev, [voice.id]: next }))
      },
    })
  }

  return (
    <div className="space-y-8">
      <h2 className="text-balance text-center text-xl font-semibold uppercase tracking-[2px]">
        Voices
      </h2>

      {error ? <Message variant="error">{error}</Message> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="voices-search">Search</Label>
          <Input
            id="voices-search"
            type="search"
            name="search"
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search voices…"
          />
        </div>
        <div>
          <Label htmlFor="voices-source">Source</Label>
          <Select
            id="voices-source"
            name="source"
            value={source}
            onChange={(e) =>
              setSource(e.target.value as 'all' | 'uploaded' | 'designed')
            }
          >
            <option value="all">All</option>
            <option value="uploaded">Clone</option>
            <option value="designed">Designed</option>
          </Select>
        </div>
      </div>

      {loading ? <div className="text-sm text-muted-foreground">Loading…</div> : null}

      {!loading && data && data.voices.length === 0 ? (
        <div className="border border-border bg-subtle p-6 text-center text-sm text-muted-foreground">
          No voices found.
        </div>
      ) : null}

      <div className="grid gap-4">
        {data?.voices.map((v) => {
          const state = playState[v.id] ?? 'idle'
          const label =
            state === 'idle'
              ? 'Preview'
              : state === 'loading'
                ? 'Loading…'
                : state === 'playing'
                  ? 'Stop'
                  : 'Play'
          const disabled = state === 'loading'

          return (
            <div key={v.id} className="border border-border bg-background p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="border border-border bg-subtle px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {v.source === 'designed' ? 'DESIGNED' : 'CLONE'}
                    </span>
                    <div className="truncate text-sm font-semibold">
                      <Highlight text={v.name} tokens={tokens} />
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    <Highlight
                      text={snippet(v.reference_transcript, 120, 'No transcript')}
                      tokens={tokens}
                    />
                  </div>
                  {v.description ? (
                    <div className="mt-2 text-sm text-muted-foreground">
                      <Highlight text={snippet(v.description, 120, '')} tokens={tokens} />
                    </div>
                  ) : null}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <NavLink
                    to={`/generate?voice=${v.id}`}
                    className="border border-border bg-background px-3 py-2 text-[12px] uppercase tracking-wide hover:bg-muted focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    Generate
                  </NavLink>
                  <button
                    type="button"
                    className="border border-border bg-background px-3 py-2 text-[12px] uppercase tracking-wide hover:bg-muted disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    disabled={disabled}
                    aria-pressed={state === 'playing'}
                    aria-controls={`voice-wave-${v.id}`}
                    onClick={() => void onPreview(v)}
                  >
                    {label}
                  </button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busyDelete === v.id}
                    onClick={() => void onDelete(v)}
                  >
                    Delete
                  </Button>
                </div>
              </div>

              <div className="mt-4">
                <div
                  ref={(el) => {
                    waveRefs.current[v.id] = el
                  }}
                  id={`voice-wave-${v.id}`}
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
            className="border border-border bg-background px-3 py-2 text-[12px] uppercase tracking-wide hover:bg-muted disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
            className="border border-border bg-background px-3 py-2 text-[12px] uppercase tracking-wide hover:bg-muted disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
