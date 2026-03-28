import { tv } from "tailwind-variants";

export type ButtonVariant = "primary" | "secondary";
export type ButtonSize = "xs" | "sm" | "md";

/**
 * Button styles — uses data-[hovered/pressed/disabled]: (not plugin shorthands).
 * Hover and pressed colors are identical: on desktop press is already hovered,
 * on mobile touch there is no hover so data-[pressed]: provides the color change.
 * See lib/styles/AGENTS.md "Interaction States" for the full rules.
 */
export const buttonStyles = tv({
  slots: {
    base: "relative inline-flex press-scale items-center justify-center gap-2 border font-medium uppercase tracking-wide focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background data-[disabled]:cursor-not-allowed data-[disabled]:border-border data-[disabled]:bg-muted data-[disabled]:text-faint",
    spinner:
      "pointer-events-none absolute inset-0 m-auto size-4 animate-spin rounded-full border-2 border-r-transparent",
  },
  variants: {
    variant: {
      primary: {
        base: "border-foreground bg-foreground text-background data-[hovered]:bg-foreground/80 data-[hovered]:border-foreground/80 data-[pressed]:bg-foreground/80 data-[pressed]:border-foreground/80",
      },
      secondary: {
        base: "border-border bg-background text-foreground data-[hovered]:bg-surface-hover data-[pressed]:bg-surface-hover",
      },
    },
    size: {
      md: { base: "px-6 py-3 text-sm" },
      sm: { base: "px-3 py-2 text-caption" },
      xs: { base: "px-2 py-1 text-[11px]" },
    },
    square: {
      true: { base: "!p-0 shrink-0" },
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
    { square: true, size: "md", class: { base: "size-[46px]" } },
    { square: true, size: "sm", class: { base: "size-[37px]" } },
    { square: true, size: "xs", class: { base: "size-[28px]" } },
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
