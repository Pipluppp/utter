# Email Verification Cutover Plan

## Purpose

Configure hosted Supabase so password signup requires email confirmation, with
verification emails delivered through Resend SMTP to the branded app domain.

Third task in the auth rollout critical path.

## Dependencies

- `01-app-domain-cutover-plan.md`
- `02-resend-smtp-setup-plan.md`

## Blocks

- `04-turnstile-abuse-protection-plan.md`
- `05-oauth-follow-up-plan.md`

## Execution status

Completed 2026-03-19.

All configuration was already in place when this task was reviewed. The hosted Supabase
dashboard was configured during the plan 01 and 02 work sessions.

### Hosted Supabase settings verified

**URL Configuration:**

- Site URL: `https://uttervoice.com`
- Redirect URLs:
  - `https://uttervoice.com/**`
  - `https://utter.duncanb013.workers.dev/**`
  - `http://localhost:5173/**`
  - `http://127.0.0.1:5173/**`

**Email / SMTP:**

- Custom SMTP: enabled (Resend, configured in plan 02)
- Sender: `no-reply@mail.uttervoice.com` / `Utter`
- Email confirmations: enabled
- Minimum interval per user: 60 seconds

**Email templates:** default Supabase `{{ .ConfirmationURL }}` links (no custom
`token_hash` route).

### No code changes required

The frontend already derives `emailRedirectTo` from `window.location.origin` and has
`detectSessionInUrl: true`. No app code was modified for this task.

### Validated

- Signup on `uttervoice.com` with a non-team external inbox.
- Confirmation email arrived via Resend.
- Clicking the link redirected back to the branded domain.
- User was authenticated after redirect.

### Not in scope

- Custom `/auth/confirm` route (not needed with default Supabase links).
- Password reset flow (`resetPasswordForEmail` / `PASSWORD_RECOVERY` / `updateUser`).
- OAuth.

## Source anchors

- Supabase redirect URLs
- Supabase email templates
- Supabase custom SMTP
- Supabase auth rate limits
