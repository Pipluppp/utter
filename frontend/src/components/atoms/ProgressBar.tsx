import {
  ProgressBar as AriaProgressBar,
  type ProgressBarProps as AriaProgressBarProps,
} from "react-aria-components";
import { tv } from "tailwind-variants";

const progressBar = tv({
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

interface ProgressBarProps extends Omit<AriaProgressBarProps, "children"> {
  label?: string;
  className?: string;
}

export function ProgressBar({ label, className, ...props }: ProgressBarProps) {
  return (
    <AriaProgressBar {...props} className={progressBar().root({ className })}>
      {({ percentage, valueText, isIndeterminate }) => {
        const { labelRow, track, fill } = progressBar({ isIndeterminate });
        return (
          <>
            {label || valueText ? (
              <div className={labelRow()}>
                {label ? <span>{label}</span> : null}
                {!isIndeterminate && valueText ? (
                  <span className="tabular-nums">{valueText}</span>
                ) : null}
              </div>
            ) : null}
            <div className={track()} role="presentation">
              <div
                className={fill()}
                style={!isIndeterminate ? { width: `${percentage ?? 0}%` } : undefined}
              />
            </div>
          </>
        );
      }}
    </AriaProgressBar>
  );
}
