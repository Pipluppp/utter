import { tv } from "tailwind-variants";
import { button } from "../../components/atoms/Button";

export const paginationButton = tv({
  extend: button,
  slots: {
    base: "disabled:opacity-50",
  },
  defaultVariants: {
    variant: "secondary",
    size: "sm",
  },
});
