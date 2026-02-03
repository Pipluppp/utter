import { useEffect, useMemo, useState } from 'react'
import { apiJson } from '../lib/api'
import type { LanguagesResponse } from '../lib/types'

export function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delayMs)
    return () => window.clearTimeout(t)
  }, [delayMs, value])
  return debounced
}

export function useLanguages() {
  const [data, setData] = useState<LanguagesResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const res = await apiJson<LanguagesResponse>('/api/languages')
        if (!active) return
        setData(res)
        setError(null)
      } catch (e) {
        if (!active) return
        setError(e instanceof Error ? e.message : 'Failed to load languages')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const languages = useMemo(() => data?.languages ?? ['Auto'], [data])
  const defaultLanguage = data?.default ?? 'Auto'
  const provider = data?.provider ?? 'unknown'

  return { languages, defaultLanguage, provider, loading, error }
}
