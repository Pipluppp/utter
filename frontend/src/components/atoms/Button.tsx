import type { ReactNode } from "react";
import { Button as AriaButton, type ButtonProps as AriaButtonProps } from "react-aria-components";
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
  const { base, spinner } = buttonStyles({ variant, size, square, block, isPending });
  return (
    <AriaButton
      className={base({ className })}
      isDisabled={isDisabled || isPending}
      isPending={isPending}
      {...props}
    >
      {children}
      {isPending ? <span className={spinner()} /> : null}
    </AriaButton>
  );
}
