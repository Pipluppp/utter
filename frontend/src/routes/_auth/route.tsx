import { Outlet, createFileRoute, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { buildAuthHref, buildReturnTo } from "../../app/navigation";
import { TopBar } from "../../app/TopBar";
import { RouteAuthSkeleton } from "../../components/templates/RouteSkeletons";

export const Route = createFileRoute("/_auth")({
  component: AuthLayout,
  pendingComponent: RouteAuthSkeleton,
});

function AuthLayout() {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const signInHref = buildAuthHref(buildReturnTo(location));

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

  return (
    <>
      <TopBar
        variant="auth_minimal"
        currentHash={location.hash}
        signInHref={signInHref}
        menuOpen={menuOpen}
        onToggleMenu={() => setMenuOpen((open) => !open)}
        onCloseMenu={() => setMenuOpen(false)}
      />
      <main id="main" tabIndex={-1} className="w-full flex-1 flex overflow-hidden">
        <Outlet />
      </main>
    </>
  );
}
