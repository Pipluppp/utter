import { Skeleton } from "../../../components/atoms/Skeleton";

export function TaskCardSkeleton() {
  return (
    <div
      className="space-y-3 border border-border bg-background p-4 shadow-elevated"
      aria-hidden="true"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-28" />
        </div>
        <Skeleton className="h-3 w-32" />
      </div>
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-20" />
      </div>
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-20" />
      </div>
    </div>
  );
}
