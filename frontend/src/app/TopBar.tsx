import { useLocation } from "@tanstack/react-router";
import { User } from "lucide-react";
import { Button as AriaButton, Disclosure, DisclosurePanel, Heading } from "react-aria-components";
import { Kbd } from "../components/atoms/Kbd";
import { AppLink, NavAppLink } from "../components/atoms/Link";
import { Separator } from "../components/atoms/Separator";
import { TaskBadge } from "../components/organisms/TaskBadge";
import { HeaderPendingAuthSkeleton } from "../components/templates/RouteSkeletons";
import { cn } from "../lib/cn";
import type { NavSectionItem, NavVariant } from "./navigation";

function routeItem(
  label: string,
  to: string,
  options?: {
    shortcut?: string;
    showTaskBadge?: boolean;
    showProfileIcon?: boolean;
  },
): NavSectionItem {
  return {
    kind: "route",
    label,
    to,
    shortcut: options?.shortcut,
    showTaskBadge: options?.showTaskBadge,
    showProfileIcon: options?.showProfileIcon,
  };
}

function hashItem(label: string, hash: "#demos" | "#features" | "#pricing") {
  return {
    kind: "hash" as const,
    label,
    hash,
  };
}

function toHref(to: string): string {
  return to;
}

function isPathCurrent(pathname: string, to: string): boolean {
  if (to === "/") return pathname === "/";
  return pathname.startsWith(to);
}

function getSectionKey(section: NavSectionItem[]) {
  return section
    .map((item) => (item.kind === "hash" ? item.hash : `${String(item.to)}:${item.label}`))
    .join("|");
}

function getSections(variant: NavVariant, signInHref: string) {
  if (variant === "marketing_public") {
    return [
      [
        hashItem("Demo", "#demos"),
        hashItem("Features", "#features"),
        hashItem("Pricing", "#pricing"),
      ],
      [routeItem("About", "/about"), routeItem("Sign in", signInHref)],
    ];
  }

  if (variant === "marketing_member") {
    return [
      [
        routeItem("Clone", "/clone", { shortcut: "c" }),
        routeItem("Generate", "/generate", { shortcut: "g" }),
        routeItem("Design", "/design", { shortcut: "d" }),
      ],
      [
        routeItem("Voices", "/voices"),
        routeItem("Tasks", "/tasks", { showTaskBadge: true }),
        routeItem("History", "/history"),
      ],
      [routeItem("Account", "/account", { showProfileIcon: true })],
    ];
  }

  if (variant === "app_member") {
    return [
      [
        routeItem("Clone", "/clone", { shortcut: "c" }),
        routeItem("Generate", "/generate", { shortcut: "g" }),
        routeItem("Design", "/design", { shortcut: "d" }),
      ],
      [
        routeItem("Voices", "/voices"),
        routeItem("Tasks", "/tasks", { showTaskBadge: true }),
        routeItem("History", "/history"),
      ],
      [routeItem("Account", "/account", { showProfileIcon: true })],
    ];
  }

  return [];
}

function baseNavItemClassName(active: boolean) {
  return cn(
    "inline-flex items-center gap-1.5 px-3 py-2 text-caption font-medium uppercase tracking-wide text-foreground/80 press-scale-sm-y data-[hovered]:bg-muted data-[hovered]:text-foreground data-[pressed]:bg-muted data-[pressed]:text-foreground",
    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    active && "bg-muted text-foreground",
  );
}

function NavItemContent({
  label,
  shortcut,
  showTaskBadge,
  showProfileIcon,
}: {
  label: string;
  shortcut?: string;
  showTaskBadge?: boolean;
  showProfileIcon?: boolean;
}) {
  return (
    <>
      <span className="flex items-center gap-2">
        {showProfileIcon ? <User className="icon-sm" aria-hidden="true" /> : null}
        <span>{label}</span>
        {showTaskBadge ? <TaskBadge /> : null}
      </span>
      {shortcut ? <Kbd>{shortcut}</Kbd> : null}
    </>
  );
}

function DesktopNavItem({
  item,
  currentHash,
  pathname,
}: {
  item: NavSectionItem;
  currentHash: string;
  pathname: string;
}) {
  if (item.kind === "hash") {
    const active = currentHash === item.hash;
    return (
      <AppLink href={`/#${item.hash.slice(1)}`} className={baseNavItemClassName(active)}>
        {item.label}
      </AppLink>
    );
  }

  const isCurrent = isPathCurrent(pathname, item.to);
  return (
    <NavAppLink
      href={toHref(item.to)}
      isCurrent={isCurrent}
      aria-keyshortcuts={item.shortcut ? item.shortcut.toUpperCase() : undefined}
      className={baseNavItemClassName(isCurrent)}
    >
      <NavItemContent
        label={item.label}
        shortcut={item.shortcut}
        showTaskBadge={item.showTaskBadge}
        showProfileIcon={item.showProfileIcon}
      />
    </NavAppLink>
  );
}

function MobileNavItem({
  item,
  currentHash,
  pathname,
  onPress,
}: {
  item: NavSectionItem;
  currentHash: string;
  pathname: string;
  onPress: () => void;
}) {
  const itemClassName = (active: boolean) =>
    cn(
      "flex w-full items-center justify-between px-3 py-3 text-caption font-medium uppercase tracking-wide text-foreground/80 press-scale-sm-y data-[hovered]:bg-surface-subtle-hover data-[hovered]:text-foreground data-[pressed]:bg-surface-subtle-hover data-[pressed]:text-foreground",
      "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface-subtle",
      active && "bg-surface-subtle-hover text-foreground",
    );

  if (item.kind === "hash") {
    const active = currentHash === item.hash;
    return (
      <AppLink href={`/#${item.hash.slice(1)}`} onPress={onPress} className={itemClassName(active)}>
        <span>{item.label}</span>
        <span />
      </AppLink>
    );
  }

  const isCurrent = isPathCurrent(pathname, item.to);
  return (
    <NavAppLink
      href={toHref(item.to)}
      isCurrent={isCurrent}
      onPress={onPress}
      aria-keyshortcuts={item.shortcut ? item.shortcut.toUpperCase() : undefined}
      className={itemClassName(isCurrent)}
    >
      <NavItemContent
        label={item.label}
        showTaskBadge={item.showTaskBadge}
        showProfileIcon={item.showProfileIcon}
      />
    </NavAppLink>
  );
}

export function TopBar({
  variant,
  currentHash,
  signInHref,
  menuOpen,
  onMenuOpenChange,
}: {
  variant: NavVariant;
  currentHash: string;
  signInHref: string;
  menuOpen: boolean;
  onMenuOpenChange: (isOpen: boolean) => void;
}) {
  const sections = getSections(variant, signInHref);
  const { pathname } = useLocation();
  const showMenuToggle =
    variant === "marketing_public" || variant === "marketing_member" || variant === "app_member";

  if (!showMenuToggle) {
    return (
      <header className="sticky top-0 z-10 border-b border-border bg-background">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4 md:px-6">
          <AppLink
            href="/"
            className="text-[16px] font-pixel font-medium tracking-[2px] uppercase focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            UTTER
          </AppLink>

          {variant === "auth_minimal" ? (
            <nav className="flex items-center gap-1">
              <NavAppLink
                href="/"
                isCurrent={pathname === "/"}
                className={baseNavItemClassName(pathname === "/")}
              >
                Back to home
              </NavAppLink>
            </nav>
          ) : variant === "app_pending_auth" ? (
            <HeaderPendingAuthSkeleton />
          ) : null}
        </div>
      </header>
    );
  }

  return (
    <Disclosure isExpanded={menuOpen} onExpandedChange={onMenuOpenChange}>
      <header
        className={cn(
          "sticky top-0 z-10 border-b bg-background",
          menuOpen ? "border-transparent md:border-border" : "border-border",
        )}
      >
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4 md:px-6">
          <AppLink
            href="/"
            className="text-[16px] font-pixel font-medium tracking-[2px] uppercase focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            UTTER
          </AppLink>

          <nav className="hidden items-center gap-1 md:flex">
            {sections.map((section, index) => (
              <div key={getSectionKey(section)} className="contents">
                {index > 0 ? (
                  <Separator orientation="vertical" className="mx-2 h-4 self-center" />
                ) : null}
                {section.map((item) => (
                  <DesktopNavItem
                    key={item.kind === "hash" ? item.hash : `${String(item.to)}:${item.label}`}
                    item={item}
                    currentHash={currentHash}
                    pathname={pathname}
                  />
                ))}
              </div>
            ))}
          </nav>

          <Heading className="contents md:hidden" level={2}>
            <AriaButton
              slot="trigger"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              className={cn(
                "inline-flex items-center justify-center border border-border bg-background p-2 text-muted-foreground press-scale data-[hovered]:bg-muted data-[hovered]:text-foreground data-[pressed]:bg-muted data-[pressed]:text-foreground",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              )}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                aria-hidden="true"
                className="size-5"
              >
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </AriaButton>
          </Heading>
        </div>
      </header>

      <DisclosurePanel
        className={cn("md:hidden", menuOpen && "border-b border-border bg-surface-subtle")}
      >
        <div className="mx-auto w-full max-w-5xl px-4 py-4 md:px-6">
          <div className="space-y-1">
            {sections.map((section, index) => (
              <div key={getSectionKey(section)}>
                {index > 0 ? (
                  <div role="separator" className="my-4 h-px w-full bg-border-subtle" />
                ) : null}
                {section.map((item) => (
                  <MobileNavItem
                    key={item.kind === "hash" ? item.hash : `${String(item.to)}:${item.label}`}
                    item={item}
                    currentHash={currentHash}
                    pathname={pathname}
                    onPress={() => onMenuOpenChange(false)}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </DisclosurePanel>
    </Disclosure>
  );
}
