# Turnstile Abuse Protection Plan

## Purpose

Protect public auth entry points once custom SMTP is enabled, so signup and recovery
traffic cannot burn sender reputation or exhaust auth email limits.

This is the fourth task in the auth rollout sequence.

## Why this is separate

The custom SMTP step makes hosted Supabase Auth capable of sending to real external
inboxes. Supabase explicitly warns that once you do this, bot signups and recovery
abuse can damage the reputation of your sending domain and recommends CAPTCHA as the
most effective mitigation.

That makes this task different from "make one real email arrive." It is the
hardening step before public rollout.

## Deliverable

Hosted Supabase CAPTCHA protection is enabled with Cloudflare Turnstile, and the
frontend passes CAPTCHA tokens on every auth flow that can trigger email sends.

## Starting assumptions

This plan assumes:

1. `uttervoice.com` is live or in final cutover.
2. `uttervoice.com` is already bought and active in Cloudflare.
3. Resend-backed SMTP is already configured or being completed from the prior step.

## Dependencies

- `02-resend-smtp-setup-plan.md`
- ideally `03-email-verification-cutover-plan.md`

## Blocks

- opening public email/password signup broadly
- treating auth email delivery as production-ready

## Scope

1. Create a Cloudflare Turnstile widget for the branded app domain.
2. Add localhost and any temporary preview origins needed for development/testing.
3. Enable CAPTCHA protection in hosted Supabase Auth and store the Turnstile secret
   there.
4. Add the Turnstile frontend component to the auth UI.
5. Pass `captchaToken` into:
   - `signUp(...)`
   - `signInWithOtp(...)`
   - `resetPasswordForEmail(...)` once the password reset flow exists
6. Reset the Turnstile challenge after each auth submission attempt.
7. Update docs so CAPTCHA is part of the canonical auth rollout, not an optional
   extra.

## Recommended provider choice

- Cloudflare Turnstile

Reason:

- already aligned with the Cloudflare runtime and DNS stack
- explicitly supported by Supabase Auth
- fits the current web SPA architecture without adding another vendor

## Repo-specific follow-through

Current auth entry points that should eventually carry a CAPTCHA token:

- `frontend/src/pages/Auth.tsx`
- `frontend/src/pages/account/Auth.tsx`

Current repo gap:

- there is no `resetPasswordForEmail(...)` flow yet, so recovery CAPTCHA support
  will land when the password reset product work is added

## Manual tasks for the user

Cloudflare dashboard:

1. Create a Turnstile widget for the branded hostname.
2. Add localhost origins if needed for development/testing.
3. Copy the Turnstile site key and secret key.

Supabase dashboard:

1. Open Auth > Bot and Abuse Protection.
2. Enable CAPTCHA protection.
3. Choose Cloudflare Turnstile.
4. Paste the Turnstile secret key.
5. Save the settings.

Frontend configuration:

1. Provide the site key to the frontend environment in whatever config location the
   implementation uses.

## Manual checkpoint

The agent should stop before hosted verification unless the user confirms:

1. the Turnstile widget exists
2. the site key is available to the frontend
3. the secret key is saved in Supabase CAPTCHA settings

## Validation

1. Signup requires a valid Turnstile token in hosted environments.
2. Magic-link sends require a valid Turnstile token in hosted environments.
3. Invalid or missing CAPTCHA tokens are rejected cleanly.
4. Successful requests still send auth mail correctly through Resend.
5. Local development still works with an explicit localhost configuration.

## Verification split

Agent-side:

1. verify auth calls pass `captchaToken` where implemented
2. verify the frontend resets the CAPTCHA after submit attempts
3. document any flows still pending CAPTCHA integration

User-side / shared:

1. attempt signup without a valid CAPTCHA token and confirm it fails
2. attempt signup with a valid CAPTCHA token and confirm it succeeds
3. repeat the same check for magic-link send if that flow remains exposed

## Decision note

Do not treat this as a dashboard-only checkbox. Supabase requires frontend changes
to collect a CAPTCHA token and pass it in the auth call options.

## Source anchors

- Supabase CAPTCHA / bot detection
- Supabase custom SMTP abuse guidance
- Cloudflare Turnstile
