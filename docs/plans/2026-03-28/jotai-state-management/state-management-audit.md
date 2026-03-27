# State Management Audit

Date: 2026-03-27

This audit is now post-TanStack Router and should be read together with `tanstack-query-audit.md`.

The key boundary is:

- TanStack Router owns route/search state
- TanStack Query should own shared server state
- Jotai/Bunshi should only be considered for remaining client/app state

## Current State Split

### Route/Search State

This is already in the right place:

- `frontend/src/routes/_app/voices.tsx`
- `frontend/src/routes/_app/history.tsx`
- `frontend/src/routes/_app/generate.tsx`
- `frontend/src/routes/_app/clone.tsx`
- `frontend/src/routes/_app/account/credits.tsx`
- `frontend/src/routes/_auth/auth.tsx`

Do not move this into atoms.

### Shared Server State

These are the strongest Query candidates:

1. `frontend/src/features/shared/hooks.ts`
   `useLanguages()` uses module-level cache and in-flight dedup for `/api/languages`.

2. `frontend/src/features/account/accountData.ts`
   `useAccountData()` fetches `/api/me`, `/api/credits/usage`, and auth session data, but each caller owns its own fetch lifecycle.

3. `frontend/src/features/voices/Voices.tsx`
   Manual list fetching, manual invalidation after rename/delete/favorite mutations.

4. `frontend/src/features/history/History.tsx`
   Manual list fetching, separate voice-options fetch, manual polling when active generations exist.

5. `frontend/src/features/generate/Generate.tsx`
   Mount-time `/api/voices` fetch for the voice picker.

6. `frontend/src/features/tasks/Tasks.tsx`
   Manual list fetch, polling, pagination, and refresh after mutations.

### Client/App State

These are not Query problems:

1. `frontend/src/features/clone/Clone.tsx`
   Form state, recording state, audio refs, modal state.

2. `frontend/src/features/design/Design.tsx`
   Form state, selected preview UI state, object URL lifecycle.

3. `frontend/src/features/generate/Generate.tsx`
   Form state, selected tracked task, result selection state.

4. `frontend/src/app/theme/ThemeProvider.tsx`
   Local preference plus DOM side effects.

5. `frontend/src/app/auth/AuthStateProvider.tsx`
   Auth session snapshot used by router guards. This can stay as-is for now.

6. `frontend/src/app/TaskProvider.tsx`
   Hybrid localStorage-backed task overlay plus per-task polling.

## Jotai/Bunshi Fit After The Router Migration

Jotai is no longer the next step for most of the frontend.

Stronger Jotai candidates later:

- `frontend/src/app/TaskProvider.tsx`, if the dock/task overlay remains global and needs finer-grained subscriptions
- `frontend/src/app/theme/ThemeProvider.tsx`, if removing the provider is worth the churn

Weaker candidates now:

- auth session state
- feature form state
- route search state

Bad candidates:

- languages
- account snapshot
- voices list data
- history data
- tasks page server list

Those are shared server-state concerns and belong on the TanStack Query side of the boundary.

## Bunshi Decision

Bunshi is not justified right now.

The current app does not have a strong need for scoped dependency injection:

- theme is global
- auth is global
- task dock state is global
- route/search state is already handled by TanStack Router

If a future task-store rewrite needs scoping or injectable atom graphs, reevaluate then. It should not be part of the current frontend follow-up order.

## Updated Recommendation

1. Do not start with a Jotai/Bunshi migration.
2. Move shared server state to TanStack Query first.
3. Reassess what client/app state is still painful after that.

The likely result is a much smaller Jotai scope than earlier planning assumed.
