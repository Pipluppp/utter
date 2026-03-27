import { Outlet, createFileRoute, useLocation } from "@tanstack/react-router";
import { Suspense, useEffect, useState } from "react";
import { useAuthState } from "../app/auth/AuthStateProvider";
import { AppFooter } from "../app/Footer";
import { buildAuthHref, buildReturnTo, getNavVariant } from "../app/navigation";
import { TopBar } from "../app/TopBar";
import { useGlobalShortcuts } from "../app/useGlobalShortcuts";
import { RouteMarketingSkeleton } from "../components/templates/RouteSkeletons";

export const Route = createFileRoute("/_marketing")({
  component: MarketingLayout,
  pendingComponent: RouteMarketingSkeleton,
});

function MarketingLayout() {
  const location = useLocation();
  const authState = useAuthState();
  const [menuOpen, setMenuOpen] = useState(false);
  const navVariant = getNavVariant("marketing", authState.status);
  const signInHref = buildAuthHref(buildReturnTo(location));

  useGlobalShortcuts(true);

  // Close mobile menu on route changes
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname, location.hash]);

  // Escape key closes mobile menu
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

  // Hash scrolling for marketing anchors (#demos, #features, #pricing)
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

  return (
    <>
      <TopBar
        variant={navVariant}
        currentHash={location.hash}
        signInHref={signInHref}
        menuOpen={menuOpen}
        onToggleMenu={() => setMenuOpen((open) => !open)}
        onCloseMenu={() => setMenuOpen(false)}
      />
      <main id="main" tabIndex={-1} className="w-full flex-1 mx-auto max-w-5xl px-4 py-12 md:px-6">
        <Suspense fallback={<RouteMarketingSkeleton />}>
          <Outlet />
        </Suspense>
      </main>
      <AppFooter />
    </>
  );
}
