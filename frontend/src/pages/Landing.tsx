import { NavLink } from 'react-router-dom'
import { cn } from '../lib/cn'

function FeatureCard({
  to,
  title,
  desc,
  icon,
  linkText,
}: {
  to: string
  title: string
  desc: string
  icon: React.ReactNode
  linkText: string
}) {
  return (
    <NavLink
      to={to}
      className={cn(
        'group block border border-border bg-background p-6 hover:bg-subtle',
        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
      )}
    >
      <div className="mb-4 text-muted-foreground group-hover:text-foreground">{icon}</div>
      <h3 className="text-sm font-semibold uppercase tracking-wide">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
      <span className="mt-4 inline-block text-[12px] uppercase tracking-wide text-foreground">
        {linkText}
      </span>
    </NavLink>
  )
}

export function LandingPage() {
  return (
    <div className="space-y-10">
      <section className="text-center">
        <h1 className="text-balance text-[clamp(26px,4vw,36px)] font-semibold uppercase tracking-[2px]">
          Clone Any Voice.
          <br />
          Design New Ones.
          <br />
          Generate Speech.
        </h1>
        <p className="mt-4 text-sm text-muted-foreground">
          AI voice cloning and generation.
          <br />
          10 languages supported.
        </p>
        <NavLink
          to="/clone"
          className="mt-8 inline-flex items-center justify-center border border-foreground bg-foreground px-6 py-3 text-sm font-medium uppercase tracking-wide text-background hover:bg-foreground/80 hover:border-foreground/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Get Started →
        </NavLink>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <FeatureCard
          to="/clone"
          title="Clone"
          desc="Upload a voice clip (10s–5min) to create a digital replica of any voice."
          linkText="Clone a voice →"
          icon={
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M12 1v6M12 17v6M4.22 4.22l4.24 4.24M15.54 15.54l4.24 4.24M1 12h6M17 12h6M4.22 19.78l4.24-4.24M15.54 8.46l4.24-4.24" />
            </svg>
          }
        />
        <FeatureCard
          to="/design"
          title="Design"
          desc="Describe a voice in plain text. No audio upload needed—just imagination."
          linkText="Design a voice →"
          icon={
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
            </svg>
          }
        />
        <FeatureCard
          to="/generate"
          title="Generate"
          desc="Type up to 10,000 characters. Hear it spoken in any of your saved voices."
          linkText="Generate speech →"
          icon={
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M8 5v14l11-7L8 5z" />
            </svg>
          }
        />
      </section>
    </div>
  )
}
