import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTasks } from "../../app/TaskProvider";
import { Button } from "../../components/atoms/Button";
import { Message } from "../../components/atoms/Message";
import { SegmentedControl } from "../../components/molecules/SegmentedControl";
import type { TaskListType } from "../../lib/types";
import { TaskCard } from "./components/TaskCard";
import { TasksSkeleton } from "./components/TasksSkeleton";
import { taskQueries } from "./queries";

export function TasksPage() {
  const { cancelTask, dismissTask, getStatusText } = useTasks();
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState<TaskListType>("all");
  const [actionError, setActionError] = useState<string | null>(null);

  const tasksQuery = useInfiniteQuery({
    ...taskQueries.list({ status: "active", type: typeFilter }),
    refetchInterval: (query) => {
      const firstPage = query.state.data?.pages[0];
      return firstPage && firstPage.tasks.length > 0 ? 5000 : false;
    },
    refetchIntervalInBackground: false,
  });

  const tasks = tasksQuery.data?.pages.flatMap((page) => page.tasks) ?? [];
  const displayError = tasksQuery.error?.message ?? actionError ?? null;
  const isBackgroundRefetching =
    tasksQuery.isFetching && !tasksQuery.isPending && !tasksQuery.isFetchingNextPage;

  async function onCancel(taskId: string) {
    setActionError(null);
    const ok = await cancelTask(taskId);
    if (!ok) {
      setActionError("Failed to cancel job.");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: taskQueries.all() });
  }

  async function onDismiss(taskId: string) {
    setActionError(null);
    queryClient.setQueryData(
      taskQueries.list({ status: "active", type: typeFilter }).queryKey,
      (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            tasks: page.tasks.filter((t) => t.id !== taskId),
          })),
        };
      },
    );
    const ok = await dismissTask(taskId);
    if (!ok) {
      setActionError("Failed to dismiss job.");
      await queryClient.invalidateQueries({ queryKey: taskQueries.all() });
    }
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

      {displayError ? <Message variant="error">{displayError}</Message> : null}

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

      {tasksQuery.isPending ? <TasksSkeleton /> : null}

      {tasksQuery.isSuccess && tasks.length === 0 ? (
        <div className="flex min-h-[50dvh] items-center justify-center border border-border bg-subtle p-6 text-center text-sm text-muted-foreground shadow-elevated">
          No jobs in this view.
        </div>
      ) : null}

      {tasks.length > 0 ? (
        <div
          className={`grid min-h-[50dvh] content-start gap-3${isBackgroundRefetching ? " pointer-events-none opacity-60" : ""}`}
        >
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              statusText={getStatusText(task.status, null, task.provider_status)}
              onCancel={() => void onCancel(task.id)}
              onDismiss={() => void onDismiss(task.id)}
            />
          ))}

          {tasksQuery.hasNextPage ? (
            <div>
              <Button
                type="button"
                variant="secondary"
                onPress={() => void tasksQuery.fetchNextPage()}
                isDisabled={tasksQuery.isFetchingNextPage || tasksQuery.isFetching}
              >
                {tasksQuery.isFetchingNextPage ? "Loading more..." : "Load Older Jobs"}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
