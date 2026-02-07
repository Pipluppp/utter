import { NavLink } from 'react-router-dom'
import type { BillingPlan } from '../../content/plans'
import { billingPlans } from '../../content/plans'
import { cn } from '../../lib/cn'
import { buttonStyles } from '../ui/Button'

function priorityLabel(priority: BillingPlan['priority']) {
  return priority === 'priority' ? 'Priority' : 'Standard'
}

export function PricingGrid({
  compact,
  className,
}: {
  compact?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        'mx-auto grid w-full max-w-4xl grid-cols-1 gap-4 md:grid-cols-2',
        compact && 'gap-3',
        className,
      )}
    >
      {billingPlans.map((plan) => (
        <div
          key={plan.name}
          className={cn(
            'relative border border-border bg-background p-5 shadow-elevated',
            plan.id === 'pro' && 'border-border-strong',
          )}
        >
          {plan.id === 'pro' ? (
            <div className="absolute -top-3 left-4 border border-border-strong bg-background px-2 py-1 text-[11px] font-pixel font-medium uppercase tracking-wide">
              Most picked
            </div>
          ) : null}

          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[12px] font-semibold uppercase tracking-wide">
                {plan.name}
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <div className="text-2xl font-pixel font-medium">
                  ${plan.priceMonthlyUsd}
                </div>
                <div className="text-sm text-muted-foreground">/month</div>
              </div>
            </div>
            <NavLink
              to="/account/billing"
              className={buttonStyles({
                variant: plan.id === 'pro' ? 'primary' : 'secondary',
                size: 'sm',
              })}
              aria-label={`Choose ${plan.name}`}
            >
              Choose
            </NavLink>
          </div>

          <div className="mt-3 text-sm text-muted-foreground">{plan.blurb}</div>

          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            <li className="flex gap-2">
              <span className="mt-[2px] inline-block size-4 shrink-0 border border-border" />
              <span className="font-semibold text-foreground">
                {plan.creditsMonthly.toLocaleString()} credits
              </span>
              <span className="text-muted-foreground">per month</span>
            </li>
            <li className="flex gap-2">
              <span className="mt-[2px] inline-block size-4 shrink-0 border border-border" />
              <span>
                Queue priority:{' '}
                <span className="font-semibold text-foreground">
                  {priorityLabel(plan.priority)}
                </span>
              </span>
            </li>
            {plan.highlights.map((f) => (
              <li key={f} className="flex gap-2">
                <span className="mt-[2px] inline-block size-4 shrink-0 border border-border" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
