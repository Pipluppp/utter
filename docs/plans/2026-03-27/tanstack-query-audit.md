# TanStack Query Audit

Date: 2026-03-27

## Recommendation

TanStack Query is recommended for this frontend, but as the second follow-up after the current React cleanup pass, not as track #1 and not as a blanket rewrite.

Recommended first-wave Query targets:

- `frontend/src/features/shared/hooks.ts` for `/api/languages`
- `frontend/src/features/account/accountData.ts` plus its account consumers
- `frontend/src/features/voices/Voices.tsx`
- `frontend/src/features/history/History.tsx`
- `frontend/src/features/generate/Generate.tsx` for shared voice options

Recommended later Query target:

- `frontend/src/features/tasks/Tasks.tsx`

Explicit non-targets for the first Query pass:

- `frontend/src/router.ts`
- `frontend/src/app/App.tsx`
- `frontend/src/routes/_app/route.tsx`
- route `validateSearch` files under `frontend/src/routes`
- `frontend/src/app/auth/AuthStateProvider.tsx`
- most of `frontend/src/app/TaskProvider.tsx`
- local form, playback, modal, and object-URL state in `Clone.tsx`, `Design.tsx`, and `Generate.tsx`

## Evidence Summary

Current server reads found during code exploration:

| Surface | File(s) | Endpoint(s) | Current pattern |
| --- | --- | --- | --- |
| Shared languages | `frontend/src/features/shared/hooks.ts` | `/api/languages` | Module cache + in-flight promise + per-caller `useEffect` |
| Account snapshot | `frontend/src/features/account/accountData.ts` | `/api/me`, `/api/credits/usage?window_days=90`, auth session | Per-hook-instance fetch lifecycle |
| Voice list page | `frontend/src/features/voices/Voices.tsx` | `/api/voices?...` | Manual `load()` + `AbortController` + reload after mutations |
| Voice options | `frontend/src/features/generate/Generate.tsx`, `frontend/src/features/history/History.tsx` | `/api/voices`, `/api/voices?per_page=100` | Separate mount-time fetches |
| Generation history | `frontend/src/features/history/History.tsx` | `/api/generations?...` | Manual `load()` + conditional polling |
| Tasks page list | `frontend/src/features/tasks/Tasks.tsx` | `/api/tasks?...` | Manual fetch + recursive timeout polling + append pagination |
| Task overlay details | `frontend/src/app/TaskProvider.tsx` | `/api/tasks/:id` | Per-task polling tied to localStorage state |

Current mutation-triggered refresh patterns:

- `Voices.tsx` calls `void load()` after delete, favorite toggle, and rename.
- `History.tsx` calls `void load()` after delete.
- `Tasks.tsx` refetches `/api/tasks?...` after cancel.
- `AccountCredits.tsx` watches `checkout=success` in route search and calls `refresh({ background: true })`.
- `Generate.tsx` and `Design.tsx` do not refresh voice options after a voice is created or changed; they rely on mount-time fetches or navigation.

Current route/search ownership is already in the right layer:

- `frontend/src/routes/_app/voices.tsx`
- `frontend/src/routes/_app/history.tsx`
- `frontend/src/routes/_app/generate.tsx`
- `frontend/src/routes/_app/clone.tsx`
- `frontend/src/routes/_app/account/credits.tsx`
- `frontend/src/routes/_app/route.tsx`
- `frontend/src/router.ts`

TanStack Query should not replace those route/search contracts. It should replace duplicated component-owned server-state logic behind them.

## Per-File Audit

## `frontend/src/features/shared/hooks.ts`

### 1. Current responsibilities

- Exposes `useDebouncedValue()`.
- Exposes `useLanguages()` for shared `/api/languages` metadata.
- Exposes `useCreditsUsage(windowDays)` for `/api/credits/usage`, but no call sites were found.

### 2. Current data flow

- `languagesCache` stores the last successful `LanguagesResponse` at module scope.
- `languagesInFlight` stores a shared promise so concurrent callers reuse the same request.
- `getLanguagesOnce()` returns cached data if available, otherwise fetches `/api/languages`, writes `languagesCache`, and clears `languagesInFlight` in `finally`.
- `useLanguages()` still creates per-caller React state for `data`, `loading`, and `error`.
- `useLanguages()` returns derived fields:
  - `languages`
  - `defaultLanguage`
  - `provider`
  - `capabilities`
  - `transcription`
- Current consumers found by search:
  - `frontend/src/features/about/About.tsx`
  - `frontend/src/features/clone/Clone.tsx`
  - `frontend/src/features/design/Design.tsx`
  - `frontend/src/features/generate/Generate.tsx`
- `useCreditsUsage()` is a separate ad hoc fetch hook with its own `data`, `loading`, `error`, and `refresh`, but it is currently unused.

### 3. Current fetch trigger

- `useLanguages()` fetches on mount via `useEffect`, but only if `languagesCache` is still empty.
- `useCreditsUsage()` fetches on mount and whenever its `refresh` callback changes because `windowDays` changes.

### 4. Current owned state

- Module-level:
  - `languagesCache`
  - `languagesInFlight`
- `useLanguages()` state:
  - `data`
  - `loading`
  - `error`
- `useCreditsUsage()` state:
  - `data`
  - `loading`
  - `error`

### 5. Current refresh / invalidation behavior

- `useLanguages()` has no explicit invalidation, refresh, or staleness policy.
- Once `languagesCache` is filled, the process keeps serving it until a full page reload.
- `useCreditsUsage()` supports explicit `refresh()`, but that refresh is local to the hook instance and currently unused by the app.

### 6. Interaction with route/search state

- None directly.
- Consumers such as `Generate.tsx` and `Clone.tsx` combine this hook with route-owned search params, but the hook itself is not aware of route state.

### 7. What TanStack Query would replace

- For languages:
  - `languagesCache`
  - `languagesInFlight`
  - `getLanguagesOnce()`
  - per-caller `data/loading/error` ownership in `useLanguages()`
- If `useCreditsUsage()` is revived later, Query would also replace its manual mount fetch and local refresh lifecycle.

### 8. What TanStack Query would not replace

- `useDebouncedValue()`
- consumer-owned selected language state
- consumer-owned form state
- synchronous derived fields like `defaultLanguage` and `capabilities`

### 9. Adoption priority

- `useLanguages()`: Wave 1, low-risk and high leverage because it already behaves like a hand-rolled shared query.
- `useCreditsUsage()`: Do not migrate first because there are no call sites today.

### 10. Suggested query keys / mutation boundaries

- Query key:
  - `["languages"]`
- If `useCreditsUsage()` becomes live later:
  - `["credits", "usage", { windowDays }]`

## `frontend/src/features/account/accountData.ts`

### 1. Current responsibilities

- Defines account-specific formatters and activity builders.
- Loads the account snapshot used by the account area.
- Exposes `useAccountData()` for account pages and layout.
- Performs sign-out by calling `signOutRequest()` and then `authState.refresh()`.

### 2. Current data flow

- `loadAccountSnapshot()` runs `Promise.all()` over:
  - `/api/me`
  - `/api/credits/usage?window_days=90`
  - `getAuthSession()`
- `useAccountData()` stores the three result branches separately:
  - `me`
  - `credits`
  - auth-derived `authEmail` / `identities`
- `activity` is derived from `credits?.events`.
- `profile` is derived from `me?.profile`.
- The hook is called independently from:
  - `frontend/src/features/account/AccountLayout.tsx`
  - `frontend/src/features/account/Overview.tsx`
  - `frontend/src/features/account/Credits.tsx`
  - `frontend/src/features/account/Profile.tsx`
- Because the layout route renders `<Outlet />`, every account screen mounts at least two separate `useAccountData()` instances at the same time:
  - one in the layout
  - one in the active child page

### 3. Current fetch trigger

- Every `useAccountData()` instance calls `refresh()` in a mount-time `useEffect`.
- `refresh({ background: true })` can also be called manually from consumers.
- `signOut()` is a mutation-style side effect, not a read refresh.

### 4. Current owned state

- `authEmail`
- `identities`
- `me`
- `credits`
- `loading`
- `refreshing`
- `error`
- derived `activity`

### 5. Current refresh / invalidation behavior

- No shared cache or invalidation exists across hook instances.
- Retry and refresh calls only update the specific hook instance that invoked them.
- `Credits.tsx` calls `refresh({ background: true })` after `checkout=success`.
- `signOut()` clears only the calling hook instance's local account fields after the auth request succeeds, while `AuthStateProvider` separately refreshes global auth state.

### 6. Interaction with route/search state

- None inside the hook.
- Route/search interaction is delegated to consumers such as `Credits.tsx`.

### 7. What TanStack Query would replace

- The repeated mount-time fetch lifecycle for the same account snapshot.
- Per-instance `loading`, `refreshing`, and `error` duplication for the same data.
- The need for each account page and the account layout to own separate copies of the same server read.
- Manual background refresh calls would become query invalidation or refetch.

### 8. What TanStack Query would not replace

- Pure helpers:
  - `formatCredits`
  - `formatUsd`
  - `formatDate`
  - `formatDateTime`
  - `buildAccountActivity`
- Route redirects and auth guards
- The higher-level auth session contract in `AuthStateProvider`
- Sign-out side effects that must still update router auth state

### 9. Adoption priority

- Wave 1, highest payoff in the account area because it removes duplicated ownership immediately.

### 10. Suggested query keys / mutation boundaries

- Query key:
  - `["account", "snapshot"]`
- Optional mutation boundaries:
  - sign-out can remain outside Query for now
  - later, a checkout-success invalidation can target `["account", "snapshot"]`

## `frontend/src/features/account/AccountLayout.tsx`

### 1. Current responsibilities

- Renders the account shell, tabs, and retry banner.
- Chooses the active tab from the current pathname.
- Renders the active account child route through `<Outlet />`.

### 2. Current data flow

- Calls `useAccountData()` but only consumes:
  - `error`
  - `refresh`
  - `refreshing`
- Does not pass account data to child pages.
- Because children also call `useAccountData()`, the layout currently duplicates the account fetch but only uses it to show the top-level error banner.

### 3. Current fetch trigger

- Fetch is triggered indirectly by `useAccountData()` when the layout mounts.

### 4. Current owned state

- No local `useState`.
- Consumes hook-owned account state from its own `useAccountData()` instance.
- Derives `selectedTab` from `location.pathname`.

### 5. Current refresh / invalidation behavior

- Retry button calls `account.refresh({ background: true })`.
- That refresh only updates the layout's hook instance.

### 6. Interaction with route/search state

- Uses pathname, not search params, to pick the selected tab.
- Tab changes navigate between account routes.
- No server read depends on route search here.

### 7. What TanStack Query would replace

- The duplicated account snapshot ownership caused by calling `useAccountData()` in the layout.
- The retry action would become a refetch of the shared account query.

### 8. What TanStack Query would not replace

- Tab selection from pathname
- account navigation
- layout rendering and `<Outlet />`

### 9. Adoption priority

- Wave 1 as part of the account snapshot migration, but the file change itself is small and dependent on `accountData.ts`.

### 10. Suggested query keys / mutation boundaries

- Reuse:
  - `["account", "snapshot"]`

## `frontend/src/features/account/Overview.tsx`

### 1. Current responsibilities

- Renders the account overview dashboard.
- Shows balance, recent activity, pricing cards, and quick links.

### 2. Current data flow

- Calls `useAccountData()` directly.
- Reads:
  - `credits`
  - `activity`
- Shows the skeleton until `credits` is truthy.
- Derives `recentActivity` from `activity.slice(0, 4)`.

### 3. Current fetch trigger

- Fetch is triggered indirectly by this component's `useAccountData()` mount.

### 4. Current owned state

- No local fetch state.
- Owns only derived values:
  - `recentActivity`
  - `balance`
- All server state is hook-owned.

### 5. Current refresh / invalidation behavior

- None in this file.
- It relies on the initial hook fetch and whatever refreshes happen inside this component's hook instance.

### 6. Interaction with route/search state

- None.
- Navigation links point to other routes, but no search params drive the read.

### 7. What TanStack Query would replace

- The page-level `useAccountData()` read would become a shared query subscription.
- The skeleton would key off query status rather than another duplicated hook instance.

### 8. What TanStack Query would not replace

- UI composition
- slicing recent activity
- quick-link navigation

### 9. Adoption priority

- Wave 1 because it is a direct consumer of the duplicated account snapshot.

### 10. Suggested query keys / mutation boundaries

- Reuse:
  - `["account", "snapshot"]`

## `frontend/src/features/account/Credits.tsx`

### 1. Current responsibilities

- Renders the credit balance, prepaid packs, activity timeline, and pricing help.
- Starts checkout.
- Refreshes account data after checkout success.
- Owns a local activity filter UI.

### 2. Current data flow

- Reads `checkout` from `creditsRoute.useSearch()`.
- Calls `useAccountData()` directly and consumes:
  - `activity`
  - `credits`
  - `refresh`
  - `refreshing`
- Local state owns:
  - `activePackId`
  - `checkoutError`
  - `activityFilter`
- `filteredActivity` is derived locally from `activity`.
- `startCheckout(packId)` posts to `/api/billing/checkout`, then redirects the browser with `window.location.assign(response.url)`.

### 3. Current fetch trigger

- Account snapshot fetch is triggered by this component's `useAccountData()` mount.
- A `useEffect` watches the validated route search param and calls `refresh({ background: true })` when `checkout=success`.

### 4. Current owned state

- Local UI state:
  - `activePackId`
  - `checkoutError`
  - `activityFilter`
- Hook-owned account state from a separate `useAccountData()` instance.

### 5. Current refresh / invalidation behavior

- Manual refresh button calls `refresh({ background: true })`.
- `checkout=success` also triggers `refresh({ background: true })`.
- Neither path invalidates a shared cache because none exists yet.
- `startCheckout()` itself does not refresh data before redirecting.

### 6. Interaction with route/search state

- Route search param `checkout` is the trigger for the post-checkout refresh banner and behavior.
- `clearCheckoutStatus()` removes the search param with `navigate({ search: {}, replace: true })`.
- `activityFilter` is local component state and is not mirrored into the route.

### 7. What TanStack Query would replace

- The page's duplicated read of the account snapshot.
- The manual post-checkout refresh would become invalidation or refetch of the shared account query.
- `startCheckout()` could optionally become a mutation, but the main win is on the read side.

### 8. What TanStack Query would not replace

- `checkout` route search ownership
- redirecting to the checkout URL
- local `activityFilter`
- local `activePackId` pending state

### 9. Adoption priority

- Wave 1 because this page exposes the account duplication clearly and already needs explicit refresh behavior.

### 10. Suggested query keys / mutation boundaries

- Query key:
  - `["account", "snapshot"]`
- Optional mutation boundary:
  - `["billing", "checkout", packId]`
- On `checkout=success`, invalidate or refetch:
  - `["account", "snapshot"]`

## `frontend/src/features/account/Profile.tsx`

### 1. Current responsibilities

- Renders account identity details.
- Shows change-password UI.
- Triggers sign-out.

### 2. Current data flow

- Calls `useAccountData()` directly and consumes:
  - `authEmail`
  - `identities`
  - `profile`
  - `signOut`
- Owns local `error` state only for sign-out failure.
- Shows a skeleton until `profile` or `authEmail` becomes available.

### 3. Current fetch trigger

- Account snapshot fetch is triggered by this component's `useAccountData()` mount.
- Sign-out is triggered by the button, not by route state.

### 4. Current owned state

- Local state:
  - `error` for sign-out failure
- Hook-owned account state from another independent `useAccountData()` instance.

### 5. Current refresh / invalidation behavior

- None for reads in this file.
- `signOut()` clears the hook instance's local account fields and refreshes global auth state through `AuthStateProvider`.

### 6. Interaction with route/search state

- None.

### 7. What TanStack Query would replace

- The duplicated account snapshot read.
- The page would subscribe to the shared account query rather than own another mount fetch.

### 8. What TanStack Query would not replace

- `previewInitials()`
- local sign-out error UI
- sign-out side effects and router auth flow
- `ChangePasswordSection`

### 9. Adoption priority

- Wave 1 for the read side.
- Keep sign-out outside the first Query pass.

### 10. Suggested query keys / mutation boundaries

- Query key:
  - `["account", "snapshot"]`
- Keep sign-out as an imperative auth mutation for now.

## `frontend/src/features/voices/Voices.tsx`

### 1. Current responsibilities

- Renders the main voices list.
- Owns search, source filter, sort, favorites filter, and pagination UI.
- Handles voice delete, favorite toggle, rename, and preview playback.
- Mirrors local filter state back into route search.

### 2. Current data flow

- Reads validated initial route search from `voicesRoute.useSearch()`:
  - `search`
  - `source`
  - `page`
  - `sort`
  - `sort_dir`
  - `favorites`
- Seeds local state from those route values once:
  - `query`
  - `source`
  - `sort`
  - `sortDir`
  - `favorites`
  - `page`
- Debounces `query` with `useDebouncedValue(query, 250)`.
- `load()` builds `URLSearchParams` and fetches `/api/voices?...`.
- The response is stored in `data`.
- Mutations:
  - delete: `DELETE /api/voices/:id`
  - favorite: `PATCH /api/voices/:id/favorite`
  - rename: `PATCH /api/voices/:id/name`
- Playback uses `useWaveformListPlayer()` with local `playState` and `waveRefs`.

### 3. Current fetch trigger

- `useEffect([load])` calls `load()` whenever `debounced`, `page`, `source`, `sort`, `sortDir`, or `favorites` changes.
- Another effect resets `page` to `1` when filter inputs change.
- A cleanup effect aborts the last in-flight request on unmount.
- Mutations call `void load()` after success.

### 4. Current owned state

- Server-state-like:
  - `data`
  - `loading`
  - `error`
  - `loadAbortRef`
- Local UI state:
  - `query`
  - `source`
  - `sort`
  - `sortDir`
  - `favorites`
  - `page`
  - `busyDelete`
  - `busyFavorite`
  - `editingId`
  - `editName`
  - `busyRename`
  - `playState`
  - `waveRefs`

### 5. Current refresh / invalidation behavior

- No shared cache.
- Every successful delete, favorite toggle, and rename performs a fresh list load by calling `void load()`.
- There is no targeted invalidation between:
  - the paginated voices list here
  - the voice selector fetch in `Generate.tsx`
  - the voice filter fetch in `History.tsx`

### 6. Interaction with route/search state

- Route search is the URL contract, but after mount the component treats local state as the active owner and mirrors it back with `navigate({ search, replace: true })`.
- Query should not replace that route/search behavior.
- If Query is introduced here, the query key should follow the normalized filter state without taking over route ownership.

### 7. What TanStack Query would replace

- `load()`
- `loadAbortRef`
- `data/loading/error` ownership for the list read
- manual reloads after delete, favorite toggle, and rename
- overlapping voice read duplication with `Generate.tsx` and `History.tsx`

### 8. What TanStack Query would not replace

- Debounced search input state
- source/sort/favorites/page UI state
- route search synchronization
- rename inline editing state
- preview playback state

### 9. Adoption priority

- Wave 1, high priority.
- This file has the clearest "manual query client" pattern in the repo.

### 10. Suggested query keys / mutation boundaries

- Query keys:
  - `["voices", "list", { search: debounced.trim(), source, page, sort, sortDir, favorites, perPage: 20 }]`
  - `["voices", "options"]` for shared selector/filter consumers
- Mutation boundaries:
  - delete voice
  - toggle favorite
  - rename voice
- Invalidate after successful mutations:
  - matching `["voices", "list", ...]`
  - `["voices", "options"]`

## `frontend/src/features/history/History.tsx`

### 1. Current responsibilities

- Renders generation history.
- Owns search, status, voice filter, sort, pagination, delete, regenerate, playback, and download actions.
- Mirrors local filter state back into route search.
- Polls while active generations exist.

### 2. Current data flow

- Reads validated initial route search from `historyRoute.useSearch()`:
  - `search`
  - `status`
  - `page`
  - `sort`
  - `sort_dir`
  - `voice_id`
- Seeds local state from those values once.
- Fetches voice filter options separately on mount from `/api/voices?per_page=100`.
- `load()` builds `URLSearchParams` and fetches `/api/generations?...`.
- Stores the main list response in `data`.
- Stores voice filter options in `voiceItems`.
- Delete calls `DELETE /api/generations/:id`.
- Regenerate calls `POST /api/generations/:id/regenerate` and then navigates to `res.redirect_url`.
- Download resolves protected media URLs on demand.

### 3. Current fetch trigger

- Voice options fetch runs once in a mount-time `useEffect`.
- Main history fetch runs in `useEffect([load])`.
- Another effect resets `page` to `1` when `debounced`, `status`, `voiceId`, `sort`, or `sortDir` changes.
- Another effect mirrors local state into route search with `replace: true`.
- A polling effect starts `setInterval(() => void load(), 5000)` when any generation is `pending` or `processing`, and stops polling otherwise.

### 4. Current owned state

- Server-state-like:
  - `voiceItems`
  - `data`
  - `loading`
  - `error`
  - `loadAbortRef`
  - `refreshTimerRef`
- Local UI state:
  - `query`
  - `status`
  - `sort`
  - `sortDir`
  - `voiceId`
  - `page`
  - `playState`
  - `waveRefs`

### 5. Current refresh / invalidation behavior

- Voice filter options are "best effort"; errors are swallowed and no retry UI exists.
- The main list refreshes:
  - on mount
  - when filters/page change
  - every 5s while active rows exist
  - after delete
- There is no shared invalidation for overlapping voice data with `Voices.tsx` or `Generate.tsx`.

### 6. Interaction with route/search state

- Like `Voices.tsx`, route search seeds local filter state and then the component mirrors local state back into the route.
- Query should not replace search/status/voice/page ownership.
- The best Query fit is to key the list read off the normalized filter values already owned by the route/component boundary.

### 7. What TanStack Query would replace

- The mount-time voice options fetch
- `load()`
- `loadAbortRef`
- `refreshTimerRef`
- local `data/loading/error` ownership for the generations list
- manual reload after delete

### 8. What TanStack Query would not replace

- Search input debounce
- local filter selection state
- route search synchronization
- playback state
- download resolution
- regenerate navigation logic

### 9. Adoption priority

- Wave 1, high priority.
- This file has both overlapping reference-data fetches and manual polling.

### 10. Suggested query keys / mutation boundaries

- Query keys:
  - `["voices", "options"]`
  - `["generations", "list", { search: debounced.trim(), status, voiceId, page, sort, sortDir, perPage: 20 }]`
- Mutation boundaries:
  - delete generation
  - regenerate generation
- Regenerate can remain imperative if navigation dominates the UX.

## `frontend/src/features/generate/Generate.tsx`

### 1. Current responsibilities

- Renders the speech generation form.
- Loads voice options and languages.
- Restores form state from route search and `TaskProvider`.
- Starts generation jobs and reads tracked task results from `TaskProvider`.
- Resolves completed audio URLs for playback and download.

### 2. Current data flow

- Reads route search from `generateRoute.useSearch()`:
  - `voice`
  - `text`
  - `language`
  - `demo`
- Reads shared language metadata from `useLanguages()`.
- Fetches `/api/voices` once on mount and stores it in `voices`.
- Reads tracked tasks from `useTasks()`.
- One-time restore effect seeds local form state from:
  - latest tracked generate task `formState`
  - route search params
  - optional demo transcript fetched through `fetchTextUtf8()`
- `onGenerate()` posts `/api/generate`, then calls `startTask()` in `TaskProvider`.
- Completed selected tasks do not refetch through Query; they resolve `selectedTask.result.audio_url` through `resolveProtectedMediaUrl()`.

### 3. Current fetch trigger

- `/api/voices` is fetched once in a mount-time `useEffect`.
- The route search seed logic runs once behind `restoredRef`.
- Audio result resolution runs when the selected tracked task reaches a terminal state.

### 4. Current owned state

- Server-state-like:
  - `voices`
  - `loadingVoices`
- Local/client state:
  - `voiceId`
  - `language`
  - `text`
  - `isSubmitting`
  - `selectedTaskId`
  - `error`
  - `audioUrl`
  - `downloadUrl`
  - restore refs and submit guards
- Cross-page tracked task state comes from `TaskProvider`, not from direct component fetches.

### 5. Current refresh / invalidation behavior

- There is no refresh for `/api/voices` after mount.
- If voices change elsewhere, this page only sees new options on remount.
- `onGenerate()` does not invalidate voice data because the mutation creates a task, not new voice metadata.

### 6. Interaction with route/search state

- Route search is a one-time seed, not a continuously synchronized source of truth.
- After the restore effect runs once, local form state owns the live values.
- Query should not replace:
  - `voice`, `text`, `language`, or `demo` search params
  - task selection state

### 7. What TanStack Query would replace

- The mount-time `/api/voices` fetch
- `voices/loadingVoices` ownership
- duplicate voice-option fetching already also present in `History.tsx` and the list data already present in `Voices.tsx`

### 8. What TanStack Query would not replace

- Form state
- route-search seeding
- `TaskProvider` tracked-job state
- selected result audio state
- generate-job submission flow

### 9. Adoption priority

- Wave 1, but after the shared voice query shape is established by the voices/history work.

### 10. Suggested query keys / mutation boundaries

- Query keys:
  - `["voices", "options"]`
  - `["languages"]`
- Mutation boundaries:
  - none in this file for the first Query pass
- Keep generation job tracking outside Query for now.

## `frontend/src/features/tasks/Tasks.tsx`

### 1. Current responsibilities

- Renders the active job center.
- Owns the type filter, initial fetch, polling, load-more pagination, and cancel/dismiss actions.
- Displays backend task rows while also integrating with `TaskProvider` mutations.

### 2. Current data flow

- Local `typeFilter` drives `filterQuery`, which always includes:
  - `status=active`
  - `type=<typeFilter>`
  - `limit=25`
- Initial fetch effect requests `/api/tasks?${filterQuery}` and stores:
  - `tasks`
  - `nextBefore`
- Separate polling effect repeatedly refetches the same endpoint with `setTimeout`.
- `loadMore()` appends older tasks fetched with `before=${nextBefore}`.
- `onCancel()` uses `cancelTask()` from `TaskProvider`, then refetches the first page manually.
- `onDismiss()` uses `dismissTask()` from `TaskProvider`, then filters the removed task out of local `tasks`.

### 3. Current fetch trigger

- Initial list load on mount and whenever `typeFilter` changes.
- Recursive timeout polling every 5s while the page is visible.
- Retry-after-error polling every 10s if polling fails.
- Manual load-more when the button is pressed.
- Manual refetch after cancel.

### 4. Current owned state

- Server-state-like:
  - `tasks`
  - `loading`
  - `loadingMore`
  - `error`
  - `nextBefore`
- Local UI state:
  - `typeFilter`

### 5. Current refresh / invalidation behavior

- Initial load effect resets `loading` and `error`.
- Polling directly mutates `tasks` and `nextBefore`.
- `onCancel()` forces a first-page refetch after the provider mutation succeeds.
- `onDismiss()` does not refetch; it locally removes the row after the provider mutation succeeds.
- Polling is separate from `TaskProvider`'s per-task detail polling, so the page and provider can both hit task endpoints independently.

### 6. Interaction with route/search state

- None.
- `typeFilter` is local component state, not route-owned state.
- TanStack Query should not be used to replace the filter toggle itself.

### 7. What TanStack Query would replace

- Initial list fetch
- polling loop
- manual first-page refetch after cancel
- cursor-page bookkeeping for list pages
- `loading/loadingMore/error` ownership for the task list

### 8. What TanStack Query would not replace

- `typeFilter` UI state
- provider-owned task overlay semantics
- text formatting and row rendering

### 9. Adoption priority

- Later than languages/account/voices/history.
- Good Query fit, but the interaction with `TaskProvider` makes it a second-wave migration.

### 10. Suggested query keys / mutation boundaries

- Query keys:
  - `["tasks", "list", { status: "active", type: typeFilter, limit: 25 }]`
- Prefer an infinite query with `before` as the page cursor.
- Mutation boundaries:
  - cancel task
  - dismiss/clear task
- Any Query rollout here must coordinate with `TaskProvider` instead of pretending the provider does not exist.

## `frontend/src/app/TaskProvider.tsx`

### 1. Current responsibilities

- Maintains the global tracked-task overlay state.
- Persists task state to localStorage.
- Migrates legacy localStorage task keys.
- Polls `/api/tasks/:id` for non-terminal tracked tasks.
- Exposes helpers used by `Generate.tsx`, `Design.tsx`, the task dock, and the tasks page:
  - `startTask`
  - `dismissTask`
  - `cancelTask`
  - `clearTask`
  - selectors and status formatters

### 2. Current data flow

- Hydrates the reducer store from localStorage on mount.
- Syncs across tabs via the `storage` event.
- Prunes expired terminal tasks every 15 seconds.
- `startTask()` creates a local placeholder entry immediately.
- Another effect ensures every non-terminal stored task gets a `setInterval` polling loop.
- Each poll requests `/api/tasks/:id`, merges backend data into the local store, stops polling on terminal states, and removes missing tasks on `404`.
- `cancelTask()` posts `/api/tasks/:id/cancel` and optimistically marks the local task cancelled on success.
- `clearTask()` / `dismissTask()` remove the local task first and then issue `DELETE /api/tasks/:id`.

### 3. Current fetch trigger

- Per-task polling starts whenever a non-terminal task appears in the store.
- The first poll happens immediately, then every 3 seconds via `setInterval`.
- LocalStorage hydration happens on mount and on storage events.

### 4. Current owned state

- Reducer store:
  - `byId`
  - `orderedIds`
- Refs:
  - `stateRef`
  - `pollIntervalsRef`
  - `pollInFlightRef`
- Derived values exposed through context:
  - `tasks`
  - `tasksById`
  - `activeCount`

### 5. Current refresh / invalidation behavior

- Per-task polling is the refresh mechanism.
- `cancelTask()` updates local state optimistically and depends on later polling or page refresh to reconcile backend detail.
- `clearTask()` and `dismissTask()` are effectively mutation + local removal flows.
- No Query cache is involved.

### 6. Interaction with route/search state

- None directly.
- Consumers may seed their own local form state from tracked task `formState`, but the provider itself is route-agnostic.

### 7. What TanStack Query would replace

- In a later redesign, Query could replace or assist the `/api/tasks/:id` detail reads.
- It does not cleanly replace the provider as it exists today.

### 8. What TanStack Query would not replace

- localStorage persistence
- reducer-managed ordering and pruning
- cross-tab storage sync
- optimistic task visibility semantics
- `formState` persistence for restore flows
- task dock specific selectors and helpers

### 9. Adoption priority

- Not a first-wave Query target.
- Revisit only after the server-state surfaces above have moved to Query and the provider's client/server responsibilities are separated more cleanly.

### 10. Suggested query keys / mutation boundaries

- If revisited later:
  - `["tasks", "detail", taskId]`
- Mutation boundaries already exist conceptually:
  - cancel task
  - clear/dismiss task
- Do not start the Query rollout here.

## `frontend/src/app/auth/AuthStateProvider.tsx`

### 1. Current responsibilities

- Resolves the current auth session.
- Exposes `status`, `user`, `error`, and `refresh` through context.
- Protects against out-of-order refresh results with `requestIdRef`.

### 2. Current data flow

- `refresh()` calls `resolveAuthSnapshot()`.
- `resolveAuthSnapshot()` calls `getAuthSession()`.
- Successful results map to:
  - `loading`
  - `signed_out`
  - `signed_in`
- Failures become a signed-out snapshot with an error.

### 3. Current fetch trigger

- One mount-time `useEffect` calls `refresh()`.
- Consumers can call `refresh()` manually, for example after sign-out.

### 4. Current owned state

- `authState`
  - `status`
  - `user`
  - `error`
- `requestIdRef`

### 5. Current refresh / invalidation behavior

- Refresh is explicit and imperative.
- `App.tsx` invalidates the router when `authState.status !== "loading"`.
- No cache invalidation beyond that router integration.

### 6. Interaction with route/search state

- Indirect only.
- Route guards in `frontend/src/routes/_app/route.tsx` depend on this provider through router context.

### 7. What TanStack Query would replace

- Very little in practice.
- This is not one of the painful server-state duplication areas found in the current frontend.

### 8. What TanStack Query would not replace

- auth context
- auth gating semantics
- router invalidation integration
- signed-in vs signed-out app shell behavior

### 9. Adoption priority

- Do not migrate to Query now.

### 10. Suggested query keys / mutation boundaries

- None recommended for the current roadmap.

## `frontend/src/router.ts` and `frontend/src/app/App.tsx`

### 1. Current responsibilities

- `router.ts` creates the TanStack Router instance.
- `App.tsx` wires providers and passes `authState` into `RouterProvider`.
- `App.tsx` invalidates the router when auth settles so `beforeLoad` guards re-run.

### 2. Current data flow

- `router.ts` has no data fetching.
- `App.tsx` reads `authState` from `AuthStateProvider` and injects it into the router context.

### 3. Current fetch trigger

- None here.
- Router invalidation is triggered by auth status changes, not by a read request in these files.

### 4. Current owned state

- `router.ts`: none
- `App.tsx`: none beyond provider composition

### 5. Current refresh / invalidation behavior

- `App.tsx` calls `router.invalidate()` when `authState.status !== "loading"`.
- That refreshes route guards, not server data queries.

### 6. Interaction with route/search state

- This is the route boundary.
- `defaultPreload: "intent"` is already configured.

### 7. What TanStack Query would replace

- Nothing directly in these files.

### 8. What TanStack Query would not replace

- router creation
- router context injection
- route preloading
- auth-driven router invalidation

### 9. Adoption priority

- Not a Query target.

### 10. Suggested query keys / mutation boundaries

- None.

## `frontend/src/routes/_app/route.tsx`

### 1. Current responsibilities

- Owns the signed-in app shell.
- Redirects signed-out users in `beforeLoad`.
- Chooses shell fallback UI and renders `TaskDock`.

### 2. Current data flow

- Consumes `authState` from router context and `useAuthState()`.
- No server fetches are defined in this route file.

### 3. Current fetch trigger

- None in the route file.

### 4. Current owned state

- Local shell state:
  - `menuOpen`
- Derived route state:
  - current location
  - `navVariant`

### 5. Current refresh / invalidation behavior

- Relies on router invalidation from `App.tsx` so `beforeLoad` can re-run after auth changes.

### 6. Interaction with route/search state

- This file is the auth-guard boundary.
- It owns redirects, not data fetching.

### 7. What TanStack Query would replace

- Nothing here.

### 8. What TanStack Query would not replace

- `beforeLoad`
- auth redirect behavior
- shell composition
- `menuOpen` UI state

### 9. Adoption priority

- Not a Query target.

### 10. Suggested query keys / mutation boundaries

- None.

## `frontend/src/routes/_app/voices.tsx`

### 1. Current responsibilities

- Validates route search for the voices page.

### 2. Current data flow

- Defines the URL contract for:
  - `search`
  - `source`
  - `page`
  - `sort`
  - `sort_dir`
  - `favorites`
- Renders `VoicesPage`.

### 3. Current fetch trigger

- None in the route file.

### 4. Current owned state

- Search schema only.

### 5. Current refresh / invalidation behavior

- None.

### 6. Interaction with route/search state

- This file is the owner of the voices search-param contract.
- `Voices.tsx` reads from it and mirrors local UI state back into it.

### 7. What TanStack Query would replace

- Nothing in this file.

### 8. What TanStack Query would not replace

- `validateSearch`
- search-param defaults and typing

### 9. Adoption priority

- Keep outside Query.

### 10. Suggested query keys / mutation boundaries

- None in the route file itself.

## `frontend/src/routes/_app/history.tsx`

### 1. Current responsibilities

- Validates route search for the history page.

### 2. Current data flow

- Defines the URL contract for:
  - `search`
  - `status`
  - `page`
  - `sort`
  - `sort_dir`
  - `voice_id`
- Renders `HistoryPage`.

### 3. Current fetch trigger

- None in the route file.

### 4. Current owned state

- Search schema only.

### 5. Current refresh / invalidation behavior

- None.

### 6. Interaction with route/search state

- This file owns the search-param contract that `History.tsx` mirrors into and out of.

### 7. What TanStack Query would replace

- Nothing in this file.

### 8. What TanStack Query would not replace

- `validateSearch`
- URL-state typing and defaults

### 9. Adoption priority

- Keep outside Query.

### 10. Suggested query keys / mutation boundaries

- None in the route file itself.

## `frontend/src/routes/_app/generate.tsx`

### 1. Current responsibilities

- Validates route search for the generate page.

### 2. Current data flow

- Defines the URL contract for:
  - `voice`
  - `text`
  - `language`
  - `demo`
- Renders `GeneratePage`.

### 3. Current fetch trigger

- None in the route file.

### 4. Current owned state

- Search schema only.

### 5. Current refresh / invalidation behavior

- None.

### 6. Interaction with route/search state

- This file owns the seed values that `Generate.tsx` consumes once during restore.

### 7. What TanStack Query would replace

- Nothing in this file.

### 8. What TanStack Query would not replace

- route-owned search params
- route typing and defaults

### 9. Adoption priority

- Keep outside Query.

### 10. Suggested query keys / mutation boundaries

- None in the route file itself.

## `frontend/src/routes/_app/account/credits.tsx`

### 1. Current responsibilities

- Validates the account credits route search.

### 2. Current data flow

- Defines the URL contract for `checkout`.
- Renders `AccountCreditsPage`.

### 3. Current fetch trigger

- None in the route file.

### 4. Current owned state

- Search schema only.

### 5. Current refresh / invalidation behavior

- None in the route file.
- The consumer page reacts to the validated `checkout` value.

### 6. Interaction with route/search state

- This file is the source of truth for the `checkout` search param.
- `Credits.tsx` uses that param to decide whether to show a banner and refetch the account snapshot.

### 7. What TanStack Query would replace

- Nothing in this file.

### 8. What TanStack Query would not replace

- `checkout` search ownership
- route typing and defaults

### 9. Adoption priority

- Keep outside Query.

### 10. Suggested query keys / mutation boundaries

- None in the route file itself.

## Practical Rollout Order

1. Keep route/search ownership in TanStack Router exactly where it is now.
2. Introduce Query for `["languages"]`.
3. Introduce a shared `["account", "snapshot"]` query and remove duplicated account hook ownership from the layout and leaf pages.
4. Introduce shared voice queries:
   - list queries for `Voices.tsx`
   - options query reused by `History.tsx` and `Generate.tsx`
5. Move generations history reads to Query with conditional polling.
6. Move the tasks page list to Query later, after deciding how it should coordinate with `TaskProvider`.
7. Revisit `TaskProvider` only after the first-wave server-state surface is smaller.

## Bottom Line

TanStack Query is justified by the actual codebase today because the frontend now has:

- a hand-rolled shared cache for languages
- duplicated account snapshot ownership across layout and pages
- overlapping `/api/voices` reads across three features
- manual list orchestration with repeated `loading/error/data` state
- manual reload-after-mutation patterns
- polling loops for generations and task lists

The right move is a selective Query rollout focused on shared server state, while explicitly leaving route/search state, auth guards, local form state, and the current `TaskProvider` client-state overlay outside the first migration.
