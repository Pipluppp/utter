import { Tab, TabList, Tabs } from "react-aria-components";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Button } from "../../components/atoms/Button";
import { Separator } from "../../components/atoms/Separator";
import { cn } from "../../lib/cn";
import { useAccountData } from "./accountData";
import { AccountNotice } from "./accountUi";

type AccountNavItem = {
  to: string;
  label: string;
  desc: string;
};

const navItems: AccountNavItem[] = [
  {
    to: "/account",
    label: "Profile",
    desc: "Identity and sign out",
  },
  {
    to: "/account/overview",
    label: "Overview",
    desc: "Balance, trials, activity",
  },
  {
    to: "/account/credits",
    label: "Credits",
    desc: "Packs and purchase activity",
  },
];

export function AccountLayoutPage() {
  const account = useAccountData();
  const location = useLocation();
  const navigate = useNavigate();

  // Determine selected tab from current path.
  // Exact match for "/account" (Profile), prefix match for sub-routes.
  const selectedTab =
    navItems.find((item) =>
      item.to === "/account"
        ? location.pathname === "/account"
        : location.pathname.startsWith(item.to),
    )?.to ?? "/account";

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-foreground/65">
          Account
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-pixel font-medium uppercase tracking-[2px] text-foreground md:text-3xl">
              Your account
            </h2>
            <p className="mt-3 max-w-2xl text-[15px] leading-7 text-foreground/72">
              Manage your profile, check your balance, and buy credits when you need them.
            </p>
          </div>
        </div>
      </div>

      {account.error ? (
        <AccountNotice tone="error">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{account.error}</span>
            <Button
              variant="secondary"
              size="sm"
              onPress={() => void account.refresh({ background: true })}
              isPending={account.refreshing}
            >
              Retry
            </Button>
          </div>
        </AccountNotice>
      ) : null}

      <Tabs selectedKey={selectedTab} onSelectionChange={(key) => navigate(key as string)}>
        <TabList
          aria-label="Account sections"
          className="flex min-w-max gap-2 overflow-x-auto pb-2"
        >
          {navItems.map((item) => (
            <Tab
              key={item.to}
              id={item.to}
              className={cn(
                "min-w-[190px] border border-border bg-background px-4 py-3.5",
                "hover:bg-surface-hover",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                "selected:border-border-strong selected:bg-surface-selected",
                "cursor-default press-scale-sm outline-none",
              )}
            >
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-foreground">
                {item.label}
              </div>
              <div className="mt-1.5 text-[13px] leading-5 text-foreground/68">{item.desc}</div>
            </Tab>
          ))}
        </TabList>
        <Separator />
      </Tabs>

      <section className="min-w-0">
        <Outlet context={account} />
      </section>
    </div>
  );
}
