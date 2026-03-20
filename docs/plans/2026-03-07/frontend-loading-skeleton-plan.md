# Frontend Loading Skeleton Plan

## Goal

Replace low-context text placeholders like `Loading...`, `Checking session...`, and `...` with shape-accurate skeleton states where the user is waiting for page structure or fetched content.

The target is better perceived performance without replacing action-state feedback that is already correctly modeled as a button spinner or progress panel.

## Current Frontend Route Map

### Marketing routes

- `/` -> `frontend/src/pages/Landing.tsx`
- `/about` -> `frontend/src/pages/About.tsx`
- `/privacy` -> `frontend/src/pages/Privacy.tsx`
- `/terms` -> `frontend/src/pages/Terms.tsx`
- `/auth` -> `frontend/src/pages/Auth.tsx`

### App routes

- `/clone` -> `frontend/src/pages/Clone.tsx`
- `/generate` -> `frontend/src/pages/Generate.tsx`
- `/design` -> `frontend/src/pages/Design.tsx`
- `/voices` -> `frontend/src/pages/Voices.tsx`
- `/history` -> `frontend/src/pages/History.tsx`
- `/account` -> `frontend/src/pages/account/AccountLayout.tsx`
- `/account/profile` -> `frontend/src/pages/account/Profile.tsx`
- `/account/credits` -> `frontend/src/pages/account/Credits.tsx`

## Existing Loading Inventory

| Surface | File | Current UI | UX Type | Recommendation |
| --- | --- | --- | --- | --- |
| Global lazy route fallback | `frontend/src/app/Layout.tsx` | Centered `Loading...` | Full-page shell wait | Replace with route-aware page skeletons. |
| Auth-protected route gate | `frontend/src/app/RequireAuth.tsx` | `Checking session...` | App-entry blocking state | Replace with compact authenticated-page skeleton. |
| Top nav during pending auth | `frontend/src/app/TopBar.tsx` | `Checking session...` | Header-only blocking state | Replace with nav-width skeleton chips so the header layout stays stable. |
| About languages section | `frontend/src/pages/About.tsx` | Inline `Loading...` | Small content fragment | Replace with 2-3 line/chip skeletons in the languages block. |
| Generate voice selector | `frontend/src/pages/Generate.tsx` | First option says `Loading...` | Form data dependency | Replace with skeletonized form rows for the selector area, not text inside the `select`. |
| Account overview balance | `frontend/src/pages/account/Overview.tsx` | `...` | Key metric loading | Replace with section skeleton; also suppress empty-state activity copy until data exists. |
| Account credits balance | `frontend/src/pages/account/Credits.tsx` | `...` | Key metric loading | Replace with credits-page skeleton; do not render zero-valued trial cards/activity/rate-card while loading. |
| Account profile identity | `frontend/src/pages/account/Profile.tsx` | `Loading...` email text | Identity loading | Replace with avatar/name/email skeleton cluster. |
| Voices page initial list | `frontend/src/pages/Voices.tsx` | `VoicesSkeleton` | Page list loading | Keep. This is already the right pattern. |
| History page initial list | `frontend/src/pages/History.tsx` | `HistorySkeleton` | Page list loading | Keep. This is already the right pattern. |
| Voice preview button | `frontend/src/pages/Voices.tsx` | Button label `Loading...` | User-triggered action | Keep as button-level loading state, not a skeleton. |
| History playback button | `frontend/src/pages/History.tsx` | Button label `Loading...` | User-triggered action | Keep as button-level loading state, not a skeleton. |
| Auth submit state | `frontend/src/pages/Auth.tsx` | Button spinner + status label | Form submit action | Keep. Skeletons are not appropriate here. |
| Clone transcribe/submit state | `frontend/src/pages/Clone.tsx` | Button/progress text | User-triggered action | Keep. Skeletons are not appropriate here. |
| Design preview/save state | `frontend/src/pages/Design.tsx` | Button/progress text | User-triggered action | Keep. Skeletons are not appropriate here. |

## Pages That Benefit Most

### 1. Global route transitions

The current `Suspense` fallback in `frontend/src/app/Layout.tsx` shows a generic centered word. This is the most obvious low-quality loading state because it appears for every lazy route import.

Recommended replacement:

- add a small set of route-family skeletons, not one universal block
- marketing skeleton: title, lead paragraph, 2-3 content cards
- app skeleton: page title, form or list header, content panels
- account skeleton: heading, tab row, hero metric card, list rows

### 2. Account routes

The account area has the highest mismatch between loaded and loading states.

Current problems:

- `Overview` and `Credits` show `...` for the balance
- trial counters fall back to `0` while data is still loading
- activity sections can render empty-state messaging before the real request completes
- `Profile` shows a literal `Loading...` string for email while the rest of the identity card is already visible

Recommended replacement:

- gate the major account sections on `loading`
- render page-shaped skeleton cards for overview, credits, and profile
- only show empty states when `loading === false`

This should be the highest-priority page-level improvement after the global route fallback.

### 3. Generate page

`Generate` currently pushes the loading state down into the first `option` of the voice selector. That leaves the rest of the form visible but partially unusable and makes the loading state feel like a bug in the dropdown instead of an intentional wait state.

Recommended replacement:

- render a short form skeleton while voices are loading
- keep the page title and explanatory copy visible
- replace the voice row and, if needed, the submit area with skeleton blocks until `/api/voices` resolves

### 4. About page

The languages list is small, but the current inline `Loading...` is still a plain-text placeholder in an otherwise polished card layout.

Recommended replacement:

- keep the static page content rendered
- replace only the languages paragraph with a few short skeleton lines or language-pill placeholders

## Existing Good References

`frontend/src/pages/Voices.tsx` and `frontend/src/pages/History.tsx` already use purpose-built skeleton cards backed by `frontend/src/components/ui/Skeleton.tsx`.

These two pages should be treated as the reference pattern for:

- matching the final layout closely
- preserving spacing so the page does not jump after hydration/fetch
- loading only the content area that is actually waiting on data

## Recommended Implementation Shape

### Shared pieces

- keep using `frontend/src/components/ui/Skeleton.tsx`
- add route-level skeleton components near the app shell or under `frontend/src/components/ui/`
- add account-specific skeleton components under `frontend/src/pages/account/`

### Candidate components

- `RoutePageSkeleton`
- `AuthGateSkeleton`
- `GenerateFormSkeleton`
- `AboutLanguagesSkeleton`
- `AccountOverviewSkeleton`
- `AccountCreditsSkeleton`
- `AccountProfileSkeleton`

## Rollout Order

1. Replace the generic `Layout` `Suspense` fallback with route-aware skeletons.
2. Replace pending-auth text in `RequireAuth` and `TopBar`.
3. Add account page skeletons and stop rendering account empty states during initial load.
4. Add a dedicated generate-form skeleton instead of the `Loading...` select option.
5. Add the small inline skeleton for `About`.

## Non-Goals

Do not convert these to skeletons:

- playback button `Loading...` states in `Voices` and `History`
- auth submit states in `Auth`
- transcribing/cloning/progress states in `Clone`
- preview/save progress states in `Design`

Those are user-triggered operations with explicit progress semantics. Button loaders and progress panels are the correct treatment there.

## Acceptance Criteria

1. No full-page lazy route fallback shows only the word `Loading...`.
2. No account page shows `...`, `Loading...`, or misleading zero/empty content during initial data fetch.
3. `Generate` no longer exposes loading as a fake dropdown option.
4. `About` no longer shows a raw inline `Loading...` string for languages.
5. Existing `Voices` and `History` skeleton behavior remains intact.
