import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { getCreditPackById } from '../../content/plans'
import { apiJson } from '../../lib/api'
import { supabase } from '../../lib/supabase'
import type {
  CreditLedgerEvent,
  CreditsUsageResponse,
  MeResponse,
  ProfileRecord,
} from '../../lib/types'

const creditsFormat = new Intl.NumberFormat()
const usdFormat = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const dateFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
})
const dateTimeFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
})

export type AccountActivityCategory = 'purchase' | 'usage'

export type AccountActivity = {
  id: number
  category: AccountActivityCategory
  title: string
  detail: string
  amountLabel: string
  balanceLabel: string
  createdLabel: string
  createdAt: string
  raw: CreditLedgerEvent
}

export type AccountFormValues = {
  displayName: string
}

export type AccountData = {
  authEmail: string
  me: MeResponse | null
  credits: CreditsUsageResponse | null
  profile: ProfileRecord | null
  activity: AccountActivity[]
  loading: boolean
  refreshing: boolean
  error: string | null
  refresh: (options?: { background?: boolean }) => Promise<void>
  saveProfile: (values: AccountFormValues) => Promise<ProfileRecord>
  signOut: () => Promise<void>
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return fallback
}

function emptyToNull(value: string) {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

async function loadAuthEmail() {
  if (!supabase) {
    throw new Error('Supabase Auth is not configured.')
  }

  const { data, error } = await supabase.auth.getUser()
  if (error) {
    throw new Error(error.message)
  }

  return data.user?.email ?? ''
}

async function loadAccountSnapshot() {
  const [me, credits, authEmail] = await Promise.all([
    apiJson<MeResponse>('/api/me'),
    apiJson<CreditsUsageResponse>('/api/credits/usage?window_days=90'),
    loadAuthEmail(),
  ])

  return { me, credits, authEmail }
}

function packFromEvent(event: CreditLedgerEvent) {
  const packId =
    typeof event.metadata.pack_id === 'string' ? event.metadata.pack_id : null
  return packId ? getCreditPackById(packId) : null
}

function categoryForEvent(event: CreditLedgerEvent): AccountActivityCategory {
  if (
    event.operation === 'paid_purchase' ||
    event.operation === 'paid_reversal'
  ) {
    return 'purchase'
  }

  return 'usage'
}

function eventTitle(event: CreditLedgerEvent) {
  const pack = packFromEvent(event)

  switch (event.operation) {
    case 'generate':
      return 'Generated speech'
    case 'design_preview':
      return event.amount > 0 ? 'Used design preview' : 'Used design trial'
    case 'clone':
      return event.amount > 0 ? 'Finalized voice clone' : 'Used clone trial'
    case 'monthly_allocation':
      return 'Received starting credits'
    case 'manual_adjustment':
      return event.signed_amount >= 0 ? 'Credits added' : 'Credits removed'
    case 'paid_purchase':
      return pack ? `Bought ${pack.name}` : 'Bought credits'
    case 'paid_reversal':
      return 'Purchase reversed'
    default:
      return 'Balance updated'
  }
}

function signedCreditsLabel(event: CreditLedgerEvent) {
  if (event.signed_amount === 0) {
    return '0 credits'
  }

  const prefix = event.signed_amount > 0 ? '+' : '-'
  return `${prefix}${creditsFormat.format(Math.abs(event.signed_amount))} credits`
}

function eventDetail(event: CreditLedgerEvent) {
  const pack = packFromEvent(event)
  const credits = `${creditsFormat.format(event.amount)} credits`

  switch (event.operation) {
    case 'generate':
      return `${credits} used from submitted text length.`
    case 'design_preview':
      return event.amount > 0
        ? `${credits} used for voice design preview.`
        : 'Covered by a free design trial.'
    case 'clone':
      return event.amount > 0
        ? `${credits} used to finalize a voice clone.`
        : 'Covered by a free clone trial.'
    case 'monthly_allocation':
      return `${credits} added to your starting balance.`
    case 'manual_adjustment':
      return event.signed_amount >= 0
        ? `${credits} added after a manual adjustment.`
        : `${credits} removed after a manual adjustment.`
    case 'paid_purchase':
      return pack
        ? `${usdFormat.format(pack.priceUsd)} prepaid pack with ${credits}.`
        : `${credits} added from a prepaid purchase.`
    case 'paid_reversal':
      return `${credits} removed from a reversed purchase.`
    default:
      return `Balance changed by ${signedCreditsLabel(event)}.`
  }
}

export function formatCredits(value: number) {
  return creditsFormat.format(value)
}

export function formatUsd(value: number) {
  return usdFormat.format(value)
}

export function formatDate(value: string | null | undefined) {
  if (!value) return 'Unavailable'
  return dateFormat.format(new Date(value))
}

export function formatDateTime(value: string) {
  return dateTimeFormat.format(new Date(value))
}

export function buildAccountActivity(
  event: CreditLedgerEvent,
): AccountActivity {
  return {
    id: event.id,
    category: categoryForEvent(event),
    title: eventTitle(event),
    detail: eventDetail(event),
    amountLabel: signedCreditsLabel(event),
    balanceLabel: `${formatCredits(event.balance_after)} credits left`,
    createdLabel: formatDateTime(event.created_at),
    createdAt: event.created_at,
    raw: event,
  }
}

export function useAccountData(): AccountData {
  const [authEmail, setAuthEmail] = useState('')
  const [me, setMe] = useState<MeResponse | null>(null)
  const [credits, setCredits] = useState<CreditsUsageResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async (options?: { background?: boolean }) => {
    const background = options?.background ?? false

    if (background) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    try {
      const snapshot = await loadAccountSnapshot()
      setMe(snapshot.me)
      setCredits(snapshot.credits)
      setAuthEmail(snapshot.authEmail)
      setError(null)
    } catch (error) {
      setError(errorMessage(error, 'Failed to load account details.'))
    } finally {
      if (background) {
        setRefreshing(false)
      } else {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const saveProfile = useCallback(async (values: AccountFormValues) => {
    const response = await apiJson<{ profile: ProfileRecord }>('/api/profile', {
      method: 'PATCH',
      json: {
        display_name: emptyToNull(values.displayName),
      },
    })

    setMe((current) => ({
      signed_in: true,
      user: current?.user ?? { id: response.profile.id },
      profile: response.profile,
    }))

    return response.profile
  }, [])

  const signOut = useCallback(async () => {
    if (!supabase) {
      throw new Error('Supabase Auth is not configured.')
    }

    const { error } = await supabase.auth.signOut()
    if (error) {
      throw new Error(error.message)
    }

    setAuthEmail('')
    setMe(null)
    setCredits(null)
  }, [])

  const activity = useMemo(
    () => (credits?.events ?? []).map((event) => buildAccountActivity(event)),
    [credits],
  )

  return {
    authEmail,
    me,
    credits,
    profile: me?.profile ?? null,
    activity,
    loading,
    refreshing,
    error,
    refresh,
    saveProfile,
    signOut,
  }
}

export function useAccountPageData() {
  return useOutletContext<AccountData>()
}
