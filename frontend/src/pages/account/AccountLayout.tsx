import { NavLink, Outlet } from 'react-router-dom'
import { cn } from '../../lib/cn'

type AccountNavItem = {
  to: string
  label: string
  desc: string
}

const navItems: AccountNavItem[] = [
  { to: '/account/profile', label: 'Profile', desc: 'Identity & preferences' },
  { to: '/account/usage', label: 'Credits', desc: 'Balance, rates, history' },
  { to: '/account/billing', label: 'Billing', desc: 'Plans, invoices' },
]

function AccountNavLink({ item }: { item: AccountNavItem }) {
  return (
    <NavLink
      to={item.to}
      className={({ isActive }) =>
        cn(
          'block border border-border bg-background p-3 shadow-elevated',
          'hover:bg-subtle',
          'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          isActive && 'border-border-strong',
        )
      }
    >
      <div className="text-[12px] font-semibold uppercase tracking-wide">
        {item.label}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{item.desc}</div>
    </NavLink>
  )
}

export function AccountLayoutPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold uppercase tracking-[2px]">
            Account
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Account pages will be wired to Supabase Auth + Stripe billing in the
            production deployment.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[240px_1fr]">
        <aside className="space-y-3">
          <div className="grid gap-3 md:grid-cols-1">
            {navItems.map((item) => (
              <AccountNavLink key={item.to} item={item} />
            ))}
          </div>
        </aside>

        <section className="min-w-0">
          <Outlet />
        </section>
      </div>
    </div>
  )
}
