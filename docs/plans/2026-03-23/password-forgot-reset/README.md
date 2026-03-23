# Password Forgot & Reset

Shipped: 2026-03-23

## What

Self-service password recovery and change flows for UtterVoice. Users can now reset a forgotten password via email and change their password from the profile page.

## Why

Previously, users who forgot their password had no recovery path. This was the last missing piece in the email+password auth flow.

## What was built

**API endpoints** (in `workers/api/src/routes/auth.ts`):
- `POST /api/auth/forgot-password` — sends a recovery email via Supabase Auth. Always returns a generic message to avoid leaking email existence.
- `POST /api/auth/update-password` — updates the user's password using their session. Used by both the recovery flow and the profile change-password section.

**Frontend pages**:
- `/auth/forgot-password` — email input + Turnstile captcha, sends recovery request
- `/account/update-password` — new password + confirm form, shown after clicking the recovery email link

**Profile integration**:
- "Change password" section on `/account/profile` for users with email+password auth
- Hidden for Google OAuth-only users, with a notice explaining why

**Auth callback extension**:
- The existing `/api/auth/callback` already handled `token_hash` + `type=recovery` via `verifyOtp` — no new backend code needed for token exchange
- Added `next` query param support (alias for `returnTo`) so the recovery email template can specify the post-auth destination

**Session endpoint extension**:
- `GET /api/auth/session` now includes `identities: [{ provider: string }]` so the frontend can detect OAuth-only users

## Files changed

See [files.md](./files.md) for the full list.

## Configuration

**Supabase dashboard** (production):
- Recovery email template updated to use `token_hash` redirect format instead of `{{ .ConfirmationURL }}`
- Template: `{{ .SiteURL }}/api/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=/account/update-password`

**Local dev** (`supabase/config.toml`):
- Added `[auth.email.template.recovery]` pointing to `supabase/templates/recovery.html`

**Vite dev proxy** (`frontend/vite.config.ts`):
- Added `x-forwarded-proto` and `x-forwarded-host` headers so the API worker builds correct redirect URLs during local dev

## Post-ship fixes

1. `update-password` endpoint was returning "Auth session missing!" — fixed by using `auth.setSession()` instead of just passing the access token as a header
2. Change-password button stayed disabled after success — fixed by resetting form state when user starts typing again
3. Captcha token made optional on forgot-password (matching sign-in/sign-up pattern) for local dev where Turnstile isn't available
4. Callback `next` param wasn't being read (only `returnTo` was) — fixed by falling back to `next` when `returnTo` is absent
5. Local dev redirects went to port 8787 (API worker) instead of 5173 (frontend) — fixed by adding forwarded headers to Vite proxy config
6. Local Supabase was using default email template — added custom recovery template to `supabase/config.toml`
