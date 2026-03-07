import type { Location, To } from 'react-router-dom'
import type { AuthStatus } from './auth/AuthStateProvider'

export type RouteFamily = 'marketing' | 'auth' | 'app'

export type NavVariant =
  | 'marketing_public'
  | 'marketing_member'
  | 'app_member'
  | 'auth_minimal'
  | 'app_pending_auth'

export function getNavVariant(
  routeFamily: RouteFamily,
  authStatus: AuthStatus,
): NavVariant {
  if (routeFamily === 'auth') {
    return 'auth_minimal'
  }

  if (routeFamily === 'app') {
    return authStatus === 'signed_in' ? 'app_member' : 'app_pending_auth'
  }

  return authStatus === 'signed_in' ? 'marketing_member' : 'marketing_public'
}

export function buildReturnTo(
  location: Pick<Location, 'pathname' | 'search' | 'hash'>,
) {
  return `${location.pathname}${location.search}${location.hash}`
}

export function getSafeReturnTo(returnTo: string | null | undefined) {
  const candidate = (returnTo ?? '').trim()
  if (!candidate.startsWith('/')) {
    return '/'
  }
  return candidate || '/'
}

export function buildAuthHref(
  returnTo: string,
  intent: 'sign_in' | 'sign_up' = 'sign_in',
) {
  const params = new URLSearchParams({ returnTo: getSafeReturnTo(returnTo) })
  if (intent === 'sign_up') {
    params.set('intent', intent)
  }
  return `/auth?${params.toString()}`
}

export type MarketingHash = '#demos' | '#features' | '#pricing'

export type NavSectionItem =
  | {
      kind: 'route'
      label: string
      to: To
      shortcut?: string
      showTaskBadge?: boolean
      showProfileIcon?: boolean
    }
  | {
      kind: 'hash'
      label: string
      hash: MarketingHash
    }
