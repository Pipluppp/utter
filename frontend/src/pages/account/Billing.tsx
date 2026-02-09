import { NavLink } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { getBillingPlan } from '../../content/plans'
import { cn } from '../../lib/cn'

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-border py-3 text-sm">
      <div className="text-muted-foreground">{k}</div>
      <div className="font-semibold">{v}</div>
    </div>
  )
}

export function AccountBillingPage() {
  const plan = getBillingPlan('creator')

  return (
    <div className="space-y-4">
      <section className="border border-border bg-background p-5 shadow-elevated">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-wide">
              Current plan
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <div className="text-xl font-semibold">{plan.name}</div>
              <div className="text-sm text-muted-foreground">
                ${plan.priceMonthlyUsd}/month
              </div>
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              {plan.creditsMonthly.toLocaleString()} credits included each
              month.
            </div>
          </div>
          <Button variant="secondary" size="sm" disabled>
            Manage billing
          </Button>
        </div>

        <div className="mt-4 border border-border bg-subtle px-4 shadow-elevated">
          <Row k="Status" v="Active" />
          <Row k="Renews" v="Monthly" />
          <Row k="Payment method" v="—" />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <NavLink
            to="/#pricing"
            className={cn(
              'text-[12px] uppercase tracking-wide text-muted-foreground hover:text-foreground',
              'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            )}
          >
            Compare plans →
          </NavLink>
          <div className="text-xs text-faint">
            Billing will appear here once Stripe is connected.
          </div>
        </div>
      </section>

      <section className="border border-border bg-background p-5 shadow-elevated">
        <div className="text-[12px] font-semibold uppercase tracking-wide">
          Invoices
        </div>
        <div className="mt-4 border border-border bg-subtle p-4 text-sm text-muted-foreground shadow-elevated">
          No invoices yet.
        </div>
      </section>
    </div>
  )
}
