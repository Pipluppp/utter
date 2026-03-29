import { useState } from "react";
import { useTasks } from "../../app/TaskProvider";
import { Button } from "../../components/atoms/Button";
import { Message } from "../../components/atoms/Message";
import { SegmentedControl } from "../../components/molecules/SegmentedControl";
import type { TaskListType } from "../../lib/types";
import { TaskCard } from "./components/TaskCard";
import { TasksSkeleton } from "./components/TasksSkeleton";
import { useTaskList } from "./hooks/useTaskList";

export function TasksPage() {
  const { cancelTask, dismissTask, getStatusText } = useTasks();
  const [typeFilter, setTypeFilter] = useState<TaskListType>("all");

  const taskList = useTaskList(typeFilter);

  async function onCancel(taskId: string) {
    const ok = await cancelTask(taskId);
    if (!ok) {
      taskList.setError("Failed to cancel job.");
      return;
    }
    await taskList.refreshAfterAction();
  }

  async function onDismiss(taskId: string) {
    const ok = await dismissTask(taskId);
    if (!ok) {
      taskList.setError("Failed to dismiss job.");
      return;
    }
    taskList.removeTask(taskId);
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

      {taskList.error ? <Message variant="error">{taskList.error}</Message> : null}

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

      {taskList.loading && taskList.tasks.length === 0 ? <TasksSkeleton /> : null}

      {!taskList.loading && taskList.tasks.length === 0 ? (
        <div className="flex min-h-[50dvh] items-center justify-center border border-border bg-subtle p-6 text-center text-sm text-muted-foreground shadow-elevated">
          No jobs in this view.
        </div>
      ) : null}

      {taskList.tasks.length > 0 ? (
        <div
          className={`grid min-h-[50dvh] content-start gap-3${taskList.showLoading ? " pointer-events-none opacity-60" : ""}`}
        >
          {taskList.tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              statusText={getStatusText(task.status, null, task.provider_status)}
              onCancel={() => void onCancel(task.id)}
              onDismiss={() => void onDismiss(task.id)}
            />
          ))}

          {taskList.nextBefore ? (
            <div>
              <Button
                type="button"
                variant="secondary"
                onPress={() => void taskList.loadMore()}
                isDisabled={taskList.loadingMore}
              >
                {taskList.loadingMore ? "Loading more..." : "Load Older Jobs"}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
