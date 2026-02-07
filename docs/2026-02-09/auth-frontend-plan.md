# Auth Frontend — Implementation Plan

## Supabase auth setup (current)

Auth is handled entirely through `@supabase/supabase-js` on the client side. The Supabase client is created in `frontend/src/lib/supabase.ts` — it reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from env vars and returns `null` when unconfigured (Vercel preview deploys without a backend still work). The client is configured with `persistSession: true`, `autoRefreshToken: true`, and `detectSessionInUrl: true` (needed for magic link token exchange on redirect).

Auth methods currently supported: password sign-in/sign-up (`signInWithPassword`, `signUp`) and magic link (`signInWithOtp`). No OAuth providers are configured yet. Email confirmations are off locally (`enable_confirmations = false` in `supabase/config.toml`) so password sign-ups are instant. Magic link sends to Inbucket on localhost.

The `RequireAuth` route guard checks `getSession()` on mount and subscribes to `onAuthStateChange` — it redirects unauthenticated users and reacts to sign-in/sign-out without a page reload. API calls in `frontend/src/lib/api.ts` attach the session's `access_token` as a Bearer token via `getSession()`.

All of this stays the same. This plan only changes how auth is presented to the user, not how it works.

## The problem

The current auth experience is functional but feels like an afterthought. Sign-in and sign-up live as card components buried inside `/account/auth`, the navbar always says "Account" regardless of auth state, and there's no standalone auth page with its own visual identity. This plan upgrades auth to a first-class experience.

## What's wrong now

The sign-in/sign-up form is a card inside the Account layout, sharing the page with the account sidebar nav (Auth, Profile, Credits, Billing). It feels like a settings page, not an entry point. The navbar shows "Account" whether you're signed in or out — there's no visual signal of auth state. Visiting a protected route while signed out redirects to `/account/auth?returnTo=...`, which loads the full account shell just to show a login form. On mobile the experience is worse — the account sidebar stacks vertically above the auth form, pushing it below the fold.

## What we want

**Standalone auth page at `/auth`** — a focused, full-width page with just the sign-in/sign-up form. No account sidebar, no distractions. This is the page `RequireAuth` redirects to. It should feel intentional, like a proper entry gate — not a subsection of settings.

**Adaptive navbar** — the navbar should reflect auth state:
- Signed out: show "Sign in" (links to `/auth`)
- Signed in: show the user's email or a truncated identifier, linking to `/account/profile`
- This applies to both desktop nav and mobile menu

**Clean separation between auth and account** — `/auth` is for getting in (sign-in, sign-up, magic link). `/account/*` is for managing your account once you're in (profile, usage, billing). The account layout no longer needs an "Auth" nav item — sign-out moves to the profile page or a small dropdown/button in the navbar.

## Implementation

### 1. Create a standalone auth route

Move the auth page out of the account layout. Create a new route at `/auth` that renders the auth form in a centered, minimal layout — no account sidebar, just the form vertically centered or near-top with generous whitespace. The form itself (password + magic link tabs, email/password fields) can be extracted from the current `Auth.tsx` mostly as-is, but rendered in its own page shell.

The page should show the UTTER wordmark/logo above the form for branding continuity. Below the form, a subtle link back to the landing page.

Route changes in `router.tsx`:
- Add `{ path: '/auth', element: <AuthPage /> }` as a public route (no `RequireAuth`)
- Remove `{ path: 'auth', element: <AccountAuthPage /> }` from the `/account` children
- Change the `/account` index redirect from `/account/auth` to `/account/profile`

Update `RequireAuth.tsx` to redirect to `/auth?returnTo=...` instead of `/account/auth?returnTo=...`.

### 2. Add auth state to the navbar

The `Layout.tsx` navbar needs to know whether the user is signed in. Create a small hook or context (or reuse the Supabase client directly) that exposes `{ isSignedIn, userEmail, signOut }`. This should subscribe to `onAuthStateChange` so it updates reactively.

In the desktop nav:
- Replace the static "Account" link with a conditional:
  - Signed out: `<NavItem to="/auth">Sign in</NavItem>`
  - Signed in: `<NavItem to="/account/profile">{truncatedEmail}</NavItem>` — truncate to first 12-15 chars or show just the local part before `@`
- The signed-in state could optionally include a small sign-out action (a secondary button or a click-away dropdown), but a simple link to profile is sufficient for v1 — the profile page has sign-out.

In the mobile nav: same conditional logic.

On the landing page nav: the "Account" link becomes "Sign in" or the truncated email, matching the app nav behavior.

### 3. Move sign-out to profile + navbar

Remove the sign-out UI from the auth page (it's weird to sign out from the sign-in page). Instead:
- Profile page (`/account/profile`) gets a "Sign out" button (it may already have one or the wiring for it)
- Optionally, the navbar's signed-in indicator could have a small sign-out action

### 4. Clean up the account layout

- Remove "Auth" from the `navItems` array in `AccountLayout.tsx`
- The account index redirect changes from `/account/auth` to `/account/profile`
- Since all `/account/*` sub-pages are for signed-in users, consider wrapping the `/account` route itself in `<RequireAuth>` in `router.tsx` (currently only the individual app pages are wrapped)

### 5. Polish the standalone auth page

The auth form itself is fine functionally. Visual improvements for the standalone page:
- Center the form in the viewport (not the account grid layout)
- Max width ~400px for the form container
- UTTER wordmark above the form
- The password/magic-link tab switcher should feel like a proper toggle, not two side-by-side buttons
- After successful sign-in, navigate to `returnTo` (already implemented)
- After successful sign-up with `enable_confirmations = false`, navigate immediately (already implemented)
- After successful sign-up with confirmations enabled, show a clear "check your email" message and the Inbucket link on localhost (already implemented)

## Files to change

| File | Change |
|------|--------|
| `frontend/src/pages/Auth.tsx` (new, top-level) | Standalone auth page with centered form |
| `frontend/src/pages/account/Auth.tsx` | Delete or keep as a redirect to `/auth` |
| `frontend/src/app/router.tsx` | Add `/auth` route, remove `/account/auth`, update account index redirect |
| `frontend/src/app/RequireAuth.tsx` | Redirect to `/auth` instead of `/account/auth` |
| `frontend/src/app/Layout.tsx` | Adaptive navbar with auth state (sign in vs email) |
| `frontend/src/pages/account/AccountLayout.tsx` | Remove "Auth" nav item |
| `frontend/src/pages/account/Profile.tsx` | Ensure sign-out button exists |

## Supabase auth constraints to respect

- The Supabase client can be `null` (env vars not set). Every component that touches auth must handle this — show a "not configured" message, not crash. The current `Auth.tsx` already does this with `isSupabaseConfigured()` and the auth hook/context should propagate this.
- `detectSessionInUrl: true` means the magic link redirect back to the app (with `#access_token=...` in the URL hash) is handled automatically by the Supabase client. The standalone `/auth` page doesn't need to do anything special for this — just make sure it's rendered under the same `RouterProvider` so the client can intercept the hash on any page load.
- `onAuthStateChange` is the single source of truth for reactive auth state. The navbar hook and `RequireAuth` should both subscribe to it rather than polling `getSession()`. The current `RequireAuth` already does this correctly.
- The `emailRedirectTo` option in `signUp` and `signInWithOtp` must point to an allowed URL. Locally this is handled by `site_url` + `additional_redirect_urls` in `config.toml`. For production Vercel deploys, the Supabase dashboard's redirect allowlist must include the Vercel domain — but that's a Phase 10 concern, not this plan.

## What this does NOT include

- OAuth / social sign-in (Google, GitHub, etc.) — future work, would add buttons to the standalone auth page
- Avatar / profile picture in the navbar — future work
- Animated transitions between sign-in and sign-up — unnecessary complexity
- A separate sign-up page vs sign-in page — the tab switcher within one page is fine
- Changes to the Supabase client configuration or auth methods — this is purely a frontend presentation change
