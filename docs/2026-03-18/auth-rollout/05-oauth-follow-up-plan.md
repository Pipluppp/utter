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

## Scope

1. Configure the provider console for the branded app origin.
2. Configure Supabase OAuth provider credentials.
3. Add OAuth buttons and `signInWithOAuth(...)` flows in the SPA.
4. Test redirect and session restoration.
5. If a Supabase custom domain is added later, register both callback URLs during the
   migration window:
   - `https://<project-ref>.supabase.co/auth/v1/callback`
   - `https://<supabase-custom-domain>/auth/v1/callback`

## Current repo gap

There is no `signInWithOAuth(...)` implementation in `frontend/src` today, so OAuth still requires actual product work beyond dashboard configuration.

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
3. Add Authorized JavaScript origins for the app origin.
4. Add Authorized redirect URIs for the active Supabase callback URL.
5. If a Supabase custom domain is added later, add both callback URLs during the
   migration window.
6. Copy the Google client ID and client secret.

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

Treat this as phase 2 auth hardening, not as part of the minimum blocker-clearing
sequence. If you later decide to buy the Supabase custom-domain add-on, reserve a
subdomain such as `auth.uttervoice.com` or `api.uttervoice.com` now so the namespace is
available.

## Source anchors

- Supabase Google auth
- Supabase redirect URLs
- Supabase custom domains
