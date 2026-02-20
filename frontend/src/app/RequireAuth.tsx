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
    const syncSignedIn = async () => {
      const { data: sessionData } = await client.auth
        .getSession()
        .catch(() => ({ data: { session: null } }))
      if (cancelled) return

      if (!sessionData.session) {
        setSignedIn(false)
        setLoading(false)
        return
      }

      // Validate the token server-side so stale local sessions don't pass.
      const { data: userData, error: userError } = await client.auth
        .getUser()
        .catch(() => ({
          data: { user: null },
          error: new Error('auth check failed'),
        }))

      if (cancelled) return
      setSignedIn(Boolean(userData?.user) && !userError)
      setLoading(false)
    }

    void syncSignedIn()

    const { data } = client.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return
      if (!session) {
        setSignedIn(false)
        return
      }
      setLoading(true)
      void syncSignedIn()
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
    return <Navigate to={`/auth?returnTo=${returnTo}`} replace />
  }

  return children
}
