# TanStack Query — Implementation Tips

Updated 2026-03-30 (post component extraction). Sourced from [TkDodo's blog series](https://tkdodo.eu/blog/practical-react-query) and mapped to this codebase.

> The component extraction pass is complete. Each feature now has co-located hooks (`useVoiceList`, `useGenerationList`, `useVoiceMutations`, etc.) that isolate fetch/mutation logic. The tips below apply to replacing those hook internals with Query, or to creating query factories that the page components call directly.

## 1. Use `queryOptions()` as the primary abstraction

Do not wrap `useQuery` in custom hooks as the first abstraction. Use `queryOptions()` instead.

Custom hooks lock you into `useQuery` and make it hard to switch to `useSuspenseQuery`, use `useQueries`, or call `prefetchQuery` / `ensureQueryData` imperatively. `queryOptions()` works everywhere.

```ts
import { queryOptions } from "@tanstack/react-query";
import { apiJson } from "../../lib/api";

// queryOptions() returns the object as-is at runtime,
// but on type level it tags the queryKey with the return type.
// This means queryClient.getQueryData(voiceQueries.options().queryKey)
// infers VoicesResponse automatically.
function voiceOptionsQuery() {
  return queryOptions({
    queryKey: ["voices", "options"],
    queryFn: () => apiJson<VoicesResponse>("/api/voices?per_page=100"),
    staleTime: 1000 * 60,
  });
}

// Consumers just spread it. No wrapper hook needed.
const { data } = useQuery(voiceOptionsQuery());

// Override per call site when needed:
const { data } = useQuery({ ...voiceOptionsQuery(), staleTime: Infinity });
```

Source: [#24 The Query Options API](https://tkdodo.eu/blog/the-query-options-api), [#31 Creating Query Abstractions](https://tkdodo.eu/blog/creating-query-abstractions)

## 2. Structure query keys generic → specific

Use query key factories that go from broad to narrow. This enables fuzzy invalidation at any level.

```ts
const voiceQueries = {
  all: () => ["voices"] as const,
  lists: () => [...voiceQueries.all(), "list"] as const,
  list: (filters: VoiceListFilters) =>
    queryOptions({
      queryKey: [...voiceQueries.lists(), filters],
      queryFn: ({ signal }) =>
        apiJson<VoicesResponse>(`/api/voices?${buildQs(filters)}`, { signal }),
    }),
  options: () =>
    queryOptions({
      queryKey: [...voiceQueries.all(), "options"],
      queryFn: () => apiJson<VoicesResponse>("/api/voices?per_page=100"),
      staleTime: 1000 * 60,
    }),
};

// Invalidate everything voice-related (list + options):
queryClient.invalidateQueries({ queryKey: voiceQueries.all() });

// Invalidate only paginated lists, leave options cache alone:
queryClient.invalidateQueries({ queryKey: voiceQueries.lists() });
```

Key-only entries (like `all` and `lists`) exist purely for invalidation hierarchy. Entries that use `queryOptions()` (like `list` and `options`) are full query definitions.

Source: [#8 Effective React Query Keys](https://tkdodo.eu/blog/effective-react-query-keys), [#24 The Query Options API](https://tkdodo.eu/blog/the-query-options-api)

## 3. Set a global `staleTime`, don't disable refetch flags

The default `staleTime` of `0` means every mount triggers a background refetch. Instead of turning off `refetchOnWindowFocus` or `refetchOnMount`, set a global `staleTime`:

```ts
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 20, // 20 seconds
    },
  },
});
```

Then override per-query where needed:

- Voice options: `staleTime: 1000 * 60` (voices rarely change mid-session)
- Account snapshot: `staleTime: 1000 * 30`
- Form seed data: `staleTime: Infinity` (one-time seed, no background updates needed)

Leave `refetchOnWindowFocus` on (the default). It's a feature, not a bug — when a user tabs back to the app, they see fresh data.

Source: [#1 Practical React Query](https://tkdodo.eu/blog/practical-react-query), [#10 React Query as a State Manager](https://tkdodo.eu/blog/react-query-as-a-state-manager)

## 4. Global mutation invalidation via `MutationCache`

Instead of wiring `onSuccess: () => queryClient.invalidateQueries(...)` into every `useMutation`, set up a global callback on the `MutationCache`. Mutations declare a `mutationKey` to scope their invalidation:

```ts
import { QueryClient, MutationCache } from "@tanstack/react-query";

const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onSuccess: (_data, _variables, _context, mutation) => {
      queryClient.invalidateQueries({
        queryKey: mutation.options.mutationKey,
      });
    },
  }),
});

// Usage — just declare the key:
useMutation({
  mutationKey: ["voices"],
  mutationFn: (id: string) => apiJson(`/api/voices/${id}`, { method: "DELETE" }),
});
// After success, all queries starting with ["voices"] are invalidated.
```

Mutations without a `mutationKey` invalidate everything (because `invalidateQueries({})` matches all). This is fine given a reasonable `staleTime` — only active queries refetch, the rest just get marked stale.

Source: [#25 Automatic Query Invalidation after Mutations](https://tkdodo.eu/blog/automatic-query-invalidation-after-mutations)

## 5. Use `mutate`, not `mutateAsync`

`mutate` catches errors internally. `mutateAsync` gives you a raw Promise that you must catch yourself or risk unhandled rejections.

Separate concerns in callbacks:

- **Hook-level `onSuccess`**: invalidation, cache updates (logic that always applies)
- **Call-site `onSuccess`**: navigation, toasts, UI-specific reactions (may not fire if component unmounts)

```ts
// Hook definition — always invalidate
const useDeleteVoice = () =>
  useMutation({
    mutationKey: ["voices"],
    mutationFn: (id: string) => apiJson(`/api/voices/${id}`, { method: "DELETE" }),
  });

// Call site — UI-specific behavior
deleteVoice.mutate(voice.id, {
  onSuccess: () => toast("Voice deleted"),
});
```

`isPending` from `useMutation` replaces manual `busyDelete` / `busyFavorite` / `isSubmitting` state variables.

Source: [#12 Mastering Mutations in React Query](https://tkdodo.eu/blog/mastering-mutations-in-react-query)

## 6. Polling with `refetchInterval` callback

Replace manual `setInterval` + cleanup with a `refetchInterval` callback. Query handles pause-on-hidden-tab natively.

```ts
useQuery({
  ...generationQueries.list(filters),
  refetchInterval: (query) => {
    const hasActive = query.state.data?.generations.some(
      (g) => g.status === "pending" || g.status === "processing",
    );
    return hasActive ? 5000 : false;
  },
});
```

This replaces `refreshTimerRef`, `setInterval`, cleanup effects, and visibility-change listeners.

Source: [#1 Practical React Query](https://tkdodo.eu/blog/practical-react-query)

## 7. TypeScript: let inference work, don't annotate generics

Don't pass generics to `useQuery<T>()`. Type the `queryFn` return and let inference flow. Our `apiJson<T>()` already returns `Promise<T>`, so inference works automatically:

```ts
// ✅ inference works — data is VoicesResponse | undefined
queryFn: () => apiJson<VoicesResponse>("/api/voices")

// ❌ don't do this
useQuery<VoicesResponse, Error>({ ... })
```

Don't destructure the query result if you want TypeScript narrowing:

```ts
// ❌ data is still VoicesResponse | undefined after the check
const { data, isSuccess } = useQuery(voiceQueries.options());
if (isSuccess) {
  /* data is still T | undefined */
}

// ✅ narrowing works
const voicesQuery = useQuery(voiceQueries.options());
if (voicesQuery.isSuccess) {
  /* voicesQuery.data is VoicesResponse */
}
```

Source: [#6 React Query and TypeScript](https://tkdodo.eu/blog/react-query-and-type-script)

## 8. Forms: copy server state deliberately

It's fine to copy server state into local form state as initial data (like Generate.tsx seeding from route params + task formState). But set `staleTime: Infinity` on the seeding query so background refetches don't fire for data that won't be reflected in the form anyway.

```ts
const { data: voices } = useQuery({
  ...voiceQueries.options(),
  staleTime: Infinity, // form seed — no background updates needed
});
```

Source: [#14 React Query and Forms](https://tkdodo.eu/blog/react-query-and-forms)

## 9. Router integration: `ensureQueryData` for prefetching

TanStack Router loaders can prefetch into the Query cache so data is ready before the component mounts:

```ts
// In a route loader (optional, not first-wave)
queryClient.ensureQueryData(voiceQueries.options());
```

`ensureQueryData` returns cached data if available, otherwise fetches. This eliminates the loading spinner on first navigation. Not required for the first migration wave — mount-time fetches are fine to start.

Source: [#16 React Query meets React Router](https://tkdodo.eu/blog/react-query-meets-react-router)

## 10. Query deduplication replaces hand-rolled caching

When multiple components call `useQuery` with the same key, Query fires one network request and shares the result. This directly replaces:

- The removed `languagesCache` / `languagesInFlight` module-level dedup
- The duplicated `useAccountData()` instances across AccountLayout + child pages
- The separate `/api/voices` fetches in Generate.tsx and History.tsx

No manual dedup code needed. Just call the same `queryOptions()` in multiple components.

Source: [#10 React Query as a State Manager](https://tkdodo.eu/blog/react-query-as-a-state-manager)

## 11. Retry defaults and interaction with `apiJson`

TanStack Query retries failed queries 3 times with exponential backoff by default. Our `apiJson` already has its own 401 retry via `withRefreshRetry` (refresh the auth session, then retry once). These two retry layers stack: if `apiJson` gets a 401, it refreshes the session and retries internally. If that retry also fails (or a different error occurs), Query's retry kicks in and calls `apiJson` again (which will again attempt its own 401 refresh).

This is generally fine — the 401 refresh is idempotent and the outer retry handles transient network errors. But be aware of it. If you want to disable Query's retry for specific mutations or queries, pass `retry: false`. For mutations, Query already defaults to `retry: 0` (no retries), so this only matters for queries.

Source: [Important Defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults)

## 12. Replacing `useDeferredLoading` with stale-while-revalidate

The codebase uses `useDeferredLoading(loading, 150)` in `useVoiceList`, `useGenerationList`, and `useTaskList` to prevent flash-of-loading on fast responses. It returns `true` only after `loading` has been `true` for 150ms.

With TanStack Query, this concern is handled natively by stale-while-revalidate:

```ts
// Current pattern:
const { data, loading, showLoading } = useVoiceList(filters);
// showLoading = useDeferredLoading(loading) — delays skeleton appearance

// With Query:
const voicesQuery = useQuery(voiceQueries.list(filters));

// First load (no cached data): voicesQuery.isPending === true → show skeleton
// Filter change (has cached data): voicesQuery.data still available, voicesQuery.isFetching === true
//   → show stale data with a subtle loading indicator (opacity, spinner) instead of skeleton
```

The key insight: Query keeps the previous `data` available while refetching. So when filters change, the UI shows stale data immediately (no flash) and updates when the new data arrives. The `showLoading` pattern becomes:

```ts
// Show skeleton only on first load (no data yet)
if (voicesQuery.isPending) return <VoicesSkeleton />;

// Show stale data with loading indicator during refetch
const isRefetching = voicesQuery.isFetching && !voicesQuery.isPending;
<div className={isRefetching ? "pointer-events-none opacity-60" : ""}>
  {/* render voicesQuery.data */}
</div>
```

Additionally, `placeholderData: keepPreviousData` can be used to keep the previous filter's data visible while the new filter loads:

```ts
import { keepPreviousData } from "@tanstack/react-query";

const voicesQuery = useQuery({
  ...voiceQueries.list(filters),
  placeholderData: keepPreviousData,
});
// voicesQuery.isPlaceholderData === true while showing previous data
```

This is a strictly better UX than the current `useDeferredLoading` approach.

## 13. Per-item mutation busy state

The current `useVoiceMutations` tracks which specific voice ID is busy via `busyDelete`/`busyFavorite`/`busyRename` string state. With `useMutation`, `isPending` is a boolean for the whole hook instance.

To track per-item busy state, use `mutation.variables`:

```ts
const deleteVoice = useMutation({
  mutationKey: voiceQueries.all(),
  mutationFn: (id: string) => apiJson(`/api/voices/${id}`, { method: "DELETE" }),
});

// In JSX — check both isPending AND which item is in-flight:
<VoiceCard
  busyDelete={deleteVoice.isPending && deleteVoice.variables === voice.id}
  onDelete={() => deleteVoice.mutate(voice.id)}
/>
```

This works because `useMutation` stores the latest `variables` passed to `mutate()`. When `isPending` is true, `variables` tells you which item triggered it.

For multiple simultaneous mutations of the same type (unlikely in this UI but possible), use `useMutationState` to track all in-flight mutations.
