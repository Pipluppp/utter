import { Skeleton } from "./Skeleton";

const SKELETON_LINE_KEYS = ["line-a", "line-b", "line-c", "line-d", "line-e", "line-f"] as const;
const MARKETING_CARD_SKELETONS = [
  { id: "marketing-clone", width: "w-20" },
  { id: "marketing-design", width: "w-16" },
  { id: "marketing-generate", width: "w-24" },
] as const;

function SkeletonParagraph({ lines, widths }: { lines: number; widths?: string[] }) {
  return (
    <div className="space-y-2">
      {SKELETON_LINE_KEYS.slice(0, lines).map((lineKey, index) => (
        <Skeleton key={lineKey} className={`h-3 ${widths?.[index] ?? "w-full max-w-3xl"}`} />
      ))}
    </div>
  );
}

function SkeletonSectionDivider() {
  return <div className="mx-2 hidden h-4 w-px bg-border md:block" />;
}

export function HeaderPendingAuthSkeleton() {
  return (
    <div className="flex items-center gap-2" aria-hidden="true">
      <div className="hidden items-center gap-2 md:flex">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-24" />
        <SkeletonSectionDivider />
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-20" />
        <SkeletonSectionDivider />
        <Skeleton className="h-9 w-28" />
      </div>
      <Skeleton className="h-9 w-32 md:hidden" />
    </div>
  );
}

export function AuthGateSkeleton() {
  return (
    <div className="mx-auto w-full max-w-xl py-10" aria-hidden="true">
      <div className="border border-border bg-background p-6 shadow-elevated md:p-8">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="mt-4 h-8 w-56 max-w-full" />
        <div className="mt-3">
          <SkeletonParagraph lines={2} widths={["w-full max-w-md", "w-4/5 max-w-sm"]} />
        </div>
      </div>
    </div>
  );
}

export function RouteMarketingSkeleton() {
  return (
    <div className="space-y-10" aria-hidden="true">
      <div className="space-y-4">
        <Skeleton className="mx-auto h-4 w-24" />
        <Skeleton className="mx-auto h-10 w-full max-w-xl" />
        <div className="mx-auto max-w-2xl">
          <SkeletonParagraph lines={2} widths={["w-full", "w-4/5"]} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {MARKETING_CARD_SKELETONS.map(({ id, width }) => (
          <div key={id} className="border border-border bg-background p-4 shadow-elevated">
            <Skeleton className={`h-4 ${width}`} />
            <div className="mt-4">
              <SkeletonParagraph lines={3} widths={["w-full", "w-11/12", "w-3/4"]} />
            </div>
          </div>
        ))}
      </div>

      <div className="border border-border bg-subtle p-5 shadow-elevated">
        <Skeleton className="h-4 w-32" />
        <div className="mt-4">
          <SkeletonParagraph lines={4} widths={["w-full", "w-full", "w-5/6", "w-2/3"]} />
        </div>
      </div>
    </div>
  );
}

export function RouteAppSkeleton() {
  return (
    <div className="space-y-8" aria-hidden="true">
      <div className="flex items-center justify-center gap-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-8 w-8" />
      </div>

      <div className="space-y-6">
        <div>
          <Skeleton className="h-4 w-20" />
          <Skeleton className="mt-3 h-10 w-full" />
        </div>
        <div>
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-3 h-10 w-full" />
        </div>
        <div>
          <Skeleton className="h-4 w-16" />
          <Skeleton className="mt-3 h-44 w-full" />
        </div>
        <Skeleton className="h-11 w-full" />
      </div>

      <div className="border border-border bg-subtle p-4 shadow-elevated">
        <Skeleton className="h-4 w-28" />
        <div className="mt-4">
          <SkeletonParagraph lines={2} widths={["w-2/3", "w-1/3"]} />
        </div>
      </div>
    </div>
  );
}

export function RouteAccountSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <div className="space-y-4">
        <Skeleton className="h-3 w-20" />
        <div className="space-y-3">
          <Skeleton className="h-9 w-56 max-w-full" />
          <SkeletonParagraph lines={2} widths={["w-full max-w-2xl", "w-4/5 max-w-xl"]} />
        </div>
      </div>

      <div className="overflow-x-auto border-b border-border pb-2">
        <div className="flex min-w-max gap-2">
          <Skeleton className="h-[4.5rem] w-[190px]" />
          <Skeleton className="h-[4.5rem] w-[190px]" />
          <Skeleton className="h-[4.5rem] w-[190px]" />
        </div>
      </div>

      <div className="space-y-5">
        <div className="border border-border bg-background p-5 shadow-elevated md:p-7">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-4 h-8 w-72 max-w-full" />
          <div className="mt-3">
            <SkeletonParagraph lines={2} widths={["w-full max-w-2xl", "w-4/5 max-w-xl"]} />
          </div>
          <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_0.9fr]">
            <Skeleton className="h-52 w-full" />
            <Skeleton className="h-52 w-full" />
          </div>
        </div>

        <div className="border border-border bg-background p-5 shadow-elevated md:p-7">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="mt-4 h-8 w-64 max-w-full" />
          <div className="mt-6 space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function RouteAuthSkeleton() {
  return (
    <div className="flex min-h-full w-full bg-background" aria-hidden="true">
      <div className="flex w-full flex-col justify-between px-6 py-8 sm:px-12 lg:w-1/2 lg:px-20">
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <Skeleton className="h-8 w-44" />
          <div className="mt-3">
            <SkeletonParagraph lines={2} widths={["w-full max-w-xs", "w-3/4 max-w-[12rem]"]} />
          </div>

          <div className="mt-8 border border-border">
            <div className="grid grid-cols-2">
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full" />
            </div>
          </div>

          <div className="mt-6 space-y-5">
            <div>
              <Skeleton className="h-4 w-14" />
              <Skeleton className="mt-2 h-10 w-full" />
            </div>
            <div>
              <Skeleton className="h-4 w-20" />
              <Skeleton className="mt-2 h-10 w-full" />
            </div>
            <Skeleton className="h-11 w-full" />
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-faint">
          <div className="flex gap-4">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-12" />
          </div>
          <Skeleton className="h-3 w-28" />
        </div>
      </div>

      <div className="hidden border-l border-border bg-subtle lg:block lg:w-1/2">
        <div className="h-full w-full p-12">
          <Skeleton className="h-full w-full" />
        </div>
      </div>
    </div>
  );
}
