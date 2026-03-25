import { Link as AriaLink, type LinkProps as AriaLinkProps } from "react-aria-components";
import { cn } from "../../lib/cn";

interface AppLinkProps extends AriaLinkProps {
  className?: string;
}

interface NavAppLinkProps extends AppLinkProps {
  isCurrent?: boolean;
}

export function AppLink({ className, ...props }: AppLinkProps) {
  return (
    <AriaLink
      {...props}
      className={cn(
        "cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
    />
  );
}

export function NavAppLink({ isCurrent, className, ...props }: NavAppLinkProps) {
  return (
    <AriaLink
      {...props}
      data-current={isCurrent ? "true" : undefined}
      className={cn(
        "cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
    />
  );
}
