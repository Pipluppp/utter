import type { ReactElement } from "react";
import { Tooltip as AriaTooltip, TooltipTrigger } from "react-aria-components";
import { cn } from "../../lib/cn";

interface TooltipProps {
  content: string;
  placement?: "top" | "bottom" | "left" | "right";
  delay?: number;
  closeDelay?: number;
  children: ReactElement;
}

export function Tooltip({ content, placement = "top", delay, closeDelay, children }: TooltipProps) {
  return (
    <TooltipTrigger delay={delay} closeDelay={closeDelay}>
      {children}
      <AriaTooltip
        placement={placement}
        offset={8}
        className={cn(
          "max-w-[200px] border border-border bg-background px-2 py-1 text-sm text-foreground shadow-lg",
          "entering:animate-in entering:fade-in entering:zoom-in-95",
          "exiting:animate-out exiting:fade-out exiting:zoom-out-95",
        )}
      >
        {content}
      </AriaTooltip>
    </TooltipTrigger>
  );
}
