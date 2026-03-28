import { tv } from "tailwind-variants";

export const inputStyles = tv({
  base: "w-full border border-border bg-background px-4 py-3 text-sm text-foreground shadow-elevated placeholder:text-faint transition-colors hover:border-border-strong focus:border-border-strong focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  variants: {
    multiline: {
      true: "min-h-36 resize-y",
    },
  },
});
