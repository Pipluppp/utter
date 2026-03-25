import { Button, Dialog, DialogTrigger, Popover } from "react-aria-components";
import { cn } from "../../lib/cn";

export function InfoTip({
  align = "start",
  label = "Information",
  children,
}: {
  align?: "start" | "end";
  label?: string;
  children: React.ReactNode;
}) {
  const placement = align === "end" ? "bottom end" : "bottom start";

  return (
    <DialogTrigger>
      <Button
        aria-label={label}
        className={cn(
          "inline-flex size-6 items-center justify-center rounded-full border border-border bg-background text-[12px] font-semibold text-muted-foreground",
          "hovered:bg-surface-hover hovered:text-foreground",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        )}
      >
        i
      </Button>
      <Popover
        placement={placement}
        offset={8}
        shouldFlip
        className={cn(
          "w-[min(320px,calc(100vw-2rem))] border border-border bg-background p-3 text-sm text-muted-foreground shadow-lg",
          "entering:animate-in entering:fade-in entering:zoom-in-95",
          "exiting:animate-out exiting:fade-out exiting:zoom-out-95",
        )}
      >
        <Dialog aria-label={label} className="outline-none">
          {children}
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}
