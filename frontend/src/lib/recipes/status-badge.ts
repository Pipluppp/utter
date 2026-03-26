import { tv } from "tailwind-variants";

export const statusBadge = tv({
  base: "border px-2 py-0.5 text-[10px] uppercase tracking-wide",
  variants: {
    status: {
      completed: "border-border bg-subtle text-muted-foreground",
      pending: "border-border bg-muted text-muted-foreground",
      processing: "border-border bg-muted text-muted-foreground",
      failed: "border-status-error-border bg-status-error-bg text-status-error",
      cancelled:
        "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-200",
    },
  },
});
