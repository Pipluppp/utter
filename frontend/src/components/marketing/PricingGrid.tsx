import { NavLink } from 'react-router-dom'
import { creditPacks } from '../../content/plans'
import { cn } from '../../lib/cn'
import { buttonStyles } from '../ui/Button'

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
      {creditPacks.map((pack) => (
        <div
          key={pack.id}
          className={cn(
            'relative border border-border bg-background p-5 shadow-elevated',
            pack.featured && 'border-border-strong',
          )}
        >
          {pack.featured ? (
            <div className="absolute -top-3 left-4 border border-border-strong bg-background px-2 py-1 text-[11px] font-pixel font-medium uppercase tracking-wide">
              Best value
            </div>
          ) : null}

          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[12px] font-semibold uppercase tracking-wide">
                {pack.name}
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <div className="text-2xl font-pixel font-medium">
                  ${pack.priceUsd}
                </div>
                <div className="text-sm text-muted-foreground">one-time</div>
              </div>
            </div>
            <NavLink
              to="/account/billing"
              className={buttonStyles({
                variant: pack.featured ? 'primary' : 'secondary',
                size: 'sm',
              })}
              aria-label={`Buy ${pack.name}`}
            >
              Buy credits
            </NavLink>
          </div>

          <div className="mt-3 text-sm text-muted-foreground">{pack.blurb}</div>

          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            <li className="flex gap-2">
              <span className="mt-[2px] inline-block size-4 shrink-0 border border-border" />
              <span className="font-semibold text-foreground">
                {pack.credits.toLocaleString()} credits
              </span>
            </li>
            {pack.highlights.map((f) => (
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
