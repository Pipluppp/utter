# Loading Skeleton Plan

## Triage answer

No, the loading skeleton pass is not done.

The March 7 plan is still accurate, and the codebase still shows multiple raw loading placeholders.

## Goal

Replace low-context loading text with layout-accurate skeleton states where the user is waiting for page structure or fetched content.

Do not replace explicit action-state feedback such as button spinners or progress labels for user-triggered work.

## Confirmed remaining work

### Global shell

- `frontend/src/app/Layout.tsx`
  - current: centered `Loading...`
  - target: route-family skeletons for marketing, app, and account surfaces

- `frontend/src/app/RequireAuth.tsx`
  - current: `Checking session...`
  - target: compact authenticated-page gate skeleton

- `frontend/src/app/TopBar.tsx`
  - current: `Checking session...`
  - target: nav skeleton chips that preserve header width and rhythm

### Marketing/app content

- `frontend/src/pages/About.tsx`
  - current: languages line falls back to raw loading text
  - target: small language-pill or text-line skeleton block

- `frontend/src/pages/Generate.tsx`
  - current: page waits on voices without a dedicated skeleton experience
  - target: form-row skeleton for voice picker and related controls while `/api/voices` is loading

### Account surfaces

- `frontend/src/pages/account/Overview.tsx`
  - current: balance uses `...`; trial and activity sections can imply empty state before data is loaded
  - target: full overview card skeleton with empty states hidden until `loading === false`

- `frontend/src/pages/account/Credits.tsx`
  - current: balance uses `...`; trial cards render `0` while still loading
  - target: credits header skeleton plus trial-card placeholders

- `frontend/src/pages/account/Profile.tsx`
  - current: email line uses `Loading...`
  - target: avatar and identity cluster skeleton

## Already correct and should stay as-is

- `frontend/src/pages/Voices.tsx`
- `frontend/src/pages/History.tsx`
- submit/progress states in `Auth`, `Clone`, and `Design`
- playback button `Loading...` labels in `Voices` and `History`

## Implementation plan

## Phase A: shared skeleton building blocks

Create route-level skeleton components using `frontend/src/components/ui/Skeleton.tsx`.

Recommended additions:

- `RouteMarketingSkeleton`
- `RouteAppSkeleton`
- `RouteAccountSkeleton`
- `AuthGateSkeleton`
- `HeaderPendingAuthSkeleton`

## Phase B: account-specific skeletons

Add page-shaped skeletons near the account feature files.

Recommended additions:

- `AccountOverviewSkeleton`
- `AccountCreditsSkeleton`
- `AccountProfileSkeleton`

## Phase C: page-specific states

- `AboutLanguagesSkeleton`
- `GenerateFormSkeleton`

The Generate page should keep the page frame visible while skeletonizing the data-dependent form region.

## Phase D: loading guards

Audit each page to prevent false empty states during first load.

Required rule:

- do not show "no activity", zero trial counts, or similar settled-state messaging until the initial request has completed

## Rollout order

1. `Layout`
2. `RequireAuth`
3. `TopBar`
4. account pages
5. `Generate`
6. `About`

## Acceptance criteria

1. No route transition shows only the word `Loading...`.
2. No auth gate shows only `Checking session...`.
3. Account pages do not show `...`, `Loading...`, or misleading zeros during initial fetch.
4. Generate no longer exposes a low-context wait state while voices are loading.
5. Existing Voices and History skeletons remain unchanged.

## Session checklist

- [ ] Add shared route-family skeleton components for marketing, app, and account shells
- [ ] Replace the generic `Layout` Suspense fallback
- [ ] Replace `RequireAuth` pending-auth text with a skeleton state
- [ ] Replace `TopBar` pending-auth text with a skeleton state
- [ ] Add account-specific skeletons for Overview, Credits, and Profile
- [ ] Add the Generate form loading skeleton
- [ ] Add the About languages skeleton
- [ ] Prevent false empty states and fake zeros during initial fetch

## Manual verification checklist

- [ ] Route transitions never show plain `Loading...`
- [ ] Auth-pending states never show plain `Checking session...`
- [ ] Account pages do not show `...`, `Loading...`, or zero trial values before data arrives
- [ ] Generate shows a real loading layout while voices load
- [ ] Voices and History pages still keep their existing skeleton behavior

## Repo workflow note

Implement this task in the main `utter/` repo directory on a dedicated branch from `main`.

Recommended branch:

- `feature/loading-skeletons`

After local verification:

- merge the branch into `main`
- delete the branch
- start the next task from a fresh branch off updated `main`

## Session prompt

```md
Work only on the frontend loading skeleton task for Utter.

Read:
- `AGENTS.md`
- `docs/2026-03-09/00-triage-and-branching.md`
- `docs/2026-03-09/03-loading-skeleton-plan.md`

Task:
- Replace raw loading placeholders with layout-accurate skeleton states across the routes listed in the plan.
- Keep action-state feedback like button loaders and explicit progress panels unchanged.
- Make sure account pages do not show misleading empty or zero states during initial fetch.

Constraints:
- Keep this session scoped to loading skeletons only.
- Assume implementation happens in the main `utter/` repo directory, on a dedicated branch off `main`.
- Do not start multi-job, pricing, legal, copy, or visual-language work in this session unless a tiny supporting change is unavoidable.
- Reuse the existing `Skeleton` component and preserve established page layouts.

Definition of done:
- The planned skeleton states are implemented.
- Relevant frontend checks are run where possible.
- The plan doc is updated with any deferred items.
- Summarize the exact manual QA steps I should do locally before moving to the next task in a new chat.
```
