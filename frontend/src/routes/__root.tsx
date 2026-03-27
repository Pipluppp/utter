import { Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import { GlobalToastRegion } from "../components/molecules/Toast";
import { cn } from "../lib/cn";
import type { RouterContext } from "../routerContext";

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
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
