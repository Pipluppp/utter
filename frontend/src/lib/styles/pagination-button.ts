import { tv } from "tailwind-variants";
import { buttonStyles } from "../../components/atoms/Button.styles";

export const paginationButtonStyles = tv({
  extend: buttonStyles,
  slots: {
    base: "disabled:opacity-50",
  },
  defaultVariants: {
    variant: "secondary",
    size: "sm",
  },
});
