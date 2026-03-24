import type React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";
import { ApiError, apiJson } from "../../lib/api";
import { readJson, writeJson } from "../../lib/storage";
import { formatElapsed } from "../../lib/time";
import type { BackendTask, StoredTask, TaskStatus, TaskType } from "../../lib/types";
import {
  coerceTaskType,
  LEGACY_TASK_KEY,
  LEGACY_TASK_TYPES,
  TASK_STORAGE_KEY,
  taskLabel,
  taskOriginPage,
} from "./taskKeys";

type TaskStore = {
  byId: Record<string, StoredTask>;
  orderedIds: string[];
};

type Action =
  | { type: "hydrate"; store: TaskStore }
  | { type: "upsert"; task: StoredTask }
  | { type: "remove"; taskId: string };

const EMPTY_STORE: TaskStore = { byId: {}, orderedIds: [] };
const MAX_TERMINAL_TASK_AGE_MS = 30 * 60 * 1000;

function isTerminal(status: TaskStatus | undefined) {
  return status === "completed" || status === "failed" || status === "cancelled";
}

function normalizeStatus(value: unknown): TaskStatus {
  if (
    value === "pending" ||
    value === "processing" ||
    value === "completed" ||
    value === "failed" ||
    value === "cancelled"
  ) {
    return value;
  }
  return "pending";
}

function parseTimestamp(value: unknown): number | null {
  if (typeof value !== "string" || !value) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function taskSortTimestamp(task: StoredTask) {
  return task.completedAt ?? task.startedAt;
}

function buildTaskDescription(task: {
  description?: unknown;
  title?: unknown;
  type?: TaskType | unknown;
}) {
  if (typeof task.description === "string" && task.description.trim()) {
    return task.description;
  }
  if (typeof task.title === "string" && task.title.trim()) {
    return task.title;
  }
  const label = typeof task.type === "string" ? taskLabel(task.type) : "Task";
  return `${label} task`;
}

function sortTaskIds(byId: Record<string, StoredTask>) {
  return Object.values(byId)
    .toSorted((a: StoredTask, b: StoredTask) => {
      const timeDelta = taskSortTimestamp(b) - taskSortTimestamp(a);
      if (timeDelta !== 0) return timeDelta;
      return b.taskId.localeCompare(a.taskId);
    })
    .map((task: StoredTask) => task.taskId);
}

function pruneExpired(store: TaskStore): TaskStore {
  const now = Date.now();
  const nextById: Record<string, StoredTask> = {};

  for (const taskId of store.orderedIds) {
    const task = store.byId[taskId];
    if (!task) continue;
    if (!task.taskId) continue;
    if (isTerminal(task.status)) {
      const completedAt = task.completedAt ?? task.startedAt;
      if (now - completedAt > MAX_TERMINAL_TASK_AGE_MS) continue;
    }
    nextById[task.taskId] = task;
  }

  return {
    byId: nextById,
    orderedIds: sortTaskIds(nextById),
  };
}

function reduce(state: TaskStore, action: Action): TaskStore {
  switch (action.type) {
    case "hydrate":
      return action.store;
    case "upsert": {
      const nextById = {
        ...state.byId,
        [action.task.taskId]: action.task,
      };
      return pruneExpired({
        byId: nextById,
        orderedIds: sortTaskIds(nextById),
      });
    }
    case "remove": {
      const nextById = { ...state.byId };
      delete nextById[action.taskId];
      return {
        byId: nextById,
        orderedIds: sortTaskIds(nextById),
      };
    }
  }
}

function coerceStoredTask(
  input: Partial<Omit<StoredTask, "type" | "taskId">> & {
    type?: unknown;
    taskId?: unknown;
    dismissed?: boolean;
  },
): StoredTask | null {
  const type = coerceTaskType(input.type);
  const taskId = typeof input.taskId === "string" && input.taskId.trim() ? input.taskId : null;

  if (!type || !taskId) return null;
  if (input.dismissed === true) return null;

  const startedAt =
    typeof input.startedAt === "number" && Number.isFinite(input.startedAt)
      ? input.startedAt
      : Date.now();
  const completedAt =
    typeof input.completedAt === "number" && Number.isFinite(input.completedAt)
      ? input.completedAt
      : undefined;

  return {
    taskId,
    type,
    originPage:
      typeof input.originPage === "string" && input.originPage.trim()
        ? input.originPage
        : taskOriginPage(type),
    description: buildTaskDescription({
      ...input,
      type,
    }),
    formState: input.formState ?? null,
    startedAt,
    status: normalizeStatus(input.status),
    dismissed: false,
    modalStatus: typeof input.modalStatus === "string" ? input.modalStatus : null,
    providerStatus: typeof input.providerStatus === "string" ? input.providerStatus : null,
    result: input.result,
    error: typeof input.error === "string" ? input.error : null,
    completedAt,
    createdAt: typeof input.createdAt === "string" ? input.createdAt : null,
    title: typeof input.title === "string" ? input.title : null,
    subtitle: typeof input.subtitle === "string" ? input.subtitle : null,
    language: typeof input.language === "string" ? input.language : null,
    voiceName: typeof input.voiceName === "string" ? input.voiceName : null,
    textPreview: typeof input.textPreview === "string" ? input.textPreview : null,
    estimatedDurationMinutes:
      typeof input.estimatedDurationMinutes === "number" ? input.estimatedDurationMinutes : null,
  };
}

function readTaskStore(): TaskStore {
  const stored = readJson<TaskStore>(TASK_STORAGE_KEY);
  if (!stored || typeof stored !== "object") return EMPTY_STORE;

  const inputById = stored.byId && typeof stored.byId === "object" ? stored.byId : {};
  const nextById: Record<string, StoredTask> = {};

  for (const value of Object.values(inputById)) {
    if (!value || typeof value !== "object") continue;
    const task = coerceStoredTask(value as Partial<StoredTask>);
    if (!task) continue;
    nextById[task.taskId] = task;
  }

  return pruneExpired({
    byId: nextById,
    orderedIds: sortTaskIds(nextById),
  });
}

function writeTaskStore(store: TaskStore) {
  writeJson(TASK_STORAGE_KEY, store);
}

function mergeTask(store: TaskStore, task: StoredTask): TaskStore {
  return reduce(store, { type: "upsert", task });
}

function migrateLegacyTasks() {
  const initialStore = readTaskStore();
  let nextStore = initialStore;

  const migrateSingleTask = (
    raw: string | null,
    fallbackType?: (typeof LEGACY_TASK_TYPES)[number],
  ) => {
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Partial<Omit<StoredTask, "type" | "taskId">> & {
        type?: unknown;
        taskId?: unknown;
        dismissed?: boolean;
      };
      const task = coerceStoredTask({
        ...parsed,
        type: (parsed.type ?? fallbackType) as unknown,
      });
      if (!task) return;
      nextStore = mergeTask(nextStore, task);
    } catch {
      return;
    }
  };

  migrateSingleTask(localStorage.getItem(LEGACY_TASK_KEY));
  for (const legacyType of LEGACY_TASK_TYPES) {
    const key = `utter_task_${legacyType}`;
    migrateSingleTask(localStorage.getItem(key), legacyType);
    localStorage.removeItem(key);
  }
  localStorage.removeItem(LEGACY_TASK_KEY);

  writeTaskStore(nextStore);
  return nextStore;
}

function taskFromBackend(
  backendTask: BackendTask,
  existingTask?: StoredTask | null,
): StoredTask | null {
  const type = coerceTaskType(backendTask.type);
  if (!type) return null;

  const startedAt = parseTimestamp(backendTask.created_at) ?? existingTask?.startedAt ?? Date.now();
  const completedAt = parseTimestamp(backendTask.completed_at) ?? existingTask?.completedAt;

  return {
    taskId: backendTask.id,
    type,
    originPage: backendTask.origin_page ?? existingTask?.originPage ?? taskOriginPage(type),
    description: buildTaskDescription({
      type,
      title: backendTask.title ?? existingTask?.title ?? undefined,
      description: existingTask?.description ?? undefined,
    }),
    formState: existingTask?.formState ?? null,
    startedAt,
    status: backendTask.status,
    dismissed: false,
    modalStatus: existingTask?.modalStatus ?? null,
    providerStatus: backendTask.provider_status ?? existingTask?.providerStatus ?? null,
    result: backendTask.result ?? existingTask?.result,
    error: backendTask.error ?? existingTask?.error ?? null,
    completedAt,
    createdAt: backendTask.created_at ?? existingTask?.createdAt ?? null,
    title: backendTask.title ?? existingTask?.title ?? null,
    subtitle: backendTask.subtitle ?? existingTask?.subtitle ?? null,
    language: backendTask.language ?? existingTask?.language ?? null,
    voiceName: backendTask.voice_name ?? existingTask?.voiceName ?? null,
    textPreview: backendTask.text_preview ?? existingTask?.textPreview ?? null,
    estimatedDurationMinutes:
      backendTask.estimated_duration_minutes ?? existingTask?.estimatedDurationMinutes ?? null,
  };
}

type TaskContextValue = {
  tasks: StoredTask[];
  tasksById: Record<string, StoredTask>;
  activeCount: number;
  startTask: (
    taskId: string | null,
    taskType: TaskType,
    originPage: string,
    description: string,
    formState?: unknown | null,
  ) => void;
  dismissTask: (taskId: string) => Promise<boolean>;
  cancelTask: (taskId: string) => Promise<boolean>;
  clearTask: (taskId: string) => Promise<boolean>;
  getLatestTask: (taskType: TaskType) => StoredTask | null;
  getTasksByType: (taskType: TaskType) => StoredTask[];
  getStatusText: (
    status: TaskStatus,
    modalStatus?: string | null,
    providerStatus?: string | null,
  ) => string;
  formatTaskElapsed: (task: StoredTask) => string;
};

const TaskContext = createContext<TaskContextValue | null>(null);

export function TaskProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reduce, EMPTY_STORE);
  const stateRef = useRef(state);
  const pollIntervalsRef = useRef<Record<string, number>>({});
  const pollInFlightRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const replaceStore = useCallback((nextStore: TaskStore) => {
    const pruned = pruneExpired(nextStore);
    writeTaskStore(pruned);
    stateRef.current = pruned;
    dispatch({ type: "hydrate", store: pruned });
  }, []);

  const upsertTask = useCallback(
    (task: StoredTask) => {
      replaceStore(mergeTask(stateRef.current, task));
    },
    [replaceStore],
  );

  const removeTask = useCallback(
    (taskId: string) => {
      const nextStore = reduce(stateRef.current, { type: "remove", taskId });
      replaceStore(nextStore);
    },
    [replaceStore],
  );

  const stopPolling = useCallback((taskId: string) => {
    const id = pollIntervalsRef.current[taskId];
    if (id) {
      window.clearInterval(id);
      delete pollIntervalsRef.current[taskId];
    }
    delete pollInFlightRef.current[taskId];
  }, []);

  const clearTask = useCallback(
    async (taskId: string) => {
      const task = stateRef.current.byId[taskId];
      stopPolling(taskId);
      removeTask(taskId);

      if (!task?.taskId) return true;

      try {
        await apiJson(`/api/tasks/${task.taskId}`, { method: "DELETE" });
        return true;
      } catch {
        return false;
      }
    },
    [removeTask, stopPolling],
  );

  const dismissTask = useCallback(
    async (taskId: string) => {
      return await clearTask(taskId);
    },
    [clearTask],
  );

  useEffect(() => {
    const store = migrateLegacyTasks();
    stateRef.current = store;
    dispatch({ type: "hydrate", store });
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (!e.key) return;
      if (
        e.key === TASK_STORAGE_KEY ||
        e.key === LEGACY_TASK_KEY ||
        e.key.startsWith("utter_task_")
      ) {
        const store = migrateLegacyTasks();
        stateRef.current = store;
        dispatch({ type: "hydrate", store });
      }
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      replaceStore(stateRef.current);
    }, 15000);
    return () => window.clearInterval(id);
  }, [replaceStore]);

  const getStatusText = useCallback(
    (status: TaskStatus, modalStatus?: string | null, providerStatus?: string | null) => {
      const effectiveStatus = (providerStatus ?? modalStatus ?? "").toLowerCase();
      if (effectiveStatus === "provider_submitting") return "Submitting...";
      if (effectiveStatus === "provider_queued" || effectiveStatus === "queued")
        return "Waiting for GPU...";
      if (effectiveStatus === "provider_synthesizing") return "Synthesizing...";
      if (effectiveStatus === "provider_downloading") return "Downloading...";
      if (effectiveStatus === "provider_persisting") return "Finalizing...";
      if (effectiveStatus === "processing") return "Generating...";
      if (effectiveStatus === "sending") return "Starting generation...";
      if (modalStatus === "queued" || status === "pending") return "Waiting for GPU...";
      if (modalStatus === "processing" || status === "processing") return "Generating...";
      if (modalStatus === "sending") return "Starting generation...";
      return "Processing...";
    },
    [],
  );

  const formatTaskElapsed = useCallback((task: StoredTask) => {
    if (task.status === "completed") return "Ready";
    if (task.status === "failed") return "Failed";
    if (task.status === "cancelled") return "Cancelled";
    return formatElapsed(task.startedAt);
  }, []);

  const startTask = useCallback(
    (
      taskId: string | null,
      taskType: TaskType,
      originPage: string,
      description: string,
      formState: unknown | null = null,
    ) => {
      const stableTaskId = taskId ?? crypto.randomUUID();
      upsertTask({
        taskId: stableTaskId,
        type: taskType,
        originPage,
        description,
        formState,
        startedAt: Date.now(),
        status: "pending",
        dismissed: false,
        title: description,
      });
    },
    [upsertTask],
  );

  const cancelTask = useCallback(
    async (taskId: string) => {
      const task = stateRef.current.byId[taskId];
      if (!task?.taskId) return false;

      try {
        await apiJson(`/api/tasks/${task.taskId}/cancel`, { method: "POST" });
        upsertTask({
          ...task,
          status: "cancelled",
          error: "Cancelled by user",
          completedAt: Date.now(),
          providerStatus: "cancelled",
        });
        return true;
      } catch {
        return false;
      }
    },
    [upsertTask],
  );

  useEffect(() => {
    const tasks = state.orderedIds
      .map((taskId) => state.byId[taskId])
      .filter((task): task is StoredTask => Boolean(task));

    const ensurePolling = (task: StoredTask) => {
      const taskId = task.taskId;
      if (!taskId || isTerminal(task.status)) {
        stopPolling(task.taskId);
        return;
      }
      if (pollIntervalsRef.current[taskId]) return;

      const poll = async () => {
        if (pollInFlightRef.current[taskId]) return;
        pollInFlightRef.current[taskId] = true;

        try {
          const currentTask = stateRef.current.byId[taskId];
          if (!currentTask || isTerminal(currentTask.status)) {
            stopPolling(taskId);
            return;
          }

          try {
            const taskData = await apiJson<BackendTask>(`/api/tasks/${taskId}`);
            const updated = taskFromBackend(taskData, currentTask);
            if (!updated) {
              stopPolling(taskId);
              return;
            }
            upsertTask(updated);
            if (isTerminal(updated.status)) {
              stopPolling(taskId);
            }
          } catch (error) {
            if (error instanceof ApiError && error.status === 404) {
              stopPolling(taskId);
              removeTask(taskId);
            }
          }
        } finally {
          pollInFlightRef.current[taskId] = false;
        }
      };

      void poll();
      pollIntervalsRef.current[taskId] = window.setInterval(poll, 1000);
    };

    for (const task of tasks) {
      ensurePolling(task);
    }

    for (const taskId of Object.keys(pollIntervalsRef.current)) {
      const task = state.byId[taskId];
      if (!task || isTerminal(task.status)) {
        stopPolling(taskId);
      }
    }
  }, [removeTask, state.byId, state.orderedIds, stopPolling, upsertTask]);

  useEffect(() => {
    const pollIntervals = pollIntervalsRef.current;

    return () => {
      for (const taskId of Object.keys(pollIntervals)) {
        stopPolling(taskId);
      }
    };
  }, [stopPolling]);

  const tasks = useMemo(
    () =>
      state.orderedIds
        .map((taskId) => state.byId[taskId])
        .filter((task): task is StoredTask => Boolean(task)),
    [state.byId, state.orderedIds],
  );

  const value = useMemo<TaskContextValue>(() => {
    const activeCount = tasks.filter((task) => !isTerminal(task.status)).length;

    return {
      tasks,
      tasksById: state.byId,
      activeCount,
      startTask,
      dismissTask,
      cancelTask,
      clearTask,
      getLatestTask: (taskType) => tasks.find((task) => task.type === taskType) ?? null,
      getTasksByType: (taskType) => tasks.filter((task) => task.type === taskType),
      getStatusText,
      formatTaskElapsed,
    };
  }, [
    cancelTask,
    clearTask,
    dismissTask,
    formatTaskElapsed,
    getStatusText,
    startTask,
    state.byId,
    tasks,
  ]);

  return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>;
}

export function useTasks() {
  const ctx = useContext(TaskContext);
  if (!ctx) throw new Error("useTasks must be used within TaskProvider");
  return ctx;
}
