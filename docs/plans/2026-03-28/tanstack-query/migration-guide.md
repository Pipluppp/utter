# TanStack Query — Migration Guide

Before/after for each migration target, with exact current code and the Query concept replacing it.

## Wave 1: Account Snapshot

### Current code (`accountData.ts`)

Every `useAccountData()` call creates an independent fetch lifecycle. The layout and each child page each own separate copies of the same server state:

```ts
// accountData.ts — called independently by AccountLayout, Overview, Credits, Profile
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
    if (background) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
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
      if (background) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // ... signOut, activity derivation, return
}
```

The problem: `AccountLayout` + `Overview` + `Credits` + `Profile` each mount their own instance. That's 2 parallel fetches minimum (layout + active child), each with independent `loading`/`error`/`refreshing` state that doesn't sync.

### With TanStack Query

```ts
// accountData.ts
import { queryOptions, useQuery } from "@tanstack/react-query";

export const accountQueries = {
  all: () => ["account"] as const,
  snapshot: () =>
    queryOptions({
      queryKey: [...accountQueries.all(), "snapshot"],
      queryFn: loadAccountSnapshot,
      staleTime: 1000 * 30,
    }),
};

export function useAccountData() {
  const authState = useAuthState();
  const query = useQuery(accountQueries.snapshot());

  const activity = useMemo(
    () => (query.data?.credits?.events ?? []).map(buildAccountActivity),
    [query.data],
  );

  // signOut stays imperative — not a Query target
  const signOut = useCallback(async () => {
    await signOutRequest();
    await authState.refresh();
  }, [authState]);

  return {
    ...query.data,
    activity,
    loading: query.isLoading,
    refreshing: query.isFetching && !query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
    signOut,
  };
}
```

What changes:

- All 4+ consumers share one cache entry. One network request, one `loading` state.
- `refresh({ background: true })` becomes `queryClient.invalidateQueries({ queryKey: accountQueries.all() })`.
- `Credits.tsx` post-checkout refresh becomes invalidation in a `useEffect` watching the `checkout` search param.
- `loading` / `refreshing` / `error` are derived from query status, not manually managed.

### What stays the same

- `loadAccountSnapshot()` — the fetch function is unchanged.
- `buildAccountActivity()`, `formatCredits()`, `formatUsd()` — pure helpers stay.
- `signOut()` — remains imperative, outside Query.
- Route/search ownership in `credits.tsx` route file — untouched.

---

## Wave 1: Voice List (`Voices.tsx`)

### Current code

Manual `load()` with `AbortController`, `useState` for `data`/`loading`/`error`, manual reload after every mutation:

```ts
// Voices.tsx — the fetch lifecycle
const [data, setData] = useState<VoicesResponse | null>(null);
const [loading, setLoading] = useState(true);
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
    if (debounced.trim()) qs.set("search", debounced.trim());
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
}, [debounced, page, source, sort, sortDir, favorites]);

useEffect(() => {
  void load();
}, [load]);
useEffect(() => {
  return () => loadAbortRef.current?.abort();
}, []);
```

Mutations manually call `void load()` and manage busy state:

```ts
const [busyDelete, setBusyDelete] = useState<string | null>(null);
const [busyFavorite, setBusyFavorite] = useState<string | null>(null);
const [busyRename, setBusyRename] = useState<string | null>(null);

async function onDelete(voice: Voice) {
  if (!confirm(`Delete voice "${voice.name}"?`)) return;
  setBusyDelete(voice.id);
  try {
    await apiJson(`/api/voices/${voice.id}`, { method: "DELETE" });
    void load();
  } catch (e) {
    setError(e instanceof Error ? e.message : "Failed to delete voice.");
  } finally {
    setBusyDelete(null);
  }
}
```

### With TanStack Query

Query factory:

```ts
// frontend/src/features/voices/queries.ts
import { queryOptions } from "@tanstack/react-query";
import { apiJson } from "../../lib/api";
import type { VoicesResponse } from "../../lib/types";

type VoiceListFilters = {
  search: string;
  source: string;
  page: number;
  sort: string;
  sortDir: string;
  favorites: string;
};

function buildVoiceListQs(f: VoiceListFilters) {
  const qs = new URLSearchParams();
  qs.set("page", String(f.page));
  qs.set("per_page", "20");
  if (f.search) qs.set("search", f.search);
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

Component usage:

```ts
// Voices.tsx — the fetch becomes one line
const voicesQuery = useQuery(
  voiceQueries.list({
    search: debounced.trim(),
    source,
    page,
    sort,
    sortDir,
    favorites,
  }),
);
// voicesQuery.data, voicesQuery.isLoading, voicesQuery.error
```

Mutations use `useMutation` with the global `MutationCache` invalidation:

```ts
const deleteVoice = useMutation({
  mutationKey: voiceQueries.all(),
  mutationFn: (id: string) => apiJson(`/api/voices/${id}`, { method: "DELETE" }),
});

// In JSX — isPending replaces busyDelete
<Button
  isDisabled={deleteVoice.isPending}
  onPress={() => deleteVoice.mutate(voice.id)}
>
  Delete
</Button>
```

What's removed:

- `load()`, `loadAbortRef`, `useEffect(() => void load(), [load])`, cleanup effect
- `data` / `loading` / `error` `useState` for the list
- `busyDelete` / `busyFavorite` / `busyRename` `useState`
- `void load()` calls after every mutation

What stays:

- `query` / `debounced` / `source` / `sort` / `sortDir` / `favorites` / `page` local UI state
- Route search synchronization via `navigate({ search, replace: true })`
- `useEffect(() => setPage(1), [...])` for filter resets
- Playback state (`playState`, `waveRefs`)
- Inline rename editing state (`editingId`, `editName`)

---

## Wave 1: Voice Options (shared across Generate + History)

### Current code

`Generate.tsx` and `History.tsx` each independently fetch voice options on mount:

```ts
// Generate.tsx
const [voices, setVoices] = useState<VoicesResponse | null>(null);
const [loadingVoices, setLoadingVoices] = useState(true);

useEffect(() => {
  let active = true;
  void (async () => {
    try {
      const res = await apiJson<VoicesResponse>("/api/voices");
      if (!active) return;
      setVoices(res);
    } catch (e) {
      if (!active) return;
      setError(e instanceof Error ? e.message : "Failed to load voices.");
    } finally {
      if (active) setLoadingVoices(false);
    }
  })();
  return () => {
    active = false;
  };
}, []);
```

```ts
// History.tsx
useEffect(() => {
  let cancelled = false;
  apiJson<VoicesResponse>("/api/voices?per_page=100")
    .then((res) => {
      if (cancelled) return;
      const items: AutocompleteSelectItem[] = [
        { id: "all", label: "All Voices" },
        ...res.voices.map((v) => ({ id: v.id, label: v.name })),
      ];
      setVoiceItems(items);
    })
    .catch(() => {
      /* best-effort */
    });
  return () => {
    cancelled = true;
  };
}, []);
```

Two separate fetches, two separate `cancelled` / `active` guards, no shared cache.

### With TanStack Query

Both use the same `voiceQueries.options()` from the factory above:

```ts
// Generate.tsx
const voicesQuery = useQuery(voiceQueries.options());
const voiceItems = useMemo(
  () => (voicesQuery.data?.voices ?? []).map((v) => ({ ...v, label: v.name })),
  [voicesQuery.data],
);

// History.tsx
const voicesQuery = useQuery(voiceQueries.options());
const voiceItems = useMemo(
  () => [
    { id: "all", label: "All Voices" },
    ...(voicesQuery.data?.voices ?? []).map((v) => ({ id: v.id, label: v.name })),
  ],
  [voicesQuery.data],
);
```

If both pages are visited in the same session, the second visit gets cached data instantly. If a voice is created/deleted on the Voices page, the `mutationKey: voiceQueries.all()` invalidation refreshes this cache too.

---

## Wave 1: Generation History (`History.tsx`)

### Current code — polling

Manual `setInterval` that starts when active generations exist and stops otherwise:

```ts
const refreshTimerRef = useRef<number | null>(null);

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
```

### With TanStack Query

```ts
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

// In HistoryPage:
const historyQuery = useQuery({
  ...generationQueries.list(filters),
  refetchInterval: (query) => {
    const hasActive = query.state.data?.generations.some(
      (g) => g.status === "pending" || g.status === "processing",
    );
    return hasActive ? 5000 : false;
  },
});
```

What's removed:

- `refreshTimerRef`
- The polling `useEffect` with `setInterval` / `clearInterval`
- `load()`, `loadAbortRef`, the fetch `useEffect`, the cleanup effect
- `data` / `loading` / `error` `useState`
- `void load()` after delete

Delete mutation:

```ts
const deleteGeneration = useMutation({
  mutationKey: generationQueries.all(),
  mutationFn: (id: string) => apiJson(`/api/generations/${id}`, { method: "DELETE" }),
});
```

Regenerate stays imperative (it navigates after success, not a cache update):

```ts
async function onRegenerate(gen: Generation) {
  const res = await apiJson<RegenerateResponse>(`/api/generations/${gen.id}/regenerate`, {
    method: "POST",
  });
  navigate({ to: res.redirect_url });
}
```

---

## Wave 2: Tasks Page (`Tasks.tsx`)

### Current code — recursive polling with visibility awareness

```ts
useEffect(() => {
  let timeoutId: number | undefined;
  let cancelled = false;

  const POLL_MS = 5000;
  const ERROR_POLL_MS = 10000;

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
```

### With TanStack Query

```ts
export const taskQueries = {
  all: () => ["tasks"] as const,
  lists: () => [...taskQueries.all(), "list"] as const,
  list: (filters: { status: string; type: string; limit: number }) =>
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

// In TasksPage:
const tasksQuery = useQuery({
  ...taskQueries.list({ status: "active", type: typeFilter, limit: 10 }),
  refetchInterval: (query) => {
    return (query.state.data?.tasks.length ?? 0) > 0 ? 5000 : false;
  },
  refetchIntervalInBackground: false, // pauses when tab is hidden
});
```

The `loadMore` cursor pagination maps to `useInfiniteQuery` with `before` as the page param. This is a larger change and should be evaluated separately.

What's removed:

- Both `useEffect` blocks (initial fetch + polling)
- `setTimeout` / `clearTimeout` / visibility-change listener
- `loading` / `error` `useState`

What stays:

- `typeFilter` local UI state
- `TaskProvider` integration for cancel/dismiss
- `loadMore` (convert to `useInfiniteQuery` or keep imperative for now)

---

## What is NOT migrated

These are explicitly outside the Query rollout:

| Area                                | Why                                                                                                                    |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `AuthStateProvider`                 | Singleton auth context with router invalidation. Not duplicated, not painful.                                          |
| `TaskProvider`                      | Hybrid client/server state with localStorage persistence, cross-tab sync, reducer. Query doesn't replace this cleanly. |
| Route `validateSearch` files        | URL contract only, no fetching.                                                                                        |
| `router.ts` / `App.tsx`             | Provider wiring and auth guards.                                                                                       |
| Form state in Generate/Design/Clone | Local client state seeded once from server data. Query manages the seed fetch, not the form.                           |
| Playback state                      | Pure client state (waveform refs, play/pause).                                                                         |
