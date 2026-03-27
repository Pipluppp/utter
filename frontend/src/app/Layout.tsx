import { Suspense, useEffect, useMemo, useState } from "react";
import { RouterProvider as AriaRouterProvider } from "react-aria-components";
import { Outlet, useLocation, useMatches, useNavigate } from "react-router-dom";
import { GlobalToastRegion } from "../components/molecules/Toast";
import { TaskDock } from "../components/organisms/TaskDock";
import {
  RouteAccountSkeleton,
  RouteAppSkeleton,
  RouteAuthSkeleton,
  RouteMarketingSkeleton,
} from "../components/templates/RouteSkeletons";
import { cn } from "../lib/cn";
import { useAuthState } from "./auth/AuthStateProvider";
import { AppFooter } from "./Footer";
import { buildAuthHref, buildReturnTo, getNavVariant, type RouteFamily } from "./navigation";
import { TopBar } from "./TopBar";
import { useGlobalShortcuts } from "./useGlobalShortcuts";

export function Layout() {
  const location = useLocation();
  const matches = useMatches();
  const navigate = useNavigate();
  const authState = useAuthState();
  const [menuOpen, setMenuOpen] = useState(false);
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
    <AriaRouterProvider navigate={navigate}>
      <div
        className={cn(
          "flex flex-col bg-background text-foreground",
          isAuthSurface ? "h-dvh" : "min-h-dvh",
        )}
      >
        <a
          href="#main"
          className={cn(
            "sr-only fixed left-4 top-4 z-50 border border-foreground bg-foreground px-3 py-2 text-caption uppercase tracking-wide text-background",
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
            isAuthSurface ? "flex overflow-hidden" : "mx-auto max-w-5xl px-4 py-12 md:px-6",
          )}
        >
          <Suspense fallback={suspenseFallback}>
            <Outlet />
          </Suspense>
        </main>

        {!isAuthSurface ? <AppFooter /> : null}
        {!isAuthSurface ? <TaskDock /> : null}

        <GlobalToastRegion />
      </div>
    </AriaRouterProvider>
  );
}
