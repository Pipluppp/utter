import { tv } from "tailwind-variants";

export const selectStyles = tv({
  slots: {
    root: "group",
    trigger:
      "flex w-full cursor-default items-center justify-between gap-2 border border-border bg-background px-4 py-3 text-sm text-foreground shadow-elevated transition-colors data-[hovered]:bg-muted data-[pressed]:bg-muted data-[focused]:border-ring data-[focused]:ring-2 data-[focused]:ring-ring data-[focused]:ring-offset-2 data-[focused]:ring-offset-background data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
    value: "truncate data-[placeholder]:text-faint",
    icon: "size-4 shrink-0 text-muted-foreground",
    popover:
      "w-[var(--trigger-width)] overflow-y-auto rounded-md border border-border bg-popover shadow-popover data-[placement=bottom]:origin-top data-[placement=top]:origin-bottom entering:animate-in entering:fade-in-0 entering:zoom-in-95 exiting:animate-out exiting:fade-out-0 exiting:zoom-out-95",
    item: "cursor-default rounded-sm my-1 press-scale-sm-y px-3 py-2 text-sm text-foreground outline-none data-[hovered]:bg-popover-hover data-[pressed]:bg-popover-hover data-[focused]:bg-popover-hover data-[selected]:bg-popover-selected data-[selected]:font-medium",
  },
});
