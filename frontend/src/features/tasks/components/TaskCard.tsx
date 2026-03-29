import { taskLabel } from "../../../app/taskKeys";
import { Button } from "../../../components/atoms/Button";
import { AppLink } from "../../../components/atoms/Link";
import type { BackendTaskListItem } from "../../../lib/types";

const dateTimeFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatTimestamp(value: string | null) {
  if (!value) return "Unavailable";
  return dateTimeFormat.format(new Date(value));
}

export interface TaskCardProps {
  task: BackendTaskListItem;
  statusText: string;
  onCancel: () => void;
  onDismiss: () => void;
}

export function TaskCard({ task, statusText, onCancel, onDismiss }: TaskCardProps) {
  return (
    <div className="space-y-3 border border-border bg-background p-4 shadow-elevated">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="text-sm font-medium uppercase tracking-wide">{task.title}</div>
          <div className="text-xs text-faint">
            {taskLabel(task.type)} · {statusText}
          </div>
          {task.subtitle ? (
            <div className="text-sm text-muted-foreground">{task.subtitle}</div>
          ) : null}
        </div>
        <div className="text-right text-xs text-faint">
          <div>Created {formatTimestamp(task.created_at)}</div>
          {task.completed_at ? <div>Finished {formatTimestamp(task.completed_at)}</div> : null}
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
          <Button type="button" variant="secondary" onPress={() => void onCancel()}>
            Cancel
          </Button>
        ) : (
          <Button type="button" variant="secondary" onPress={() => void onDismiss()}>
            Dismiss
          </Button>
        )}
      </div>
    </div>
  );
}
