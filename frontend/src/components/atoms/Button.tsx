import type { ReactNode } from "react";
import { Button as AriaButton, type ButtonProps as AriaButtonProps } from "react-aria-components";
import { tv } from "tailwind-variants";

export type ButtonVariant = "primary" | "secondary";
export type ButtonSize = "sm" | "md";

export const button = tv({
  slots: {
    base: "relative inline-flex cursor-default press-scale items-center justify-center gap-2 border font-medium uppercase tracking-wide focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-faint",
    spinner:
      "pointer-events-none absolute inset-0 m-auto size-4 animate-spin rounded-full border-2 border-r-transparent",
  },
  variants: {
    variant: {
      primary: {
        base: "border-foreground bg-foreground text-background hover:bg-foreground/80 hover:border-foreground/80",
      },
      secondary: {
        base: "border-border bg-background text-foreground hover:bg-surface-hover",
      },
    },
    size: {
      md: { base: "px-6 py-3 text-sm" },
      sm: { base: "px-3 py-2 text-caption" },
    },
    block: {
      true: { base: "w-full press-scale-sm-y" },
    },
    isPending: {
      true: { base: "text-transparent" },
    },
  },
  compoundVariants: [
    { variant: "primary", isPending: true, class: { spinner: "border-background/70" } },
    { variant: "secondary", isPending: true, class: { spinner: "border-foreground/60" } },
  ],
  defaultVariants: {
    variant: "primary",
    size: "md",
  },
});

interface ButtonProps extends Omit<AriaButtonProps, "children"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  className?: string;
  children?: ReactNode;
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  block,
  isPending,
  isDisabled,
  children,
  ...props
}: ButtonProps) {
  const { base, spinner } = button({ variant, size, block, isPending });
  return (
    <AriaButton
      className={base({ className })}
      isDisabled={isDisabled || isPending}
      isPending={isPending}
      {...props}
    >
      {children}
      {isPending ? <span className={spinner()} /> : null}
    </AriaButton>
  );
}
