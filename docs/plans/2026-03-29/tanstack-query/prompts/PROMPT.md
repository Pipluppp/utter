# TanStack Query Migration — Implementor Prompt

Copy everything below the line and paste it as a single message to the implementor agent.

---

## Task

Migrate the `frontend/` React SPA from hand-rolled `useState`/`useEffect` fetch hooks to TanStack Query (`@tanstack/react-query`). The entire migration is planned and documented — your job is to execute it precisely, wave by wave.

## Required reading (read ALL of these before writing any code)

Read these project plan files in order — they are the ground truth for this migration:

1. `docs/plans/2026-03-29/tanstack-query/tanstack-query-audit.md` — Full audit: what to migrate, what NOT to migrate, rollout order, per-hook assessment
2. `docs/plans/2026-03-29/tanstack-query/migration-guide.md` — Exact before/after code for every wave, including bootstrap, query factories, consumer changes, file cleanup, verification checklist
3. `docs/plans/2026-03-29/tanstack-query/tips.md` — Implementation patterns: `queryOptions()` as primary abstraction, key factories, global `staleTime`, `MutationCache` invalidation, polling, TypeScript inference, `keepPreviousData`, per-item busy state
4. `docs/plans/2026-03-29/tanstack-query/clone-dissection.md` — Clone.tsx analysis (context only, Clone is NOT a first-wave target)

## TanStack Query reference docs (local)

The official TanStack Query v5 docs are vendored locally at `.tanstack-query-docs/`. When you need to check API signatures, hook options, or behavior — **read these files, do not guess from memory**.

Key files you will need:

- `.tanstack-query-docs/react/reference/useQuery.md` — `useQuery` options and return value
- `.tanstack-query-docs/react/reference/useMutation.md` — `useMutation` options and return value
- `.tanstack-query-docs/react/reference/useInfiniteQuery.md` — for Tasks wave (load-more)
- `.tanstack-query-docs/react/reference/queryOptions.md` — the `queryOptions()` helper
- `.tanstack-query-docs/react/reference/infiniteQueryOptions.md` — for infinite query factories
- `.tanstack-query-docs/react/reference/mutationOptions.md` — `mutationOptions()` helper
- `.tanstack-query-docs/react/reference/useQueryClient.md` — `useQueryClient` hook
- `.tanstack-query-docs/react/reference/QueryClientProvider.md` — provider setup
- `.tanstack-query-docs/core/QueryClient.md` — `QueryClient` constructor, `invalidateQueries`, `removeQueries`, `setQueryData`
- `.tanstack-query-docs/core/MutationCache.md` — global mutation callbacks
- `.tanstack-query-docs/react/guides/queries.md` — query basics
- `.tanstack-query-docs/react/guides/mutations.md` — mutation basics
- `.tanstack-query-docs/react/guides/query-keys.md` — key structure
- `.tanstack-query-docs/react/guides/query-invalidation.md` — invalidation patterns
- `.tanstack-query-docs/react/guides/paginated-queries.md` — `keepPreviousData`
- `.tanstack-query-docs/react/guides/infinite-queries.md` — infinite queries
- `.tanstack-query-docs/react/guides/optimistic-updates.md` — `setQueryData` patterns
- `.tanstack-query-docs/react/guides/important-defaults.md` — default behavior to be aware of
- `.tanstack-query-docs/react/guides/disabling-queries.md` — `enabled` option, `skipToken`
- `.tanstack-query-docs/react/guides/window-focus-refetching.md` — refetch on focus
- `.tanstack-query-docs/react/guides/filters.md` — query/mutation filters for invalidation
- `.tanstack-query-docs/react/guides/testing.md` — if you need to touch tests
- `.tanstack-query-docs/react/typescript.md` — TypeScript integration and inference

## Execution order

Follow the rollout order from the migration guide exactly:

### Step 0: Bootstrap
- `npm --prefix frontend install @tanstack/react-query`
- Create `frontend/src/lib/queryClient.ts` (QueryClient singleton with global `staleTime: 1000 * 20` and `MutationCache` global invalidation)
- Wire `QueryClientProvider` in `frontend/src/app/App.tsx` — wrap `InnerApp` inside the existing provider stack (between `TaskProvider` and `InnerApp`)
- Verify: `npm --prefix frontend run typecheck` passes

### Step 1a: Account Snapshot
- Create `frontend/src/features/account/queries.ts` with `accountQueries` factory
- Rewrite `useAccountData()` in `frontend/src/features/account/accountData.ts` to use `useQuery(accountQueries.snapshot())`
- Export `loadAccountSnapshot` from `accountData.ts` (it's currently module-private)
- Add `queryClient.removeQueries({ queryKey: accountQueries.all() })` to signOut
- Update `AccountLayout.tsx` retry to use `queryClient.invalidateQueries`
- Update `Credits.tsx` post-checkout refresh to use `queryClient.invalidateQueries`
- `Overview.tsx` and `Profile.tsx` should need minimal or no changes if the return shape stays compatible
- Verify: typecheck passes, account pages render, retry works, sign-out clears data, post-checkout refreshes

### Step 1b: Voice List + Mutations
- Create `frontend/src/features/voices/queries.ts` with `voiceQueries` factory
- Replace `useVoiceList` usage in `Voices.tsx` with `useQuery(voiceQueries.list(filters))` + `placeholderData: keepPreviousData`
- Replace `useVoiceMutations` with three `useMutation` calls directly in `Voices.tsx` using `mutationKey: voiceQueries.all()`
- Derive combined error from query + mutation errors
- Per-item busy: `deleteVoice.isPending && deleteVoice.variables === voice.id`
- Delete `frontend/src/features/voices/hooks/useVoiceList.ts`
- Delete `frontend/src/features/voices/hooks/useVoiceMutations.ts`
- Verify: typecheck, voices page renders, filter/sort/search/pagination work, delete/favorite/rename work and auto-refresh the list

### Step 1b+: Cross-feature voice invalidation
- Add `useQueryClient()` + `queryClient.invalidateQueries({ queryKey: ["voices"] })` to `useCloneSubmit.ts` (after `setCreated(res)`)
- Add `useQueryClient()` + `queryClient.invalidateQueries({ queryKey: ["voices"] })` to `useDesignSubmit.ts` (after `setSavedVoiceId(saved.id)`)
- These are minimal one-line additions, not full rewrites — do not convert to `useMutation`
- Verify: clone a voice → navigate to Voices → new voice appears without manual refresh

### Step 1c: Voice Options
- Rewrite `frontend/src/features/shared/hooks/useVoiceOptions.ts` to use `useQuery(voiceQueries.options())`
- Keep the `VoiceOptionItem` type and `label` derivation `useMemo`
- No consumer changes needed in `Generate.tsx` or `History.tsx`
- Verify: Generate and History voice dropdowns work, shared cache means one fetch

### Step 1d: Generation History
- Create `frontend/src/features/history/queries.ts` with `generationQueries` factory
- Replace `useGenerationList` usage in `History.tsx` with `useQuery` + `refetchInterval` callback (poll when active generations exist) + `placeholderData: keepPreviousData`
- Replace delete from `useGenerationActions` with `useMutation` in History.tsx using `mutationKey: generationQueries.all()`
- Keep `regenerate` and `download` as imperative in `useGenerationActions` (remove `onReload`/`onError` params, remove `deleteGeneration`)
- Delete `frontend/src/features/history/hooks/useGenerationList.ts`
- Verify: typecheck, history page renders, polling starts/stops based on active generations, delete works, filter/sort/pagination work

### Step 2: Tasks Page
- Create `frontend/src/features/tasks/queries.ts` with `taskQueries` factory
- Replace `useTaskList` in `Tasks.tsx` with `useQuery` + `refetchInterval` + `refetchIntervalInBackground: false`
- For load-more: evaluate `useInfiniteQuery` vs keeping imperative. The migration guide has both options
- `removeTask` (dismiss) becomes optimistic update via `queryClient.setQueryData`
- `refreshAfterAction` becomes `queryClient.invalidateQueries({ queryKey: taskQueries.all() })`
- Delete or gut `frontend/src/features/tasks/hooks/useTaskList.ts`
- Verify: typecheck, tasks page renders, polling works, dismiss works, load-more works

### Final cleanup
- Check if `useDeferredLoading` in `frontend/src/features/shared/hooks.ts` still has consumers. If not, remove it. `useDebouncedValue` stays.
- Run `npm --prefix frontend run check` (oxfmt + oxlint)
- Run `npm --prefix frontend run typecheck`

## Key files to read and modify

| File | Role |
|------|------|
| `frontend/src/app/App.tsx` | Add `QueryClientProvider` |
| `frontend/src/features/account/accountData.ts` | Rewrite `useAccountData()`, export `loadAccountSnapshot` |
| `frontend/src/features/account/AccountLayout.tsx` | Update retry to invalidation |
| `frontend/src/features/account/Credits.tsx` | Update post-checkout to invalidation |
| `frontend/src/features/voices/Voices.tsx` | Replace hook calls with `useQuery`/`useMutation` |
| `frontend/src/features/voices/hooks/useVoiceList.ts` | DELETE after migration |
| `frontend/src/features/voices/hooks/useVoiceMutations.ts` | DELETE after migration |
| `frontend/src/features/shared/hooks/useVoiceOptions.ts` | Rewrite internals |
| `frontend/src/features/history/History.tsx` | Replace hook calls with `useQuery`/`useMutation` |
| `frontend/src/features/history/hooks/useGenerationList.ts` | DELETE after migration |
| `frontend/src/features/history/hooks/useGenerationActions.ts` | Remove delete + onReload/onError, keep regenerate + download |
| `frontend/src/features/tasks/Tasks.tsx` | Replace hook calls |
| `frontend/src/features/tasks/hooks/useTaskList.ts` | DELETE or gut |
| `frontend/src/features/shared/hooks.ts` | Remove `useDeferredLoading` if unused |
| `frontend/src/features/clone/hooks/useCloneSubmit.ts` | Add `queryClient.invalidateQueries({ queryKey: ["voices"] })` after success (after Wave 1b) |
| `frontend/src/features/design/hooks/useDesignSubmit.ts` | Add `queryClient.invalidateQueries({ queryKey: ["voices"] })` after save (after Wave 1b) |
| `frontend/src/lib/api.ts` | READ ONLY — understand `apiJson`, `apiForm`, `withRefreshRetry` |
| `frontend/src/lib/types.ts` | READ ONLY — response types (`VoicesResponse`, `GenerationsResponse`, etc.) |

## New files to create

| File | Contents |
|------|----------|
| `frontend/src/lib/queryClient.ts` | `QueryClient` singleton with `MutationCache` |
| `frontend/src/features/account/queries.ts` | `accountQueries` factory |
| `frontend/src/features/voices/queries.ts` | `voiceQueries` factory |
| `frontend/src/features/history/queries.ts` | `generationQueries` factory |
| `frontend/src/features/tasks/queries.ts` | `taskQueries` factory |

## Cross-feature invalidation (after Wave 1b)

Once `voiceQueries` exists, two files that create voices need a single invalidation call added so the voice list/options cache refreshes after a new voice is created. Do NOT convert these to `useMutation` — just add the invalidation.

### `frontend/src/features/clone/hooks/useCloneSubmit.ts`
After the successful `setCreated(res)` line inside `submit()`:
```ts
import { useQueryClient } from "@tanstack/react-query";
// ...
const queryClient = useQueryClient();
// ... inside submit(), after setCreated(res):
queryClient.invalidateQueries({ queryKey: ["voices"] });
```

### `frontend/src/features/design/hooks/useDesignSubmit.ts`
After the successful `setSavedVoiceId(saved.id)` line inside `savePreview()`:
```ts
import { useQueryClient } from "@tanstack/react-query";
// ...
const queryClient = useQueryClient();
// ... inside savePreview(), after setSavedVoiceId(saved.id):
queryClient.invalidateQueries({ queryKey: ["voices"] });
```

This closes the cross-feature invalidation gaps flagged in the audit: clone a voice → voice list refreshes, design and save a voice → voice list refreshes.

## What NOT to touch

These are explicitly outside scope — do not modify beyond the invalidation calls noted above:

- `frontend/src/app/auth/AuthStateProvider.tsx`
- `frontend/src/app/TaskProvider.tsx`
- `frontend/src/router.ts`
- Route `validateSearch` files under `frontend/src/routes/`
- `frontend/src/features/generate/hooks/useGenerateSubmit.ts`
- `frontend/src/features/clone/hooks/useAudioRecorder.ts`
- `frontend/src/features/clone/hooks/useTranscribe.ts`
- Form state, playback state, modal state in page components
- Any component JSX structure (only change hook wiring and data access)
- Backend (`workers/`, `supabase/`)

## Rules

- Read the plan files before writing any code
- When unsure about a TanStack Query API, read the local docs at `.tanstack-query-docs/` — do not guess
- Use `queryOptions()` as the primary abstraction, not custom hook wrappers around `useQuery`
- Let TypeScript inference flow from `apiJson<T>()` — do not manually annotate `useQuery<T>()` generics
- Do not destructure query results (use `query.data`, `query.isPending` — not `const { data, isPending }`) to preserve TypeScript narrowing
- Use `mutate()` not `mutateAsync()` unless you need the Promise
- Preserve existing behavior exactly — this is a refactor, not a feature change
