import { cn } from "../../lib/cn";

export function Message({
  variant,
  children,
}: {
  variant: "error" | "success" | "info";
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "border px-4 py-3 text-sm shadow-elevated",
        variant === "error" && "border-status-error-border bg-status-error-bg text-status-error",
        variant === "success" &&
          "border-status-success-border bg-status-success-bg text-status-success",
        variant === "info" && "border-border bg-subtle text-foreground",
      )}
      role={variant === "error" ? "alert" : "status"}
      aria-live={variant === "error" ? "assertive" : "polite"}
    >
      {children}
    </div>
  );
}
