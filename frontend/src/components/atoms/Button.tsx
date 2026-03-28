import type { ReactNode } from "react";
import {
  Button as AriaButton,
  composeRenderProps,
  type ButtonProps as AriaButtonProps,
} from "react-aria-components";
import { buttonStyles, type ButtonSize, type ButtonVariant } from "./Button.styles";

export { buttonStyle, buttonStyles, type ButtonSize, type ButtonVariant } from "./Button.styles";

interface ButtonProps extends Omit<AriaButtonProps, "children"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  square?: boolean;
  block?: boolean;
  className?: string;
  children?: ReactNode;
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  square,
  block,
  isPending,
  isDisabled,
  children,
  ...props
}: ButtonProps) {
  const styles = buttonStyles({ variant, size, square, block, isPending });
  return (
    <AriaButton
      className={styles.base({ className })}
      isDisabled={isDisabled || isPending}
      isPending={isPending}
      {...props}
    >
      {composeRenderProps(children, (kids, { isPending: pending }) => (
        <>
          <span className={styles.label()}>{kids}</span>
          {pending && (
            <span aria-hidden className={styles.spinnerWrap()}>
              <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  className="opacity-25"
                />
                <path
                  d="M12 2a10 10 0 0 1 10 10"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          )}
        </>
      ))}
    </AriaButton>
  );
}
