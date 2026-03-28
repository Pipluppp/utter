import { tv } from "tailwind-variants";

export const accountNoticeStyles = tv({
  base: "border px-4 py-3 text-[15px] leading-6 shadow-elevated",
  variants: {
    tone: {
      neutral: "border-border bg-subtle text-muted-foreground",
      success: "border-border-strong bg-subtle text-foreground",
      error: "border-red-400 bg-red-50 text-red-700",
    },
  },
  defaultVariants: {
    tone: "neutral",
  },
});
