# 2026-03-18 Auth + Billing Research Plans

This folder captures the March 18 research and execution plans for the two remaining platform workstreams:

1. Domain + auth hardening
2. Stripe payment workflow testing

## Scope for today

- Separate the remaining work into:
  - domain, SMTP, signup confirmation, abuse protection, and OAuth
  - Stripe testing
- Research the current platform constraints from primary sources
- Ground the recommendations in the current Utter repo and deployment setup
- Write plans that are ready to execute later

## Outcome

1. `auth-rollout/01-app-domain-cutover-plan.md`
2. `auth-rollout/02-resend-smtp-setup-plan.md`
3. `auth-rollout/03-email-verification-cutover-plan.md`
4. `auth-rollout/04-turnstile-abuse-protection-plan.md`
5. `auth-rollout/05-oauth-follow-up-plan.md`
6. `auth-rollout/06-execution-prompts.md`
7. `stripe-testing-plan.md`

## Repo context this research assumes

- Frontend SPA is served by the frontend Worker and proxies `/api/*` to the API Worker.
- Hosted staging frontend currently runs on `https://utter.duncanb013.workers.dev`.
- Hosted Supabase project is `utter-dev` (`jgmivviwockcwjkvpqra`).
- The purchased registrar domain for this rollout is `uttervoice.com`.
- The rollout should treat the domain as already bought in Cloudflare Registrar.
- The canonical branded app hostname is `uttervoice.com`.
- `www.uttervoice.com` should only be a redirect alias to `uttervoice.com`.
- The intended auth-mail sending subdomain is `mail.uttervoice.com`.
- `auth.uttervoice.com` or `api.uttervoice.com` should remain reserved for a possible
  future Supabase custom domain.
- Current frontend auth uses email/password and magic link flows, but this folder intentionally skips magic-link planning.
- Current frontend does not yet implement password reset initiation/completion flows.
- Current frontend does not yet implement OAuth buttons or `signInWithOAuth(...)`.
- Current billing already creates Stripe Checkout sessions and processes Stripe webhooks for prepaid credit grants.

## Starting state for execution

When these plans are executed, assume the following starting point unless explicitly
stated otherwise:

1. `uttervoice.com` has already been purchased in Cloudflare Registrar.
2. The domain is in the same Cloudflare account that owns the Workers.
3. The Cloudflare zone for `uttervoice.com` is active.
4. The rollout work starts after purchase, not before purchase.

## Auth rollout sequence

Critical path:

1. `auth-rollout/01-app-domain-cutover-plan.md`
2. `auth-rollout/02-resend-smtp-setup-plan.md`
3. `auth-rollout/03-email-verification-cutover-plan.md`
4. `auth-rollout/04-turnstile-abuse-protection-plan.md`

Follow-up, not required for the current blocker:

5. `auth-rollout/05-oauth-follow-up-plan.md`

## Current execution status

- `01-app-domain-cutover-plan.md` completed on 2026-03-19.
- Canonical app hostname: `https://uttervoice.com`
- Redirect alias: `https://www.uttervoice.com/*` -> `https://uttervoice.com/$1`
- Temporary fallback hostname kept during cutover: `https://utter.duncanb013.workers.dev`
- Next auth-critical task: `auth-rollout/02-resend-smtp-setup-plan.md`

Password reset remains a separate product gap and is called out inside
`auth-rollout/03-email-verification-cutover-plan.md` rather than being treated as
automatically solved by hosted dashboard configuration.

## High-level conclusion

- A real custom app domain is worth doing now, but it is not the only auth blocker.
- The actual blocker for "real" email verification is Supabase's default email service limits and restrictions.
- The chosen email-delivery path should be hosted Supabase Auth with custom SMTP through Resend, not Supabase Edge Functions.
- Phase 1 should use Supabase's default confirmation and recovery links, not a custom in-app `token_hash` confirmation route.
- Once custom SMTP is enabled, abuse protection is no longer optional. Turnstile should be part of the rollout before public signup is opened broadly.
- Password reset is not yet complete in this repo and should not be represented as solved by SMTP plus dashboard changes alone.
- OAuth is still a separate follow-up task and is not part of the minimum path to "domain now + working email verification."
- Stripe testing can start in parallel and does not need the Qwen enterprise key.

## Execution model for these plans

These plans intentionally separate:

1. repo and Wrangler work an agent can do directly
2. manual dashboard work only the user can complete
3. verification steps that should happen after the manual work is confirmed

When executing these plans later, the agent should:

1. do all safe repo-side work first
2. stop at the plan's manual checkpoint
3. give the user the exact manual tasks and exact values to enter
4. wait for user confirmation before continuing to verification or dependent steps
