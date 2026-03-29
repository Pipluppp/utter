# TanStack Query Migration — Spec 1: Bootstrap + Wave 1

## Scope

Install TanStack Query, wire the provider, and migrate all Wave 1 surfaces (Account, Voices, Voice Options, Generation History). This covers every hook replacement that is a straightforward swap of internals — no design decisions required.

The Tasks page (Wave 2) is explicitly out of scope for this spec. It involves `useInfiniteQuery` vs imperative load-more decisions, optimistic removal via `setQueryData`, and TaskProvider coordination. A separate spec will handle it after this one lands.

## Required reading

Read these project plan files before writing any code — they are the ground truth:

1. `docs/plans/2026-03-29/tanstack-query/tanstack-query-audit.md` — Full audit: what to migrate, what NOT to migrate, per-hook assessment
2. `docs/plans/2026-03-29/tanstack-query/migration-guide.md` — Exact before/after code for Bootstrap through Wave 1d, including query factories, consumer changes, file cleanup
3. `docs/plans/2026-03-29/tanstack-query/tips.md` — Implementation patterns: `queryOptions()`, key factories, global `staleTime`, `MutationCache`, polling, TypeScript inference, `keepPreviousData`, per-item busy state

The clone dissection (`clone-dissection.md`) is context only — Clone is not a migration target in either spec.

## TanStack Query reference docs (local)

Official TanStack Query v5 docs are vendored at `.tanstack-query-docs/`. When you need to check API signatures or behavior — read these files, do not guess from memory.

Files you will need for this spec:

- `.tanstack-query-docs/react/reference/useQuery.md`
- `.tanstack-query-docs/react/reference/useMutation.md`
- `.tanstack-query-docs/react/reference/queryOptions.md`
- `.tanstack-query-docs/react/reference/useQueryClient.md`
- `.tanstack-query-docs/react/reference/QueryClientProvider.md`
- `.tanstack-query-docs/core/QueryClient.md`
- `.tanstack-query-docs/core/MutationCache.md`
- `.tanstack-query-docs/react/guides/queries.md`
- `.tanstack-query-docs/react/guides/mutations.md`
- `.tanstack-query-docs/react/guides/query-keys.md`
- `.tanstack-query-docs/react/guides/query-invalidation.md`
- `.tanstack-query-docs/react/guides/paginated-queries.md` — `keepPreviousData`
- `.tanstack-query-docs/react/guides/important-defaults.md`
- `.tanstack-query-docs/react/guides/filters.md`
- `.tanstack-query-docs/react/typescript.md`

You do NOT need `useInfiniteQuery`, `infiniteQueryOptions`, or `optimistic-updates` docs for this spec — those are Wave 2.

## Execution order

### Step 0: Bootstrap

- `npm --prefix frontend install @tanstack/react-query`
- Create `frontend/src/lib/queryClient.ts` — QueryClient singleton with global `staleTime: 1000 * 20` and `MutationCache` global invalidation callback
- Wire `QueryClientProvider` in `frontend/src/app/App.tsx` — wrap `InnerApp` inside the existing provider stack
- Verify: `npm --prefix frontend run typecheck` passes

### Step 1a: Account Snapshot

- Create `frontend/src/features/account/queries.ts` with `accountQueries` factory
- Rewrite `useAccountData()` in `accountData.ts` to use `useQuery(accountQueries.snapshot())`
- Export `loadAccountSnapshot` from `accountData.ts` (currently module-private)
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
- These are minimal additions, not full rewrites — do not convert these hooks to `useMutation`
- Verify: clone a voice → navigate to Voices → new voice appears without manual refresh

### Step 1c: Voice Options

- Rewrite `frontend/src/features/shared/hooks/useVoiceOptions.ts` to use `useQuery(voiceQueries.options())`
- Keep the `VoiceOptionItem` type and `label` derivation `useMemo`
- No consumer changes needed in `Generate.tsx` or `History.tsx`
- Verify: Generate and History voice dropdowns work, shared cache means one network request

### Step 1d: Generation History

- Create `frontend/src/features/history/queries.ts` with `generationQueries` factory
- Replace `useGenerationList` usage in `History.tsx` with `useQuery` + `refetchInterval` callback (poll when active generations exist) + `placeholderData: keepPreviousData`
- Replace delete from `useGenerationActions` with `useMutation` in `History.tsx` using `mutationKey: generationQueries.all()`
- Keep `regenerate` and `download` as imperative in `useGenerationActions` (remove `onReload`/`onError` params, remove `deleteGeneration`)
- Delete `frontend/src/features/history/hooks/useGenerationList.ts`
- Verify: typecheck, history page renders, polling starts/stops based on active generations, delete works, filter/sort/pagination work

### Cleanup

- Check if `useDeferredLoading` in `frontend/src/features/shared/hooks.ts` still has consumers. If not, remove it. `useDebouncedValue` stays.
- Run `npm --prefix frontend run check` (oxfmt + oxlint)
- Run `npm --prefix frontend run typecheck`

## Files to read and modify

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
| `frontend/src/features/shared/hooks.ts` | Remove `useDeferredLoading` if unused |
| `frontend/src/features/clone/hooks/useCloneSubmit.ts` | Add voice invalidation after success |
| `frontend/src/features/design/hooks/useDesignSubmit.ts` | Add voice invalidation after save |
| `frontend/src/lib/api.ts` | READ ONLY — understand `apiJson`, `apiForm`, `withRefreshRetry` |
| `frontend/src/lib/types.ts` | READ ONLY — response types |

## New files to create

| File | Contents |
|------|----------|
| `frontend/src/lib/queryClient.ts` | `QueryClient` singleton with `MutationCache` |
| `frontend/src/features/account/queries.ts` | `accountQueries` factory |
| `frontend/src/features/voices/queries.ts` | `voiceQueries` factory |
| `frontend/src/features/history/queries.ts` | `generationQueries` factory |

## What NOT to touch

- `frontend/src/app/auth/AuthStateProvider.tsx`
- `frontend/src/app/TaskProvider.tsx`
- `frontend/src/router.ts`
- Route `validateSearch` files under `frontend/src/routes/`
- `frontend/src/features/generate/hooks/useGenerateSubmit.ts`
- `frontend/src/features/clone/hooks/useAudioRecorder.ts`
- `frontend/src/features/clone/hooks/useTranscribe.ts`
- `frontend/src/features/tasks/` — entire directory is Wave 2 (separate spec)
- Form state, playback state, modal state in page components
- Any component JSX structure (only change hook wiring and data access)
- Backend (`workers/`, `supabase/`)

## Rules

- Read the plan files before writing any code
- When unsure about a TanStack Query API, read the local docs at `.tanstack-query-docs/` — do not guess
- Use `queryOptions()` as the primary abstraction, not custom hook wrappers around `useQuery`
- Let TypeScript inference flow from `apiJson<T>()` — do not manually annotate `useQuery<T>()` generics
- Prefer non-destructured query results (`query.data`, `query.isPending`) when you need status narrowing
- Use `mutate()` not `mutateAsync()` unless you need the Promise
- Preserve existing behavior exactly — this is a refactor, not a feature change
