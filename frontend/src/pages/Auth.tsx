import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Label } from '../components/ui/Label'
import { Message } from '../components/ui/Message'
import { cn } from '../lib/cn'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

type AuthMode = 'magic_link' | 'password'
type PasswordIntent = 'sign_in' | 'sign_up'

/**
 * Grid pattern SVG for the decorative right panel.
 * Renders a subtle pixel-grid with scattered highlighted cells.
 */
function GridArt() {
  const cellSize = 18
  const cols = 28
  const rows = 32
  const w = cols * cellSize
  const h = rows * cellSize

  // Deterministic "random" highlighted cells for visual interest
  const highlighted = useMemo(() => {
    const cells: { x: number; y: number; opacity: number }[] = []
    // Use a simple seed-based approach for consistent rendering
    const seed = [
      [3, 2],
      [7, 5],
      [12, 1],
      [18, 4],
      [22, 7],
      [5, 10],
      [15, 12],
      [20, 9],
      [8, 15],
      [25, 11],
      [2, 18],
      [10, 20],
      [17, 16],
      [23, 19],
      [6, 22],
      [14, 24],
      [21, 21],
      [26, 14],
      [4, 26],
      [11, 28],
      [19, 25],
      [9, 30],
      [16, 27],
      [24, 23],
      [1, 8],
      [13, 6],
      [27, 3],
      [20, 30],
      [3, 14],
      [8, 24],
      [22, 17],
      [15, 8],
      [6, 29],
      [25, 26],
      [11, 13],
      [18, 22],
      [2, 5],
      [26, 9],
      [9, 17],
      [14, 3],
    ]
    // Exclusion zone: UTTER letters (cols 4–24, rows 13–18) plus 1-cell buffer
    const isNearText = (cx: number, cy: number) =>
      cx >= 3 && cx <= 25 && cy >= 12 && cy <= 19
    for (const [x, y] of seed) {
      if (x < cols && y < rows && !isNearText(x, y)) {
        cells.push({
          x,
          y,
          opacity: 0.08 + (((x * 7 + y * 13) % 10) / 10) * 0.15,
        })
      }
    }
    return cells
  }, [])

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="h-full w-full"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <title>Decorative grid background</title>
      {/* Grid lines */}
      {Array.from({ length: cols + 1 }, (_, col) => col).map((col) => (
        <line
          key={`v${col}`}
          x1={col * cellSize}
          y1={0}
          x2={col * cellSize}
          y2={h}
          className="stroke-foreground/[0.06]"
          strokeWidth={1}
        />
      ))}
      {Array.from({ length: rows + 1 }, (_, row) => row).map((row) => (
        <line
          key={`h${row}`}
          x1={0}
          y1={row * cellSize}
          x2={w}
          y2={row * cellSize}
          className="stroke-foreground/[0.06]"
          strokeWidth={1}
        />
      ))}
      {/* Highlighted cells */}
      {highlighted.map(({ x, y, opacity }) => (
        <rect
          key={`${x}-${y}`}
          x={x * cellSize + 1}
          y={y * cellSize + 1}
          width={cellSize - 2}
          height={cellSize - 2}
          className="fill-foreground"
          opacity={opacity}
        />
      ))}
      {/* Brand accent — UTTER centered in grid */}
      <g className="fill-foreground" opacity={0.12}>
        {/* U */}
        <rect
          x={4 * cellSize}
          y={13 * cellSize}
          width={cellSize}
          height={cellSize * 4}
        />
        <rect
          x={5 * cellSize}
          y={17 * cellSize}
          width={cellSize * 2}
          height={cellSize}
        />
        <rect
          x={7 * cellSize}
          y={13 * cellSize}
          width={cellSize}
          height={cellSize * 4}
        />
        {/* T */}
        <rect
          x={9 * cellSize}
          y={13 * cellSize}
          width={cellSize * 3}
          height={cellSize}
        />
        <rect
          x={10 * cellSize}
          y={14 * cellSize}
          width={cellSize}
          height={cellSize * 4}
        />
        {/* T */}
        <rect
          x={13 * cellSize}
          y={13 * cellSize}
          width={cellSize * 3}
          height={cellSize}
        />
        <rect
          x={14 * cellSize}
          y={14 * cellSize}
          width={cellSize}
          height={cellSize * 4}
        />
        {/* E */}
        <rect
          x={17 * cellSize}
          y={13 * cellSize}
          width={cellSize * 3}
          height={cellSize}
        />
        <rect
          x={17 * cellSize}
          y={14 * cellSize}
          width={cellSize}
          height={cellSize * 4}
        />
        <rect
          x={17 * cellSize}
          y={15 * cellSize}
          width={cellSize * 2}
          height={cellSize}
        />
        <rect
          x={17 * cellSize}
          y={17 * cellSize}
          width={cellSize * 3}
          height={cellSize}
        />
        {/* R */}
        <rect
          x={21 * cellSize}
          y={13 * cellSize}
          width={cellSize}
          height={cellSize * 5}
        />
        <rect
          x={21 * cellSize}
          y={13 * cellSize}
          width={cellSize * 3}
          height={cellSize}
        />
        <rect
          x={23 * cellSize}
          y={14 * cellSize}
          width={cellSize}
          height={cellSize}
        />
        <rect
          x={21 * cellSize}
          y={15 * cellSize}
          width={cellSize * 3}
          height={cellSize}
        />
        <rect
          x={23 * cellSize}
          y={16 * cellSize}
          width={cellSize}
          height={cellSize * 2}
        />
      </g>
    </svg>
  )
}

export function AuthPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const supabaseClient = supabase
  const configured = Boolean(supabaseClient) && isSupabaseConfigured()

  const returnTo = (params.get('returnTo') ?? '').trim()
  const initialIntent: PasswordIntent =
    params.get('intent') === 'sign_up' ? 'sign_up' : 'sign_in'

  const safeReturnTo = useMemo(() => {
    if (!returnTo) return '/clone'
    if (!returnTo.startsWith('/')) return '/clone'
    return returnTo
  }, [returnTo])

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

  // If already signed in, redirect to destination
  useEffect(() => {
    if (authEmail) {
      navigate(safeReturnTo, { replace: true })
    }
  }, [authEmail, safeReturnTo, navigate])

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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (mode === 'magic_link') void onSendMagicLink()
    else void onPasswordSubmit()
  }

  const busy = status.type === 'loading'

  return (
    <div className="fixed inset-0 z-50 flex bg-background">
      {/* Left panel — auth form */}
      <div className="relative flex w-full flex-col justify-between overflow-y-auto px-6 py-8 sm:px-12 lg:w-1/2 lg:px-20">
        {/* Top: Logo + nav home */}
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="font-pixel text-lg uppercase tracking-[3px] text-foreground hover:opacity-70"
          >
            Utter
          </Link>
          <Link
            to="/"
            className="text-[12px] uppercase tracking-wide text-muted-foreground hover:text-foreground"
          >
            Back to home
          </Link>
        </div>

        {/* Center: form area */}
        <div className="mx-auto w-full max-w-sm flex-1 flex flex-col justify-center py-12">
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

          {/* Mode toggle */}
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

          {/* Status messages */}
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
                Magic link sent — check your{' '}
                {isLocalHost ? (
                  <a
                    href="http://localhost:54324"
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

          {/* Form */}
          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="auth-email">Email</Label>
              <Input
                id="auth-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
                  onChange={(e) => setPassword(e.target.value)}
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

          {/* Intent toggle */}
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

        {/* Bottom: links */}
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
              <span className="text-muted-foreground">
                {decodeURIComponent(returnTo)}
              </span>
            </span>
          ) : null}
        </div>
      </div>

      {/* Right panel — decorative grid art */}
      <div className="hidden lg:block lg:w-1/2 bg-subtle border-l border-border">
        <div className="relative h-full w-full overflow-hidden">
          <GridArt />
          {/* Floating tagline */}
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
