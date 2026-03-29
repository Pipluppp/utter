import { Skeleton } from "../../../components/atoms/Skeleton";

export function VoiceCardSkeleton({ showPrompt = true }: { showPrompt?: boolean }) {
  return (
    <div className="bg-background p-4 shadow-elevated">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-18" />
            <Skeleton className="h-5 max-w-56 flex-1" />
          </div>

          <div className="mt-3 space-y-3">
            <div>
              <Skeleton className="h-3 w-44" />
              <div className="mt-2 space-y-2">
                <Skeleton className="h-3 w-full max-w-3xl" />
                <Skeleton className="h-3 w-4/5 max-w-2xl" />
              </div>
            </div>

            {showPrompt ? (
              <div>
                <Skeleton className="h-3 w-28" />
                <div className="mt-2 space-y-2">
                  <Skeleton className="h-3 w-full max-w-2xl" />
                  <Skeleton className="h-3 w-3/4 max-w-xl" />
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 md:justify-self-end">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-18" />
          <Skeleton className="h-8 w-18" />
        </div>
      </div>

      <div className="mt-4">
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  );
}
