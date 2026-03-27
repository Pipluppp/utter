import { useLocation } from "@tanstack/react-router";
import { ArrowUpRight, Bug, Moon, Sun } from "lucide-react";
import type { ReactNode } from "react";
import { Button as AriaButton } from "react-aria-components";
import { AppLink } from "../components/atoms/Link";
import { Separator } from "../components/atoms/Separator";
import { Tooltip } from "../components/atoms/Tooltip";
import { cn } from "../lib/cn";
import { useAuthState } from "./auth/AuthStateProvider";
import { buildAuthHref, buildReturnTo } from "./navigation";
import { useTheme } from "./theme/ThemeProvider";

function FooterLink({
  href,
  children,
  external = false,
}: {
  href: string;
  children: ReactNode;
  external?: boolean;
}) {
  return (
    <AppLink
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className={cn(
        "inline-flex w-fit whitespace-nowrap text-[15px] leading-tight text-muted-foreground transition-colors duration-150 ease-out",
        "hover:text-foreground focus-visible:ring-offset-footer-surface",
      )}
    >
      {children}
    </AppLink>
  );
}

function FooterSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-5">
      <h2 className="text-caption font-medium uppercase tracking-[0.18em] text-faint">{title}</h2>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

export function AppFooter() {
  const location = useLocation();
  const authState = useAuthState();
  const { theme, toggleTheme } = useTheme();
  const accountHref =
    authState.status === "signed_in" ? "/account" : buildAuthHref(buildReturnTo(location));

  return (
    <footer className="bg-footer-surface">
      <Separator className="bg-footer-border" />
      <div className="mx-auto w-full max-w-5xl px-4 pb-[calc(1.75rem+env(safe-area-inset-bottom))] pt-14 sm:px-6 sm:pb-[calc(2.25rem+env(safe-area-inset-bottom))] sm:pt-16 lg:pt-20">
        <div className="grid gap-14 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,1.92fr)] lg:gap-16">
          <div className="space-y-5">
            <div className="text-caption font-pixel font-medium uppercase tracking-[0.28em] text-foreground">
              UTTER
            </div>
            <div className="max-w-sm space-y-3">
              <p className="text-[1.625rem] leading-[1.08] tracking-[-0.03em] text-foreground sm:text-[1.875rem]">
                Create voices and generate speech.
              </p>
              <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
                Find pricing, manage your account, and get the essentials in one place.
              </p>
            </div>
          </div>

          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-12">
            <FooterSection title="Product">
              <FooterLink href="/#pricing">Pricing</FooterLink>
              <FooterLink href={accountHref}>
                {authState.status === "signed_in" ? "Account" : "Sign in"}
              </FooterLink>
            </FooterSection>

            <FooterSection title="Company">
              <FooterLink href="/about">About</FooterLink>
            </FooterSection>

            <FooterSection title="Policies">
              <FooterLink href="/privacy">Privacy</FooterLink>
              <FooterLink href="/terms">Terms</FooterLink>
            </FooterSection>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-6 border-t border-footer-border pt-6 sm:mt-16 sm:pt-8 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Powered by Qwen3-TTS.</div>
            <div className="text-caption uppercase tracking-[0.18em] text-faint">
              (c) {new Date().getFullYear()} Utter
            </div>
          </div>

          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-5">
            <Tooltip
              content={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              placement="top"
            >
              <AriaButton
                onPress={toggleTheme}
                className={cn(
                  "inline-flex size-10 cursor-pointer items-center justify-center rounded-full border border-footer-border bg-background/65 text-muted-foreground backdrop-blur-sm press-scale-sm",
                  "transition-[background-color,border-color,color] duration-150 ease-out",
                  "hover:border-border-strong hover:bg-background/85 hover:text-foreground",
                  "pressed:border-border-strong pressed:bg-background/85 pressed:text-foreground",
                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-footer-surface",
                )}
                aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                aria-pressed={theme === "dark"}
              >
                {theme === "dark" ? (
                  <Sun className="icon-md" strokeWidth={1.5} aria-hidden="true" />
                ) : (
                  <Moon className="icon-md" strokeWidth={1.5} aria-hidden="true" />
                )}
              </AriaButton>
            </Tooltip>

            <Tooltip content="Open the bug board in a new tab" placement="top">
              <FooterLink
                href="https://steel-gong-714.notion.site/756b59f6379b82168ff001ffed20a47f"
                external
              >
                <span className="inline-flex items-center gap-2">
                  <Bug className="icon-bug" strokeWidth={1.7} aria-hidden="true" />
                  <span>Report a bug</span>
                  <ArrowUpRight className="size-3.5" strokeWidth={1.7} aria-hidden="true" />
                </span>
              </FooterLink>
            </Tooltip>
          </div>
        </div>
      </div>
    </footer>
  );
}
