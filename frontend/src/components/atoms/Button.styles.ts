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
    base: "relative inline-flex press-scale items-center justify-center gap-2 border font-medium uppercase tracking-wide focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background not-data-[pending]:data-[disabled]:cursor-not-allowed not-data-[pending]:data-[disabled]:border-border not-data-[pending]:data-[disabled]:bg-muted not-data-[pending]:data-[disabled]:text-faint",
    /** Visible label wrapper — hidden with visibility:hidden when pending so
     *  the button keeps its intrinsic size while the spinner overlays. */
    label: "inline-flex items-center gap-2",
    /** Centered spinner overlay — always in the a11y tree when pending
     *  (opacity-0 initially, opacity-100 when shown). */
    spinnerWrap: "pointer-events-none absolute inset-0 flex items-center justify-center opacity-0",
  },
  variants: {
    variant: {
      primary: {
        base: "border-foreground bg-foreground text-background data-[hovered]:bg-foreground/80 data-[hovered]:border-foreground/80 data-[pressed]:bg-foreground/80 data-[pressed]:border-foreground/80",
        spinnerWrap: "text-background",
      },
      secondary: {
        base: "border-border bg-background text-foreground data-[hovered]:bg-surface-hover data-[pressed]:bg-surface-hover",
        spinnerWrap: "text-foreground/60",
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
      true: {
        label: "invisible",
        spinnerWrap: "opacity-100",
      },
    },
  },
  compoundVariants: [
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
