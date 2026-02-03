import { useEffect, useMemo, useState } from 'react'
import { apiJson } from '../lib/api'
import type { LanguagesResponse } from '../lib/types'

let languagesCache: LanguagesResponse | null = null
let languagesInFlight: Promise<LanguagesResponse> | null = null

async function getLanguagesOnce(): Promise<LanguagesResponse> {
  if (languagesCache) return languagesCache
  if (!languagesInFlight) {
    languagesInFlight = apiJson<LanguagesResponse>('/api/languages')
      .then((res) => {
        languagesCache = res
        return res
      })
      .finally(() => {
        languagesInFlight = null
      })
  }
  return languagesInFlight
}

export function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delayMs)
    return () => window.clearTimeout(t)
  }, [delayMs, value])
  return debounced
}

export function useLanguages() {
  const [data, setData] = useState<LanguagesResponse | null>(
    () => languagesCache,
  )
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(() => !languagesCache)

  useEffect(() => {
    if (languagesCache) return
    let active = true
    void (async () => {
      try {
        const res = await getLanguagesOnce()
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
