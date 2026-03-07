# Landing/App Navigation State Plan

## Goal

Make the top-level Utter navigation deterministic and easy to reason about for both visitors and signed-in users.

This work should ensure:

1. The Utter logo always returns to the landing page at `/`.
2. The landing page remains the canonical information surface for visitors and members.
3. The top bar adapts intentionally based on page family and auth state, not pathname heuristics.
4. Landing-page links into app features behave predictably for signed-out and signed-in users.
5. Protected app routes never briefly expose the wrong top bar while auth is still resolving.

## Desired Product Behavior

### Canonical surfaces

- `Marketing surface`: `/`, `/about`, `/privacy`, `/terms`
- `Auth surface`: `/auth`
- `App surface`: `/clone`, `/generate`, `/design`, `/voices`, `/history`, `/account/*`

### Navigation behavior by state

| Page family | Session state | Top bar behavior |
| --- | --- | --- |
| Marketing | Signed out | Show marketing nav: `Demo`, `Features`, `Pricing`, `About`, `Sign in` |
| Marketing | Signed in | Show member nav: `Clone`, `Generate`, `Design`, `Voices`, `History`, plus utility links `Pricing`, `About`, `Account` |
| App | Signed in | Show app nav: `Clone`, `Generate`, `Design`, `Voices`, `History`, `Account` |
| App | Unknown or signed out | Show a minimal or neutral header while auth resolves, then redirect to `/auth` |
| Auth | Any | Show minimal auth header only: logo + `Back to home` |

### Entry and redirect rules

1. Clicking the logo always goes to `/`.
2. Marketing feature CTAs should open the requested app feature immediately for signed-in users.
3. Marketing feature CTAs should send signed-out users to `/auth?returnTo=<target>` before entering the feature.
4. Generic `Sign in` from the header should not silently default to `/clone`; it should return to the current page or `/`.
5. Keyboard shortcuts for `c`, `g`, and `d` should only work inside the authenticated app surface.

## Current Ground Truth

### Route structure

- The SPA uses a single shared layout for all routes in `frontend/src/app/router.tsx`.
- `/` renders the landing page.
- `/clone`, `/generate`, `/design`, `/voices`, `/history`, and `/account/*` are protected with `RequireAuth`.
- `/auth` is public and full-screen, but still lives under the same top-level layout tree.

Relevant files:

- `frontend/src/app/router.tsx`
- `frontend/src/app/Layout.tsx`
- `frontend/src/app/RequireAuth.tsx`
- `frontend/src/pages/Auth.tsx`

### Current top-bar decision logic

- `Layout` decides whether to show the marketing nav or app nav by checking the current pathname against `APP_PATHS` and `/account`.
- This means nav mode is currently derived from the URL shape, not from explicit route intent.
- The logo already links to `/`, which matches the desired home behavior.

Relevant file:

- `frontend/src/app/Layout.tsx`

### Current auth-state mismatch

- `Layout` sets `isLoggedIn` from `supabase.auth.getSession()` and `onAuthStateChange`.
- `RequireAuth` performs a separate, stricter check using `getSession()` and `getUser()`.
- Because these checks are separate, the header can believe the user is signed in while a protected route still rejects them.
- This mismatch also means nav state and route access are not using the same source of truth.

Relevant files:

- `frontend/src/app/Layout.tsx`
- `frontend/src/app/RequireAuth.tsx`

### Current landing-page app entry behavior

- The hero CTA links directly to `/clone`.
- The Features section links directly to `/clone` and `/generate`.
- Signed-out users therefore hit a protected route first and only then get bounced to `/auth`.
- This is functional, but it leaks app-route state into the shell and contributes to the confusing top-bar behavior.

Relevant files:

- `frontend/src/pages/landing/LandingHero.tsx`
- `frontend/src/pages/landing/FeaturesSection.tsx`

### Current shortcut behavior

- `useGlobalShortcuts()` is mounted from the shared layout, so `c`, `g`, and `d` are active everywhere.
- A visitor on the landing page, About page, or auth page can therefore navigate into protected app routes even before signing in.

Relevant file:

- `frontend/src/app/useGlobalShortcuts.ts`

### Current auth default destination

- `/auth` currently defaults `safeReturnTo` to `/clone` when `returnTo` is missing.
- That makes generic sign-in behave like an app-entry redirect instead of a neutral auth action.

Relevant file:

- `frontend/src/pages/Auth.tsx`

## Root Cause Summary

1. Shell state is inferred from path strings instead of explicit route metadata.
2. Auth state is duplicated across `Layout` and `RequireAuth`.
3. Marketing entrypoints rely on protected-route redirects instead of deliberate pre-auth routing.
4. Generic sign-in is biased toward `/clone`, which makes landing vs app ownership feel muddled.
5. App keyboard shortcuts are active outside the authenticated app surface.

## Recommended Architecture

## Keep the current public URLs

Do not introduce an `/app/*` migration in this phase.

The current problems are caused by shell-state ownership and auth-gating behavior, not by the route names themselves. Fixing the navigation model first is lower-risk and avoids unnecessary URL churn.

## Introduce explicit shell families

Refactor routing so each route belongs to one of three explicit shell families:

1. `marketing`
2. `auth`
3. `app`

There are two acceptable implementations:

1. Use React Router route `handle` metadata and read it with `useMatches()`.
2. Split the router into nested shell groups, for example a marketing shell group, an auth route, and an app shell group.

Either approach is acceptable. The important rule is that the header must stop inferring its mode from raw pathname checks.

## Unify auth state behind one source of truth

Create a shared auth-state layer that exposes:

- `status: 'loading' | 'signed_out' | 'signed_in'`
- `session`
- `user`

This shared layer should be consumed by:

1. The top bar
2. `RequireAuth`
3. Marketing entry links
4. Any member-only keyboard shortcuts

Implementation note:

- Follow the repo guideline on tight error handling.
- Do not keep the current broad `.catch(() => defaultValue)` behavior.
- Unexpected auth failures should become explicit error states or logged failures, not silent success-shaped fallbacks.

## Separate shell choice from nav variant

The route family and the session state should combine into a nav variant:

- `marketing_public`
- `marketing_member`
- `app_member`
- `auth_minimal`
- `app_pending_auth`

This lets the landing page at `/` remain a marketing page while still showing member shortcuts when a user is signed in.

## Implementation Plan

### Phase 1: Make route ownership explicit

1. Refactor `frontend/src/app/router.tsx` so each route declares whether it belongs to the marketing, auth, or app surface.
2. Remove the `APP_PATHS` set and `pathname.startsWith('/account')` heuristic from `Layout`.
3. Replace the current one-size-fits-all nav decision with route-family-driven rendering.

Recommended outcome:

- marketing routes know they are marketing routes
- app routes know they are app routes
- `/auth` is treated as a dedicated auth surface

### Phase 2: Centralize auth session state

1. Introduce a shared auth hook or provider, for example `useAuthState()` or `AuthStateProvider`.
2. Move session resolution and subscription logic into that shared layer.
3. Update `RequireAuth` to use the shared status instead of maintaining its own parallel session state.
4. Update the top bar and account CTA to use the same shared status.

Required behavior:

- app nav renders only after auth is confirmed
- signed-out users never see the app shell merely because the pathname is an app route
- stale local sessions do not count as authenticated if server-side user validation fails

### Phase 3: Split the top bar into intentional variants

Create a dedicated top-bar component that accepts a nav variant instead of deriving everything internally.

Recommended desktop behavior:

- `marketing_public`: `Demo`, `Features`, `Pricing`, divider, `About`, `Sign in`
- `marketing_member`: `Clone`, `Generate`, `Design`, divider, `Voices`, `History`, divider, `Pricing`, `About`, `Account`
- `app_member`: `Clone`, `Generate`, `Design`, divider, `Voices`, `History`, divider, `Account`
- `auth_minimal`: logo + `Back to home`
- `app_pending_auth`: logo + neutral placeholder or loading state, no app shortcuts

Mobile behavior should mirror the same state model exactly. The menu content must not diverge from the desktop rules.

### Phase 4: Replace raw app CTAs on the landing page

Introduce a shared component for landing-to-app links, for example `FeatureEntryLink`.

Its behavior should be:

1. If `signed_in`, navigate directly to the requested app route.
2. If `signed_out`, navigate to `/auth?returnTo=<requested-route>`.
3. If auth is still `loading`, either temporarily disable the CTA or route through auth without ever rendering app nav first.

Use this shared behavior in:

- `frontend/src/pages/landing/LandingHero.tsx`
- `frontend/src/pages/landing/FeaturesSection.tsx`
- any future landing-page CTAs that open app features

This keeps the landing page informative while making feature access deliberate and predictable.

### Phase 5: Fix generic auth return behavior

Change `/auth` fallback behavior so missing `returnTo` no longer defaults to `/clone`.

Recommended rule:

1. If `returnTo` exists and is safe, use it.
2. Otherwise default to `/`.

This preserves the landing page as canonical home and avoids generic sign-in jumping the user into an arbitrary app feature.

Intentional feature-entry CTAs can still pass `returnTo=/clone`, `/generate`, or `/design` when appropriate.

### Phase 6: Restrict global shortcuts to the app surface

Move `useGlobalShortcuts()` out of the shared layout or gate it on both:

1. route family === `app`
2. auth status === `signed_in`

This removes one of the easiest ways for visitors to land on protected app paths and see inconsistent shell state.

### Phase 7: Align footer and secondary navigation

Review footer and any remaining top-level links so they follow the same mental model:

- `Pricing` should always return to the landing pricing section or pricing content
- `Account` should be member-oriented and can continue to rely on auth protection
- no footer or utility link should accidentally imply that `/account` is public

This phase is mostly cleanup, but it should be done in the same change set so the overall navigation model feels coherent.

## Suggested Files to Modify

| File | Purpose |
| --- | --- |
| `frontend/src/app/router.tsx` | Add explicit shell ownership to routes |
| `frontend/src/app/Layout.tsx` | Remove pathname heuristic and render by nav variant |
| `frontend/src/app/RequireAuth.tsx` | Consume shared auth-state source of truth |
| `frontend/src/app/useGlobalShortcuts.ts` | Restrict shortcuts to authenticated app usage |
| `frontend/src/pages/Auth.tsx` | Change default `returnTo` behavior and align auth redirects |
| `frontend/src/pages/landing/LandingHero.tsx` | Replace raw `/clone` CTA with shared feature-entry behavior |
| `frontend/src/pages/landing/FeaturesSection.tsx` | Replace raw app links with shared feature-entry behavior |
| `frontend/src/app/Footer.tsx` | Align secondary navigation with the new state model |

Likely new files:

| File | Purpose |
| --- | --- |
| `frontend/src/app/auth/useAuthState.ts` or similar | Shared validated auth-state hook/provider |
| `frontend/src/app/navigation/TopBar.tsx` or similar | Explicit nav-variant renderer |
| `frontend/src/app/navigation/FeatureEntryLink.tsx` or similar | Shared landing-to-app CTA logic |

## Out of Scope

1. Renaming feature routes to `/app/*`.
2. Redesigning the visual style of the landing page or app pages.
3. Backend API changes.
4. Changes to the actual clone/generate/design/voices/history page internals beyond navigation entry behavior.

## Testing Matrix

The implementation should be validated against this matrix.

### Marketing surface

1. Signed-out user visits `/` and sees the marketing nav only.
2. Signed-in user visits `/` and sees member app shortcuts in the top bar.
3. Logo click from `/clone`, `/generate`, `/history`, `/account`, and `/auth` always returns to `/`.
4. `Demo`, `Features`, and `Pricing` hash links still scroll correctly on the landing page.

### App entry behavior

1. Signed-out user clicks hero CTA for clone and lands on `/auth?returnTo=/clone`.
2. Signed-out user clicks feature CTA for generate and lands on `/auth?returnTo=/generate`.
3. Signed-in user clicks the same CTAs and lands directly on the requested app page.
4. Signed-in user on `/` can use the member nav to enter any app surface without unexpected redirects.

### Protected-route behavior

1. Signed-out user manually visits `/clone` and never sees the authenticated app nav before redirect.
2. Signed-out user manually visits `/history` and never sees the authenticated app nav before redirect.
3. Stale or invalid local session does not leave the top bar in a signed-in state.

### Auth behavior

1. Generic header sign-in from `/` returns to `/` after successful auth unless a feature-specific `returnTo` was requested.
2. Feature-targeted auth still returns to the requested feature.
3. Already signed-in users opening `/auth` are redirected predictably without nav flicker.

### Shortcut behavior

1. `c`, `g`, and `d` work on authenticated app pages.
2. `c`, `g`, and `d` do not route visitors from landing/auth/about into protected pages.

### Mobile behavior

1. Mobile menu content matches the same nav variant rules as desktop.
2. Signed-out mobile users do not see feature links in the menu unless product explicitly wants pre-auth feature entry links that go through `/auth`.

## Acceptance Criteria

1. The shell no longer decides between marketing and app nav by inspecting pathname strings.
2. There is a single auth-state source of truth for header rendering and protected-route gating.
3. The landing page is still the canonical home surface for both visitors and signed-in users.
4. Logged-in users see app-feature navigation from the landing surface.
5. Signed-out users can discover app features from the landing page without briefly entering the app shell first.
6. Keyboard shortcuts no longer create a bypass into the wrong shell state.
7. Desktop and mobile navigation follow the same state model.

## Risks and Notes

1. The existing `Layout` and `RequireAuth` logic both contain silent catch-based fallbacks that should be removed carefully to stay consistent with repo guidance.
2. If the product later decides it wants a dedicated member dashboard, that can be added after this cleanup. It is not required to fix the current navigation confusion.
3. The key success condition is not visual polish; it is explicit ownership of route family, auth state, and entry-link behavior.
