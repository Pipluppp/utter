import { NavLink, Outlet } from "react-router-dom";
import { Button } from "../../components/ui/Button";
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
    label: "Overview",
    desc: "Balance, trials, activity",
  },
  {
    to: "/account/profile",
    label: "Profile",
    desc: "Identity and sign out",
  },
  {
    to: "/account/credits",
    label: "Credits",
    desc: "Packs and purchase activity",
  },
];

function AccountNavLink({ item }: { item: AccountNavItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.to === "/account"}
      className={({ isActive }) =>
        cn(
          "min-w-[190px] border border-border bg-background px-4 py-3.5 transition-colors",
          "hover:bg-subtle",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          isActive && "border-border-strong bg-subtle",
        )
      }
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-foreground">
        {item.label}
      </div>
      <div className="mt-1.5 text-[13px] leading-5 text-foreground/68">{item.desc}</div>
    </NavLink>
  );
}

export function AccountLayoutPage() {
  const account = useAccountData();

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
              onClick={() => void account.refresh({ background: true })}
              loading={account.refreshing}
            >
              Retry
            </Button>
          </div>
        </AccountNotice>
      ) : null}

      <nav aria-label="Account sections" className="overflow-x-auto border-b border-border pb-2">
        <div className="flex min-w-max gap-2">
          {navItems.map((item) => (
            <AccountNavLink key={item.to} item={item} />
          ))}
        </div>
      </nav>

      <section className="min-w-0">
        <Outlet context={account} />
      </section>
    </div>
  );
}
