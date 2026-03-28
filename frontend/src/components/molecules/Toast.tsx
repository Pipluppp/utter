import {
  UNSTABLE_Toast as AriaToast,
  UNSTABLE_ToastContent as AriaToastContent,
  UNSTABLE_ToastRegion as AriaToastRegion,
  Button,
  UNSTABLE_ToastQueue as ToastQueue,
} from "react-aria-components";

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

export function GlobalToastRegion() {
  return (
    <AriaToastRegion queue={toastQueue}>
      {({ toast }) => {
        const { root, icon, content, title, description, close } = toastStyles({
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
