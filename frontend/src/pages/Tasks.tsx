import { useEffect, useMemo, useState } from "react";
import { ToggleButton, ToggleButtonGroup } from "react-aria-components";
import { Link } from "react-router-dom";
import { taskLabel } from "../components/tasks/taskKeys";
import { useTasks } from "../components/tasks/TaskProvider";
import { Button } from "../components/ui/Button";
import { Message } from "../components/ui/Message";
import { apiJson } from "../lib/api";
import type {
  BackendTaskListItem,
  TaskListResponse,
  TaskListStatus,
  TaskListType,
} from "../lib/types";

const dateTimeFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatTimestamp(value: string | null) {
  if (!value) return "Unavailable";
  return dateTimeFormat.format(new Date(value));
}

export function TasksPage() {
  const { cancelTask, dismissTask, getStatusText } = useTasks();
  const [statusFilter, setStatusFilter] = useState<TaskListStatus>("active");
  const [typeFilter, setTypeFilter] = useState<TaskListType>("all");
  const [tasks, setTasks] = useState<BackendTaskListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextBefore, setNextBefore] = useState<string | null>(null);

  const filterQuery = useMemo(() => {
    const params = new URLSearchParams({
      status: statusFilter,
      type: typeFilter,
      limit: "25",
    });
    return params.toString();
  }, [statusFilter, typeFilter]);

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
    if (statusFilter !== "active") return;

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
  }, [filterQuery, statusFilter]);

  async function loadMore() {
    if (!nextBefore) return;
    setLoadingMore(true);

    try {
      const params = new URLSearchParams({
        status: statusFilter,
        type: typeFilter,
        limit: "25",
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
        <h2 className="text-2xl font-pixel font-medium uppercase tracking-[2px] md:text-3xl">
          Tasks
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Live queue-backed work across Generate and Design. History remains the archive for
          finished audio. This view is the job center.
        </p>
      </div>

      {error ? <Message variant="error">{error}</Message> : null}

      <ToggleButtonGroup
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={new Set([statusFilter])}
        onSelectionChange={(keys) => {
          const next = [...keys][0] as TaskListStatus;
          if (next) setStatusFilter(next);
        }}
        className="flex flex-wrap gap-3"
      >
        {(
          [
            ["active", "Active"],
            ["terminal", "Recent"],
          ] as const
        ).map(([value, label]) => (
          <ToggleButton
            key={value}
            id={value}
            className="cursor-pointer border border-border bg-background px-3 py-2 text-[12px] uppercase tracking-wide hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background selected:bg-surface-selected"
          >
            {label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      <ToggleButtonGroup
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={new Set([typeFilter])}
        onSelectionChange={(keys) => {
          const next = [...keys][0] as TaskListType;
          if (next) setTypeFilter(next);
        }}
        className="flex flex-wrap gap-3"
      >
        {(
          [
            ["all", "All"],
            ["generate", "Generate"],
            ["design_preview", "Design"],
          ] as const
        ).map(([value, label]) => (
          <ToggleButton
            key={value}
            id={value}
            className="cursor-pointer border border-border bg-background px-3 py-2 text-[12px] uppercase tracking-wide hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background selected:bg-surface-selected"
          >
            {label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      {loading ? (
        <div className="border border-border bg-background p-4 text-sm text-muted-foreground shadow-elevated">
          Loading tasks...
        </div>
      ) : tasks.length === 0 ? (
        <div className="border border-border bg-background p-4 text-sm text-muted-foreground shadow-elevated">
          No jobs in this view.
        </div>
      ) : (
        <div className="space-y-3">
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
                <Link
                  to={task.origin_page}
                  className="inline-flex items-center border border-border bg-background px-3 py-2 text-[12px] uppercase tracking-wide hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  Open Source Page
                </Link>
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
      )}
    </div>
  );
}
