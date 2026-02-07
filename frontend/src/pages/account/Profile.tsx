import { type ReactNode, useCallback, useEffect, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Label } from '../../components/ui/Label'
import { ApiError, apiJson } from '../../lib/api'
import { isSupabaseConfigured, supabase } from '../../lib/supabase'

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border border-border bg-background p-5 shadow-elevated">
      <div className="text-[12px] font-semibold uppercase tracking-wide">
        {title}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}

type ProfileShape = {
  id: string
  handle: string | null
  display_name: string | null
  avatar_url: string | null
}

type MeResponse = {
  signed_in: boolean
  user: { id: string } | null
  profile: ProfileShape | null
}

export function AccountProfilePage() {
  const supabaseClient = supabase
  const supabaseConfigured = Boolean(supabaseClient) && isSupabaseConfigured()

  const [loading, setLoading] = useState(true)
  const [me, setMe] = useState<MeResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [authEmail, setAuthEmail] = useState<string>('')
  const [email, setEmail] = useState('')
  const [otpSent, setOtpSent] = useState(false)

  const [displayName, setDisplayName] = useState('')
  const [handle, setHandle] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [saving, setSaving] = useState(false)

  const refreshAuth = useCallback(async () => {
    if (!supabaseClient) return
    const { data, error: userError } = await supabaseClient.auth.getUser()
    if (userError) return
    setAuthEmail(data.user?.email ?? '')
  }, [])

  const refreshMe = useCallback(async () => {
    setError(null)
    try {
      const data = await apiJson<MeResponse>('/api/me')
      setMe(data)
      setDisplayName(data.profile?.display_name ?? '')
      setHandle(data.profile?.handle ?? '')
      setAvatarUrl(data.profile?.avatar_url ?? '')
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message)
      } else {
        setError('Failed to load profile.')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!supabaseClient) {
      setLoading(false)
      return
    }

    void refreshAuth()
    void refreshMe()
    const { data } = supabaseClient.auth.onAuthStateChange(() => {
      void refreshAuth()
      void refreshMe()
    })
    return () => {
      data.subscription.unsubscribe()
    }
  }, [refreshAuth, refreshMe])

  async function onSendMagicLink() {
    if (!supabaseClient) return
    const normalizedEmail = email.trim()
    if (!normalizedEmail) {
      setError('Email is required.')
      return
    }

    setError(null)
    const { error: signInError } = await supabaseClient.auth.signInWithOtp({
      email: normalizedEmail,
      options: { emailRedirectTo: window.location.href },
    })
    if (signInError) {
      setError(signInError.message)
      return
    }

    setOtpSent(true)
  }

  async function onSignOut() {
    if (!supabaseClient) return
    setError(null)
    const { error: signOutError } = await supabaseClient.auth.signOut()
    if (signOutError) setError(signOutError.message)
  }

  async function onSave() {
    setSaving(true)
    setError(null)
    try {
      const res = await apiJson<{ profile: ProfileShape }>('/api/profile', {
        method: 'PATCH',
        json: {
          display_name: displayName,
          handle,
          avatar_url: avatarUrl,
        },
      })
      setMe((prev) =>
        prev
          ? { ...prev, signed_in: true, profile: res.profile }
          : { signed_in: true, user: null, profile: res.profile },
      )
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message)
      } else {
        setError('Failed to save profile.')
      }
    } finally {
      setSaving(false)
    }
  }

  const isSignedIn = Boolean(me?.signed_in)

  return (
    <div className="space-y-4">
      {!supabaseConfigured ? (
        <section className="border border-border bg-subtle p-4 text-sm text-muted-foreground shadow-elevated">
          Supabase Auth isn’t configured yet. Set `VITE_SUPABASE_URL` and
          `VITE_SUPABASE_ANON_KEY` in a local env file (see
          `frontend/.env.example`).
        </section>
      ) : null}

      {error ? (
        <section className="border border-border bg-subtle p-4 text-sm text-red-600 shadow-elevated">
          {error}
        </section>
      ) : null}

      <Card title="Identity">
        <div className="flex flex-col gap-4 md:flex-row md:items-start">
          <div className="flex items-center gap-4">
            <div className="grid size-14 place-items-center rounded-full border border-border bg-subtle text-sm font-semibold">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt=""
                  className="size-14 rounded-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                '—'
              )}
            </div>
            <div>
              <div className="text-sm font-semibold uppercase tracking-wide">
                {loading ? 'Loading…' : isSignedIn ? 'Signed in' : 'Signed out'}
              </div>
              <div className="text-sm text-muted-foreground">
                {isSignedIn
                  ? (me?.user?.id ?? '—')
                  : 'Connect an account to edit'}
              </div>
            </div>
          </div>

          <div className="grid flex-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="display_name">Display name</Label>
              <Input
                id="display_name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="—"
                disabled={!isSignedIn || saving}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={isSignedIn ? authEmail || '—' : email}
                placeholder="you@example.com"
                disabled={!supabaseConfigured || isSignedIn}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="handle">Handle</Label>
              <Input
                id="handle"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="e.g. duncan_01"
                disabled={!isSignedIn || saving}
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="avatar_url">Avatar URL</Label>
              <Input
                id="avatar_url"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://…"
                disabled={!isSignedIn || saving}
              />
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {!isSignedIn ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={onSendMagicLink}
              disabled={!supabaseConfigured || otpSent}
            >
              {otpSent ? 'Magic link sent' : 'Send magic link'}
            </Button>
          ) : (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={onSave}
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={onSignOut}
                disabled={saving}
              >
                Sign out
              </Button>
            </>
          )}
        </div>
      </Card>

      <Card title="Preferences">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="default_format">Default export</Label>
            <Input id="default_format" defaultValue="WAV" disabled />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="default_language">Default language</Label>
            <Input id="default_language" defaultValue="Auto" disabled />
          </div>
        </div>
      </Card>

      <Card title="Danger zone">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" disabled={!isSignedIn}>
            Delete account
          </Button>
        </div>
      </Card>
    </div>
  )
}
