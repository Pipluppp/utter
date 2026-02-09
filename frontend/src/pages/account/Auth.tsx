import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Label } from '../../components/ui/Label'
import { Message } from '../../components/ui/Message'
import { cn } from '../../lib/cn'
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

type AuthMode = 'magic_link' | 'password'
type PasswordIntent = 'sign_in' | 'sign_up'

export function AccountAuthPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()

  const supabaseClient = supabase
  const configured = Boolean(supabaseClient) && isSupabaseConfigured()

  const returnTo = (params.get('returnTo') ?? '').trim()
  const safeReturnTo = useMemo(() => {
    if (!returnTo) return '/clone'
    if (!returnTo.startsWith('/')) return '/clone'
    return returnTo
  }, [returnTo])

  const [mode, setMode] = useState<AuthMode>('password')
  const [intent, setIntent] = useState<PasswordIntent>('sign_in')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [status, setStatus] = useState<
    | { type: 'idle' }
    | { type: 'sent' }
    | { type: 'loading'; label: string }
    | { type: 'error'; message: string }
    | { type: 'ok'; message: string }
  >({ type: 'idle' })

  const [authEmail, setAuthEmail] = useState<string>('')
  const isLocalHost = useMemo(() => {
    const host = window.location.hostname
    return host === 'localhost' || host === '127.0.0.1'
  }, [])

  useEffect(() => {
    const client = supabase
    if (!client) return
    void (async () => {
      const { data, error } = await client.auth.getUser()
      if (error) return
      setAuthEmail(data.user?.email ?? '')
    })()

    const { data } = client.auth.onAuthStateChange(() => {
      void (async () => {
        const { data: u, error } = await client.auth.getUser()
        if (error) return
        setAuthEmail(u.user?.email ?? '')
      })()
    })
    return () => data.subscription.unsubscribe()
  }, [])

  async function onSendMagicLink() {
    if (!supabaseClient) return
    const normalizedEmail = email.trim()
    if (!normalizedEmail) {
      setStatus({ type: 'error', message: 'Email is required.' })
      return
    }

    setStatus({ type: 'loading', label: 'Sending magic link…' })
    const { error } = await supabaseClient.auth.signInWithOtp({
      email: normalizedEmail,
      options: { emailRedirectTo: `${window.location.origin}${safeReturnTo}` },
    })
    if (error) {
      setStatus({ type: 'error', message: error.message })
      return
    }

    setStatus({ type: 'sent' })
  }

  async function onPasswordSubmit() {
    if (!supabaseClient) return
    const normalizedEmail = email.trim()
    if (!normalizedEmail) {
      setStatus({ type: 'error', message: 'Email is required.' })
      return
    }
    if (!password) {
      setStatus({ type: 'error', message: 'Password is required.' })
      return
    }
    if (password.length < 6) {
      setStatus({ type: 'error', message: 'Password must be 6+ characters.' })
      return
    }

    setStatus({
      type: 'loading',
      label: intent === 'sign_in' ? 'Signing in…' : 'Creating account…',
    })

    if (intent === 'sign_in') {
      const { error } = await supabaseClient.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      })
      if (error) {
        setStatus({ type: 'error', message: error.message })
        return
      }
      setStatus({ type: 'ok', message: 'Signed in.' })
      navigate(safeReturnTo, { replace: true })
      return
    }

    const { error } = await supabaseClient.auth.signUp({
      email: normalizedEmail,
      password,
      options: { emailRedirectTo: `${window.location.origin}${safeReturnTo}` },
    })
    if (error) {
      setStatus({ type: 'error', message: error.message })
      return
    }

    setStatus({
      type: 'ok',
      message:
        'Account created. If email confirmation is enabled, check Inbucket.',
    })
    navigate(safeReturnTo, { replace: true })
  }

  async function onSignOut() {
    if (!supabaseClient) return
    setStatus({ type: 'loading', label: 'Signing out…' })
    const { error } = await supabaseClient.auth.signOut()
    if (error) {
      setStatus({ type: 'error', message: error.message })
      return
    }
    setStatus({ type: 'ok', message: 'Signed out.' })
  }

  const isSignedIn = Boolean(authEmail)
  const busy = status.type === 'loading'

  return (
    <div className="space-y-4">
      {!configured ? (
        <Message variant="info">
          Supabase Auth isn’t configured yet. Set `VITE_SUPABASE_URL` and
          `VITE_SUPABASE_ANON_KEY` (see `frontend/.env.example`).
        </Message>
      ) : null}

      <Card title="Session">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-semibold uppercase tracking-wide">
              {isSignedIn ? 'Signed in' : 'Signed out'}
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              {isSignedIn ? authEmail : 'Sign in to use Clone, Generate, etc.'}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isSignedIn ? (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => navigate('/account/profile')}
                >
                  Profile
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={onSignOut}
                  disabled={!configured || busy}
                >
                  Sign out
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => navigate('/')}
              >
                Back to landing
              </Button>
            )}
          </div>
        </div>

        {!isSignedIn ? (
          <div className="mt-4 text-xs text-faint">
            Return after sign-in:{' '}
            <span className="text-foreground">
              {returnTo || location.pathname}
            </span>
          </div>
        ) : null}
      </Card>

      {!isSignedIn ? (
        <Card title="Sign in">
          {status.type === 'error' ? (
            <Message variant="error">{status.message}</Message>
          ) : null}
          {status.type === 'ok' ? (
            <Message variant="success">{status.message}</Message>
          ) : null}
          {status.type === 'sent' ? (
            <Message variant="success">
              Magic link sent. Open Inbucket and click the link.
            </Message>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={cn(
                'border border-border px-3 py-2 text-[12px] font-medium uppercase tracking-wide shadow-elevated',
                'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                mode === 'password'
                  ? 'bg-foreground text-background'
                  : 'bg-background text-foreground hover:bg-subtle',
              )}
              onClick={() => {
                setMode('password')
                setStatus({ type: 'idle' })
              }}
              disabled={!configured || busy}
            >
              Password
            </button>
            <button
              type="button"
              className={cn(
                'border border-border px-3 py-2 text-[12px] font-medium uppercase tracking-wide shadow-elevated',
                'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                mode === 'magic_link'
                  ? 'bg-foreground text-background'
                  : 'bg-background text-foreground hover:bg-subtle',
              )}
              onClick={() => {
                setMode('magic_link')
                setStatus({ type: 'idle' })
              }}
              disabled={!configured || busy}
            >
              Magic link
            </button>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="auth-email">Email</Label>
              <Input
                id="auth-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                disabled={!configured || busy}
              />
            </div>

            {mode === 'password' ? (
              <div className="space-y-1.5">
                <Label htmlFor="auth-password">Password</Label>
                <Input
                  id="auth-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete={
                    intent === 'sign_in' ? 'current-password' : 'new-password'
                  }
                  disabled={!configured || busy}
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>Inbox</Label>
                <div className="border border-border bg-subtle p-3 text-sm text-muted-foreground shadow-elevated">
                  {isLocalHost ? (
                    <a
                      href="http://localhost:54324"
                      target="_blank"
                      rel="noreferrer"
                      className="underline underline-offset-4 hover:text-foreground"
                    >
                      Open Inbucket → http://localhost:54324
                    </a>
                  ) : (
                    'Open your email to continue.'
                  )}
                </div>
              </div>
            )}
          </div>

          {mode === 'password' ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIntent('sign_in')}
                disabled={!configured || busy}
                aria-pressed={intent === 'sign_in'}
              >
                Sign in
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIntent('sign_up')}
                disabled={!configured || busy}
                aria-pressed={intent === 'sign_up'}
              >
                Sign up
              </Button>
              <div className="text-xs text-faint">
                {intent === 'sign_in'
                  ? 'Use an existing account.'
                  : 'Creates a new account.'}
              </div>
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={() => {
                if (mode === 'magic_link') void onSendMagicLink()
                else void onPasswordSubmit()
              }}
              disabled={!configured || busy}
              loading={status.type === 'loading'}
            >
              {mode === 'magic_link'
                ? 'Send magic link'
                : intent === 'sign_in'
                  ? 'Sign in'
                  : 'Create account'}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setEmail('')
                setPassword('')
                setStatus({ type: 'idle' })
              }}
              disabled={busy}
            >
              Clear
            </Button>
          </div>
        </Card>
      ) : null}
    </div>
  )
}
