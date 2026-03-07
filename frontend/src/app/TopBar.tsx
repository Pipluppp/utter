import { Link, NavLink, type To } from 'react-router-dom'
import { TaskBadge } from '../components/tasks/TaskBadge'
import { Kbd } from '../components/ui/Kbd'
import { cn } from '../lib/cn'
import type { NavSectionItem, NavVariant } from './navigation'

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

function routeItem(
  label: string,
  to: To,
  options?: {
    shortcut?: string
    showTaskBadge?: boolean
    showProfileIcon?: boolean
  },
): NavSectionItem {
  return {
    kind: 'route',
    label,
    to,
    shortcut: options?.shortcut,
    showTaskBadge: options?.showTaskBadge,
    showProfileIcon: options?.showProfileIcon,
  }
}

function hashItem(label: string, hash: '#demos' | '#features' | '#pricing') {
  return {
    kind: 'hash' as const,
    label,
    hash,
  }
}

function getSectionKey(section: NavSectionItem[]) {
  return section
    .map((item) =>
      item.kind === 'hash' ? item.hash : `${String(item.to)}:${item.label}`,
    )
    .join('|')
}

function getSections(variant: NavVariant, signInHref: string) {
  if (variant === 'marketing_public') {
    return [
      [
        hashItem('Demo', '#demos'),
        hashItem('Features', '#features'),
        hashItem('Pricing', '#pricing'),
      ],
      [routeItem('About', '/about'), routeItem('Sign in', signInHref)],
    ]
  }

  if (variant === 'marketing_member') {
    return [
      [
        routeItem('Clone', '/clone', { shortcut: 'c' }),
        routeItem('Generate', '/generate', { shortcut: 'g' }),
        routeItem('Design', '/design', { shortcut: 'd' }),
      ],
      [
        routeItem('Voices', '/voices'),
        routeItem('History', '/history', { showTaskBadge: true }),
      ],
      [routeItem('Account', '/account', { showProfileIcon: true })],
    ]
  }

  if (variant === 'app_member') {
    return [
      [
        routeItem('Clone', '/clone', { shortcut: 'c' }),
        routeItem('Generate', '/generate', { shortcut: 'g' }),
        routeItem('Design', '/design', { shortcut: 'd' }),
      ],
      [
        routeItem('Voices', '/voices'),
        routeItem('History', '/history', { showTaskBadge: true }),
      ],
      [routeItem('Account', '/account', { showProfileIcon: true })],
    ]
  }

  return []
}

function baseNavItemClassName(active: boolean) {
  return cn(
    'inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium uppercase tracking-wide text-foreground/80 hover:bg-muted hover:text-foreground',
    'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    active && 'bg-muted text-foreground',
  )
}

function NavItemContent({
  label,
  shortcut,
  showTaskBadge,
  showProfileIcon,
}: {
  label: string
  shortcut?: string
  showTaskBadge?: boolean
  showProfileIcon?: boolean
}) {
  return (
    <>
      <span className="flex items-center gap-2">
        {showProfileIcon ? <ProfileIcon className="size-4" /> : null}
        <span>{label}</span>
        {showTaskBadge ? <TaskBadge /> : null}
      </span>
      {shortcut ? <Kbd>{shortcut}</Kbd> : null}
    </>
  )
}

function DesktopNavItem({
  item,
  currentHash,
}: {
  item: NavSectionItem
  currentHash: string
}) {
  if (item.kind === 'hash') {
    const active = currentHash === item.hash
    return (
      <Link
        to={{ pathname: '/', hash: item.hash }}
        className={baseNavItemClassName(active)}
      >
        {item.label}
      </Link>
    )
  }

  return (
    <NavLink
      to={item.to}
      aria-keyshortcuts={
        item.shortcut ? item.shortcut.toUpperCase() : undefined
      }
      className={({ isActive }) => baseNavItemClassName(isActive)}
    >
      <NavItemContent
        label={item.label}
        shortcut={item.shortcut}
        showTaskBadge={item.showTaskBadge}
        showProfileIcon={item.showProfileIcon}
      />
    </NavLink>
  )
}

function MobileNavItem({
  item,
  currentHash,
  onClick,
}: {
  item: NavSectionItem
  currentHash: string
  onClick: () => void
}) {
  const className = (active: boolean) =>
    cn(
      'flex w-full items-center justify-between px-3 py-3 text-[12px] font-medium uppercase tracking-wide text-foreground/80 hover:bg-muted hover:text-foreground',
      'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
      active && 'bg-muted text-foreground',
    )

  if (item.kind === 'hash') {
    const active = currentHash === item.hash
    return (
      <Link
        to={{ pathname: '/', hash: item.hash }}
        onClick={onClick}
        className={className(active)}
      >
        <span>{item.label}</span>
        <span />
      </Link>
    )
  }

  return (
    <NavLink
      to={item.to}
      onClick={onClick}
      aria-keyshortcuts={
        item.shortcut ? item.shortcut.toUpperCase() : undefined
      }
      className={({ isActive }) => className(isActive)}
    >
      <NavItemContent
        label={item.label}
        shortcut={item.shortcut}
        showTaskBadge={item.showTaskBadge}
        showProfileIcon={item.showProfileIcon}
      />
    </NavLink>
  )
}

export function TopBar({
  variant,
  currentHash,
  signInHref,
  menuOpen,
  onToggleMenu,
  onCloseMenu,
}: {
  variant: NavVariant
  currentHash: string
  signInHref: string
  menuOpen: boolean
  onToggleMenu: () => void
  onCloseMenu: () => void
}) {
  const sections = getSections(variant, signInHref)
  const showMenuToggle =
    variant === 'marketing_public' ||
    variant === 'marketing_member' ||
    variant === 'app_member'

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4 md:px-6">
        <NavLink
          to="/"
          className="text-[16px] font-pixel font-medium tracking-[2px] uppercase focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          UTTER
        </NavLink>

        {variant === 'auth_minimal' ? (
          <nav className="flex items-center gap-1">
            <NavLink
              to="/"
              className={({ isActive }) => baseNavItemClassName(isActive)}
            >
              Back to home
            </NavLink>
          </nav>
        ) : variant === 'app_pending_auth' ? (
          <div className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
            Checking session...
          </div>
        ) : (
          <nav className="hidden items-center gap-1 md:flex">
            {sections.map((section, index) => (
              <div key={getSectionKey(section)} className="contents">
                {index > 0 ? (
                  <span
                    className="mx-2 h-4 w-px bg-border"
                    aria-hidden="true"
                  />
                ) : null}
                {section.map((item) => (
                  <DesktopNavItem
                    key={
                      item.kind === 'hash'
                        ? item.hash
                        : `${String(item.to)}:${item.label}`
                    }
                    item={item}
                    currentHash={currentHash}
                  />
                ))}
              </div>
            ))}
          </nav>
        )}

        {showMenuToggle ? (
          <button
            type="button"
            className={cn(
              'inline-flex items-center justify-center border border-border bg-background p-2 text-muted-foreground hover:bg-muted hover:text-foreground md:hidden',
              'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            )}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            onClick={onToggleMenu}
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
        ) : null}
      </div>

      {showMenuToggle ? (
        <div
          id="mobile-nav"
          className={cn(
            'border-t border-border bg-background md:hidden',
            menuOpen ? 'block' : 'hidden',
          )}
        >
          <div className="mx-auto w-full max-w-5xl px-4 py-2 md:px-6">
            <div className="space-y-1">
              {sections.map((section, index) => (
                <div key={getSectionKey(section)}>
                  {index > 0 ? <div className="my-2 h-px bg-border" /> : null}
                  {section.map((item) => (
                    <MobileNavItem
                      key={
                        item.kind === 'hash'
                          ? item.hash
                          : `${String(item.to)}:${item.label}`
                      }
                      item={item}
                      currentHash={currentHash}
                      onClick={onCloseMenu}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </header>
  )
}
