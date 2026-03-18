# Plan 01: TaskProvider Stabilization

**Severity:** Critical + High
**Est:** 1 session
**Files:** `mobile/providers/TaskProvider.tsx`, `mobile/app/(tabs)/generate.tsx`, `mobile/app/(tabs)/design.tsx`, `mobile/app/(tabs)/_layout.tsx`

## Problem

The TaskProvider is the most impactful bug cluster in the mobile app. Every active task triggers a cascade of unnecessary re-renders across all screens every second.

### 1.1 Polling effect re-runs every second (Critical)

`state.byId` is in the `useEffect` dependency array that sets up polling intervals. Since the reducer produces a new `state.byId` object on every `upsert` (every 1s per active task), the effect re-runs every second. The `pollTimers.current[task.taskId]` guard prevents duplicate intervals, but the effect still iterates all tasks every second — O(N) wasted work.

**Fix:** Remove `state.byId` from the effect deps. Track which tasks have active polling via a `pollingSet` ref. Start polling in `startTask` and the initial hydration, not in an effect that watches the full state.

```tsx
// Before (broken):
useEffect(() => {
  for (const task of Object.values(state.byId)) {
    if (pollTimers.current[task.taskId]) continue;
    // ...start interval
  }
}, [state.byId, stopPolling, upsert]);

// After:
const pollingSet = useRef<Set<string>>(new Set());

const ensurePolling = useCallback((taskId: string) => {
  if (pollingSet.current.has(taskId)) return;
  pollingSet.current.add(taskId);
  const poll = async () => { /* ... */ };
  pollTimers.current[taskId] = setInterval(poll, 1000);
}, [upsert, stopPolling]);

// Call ensurePolling in startTask and on mount for existing active tasks
```

### 1.2 Unstable context function references (High)

`getTasksByType` and `getLatestTask` are arrow functions inside `useMemo` that return new arrays/objects every time `tasks` changes. Since `tasks` is a new array every poll cycle, these functions are new references every second. Any consumer using them in `useEffect` deps or `useMemo` deps re-triggers every second.

This is the root cause of the `allTasks` instability in `generate.tsx` and `design.tsx`.

**Fix:** Make these stable `useCallback` references that read from a ref:

```tsx
const tasksRef = useRef(tasks);
tasksRef.current = tasks;

const getTasksByType = useCallback(
  (type: string) => tasksRef.current.filter((t) => t.type === type),
  [], // stable forever
);

const getLatestTask = useCallback(
  (type: string) => tasksRef.current.find((t) => t.type === type) ?? null,
  [],
);
```

Consumers must understand these return **snapshots** — they should call them inside render or effects, not cache the result.

### 1.3 No task persistence across app restarts (High)

Web persists tasks to localStorage with 30-minute expiry pruning. Mobile keeps tasks in memory only. If the app is killed, all in-flight task state is lost and the user has no idea their generation completed.

**Fix:** Persist to AsyncStorage (not SecureStore — task data can exceed 2KB):

- On every `upsert`/`remove`, debounce-write `state` to `AsyncStorage.setItem('utter_tasks', JSON.stringify(state))`
- On mount, read from AsyncStorage and dispatch a `hydrate` action
- Add expiry pruning: skip tasks where `completedAt` is older than 30 minutes

### 1.4 `dismissTask` is optimistic with no rollback (Medium)

Task is removed from local state before the DELETE API call. If the call fails, the task vanishes locally but persists server-side.

**Fix:** Dispatch `remove` only after the API call succeeds, or re-insert on failure.

### 1.5 `pollInflight` ref accumulates orphaned keys (Low)

When a task is dismissed, `pollInflight.current[taskId]` is never deleted.

**Fix:** Delete the key in `stopPolling`.

## Consumer fixes

After stabilizing the provider, update consumers:

### generate.tsx / design.tsx

Replace:
```tsx
const allTasks = getTasksByType('generate');
```

With a memoized version that only recalculates when the task list actually changes:
```tsx
const { tasks } = useTasks();
const allTasks = useMemo(
  () => tasks.filter((t) => t.type === 'generate'),
  [tasks],
);
```

Or if using the stable `getTasksByType` from the ref-based approach, call it inside `useMemo` keyed on `tasks`:
```tsx
const allTasks = useMemo(() => getTasksByType('generate'), [tasks]);
```

### _layout.tsx (tab badges)

The tab layout re-renders every second because `useTasks()` returns a new context value each poll. After stabilization, `activeCount` should only change when a task actually transitions status, not on every poll response.

## Acceptance criteria

- [ ] With 2 active tasks, TaskProvider causes 0 unnecessary effect re-runs per second
- [ ] `getTasksByType` and `getLatestTask` are stable refs (verified via React DevTools profiler)
- [ ] Tasks survive app kill and restore on next launch (with 30-min expiry)
- [ ] Tab badge only re-renders when activeCount actually changes
- [ ] `dismissTask` rolls back on API failure
