import { NavLink, Outlet } from 'react-router-dom'
import { TaskBadge } from '../components/tasks/TaskBadge'
import { TaskDock } from '../components/tasks/TaskDock'
import { cn } from '../lib/cn'

function NavItem({
  to,
  children,
}: {
  to: string
  children: React.ReactNode
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'inline-flex items-center gap-1.5 px-3 py-2 text-[12px] uppercase tracking-wide text-muted-foreground hover:bg-muted hover:text-foreground',
          'focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          isActive && 'bg-muted text-foreground',
        )
      }
    >
      {children}
    </NavLink>
  )
}

export function Layout() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <a
        href="#main"
        className={cn(
          'sr-only fixed left-4 top-4 z-50 border border-foreground bg-foreground px-3 py-2 text-[12px] uppercase tracking-wide text-background',
          'focus:not-sr-only focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        )}
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-10 border-b border-border bg-background">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-4">
          <NavLink
            to="/"
            className="text-[16px] font-semibold tracking-[2px] uppercase focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            UTTER
          </NavLink>

          <nav className="flex flex-wrap items-center gap-1">
            <NavItem to="/clone">Clone</NavItem>
            <NavItem to="/generate">Generate</NavItem>
            <NavItem to="/design">Design</NavItem>
            <span className="mx-2 h-4 w-px bg-border" />
            <NavItem to="/voices">Voices</NavItem>
            <NavItem to="/history">
              <span>History</span>
              <TaskBadge />
            </NavItem>
            <NavItem to="/about">About</NavItem>
          </nav>
        </div>
      </header>

      <main
        id="main"
        tabIndex={-1}
        className="mx-auto w-full max-w-3xl px-4 py-12"
      >
        <Outlet />
      </main>

      <TaskDock />
    </div>
  )
}
