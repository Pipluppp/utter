import { useLocation } from "@tanstack/react-router";
import { useMemo } from "react";
import { useTasks } from "../../app/TaskProvider";
import { useElapsedTick } from "../../hooks/useElapsedTick";
import { cn } from "../../lib/cn";
import { formatElapsed } from "../../lib/time";
import type { StoredTask, TaskType } from "../../lib/types";
import { Button } from "../atoms/Button";
import { AppLink } from "../atoms/Link";

function Icon({ type }: { type: TaskType }) {
  if (type === "clone") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M12 1v6M12 17v6M4.22 4.22l4.24 4.24M15.54 15.54l4.24 4.24M1 12h6M17 12h6M4.22 19.78l4.24-4.24M15.54 8.46l4.24-4.24" />
      </svg>
    );
  }

  if (type === "design_preview") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M8 5v14l11-7L8 5z" />
    </svg>
  );
}

function truncate(text: string, maxLen: number) {
  return text.length > maxLen ? `${text.slice(0, maxLen)}...` : text;
}

function TaskRow({
  task,
  onDismiss,
  onCancel,
  elapsed,
}: {
  task: StoredTask;
  onDismiss: () => void;
  onCancel: () => void;
  elapsed: string;
}) {
  const raw = (task.description || "Processing...").replaceAll("â€¦", "...");
  const short = truncate(raw, 40);
  const showCancel =
    task.status !== "completed" && task.status !== "failed" && task.status !== "cancelled";

  return (
    <div
      className={cn(
        "group flex w-full items-center gap-2 border border-border bg-background px-2 py-2 text-sm shadow-elevated",
        "hover:bg-surface-hover",
      )}
      title={raw}
    >
      <AppLink
        to={task.originPage}
        className="flex min-w-0 flex-1 items-center gap-2 px-1 py-0.5 text-left"
      >
        <span className="size-4 shrink-0 text-muted-foreground">
          <Icon type={task.type} />
        </span>
        <span className="min-w-0 flex-1 truncate">{short}</span>
        <span className="shrink-0 text-xs font-pixel font-medium text-faint">{elapsed}</span>
      </AppLink>

      {showCancel ? (
        <Button variant="secondary" size="xs" onPress={onCancel}>
          Cancel
        </Button>
      ) : (
        <Button
          variant="secondary"
          size="xs"
          aria-label="Dismiss task"
          className="border-transparent bg-transparent text-muted-foreground data-[hovered]:bg-transparent data-[hovered]:text-foreground data-[pressed]:text-foreground"
          onPress={onDismiss}
        >
          Dismiss
        </Button>
      )}
    </div>
  );
}

export function TaskDock() {
  const location = useLocation();
  const { tasks, dismissTask, cancelTask, formatTaskElapsed } = useTasks();

  const visible = useMemo(() => {
    if (location.pathname === "/tasks") return [];
    return tasks;
  }, [location.pathname, tasks]);

  const hasActive = visible.some(
    (t) => t.status !== "completed" && t.status !== "failed" && t.status !== "cancelled",
  );
  const nowMs = useElapsedTick(hasActive);

  if (visible.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[min(420px,calc(100vw-2rem))] space-y-2">
      {visible.map((task) => (
        <TaskRow
          key={task.taskId}
          task={task}
          elapsed={
            task.status === "completed" || task.status === "failed" || task.status === "cancelled"
              ? formatTaskElapsed(task)
              : formatElapsed(task.startedAt, nowMs)
          }
          onDismiss={() => void dismissTask(task.taskId)}
          onCancel={() => void cancelTask(task.taskId)}
        />
      ))}
    </div>
  );
}
