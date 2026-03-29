# TanStack Query Audit

Date: 2026-03-27 (updated 2026-03-30 — post component extraction)

## Recommendation

TanStack Query is recommended for this frontend. The component extraction pass is complete. Every page now has co-located hooks that isolate fetch/mutation logic. The Query migration is a clean swap of hook internals — no structural rewrite needed.

Recommended first-wave Query targets:

- `frontend/src/features/account/accountData.ts` plus its account consumers
- `frontend/src/features/voices/hooks/useVoiceList.ts` + `useVoiceMutations.ts`
- `frontend/src/features/history/hooks/useGenerationList.ts` + `useGenerationActions.ts`
- `frontend/src/features/shared/hooks/useVoiceOptions.ts`

Recommended later Query target:

- `frontend/src/features/tasks/hooks/useTaskList.ts`

Explicit non-targets:

- `frontend/src/router.ts`
- `frontend/src/app/App.tsx`
- `frontend/src/routes/_app/route.tsx`
- Route `validateSearch` files under `frontend/src/routes`
- `frontend/src/app/auth/AuthStateProvider.tsx`
- `frontend/src/app/TaskProvider.tsx`
- Local form, playback, modal, and object-URL state in page components
- `frontend/src/features/clone/hooks/useCloneSubmit.ts` (multi-step imperative flow with mock mode)
- `frontend/src/features/generate/hooks/useGenerateSubmit.ts` (TaskProvider integration)
- `frontend/src/features/design/hooks/useDesignSubmit.ts` (TaskProvider integration + blob lifecycle)

## Current Codebase Structure (post component extraction)

The component extraction pass (2026-03-29) refactored every page into co-located hooks and sub-components. The current layout:

```
features/
  account/
    accountData.ts           ← useAccountData() hook + helpers (QUERY TARGET)
    AccountLayout.tsx         ← consumes useAccountData()
    Overview.tsx              ← consumes useAccountData()
    Credits.tsx               ← consumes useAccountData() + checkout mutation
    Profile.tsx               ← consumes useAccountData() + signOut
    components/
      CreditActivityList.tsx
      CreditPackCard.tsx
  voices/
    Voices.tsx                ← orchestration page
    hooks/
      useVoiceList.ts         ← paginated fetch + AbortController (QUERY TARGET)
      useVoiceMutations.ts    ← delete/favorite/rename with busyX state (QUERY TARGET)
    components/
      VoiceCard.tsx
      VoiceCardSkeleton.tsx
      VoiceFilterBar.tsx
      VoicesSkeleton.tsx
  history/
    History.tsx               ← orchestration page
    hooks/
      useGenerationList.ts    ← paginated fetch + conditional polling (QUERY TARGET)
      useGenerationActions.ts ← delete/regenerate/download (QUERY TARGET for delete)
    components/
      HistoryCard.tsx
      HistoryCardSkeleton.tsx
      HistoryFilterBar.tsx
      HistorySkeleton.tsx
  generate/
    Generate.tsx              ← orchestration page
    hooks/
      useGenerateSubmit.ts    ← TaskProvider integration (NOT a query target)
    components/
      GenerateForm.tsx
      GenerateResult.tsx
  design/
    Design.tsx                ← orchestration page
    hooks/
      useDesignSubmit.ts      ← TaskProvider integration + blob lifecycle (NOT a query target)
    components/
      DesignForm.tsx
      DesignResult.tsx
  clone/
    Clone.tsx                 ← orchestration page
    hooks/
      useAudioRecorder.ts     ← recording state machine (NOT a query target)
      useCloneFile.ts         ← file validation (NOT a query target)
      useCloneSubmit.ts       ← multi-step clone mutation (NOT a query target)
      useTranscribe.ts        ← transcription mutation (NOT a query target)
      useDemoLoader.ts        ← one-shot demo seeding (NOT a query target)
    components/
      CloneForm.tsx, CloneSuccessModal.tsx, etc.
  tasks/
    Tasks.tsx                 ← orchestration page
    hooks/
      useTaskList.ts          ← fetch + recursive polling + load-more (LATER QUERY TARGET)
    components/
      TaskCard.tsx
      TaskCardSkeleton.tsx
      TasksSkeleton.tsx
  shared/
    hooks.ts                  ← useDebouncedValue(), useDeferredLoading()
    hooks/
      useVoiceOptions.ts      ← mount-time /api/voices fetch (QUERY TARGET)
    Highlight.tsx
    tokenize.ts
```

## Evidence Summary

Current server reads found in the extracted hooks:

| Surface | Hook / File | Endpoint(s) | Current pattern |
|---------|-------------|-------------|-----------------|
| Account snapshot | `accountData.ts` → `useAccountData()` | `/api/me`, `/api/credits/usage?window_days=90`, auth session | Per-hook-instance fetch lifecycle; duplicated across AccountLayout + child pages |
| Voice list page | `voices/hooks/useVoiceList.ts` | `/api/voices?...` | Manual `load()` + `AbortController` + `useDeferredLoading` |
| Voice options | `shared/hooks/useVoiceOptions.ts` | `/api/voices` | Mount-time fetch with `active` guard; shared by Generate + History |
| Generation history | `history/hooks/useGenerationList.ts` | `/api/generations?...` | Manual `load()` + `AbortController` + conditional `setInterval` polling |
| Tasks page list | `tasks/hooks/useTaskList.ts` | `/api/tasks?...` | Initial fetch + recursive `setTimeout` polling + visibility listener + cursor pagination |
| Task overlay details | `app/TaskProvider.tsx` | `/api/tasks/:id` | Per-task `setInterval` polling tied to localStorage state |

Current mutation patterns in extracted hooks:

| Surface | Hook / File | Endpoint(s) | Current pattern |
|---------|-------------|-------------|-----------------|
| Voice mutations | `voices/hooks/useVoiceMutations.ts` | `DELETE /api/voices/:id`, `PATCH .../favorite`, `PATCH .../name` | Manual `busyDelete`/`busyFavorite`/`busyRename` useState + `onReload()` callback |
| Generation delete | `history/hooks/useGenerationActions.ts` | `DELETE /api/generations/:id` | Imperative + `onReload()` callback |
| Generation regenerate | `history/hooks/useGenerationActions.ts` | `POST /api/generations/:id/regenerate` | Imperative + navigate (stays imperative) |
| Clone submission | `clone/hooks/useCloneSubmit.ts` | `POST /api/clone/upload-url` → `PUT upload_url` → `POST /api/clone/finalize` | Multi-step imperative with mock mode |
| Generate submission | `generate/hooks/useGenerateSubmit.ts` | `POST /api/generate` | Imperative + `startTask()` in TaskProvider |
| Design preview | `design/hooks/useDesignSubmit.ts` | `POST /api/voices/design/preview` | Imperative + `startTask()` in TaskProvider |
| Design save | `design/hooks/useDesignSubmit.ts` | `POST /api/voices/design` (FormData) | Imperative with blob lifecycle |
| Checkout | `account/Credits.tsx` | `POST /api/billing/checkout` | Inline imperative + `window.location.assign` |

Cross-feature invalidation gaps (unchanged from pre-extraction):

- `Voices.tsx` mutations call `voiceList.reload()` — no shared cache with Generate or History voice options.
- `History.tsx` delete calls `genList.reload()` — no shared cache.
- `Credits.tsx` post-checkout calls `refresh({ background: true })` — only updates its own hook instance.
- `Generate.tsx` and `Design.tsx` do not refresh voice options after a voice is created/changed.

## Cleanup Notes

- `useCreditsUsage()` was dead code in `shared/hooks.ts` — now removed. Only `useDebouncedValue()` and `useDeferredLoading()` remain.
- Languages are static constants in `lib/provider-config.ts`. No `/api/languages` endpoint exists. No Query target.
- `useDeferredLoading()` is used by `useVoiceList`, `useGenerationList`, and `useTaskList` to prevent flash-of-loading. After Query migration, this can be replaced by checking `query.isFetching && query.data !== undefined` (stale-while-revalidate) or `query.isPending` (first load). Evaluate per-hook during migration.

## Implementation Guidance

Informed by [TkDodo's Practical React Query series](https://tkdodo.eu/blog/practical-react-query). Detailed tips and code examples live in `docs/plans/2026-03-29/tanstack-query/tips.md`. Before/after migration snippets with exact codebase code live in `docs/plans/2026-03-29/tanstack-query/migration-guide.md`.

### Primary abstraction: `queryOptions()`, not custom hooks

Use `queryOptions()` from `@tanstack/react-query` as the first abstraction layer. The extracted hooks (`useVoiceList`, `useGenerationList`, etc.) will be replaced by thin wrappers around `useQuery(factoryEntry())` or by direct `useQuery` calls in the page components. Do not default to wrapping `useQuery` in custom hooks unless they add real logic beyond configuration.

Post-extraction, the migration path is:
1. Create query factories (`voiceQueries`, `generationQueries`, `accountQueries`) using `queryOptions()`
2. Replace the internals of each extracted hook with `useQuery`/`useMutation` calls
3. Optionally flatten: if the hook becomes a trivial `useQuery` wrapper, the page component can call `useQuery(factory.entry())` directly

Source: [#24 The Query Options API](https://tkdodo.eu/blog/the-query-options-api), [#31 Creating Query Abstractions](https://tkdodo.eu/blog/creating-query-abstractions)

### Query key factories with `queryOptions()`

```ts
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

Source: [#8 Effective React Query Keys](https://tkdodo.eu/blog/effective-react-query-keys), [#24 The Query Options API](https://tkdodo.eu/blog/the-query-options-api)

### Global `staleTime` default

Set `staleTime: 1000 * 20` (20s) globally. Override per-query:
- Voice options: `staleTime: 1000 * 60` (voices rarely change mid-session)
- Account snapshot: `staleTime: 1000 * 30`
- Form seed data: `staleTime: Infinity`

Leave `refetchOnWindowFocus` on (the default).

Source: [#1 Practical React Query](https://tkdodo.eu/blog/practical-react-query), [#10 React Query as a State Manager](https://tkdodo.eu/blog/react-query-as-a-state-manager)

### Global mutation invalidation via `MutationCache`

```ts
const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 20 } },
  mutationCache: new MutationCache({
    onSuccess: (_data, _variables, _context, mutation) => {
      queryClient.invalidateQueries({
        queryKey: mutation.options.mutationKey,
      });
    },
  }),
});
```

This replaces all per-mutation `onReload()` callbacks in `useVoiceMutations` and `useGenerationActions`.

Source: [#25 Automatic Query Invalidation after Mutations](https://tkdodo.eu/blog/automatic-query-invalidation-after-mutations)

### Polling: `refetchInterval` callback

Replaces `refreshTimerRef` + `setInterval` in `useGenerationList` and the recursive `setTimeout` + visibility listener in `useTaskList`.

Source: [#1 Practical React Query](https://tkdodo.eu/blog/practical-react-query)

### Mutations: `mutate` over `mutateAsync`, separate callback concerns

`isPending` from `useMutation` replaces manual `busyDelete`/`busyFavorite`/`busyRename` in `useVoiceMutations`.

Source: [#12 Mastering Mutations in React Query](https://tkdodo.eu/blog/mastering-mutations-in-react-query)

### TypeScript: inference over manual generics

Our `apiJson<T>()` already returns `Promise<T>`, so inference flows automatically through `queryFn`.

Source: [#6 React Query and TypeScript](https://tkdodo.eu/blog/react-query-and-type-script)

## Per-Hook Audit (post extraction)

### `frontend/src/features/shared/hooks.ts`

**Contents**: `useDebouncedValue()`, `useDeferredLoading()`.

**Query assessment**: Not a Query target. Pure client utilities. `useDeferredLoading` may become unnecessary after Query migration (stale-while-revalidate handles the flash-of-loading concern natively).

### `frontend/src/features/shared/hooks/useVoiceOptions.ts`

**Current implementation**: Mount-time `useEffect` fetching `/api/voices` with `active` guard. Returns `{ voices, loading, error }`.

**Consumers**: `Generate.tsx`, `History.tsx` (both import directly).

**What Query replaces**: The entire hook body. Becomes `useQuery(voiceQueries.options())` with a `useMemo` for the `label` mapping.

**What stays**: The `VoiceOptionItem` type and the `label` derivation.

**Priority**: Wave 1. Shared by two pages, currently fetches independently per mount.

**Query key**: `["voices", "options"]` — shared with `voiceQueries.options()`.

### `frontend/src/features/account/accountData.ts`

**Current implementation**: `useAccountData()` hook with 7 `useState` calls. `loadAccountSnapshot()` runs `Promise.all` over `/api/me`, `/api/credits/usage?window_days=90`, and `getAuthSession()`. Called independently by `AccountLayout`, `Overview`, `Credits`, `Profile` — each creates a separate fetch lifecycle.

**What Query replaces**:
- The duplicated mount-time fetch across 4+ consumers → single shared cache entry
- `loading`/`refreshing`/`error` manual state → derived from query status
- `refresh({ background: true })` → `queryClient.invalidateQueries({ queryKey: accountQueries.all() })`

**What stays**:
- `loadAccountSnapshot()` — the fetch function is unchanged
- Pure helpers: `formatCredits`, `formatUsd`, `formatDate`, `formatDateTime`, `buildAccountActivity`
- `signOut()` — remains imperative, outside Query, but must call `queryClient.removeQueries({ queryKey: accountQueries.all() })` to clear stale cache
- The `AccountData` return shape can stay compatible for minimal consumer changes

**Priority**: Wave 1, highest payoff. Removes duplicated ownership immediately.

**Query key**: `["account", "snapshot"]`

### `frontend/src/features/account/AccountLayout.tsx`

**Current**: Calls `useAccountData()`, consumes only `error`, `refresh`, `refreshing` for the retry banner.

**After Query**: Subscribes to the shared account query. Retry becomes `queryClient.invalidateQueries`. Minimal file change.

### `frontend/src/features/account/Overview.tsx`

**Current**: Calls `useAccountData()`, reads `credits`, `activity`. Shows skeleton until `credits` is truthy.

**After Query**: Subscribes to shared account query. Skeleton keys off `query.isPending`.

### `frontend/src/features/account/Credits.tsx`

**Current**: Calls `useAccountData()`, reads `activity`, `credits`, `refresh`, `refreshing`. Post-checkout `useEffect` calls `refresh({ background: true })`.

**After Query**: Post-checkout becomes `queryClient.invalidateQueries({ queryKey: accountQueries.all() })`. `startCheckout()` stays imperative (redirects browser).

### `frontend/src/features/account/Profile.tsx`

**Current**: Calls `useAccountData()`, reads `authEmail`, `identities`, `profile`, `signOut`.

**After Query**: Subscribes to shared account query. `signOut()` stays imperative.

### `frontend/src/features/voices/hooks/useVoiceList.ts`

**Current implementation**: `load()` with `AbortController`, `useState` for `data`/`loading`/`error`, `useDeferredLoading`, `useEffect` triggers on filter changes.

**What Query replaces**:
- `load()`, `loadAbortRef`, both `useEffect` blocks, cleanup effect
- `data`/`loading`/`error` useState
- `useDeferredLoading` → stale-while-revalidate handles this natively
- `reload()` callback → automatic via `MutationCache` invalidation

**What stays**:
- `VoiceListFilters` type (becomes the query key filter object)
- `PER_PAGE` constant
- The QS building logic (moves into the query factory)

**Return shape change**: `UseVoiceListResult` simplifies. `setError` is no longer needed (errors live on the query). `reload` is no longer needed (mutations auto-invalidate). The page component accesses `query.data`, `query.isPending`, `query.error`, `query.isFetching`.

**Priority**: Wave 1, high.

**Query key**: `["voices", "list", filters]`

### `frontend/src/features/voices/hooks/useVoiceMutations.ts`

**Current implementation**: Three `useCallback` functions with manual `busyX` useState + `onReload`/`onError` callbacks.

**What Query replaces**:
- All three `busyX` useState → `mutation.isPending` (but note: `isPending` is per-mutation-hook, not per-item)
- `onReload()` callbacks → `MutationCache` global invalidation with `mutationKey: voiceQueries.all()`
- `onError()` callbacks → `mutation.error`

**Per-item busy tracking**: The current pattern tracks which specific voice ID is busy. With `useMutation`, `isPending` is a boolean for the whole hook. To track per-item busy state, either:
  - Use `mutation.variables` to check which item is in-flight: `deleteVoice.isPending && deleteVoice.variables === voice.id`
  - Or keep a thin wrapper that exposes `busyId` derived from `mutation.variables`

**Priority**: Wave 1, paired with `useVoiceList`.

**Mutation keys**: `voiceQueries.all()` for all three (invalidates both list and options caches).

### `frontend/src/features/history/hooks/useGenerationList.ts`

**Current implementation**: Same pattern as `useVoiceList` plus conditional polling via `setInterval` when active generations exist.

**What Query replaces**:
- `load()`, `loadAbortRef`, `refreshTimerRef`, all three `useEffect` blocks
- `data`/`loading`/`error` useState
- `useDeferredLoading`
- Polling logic → `refetchInterval` callback

**What stays**:
- `GenerationListFilters` type
- `PER_PAGE` constant
- QS building logic (moves into query factory)

**Priority**: Wave 1, high.

**Query key**: `["generations", "list", filters]`

### `frontend/src/features/history/hooks/useGenerationActions.ts`

**Current implementation**: Three `useCallback` functions with `onReload`/`onError` callbacks.

**What Query replaces**:
- `deleteGeneration` → `useMutation` with `mutationKey: generationQueries.all()`
- `onReload()` callback → automatic via `MutationCache`

**What stays**:
- `regenerate` — navigates after success, stays imperative
- `download` — resolves protected media URL, stays imperative

**Priority**: Wave 1, paired with `useGenerationList`.

### `frontend/src/features/tasks/hooks/useTaskList.ts`

**Current implementation**: Initial fetch `useEffect` + recursive `setTimeout` polling with visibility-change listener + cursor-based `loadMore` + `refreshAfterAction` + `removeTask`.

**What Query replaces**:
- Initial fetch + polling → `useQuery` with `refetchInterval` callback + `refetchIntervalInBackground: false`
- `loading`/`error` useState
- `refreshAfterAction()` → `queryClient.invalidateQueries({ queryKey: taskQueries.all() })`

**What needs design work**:
- `loadMore` with cursor pagination → `useInfiniteQuery` with `before` as page param, or keep imperative for now
- `removeTask` (optimistic local removal after dismiss) → optimistic update via `queryClient.setQueryData` or keep as local state overlay

**Priority**: Wave 2. Good Query fit, but `TaskProvider` interaction and cursor pagination add complexity.

**Query key**: `["tasks", "list", { status: "active", type: typeFilter, limit: 10 }]`

### `frontend/src/features/generate/hooks/useGenerateSubmit.ts`

**Current implementation**: Posts `/api/generate`, then calls `startTask()` in TaskProvider. Manages `submitting`, `sweepNonce`, `error`, `submitInFlightRef`.

**Query assessment**: NOT a Query target. The mutation creates a task tracked by TaskProvider, not a cache entry. The submit flow is tightly coupled to TaskProvider's `startTask()`. Keep as-is.

### `frontend/src/features/design/hooks/useDesignSubmit.ts`

**Current implementation**: Two mutations (preview + save), blob lifecycle management, TaskProvider integration, object URL cleanup.

**Query assessment**: NOT a Query target. Complex imperative flow with blob refs, object URL lifecycle, and TaskProvider coupling. Keep as-is.

### `frontend/src/features/clone/hooks/useCloneSubmit.ts`

**Current implementation**: Three-step sequential mutation (upload-url → PUT file → finalize) with mock mode support, elapsed timer.

**Query assessment**: NOT a first-wave Query target. The multi-step flow with mock mode and elapsed timer is better served by the current imperative pattern. Could become a `useMutation` later, but the mock mode branching and elapsed timer add complexity that doesn't benefit from Query's caching.

### `frontend/src/features/clone/hooks/useTranscribe.ts`

**Query assessment**: Could become a `useMutation` but low priority. The transcription is a one-shot fire-and-forget mutation that sets local form state. No cache invalidation needed.

### `frontend/src/app/TaskProvider.tsx`

**Query assessment**: NOT a Query target. Hybrid client/server state with localStorage persistence, cross-tab sync, reducer, per-task polling. Query doesn't replace this cleanly.

### `frontend/src/app/auth/AuthStateProvider.tsx`

**Query assessment**: NOT a Query target. Singleton auth context with router invalidation. Not duplicated, not painful.

### Route files, `router.ts`, `App.tsx`

**Query assessment**: NOT Query targets. URL contracts and provider wiring only.

## Practical Rollout Order

1. **Bootstrap**: Install `@tanstack/react-query`. Create `QueryClient` with global `staleTime: 1000 * 20` and `MutationCache` global invalidation callback. Wrap `App` in `QueryClientProvider` (between `TaskProvider` and `InnerApp`, or around `InnerApp`).

2. **Create query factories** co-located with each feature:
   - `frontend/src/features/account/queries.ts` → `accountQueries`
   - `frontend/src/features/voices/queries.ts` → `voiceQueries`
   - `frontend/src/features/history/queries.ts` → `generationQueries`

3. **Wave 1a — Account snapshot**: Replace `useAccountData()` internals with `useQuery(accountQueries.snapshot())`. All 4 consumers share one cache entry. `refresh()` becomes invalidation.

4. **Wave 1b — Voice list + mutations**: Replace `useVoiceList` internals with `useQuery(voiceQueries.list(filters))`. Replace `useVoiceMutations` with three `useMutation` calls using `mutationKey: voiceQueries.all()`.

5. **Wave 1c — Voice options**: Replace `useVoiceOptions` internals with `useQuery(voiceQueries.options())`. Generate and History now share cached voice data with the Voices page.

6. **Wave 1d — Generation history**: Replace `useGenerationList` internals with `useQuery` + `refetchInterval` callback. Replace delete in `useGenerationActions` with `useMutation`.

7. **Wave 2 — Tasks**: Replace `useTaskList` with `useQuery` + `refetchInterval` + potentially `useInfiniteQuery` for load-more. Coordinate with TaskProvider.

8. **Optional later**: Revisit `useCloneSubmit` and `useTranscribe` as `useMutation` candidates. Revisit TaskProvider after first-wave surfaces are smaller.

## What is NOT migrated

| Area | Why |
|------|-----|
| `AuthStateProvider` | Singleton auth context with router invalidation. Not duplicated, not painful. |
| `TaskProvider` | Hybrid client/server state with localStorage persistence, cross-tab sync, reducer. Query doesn't replace this cleanly. |
| Route `validateSearch` files | URL contract only, no fetching. |
| `router.ts` / `App.tsx` | Provider wiring and auth guards. |
| `useGenerateSubmit` / `useDesignSubmit` | TaskProvider integration. Mutations create tracked tasks, not cache entries. |
| `useCloneSubmit` | Multi-step imperative flow with mock mode. |
| Form state in Generate/Design/Clone | Local client state seeded once from server data. Query manages the seed fetch, not the form. |
| Playback state | Pure client state (waveform refs, play/pause). |

## Bottom Line

The component extraction pass has made the Query migration significantly cleaner. Each fetch/mutation concern is already isolated in its own hook file. The migration is now a matter of swapping hook internals — replacing `useState` + `useEffect` + `AbortController` patterns with `useQuery`/`useMutation` calls — without touching page component structure or JSX.

The key wins remain:
- Deduplicated account snapshot across 4+ consumers
- Shared voice options cache across 3 features
- Automatic post-mutation invalidation replacing manual `reload()` callbacks
- Native polling replacing manual `setInterval`/`setTimeout` + visibility listeners
- Eliminated `AbortController` boilerplate (Query handles cancellation)
- Eliminated `loading`/`error`/`data` useState boilerplate

Companion documents:
- Implementation tips: `docs/plans/2026-03-29/tanstack-query/tips.md`
- Before/after migration guide: `docs/plans/2026-03-29/tanstack-query/migration-guide.md`
- Clone.tsx dissection: `docs/plans/2026-03-29/tanstack-query/clone-dissection.md`
