import { messageStyles } from "./Message.styles";

export function Message({
  variant,
  children,
}: {
  variant: "error" | "success" | "info";
  children: React.ReactNode;
}) {
  return (
    <div
      className={messageStyles({ variant })}
      role={variant === "error" ? "alert" : "status"}
      aria-live={variant === "error" ? "assertive" : "polite"}
    >
      {children}
    </div>
  );
}
