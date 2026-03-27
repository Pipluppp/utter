import { Link, Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import { AppFooter } from "../app/Footer";
import { NotFoundContent } from "../components/NotFoundContent";
import { GlobalToastRegion } from "../components/molecules/Toast";
import { cn } from "../lib/cn";
import type { RouterContext } from "../routerContext";

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFoundPage,
});

function RootLayout() {
  return (
    <div className="flex flex-col bg-background text-foreground min-h-dvh">
      <a
        href="#main"
        className={cn(
          "sr-only fixed left-4 top-4 z-50 border border-foreground bg-foreground px-3 py-2 text-caption uppercase tracking-wide text-background",
          "focus:not-sr-only focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        )}
      >
        Skip to content
      </a>
      <Outlet />
      <GlobalToastRegion />
    </div>
  );
}

function NotFoundPage() {
  return (
    <>
      <header className="sticky top-0 z-10 border-b border-border bg-background">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4 md:px-6">
          <Link
            to="/"
            className="text-[16px] font-pixel font-medium tracking-[2px] uppercase focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            UTTER
          </Link>
        </div>
      </header>

      <NotFoundContent />

      <AppFooter />
    </>
  );
}
