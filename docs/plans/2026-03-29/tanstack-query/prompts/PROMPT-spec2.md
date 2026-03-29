# TanStack Query Migration — Spec 2: Tasks Page (Wave 2)

## Context

Spec 1 has already landed. TanStack Query is installed, `QueryClientProvider` is wired in `App.tsx`, and the `QueryClient` singleton lives at `frontend/src/lib/queryClient.ts` with global `staleTime: 1000 * 20` and `MutationCache` global invalidation. Account, Voices, Voice Options, and Generation History are all running on TanStack Query. The Tasks page is the only remaining surface still using hand-rolled `useState`/`useEffect` fetch hooks.

## Scope

Migrate `frontend/src/features/tasks/hooks/useTaskList.ts` and its consumers to TanStack Query. This wave has design decisions that the other waves didn't:

- **Load-more pagination**: `useTaskList` uses cursor-based `loadMore` with a `before` param. This maps to `useInfiniteQuery` with `getNextPageParam`, but keeping load-more imperative is also viable. Evaluate during implementation — the migration guide documents both options.
- **Optimistic removal**: `removeTask` (dismiss) currently does `setTasks(prev => prev.filter(...))`. With Query this becomes `queryClient.setQueryData` to optimistically remove the item from the cache.
- **Polling with visibility awareness**: The current hook uses recursive `setTimeout` + a `visibilitychange` listener. Query's `refetchInterval` + `refetchIntervalInBackground: false` replaces both.
- **TaskProvider coordination**: `refreshAfterAction` (called after cancel) becomes `queryClient.invalidateQueries`. The TaskProvider itself is NOT being migrated.

## Required reading

1. `docs/plans/2026-03-29/tanstack-query/tanstack-query-audit.md` — see the "Wave 2: Tasks Page" and `useTaskList` per-hook audit sections
2. `docs/plans/2026-03-29/tanstack-query/migration-guide.md` — see "Wave 2: Tasks Page" section for before/after code, including both `useInfiniteQuery` and imperative load-more options
3. `docs/plans/2026-03-29/tanstack-query/tips.md` — relevant tips: #2 (key factories), #6 (refetchInterval), #12 (stale-while-revalidate replacing useDeferredLoading)

## TanStack Query reference docs (local)

Read from `.tanstack-query-docs/` as needed — do not guess API signatures.

Files you will need for this spec:

- `.tanstack-query-docs/react/reference/useQuery.md`
- `.tanstack-query-docs/react/reference/useInfiniteQuery.md` — if choosing infinite query for load-more
- `.tanstack-query-docs/react/reference/queryOptions.md`
- `.tanstack-query-docs/react/reference/infiniteQueryOptions.md` — if choosing infinite query
- `.tanstack-query-docs/react/reference/useQueryClient.md`
- `.tanstack-query-docs/core/QueryClient.md` — `setQueryData`, `invalidateQueries`
- `.tanstack-query-docs/react/guides/infinite-queries.md`
- `.tanstack-query-docs/react/guides/optimistic-updates.md` — for `setQueryData` dismiss pattern
- `.tanstack-query-docs/react/guides/queries.md`
- `.tanstack-query-docs/react/guides/query-keys.md`
- `.tanstack-query-docs/react/guides/important-defaults.md`

## Execution order

### Step 1: Create task query factory

Create `frontend/src/features/tasks/queries.ts` with `taskQueries` factory:

```ts
export const taskQueries = {
  all: () => ["tasks"] as const,
  lists: () => [...taskQueries.all(), "list"] as const,
  list: (filters: { status: string; type: TaskListType; limit: number }) =>
    queryOptions({
      queryKey: [...taskQueries.lists(), filters],
      queryFn: () => { /* build QS, call apiJson */ },
    }),
};
```

If choosing `useInfiniteQuery`, the `list` entry uses `infiniteQueryOptions` instead of `queryOptions` and includes `initialPageParam` + `getNextPageParam`.

### Step 2: Replace useTaskList in Tasks.tsx

Replace the `useTaskList` hook call with either:

**Option A — `useInfiniteQuery`** (preferred if load-more is important):
```ts
const tasksQuery = useInfiniteQuery({
  queryKey: [...taskQueries.lists(), { status: "active", type: typeFilter, limit: 10 }],
  queryFn: ({ pageParam }) => { /* fetch with ?before=pageParam */ },
  initialPageParam: null as string | null,
  getNextPageParam: (lastPage) => lastPage.next_before,
  refetchInterval: (query) => {
    const allTasks = query.state.data?.pages.flatMap(p => p.tasks) ?? [];
    return allTasks.length > 0 ? 5000 : false;
  },
  refetchIntervalInBackground: false,
});
const allTasks = tasksQuery.data?.pages.flatMap(p => p.tasks) ?? [];
```

**Option B — `useQuery` + imperative load-more** (simpler, keeps load-more as local state append):
```ts
const tasksQuery = useQuery({
  ...taskQueries.list({ status: "active", type: typeFilter, limit: 10 }),
  refetchInterval: (query) => {
    return (query.state.data?.tasks.length ?? 0) > 0 ? 5000 : false;
  },
  refetchIntervalInBackground: false,
});
```

Read the migration guide's Wave 2 section — it documents both approaches with full code.

### Step 3: Replace removeTask with optimistic cache update

The current `removeTask` does `setTasks(prev => prev.filter(t => t.id !== taskId))`. Replace with:

```ts
queryClient.setQueryData(
  /* matching query key */,
  (old) => old ? { ...old, tasks: old.tasks.filter(t => t.id !== taskId) } : old,
);
```

If using `useInfiniteQuery`, the `setQueryData` updater needs to map over `pages` and filter within each page.

### Step 4: Replace refreshAfterAction

The current `refreshAfterAction` refetches the first page after a cancel action. Replace with:

```ts
queryClient.invalidateQueries({ queryKey: taskQueries.all() });
```

### Step 5: Delete or gut useTaskList.ts

- If the hook is fully replaced, delete `frontend/src/features/tasks/hooks/useTaskList.ts`
- If any imperative load-more logic remains, gut the file to only that concern

### Step 6: Verify

- `npm --prefix frontend run typecheck` passes
- `npm --prefix frontend run check` passes (oxfmt + oxlint)
- Tasks page renders, shows active tasks
- Polling starts when tasks exist, stops when list is empty
- Polling pauses when tab is hidden, resumes on tab focus
- Dismiss removes task from UI immediately (optimistic)
- Cancel triggers refetch via invalidation
- Load-more works (loads next page of tasks)
- Filter by type works

## Files to modify

| File | Role |
|------|------|
| `frontend/src/features/tasks/Tasks.tsx` | Replace hook calls with `useQuery`/`useInfiniteQuery` |
| `frontend/src/features/tasks/hooks/useTaskList.ts` | DELETE or gut |

## New files to create

| File | Contents |
|------|----------|
| `frontend/src/features/tasks/queries.ts` | `taskQueries` factory |

## What NOT to touch

- `frontend/src/app/TaskProvider.tsx` — hybrid client/server state with localStorage, cross-tab sync, reducer. Not a Query target.
- `frontend/src/lib/queryClient.ts` — already set up by Spec 1, no changes needed
- `frontend/src/app/App.tsx` — provider already wired by Spec 1
- All other features migrated in Spec 1 (account, voices, history, shared)
- Backend (`workers/`, `supabase/`)
- Form state, playback state, modal state in page components

## Rules

- Read the plan files and the migration guide's Wave 2 section before writing any code
- When unsure about a TanStack Query API, read the local docs at `.tanstack-query-docs/`
- Use `queryOptions()` or `infiniteQueryOptions()` as the factory abstraction
- Let TypeScript inference flow from `apiJson<T>()` — do not manually annotate generics
- Prefer non-destructured query results when you need status narrowing
- Use `mutate()` not `mutateAsync()` unless you need the Promise
- Preserve existing behavior exactly — this is a refactor, not a feature change
