import { createLink, type LinkComponentProps } from "@tanstack/react-router";
import { Link as AriaLink } from "react-aria-components";
import { cn } from "../../lib/cn";

const CreatedLink = createLink(AriaLink);

type CreatedLinkProps = LinkComponentProps<typeof AriaLink>;

interface AppLinkProps extends CreatedLinkProps {
  className?: string;
}

interface NavAppLinkProps extends AppLinkProps {
  isCurrent?: boolean;
}

/**
 * Bare RAC + TanStack Router link. No default styling — pass your own className.
 * Use this for one-off styled links (e.g. button-styled hero CTAs).
 */
export const Link = CreatedLink;

export function AppLink({ className, ...props }: AppLinkProps) {
  return (
    <CreatedLink
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
    <CreatedLink
      {...props}
      data-current={isCurrent ? "true" : undefined}
      className={cn(
        "cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
    />
  );
}
