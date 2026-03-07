import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthState } from './auth/AuthStateProvider'
import { buildAuthHref, buildReturnTo } from './navigation'

export function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation()
  const authState = useAuthState()
  const returnTo = buildReturnTo(location)

  if (authState.status === 'loading') {
    return (
      <div className="py-10 text-center text-sm text-muted-foreground">
        Checking session...
      </div>
    )
  }

  if (authState.status !== 'signed_in') {
    return <Navigate to={buildAuthHref(returnTo)} replace />
  }

  return children
}
