import { useQueryClient } from "@tanstack/react-query";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../../components/atoms/Button";
import { buttonStyle } from "../../components/atoms/Button.styles";
import { Link } from "../../components/atoms/Link";
import { creditPacks } from "../../content/plans";
import { apiJson } from "../../lib/api";
import { formatCredits, useAccountData } from "./accountData";
import { AccountCreditsSkeleton } from "./accountSkeletons";
import { AccountNotice, AccountPanel } from "./accountUi";
import { CreditActivityList } from "./components/CreditActivityList";
import { CreditPackCard } from "./components/CreditPackCard";
import { accountQueries } from "./queries";

const creditsRoute = getRouteApi("/_app/account/credits");

export function AccountCreditsPage() {
  const navigate = useNavigate();
  const { checkout: checkoutParam } = creditsRoute.useSearch();
  const queryClient = useQueryClient();
  const { activity, credits, refreshing } = useAccountData();
  const [activePackId, setActivePackId] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const checkoutStatus = useMemo(() => {
    return checkoutParam === "success" || checkoutParam === "cancel" ? checkoutParam : null;
  }, [checkoutParam]);

  useEffect(() => {
    if (checkoutStatus === "success") {
      void queryClient.invalidateQueries({ queryKey: accountQueries.all() });
    }
  }, [checkoutStatus, queryClient]);

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
    void navigate({
      to: "/account/credits",
      search: {},
      replace: true,
    });
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
                    onPress={() =>
                      void queryClient.invalidateQueries({ queryKey: accountQueries.all() })
                    }
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
                <CreditPackCard
                  key={pack.id}
                  pack={pack}
                  isPending={activePackId === pack.id}
                  onBuy={() => void startCheckout(pack.id)}
                />
              ))}
            </div>
          </AccountPanel>

          <CreditActivityList activity={activity} />

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
            <Link to="/history" className={buttonStyle({ variant: "secondary", size: "sm" })}>
              View history
            </Link>
            <Link to="/account" className={buttonStyle({ variant: "secondary", size: "sm" })}>
              Edit profile
            </Link>
          </div>
        </>
      ) : null}
    </div>
  );
}
