import { Link } from "react-router-dom";
import { buttonStyles } from "../../components/atoms/Button";
import { cn } from "../../lib/cn";
import { formatCredits, useAccountPageData } from "./accountData";
import { AccountOverviewSkeleton } from "./accountSkeletons";
import { AccountEmptyState, AccountPanel } from "./accountUi";

function PricingSummary() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="border border-border bg-subtle px-4 py-4 shadow-elevated">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-foreground/65">
          Design preview
        </div>
        <div className="mt-2 text-3xl font-pixel font-medium text-foreground">2,400</div>
        <div className="mt-2 text-[15px] leading-6 text-foreground/68">
          Credits per voice design preview.
        </div>
      </div>
      <div className="border border-border bg-subtle px-4 py-4 shadow-elevated">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-foreground/65">
          Clone finalize
        </div>
        <div className="mt-2 text-3xl font-pixel font-medium text-foreground">200</div>
        <div className="mt-2 text-[15px] leading-6 text-foreground/68">
          Credits per voice clone finalization.
        </div>
      </div>
    </div>
  );
}

export function AccountOverviewPage() {
  const { activity, credits } = useAccountPageData();

  if (!credits) {
    return <AccountOverviewSkeleton />;
  }

  const recentActivity = activity.slice(0, 4);
  const balance = credits.balance;

  return (
    <div className="space-y-5">
      <AccountPanel
        kicker="Overview"
        title="Balance and recent account activity"
        description="See available credits, pricing, and the latest account activity."
      >
        <div className="grid gap-4 lg:grid-cols-[1.4fr_0.9fr]">
          <div className="border border-border bg-subtle p-5 shadow-elevated">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-foreground/65">
              Credits available
            </div>
            <div className="mt-4 text-5xl font-pixel font-medium leading-none text-foreground sm:text-6xl">
              {formatCredits(balance)}
            </div>
            <div className="mt-4 max-w-md text-[15px] leading-7 text-foreground/72">
              {credits.credit_unit}. Credits update automatically after purchases and usage.
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link to="/account/credits" className={buttonStyles({ size: "sm" })}>
                Buy credits
              </Link>
              <Link to="/history" className={buttonStyles({ variant: "secondary", size: "sm" })}>
                View history
              </Link>
            </div>
          </div>

          <div className="border border-border bg-background p-5 shadow-elevated">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-foreground/65">
              Quick links
            </div>
            <div className="mt-4 space-y-2">
              <Link
                to="/account"
                className={cn(
                  "flex items-center justify-between border border-border px-4 py-3.5 text-[15px] text-foreground transition-colors hover:bg-subtle",
                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                )}
              >
                <span>Edit profile</span>
                <span className="text-foreground/62">Identity</span>
              </Link>
              <Link
                to="/account/credits"
                className={cn(
                  "flex items-center justify-between border border-border px-4 py-3.5 text-[15px] text-foreground transition-colors hover:bg-subtle",
                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                )}
              >
                <span>Manage credits</span>
                <span className="text-foreground/62">Balance and packs</span>
              </Link>
              <Link
                to="/history"
                className={cn(
                  "flex items-center justify-between border border-border px-4 py-3.5 text-[15px] text-foreground transition-colors hover:bg-subtle",
                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                )}
              >
                <span>View history</span>
                <span className="text-foreground/62">Past generations</span>
              </Link>
            </div>
          </div>
        </div>
      </AccountPanel>

      <AccountPanel
        kicker="Pricing"
        title="Voice action pricing"
        description="Flat credit costs for design previews and clone finalization."
      >
        <PricingSummary />
      </AccountPanel>

      <AccountPanel
        kicker="Recent activity"
        title="Latest account activity"
        description="Recent credit purchases and usage tied to your account."
      >
        {recentActivity.length === 0 ? (
          <AccountEmptyState
            title="No account activity yet"
            body="Credit purchases and usage will show up here once you start working."
          />
        ) : (
          <div className="space-y-3">
            {recentActivity.map((item) => (
              <div
                key={item.id}
                className="border border-border bg-subtle px-4 py-4 shadow-elevated"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[15px] font-medium text-foreground">{item.title}</div>
                    <div className="mt-2 text-[15px] leading-7 text-foreground/68">
                      {item.detail}
                    </div>
                  </div>
                  <div className="text-right text-[15px]">
                    <div className="font-medium text-foreground">{item.amountLabel}</div>
                    <div className="mt-2 text-foreground/62">{item.createdLabel}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </AccountPanel>
    </div>
  );
}
