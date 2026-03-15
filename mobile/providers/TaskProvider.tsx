import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';
import { ApiError, apiJson } from '../lib/api';
import type { BackendTask, StoredTask, TaskStatus, TaskType } from '../lib/types';

type TaskStore = {
  byId: Record<string, StoredTask>;
  orderedIds: string[];
};

type Action =
  | { type: 'upsert'; task: StoredTask }
  | { type: 'remove'; taskId: string };

const EMPTY: TaskStore = { byId: {}, orderedIds: [] };

function isTerminal(s: TaskStatus | undefined) {
  return s === 'completed' || s === 'failed' || s === 'cancelled';
}

function sortIds(byId: Record<string, StoredTask>) {
  return Object.values(byId)
    .sort((a, b) => (b.completedAt ?? b.startedAt) - (a.completedAt ?? a.startedAt))
    .map((t) => t.taskId);
}

function reduce(state: TaskStore, action: Action): TaskStore {
  switch (action.type) {
    case 'upsert': {
      const byId = { ...state.byId, [action.task.taskId]: action.task };
      return { byId, orderedIds: sortIds(byId) };
    }
    case 'remove': {
      const byId = { ...state.byId };
      delete byId[action.taskId];
      return { byId, orderedIds: sortIds(byId) };
    }
  }
}

type TaskCtx = {
  tasks: StoredTask[];
  activeCount: number;
  startTask: (taskId: string | null, type: TaskType, description: string) => void;
  dismissTask: (taskId: string) => Promise<boolean>;
  cancelTask: (taskId: string) => Promise<boolean>;
  getLatestTask: (type: TaskType) => StoredTask | null;
  getTasksByType: (type: TaskType) => StoredTask[];
  getStatusText: (status: TaskStatus, providerStatus?: string | null) => string;
};

const TaskContext = createContext<TaskCtx | null>(null);

export function TaskProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reduce, EMPTY);
  const stateRef = useRef(state);
  const pollTimers = useRef<Record<string, ReturnType<typeof setInterval>>>({});
  const pollInflight = useRef<Record<string, boolean>>({});

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const upsert = useCallback((task: StoredTask) => {
    dispatch({ type: 'upsert', task });
  }, []);

  const stopPolling = useCallback((taskId: string) => {
    if (pollTimers.current[taskId]) {
      clearInterval(pollTimers.current[taskId]);
      delete pollTimers.current[taskId];
    }
    delete pollInflight.current[taskId];
  }, []);

  // Poll active tasks every 1s
  useEffect(() => {
    for (const task of Object.values(state.byId)) {
      if (!task) continue;
      if (isTerminal(task.status)) {
        stopPolling(task.taskId);
        continue;
      }
      if (pollTimers.current[task.taskId]) continue;

      const poll = async () => {
        const id = task.taskId;
        if (pollInflight.current[id]) return;
        pollInflight.current[id] = true;
        try {
          const current = stateRef.current.byId[id];
          if (!current || isTerminal(current.status)) {
            stopPolling(id);
            return;
          }
          const data = await apiJson<BackendTask>(`/api/tasks/${id}`);
          const updated: StoredTask = {
            ...current,
            status: data.status,
            providerStatus: data.provider_status ?? current.providerStatus,
            result: data.result ?? current.result,
            error: data.error ?? current.error,
            completedAt: data.completed_at
              ? new Date(data.completed_at).getTime()
              : current.completedAt,
            title: data.title ?? current.title,
            subtitle: data.subtitle ?? current.subtitle,
          };
          upsert(updated);
          if (isTerminal(updated.status)) stopPolling(id);
        } catch (e) {
          if (e instanceof ApiError && e.status === 404) {
            stopPolling(task.taskId);
            dispatch({ type: 'remove', taskId: task.taskId });
          }
        } finally {
          pollInflight.current[task.taskId] = false;
        }
      };

      void poll();
      pollTimers.current[task.taskId] = setInterval(poll, 1000);
    }
  }, [state.byId, stopPolling, upsert]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      for (const id of Object.keys(pollTimers.current)) {
        clearInterval(pollTimers.current[id]);
      }
    };
  }, []);

  const startTask = useCallback(
    (taskId: string | null, type: TaskType, description: string) => {
      const id = taskId ?? `local-${Date.now()}`;
      upsert({
        taskId: id,
        type,
        originPage: type,
        description,
        formState: null,
        startedAt: Date.now(),
        status: 'pending',
        dismissed: false,
      });
    },
    [upsert],
  );

  const cancelTask = useCallback(
    async (taskId: string) => {
      try {
        await apiJson(`/api/tasks/${taskId}/cancel`, { method: 'POST' });
        const t = stateRef.current.byId[taskId];
        if (t) {
          upsert({
            ...t,
            status: 'cancelled',
            error: 'Cancelled by user',
            completedAt: Date.now(),
            providerStatus: 'cancelled',
          });
        }
        return true;
      } catch {
        return false;
      }
    },
    [upsert],
  );

  const dismissTask = useCallback(
    async (taskId: string) => {
      stopPolling(taskId);
      dispatch({ type: 'remove', taskId });
      try {
        await apiJson(`/api/tasks/${taskId}`, { method: 'DELETE' });
        return true;
      } catch {
        return false;
      }
    },
    [stopPolling],
  );

  const getStatusText = useCallback(
    (status: TaskStatus, providerStatus?: string | null) => {
      const ps = (providerStatus ?? '').toLowerCase();
      if (ps === 'provider_submitting') return 'Submitting...';
      if (ps === 'provider_queued' || ps === 'queued') return 'Waiting for GPU...';
      if (ps === 'provider_synthesizing') return 'Synthesizing...';
      if (ps === 'provider_downloading') return 'Downloading...';
      if (ps === 'provider_persisting') return 'Finalizing...';
      if (ps === 'processing') return 'Generating...';
      if (status === 'pending') return 'Waiting for GPU...';
      if (status === 'processing') return 'Generating...';
      return 'Processing...';
    },
    [],
  );

  const tasks = useMemo(
    () =>
      state.orderedIds
        .map((id) => state.byId[id])
        .filter((t): t is StoredTask => Boolean(t)),
    [state.byId, state.orderedIds],
  );

  const value = useMemo<TaskCtx>(
    () => ({
      tasks,
      activeCount: tasks.filter((t) => !isTerminal(t.status)).length,
      startTask,
      dismissTask,
      cancelTask,
      getLatestTask: (type) => tasks.find((t) => t.type === type) ?? null,
      getTasksByType: (type) => tasks.filter((t) => t.type === type),
      getStatusText,
    }),
    [tasks, startTask, dismissTask, cancelTask, getStatusText],
  );

  return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>;
}

export function useTasks() {
  const ctx = useContext(TaskContext);
  if (!ctx) throw new Error('useTasks must be used within TaskProvider');
  return ctx;
}
