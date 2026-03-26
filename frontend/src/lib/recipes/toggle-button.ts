import { tv } from "tailwind-variants";

export const toggleButton = tv({
  base: "cursor-pointer px-3 py-2 text-caption font-medium uppercase tracking-wide transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background bg-background text-foreground",
  variants: {
    style: {
      inverted: "hover:bg-subtle selected:bg-foreground selected:text-background",
      surface: "hover:bg-surface-hover selected:bg-surface-selected",
    },
    bordered: {
      true: "border border-border",
    },
    disabled: {
      true: "disabled:cursor-not-allowed disabled:bg-muted disabled:text-faint disabled:hover:bg-muted",
    },
    size: {
      sm: "px-3 py-2 text-caption",
      md: "px-4 py-2 text-xs",
    },
  },
  compoundVariants: [
    {
      style: "inverted",
      bordered: true,
      class: "selected:border-border-strong",
    },
  ],
  defaultVariants: {
    style: "inverted",
    size: "sm",
  },
});
