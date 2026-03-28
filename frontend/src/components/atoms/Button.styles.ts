import { tv } from "tailwind-variants";

export type ButtonVariant = "primary" | "secondary";
export type ButtonSize = "xs" | "sm" | "md";

export const buttonStyles = tv({
  slots: {
    base: "relative inline-flex press-scale items-center justify-center gap-2 border font-medium uppercase tracking-wide focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-faint",
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
      xs: { base: "px-2 py-1 text-[11px]" },
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

/** Style-only helper for non-Button elements that need button appearance. */
export function buttonStyle(
  opts: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {},
) {
  const { className, ...variants } = opts;
  return buttonStyles(variants).base({ className });
}
