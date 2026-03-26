import {
  UNSTABLE_Toast as AriaToast,
  UNSTABLE_ToastContent as AriaToastContent,
  UNSTABLE_ToastRegion as AriaToastRegion,
  Button,
  UNSTABLE_ToastQueue as ToastQueue,
} from "react-aria-components";
import { tv } from "tailwind-variants";

export interface ToastContent {
  title: string;
  description?: string;
  variant?: "success" | "error" | "info";
}

export const toastQueue = new ToastQueue<ToastContent>({ maxVisibleToasts: 3 });

const variantIcon: Record<NonNullable<ToastContent["variant"]>, string> = {
  success: "✓",
  error: "✕",
  info: "ℹ",
};

const toastRecipe = tv({
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

export function GlobalToastRegion() {
  return (
    <AriaToastRegion queue={toastQueue}>
      {({ toast }) => {
        const { root, icon, content, title, description, close } = toastRecipe({
          variant: toast.content.variant,
        });
        return (
          <AriaToast toast={toast} className={root()}>
            {toast.content.variant ? (
              <span className={icon()} aria-hidden="true">
                {variantIcon[toast.content.variant]}
              </span>
            ) : null}
            <AriaToastContent className={content()}>
              <div className={title()}>{toast.content.title}</div>
              {toast.content.description ? (
                <div className={description()}>{toast.content.description}</div>
              ) : null}
            </AriaToastContent>
            <Button slot="close" className={close()} aria-label="Dismiss">
              <svg
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                aria-hidden="true"
                className="size-3.5"
              >
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </Button>
          </AriaToast>
        );
      }}
    </AriaToastRegion>
  );
}
