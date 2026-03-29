import { TaskCardSkeleton } from "./TaskCardSkeleton";

const TASK_SKELETON_KEYS = ["task-a", "task-b", "task-c"] as const;

export function TasksSkeleton() {
  return (
    <div className="grid min-h-[50dvh] content-start gap-3" aria-hidden="true">
      {TASK_SKELETON_KEYS.map((key) => (
        <TaskCardSkeleton key={key} />
      ))}
    </div>
  );
}
