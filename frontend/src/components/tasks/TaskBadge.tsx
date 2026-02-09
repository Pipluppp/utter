import { useTasks } from './TaskProvider'

export function TaskBadge() {
  const { activeCount } = useTasks()
  if (activeCount <= 0) return null
  return (
    <span className="ml-2 rounded-full bg-foreground px-1.5 py-0.5 text-[11px] font-pixel font-medium leading-none text-background">
      {activeCount}
    </span>
  )
}
