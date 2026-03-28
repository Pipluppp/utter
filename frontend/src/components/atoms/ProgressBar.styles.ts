import { tv } from "tailwind-variants";

export const progressBarStyles = tv({
  slots: {
    root: "flex flex-col gap-1",
    labelRow: "flex items-center justify-between text-xs text-muted-foreground",
    track: "h-1.5 w-full overflow-hidden bg-muted",
    fill: "h-full bg-foreground transition-all duration-300",
  },
  variants: {
    isIndeterminate: {
      true: {
        fill: "w-1/3 animate-[indeterminate_1.5s_ease-in-out_infinite]",
      },
    },
  },
});
