import { tv } from "tailwind-variants";

const message = tv({
  base: "border px-4 py-3 text-sm shadow-elevated",
  variants: {
    variant: {
      error: "border-status-error-border bg-status-error-bg text-status-error",
      success: "border-status-success-border bg-status-success-bg text-status-success",
      info: "border-border bg-subtle text-foreground",
    },
  },
});

export function Message({
  variant,
  children,
}: {
  variant: "error" | "success" | "info";
  children: React.ReactNode;
}) {
  return (
    <div
      className={message({ variant })}
      role={variant === "error" ? "alert" : "status"}
      aria-live={variant === "error" ? "assertive" : "polite"}
    >
      {children}
    </div>
  );
}
