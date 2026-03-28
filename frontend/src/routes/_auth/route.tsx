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

  return (
    <>
      <TopBar
        variant="auth_minimal"
        currentHash={location.hash}
        signInHref={signInHref}
        menuOpen={menuOpen}
        onMenuOpenChange={setMenuOpen}
      />
      <main id="main" tabIndex={-1} className="w-full flex-1 flex overflow-hidden">
        <Outlet />
      </main>
    </>
  );
}
