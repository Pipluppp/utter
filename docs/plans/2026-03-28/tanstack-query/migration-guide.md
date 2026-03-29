# TanStack Query — Migration Guide (post component extraction)

Updated 2026-03-30. Before/after for each migration target, showing the current extracted hook code and the Query replacement.

## Bootstrap

### Install

```bash
npm --prefix frontend install @tanstack/react-query
```

### QueryClient setup

Create `frontend/src/lib/queryClient.ts`:

```ts
import { MutationCache, QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 20, // 20 seconds global default
    },
  },
  mutationCache: new MutationCache({
    onSuccess: (_data, _variables, _context, mutation) => {
      queryClient.invalidateQueries({
        queryKey: mutation.options.mutationKey,
      });
    },
  }),
});
```

### Provider wiring in `App.tsx`

```ts
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../lib/queryClient";

export function App() {
  return (
    <ThemeProvider>
      <AuthStateProvider>
        <TaskProvider>
          <QueryClientProvider client={queryClient}>
            <InnerApp />
          </QueryClientProvider>
        </TaskProvider>
      </AuthStateProvider>
    </ThemeProvider>
  );
}
```

## Wave 1a: Account Snapshot

### Current code (`accountData.ts` — `useAccountData()`)

Every consumer creates an independent fetch lifecycle. AccountLayout + active child page = 2+ parallel fetches for the same data:

```ts
export function useAccountData(): AccountData {
  const authState = useAuthState();
  const [authEmail, setAuthEmail] = useState("");
  const [identities, setIdentities] = useState<Array<{ provider: string }>>([]);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [credits, setCredits] = useState<CreditsUsageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (options?: { background?: boolean }) => {
    const background = options?.background ?? false;
    if (background) setRefreshing(true);
    else setLoading(true);
    try {
      const snapshot = await loadAccountSnapshot();
      setMe(snapshot.me);
      setCredits(snapshot.credits);
      setAuthEmail(snapshot.authEmail);
      setIdentities(snapshot.identities);
      setError(null);
    } catch (caughtError) {
      setError(errorMessage(caughtError, "Failed to load account details."));
    } finally {
      if (background) setRefreshing(false);
      else setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  // ... signOut, activity derivation, return
}
```

### Query factory (`features/account/queries.ts`)

```ts
import { queryOptions } from "@tanstack/react-query";

// loadAccountSnapshot() stays unchanged — it's the queryFn
export const accountQueries = {
  all: () => ["account"] as const,
  snapshot: () =>
    queryOptions({
      queryKey: [...accountQueries.all(), "snapshot"],
      queryFn: loadAccountSnapshot,
      staleTime: 1000 * 30,
    }),
};
```

### After: `useAccountData()` with Query

```ts
import { useQuery } from "@tanstack/react-query";
import { accountQueries } from "./queries";

export function useAccountData(): AccountData {
  const authState = useAuthState();
  const query = useQuery(accountQueries.snapshot());

  const activity = useMemo(
    () => (query.data?.credits?.events ?? []).map(buildAccountActivity),
    [query.data],
  );

  const signOut = useCallback(async () => {
    await signOutRequest();
    await authState.refresh();
  }, [authState]);

  return {
    activity,
    authEmail: query.data?.authEmail ?? "",
    credits: query.data?.credits ?? null,
    error: query.error instanceof Error ? query.error.message : null,
    identities: query.data?.identities ?? [],
    loading: query.isPending,
    me: query.data?.me ?? null,
    profile: query.data?.me?.profile ?? null,
    refresh: async () => { /* no-op for compat, or remove */ },
    refreshing: query.isFetching && !query.isPending,
    signOut,
  };
}
```

### Consumer changes

**AccountLayout.tsx**: Retry button changes from `account.refresh({ background: true })` to:
```ts
import { useQueryClient } from "@tanstack/react-query";
import { accountQueries } from "./queries";

const queryClient = useQueryClient();
// Retry:
queryClient.invalidateQueries({ queryKey: accountQueries.all() });
```

**Credits.tsx**: Post-checkout refresh changes from `refresh({ background: true })` to:
```ts
useEffect(() => {
  if (checkoutStatus === "success") {
    queryClient.invalidateQueries({ queryKey: accountQueries.all() });
  }
}, [checkoutStatus, queryClient]);
```

**Overview.tsx, Profile.tsx**: Just consume `useAccountData()` — no changes needed if the return shape stays compatible.

### What's removed

- 7 `useState` calls in `useAccountData()`
- 1 `useEffect` for mount-time fetch
- `refresh()` callback (replaced by query invalidation)
- Duplicated fetch across 4+ consumers

### What stays

- `loadAccountSnapshot()` — unchanged
- Pure helpers: `formatCredits`, `formatUsd`, `formatDate`, `formatDateTime`, `buildAccountActivity`
- `signOut()` — imperative, outside Query

## Wave 1b: Voice List + Mutations

### Current code (`voices/hooks/useVoiceList.ts`)

```ts
export function useVoiceList(filters: VoiceListFilters): UseVoiceListResult {
  const { search, source, sort, sortDir, favorites, page } = filters;
  const [data, setData] = useState<VoicesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const showLoading = useDeferredLoading(loading);
  const [error, setError] = useState<string | null>(null);
  const loadAbortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    loadAbortRef.current?.abort();
    const controller = new AbortController();
    loadAbortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      qs.set("page", String(page));
      qs.set("per_page", String(PER_PAGE));
      if (search.trim()) qs.set("search", search.trim());
      if (source !== "all") qs.set("source", source);
      if (sort !== "created_at") qs.set("sort", sort);
      if (sortDir !== "desc") qs.set("sort_dir", sortDir);
      if (favorites === "true") qs.set("favorites", "true");
      const res = await apiJson<VoicesResponse>(`/api/voices?${qs.toString()}`, {
        signal: controller.signal,
      });
      setData(res);
    } catch (e) {
      if (controller.signal.aborted) return;
      setError(e instanceof Error ? e.message : "Failed to load voices.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
      if (loadAbortRef.current === controller) loadAbortRef.current = null;
    }
  }, [search, page, source, sort, sortDir, favorites]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { return () => loadAbortRef.current?.abort(); }, []);

  const reload = useCallback(() => { void load(); }, [load]);
  return { data, loading, showLoading, error, reload, setError };
}
```

### Query factory (`voices/queries.ts`)

```ts
import { queryOptions } from "@tanstack/react-query";
import { apiJson } from "../../lib/api";
import type { VoicesResponse } from "../../lib/types";

const PER_PAGE = 10;

export type VoiceListFilters = {
  search: string;
  source: "all" | "uploaded" | "designed";
  sort: string;
  sortDir: "asc" | "desc";
  favorites: "all" | "true";
  page: number;
};

function buildVoiceListQs(f: VoiceListFilters) {
  const qs = new URLSearchParams();
  qs.set("page", String(f.page));
  qs.set("per_page", String(PER_PAGE));
  if (f.search.trim()) qs.set("search", f.search.trim());
  if (f.source !== "all") qs.set("source", f.source);
  if (f.sort !== "created_at") qs.set("sort", f.sort);
  if (f.sortDir !== "desc") qs.set("sort_dir", f.sortDir);
  if (f.favorites === "true") qs.set("favorites", "true");
  return qs.toString();
}

export const voiceQueries = {
  all: () => ["voices"] as const,
  lists: () => [...voiceQueries.all(), "list"] as const,
  list: (filters: VoiceListFilters) =>
    queryOptions({
      queryKey: [...voiceQueries.lists(), filters],
      queryFn: ({ signal }) =>
        apiJson<VoicesResponse>(`/api/voices?${buildVoiceListQs(filters)}`, { signal }),
    }),
  options: () =>
    queryOptions({
      queryKey: [...voiceQueries.all(), "options"],
      queryFn: () => apiJson<VoicesResponse>("/api/voices?per_page=100"),
      staleTime: 1000 * 60,
    }),
};
```

### After: `Voices.tsx` usage (hook eliminated or thinned)

```ts
// In Voices.tsx — the hook is replaced by a direct useQuery call
const voicesQuery = useQuery(
  voiceQueries.list({
    search: debounced.trim(),
    source,
    sort,
    sortDir,
    favorites,
    page,
  }),
);
// voicesQuery.data, voicesQuery.isPending, voicesQuery.error
// voicesQuery.isFetching && voicesQuery.data → stale-while-revalidate (replaces showLoading)
```

### Current code (`voices/hooks/useVoiceMutations.ts`)

```ts
export function useVoiceMutations(
  onReload: () => void,
  onError: (msg: string) => void,
): UseVoiceMutationsResult {
  const [busyDelete, setBusyDelete] = useState<string | null>(null);
  const [busyFavorite, setBusyFavorite] = useState<string | null>(null);
  const [busyRename, setBusyRename] = useState<string | null>(null);

  const deleteVoice = useCallback(async (voice: Voice) => {
    setBusyDelete(voice.id);
    try {
      await apiJson(`/api/voices/${voice.id}`, { method: "DELETE" });
      onReload();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Failed to delete voice.");
    } finally {
      setBusyDelete(null);
    }
  }, [onReload, onError]);

  // ... toggleFavorite, renameVoice similar pattern
}
```

### After: mutations with `useMutation`

```ts
import { useMutation } from "@tanstack/react-query";
import { voiceQueries } from "../queries";

// In Voices.tsx or a thin hook:
const deleteVoice = useMutation({
  mutationKey: voiceQueries.all(),
  mutationFn: (id: string) => apiJson(`/api/voices/${id}`, { method: "DELETE" }),
});

const toggleFavorite = useMutation({
  mutationKey: voiceQueries.all(),
  mutationFn: (id: string) => apiJson(`/api/voices/${id}/favorite`, { method: "PATCH" }),
});

const renameVoice = useMutation({
  mutationKey: voiceQueries.all(),
  mutationFn: ({ id, name }: { id: string; name: string }) =>
    apiJson(`/api/voices/${id}/name`, { method: "PATCH", json: { name } }),
});

// Per-item busy tracking via variables:
// deleteVoice.isPending && deleteVoice.variables === voice.id
```

### What's removed

- `useVoiceList.ts` — entire file (or gutted to a thin wrapper)
- `useVoiceMutations.ts` — entire file (or gutted)
- `busyDelete`/`busyFavorite`/`busyRename` useState
- `loadAbortRef`, `load()`, both `useEffect` blocks
- `onReload()`/`onError()` callback wiring in `Voices.tsx`

### What stays in `Voices.tsx`

- `query`/`debounced`/`source`/`sort`/`sortDir`/`favorites`/`page` local UI state
- Route search synchronization via `navigate({ search, replace: true })`
- `useEffect(() => setPage(1), [...])` for filter resets
- Playback state (`playState`, `waveRefs`)
- Highlight/scroll-to-voice logic
- `deleteTarget` confirm dialog state

## Wave 1c: Voice Options (shared across Generate + History)

### Current code (`shared/hooks/useVoiceOptions.ts`)

```ts
export function useVoiceOptions(): UseVoiceOptionsResult {
  const [data, setData] = useState<VoicesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await apiJson<VoicesResponse>("/api/voices");
        if (!active) return;
        setData(res);
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Failed to load voices.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const voices = useMemo(
    () => (data?.voices ?? []).map((v) => ({ ...v, label: v.name })),
    [data],
  );
  return { voices, loading, error };
}
```

### After: uses `voiceQueries.options()` from the voice factory

```ts
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import type { Voice } from "../../../lib/types";
import { voiceQueries } from "../../voices/queries";

export type VoiceOptionItem = Voice & { label: string };

export type UseVoiceOptionsResult = {
  voices: VoiceOptionItem[];
  loading: boolean;
  error: string | null;
};

export function useVoiceOptions(): UseVoiceOptionsResult {
  const query = useQuery(voiceQueries.options());

  const voices = useMemo(
    () => (query.data?.voices ?? []).map((v) => ({ ...v, label: v.name })),
    [query.data],
  );

  return {
    voices,
    loading: query.isPending,
    error: query.error instanceof Error ? query.error.message : null,
  };
}
```

Both `Generate.tsx` and `History.tsx` import `useVoiceOptions()` — no consumer changes needed. The shared `["voices", "options"]` cache means one network request serves both pages. When a voice is created/deleted on the Voices page, the `mutationKey: voiceQueries.all()` invalidation refreshes this cache too.

---

## Wave 1d: Generation History

### Current code (`history/hooks/useGenerationList.ts`)

```ts
export function useGenerationList(filters: GenerationListFilters): UseGenerationListResult {
  const { search, status, voiceId, sort, sortDir, page } = filters;
  const [data, setData] = useState<GenerationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const showLoading = useDeferredLoading(loading);
  const [error, setError] = useState<string | null>(null);
  const loadAbortRef = useRef<AbortController | null>(null);
  const refreshTimerRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    loadAbortRef.current?.abort();
    const controller = new AbortController();
    loadAbortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      qs.set("page", String(page));
      qs.set("per_page", String(PER_PAGE));
      if (search.trim()) qs.set("search", search.trim());
      if (status !== "all") qs.set("status", status);
      if (voiceId !== "all") qs.set("voice_id", voiceId);
      if (sort !== "created_at") qs.set("sort", sort);
      if (sortDir !== "desc") qs.set("sort_dir", sortDir);
      const res = await apiJson<GenerationsResponse>(`/api/generations?${qs.toString()}`, {
        signal: controller.signal,
      });
      setData(res);
    } catch (e) {
      if (controller.signal.aborted) return;
      setError(e instanceof Error ? e.message : "Failed to load history.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
      if (loadAbortRef.current === controller) loadAbortRef.current = null;
    }
  }, [search, page, status, voiceId, sort, sortDir]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { return () => loadAbortRef.current?.abort(); }, []);

  // Conditional polling: auto-refresh when active generations exist
  useEffect(() => {
    if (refreshTimerRef.current) {
      window.clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    const hasActive = data?.generations.some(
      (g) => g.status === "pending" || g.status === "processing",
    );
    if (!hasActive) return;
    refreshTimerRef.current = window.setInterval(() => void load(), 5000);
    return () => {
      if (refreshTimerRef.current) window.clearInterval(refreshTimerRef.current);
    };
  }, [data, load]);

  const reload = useCallback(() => { void load(); }, [load]);
  return { data, loading, showLoading, error, reload, setError };
}
```

### Query factory (`history/queries.ts`)

```ts
import { queryOptions } from "@tanstack/react-query";
import { apiJson } from "../../lib/api";
import type { GenerationsResponse } from "../../lib/types";

const PER_PAGE = 10;

export type GenerationListFilters = {
  search: string;
  status: string;
  voiceId: string;
  sort: string;
  sortDir: "asc" | "desc";
  page: number;
};

function buildGenQs(f: GenerationListFilters) {
  const qs = new URLSearchParams();
  qs.set("page", String(f.page));
  qs.set("per_page", String(PER_PAGE));
  if (f.search.trim()) qs.set("search", f.search.trim());
  if (f.status !== "all") qs.set("status", f.status);
  if (f.voiceId !== "all") qs.set("voice_id", f.voiceId);
  if (f.sort !== "created_at") qs.set("sort", f.sort);
  if (f.sortDir !== "desc") qs.set("sort_dir", f.sortDir);
  return qs.toString();
}

export const generationQueries = {
  all: () => ["generations"] as const,
  lists: () => [...generationQueries.all(), "list"] as const,
  list: (filters: GenerationListFilters) =>
    queryOptions({
      queryKey: [...generationQueries.lists(), filters],
      queryFn: ({ signal }) =>
        apiJson<GenerationsResponse>(`/api/generations?${buildGenQs(filters)}`, { signal }),
    }),
};
```

### After: `History.tsx` usage

```ts
const historyQuery = useQuery({
  ...generationQueries.list({
    search: debounced.trim(),
    status,
    voiceId,
    sort,
    sortDir,
    page,
  }),
  refetchInterval: (query) => {
    const hasActive = query.state.data?.generations.some(
      (g) => g.status === "pending" || g.status === "processing",
    );
    return hasActive ? 5000 : false;
  },
});
```

### After: delete mutation

```ts
const deleteGeneration = useMutation({
  mutationKey: generationQueries.all(),
  mutationFn: (id: string) => apiJson(`/api/generations/${id}`, { method: "DELETE" }),
});
```

### What stays imperative in `useGenerationActions`

- `regenerate` — navigates after success, not a cache update
- `download` — resolves protected media URL, not a cache operation

### What's removed

- `useGenerationList.ts` — entire file (or gutted)
- `refreshTimerRef`, `loadAbortRef`, all three `useEffect` blocks
- `data`/`loading`/`error` useState
- `useDeferredLoading`
- `reload()` callback
- `onReload()`/`onError()` wiring in `History.tsx`

## Wave 2: Tasks Page

### Current code (`tasks/hooks/useTaskList.ts`)

The most complex hook — initial fetch, recursive `setTimeout` polling with visibility-change listener, cursor-based load-more, `refreshAfterAction`, and `removeTask`:

```ts
export function useTaskList(typeFilter: TaskListType): UseTaskListResult {
  const [tasks, setTasks] = useState<BackendTaskListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextBefore, setNextBefore] = useState<string | null>(null);

  // Initial fetch effect
  useEffect(() => { /* ... */ }, [filterQuery]);

  // Recursive setTimeout polling with visibilitychange
  useEffect(() => {
    let timeoutId: number | undefined;
    let cancelled = false;
    async function poll() { /* ... setTimeout(poll, POLL_MS) ... */ }
    timeoutId = window.setTimeout(poll, POLL_MS);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => { /* cleanup */ };
  }, [filterQuery]);

  // loadMore with cursor pagination
  const loadMore = useCallback(async () => { /* ... before: nextBefore ... */ }, [nextBefore, typeFilter]);

  // refreshAfterAction — refetches first page after cancel
  const refreshAfterAction = useCallback(async () => { /* ... */ }, []);

  // removeTask — optimistic local removal after dismiss
  const removeTask = useCallback((taskId: string) => {
    setTasks((current) => current.filter((t) => t.id !== taskId));
  }, []);
}
```

### Query factory (`tasks/queries.ts`)

```ts
import { queryOptions } from "@tanstack/react-query";
import { apiJson } from "../../lib/api";
import type { TaskListResponse, TaskListType } from "../../lib/types";

export const taskQueries = {
  all: () => ["tasks"] as const,
  lists: () => [...taskQueries.all(), "list"] as const,
  list: (filters: { status: string; type: TaskListType; limit: number }) =>
    queryOptions({
      queryKey: [...taskQueries.lists(), filters],
      queryFn: () => {
        const qs = new URLSearchParams({
          status: filters.status,
          type: filters.type,
          limit: String(filters.limit),
        });
        return apiJson<TaskListResponse>(`/api/tasks?${qs.toString()}`);
      },
    }),
};
```

### After: `Tasks.tsx` usage

```ts
const tasksQuery = useQuery({
  ...taskQueries.list({ status: "active", type: typeFilter, limit: 10 }),
  refetchInterval: (query) => {
    return (query.state.data?.tasks.length ?? 0) > 0 ? 5000 : false;
  },
  refetchIntervalInBackground: false, // pauses when tab is hidden — replaces visibility listener
});
```

### Load-more: design decision

The cursor-based `loadMore` with `before` param maps to `useInfiniteQuery`:

```ts
const tasksQuery = useInfiniteQuery({
  queryKey: [...taskQueries.lists(), { status: "active", type: typeFilter, limit: 10 }],
  queryFn: ({ pageParam }) => {
    const qs = new URLSearchParams({
      status: "active",
      type: typeFilter,
      limit: "10",
    });
    if (pageParam) qs.set("before", pageParam);
    return apiJson<TaskListResponse>(`/api/tasks?${qs.toString()}`);
  },
  initialPageParam: null as string | null,
  getNextPageParam: (lastPage) => lastPage.next_before,
  refetchInterval: /* ... */,
});

// All tasks across pages:
const allTasks = tasksQuery.data?.pages.flatMap((p) => p.tasks) ?? [];
```

Alternatively, keep `loadMore` imperative for now and only migrate the first-page fetch + polling to Query. Evaluate during implementation.

### `removeTask` (optimistic removal after dismiss)

With Query, optimistic removal uses `queryClient.setQueryData`:

```ts
function onDismiss(taskId: string) {
  // Optimistically remove from cache
  queryClient.setQueryData(
    taskQueries.list({ status: "active", type: typeFilter, limit: 10 }).queryKey,
    (old: TaskListResponse | undefined) =>
      old ? { ...old, tasks: old.tasks.filter((t) => t.id !== taskId) } : old,
  );
  // Then fire the actual dismiss
  void dismissTask(taskId);
}
```

### What's removed

- Both `useEffect` blocks (initial fetch + polling)
- `setTimeout`/`clearTimeout`/visibility-change listener
- `loading`/`error` useState
- `refreshAfterAction` → `queryClient.invalidateQueries({ queryKey: taskQueries.all() })`

### What stays

- `typeFilter` local UI state
- `TaskProvider` integration for cancel/dismiss
- `loadMore` (convert to `useInfiniteQuery` or keep imperative)

---

## What is NOT migrated

These are explicitly outside the Query rollout:

| Area | Why |
|------|-----|
| `AuthStateProvider` | Singleton auth context with router invalidation. Not duplicated, not painful. |
| `TaskProvider` | Hybrid client/server state with localStorage persistence, cross-tab sync, reducer. |
| Route `validateSearch` files | URL contract only, no fetching. |
| `router.ts` / `App.tsx` | Provider wiring and auth guards. |
| `useGenerateSubmit` / `useDesignSubmit` | TaskProvider integration. Mutations create tracked tasks, not cache entries. |
| `useCloneSubmit` | Multi-step imperative flow with mock mode. |
| `useTranscribe` | One-shot mutation setting local form state. Low priority. |
| Form state in Generate/Design/Clone | Local client state seeded once from server data. |
| Playback state | Pure client state (waveform refs, play/pause). |

---

## Gap Coverage: Implementation Details

### Endpoint alignment for voice options

The current `useVoiceOptions` fetches `/api/voices` (no `per_page` param — uses server default). The `voiceQueries.options()` factory should match this behavior unless we intentionally want to fetch more:

```ts
// Match current behavior:
options: () =>
  queryOptions({
    queryKey: [...voiceQueries.all(), "options"],
    queryFn: () => apiJson<VoicesResponse>("/api/voices"),
    staleTime: 1000 * 60,
  }),
```

If the server default is sufficient for the voice selector dropdowns in Generate and History, keep it as-is. If we need all voices (e.g., the server paginates by default), explicitly pass `per_page=100`. Check the API behavior and decide during implementation.

### Account factory file organization

`loadAccountSnapshot()` is currently defined in `accountData.ts`. The query factory needs access to it. Two options:

**Option A** (recommended): Keep `loadAccountSnapshot` in `accountData.ts`, create `queries.ts` that imports it:

```ts
// features/account/queries.ts
import { queryOptions } from "@tanstack/react-query";
import { loadAccountSnapshot } from "./accountData";

export const accountQueries = {
  all: () => ["account"] as const,
  snapshot: () =>
    queryOptions({
      queryKey: [...accountQueries.all(), "snapshot"],
      queryFn: loadAccountSnapshot,
      staleTime: 1000 * 30,
    }),
};
```

This requires exporting `loadAccountSnapshot` from `accountData.ts` (it's currently module-private). Add `export` to the function.

**Option B**: Move `loadAccountSnapshot` into `queries.ts` and import the API helpers there. This keeps the factory self-contained but splits the account module.

### Cache clearing on sign-out

The current `signOut()` manually clears `authEmail`, `me`, `credits`, `identities`. After migration, stale account data would remain in the Query cache. Add cache removal after sign-out:

```ts
const signOut = useCallback(async () => {
  await signOutRequest();
  queryClient.removeQueries({ queryKey: accountQueries.all() });
  await authState.refresh();
}, [authState, queryClient]);
```

`removeQueries` (not `invalidateQueries`) is correct here — we want to delete the data, not refetch it, because the user is no longer authenticated.

### Mutation error surfacing in page components

The current pattern routes mutation errors to the list's `setError`:

```ts
// Current Voices.tsx:
const handleError = useCallback((msg: string) => voiceList.setError(msg), [voiceList.setError]);
const mutations = useVoiceMutations(voiceList.reload, handleError);
```

After migration, `voiceList.setError` no longer exists. Mutation errors live on each mutation object. The page component should derive a combined error:

```ts
// After migration — in Voices.tsx:
const voicesQuery = useQuery(voiceQueries.list(filters));
const deleteVoice = useMutation({ /* ... */ });
const toggleFavorite = useMutation({ /* ... */ });
const renameVoice = useMutation({ /* ... */ });

// Combined error for the page banner:
const displayError =
  voicesQuery.error?.message ??
  deleteVoice.error?.message ??
  toggleFavorite.error?.message ??
  renameVoice.error?.message ??
  null;

// In JSX:
{displayError ? <Message variant="error">{displayError}</Message> : null}
```

The same pattern applies to `History.tsx` for `deleteGeneration.error`.

Alternatively, keep a local `error` useState in the page for non-query errors (like playback errors) and merge:

```ts
const [localError, setLocalError] = useState<string | null>(null);
const displayError =
  localError ??
  voicesQuery.error?.message ??
  deleteVoice.error?.message ??
  null;
```

### ConfirmDialog integration with mutations

The confirm dialog pattern stays the same — `deleteTarget` state is local UI state, not a Query concern:

```ts
// Voices.tsx — unchanged pattern:
const [deleteTarget, setDeleteTarget] = useState<Voice | null>(null);

// In VoiceCard: onDelete={() => setDeleteTarget(v)}

// In ConfirmDialog onConfirm:
onConfirm={() => {
  if (deleteTarget) {
    deleteVoice.mutate(deleteTarget.id);
    setDeleteTarget(null); // close dialog immediately
  }
}}
```

The dialog closes on confirm. If the mutation fails, the error shows in the page banner via `deleteVoice.error`. No `busyDelete` needed — the dialog is already closed.

### `keepPreviousData` for paginated lists

Use `placeholderData: keepPreviousData` for both voice list and generation list. This keeps the previous page/filter data visible while the new data loads, preventing layout shift:

```ts
import { keepPreviousData } from "@tanstack/react-query";

const voicesQuery = useQuery({
  ...voiceQueries.list(filters),
  placeholderData: keepPreviousData,
});

// voicesQuery.isPlaceholderData === true while showing stale data from previous filters
// Use this to show a subtle loading indicator instead of replacing content with skeleton
const isStale = voicesQuery.isPlaceholderData || (voicesQuery.isFetching && !voicesQuery.isPending);
```

This replaces the current `showLoading` / `useDeferredLoading` pattern with a strictly better UX.

### Design.tsx and voice options

`Design.tsx` does NOT use `useVoiceOptions`. The design flow uses a text-based voice description (`instruct` field), not a voice selector. Only `Generate.tsx` and `History.tsx` consume `useVoiceOptions`.

### File cleanup after migration

Files to delete or gut after each wave:

**Wave 1a (Account)**:
- `accountData.ts`: gut `useAccountData()` internals (replace with `useQuery`), keep pure helpers and types

**Wave 1b (Voices)**:
- `voices/hooks/useVoiceList.ts`: delete entirely (replaced by `useQuery` in page)
- `voices/hooks/useVoiceMutations.ts`: delete entirely (replaced by `useMutation` in page)

**Wave 1c (Voice Options)**:
- `shared/hooks/useVoiceOptions.ts`: gut internals (replace with `useQuery`), keep types and `label` derivation

**Wave 1d (History)**:
- `history/hooks/useGenerationList.ts`: delete entirely (replaced by `useQuery` in page)
- `history/hooks/useGenerationActions.ts`: keep `regenerate` and `download`, remove `deleteGeneration` (replaced by `useMutation` in page), remove `onReload`/`onError` params

**After all Wave 1**:
- `shared/hooks.ts`: evaluate if `useDeferredLoading` still has consumers. If not, remove it. `useDebouncedValue` stays.

**Wave 2 (Tasks)**:
- `tasks/hooks/useTaskList.ts`: delete or gut (replaced by `useQuery`/`useInfiniteQuery`)

### New files created

- `frontend/src/lib/queryClient.ts` — QueryClient singleton
- `frontend/src/features/account/queries.ts` — `accountQueries` factory
- `frontend/src/features/voices/queries.ts` — `voiceQueries` factory
- `frontend/src/features/history/queries.ts` — `generationQueries` factory
- `frontend/src/features/tasks/queries.ts` — `taskQueries` factory (Wave 2)

## Verification Checklist (per wave)

- [ ] `npm --prefix frontend install` succeeds with `@tanstack/react-query` added
- [ ] `npm --prefix frontend run check` passes (oxfmt + oxlint)
- [ ] `npm --prefix frontend run typecheck` passes
- [ ] Page renders identically (manual visual check)
- [ ] All filter/sort/search/pagination still works
- [ ] All mutations (delete, rename, favorite, etc.) still work and auto-refresh the list
- [ ] Skeleton loading on first visit still works
- [ ] Stale-while-revalidate on filter change works (no flash of skeleton)
- [ ] Polling (History, Tasks) starts and stops correctly based on active items
- [ ] Tab-away and tab-back triggers background refetch (refetchOnWindowFocus)
- [ ] Cross-feature cache sharing works (e.g., create voice on Clone → voice options refresh on Generate)
- [ ] Sign-out clears account cache
- [ ] Post-checkout refresh works on Credits page
- [ ] No new TypeScript errors introduced
- [ ] React DevTools shows single query observer per cache key (no duplicated fetches)
