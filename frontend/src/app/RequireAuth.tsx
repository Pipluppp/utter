import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation()
  const [loading, setLoading] = useState(true)
  const [signedIn, setSignedIn] = useState(false)

  const returnTo = useMemo(() => {
    const path = `${location.pathname}${location.search}${location.hash}`
    return encodeURIComponent(path)
  }, [location.hash, location.pathname, location.search])

  useEffect(() => {
    const client = supabase
    if (!client) {
      setSignedIn(false)
      setLoading(false)
      return
    }

    let cancelled = false
    void (async () => {
      const { data } = await client.auth
        .getSession()
        .catch(() => ({ data: null }))
      if (cancelled) return
      setSignedIn(Boolean(data?.session))
      setLoading(false)
    })()

    const { data } = client.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return
      setSignedIn(Boolean(session))
    })

    return () => {
      cancelled = true
      data.subscription.unsubscribe()
    }
  }, [])

  if (loading) {
    return (
      <div className="py-10 text-center text-sm text-muted-foreground">
        Checking session…
      </div>
    )
  }

  if (!signedIn) {
    return <Navigate to={`/account/auth?returnTo=${returnTo}`} replace />
  }

  return children
}
