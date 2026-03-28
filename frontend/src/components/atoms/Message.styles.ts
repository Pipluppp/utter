import { tv } from "tailwind-variants";

export const messageStyles = tv({
  base: "border px-4 py-3 text-sm shadow-elevated",
  variants: {
    variant: {
      error: "border-status-error-border bg-status-error-bg text-status-error",
      success: "border-status-success-border bg-status-success-bg text-status-success",
      info: "border-border bg-subtle text-foreground",
    },
  },
});
