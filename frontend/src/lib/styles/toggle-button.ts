import { tv } from "tailwind-variants";

export const toggleButtonStyles = tv({
  base: "cursor-default press-scale px-3 py-2 text-caption font-medium uppercase tracking-wide focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background bg-background text-foreground",
  variants: {
    style: {
      inverted: "data-[hovered]:bg-subtle data-[pressed]:bg-subtle data-[selected]:bg-foreground data-[selected]:text-background",
      surface: "data-[hovered]:bg-surface-hover data-[pressed]:bg-surface-hover data-[selected]:bg-surface-selected",
    },
    bordered: {
      true: "border border-border",
    },
    disabled: {
      true: "data-[disabled]:cursor-not-allowed data-[disabled]:bg-muted data-[disabled]:text-faint data-[disabled]:data-[hovered]:bg-muted data-[disabled]:data-[pressed]:bg-muted",
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
      class: "data-[selected]:border-border-strong",
    },
  ],
  defaultVariants: {
    style: "inverted",
    size: "sm",
  },
});
