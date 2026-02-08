import type React from 'react'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react'
import { ApiError, apiJson } from '../../lib/api'
import { readJson, writeJson } from '../../lib/storage'
import { formatElapsed } from '../../lib/time'
import type {
  BackendTask,
  StoredTask,
  TaskStatus,
  TaskType,
} from '../../lib/types'
import {
  LEGACY_TASK_KEY,
  TASK_STORAGE_PREFIX,
  TASK_TYPES,
  taskStorageKey,
} from './taskKeys'

type State = { tasks: Partial<Record<TaskType, StoredTask>> }

type Action =
  | { type: 'hydrate'; tasks: Partial<Record<TaskType, StoredTask>> }
  | { type: 'set'; taskType: TaskType; task: StoredTask }
  | { type: 'remove'; taskType: TaskType }

function reduce(state: State, action: Action): State {
  switch (action.type) {
    case 'hydrate':
      return { tasks: action.tasks }
    case 'set':
      return { tasks: { ...state.tasks, [action.taskType]: action.task } }
    case 'remove': {
      const next = { ...state.tasks }
      delete next[action.taskType]
      return { tasks: next }
    }
  }
}

function isTerminal(status: TaskStatus | undefined) {
  return status === 'completed' || status === 'failed' || status === 'cancelled'
}

const MAX_TASK_AGE_MS = 30 * 60 * 1000

function pruneExpired(tasks: Partial<Record<TaskType, StoredTask>>) {
  const now = Date.now()
  const next: Partial<Record<TaskType, StoredTask>> = {}
  for (const taskType of TASK_TYPES) {
    const t = tasks[taskType]
    if (!t) continue
    if (!t.startedAt) continue
    if (now - t.startedAt > MAX_TASK_AGE_MS) continue
    next[taskType] = t
  }
  return next
}

function migrateLegacyTask() {
  const legacy = localStorage.getItem(LEGACY_TASK_KEY)
  if (!legacy) return
  try {
    const task = JSON.parse(legacy) as Partial<StoredTask> & { type?: TaskType }
    if (task?.type) {
      const coerced: StoredTask = {
        taskId: task.taskId ?? null,
        type: task.type,
        originPage: task.originPage ?? '/',
        description: task.description ?? 'Processing…',
        formState: task.formState ?? null,
        startedAt: task.startedAt ?? Date.now(),
        status: (task.status as TaskStatus) ?? 'processing',
        dismissed: false,
        result: task.result,
        error: task.error ?? null,
        completedAt: task.completedAt,
      }
      writeJson(taskStorageKey(task.type), coerced)
    }
  } catch {
    // ignore
  }
  localStorage.removeItem(LEGACY_TASK_KEY)
}

function readAllStoredTasks(): Partial<Record<TaskType, StoredTask>> {
  const out: Partial<Record<TaskType, StoredTask>> = {}
  for (const t of TASK_TYPES) {
    const task = readJson<StoredTask>(taskStorageKey(t))
    if (!task) continue
    out[t] = {
      ...task,
      status: task.status ?? 'processing',
      dismissed: task.dismissed ?? false,
    }
  }
  return pruneExpired(out)
}

type TaskContextValue = {
  tasks: Partial<Record<TaskType, StoredTask>>
  activeCount: number
  startTask: (
    taskId: string | null,
    taskType: TaskType,
    originPage: string,
    description: string,
    formState?: unknown | null,
  ) => void
  dismissTask: (taskType: TaskType) => void
  cancelTask: (taskType: TaskType) => Promise<boolean>
  clearTask: (taskType: TaskType) => void
  getStatusText: (status: TaskStatus, modalStatus?: string | null) => string
  formatTaskElapsed: (task: StoredTask) => string
}

const TaskContext = createContext<TaskContextValue | null>(null)

export function TaskProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reduce, { tasks: {} })

  const pollIntervalsRef = useRef<Partial<Record<TaskType, number>>>({})

  const clearTask = useCallback(
    (taskType: TaskType) => {
      const task = state.tasks[taskType]
      if (task?.taskId) {
        apiJson(`/api/tasks/${task.taskId}`, { method: 'DELETE' }).catch(
          () => {},
        )
      }
      localStorage.removeItem(taskStorageKey(taskType))
      dispatch({ type: 'remove', taskType })
    },
    [state.tasks],
  )

  useEffect(() => {
    migrateLegacyTask()
    dispatch({ type: 'hydrate', tasks: readAllStoredTasks() })
  }, [])

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (!e.key) return
      if (e.key === LEGACY_TASK_KEY) {
        migrateLegacyTask()
        dispatch({ type: 'hydrate', tasks: readAllStoredTasks() })
        return
      }
      if (!e.key.startsWith(TASK_STORAGE_PREFIX)) return
      dispatch({ type: 'hydrate', tasks: readAllStoredTasks() })
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  useEffect(() => {
    const id = window.setInterval(() => {
      dispatch({ type: 'hydrate', tasks: readAllStoredTasks() })
    }, 5000)
    return () => window.clearInterval(id)
  }, [])

  const getStatusText = useCallback(
    (status: TaskStatus, modalStatus?: string | null) => {
      if (modalStatus === 'queued' || status === 'pending')
        return 'Waiting for GPU…'
      if (modalStatus === 'processing' || status === 'processing')
        return 'Generating…'
      if (modalStatus === 'sending') return 'Starting generation…'
      return 'Processing…'
    },
    [],
  )

  const formatTaskElapsed = useCallback((task: StoredTask) => {
    if (task.status === 'completed') return 'Ready'
    if (task.status === 'failed') return 'Failed'
    if (task.status === 'cancelled') return 'Cancelled'
    return formatElapsed(task.startedAt)
  }, [])

  const startTask = useCallback(
    (
      taskId: string | null,
      taskType: TaskType,
      originPage: string,
      description: string,
      formState: unknown | null = null,
    ) => {
      const task: StoredTask = {
        taskId,
        type: taskType,
        originPage,
        description,
        formState,
        startedAt: Date.now(),
        status: 'pending',
        dismissed: false,
      }
      writeJson(taskStorageKey(taskType), task)
      dispatch({ type: 'set', taskType, task })
    },
    [],
  )

  const dismissTask = useCallback(
    (taskType: TaskType) => {
      const task = state.tasks[taskType]
      if (!task) return
      const next: StoredTask = { ...task, dismissed: true }
      writeJson(taskStorageKey(taskType), next)
      dispatch({ type: 'set', taskType, task: next })
    },
    [state.tasks],
  )

  const cancelTask = useCallback(
    async (taskType: TaskType) => {
      const task = state.tasks[taskType]
      if (!task?.taskId) return false
      try {
        await apiJson(`/api/tasks/${task.taskId}/cancel`, { method: 'POST' })
        const next: StoredTask = {
          ...task,
          status: 'cancelled',
          error: 'Cancelled by user',
          completedAt: Date.now(),
        }
        writeJson(taskStorageKey(taskType), next)
        dispatch({ type: 'set', taskType, task: next })
        return true
      } catch {
        return false
      }
    },
    [state.tasks],
  )

  useEffect(() => {
    const stopPolling = (taskType: TaskType) => {
      const id = pollIntervalsRef.current[taskType]
      if (!id) return
      window.clearInterval(id)
      delete pollIntervalsRef.current[taskType]
    }

    const ensurePolling = (taskType: TaskType) => {
      const task = state.tasks[taskType]
      if (!task?.taskId) {
        stopPolling(taskType)
        return
      }
      if (isTerminal(task.status)) {
        stopPolling(taskType)
        return
      }
      if (pollIntervalsRef.current[taskType]) return

      const poll = async () => {
        const current = readJson<StoredTask>(taskStorageKey(taskType))
        if (!current?.taskId) {
          stopPolling(taskType)
          return
        }
        if (isTerminal(current.status)) {
          stopPolling(taskType)
          return
        }

        try {
          const taskData = await apiJson<BackendTask>(
            `/api/tasks/${current.taskId}`,
          )
          const updated: StoredTask = {
            ...current,
            status: taskData.status,
            result: taskData.result,
            error: taskData.error ?? null,
            modalStatus: taskData.modal_status ?? null,
          }
          if (isTerminal(updated.status)) updated.completedAt = Date.now()
          writeJson(taskStorageKey(taskType), updated)
          dispatch({ type: 'set', taskType, task: updated })
        } catch (e) {
          if (e instanceof ApiError && e.status === 404) {
            clearTask(taskType)
            stopPolling(taskType)
          }
        }
      }

      void poll()
      pollIntervalsRef.current[taskType] = window.setInterval(poll, 1000)
    }

    TASK_TYPES.forEach(ensurePolling)
    return () => {
      TASK_TYPES.forEach(stopPolling)
    }
  }, [clearTask, state.tasks])

  const value = useMemo<TaskContextValue>(() => {
    const activeCount = TASK_TYPES.filter((t) => {
      const task = state.tasks[t]
      return task && !isTerminal(task.status)
    }).length

    return {
      tasks: state.tasks,
      activeCount,
      startTask,
      dismissTask,
      cancelTask,
      clearTask,
      getStatusText,
      formatTaskElapsed,
    }
  }, [
    cancelTask,
    clearTask,
    dismissTask,
    formatTaskElapsed,
    getStatusText,
    startTask,
    state.tasks,
  ])

  return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>
}

export function useTasks() {
  const ctx = useContext(TaskContext)
  if (!ctx) throw new Error('useTasks must be used within TaskProvider')
  return ctx
}
