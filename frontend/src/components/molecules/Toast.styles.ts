import { tv } from "tailwind-variants";

export const toastStyles = tv({
  slots: {
    root: "flex items-start gap-3 border border-border bg-background p-4 shadow-elevated entering:animate-in entering:slide-in-from-right-full entering:fade-in exiting:animate-out exiting:slide-out-to-right-full exiting:fade-out",
    icon: "mt-0.5 flex size-5 shrink-0 items-center justify-center text-sm font-bold",
    content: "flex min-w-0 flex-1 flex-col gap-0.5",
    title: "text-sm font-medium text-foreground",
    description: "text-xs text-muted-foreground",
    close:
      "inline-flex size-6 shrink-0 items-center justify-center text-muted-foreground hovered:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
  },
  variants: {
    variant: {
      success: { icon: "text-status-success" },
      error: { icon: "text-status-error" },
      info: { icon: "text-blue-600 dark:text-blue-400" },
    },
  },
});
