import { NavLink } from 'react-router-dom'
import { cn } from '../lib/cn'

function FooterLink({
  to,
  children,
}: {
  to: string
  children: React.ReactNode
}) {
  return (
    <NavLink
      to={to}
      className={cn(
        'text-[12px] uppercase tracking-wide text-muted-foreground hover:text-foreground',
        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
      )}
    >
      {children}
    </NavLink>
  )
}

export function AppFooter() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto w-full max-w-5xl px-4 py-10 md:px-6">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div className="space-y-2">
            <div className="text-[12px] font-semibold uppercase tracking-[2px]">
              Utter
            </div>
            <div className="text-sm text-muted-foreground">
              Voice cloning & speech generation.
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <FooterLink to="/pricing">Pricing</FooterLink>
            <FooterLink to="/account">Account</FooterLink>
            <FooterLink to="/privacy">Privacy</FooterLink>
            <FooterLink to="/terms">Terms</FooterLink>
            <FooterLink to="/about">About</FooterLink>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-2 text-xs text-faint">
          <div>Powered by Qwen3-TTS on Modal.</div>
          <div>© {new Date().getFullYear()} Utter</div>
        </div>
      </div>
    </footer>
  )
}
