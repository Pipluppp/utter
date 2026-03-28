import { cn } from "../lib/cn";
import { Link } from "./atoms/Link";

/**
 * Shared 404 content used by both the router-wide `defaultNotFoundComponent`
 * (rendered inside a layout Outlet) and the root route `notFoundComponent`
 * (rendered standalone with its own header/footer).
 */
export function NotFoundContent() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-32 md:py-44 text-center">
      <h1 className="text-[clamp(80px,20vw,200px)] font-pixel font-medium uppercase leading-none tracking-[4px] text-foreground/10">
        404
      </h1>
      <p className="mt-6 text-sm text-muted-foreground">This page doesn't exist.</p>
      <Link
        to="/"
        className={cn(
          "mt-8 inline-flex items-center border border-foreground bg-foreground px-6 py-3 text-sm font-medium uppercase tracking-wide text-background press-scale",
          "data-[hovered]:bg-foreground/80 data-[hovered]:border-foreground/80 data-[pressed]:bg-foreground/80 data-[pressed]:border-foreground/80",
        )}
      >
        Go home
      </Link>
    </div>
  );
}
