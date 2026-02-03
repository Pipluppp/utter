import type { TaskType } from '../../lib/types'

export const TASK_TYPES: TaskType[] = ['generate', 'design', 'clone']
export const TASK_STORAGE_PREFIX = 'utter_task_'
export const LEGACY_TASK_KEY = 'utter_active_task'

export function taskStorageKey(type: TaskType) {
  return `${TASK_STORAGE_PREFIX}${type}` as const
}
