# OAuth Follow-up Plan

## Purpose

Add OAuth after the branded domain and email-verification rollout are already working.

This is intentionally not part of the critical path for the current goal.

## Why this is fifth

OAuth is auth work, but it is not required to reach the current target state:

- working branded domain
- working signup confirmation now

It should follow the domain and email-verification rollout so provider configuration is not done against temporary hostnames.

## Deliverable

At least one provider, preferably Google, works end to end on the branded app domain.

## Starting assumptions

This plan assumes:

1. `uttervoice.com` is the production app origin.
2. `uttervoice.com` is already bought and active in Cloudflare.
3. email signup confirmation is already working before OAuth begins.

## Dependencies

- `01-app-domain-cutover-plan.md`
- ideally `03-email-verification-cutover-plan.md`
- optionally a future Supabase custom domain if you want Google consent and callback
  URLs to show your own auth hostname instead of `<project-ref>.supabase.co`

## Does not block

- the current rollout goal of "domain now + working email verification"

## Architecture Note (2026-03-22)

Since 2026-03-19, all auth flows are proxied through the Cloudflare Worker at `/api/auth/*`. The OAuth callback no longer goes directly to `*.supabase.co` — it routes through `/api/auth/callback` which exchanges the code server-side. This means:

- The Google consent screen redirect URI should point to `https://uttervoice.com/api/auth/callback`
- No Supabase custom domain is needed for clean OAuth callback URLs
- The frontend calls the Worker to initiate OAuth, not `supabase.auth.signInWithOAuth()` directly

## Scope

1. Configure the Google provider console for `uttervoice.com`.
2. Configure Supabase OAuth provider credentials (dashboard).
3. Add a Worker route to initiate OAuth (generate the Supabase OAuth URL server-side, redirect the browser).
4. Add OAuth buttons in the frontend auth UI that hit the new Worker route.
5. Test the full redirect flow: frontend → Worker → Google → Worker callback → cookie set → redirect to app.

## Current repo gap

There is no OAuth initiation route in the Worker or OAuth UI in the frontend. The `/api/auth/callback` handler already supports code exchange (`exchangeCodeForSession`), so the callback side is partially ready.

## Recommended first provider

- Google

Reason:

- highest general user value
- strongest trust improvement from branded domain
- first provider where the consent-screen branding and custom-domain trust issues are
  most noticeable

## Validation

1. OAuth button appears in the auth UI.
2. Provider consent screen works.
3. Redirect returns to the branded app domain.
4. Session is restored in the SPA.

## Manual tasks for the user

Google Cloud / Google Auth Platform:

1. Create or choose the Google project.
2. Configure Branding / consent screen details.
3. Add Authorized JavaScript origins: `https://uttervoice.com`
4. Add Authorized redirect URI: `https://uttervoice.com/api/auth/callback`
5. Copy the Google client ID and client secret.

Supabase dashboard:

1. Enable the Google provider.
2. Paste the Google client ID and secret.
3. Save provider settings.

## Manual checkpoint

The agent should stop before OAuth verification unless the user confirms:

1. Google OAuth app is configured
2. callback URLs are correct
3. Supabase provider settings are saved

## Decision note

Treat this as phase 2 auth work. The Worker proxy eliminates the need for a Supabase custom domain for OAuth — callback URLs use `uttervoice.com/api/auth/callback` directly.
