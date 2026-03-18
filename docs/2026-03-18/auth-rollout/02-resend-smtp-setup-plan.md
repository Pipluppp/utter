# Resend SMTP Setup Plan

## Purpose

Replace Supabase's built-in test-only email sender with Resend custom SMTP so hosted Supabase Auth can deliver auth emails to real external inboxes.

This is the second task in the auth rollout critical path.

## Why this is second

The current blocker for public email verification is not the app code. It is Supabase's default email service limits:

- only team-authorized addresses
- `2 emails/hour`
- not for production use

That means domain work alone is insufficient. A real SMTP provider must be connected before hosted email verification can be considered real.

## Deliverable

Hosted Supabase Auth is configured to send through Resend SMTP using a verified sender domain or subdomain.

## Starting assumptions

This plan assumes:

1. `uttervoice.com` has already been purchased in Cloudflare Registrar.
2. `mail.uttervoice.com` is the preferred sending subdomain.
3. `uttervoice.com` is the canonical branded frontend hostname.

## Dependencies

- `01-app-domain-cutover-plan.md`

Reason:

- the sender domain strategy should align with the chosen root domain and reserved subdomains
- using the real domain first avoids redoing sender-domain decisions

## Blocks

- `03-email-verification-cutover-plan.md`
- `04-turnstile-abuse-protection-plan.md` for production hardening

## Scope

1. Verify a sending domain or subdomain in Resend.
2. Create a dedicated Resend API key for auth mail.
3. Configure hosted Supabase SMTP settings to use Resend.
4. Choose a sender address and sender name.
5. Review the hosted Supabase `rate_limit_email_sent` setting after SMTP is enabled.
6. Send a real test message to a non-team external inbox.

## Recommended sender structure

- preferred sending subdomain: `mail.uttervoice.com`
- preferred sender address: `no-reply@mail.uttervoice.com`
- acceptable fallback sender address: `support@mail.uttervoice.com`

Why this repo-specific recommendation differs slightly from Supabase's generic
`auth.example.com` example:

- Supabase recommends separating auth mail from marketing mail on different domains or
  subdomains.
- Resend recommends subdomains to isolate sending reputation.
- this repo may later want to keep `auth.uttervoice.com` or `api.uttervoice.com` free
  for a Supabase custom domain used by OAuth/Auth callbacks

Using `mail.uttervoice.com` for Resend keeps the app hostname and future Supabase
hostname cleanly separated.

## Hosted Supabase settings

Use Resend's SMTP values:

- host: `smtp.resend.com`
- port: `465`
- username: `resend`
- password: Resend API key

Keep all SMTP secrets out of the repo.

Hosted Supabase behavior to account for:

- the built-in provider only sends to team-authorized addresses
- the built-in provider is currently limited to `2 messages/hour`
- after custom SMTP is enabled, Supabase can send to all addresses but starts with a
  low `30 messages/hour` limit until you raise it

## Manual tasks for the user

Resend dashboard:

1. Create the sending domain:
   - preferred: `mail.uttervoice.com`
   - fallback: `auth-mail.uttervoice.com`
2. Copy the DNS verification records Resend provides.
3. Add those records in Cloudflare DNS.
4. Wait until Resend marks the domain verified.
5. Create a dedicated Resend API key for auth mail.

Supabase dashboard:

1. Open Authentication settings.
2. Enable custom SMTP.
3. Enter:
   - host: `smtp.resend.com`
   - port: `465`
   - username: `resend`
   - password: the Resend API key
   - sender email: the chosen sender address
   - sender name: `Utter`
4. Save the SMTP settings.
5. Review the current auth email rate limit after SMTP is enabled.

## Manual checkpoint

The agent should stop before claiming this task is complete unless the user confirms:

1. Resend domain is verified
2. SMTP settings are saved in hosted Supabase
3. a real non-team inbox test has been attempted

## Important constraints

1. Supabase still owns the auth flow.
2. Resend only becomes the delivery provider.
3. No Supabase Edge Function is required.
4. No Cloudflare Worker email-sending code is required.
5. Enabling SMTP is not the same as production hardening; abuse protection follows in
   `04-turnstile-abuse-protection-plan.md`.

## Validation

1. SMTP settings save successfully in hosted Supabase.
2. A test auth email can be sent to a non-team external inbox.
3. Delivery no longer fails because of Supabase's built-in sender restrictions.
4. The sender address uses the dedicated sending subdomain.
5. The current `rate_limit_email_sent` value is documented for the rollout.

## Verification split

Agent-side:

1. update docs/config guidance in-repo
2. provide the exact sender address and SMTP values to use
3. record the expected Resend DNS records location in Cloudflare

User-side / shared:

1. confirm Resend marks the sending domain verified
2. confirm Supabase saves the SMTP settings without error
3. trigger a real auth email to an external inbox and report whether it arrived

## Decision note

Do not use Supabase Send Email Hook for phase 1. It is valid for deeper customization
later, but it is not on the shortest path to working email verification now.

## Execution status

Completed 2026-03-19.

### Steps executed

1. Created sending domain `mail.uttervoice.com` in the Resend dashboard.
2. Resend detected Cloudflare as the DNS provider and offered automatic DNS
   configuration. Authorized the one-time Cloudflare DNS integration — Resend added
   three records automatically (DKIM TXT, SPF MX, SPF TXT), all DNS-only.
3. Clicked **Verify DNS Records** in Resend. Domain verified immediately.
4. Created a dedicated Resend API key (`supabase-auth-smtp`) with **Sending access**
   only, restricted to `mail.uttervoice.com`.
5. Installed the Resend CLI (`npm install -g resend-cli`) for test sends.
   - Note: `resend login` rejects send-only keys. A full-access key is needed for the
     CLI, or skip the CLI and use the dashboard/app for testing.
6. Configured hosted Supabase custom SMTP:
   - host: `smtp.resend.com`
   - port: `465`
   - username: `resend`
   - password: the send-only API key
   - sender email: `no-reply@mail.uttervoice.com`
   - sender name: `Utter`
7. Sent a test email via the Resend CLI to a non-team external inbox — arrived
   successfully.
8. Verified email confirmation works end-to-end through the app's signup flow.

### No code changes required

The existing frontend already uses `window.location.origin` for `emailRedirectTo` and
has `detectSessionInUrl: true`. CORS in the API Worker already allows
`uttervoice.com`. SMTP is entirely a hosted Supabase + Resend configuration concern.

## Source anchors

- Supabase custom SMTP
- Supabase auth rate limits
- Resend domains intro
- Resend Supabase SMTP guide
