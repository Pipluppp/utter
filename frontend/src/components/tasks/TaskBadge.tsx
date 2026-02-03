import { useTasks } from './TaskProvider'

export function TaskBadge() {
  const { activeCount } = useTasks()
  if (activeCount <= 0) return null
  return (
    <span className="ml-2 rounded-full bg-foreground px-1.5 py-0.5 text-[10px] leading-none text-background">
      {activeCount}
    </span>
  )
}

