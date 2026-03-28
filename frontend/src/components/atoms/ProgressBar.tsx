import {
  ProgressBar as AriaProgressBar,
  type ProgressBarProps as AriaProgressBarProps,
} from "react-aria-components";
import { progressBarStyles } from "./ProgressBar.styles";

interface ProgressBarProps extends Omit<AriaProgressBarProps, "children"> {
  label?: string;
  className?: string;
}

export function ProgressBar({ label, className, ...props }: ProgressBarProps) {
  return (
    <AriaProgressBar {...props} className={progressBarStyles().root({ className })}>
      {({ percentage, valueText, isIndeterminate }) => {
        const { labelRow, track, fill } = progressBarStyles({ isIndeterminate });
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
