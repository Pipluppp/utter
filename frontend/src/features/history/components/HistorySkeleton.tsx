import { HistoryCardSkeleton } from "./HistoryCardSkeleton";

const HISTORY_SKELETON_VARIANTS = [
  { id: "ready-a", showMeta: true },
  { id: "active-a", showMeta: false },
  { id: "ready-b", showMeta: true },
  { id: "ready-c", showMeta: true },
] as const;

export function HistorySkeleton() {
  return (
    <div className="grid gap-4" aria-hidden="true">
      {HISTORY_SKELETON_VARIANTS.map(({ id, showMeta }) => (
        <HistoryCardSkeleton key={id} showMeta={showMeta} />
      ))}
    </div>
  );
}
