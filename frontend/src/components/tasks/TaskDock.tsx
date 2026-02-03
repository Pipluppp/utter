import { useMemo } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { cn } from '../../lib/cn'
import type { StoredTask, TaskType } from '../../lib/types'
import { useTasks } from './TaskProvider'
import { TASK_TYPES } from './taskKeys'

function Icon({ type }: { type: TaskType }) {
  if (type === 'clone') {
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
    )
  }
  if (type === 'design') {
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
    )
  }
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M8 5v14l11-7L8 5z" />
    </svg>
  )
}

function truncate(text: string, maxLen: number) {
  return text.length > maxLen ? `${text.slice(0, maxLen)}…` : text
}

function TaskRow({
  task,
  onDismiss,
  onCancel,
  elapsed,
}: {
  task: StoredTask
  onDismiss: () => void
  onCancel: () => void
  elapsed: string
}) {
  const raw = (task.description || 'Processing…').replaceAll('...', '…')
  const short = truncate(raw, 32)
  const showCancel =
    task.type === 'generate' &&
    task.status !== 'completed' &&
    task.status !== 'failed' &&
    task.status !== 'cancelled'

  return (
    <div
      className={cn(
        'group flex w-full items-center gap-2 border border-border bg-background px-2 py-2 text-sm',
        'hover:bg-subtle',
      )}
      title={raw}
    >
      <NavLink
        to={task.originPage}
        className={cn(
          'flex min-w-0 flex-1 items-center gap-2 px-1 py-0.5 text-left',
          'focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        )}
      >
        <span className="size-4 shrink-0 text-muted-foreground">
          <Icon type={task.type} />
        </span>
        <span className="min-w-0 flex-1 truncate">{short}</span>
        <span className="shrink-0 text-xs text-faint">{elapsed}</span>
      </NavLink>

      {showCancel ? (
        <button
          type="button"
          className="border border-border bg-background px-2 py-1 text-[11px] uppercase tracking-wide hover:bg-muted focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          onClick={(e) => {
            e.stopPropagation()
            onCancel()
          }}
        >
          Cancel
        </button>
      ) : null}

      <button
        type="button"
        aria-label="Dismiss task"
        className="px-2 py-1 text-lg leading-none text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        onClick={(e) => {
          e.stopPropagation()
          onDismiss()
        }}
      >
        ×
      </button>
    </div>
  )
}

export function TaskDock() {
  const location = useLocation()
  const { tasks, dismissTask, cancelTask, formatTaskElapsed } = useTasks()

  const visible = useMemo(() => {
    return TASK_TYPES.map((t) => tasks[t])
      .filter((t): t is StoredTask => Boolean(t))
      .filter((t) => !t.dismissed && t.originPage !== location.pathname)
  }, [location.pathname, tasks])

  if (visible.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[min(420px,calc(100vw-2rem))] space-y-2">
      {visible.map((task) => (
        <TaskRow
          key={task.type}
          task={task}
          elapsed={formatTaskElapsed(task)}
          onDismiss={() => dismissTask(task.type)}
          onCancel={() => void cancelTask(task.type)}
        />
      ))}
    </div>
  )
}
