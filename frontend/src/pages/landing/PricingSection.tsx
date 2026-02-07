import { NavLink } from 'react-router-dom'
import { PricingGrid } from '../../components/marketing/PricingGrid'
import { cn } from '../../lib/cn'

export function PricingSection() {
  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-pixel font-medium uppercase tracking-[2px]">
            Pricing
          </h2>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Credits buy throughput. Pick a plan that matches your output.
          </p>
        </div>
        <NavLink
          to="/pricing"
          className={cn(
            'text-[12px] uppercase tracking-wide text-muted-foreground hover:text-foreground',
            'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          )}
        >
          See all plans →
        </NavLink>
      </div>

      <PricingGrid compact />
    </section>
  )
}
