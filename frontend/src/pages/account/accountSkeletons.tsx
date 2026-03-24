import { Skeleton } from "../../components/ui/Skeleton";
import { AccountPanel } from "./accountUi";

const SKELETON_LINE_KEYS = ["line-a", "line-b", "line-c", "line-d", "line-e", "line-f"] as const;
const ACTIVITY_ROW_KEYS = ["activity-a", "activity-b", "activity-c", "activity-d"] as const;

function SkeletonParagraph({ lines, widths }: { lines: number; widths?: string[] }) {
  return (
    <div className="space-y-2">
      {SKELETON_LINE_KEYS.slice(0, lines).map((lineKey, index) => (
        <Skeleton key={lineKey} className={`h-3 ${widths?.[index] ?? "w-full max-w-2xl"}`} />
      ))}
    </div>
  );
}

function ActivityRowsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3" aria-hidden="true">
      {ACTIVITY_ROW_KEYS.slice(0, count).map((rowKey) => (
        <div key={rowKey} className="border border-border bg-subtle px-4 py-4 shadow-elevated">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <Skeleton className="h-4 w-40" />
              <div className="mt-3">
                <SkeletonParagraph lines={2} widths={["w-full max-w-xl", "w-4/5 max-w-lg"]} />
              </div>
            </div>
            <div className="w-28 space-y-3">
              <Skeleton className="ml-auto h-4 w-20" />
              <Skeleton className="ml-auto h-3 w-24" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function AccountOverviewSkeleton() {
  return (
    <div className="space-y-5" aria-hidden="true">
      <AccountPanel
        kicker="Overview"
        title="Balance and recent account activity"
        description="See available credits, pricing, and the latest account activity."
      >
        <div className="grid gap-4 lg:grid-cols-[1.4fr_0.9fr]">
          <div className="border border-border bg-subtle p-5 shadow-elevated">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="mt-4 h-14 w-40 max-w-full sm:h-16 sm:w-52" />
            <div className="mt-4">
              <SkeletonParagraph lines={2} widths={["w-full max-w-md", "w-5/6 max-w-sm"]} />
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Skeleton className="h-9 w-28" />
              <Skeleton className="h-9 w-28" />
            </div>
          </div>

          <div className="border border-border bg-background p-5 shadow-elevated">
            <Skeleton className="h-3 w-20" />
            <div className="mt-4 space-y-2">
              <Skeleton className="h-[3.75rem] w-full" />
              <Skeleton className="h-[3.75rem] w-full" />
              <Skeleton className="h-[3.75rem] w-full" />
            </div>
          </div>
        </div>
      </AccountPanel>

      <AccountPanel
        kicker="Pricing"
        title="Voice action pricing"
        description="Flat credit costs for design previews and clone finalization."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </AccountPanel>

      <AccountPanel
        kicker="Recent activity"
        title="Latest account activity"
        description="Recent credit purchases and usage tied to your account."
      >
        <ActivityRowsSkeleton />
      </AccountPanel>
    </div>
  );
}

export function AccountCreditsSkeleton() {
  return (
    <div className="space-y-5" aria-hidden="true">
      <AccountPanel
        kicker="Credits"
        title="Credits and prepaid packs"
        description="Check your balance, buy credits, and review recent credit activity."
      >
        <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="border border-border bg-subtle p-5 shadow-elevated">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex-1">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="mt-4 h-14 w-40 max-w-full sm:h-16 sm:w-52" />
                <div className="mt-4">
                  <SkeletonParagraph lines={2} widths={["w-full max-w-md", "w-4/5 max-w-sm"]} />
                </div>
              </div>
              <Skeleton className="h-9 w-24" />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        </div>
      </AccountPanel>

      <AccountPanel
        kicker="Buy credits"
        title="Prepaid packs"
        description="One-time checkout only. No subscription management or billing portal is required here."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-52 w-full" />
          <Skeleton className="h-52 w-full" />
        </div>
      </AccountPanel>

      <AccountPanel
        kicker="Recent activity"
        title="Recent credit activity"
        description="Purchases and usage are grouped in one timeline."
      >
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-10 w-16" />
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-20" />
        </div>

        <div className="mt-4">
          <ActivityRowsSkeleton />
        </div>
      </AccountPanel>

      <AccountPanel
        kicker="Pricing"
        title="Pricing help"
        description="Credits are charged in three straightforward ways."
      >
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </AccountPanel>

      <div className="flex flex-wrap gap-2" aria-hidden="true">
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-28" />
      </div>
    </div>
  );
}

export function AccountProfileSkeleton() {
  return (
    <div className="space-y-5" aria-hidden="true">
      <AccountPanel kicker="Profile" title="Account identity">
        <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
          <div className="space-y-4">
            <div className="flex items-center gap-4 lg:flex-col lg:items-start">
              <Skeleton className="size-20 rounded-full" />
              <div className="min-w-0 flex-1">
                <Skeleton className="h-6 w-40 max-w-full" />
                <Skeleton className="mt-3 h-4 w-48 max-w-full" />
                <Skeleton className="mt-3 h-3 w-56 max-w-full" />
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-20" />
        </div>
      </AccountPanel>

      <AccountPanel title="Sign out">
        <div className="flex flex-wrap gap-3">
          <Skeleton className="h-9 w-24" />
        </div>
      </AccountPanel>
    </div>
  );
}
