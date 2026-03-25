import { useLocation } from "react-router-dom";
import { AppLink } from "../components/atoms/Link";
import { Separator } from "../components/atoms/Separator";
import { cn } from "../lib/cn";
import { useAuthState } from "./auth/AuthStateProvider";
import { buildAuthHref, buildReturnTo } from "./navigation";

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <AppLink
      href={href}
      className={cn(
        "text-caption uppercase tracking-wide text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </AppLink>
  );
}

export function AppFooter() {
  const location = useLocation();
  const authState = useAuthState();
  const accountHref =
    authState.status === "signed_in" ? "/account" : buildAuthHref(buildReturnTo(location));

  return (
    <footer className="bg-background">
      <Separator />
      <div className="mx-auto w-full max-w-5xl px-4 py-10 md:px-6">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div className="space-y-2">
            <div className="text-caption font-pixel font-medium uppercase tracking-[2px]">
              UTTER
            </div>
            <div className="text-sm text-muted-foreground">Voice cloning & speech generation.</div>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <FooterLink href="/#pricing">Pricing</FooterLink>
            <FooterLink href={accountHref}>
              {authState.status === "signed_in" ? "Account" : "Sign in"}
            </FooterLink>
            <FooterLink href="/privacy">Privacy</FooterLink>
            <FooterLink href="/terms">Terms</FooterLink>
            <FooterLink href="/about">About</FooterLink>
            <AppLink
              href="https://steel-gong-714.notion.site/756b59f6379b82168ff001ffed20a47f"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "text-caption uppercase tracking-wide text-muted-foreground hover:text-foreground",
              )}
            >
              Bug
            </AppLink>
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
