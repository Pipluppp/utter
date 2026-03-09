import type { TaskType } from '../../lib/types'

export const TASK_STORAGE_KEY = 'utter_tasks_v2'
export const TASK_STORAGE_PREFIX = 'utter_task_'
export const LEGACY_TASK_KEY = 'utter_active_task'

export const TASK_TYPES: TaskType[] = ['generate', 'design_preview', 'clone']
export const LEGACY_TASK_TYPES = ['generate', 'design', 'clone'] as const

export function legacyTaskStorageKey(type: (typeof LEGACY_TASK_TYPES)[number]) {
  return `${TASK_STORAGE_PREFIX}${type}` as const
}

export function taskLabel(type: TaskType | string) {
  if (type === 'design_preview') return 'Design'
  if (type === 'generate') return 'Generate'
  if (type === 'clone') return 'Clone'
  return 'Task'
}

export function taskOriginPage(type: TaskType | string) {
  if (type === 'design_preview') return '/design'
  if (type === 'generate') return '/generate'
  if (type === 'clone') return '/clone'
  return '/tasks'
}

export function coerceTaskType(value: unknown): TaskType | null {
  if (value === 'generate' || value === 'design_preview' || value === 'clone') {
    return value
  }
  if (value === 'design') return 'design_preview'
  return null
}
