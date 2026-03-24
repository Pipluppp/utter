import { Suspense, useEffect, useMemo, useState } from "react";
import { Outlet, useLocation, useMatches } from "react-router-dom";
import { TaskDock } from "../components/tasks/TaskDock";
import {
  RouteAccountSkeleton,
  RouteAppSkeleton,
  RouteAuthSkeleton,
  RouteMarketingSkeleton,
} from "../components/ui/RouteSkeletons";
import { GlobalToastRegion } from "../components/ui/Toast";
import { cn } from "../lib/cn";
import { useAuthState } from "./auth/AuthStateProvider";
import { AppFooter } from "./Footer";
import { buildAuthHref, buildReturnTo, getNavVariant, type RouteFamily } from "./navigation";
import { useTheme } from "./theme/ThemeProvider";
import { TopBar } from "./TopBar";
import { useGlobalShortcuts } from "./useGlobalShortcuts";

export function Layout() {
  const location = useLocation();
  const matches = useMatches();
  const authState = useAuthState();
  const [menuOpen, setMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const routeFamily = useMemo<RouteFamily>(() => {
    for (const match of [...matches].toReversed()) {
      const handle = match.handle as { routeFamily?: RouteFamily } | undefined;
      if (handle?.routeFamily) {
        return handle.routeFamily;
      }
    }
    return "marketing";
  }, [matches]);
  const navVariant = getNavVariant(routeFamily, authState.status);
  const isAuthSurface = routeFamily === "auth";
  const suspenseFallback =
    routeFamily === "marketing" ? (
      <RouteMarketingSkeleton />
    ) : routeFamily === "auth" ? (
      <RouteAuthSkeleton />
    ) : location.pathname.startsWith("/account") ? (
      <RouteAccountSkeleton />
    ) : (
      <RouteAppSkeleton />
    );

  useGlobalShortcuts(routeFamily !== "auth");
  // biome-ignore lint/correctness/useExhaustiveDependencies: close the mobile menu on route changes
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname, location.hash]);

  useEffect(() => {
    if (!location.hash) return;

    const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const allowSmooth = new Set(["#demos", "#features", "#pricing"]).has(location.hash);
    const behavior: ScrollBehavior = prefersReducedMotion || !allowSmooth ? "auto" : "smooth";

    let cancelled = false;
    let timeoutId: number | undefined;

    const rawId = location.hash.slice(1);
    let id = rawId;
    try {
      id = decodeURIComponent(rawId);
    } catch {
      id = rawId;
    }

    const attemptScroll = (triesLeft: number) => {
      if (cancelled) return;
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView({ behavior, block: "start", inline: "nearest" });
        return;
      }
      if (triesLeft <= 0) return;
      timeoutId = window.setTimeout(() => attemptScroll(triesLeft - 1), 60);
    };

    attemptScroll(12);

    return () => {
      cancelled = true;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [location.hash]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <a
        href="#main"
        className={cn(
          "sr-only fixed left-4 top-4 z-50 border border-foreground bg-foreground px-3 py-2 text-[12px] uppercase tracking-wide text-background",
          "focus:not-sr-only focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        )}
      >
        Skip to content
      </a>

      <TopBar
        variant={navVariant}
        currentHash={location.hash}
        signInHref={buildAuthHref(buildReturnTo(location))}
        menuOpen={menuOpen}
        onToggleMenu={() => setMenuOpen((open) => !open)}
        onCloseMenu={() => setMenuOpen(false)}
      />

      <main
        id="main"
        tabIndex={-1}
        className={cn(
          "w-full flex-1",
          isAuthSurface ? "flex" : "mx-auto max-w-5xl px-4 py-12 md:px-6",
        )}
      >
        <Suspense fallback={suspenseFallback}>
          <Outlet />
        </Suspense>
      </main>

      {!isAuthSurface ? <AppFooter /> : null}
      {!isAuthSurface ? <TaskDock /> : null}

      <button
        type="button"
        onClick={toggleTheme}
        className={cn(
          "fixed bottom-4 left-4 z-50 inline-flex size-9 items-center justify-center rounded-full border border-border bg-background/80 text-muted-foreground backdrop-blur-sm",
          "hover:bg-muted/80 hover:text-foreground",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        )}
        aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        aria-pressed={theme === "dark"}
        title={theme === "dark" ? "Light mode" : "Dark mode"}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="size-5"
        >
          <path d="M21 12.8A8.5 8.5 0 0 1 11.2 3 6.5 6.5 0 1 0 21 12.8Z" />
        </svg>
      </button>

      <a
        href="https://steel-gong-714.notion.site/756b59f6379b82168ff001ffed20a47f"
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "group fixed bottom-4 right-4 z-50 inline-flex items-center gap-2",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-full",
        )}
      >
        <span className="text-[10px] font-pixel uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">
          beta
        </span>
        <span
          className={cn(
            "inline-flex size-7 items-center justify-center rounded-full border border-border bg-background/80 backdrop-blur-sm",
            "text-[9px] font-pixel uppercase leading-none text-muted-foreground",
            "group-hover:bg-muted/80 group-hover:text-foreground transition-colors",
          )}
          title="bug"
        >
          bug
        </span>
      </a>

      <GlobalToastRegion />
    </div>
  );
}
