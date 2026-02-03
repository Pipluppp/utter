import { NavLink } from 'react-router-dom'
import { buttonStyles } from '../../components/ui/Button'
import { cn } from '../../lib/cn'
import { useLanguages } from '../hooks'

export function LandingHero() {
  const { languages, provider } = useLanguages()

  return (
    <section className="space-y-6">
      <div className="border border-border bg-background p-6 md:p-10">
        <div className="grid gap-8 md:grid-cols-[1fr_280px]">
          <div>
            <h1 className="text-balance text-[clamp(28px,4.6vw,44px)] font-semibold uppercase tracking-[2px]">
              Clone voices.
              <br />
              Design new ones.
              <br />
              Generate speech.
            </h1>
            <p className="mt-4 max-w-xl text-sm text-muted-foreground">
              A minimal workflow for voice cloning + generation. Hear real demos
              first, then try it yourself.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="#demos"
                className={buttonStyles({ variant: 'primary', size: 'md' })}
              >
                Hear the demos →
              </a>
              <NavLink
                to="/clone"
                className={buttonStyles({ variant: 'secondary', size: 'md' })}
              >
                Clone a voice →
              </NavLink>
            </div>
          </div>

          <div className="border border-border bg-subtle p-4">
            <div className="text-xs font-semibold uppercase tracking-wide">
              Snapshot
            </div>
            <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
              <div className="flex items-center justify-between gap-3">
                <span>Provider</span>
                <span className="text-foreground">{provider}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Languages</span>
                <span className="text-foreground">{languages.length}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Text</span>
                <span className="text-foreground">10,000 chars</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Audio</span>
                <span className="text-foreground">WAV/MP3/M4A</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Clip length</span>
                <span className="text-foreground">3s–5m</span>
              </div>
            </div>

            <div
              className={cn(
                'mt-4 border-t border-border pt-4 text-[11px] text-faint',
              )}
            >
              Tip: press <span className="text-foreground">C</span>,{' '}
              <span className="text-foreground">D</span>,{' '}
              <span className="text-foreground">G</span> to jump pages.
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
