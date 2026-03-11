import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthState } from '../app/auth/AuthStateProvider'
import { getSafeReturnTo } from '../app/navigation'
import { Button } from '../components/ui/Button'
import { GridArt } from '../components/ui/GridArt'
import { Input } from '../components/ui/Input'
import { Label } from '../components/ui/Label'
import { Message } from '../components/ui/Message'
import { cn } from '../lib/cn'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

type AuthMode = 'magic_link' | 'password'
type PasswordIntent = 'sign_in' | 'sign_up'

export function AuthPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const authState = useAuthState()

  const supabaseClient = supabase
  const configured = Boolean(supabaseClient) && isSupabaseConfigured()

  const returnTo = (params.get('returnTo') ?? '').trim()
  const initialIntent: PasswordIntent =
    params.get('intent') === 'sign_up' ? 'sign_up' : 'sign_in'
  const safeReturnTo = useMemo(() => getSafeReturnTo(returnTo), [returnTo])

  const [mode, setMode] = useState<AuthMode>('password')
  const [intent, setIntent] = useState<PasswordIntent>(initialIntent)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<
    | { type: 'idle' }
    | { type: 'sent' }
    | { type: 'loading'; label: string }
    | { type: 'error'; message: string }
    | { type: 'ok'; message: string }
  >({ type: 'idle' })
  const isLocalHost = useMemo(() => {
    const host = window.location.hostname
    return host === 'localhost' || host === '127.0.0.1'
  }, [])

  useEffect(() => {
    if (authState.status === 'signed_in') {
      navigate(safeReturnTo, { replace: true })
    }
  }, [authState.status, navigate, safeReturnTo])

  async function onSendMagicLink() {
    if (!supabaseClient) return

    const normalizedEmail = email.trim()
    if (!normalizedEmail) {
      setStatus({ type: 'error', message: 'Email is required.' })
      return
    }

    setStatus({ type: 'loading', label: 'Sending magic link...' })
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
      label: intent === 'sign_in' ? 'Signing in...' : 'Creating account...',
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
        'Account created. If email confirmation is enabled, check your inbox.',
    })
    navigate(safeReturnTo, { replace: true })
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (mode === 'magic_link') {
      void onSendMagicLink()
      return
    }
    void onPasswordSubmit()
  }

  const busy = status.type === 'loading'

  return (
    <div className="flex min-h-full w-full bg-background">
      <div className="relative flex w-full flex-col justify-between overflow-y-auto px-6 py-8 sm:px-12 lg:w-1/2 lg:px-20">
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <div>
            <h1 className="font-pixel text-2xl uppercase tracking-[2px]">
              {intent === 'sign_in' ? 'Sign in' : 'Create account'}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {intent === 'sign_in'
                ? 'Welcome back. Sign in to continue.'
                : 'Get started with Utter.'}
            </p>
          </div>

          {!configured ? (
            <div className="mt-6">
              <Message variant="info">
                Supabase Auth isn't configured. Set VITE_SUPABASE_URL and
                VITE_SUPABASE_ANON_KEY.
              </Message>
            </div>
          ) : null}

          <div className="mt-8 flex gap-0 border border-border">
            <button
              type="button"
              className={cn(
                'flex-1 px-4 py-2.5 text-[12px] font-medium uppercase tracking-wide transition-colors',
                mode === 'password'
                  ? 'bg-foreground text-background'
                  : 'bg-background text-muted-foreground hover:text-foreground',
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
                'flex-1 border-l border-border px-4 py-2.5 text-[12px] font-medium uppercase tracking-wide transition-colors',
                mode === 'magic_link'
                  ? 'bg-foreground text-background'
                  : 'bg-background text-muted-foreground hover:text-foreground',
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

          {status.type === 'error' ? (
            <div className="mt-4">
              <Message variant="error">{status.message}</Message>
            </div>
          ) : null}
          {status.type === 'ok' ? (
            <div className="mt-4">
              <Message variant="success">{status.message}</Message>
            </div>
          ) : null}
          {status.type === 'sent' ? (
            <div className="mt-4">
              <Message variant="success">
                Magic link sent - check your{' '}
                {isLocalHost ? (
                  <a
                    href="http://localhost:55424"
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-4 hover:text-foreground"
                  >
                    Inbucket inbox
                  </a>
                ) : (
                  'email'
                )}
                .
              </Message>
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="auth-email">Email</Label>
              <Input
                id="auth-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                disabled={!configured || busy}
                autoFocus
              />
            </div>

            {mode === 'password' ? (
              <div className="space-y-1.5">
                <Label htmlFor="auth-password">Password</Label>
                <Input
                  id="auth-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="6+ characters"
                  autoComplete={
                    intent === 'sign_in' ? 'current-password' : 'new-password'
                  }
                  disabled={!configured || busy}
                />
              </div>
            ) : null}

            <Button
              type="submit"
              block
              disabled={!configured || busy}
              loading={busy}
            >
              {mode === 'magic_link'
                ? 'Send magic link'
                : intent === 'sign_in'
                  ? 'Sign in'
                  : 'Create account'}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            {intent === 'sign_in' ? (
              <>
                Don't have an account?{' '}
                <button
                  type="button"
                  className="text-foreground underline underline-offset-4 hover:opacity-70"
                  onClick={() => setIntent('sign_up')}
                >
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button
                  type="button"
                  className="text-foreground underline underline-offset-4 hover:opacity-70"
                  onClick={() => setIntent('sign_in')}
                >
                  Sign in
                </button>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-faint">
          <div className="flex gap-4">
            <Link to="/terms" className="hover:text-foreground">
              Terms
            </Link>
            <Link to="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
          </div>
          {returnTo ? (
            <span className="text-faint">
              Redirecting to{' '}
              <span className="text-muted-foreground">{safeReturnTo}</span>
            </span>
          ) : null}
        </div>
      </div>

      <div className="hidden border-l border-border bg-subtle lg:block lg:w-1/2">
        <div className="relative h-full w-full overflow-hidden">
          <GridArt />
          <div className="absolute bottom-12 left-12 right-12">
            <p className="font-pixel text-sm uppercase tracking-[3px] text-foreground/30">
              Clone voices. Design new ones. Generate speech.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
