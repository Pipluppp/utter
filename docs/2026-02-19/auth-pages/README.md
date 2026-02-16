# Standalone Auth Pages

Status: `Planned`
Owner: `Frontend`
Priority: `P1`

---

## Problem

Auth currently lives at `/account/auth` as a sub-panel inside the Account layout with a sidebar nav. This has several UX issues:

- Users land on a settings-style page when they just want to sign in — it feels buried
- The account sidebar (Auth, Profile, Credits, Billing) is visible before the user is even authenticated
- Sign in and sign up share the same form with toggle buttons, making the intent unclear
- The "Session" card showing signed-in/out status adds clutter to what should be a focused flow
- `RequireAuth` redirects to `/account/auth?returnTo=...` which feels like an internal tool, not a product

---

## Objective

Create dedicated `/login` and `/signup` pages that are standalone, centered, and feel like the front door to the app. Keep the existing auth logic (Supabase signInWithPassword, signUp, magic link) but present it in a focused single-purpose layout.

---

## Scope

In:
- New `/login` route and page component
- New `/signup` route and page component
- Update `RequireAuth` to redirect to `/login` instead of `/account/auth`
- Remove `auth` from the Account sidebar nav (keep Profile, Credits, Billing)
- Redirect `/account/auth` to `/login` for any bookmarks/links
- Sign-out remains available from the Account section or nav

Out:
- OAuth providers (Google, GitHub, etc.) — future work
- Password reset flow — future work
- Changes to the Account layout beyond removing the auth nav item

---

## Current state

| Route | Purpose |
|---|---|
| `/account/auth` | Combined sign-in, sign-up, magic link, session status, sign-out |
| `/account/profile` | Profile editing (RequireAuth) |
| `/account/usage` | Credits (RequireAuth) |
| `/account/billing` | Billing (RequireAuth) |

Auth page is rendered inside `AccountLayoutPage` which provides a sidebar + outlet grid.

---

## Target state

| Route | Purpose |
|---|---|
| `/login` | Focused sign-in page (password + magic link) |
| `/signup` | Focused sign-up page (password) |
| `/account` | Redirects to `/account/profile` (RequireAuth) |
| `/account/profile` | Profile editing + sign-out button |
| `/account/usage` | Credits |
| `/account/billing` | Billing |

---

## Design direction

### Layout
- Standalone pages — no sidebar, no app nav (or minimal nav with logo + back link)
- Centered card on the page, vertically offset slightly above center
- App logo/wordmark at the top of the card as the brand anchor

### Login page (`/login`)
- Email + password fields
- "Sign in" primary button
- "Or sign in with magic link" secondary option (collapsible or toggle)
- Link to `/signup`: "Don't have an account? Sign up"
- `returnTo` query param preserved from `RequireAuth` redirect

### Signup page (`/signup`)
- Email + password fields
- "Create account" primary button
- Link to `/login`: "Already have an account? Sign in"
- `returnTo` query param preserved
- Success state: "Check your email to confirm" message

### Shared behavior
- Form submits on Enter
- Loading/disabled state during API call
- Error messages inline below the form
- Auto-redirect to `returnTo` (or `/clone`) on successful auth
- If already signed in, redirect immediately to `returnTo`

---

## Implementation plan

### 1. Create LoginPage component
- New file: `frontend/src/pages/auth/LoginPage.tsx`
- Standalone layout (no Account sidebar)
- Email + password form with sign-in logic from current `Auth.tsx`
- Magic link option
- Link to signup
- `returnTo` handling

### 2. Create SignupPage component
- New file: `frontend/src/pages/auth/SignupPage.tsx`
- Standalone layout matching LoginPage
- Email + password form with sign-up logic
- Link to login
- `returnTo` handling
- Email confirmation messaging

### 3. Update router
- Add `/login` route → `LoginPage`
- Add `/signup` route → `SignupPage`
- Change `/account` index redirect from `/account/auth` to `/account/profile`
- Add redirect: `/account/auth` → `/login`
- Protect `/account/profile` with `RequireAuth` (if not already)

### 4. Update RequireAuth
- Change redirect target from `/account/auth` to `/login`

### 5. Clean up Account section
- Remove "Auth" item from `AccountLayout` sidebar nav
- Ensure sign-out is accessible from Profile page or a nav element
- Update the Account layout description text (remove "will be wired" copy)

### 6. Delete or archive Auth.tsx
- Remove `frontend/src/pages/account/Auth.tsx` once routes are redirected

---

## Files expected to change

- `frontend/src/pages/auth/LoginPage.tsx` — new
- `frontend/src/pages/auth/SignupPage.tsx` — new
- `frontend/src/app/router.tsx` — new routes, redirect, remove old auth route
- `frontend/src/app/RequireAuth.tsx` — redirect target change
- `frontend/src/pages/account/AccountLayout.tsx` — remove Auth nav item
- `frontend/src/pages/account/Auth.tsx` — delete

---

## Exit criteria

- [ ] `/login` renders a focused sign-in form, signs user in, redirects to returnTo
- [ ] `/signup` renders a focused sign-up form, creates account, shows confirmation
- [ ] `RequireAuth` redirects unauthenticated users to `/login?returnTo=...`
- [ ] `/account/auth` redirects to `/login`
- [ ] Account sidebar no longer shows "Auth" nav item
- [ ] Sign-out is still accessible from the authenticated Account section
- [ ] No regressions in auth flow (sign in, sign up, magic link, returnTo)
