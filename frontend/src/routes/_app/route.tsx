import { Outlet, createFileRoute, redirect, useLocation } from "@tanstack/react-router";
import { Suspense, useEffect, useState } from "react";
import { useAuthState } from "../../app/auth/AuthStateProvider";
import { AppFooter } from "../../app/Footer";
import { buildAuthHref, buildReturnTo, getNavVariant } from "../../app/navigation";
import { TopBar } from "../../app/TopBar";
import { useGlobalShortcuts } from "../../app/useGlobalShortcuts";
import { TaskDock } from "../../components/organisms/TaskDock";
import { QueryErrorBoundary } from "../../components/QueryErrorBoundary";
import {
  AuthGateSkeleton,
  RouteAccountSkeleton,
  RouteAppSkeleton,
} from "../../components/templates/RouteSkeletons";

export const Route = createFileRoute("/_app")({
  beforeLoad: ({ context, location }) => {
    if (context.authState.status === "signed_out") {
      throw redirect({
        to: "/auth" as string,
        search: { returnTo: location.href },
      });
    }
  },
  pendingComponent: AuthGateSkeleton,
  component: AppLayout,
});

function AppLayout() {
  const location = useLocation();
  const authState = useAuthState();
  const [menuOpen, setMenuOpen] = useState(false);
  const navVariant = getNavVariant("app", authState.status);
  const signInHref = buildAuthHref(buildReturnTo(location));

  const suspenseFallback = location.pathname.startsWith("/account") ? (
    <RouteAccountSkeleton />
  ) : (
    <RouteAppSkeleton />
  );

  useGlobalShortcuts(authState.status === "signed_in");

  // Close mobile menu on route changes
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname, location.hash]);

  // Show skeleton while auth is still resolving — beforeLoad will redirect
  // once router.invalidate() fires after auth settles to "signed_out"
  if (authState.status === "loading") {
    return <AuthGateSkeleton />;
  }

  return (
    <>
      <TopBar
        variant={navVariant}
        currentHash={location.hash}
        signInHref={signInHref}
        menuOpen={menuOpen}
        onMenuOpenChange={setMenuOpen}
      />
      <main id="main" tabIndex={-1} className="w-full flex-1 mx-auto max-w-5xl px-4 py-12 md:px-6">
        <QueryErrorBoundary>
          <Suspense fallback={suspenseFallback}>
            <Outlet />
          </Suspense>
        </QueryErrorBoundary>
      </main>
      <AppFooter />
      <TaskDock />
    </>
  );
}
