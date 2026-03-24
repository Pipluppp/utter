import { Separator as AriaSeparator, type SeparatorProps } from "react-aria-components";
import { cn } from "../../lib/cn";

interface AppSeparatorProps extends SeparatorProps {
  className?: string;
}

export function Separator({ orientation = "horizontal", className, ...props }: AppSeparatorProps) {
  return (
    <AriaSeparator
      orientation={orientation}
      className={cn(
        "bg-border",
        orientation === "vertical" ? "w-px self-stretch" : "h-px w-full",
        className,
      )}
      {...props}
    />
  );
}
