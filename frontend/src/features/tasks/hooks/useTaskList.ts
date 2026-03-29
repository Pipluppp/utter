import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiJson } from "../../../lib/api";
import type { BackendTaskListItem, TaskListResponse, TaskListType } from "../../../lib/types";
import { useDeferredLoading } from "../../shared/hooks";

const POLL_MS = 5000;
const ERROR_POLL_MS = 10000;

export type UseTaskListResult = {
  tasks: BackendTaskListItem[];
  loading: boolean;
  showLoading: boolean;
  loadingMore: boolean;
  error: string | null;
  nextBefore: string | null;
  loadMore: () => Promise<void>;
  setError: (error: string | null) => void;
  refreshAfterAction: () => Promise<void>;
  removeTask: (taskId: string) => void;
};

export function useTaskList(typeFilter: TaskListType): UseTaskListResult {
  const [tasks, setTasks] = useState<BackendTaskListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const showLoading = useDeferredLoading(loading);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextBefore, setNextBefore] = useState<string | null>(null);

  const filterQuery = useMemo(() => {
    const params = new URLSearchParams({
      status: "active",
      type: typeFilter,
      limit: "10",
    });
    return params.toString();
  }, [typeFilter]);

  // Initial fetch
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const response = await apiJson<TaskListResponse>(`/api/tasks?${filterQuery}`);
        if (!active) return;
        setTasks(response.tasks);
        setNextBefore(response.next_before);
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Failed to load jobs.");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [filterQuery]);

  // Recursive setTimeout polling with visibilitychange management
  useEffect(() => {
    let timeoutId: number | undefined;
    let cancelled = false;

    async function poll() {
      if (cancelled) return;
      try {
        const response = await apiJson<TaskListResponse>(`/api/tasks?${filterQuery}`);
        if (cancelled) return;
        setTasks(response.tasks);
        setNextBefore(response.next_before);
        if (response.tasks.length > 0) {
          timeoutId = window.setTimeout(poll, POLL_MS);
        }
      } catch (error) {
        if (cancelled) return;
        console.error("Task list poll failed:", error);
        timeoutId = window.setTimeout(poll, ERROR_POLL_MS);
      }
    }

    timeoutId = window.setTimeout(poll, POLL_MS);

    function onVisibilityChange() {
      if (document.visibilityState === "hidden") {
        window.clearTimeout(timeoutId);
        timeoutId = undefined;
      } else {
        void poll();
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [filterQuery]);

  const filterQueryRef = useRef(filterQuery);
  filterQueryRef.current = filterQuery;

  const loadMore = useCallback(async () => {
    if (!nextBefore) return;
    setLoadingMore(true);

    try {
      const params = new URLSearchParams({
        status: "active",
        type: typeFilter,
        limit: "10",
        before: nextBefore,
      });
      const response = await apiJson<TaskListResponse>(`/api/tasks?${params.toString()}`);
      setTasks((current) => [...current, ...response.tasks]);
      setNextBefore(response.next_before);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load more jobs.");
    } finally {
      setLoadingMore(false);
    }
  }, [nextBefore, typeFilter]);

  const refreshAfterAction = useCallback(async () => {
    const response = await apiJson<TaskListResponse>(`/api/tasks?${filterQueryRef.current}`);
    setTasks(response.tasks);
    setNextBefore(response.next_before);
  }, []);

  const removeTask = useCallback((taskId: string) => {
    setTasks((current) => current.filter((t) => t.id !== taskId));
  }, []);

  return {
    tasks,
    loading,
    showLoading,
    loadingMore,
    error,
    nextBefore,
    loadMore,
    setError,
    refreshAfterAction,
    removeTask,
  };
}
