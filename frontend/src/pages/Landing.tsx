import { NavLink } from 'react-router-dom'
import { buttonStyles } from '../components/ui/Button'
import { cn } from '../lib/cn'
import { DemoNarrative } from './landing/DemoNarrative'
import { LandingHero } from './landing/LandingHero'

function Step({
  n,
  title,
  desc,
  to,
}: {
  n: string
  title: string
  desc: string
  to: string
}) {
  return (
    <div className="border border-border bg-background p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-faint">
          {n}
        </div>
        <NavLink
          to={to}
          className={buttonStyles({ variant: 'secondary', size: 'sm' })}
        >
          Open →
        </NavLink>
      </div>
      <div className="mt-4 text-sm font-semibold uppercase tracking-wide">
        {title}
      </div>
      <div className="mt-2 text-sm text-muted-foreground">{desc}</div>
    </div>
  )
}

export function LandingPage() {
  return (
    <div className="space-y-10">
      <LandingHero />

      <DemoNarrative />

      <section className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold uppercase tracking-[2px]">
              How it works
            </h2>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              A straight line from input to output. No hidden pages.
            </p>
          </div>
          <NavLink
            to="/about"
            className={cn(
              'text-[12px] uppercase tracking-wide text-muted-foreground hover:text-foreground',
              'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            )}
          >
            Read more →
          </NavLink>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Step
            n="01"
            title="Clone"
            desc="Upload a short clip to create a reusable voice."
            to="/clone"
          />
          <Step
            n="02"
            title="Design"
            desc="Describe a voice in text—no audio upload required."
            to="/design"
          />
          <Step
            n="03"
            title="Generate"
            desc="Paste text (up to 10k chars) and generate speech in your voices."
            to="/generate"
          />
        </div>
      </section>
    </div>
  )
}
