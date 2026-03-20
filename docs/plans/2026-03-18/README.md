# 2026-03-18 Auth Rollout + Cloudflare Security

This folder captures the March 18 research and execution plans for:

1. Domain + auth hardening (plans 01-04)
2. Cloudflare WAF security hardening (plan 05)
3. Vulnerability scan post-mortem

OAuth follow-up and Stripe testing have been moved to [2026-03-19](../2026-03-19/README.md) as separate workstreams.

## Scope

- Domain cutover, SMTP, signup confirmation, abuse protection (auth critical path)
- Cloudflare edge security configuration (WAF rules, bot protection, rate limiting)
- Research grounded in the current Utter repo and deployment setup

## Outcome

### Auth rollout (`auth-rollout/`)

1. `01-app-domain-cutover-plan.md`
2. `02-resend-smtp-setup-plan.md`
3. `03-email-verification-cutover-plan.md`
4. `04-turnstile-abuse-protection-plan.md` + `04-turnstile-research-verification.md`
5. `06-execution-prompts.md` - agent execution prompts for all tasks including Cloudflare

### Cloudflare security (`cloudflare-security/`)

6. `cloudflare-security/README.md` - overview, research sources, design decisions
7. `cloudflare-security/cloudflare-security-plan.md` - final WAF/bot/rate-limit configuration plan
8. `cloudflare-security/implementation-audit-2026-03-19.md` - concise audit of what was implemented in Cloudflare and how it was verified
9. `cloudflare-security/execution-prompt.md` - standalone agent execution prompt
10. `cloudflare-security/vulnerability-scan-event.md` - post-mortem of scanner burst that triggered this work
11. `cloudflare-security/cloudflare-security-hardening-plan.md` - superseded initial draft (kept for reference)

## Repo context this research assumes

- Frontend SPA is served by the frontend Worker and proxies `/api/*` to the API Worker.
- Hosted staging frontend currently runs on `https://utter.duncanb013.workers.dev`.
- Hosted Supabase project is `utter-dev` (`jgmivviwockcwjkvpqra`).
- The purchased registrar domain for this rollout is `uttervoice.com`.
- The rollout should treat the domain as already bought in Cloudflare Registrar.
- The canonical branded app hostname is `uttervoice.com`.
- `www.uttervoice.com` should only be a redirect alias to `uttervoice.com`.
- The intended auth-mail sending subdomain is `mail.uttervoice.com`.
- `auth.uttervoice.com` or `api.uttervoice.com` should remain reserved for a possible future Supabase custom domain.
- Current frontend auth uses email/password and magic link flows, but this folder intentionally skips magic-link planning.
- Current frontend does not yet implement password reset initiation/completion flows.
- Current frontend does not yet implement OAuth buttons or `signInWithOAuth(...)`.
- Current billing already creates Stripe Checkout sessions and processes Stripe webhooks for prepaid credit grants.

## Starting state for execution

When these plans are executed, assume the following starting point unless explicitly stated otherwise:

1. `uttervoice.com` has already been purchased in Cloudflare Registrar.
2. The domain is in the same Cloudflare account that owns the Workers.
3. The Cloudflare zone for `uttervoice.com` is active.
4. The rollout work starts after purchase, not before purchase.

## Auth rollout sequence

Critical path:

1. `auth-rollout/01-app-domain-cutover-plan.md` completed 2026-03-19
2. `auth-rollout/02-resend-smtp-setup-plan.md`
3. `auth-rollout/03-email-verification-cutover-plan.md`
4. `auth-rollout/04-turnstile-abuse-protection-plan.md`
5. `cloudflare-security/cloudflare-security-plan.md` (dashboard-only, no code changes, implemented 2026-03-19)

Follow-up workstreams (moved to [2026-03-22](../2026-03-22/)):

- OAuth: `../2026-03-22/oauth/oauth-follow-up-plan.md`
- Billing research: `../2026-03-22/billing-research/README.md`

## Current execution status

- `01-app-domain-cutover-plan.md` completed on 2026-03-19.
- `cloudflare-security/cloudflare-security-plan.md` implemented on 2026-03-19 for `uttervoice.com`.
- Canonical app hostname: `https://uttervoice.com`
- Redirect alias: `https://www.uttervoice.com/*` -> `https://uttervoice.com/$1`
- Temporary fallback hostname kept during cutover: `https://utter.duncanb013.workers.dev`
- Cloudflare completion audit: `cloudflare-security/implementation-audit-2026-03-19.md`
- Next auth-critical task: `auth-rollout/02-resend-smtp-setup-plan.md`

Password reset remains a separate product gap and is called out inside `auth-rollout/03-email-verification-cutover-plan.md` rather than being treated as automatically solved by hosted dashboard configuration.

## High-level conclusion

- A real custom app domain is worth doing now, but it is not the only auth blocker.
- The actual blocker for "real" email verification is Supabase's default email service limits and restrictions.
- The chosen email-delivery path should be hosted Supabase Auth with custom SMTP through Resend, not Supabase Edge Functions.
- Phase 1 should use Supabase's default confirmation and recovery links, not a custom in-app `token_hash` confirmation route.
- Once custom SMTP is enabled, abuse protection is no longer optional. Turnstile should be part of the rollout before public signup is opened broadly.
- Password reset is not yet complete in this repo and should not be represented as solved by SMTP plus dashboard changes alone.
- Cloudflare WAF security hardening should follow domain cutover to protect the newly-public domain from automated scanners.
- OAuth and Stripe testing are separate follow-up workstreams (see [2026-03-19](../2026-03-19/README.md)).

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
