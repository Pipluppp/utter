import { Suspense, useEffect, useState } from 'react'
import { Link, NavLink, Outlet, type To, useLocation } from 'react-router-dom'
import { TaskBadge } from '../components/tasks/TaskBadge'
import { TaskDock } from '../components/tasks/TaskDock'
import { Kbd } from '../components/ui/Kbd'
import { cn } from '../lib/cn'
import { supabase } from '../lib/supabase'
import { AppFooter } from './Footer'
import { useTheme } from './theme/ThemeProvider'
import { useGlobalShortcuts } from './useGlobalShortcuts'

const APP_PATHS = new Set([
  '/clone',
  '/generate',
  '/design',
  '/voices',
  '/history',
])

function ProfileIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M5.5 21a6.5 6.5 0 0 1 13 0" />
    </svg>
  )
}

function NavItem({
  to,
  children,
  shortcut,
}: {
  to: To
  children: React.ReactNode
  shortcut?: string
}) {
  return (
    <NavLink
      to={to}
      aria-keyshortcuts={shortcut ? shortcut.toUpperCase() : undefined}
      className={({ isActive }) =>
        cn(
          'inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium uppercase tracking-wide text-foreground/80 hover:bg-muted hover:text-foreground',
          'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          isActive && 'bg-muted text-foreground',
        )
      }
    >
      {children}
    </NavLink>
  )
}

function MobileNavItem({
  to,
  children,
  shortcut,
  onClick,
}: {
  to: To
  children: React.ReactNode
  shortcut?: string
  onClick: () => void
}) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      aria-keyshortcuts={shortcut ? shortcut.toUpperCase() : undefined}
      className={({ isActive }) =>
        cn(
          'flex w-full items-center justify-between px-3 py-3 text-[12px] font-medium uppercase tracking-wide text-foreground/80 hover:bg-muted hover:text-foreground',
          'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          isActive && 'bg-muted text-foreground',
        )
      }
    >
      {children}
    </NavLink>
  )
}

export function Layout() {
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const { theme, toggleTheme } = useTheme()
  const isApp =
    APP_PATHS.has(location.pathname) || location.pathname.startsWith('/account')

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setIsLoggedIn(!!data.session)
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session)
    })
    return () => subscription.unsubscribe()
  }, [])

  useGlobalShortcuts()

  // biome-ignore lint/correctness/useExhaustiveDependencies: close the mobile menu on route changes
  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname, location.hash])

  useEffect(() => {
    if (!location.hash) return

    const prefersReducedMotion = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)',
    ).matches
    const allowSmooth = new Set(['#demos', '#features', '#pricing']).has(
      location.hash,
    )
    const behavior: ScrollBehavior =
      prefersReducedMotion || !allowSmooth ? 'auto' : 'smooth'

    let cancelled = false
    let timeoutId: number | undefined

    const rawId = location.hash.slice(1)
    let id = rawId
    try {
      id = decodeURIComponent(rawId)
    } catch {
      id = rawId
    }

    const attemptScroll = (triesLeft: number) => {
      if (cancelled) return
      const el = document.getElementById(id)
      if (el) {
        el.scrollIntoView({ behavior, block: 'start', inline: 'nearest' })
        return
      }
      if (triesLeft <= 0) return
      timeoutId = window.setTimeout(() => attemptScroll(triesLeft - 1), 60)
    }

    attemptScroll(12)

    return () => {
      cancelled = true
      if (timeoutId) window.clearTimeout(timeoutId)
    }
  }, [location.hash])

  useEffect(() => {
    if (!menuOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [menuOpen])

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <a
        href="#main"
        className={cn(
          'sr-only fixed left-4 top-4 z-50 border border-foreground bg-foreground px-3 py-2 text-[12px] uppercase tracking-wide text-background',
          'focus:not-sr-only focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        )}
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-10 border-b border-border bg-background">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4 md:px-6">
          <NavLink
            to="/"
            className="text-[16px] font-pixel font-medium tracking-[2px] uppercase focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            UTTER
          </NavLink>

          <nav className="hidden items-center gap-1 md:flex">
            {isApp ? (
              <>
                <NavItem to="/clone" shortcut="c">
                  <span>Clone</span>
                  <Kbd>c</Kbd>
                </NavItem>
                <NavItem to="/generate" shortcut="g">
                  <span>Generate</span>
                  <Kbd>g</Kbd>
                </NavItem>
                <NavItem to="/design" shortcut="d">
                  <span>Design</span>
                  <Kbd>d</Kbd>
                </NavItem>
                <span className="mx-2 h-4 w-px bg-border" />
                <NavItem to="/voices">Voices</NavItem>
                <NavItem to="/history">
                  <span>History</span>
                  <TaskBadge />
                </NavItem>
              </>
            ) : (
              <>
                <Link
                  to={{ pathname: '/', hash: '#demos' }}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium uppercase tracking-wide text-foreground/80 hover:bg-muted hover:text-foreground',
                    'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                    location.hash === '#demos' && 'bg-muted text-foreground',
                  )}
                >
                  Demo
                </Link>
                <Link
                  to={{ pathname: '/', hash: '#features' }}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium uppercase tracking-wide text-foreground/80 hover:bg-muted hover:text-foreground',
                    'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                    location.hash === '#features' && 'bg-muted text-foreground',
                  )}
                >
                  Features
                </Link>
                <Link
                  to={{ pathname: '/', hash: '#pricing' }}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium uppercase tracking-wide text-foreground/80 hover:bg-muted hover:text-foreground',
                    'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                    location.hash === '#pricing' && 'bg-muted text-foreground',
                  )}
                >
                  Pricing
                </Link>
              </>
            )}
            <span className="mx-2 h-4 w-px bg-border" />
            <NavItem to="/about">About</NavItem>
            <NavItem to={isLoggedIn ? '/account' : '/auth'}>
              {isLoggedIn ? (
                <>
                  <ProfileIcon className="size-4" />
                  <span>Account</span>
                </>
              ) : (
                'Sign in'
              )}
            </NavItem>
          </nav>

          <button
            type="button"
            className={cn(
              'inline-flex items-center justify-center border border-border bg-background p-2 text-muted-foreground hover:bg-muted hover:text-foreground md:hidden',
              'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            )}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              aria-hidden="true"
              className="size-5"
            >
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
        </div>

        <div
          id="mobile-nav"
          className={cn(
            'border-t border-border bg-background md:hidden',
            menuOpen ? 'block' : 'hidden',
          )}
        >
          <div className="mx-auto w-full max-w-5xl px-4 py-2 md:px-6">
            <div className="space-y-1">
              {isApp ? (
                <>
                  <MobileNavItem
                    to="/clone"
                    shortcut="c"
                    onClick={() => setMenuOpen(false)}
                  >
                    <span>Clone</span>
                    <Kbd>c</Kbd>
                  </MobileNavItem>
                  <MobileNavItem
                    to="/generate"
                    shortcut="g"
                    onClick={() => setMenuOpen(false)}
                  >
                    <span>Generate</span>
                    <Kbd>g</Kbd>
                  </MobileNavItem>
                  <MobileNavItem
                    to="/design"
                    shortcut="d"
                    onClick={() => setMenuOpen(false)}
                  >
                    <span>Design</span>
                    <Kbd>d</Kbd>
                  </MobileNavItem>
                  <div className="my-2 h-px bg-border" />
                  <MobileNavItem
                    to="/voices"
                    onClick={() => setMenuOpen(false)}
                  >
                    <span>Voices</span>
                    <span />
                  </MobileNavItem>
                  <MobileNavItem
                    to="/history"
                    onClick={() => setMenuOpen(false)}
                  >
                    <span className="flex items-center gap-2">
                      <span>History</span>
                      <TaskBadge />
                    </span>
                    <span />
                  </MobileNavItem>
                </>
              ) : (
                <>
                  <Link
                    to={{ pathname: '/', hash: '#demos' }}
                    onClick={() => setMenuOpen(false)}
                    className={cn(
                      'flex w-full items-center justify-between px-3 py-3 text-[12px] font-medium uppercase tracking-wide text-foreground/80 hover:bg-muted hover:text-foreground',
                      'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                      location.hash === '#demos' && 'bg-muted text-foreground',
                    )}
                  >
                    <span>Demo</span>
                    <span />
                  </Link>
                  <Link
                    to={{ pathname: '/', hash: '#features' }}
                    onClick={() => setMenuOpen(false)}
                    className={cn(
                      'flex w-full items-center justify-between px-3 py-3 text-[12px] font-medium uppercase tracking-wide text-foreground/80 hover:bg-muted hover:text-foreground',
                      'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                      location.hash === '#features' &&
                        'bg-muted text-foreground',
                    )}
                  >
                    <span>Features</span>
                    <span />
                  </Link>
                  <Link
                    to={{ pathname: '/', hash: '#pricing' }}
                    onClick={() => setMenuOpen(false)}
                    className={cn(
                      'flex w-full items-center justify-between px-3 py-3 text-[12px] font-medium uppercase tracking-wide text-foreground/80 hover:bg-muted hover:text-foreground',
                      'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                      location.hash === '#pricing' &&
                        'bg-muted text-foreground',
                    )}
                  >
                    <span>Pricing</span>
                    <span />
                  </Link>
                </>
              )}
              <div className="my-2 h-px bg-border" />
              <MobileNavItem to="/about" onClick={() => setMenuOpen(false)}>
                <span>About</span>
                <span />
              </MobileNavItem>
              <MobileNavItem
                to={isLoggedIn ? '/account' : '/auth'}
                onClick={() => setMenuOpen(false)}
              >
                <span className="flex items-center gap-2">
                  {isLoggedIn && <ProfileIcon className="size-4" />}
                  <span>{isLoggedIn ? 'Account' : 'Sign in'}</span>
                </span>
                <span />
              </MobileNavItem>
            </div>
          </div>
        </div>
      </header>

      <main
        id="main"
        tabIndex={-1}
        className="mx-auto w-full max-w-5xl px-4 py-12 md:px-6"
      >
        <Suspense
          fallback={
            <div className="py-10 text-center text-sm text-muted-foreground">
              Loading…
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </main>

      <AppFooter />

      <TaskDock />

      <button
        type="button"
        onClick={toggleTheme}
        className={cn(
          'fixed bottom-4 left-4 z-50 inline-flex size-9 items-center justify-center rounded-full border border-border bg-background/80 text-muted-foreground backdrop-blur-sm',
          'hover:bg-muted/80 hover:text-foreground',
          'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        )}
        aria-label={
          theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
        }
        aria-pressed={theme === 'dark'}
        title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="size-5"
        >
          <path d="M21 12.8A8.5 8.5 0 0 1 11.2 3 6.5 6.5 0 1 0 21 12.8Z" />
        </svg>
      </button>
    </div>
  )
}
