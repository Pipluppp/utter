import { useMemo, useState } from "react";
import { ToggleButton, ToggleButtonGroup } from "react-aria-components";
import { toggleButtonStyles } from "../../../lib/styles/toggle-button";
import type { AccountActivity } from "../accountData";
import { AccountEmptyState, AccountPanel } from "../accountUi";

type ActivityFilter = "all" | "purchases" | "usage";

interface CreditActivityListProps {
  activity: AccountActivity[];
}

export function CreditActivityList({ activity }: CreditActivityListProps) {
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");

  const filteredActivity = useMemo(() => {
    if (activityFilter === "all") {
      return activity;
    }

    const category = activityFilter === "purchases" ? "purchase" : "usage";
    return activity.filter((item) => item.category === category);
  }, [activity, activityFilter]);

  return (
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
        <ToggleButton id="all" className={toggleButtonStyles({ bordered: true })}>
          All
        </ToggleButton>
        <ToggleButton id="purchases" className={toggleButtonStyles({ bordered: true })}>
          Purchases
        </ToggleButton>
        <ToggleButton id="usage" className={toggleButtonStyles({ bordered: true })}>
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
                    <div className="text-[15px] font-medium text-foreground">{item.title}</div>
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
  );
}
