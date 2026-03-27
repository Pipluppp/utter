# Frontend Follow-Up Order

Date: 2026-03-27

## Decision

TanStack Query is worth adding to this frontend, but not as the first move and not as a repo-wide rewrite.

The current TanStack Router migration already solved route ownership well:

- route/search state lives in `frontend/src/routes/*` via `validateSearch`
- auth redirects live in route `beforeLoad`
- route preloading is already enabled in `frontend/src/router.ts`

The remaining pain is in component-owned server state, not routing.

## Do First

Do the React logic/hooks cleanup first, but keep it narrow and low-churn:

- extract pure/shared logic that will survive any later data-layer change
- fix duplicated ownership, especially account data
- keep route/search state in route files
- avoid introducing new manual fetch abstractions that TanStack Query would replace immediately

## Then Introduce Query

After that cleanup lands, introduce TanStack Query selectively for shared server state.

First-wave targets:

- `frontend/src/features/shared/hooks.ts` for `/api/languages`
- `frontend/src/features/account/accountData.ts` and the account route consumers
- `frontend/src/features/voices/Voices.tsx`
- `frontend/src/features/history/History.tsx`
- `frontend/src/features/generate/Generate.tsx` voice options

Second-wave target:

- `frontend/src/features/tasks/Tasks.tsx`

Keep outside the first Query pass:

- `frontend/src/router.ts`
- `frontend/src/app/App.tsx`
- `frontend/src/routes/_app/route.tsx`
- route `validateSearch` files under `frontend/src/routes`
- `frontend/src/app/auth/AuthStateProvider.tsx`
- most of `frontend/src/app/TaskProvider.tsx`
- local form and playback state in `Clone.tsx`, `Design.tsx`, and `Generate.tsx`

## Avoid

Avoid these paths:

- Jotai/Bunshi as a replacement for server state
- moving route/search state out of `validateSearch`
- a broad "convert every hook to atoms" pass
- a new manual `usePaginatedList` abstraction right before a Query rollout
- forcing `TaskProvider` into TanStack Query before its client-state responsibilities are separated from server polling

## Recommended Order

1. React logic/hooks cleanup
2. TanStack Query introduction for shared server state
3. Selective Jotai/Bunshi follow-up, only if still needed

## Why This Order

React cleanup should go first because it reduces churn without locking the codebase into more ad hoc `useEffect` data loading patterns.

TanStack Query should go second because the current code now has concrete server-state pain points:

- module-level manual caching in `frontend/src/features/shared/hooks.ts`
- duplicated account snapshot ownership across `frontend/src/features/account/*`
- overlapping `/api/voices` fetches across Voices, History, and Generate
- manual reload-after-mutation patterns in Voices and History
- polling loops in History, Tasks, and TaskProvider

For the file-by-file current-flow audit and replacement map, see `tanstack-query-audit.md`.
