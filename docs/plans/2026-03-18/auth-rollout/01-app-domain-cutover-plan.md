# App Domain Cutover Plan

## Purpose

Establish a stable branded app domain for Utter on Cloudflare Workers so hosted
Supabase Auth can redirect users back to a durable, trusted origin.

This is the first task in the auth rollout critical path.

## Why this is first

The current signup flow builds auth redirect targets from `window.location.origin`, so the final verification experience depends on the hostname serving the SPA.

Repo references:

- `frontend/src/pages/Auth.tsx`
- `frontend/src/pages/account/Auth.tsx`
- `frontend/src/lib/supabase.ts`
- `workers/api/wrangler.toml`

Without a stable app domain, you can still test pieces of auth on `workers.dev`, but you are not locking the final redirect contract yet.

## Deliverable

A branded frontend app domain is live on the frontend Worker, and the API Worker accepts requests from that origin.

## Execution status

Completed 2026-03-19.

Delivered state:

1. `uttervoice.com` is attached to the frontend Worker as the canonical branded app hostname.
2. `www.uttervoice.com` redirects to `https://uttervoice.com/$1`.
3. The frontend Worker still proxies `/api/*` unchanged.
4. The API Worker CORS allowlist includes `https://uttervoice.com`.
5. `https://utter.duncanb013.workers.dev` remains available as a temporary fallback hostname.

## Starting assumptions

This plan assumes:

1. `uttervoice.com` has already been purchased in Cloudflare Registrar.
2. The Cloudflare zone for `uttervoice.com` is active.
3. The work starts from post-purchase setup, not domain selection.

## Dependencies

- none

## Blocks

- `02-resend-smtp-setup-plan.md` if you want auth email to send from the final branded domain or subdomain
- `03-email-verification-cutover-plan.md`
- `04-turnstile-abuse-protection-plan.md`
- `05-oauth-follow-up-plan.md`

## Scope

1. Confirm and use the reserved hostname layout for `uttervoice.com`.
2. Attach the frontend Worker to the branded app hostname.
3. Update API CORS allowlists for that hostname.
4. Decide whether to keep the current `workers.dev` URL as a temporary fallback during
   cutover.

## Recommended target shape

- one canonical branded frontend hostname on the frontend Worker now
- continue using `/api/*` proxying through the frontend Worker
- no separate public API custom domain required for phase 1
- reserve separate subdomains for future auth infrastructure rather than overloading the app hostname

Recommended layout:

- `uttervoice.com` -> frontend Worker now
- `www.uttervoice.com` -> redirect alias to `uttervoice.com`
- `auth.uttervoice.com` or `api.uttervoice.com` -> reserved for a possible future Supabase custom domain
- `mail.uttervoice.com` -> reserved for Resend sending

Why this shape is recommended:

- Cloudflare Workers custom domains can attach directly to a domain or subdomain in an
  active Cloudflare zone.
- Supabase custom domains are a separate paid feature, support one custom hostname per
  project, and currently only support subdomains.
- Resend recommends using subdomains to isolate sending reputation.

Using `uttervoice.com` as the canonical hostname fits the current product shape best:

- the landing page and logged-in app are the same SPA
- `/`, `/auth`, and the gated product routes already live together in one router
- there is no current product-level split between marketing and app surfaces

Keeping `www.uttervoice.com` only as a redirect alias preserves a standard fallback
hostname without making it the primary URL.

## Exact repo follow-through

1. Attach `uttervoice.com` to the frontend Worker.
2. Keep the existing frontend Worker `/api/*` proxy model unchanged.
3. Update `workers/api/wrangler.toml` so `CORS_ALLOWED_ORIGIN` includes the new branded hostname.
4. Redeploy the API Worker and frontend Worker.
5. Confirm the hosted SPA still reaches `/api/*` and auth pages load correctly.

Relevant repo facts:

- `workers/frontend/src/index.ts` already proxies `/api/*` to the API Worker via the
  existing service-binding/fallback model.
- `workers/api/wrangler.toml` currently hardcodes explicit allowed origins and will
  need the new hostname added.

## Manual tasks for the user

Cloudflare dashboard / registrar:

1. Disable auto-renew if you do not intend to keep the domain after the first year.
2. Confirm the domain appears as an active Cloudflare zone in the account that owns
   the Workers.
3. Attach `uttervoice.com` as the Worker custom domain if not already attached via
   repo/Wrangler rollout.
4. Create a redirect:
   - `https://www.uttervoice.com/*` -> `https://uttervoice.com/$1`

## Manual checkpoint

The agent should stop after the repo/Wrangler changes are prepared and before final
validation if the Cloudflare zone is not yet confirmed active or the Worker custom
domain attachment is still pending.

At that checkpoint, the agent should tell the user:

1. the exact hostname to use:
   - `uttervoice.com`
2. whether any redirect rules are recommended now or can wait
3. the exact confirmation needed before continuing:
   - zone active in Cloudflare
   - custom domain certificate/attachment status visible if applicable

## Validation

1. Branded domain serves the SPA.
2. `GET /api/health` works through the branded domain.
3. Auth pages load from the branded domain.
4. No CORS failures occur on authenticated API requests.

## Verification split

Agent-side:

1. confirm Wrangler/deploy config contains the branded hostname
2. confirm the frontend Worker still proxies `/api/*`
3. confirm API CORS config includes the branded hostname

User-side / shared:

1. open the branded hostname in a browser
2. confirm the SPA loads
3. confirm `/api/health` works from the branded hostname
4. confirm any apex or `www` redirects behave as intended

## Decision note

Cloudflare Registrar is optional. The required part is an active Cloudflare-managed
zone. Also note:

- the Worker custom domain hostname cannot already have an existing CNAME record
- Cloudflare creates the DNS record for the Worker custom domain after attachment
- custom domains match exact hostnames, not wildcard DNS patterns

Do not add a separate public API hostname in this step. The repo already has the
right frontend Worker proxy shape.

## Source anchors

- Cloudflare Workers custom domains
- Supabase custom domains
- Supabase redirect URL behavior
