import {
  ProgressBar as AriaProgressBar,
  type ProgressBarProps as AriaProgressBarProps,
} from "react-aria-components";
import { cn } from "../../lib/cn";

interface ProgressBarProps extends Omit<AriaProgressBarProps, "children"> {
  label?: string;
  className?: string;
}

export function ProgressBar({ label, className, ...props }: ProgressBarProps) {
  return (
    <AriaProgressBar {...props} className={cn("flex flex-col gap-1", className)}>
      {({ percentage, valueText, isIndeterminate }) => (
        <>
          {label || valueText ? (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              {label ? <span>{label}</span> : null}
              {!isIndeterminate && valueText ? (
                <span className="tabular-nums">{valueText}</span>
              ) : null}
            </div>
          ) : null}
          <div className="h-1.5 w-full overflow-hidden bg-muted" role="presentation">
            <div
              className={cn(
                "h-full bg-foreground transition-all duration-300",
                isIndeterminate && "w-1/3 animate-[indeterminate_1.5s_ease-in-out_infinite]",
              )}
              style={!isIndeterminate ? { width: `${percentage ?? 0}%` } : undefined}
            />
          </div>
        </>
      )}
    </AriaProgressBar>
  );
}
