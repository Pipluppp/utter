import { useEffect, useMemo, useState } from "react";
import { taskLabel } from "../../app/taskKeys";
import { useTasks } from "../../app/TaskProvider";
import { Button } from "../../components/atoms/Button";
import { Message } from "../../components/atoms/Message";
import { Skeleton } from "../../components/atoms/Skeleton";
import { SegmentedControl } from "../../components/molecules/SegmentedControl";
import { apiJson } from "../../lib/api";
import type { BackendTaskListItem, TaskListResponse, TaskListType } from "../../lib/types";
import { useDeferredLoading } from "../shared/hooks";

const dateTimeFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatTimestamp(value: string | null) {
  if (!value) return "Unavailable";
  return dateTimeFormat.format(new Date(value));
}

const TASK_SKELETON_KEYS = ["task-a", "task-b", "task-c"] as const;

function TaskCardSkeleton() {
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

function TasksSkeleton() {
  return (
    <div className="grid min-h-[50dvh] content-start gap-3" aria-hidden="true">
      {TASK_SKELETON_KEYS.map((key) => (
        <TaskCardSkeleton key={key} />
      ))}
    </div>
  );
}

export function TasksPage() {
  const { cancelTask, dismissTask, getStatusText } = useTasks();
  const [typeFilter, setTypeFilter] = useState<TaskListType>("all");
  const [tasks, setTasks] = useState<BackendTaskListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const showLoading = useDeferredLoading(loading);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextBefore, setNextBefore] = useState<string | null>(null);

  const filterQuery = useMemo(() => {
    const params = new URLSearchParams({
      status: "active",
      type: typeFilter,
      limit: "10",
    });
    return params.toString();
  }, [typeFilter]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const response = await apiJson<TaskListResponse>(`/api/tasks?${filterQuery}`);
        if (!active) return;
        setTasks(response.tasks);
        setNextBefore(response.next_before);
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Failed to load jobs.");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [filterQuery]);

  useEffect(() => {
    let timeoutId: number | undefined;
    let cancelled = false;

    const POLL_MS = 5000;
    const ERROR_POLL_MS = 10000;

    async function poll() {
      if (cancelled) return;
      try {
        const response = await apiJson<TaskListResponse>(`/api/tasks?${filterQuery}`);
        if (cancelled) return;
        setTasks(response.tasks);
        setNextBefore(response.next_before);
        if (response.tasks.length > 0) {
          timeoutId = window.setTimeout(poll, POLL_MS);
        }
      } catch (error) {
        if (cancelled) return;
        console.error("Task list poll failed:", error);
        timeoutId = window.setTimeout(poll, ERROR_POLL_MS);
      }
    }

    timeoutId = window.setTimeout(poll, POLL_MS);

    function onVisibilityChange() {
      if (document.visibilityState === "hidden") {
        window.clearTimeout(timeoutId);
        timeoutId = undefined;
      } else {
        void poll();
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [filterQuery]);

  async function loadMore() {
    if (!nextBefore) return;
    setLoadingMore(true);

    try {
      const params = new URLSearchParams({
        status: "active",
        type: typeFilter,
        limit: "10",
        before: nextBefore,
      });
      const response = await apiJson<TaskListResponse>(`/api/tasks?${params.toString()}`);
      setTasks((current) => [...current, ...response.tasks]);
      setNextBefore(response.next_before);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load more jobs.");
    } finally {
      setLoadingMore(false);
    }
  }

  async function onCancel(taskId: string) {
    const ok = await cancelTask(taskId);
    if (!ok) {
      setError("Failed to cancel job.");
      return;
    }
    const response = await apiJson<TaskListResponse>(`/api/tasks?${filterQuery}`);
    setTasks(response.tasks);
    setNextBefore(response.next_before);
  }

  async function onDismiss(taskId: string) {
    const ok = await dismissTask(taskId);
    if (!ok) {
      setError("Failed to dismiss job.");
      return;
    }
    setTasks((current) => current.filter((task) => task.id !== taskId));
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-balance text-center text-3xl font-pixel font-medium uppercase tracking-[2px] md:text-4xl">
          Tasks
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Live queue-backed work across Generate and Design. History remains the archive for
          finished audio. This view is the job center.
        </p>
      </div>

      {error ? <Message variant="error">{error}</Message> : null}

      <div className="flex flex-wrap items-center gap-2">
        <SegmentedControl
          items={[
            { id: "all", label: "All" },
            { id: "generate", label: "Generate" },
            { id: "design_preview", label: "Design" },
          ]}
          selectedKey={typeFilter}
          onSelectionChange={(key) => setTypeFilter(key as TaskListType)}
          aria-label="Task type filter"
        />
      </div>

      {loading && tasks.length === 0 ? <TasksSkeleton /> : null}

      {!loading && tasks.length === 0 ? (
        <div className="flex min-h-[50dvh] items-center justify-center border border-border bg-subtle p-6 text-center text-sm text-muted-foreground shadow-elevated">
          No jobs in this view.
        </div>
      ) : null}

      {tasks.length > 0 ? (
        <div
          className={`grid min-h-[50dvh] content-start gap-3${showLoading ? " pointer-events-none opacity-60" : ""}`}
        >
          {tasks.map((task) => (
            <div
              key={task.id}
              className="space-y-3 border border-border bg-background p-4 shadow-elevated"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="text-sm font-medium uppercase tracking-wide">{task.title}</div>
                  <div className="text-xs text-faint">
                    {taskLabel(task.type)} ·{" "}
                    {getStatusText(task.status, null, task.provider_status)}
                  </div>
                  {task.subtitle ? (
                    <div className="text-sm text-muted-foreground">{task.subtitle}</div>
                  ) : null}
                </div>
                <div className="text-right text-xs text-faint">
                  <div>Created {formatTimestamp(task.created_at)}</div>
                  {task.completed_at ? (
                    <div>Finished {formatTimestamp(task.completed_at)}</div>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap gap-3 text-xs text-faint">
                {task.voice_name ? <span>Voice: {task.voice_name}</span> : null}
                {task.language ? <span>Language: {task.language}</span> : null}
                {task.estimated_duration_minutes ? (
                  <span>Est. {task.estimated_duration_minutes.toFixed(1)} min</span>
                ) : null}
                {task.error ? <span>Error: {task.error}</span> : null}
              </div>

              <div className="flex flex-wrap gap-3">
                <AppLink
                  to={task.origin_page}
                  className="press-scale-sm inline-flex items-center border border-border bg-background px-3 py-2 text-caption uppercase tracking-wide data-[hovered]:bg-surface-hover data-[pressed]:bg-surface-hover"
                >
                  Open Source Page
                </AppLink>
                {task.supports_cancel ? (
                  <Button type="button" variant="secondary" onPress={() => void onCancel(task.id)}>
                    Cancel
                  </Button>
                ) : (
                  <Button type="button" variant="secondary" onPress={() => void onDismiss(task.id)}>
                    Dismiss
                  </Button>
                )}
              </div>
            </div>
          ))}

          {nextBefore ? (
            <div>
              <Button
                type="button"
                variant="secondary"
                onPress={() => void loadMore()}
                isDisabled={loadingMore}
              >
                {loadingMore ? "Loading more..." : "Load Older Jobs"}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
