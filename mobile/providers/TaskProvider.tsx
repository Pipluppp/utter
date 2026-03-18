import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiError, apiJson } from '../lib/api';
import type { BackendTask, StoredTask, TaskStatus, TaskType } from '../lib/types';

type TaskStore = {
  byId: Record<string, StoredTask>;
  orderedIds: string[];
};

type Action =
  | { type: 'upsert'; task: StoredTask }
  | { type: 'remove'; taskId: string }
  | { type: 'hydrate'; state: TaskStore };

const EMPTY: TaskStore = { byId: {}, orderedIds: [] };
const STORAGE_KEY = 'utter_tasks';
const EXPIRY_MS = 30 * 60 * 1000;

function isTerminal(s: TaskStatus | undefined) {
  return s === 'completed' || s === 'failed' || s === 'cancelled';
}

function sortIds(byId: Record<string, StoredTask>) {
  return Object.values(byId)
    .sort((a, b) => (b.completedAt ?? b.startedAt) - (a.completedAt ?? a.startedAt))
    .map((t) => t.taskId);
}

function taskChanged(a: StoredTask, b: StoredTask): boolean {
  return (
    a.status !== b.status ||
    a.providerStatus !== b.providerStatus ||
    a.result !== b.result ||
    a.error !== b.error ||
    a.completedAt !== b.completedAt ||
    a.title !== b.title ||
    a.subtitle !== b.subtitle
  );
}

function reduce(state: TaskStore, action: Action): TaskStore {
  switch (action.type) {
    case 'upsert': {
      const existing = state.byId[action.task.taskId];
      if (existing && !taskChanged(existing, action.task)) return state;
      const byId = { ...state.byId, [action.task.taskId]: action.task };
      return { byId, orderedIds: sortIds(byId) };
    }
    case 'remove': {
      if (!state.byId[action.taskId]) return state;
      const byId = { ...state.byId };
      delete byId[action.taskId];
      return { byId, orderedIds: sortIds(byId) };
    }
    case 'hydrate':
      return action.state;
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
  const pollingSet = useRef<Set<string>>(new Set());
  const persistTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

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
    pollingSet.current.delete(taskId);
    delete pollInflight.current[taskId];
  }, []);

  const ensurePolling = useCallback((taskId: string) => {
    if (pollingSet.current.has(taskId)) return;
    pollingSet.current.add(taskId);

    const poll = async () => {
      if (pollInflight.current[taskId]) return;
      pollInflight.current[taskId] = true;
      try {
        const current = stateRef.current.byId[taskId];
        if (!current || isTerminal(current.status)) {
          stopPolling(taskId);
          return;
        }
        const data = await apiJson<BackendTask>(`/api/tasks/${taskId}`);
        const updated: StoredTask = {
          ...current,
          status: data.status,
          providerStatus: data.provider_status ?? current.providerStatus,
          generationId: data.generation_id ?? current.generationId,
          result: data.result ?? current.result,
          error: data.error ?? current.error,
          completedAt: data.completed_at
            ? new Date(data.completed_at).getTime()
            : current.completedAt,
          title: data.title ?? current.title,
          subtitle: data.subtitle ?? current.subtitle,
        };
        upsert(updated);
        if (isTerminal(updated.status)) stopPolling(taskId);
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) {
          stopPolling(taskId);
          dispatch({ type: 'remove', taskId });
        }
      } finally {
        pollInflight.current[taskId] = false;
      }
    };

    void poll();
    pollTimers.current[taskId] = setInterval(poll, 1000);
  }, [upsert, stopPolling]);

  // Persist state to AsyncStorage (debounced)
  useEffect(() => {
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
    }, 500);
  }, [state]);

  // Hydrate from AsyncStorage on mount
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const saved: TaskStore = JSON.parse(raw);
        const now = Date.now();
        const pruned: Record<string, StoredTask> = {};
        for (const [id, task] of Object.entries(saved.byId)) {
          if (task.completedAt && now - task.completedAt > EXPIRY_MS) continue;
          pruned[id] = task;
        }
        const hydrated = { byId: pruned, orderedIds: sortIds(pruned) };
        dispatch({ type: 'hydrate', state: hydrated });
        for (const task of Object.values(pruned)) {
          if (!isTerminal(task.status)) {
            ensurePolling(task.taskId);
          }
        }
      } catch {}
    })();
  }, [ensurePolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      for (const id of Object.keys(pollTimers.current)) {
        clearInterval(pollTimers.current[id]);
      }
      if (persistTimer.current) clearTimeout(persistTimer.current);
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
      ensurePolling(id);
    },
    [upsert, ensurePolling],
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
      try {
        await apiJson(`/api/tasks/${taskId}`, { method: 'DELETE' });
        dispatch({ type: 'remove', taskId });
        return true;
      } catch {
        const task = stateRef.current.byId[taskId];
        if (task && !isTerminal(task.status)) {
          ensurePolling(taskId);
        }
        return false;
      }
    },
    [stopPolling, ensurePolling],
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

  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  const getTasksByType = useCallback(
    (type: TaskType) => tasksRef.current.filter((t) => t.type === type),
    [],
  );

  const getLatestTask = useCallback(
    (type: TaskType) => tasksRef.current.find((t) => t.type === type) ?? null,
    [],
  );

  const value = useMemo<TaskCtx>(
    () => ({
      tasks,
      activeCount: tasks.filter((t) => !isTerminal(t.status)).length,
      startTask,
      dismissTask,
      cancelTask,
      getLatestTask,
      getTasksByType,
      getStatusText,
    }),
    [tasks, startTask, dismissTask, cancelTask, getLatestTask, getTasksByType, getStatusText],
  );

  return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>;
}

export function useTasks() {
  const ctx = useContext(TaskContext);
  if (!ctx) throw new Error('useTasks must be used within TaskProvider');
  return ctx;
}
