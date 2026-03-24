import { useEffect, useMemo, useState } from "react";
import { ToggleButton, ToggleButtonGroup } from "react-aria-components";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button, buttonStyles } from "../../components/ui/Button";
import { creditPacks } from "../../content/plans";
import { apiJson } from "../../lib/api";
import { cn } from "../../lib/cn";
import { formatCredits, formatUsd, useAccountPageData } from "./accountData";
import { AccountCreditsSkeleton } from "./accountSkeletons";
import { AccountEmptyState, AccountNotice, AccountPanel } from "./accountUi";

type ActivityFilter = "all" | "purchases" | "usage";

export function AccountCreditsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { activity, credits, refresh, refreshing } = useAccountPageData();
  const [activePackId, setActivePackId] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");

  const checkoutStatus = useMemo(() => {
    const value = new URLSearchParams(location.search).get("checkout");
    return value === "success" || value === "cancel" ? value : null;
  }, [location.search]);

  useEffect(() => {
    if (checkoutStatus === "success") {
      void refresh({ background: true });
    }
  }, [checkoutStatus, refresh]);

  const filteredActivity = useMemo(() => {
    if (activityFilter === "all") {
      return activity;
    }

    const category = activityFilter === "purchases" ? "purchase" : "usage";
    return activity.filter((item) => item.category === category);
  }, [activity, activityFilter]);

  async function startCheckout(packId: string) {
    setCheckoutError(null);
    setActivePackId(packId);

    try {
      const response = await apiJson<{ url: string }>("/api/billing/checkout", {
        method: "POST",
        json: { pack_id: packId },
      });

      if (!response.url) {
        throw new Error("Checkout URL missing from response.");
      }

      window.location.assign(response.url);
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : "Failed to start checkout.");
      setActivePackId(null);
    }
  }

  function clearCheckoutStatus() {
    const params = new URLSearchParams(location.search);
    params.delete("checkout");
    const nextSearch = params.toString();
    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : "",
      },
      { replace: true },
    );
  }

  return (
    <div className="space-y-5">
      {checkoutStatus === "success" ? (
        <AccountNotice tone="success">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>Checkout completed. Your balance is refreshing now.</span>
            <button
              type="button"
              onClick={clearCheckoutStatus}
              className="text-sm font-medium underline underline-offset-4"
            >
              Dismiss
            </button>
          </div>
        </AccountNotice>
      ) : null}

      {checkoutStatus === "cancel" ? (
        <AccountNotice tone="neutral">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>Checkout was cancelled. Your balance has not changed.</span>
            <button
              type="button"
              onClick={clearCheckoutStatus}
              className="text-sm font-medium underline underline-offset-4"
            >
              Dismiss
            </button>
          </div>
        </AccountNotice>
      ) : null}

      {checkoutError ? <AccountNotice tone="error">{checkoutError}</AccountNotice> : null}

      {!credits ? <AccountCreditsSkeleton /> : null}

      {credits ? (
        <>
          <AccountPanel
            kicker="Credits"
            title="Credits and prepaid packs"
            description="Check your balance, buy credits, and review recent credit activity."
          >
            <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
              <div className="border border-border bg-subtle p-5 shadow-elevated">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-foreground/65">
                      Credit balance
                    </div>
                    <div className="mt-4 text-5xl font-pixel font-medium leading-none text-foreground sm:text-6xl">
                      {formatCredits(credits.balance)}
                    </div>
                    <div className="mt-4 text-[15px] leading-7 text-foreground/72">
                      {credits.credit_unit}. You have used {formatCredits(credits.usage.debited)}{" "}
                      credits in the last {credits.window_days} days.
                    </div>
                  </div>

                  <Button
                    variant="secondary"
                    size="sm"
                    onPress={() => void refresh({ background: true })}
                    isPending={refreshing}
                  >
                    Refresh
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <div className="border border-border bg-background px-4 py-4 shadow-elevated">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-foreground/65">
                    Design trials left
                  </div>
                  <div className="mt-2 text-3xl font-pixel font-medium text-foreground">
                    {credits.trials.design_remaining}
                  </div>
                  <div className="mt-2 text-[15px] leading-6 text-foreground/68">
                    Free previews before credits apply.
                  </div>
                </div>
                <div className="border border-border bg-background px-4 py-4 shadow-elevated">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-foreground/65">
                    Clone trials left
                  </div>
                  <div className="mt-2 text-3xl font-pixel font-medium text-foreground">
                    {credits.trials.clone_remaining}
                  </div>
                  <div className="mt-2 text-[15px] leading-6 text-foreground/68">
                    Free finalizations before credits apply.
                  </div>
                </div>
              </div>
            </div>
          </AccountPanel>

          <AccountPanel
            kicker="Buy credits"
            title="Prepaid packs"
            description="One-time checkout only. No subscription management or billing portal is required here."
          >
            <div className="grid gap-4 lg:grid-cols-2">
              {creditPacks.map((pack) => (
                <div
                  key={pack.id}
                  className={cn(
                    "relative border border-border bg-subtle p-5 shadow-elevated",
                    pack.featured && "border-border-strong",
                  )}
                >
                  {pack.featured ? (
                    <div className="absolute -top-3 left-4 border border-border-strong bg-background px-2 py-1 text-[11px] font-pixel font-medium uppercase tracking-wide">
                      Best value
                    </div>
                  ) : null}

                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                        {pack.name}
                      </div>
                      <div className="mt-3 flex flex-wrap items-baseline gap-3">
                        <div className="text-3xl font-pixel font-medium">
                          {formatUsd(pack.priceUsd)}
                        </div>
                        <div className="text-[15px] leading-6 text-foreground/68">
                          {formatCredits(pack.credits)} credits
                        </div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onPress={() => void startCheckout(pack.id)}
                      isPending={activePackId === pack.id}
                      isDisabled={Boolean(activePackId)}
                    >
                      Buy
                    </Button>
                  </div>

                  <div className="mt-3 max-w-md text-[15px] leading-7 text-foreground/68">
                    {pack.blurb}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {pack.highlights.map((item) => (
                      <span
                        key={item}
                        className="border border-border bg-background px-2 py-1 text-[11px] uppercase tracking-[0.2em] text-muted-foreground"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </AccountPanel>

          <AccountPanel
            kicker="Recent activity"
            title="Recent credit activity"
            description="Purchases and usage are grouped in one timeline."
          >
            <ToggleButtonGroup
              selectionMode="single"
              disallowEmptySelection
              selectedKeys={new Set([activityFilter])}
              onSelectionChange={(keys) => {
                const next = [...keys][0] as ActivityFilter;
                if (next) setActivityFilter(next);
              }}
              className="flex flex-wrap gap-2"
            >
              <ToggleButton
                id="all"
                className="cursor-pointer border px-3 py-2 text-[12px] font-medium uppercase tracking-wide transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background border-border bg-background text-foreground hover:bg-subtle selected:border-border-strong selected:bg-foreground selected:text-background"
              >
                All
              </ToggleButton>
              <ToggleButton
                id="purchases"
                className="cursor-pointer border px-3 py-2 text-[12px] font-medium uppercase tracking-wide transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background border-border bg-background text-foreground hover:bg-subtle selected:border-border-strong selected:bg-foreground selected:text-background"
              >
                Purchases
              </ToggleButton>
              <ToggleButton
                id="usage"
                className="cursor-pointer border px-3 py-2 text-[12px] font-medium uppercase tracking-wide transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background border-border bg-background text-foreground hover:bg-subtle selected:border-border-strong selected:bg-foreground selected:text-background"
              >
                Usage
              </ToggleButton>
            </ToggleButtonGroup>

            <div className="mt-4">
              {filteredActivity.length === 0 ? (
                <AccountEmptyState
                  title="No activity for this filter"
                  body="Purchases and usage will appear here as soon as they happen."
                />
              ) : (
                <div className="space-y-3">
                  {filteredActivity.map((item) => (
                    <div
                      key={item.id}
                      className="border border-border bg-subtle px-4 py-4 shadow-elevated"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[15px] font-medium text-foreground">
                            {item.title}
                          </div>
                          <div className="mt-2 text-[15px] leading-7 text-foreground/68">
                            {item.detail}
                          </div>
                          <div className="mt-3 text-[11px] uppercase tracking-[0.22em] text-foreground/58">
                            {item.balanceLabel}
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
            </div>
          </AccountPanel>

          <AccountPanel
            kicker="Pricing"
            title="Pricing help"
            description="Credits are charged in three straightforward ways."
          >
            <div className="space-y-3">
              {credits.rate_card.map((item) => (
                <div
                  key={item.action}
                  className="border border-border bg-subtle px-4 py-4 shadow-elevated"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-foreground">{item.action}</div>
                      <div className="mt-2 text-[15px] leading-7 text-foreground/68">
                        {item.note}
                      </div>
                    </div>
                    <div className="text-[15px] font-medium text-foreground">{item.cost}</div>
                  </div>
                </div>
              ))}
            </div>
          </AccountPanel>

          <div className="flex flex-wrap gap-2">
            <Link to="/history" className={buttonStyles({ variant: "secondary", size: "sm" })}>
              View history
            </Link>
            <Link to="/account" className={buttonStyles({ variant: "secondary", size: "sm" })}>
              Edit profile
            </Link>
          </div>
        </>
      ) : null}
    </div>
  );
}
