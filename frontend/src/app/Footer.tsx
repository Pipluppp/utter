import { NavLink, useLocation } from "react-router-dom";
import { cn } from "../lib/cn";
import { useAuthState } from "./auth/AuthStateProvider";
import { buildAuthHref, buildReturnTo } from "./navigation";

function FooterLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      className={cn(
        "text-[12px] uppercase tracking-wide text-muted-foreground hover:text-foreground",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      )}
    >
      {children}
    </NavLink>
  );
}

export function AppFooter() {
  const location = useLocation();
  const authState = useAuthState();
  const accountHref =
    authState.status === "signed_in" ? "/account" : buildAuthHref(buildReturnTo(location));

  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto w-full max-w-5xl px-4 py-10 md:px-6">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div className="space-y-2">
            <div className="text-[12px] font-pixel font-medium uppercase tracking-[2px]">UTTER</div>
            <div className="text-sm text-muted-foreground">Voice cloning & speech generation.</div>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <FooterLink to="/#pricing">Pricing</FooterLink>
            <FooterLink to={accountHref}>
              {authState.status === "signed_in" ? "Account" : "Sign in"}
            </FooterLink>
            <FooterLink to="/privacy">Privacy</FooterLink>
            <FooterLink to="/terms">Terms</FooterLink>
            <FooterLink to="/about">About</FooterLink>
            <a
              href="https://steel-gong-714.notion.site/756b59f6379b82168ff001ffed20a47f"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "text-[12px] uppercase tracking-wide text-muted-foreground hover:text-foreground",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              )}
            >
              Bug
            </a>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-2 text-xs text-faint">
          <div>Powered by Qwen3-TTS.</div>
          <div>(c) {new Date().getFullYear()} Utter</div>
        </div>
      </div>
    </footer>
  );
}
