# 2026-03-19 Follow-up Workstreams

Follow-up tasks moved from [2026-03-18](../2026-03-18/README.md) to keep that folder focused on the auth critical path and Cloudflare security.

Historical note:

- `01-api-worker-privatization/` is now implemented.
- References inside that bundle to `utter-api-staging.duncanb013.workers.dev` describe the pre-disablement exposure, the rollout plan, or the verification target for confirming the public API bypass was removed.

Use [ordered-roadmap.md](./ordered-roadmap.md) as the main sequencing guide.

## Main Sequence

### 01 API Worker Privatization (`01-api-worker-privatization/`)

Remove the public `workers.dev` bypass for the API Worker and keep browser API traffic on `uttervoice.com/api/*` via the frontend Worker service binding.

- `README.md` — directory overview, rationale, file guide, status, execution prompt
- `api-worker-privatization-plan.md` — implementation plan
- `api-worker-privatization-research-verification.md` — Cloudflare docs verification and repo evidence

**Depends on:** Existing frontend Worker service binding to `utter-api-staging` remaining intact.

### 02 Cloudflare Supabase Proxy (`02-cloudflare-supabase-proxy/`) — DONE

~~Document and prepare the architectural change needed to move Supabase Auth off the direct browser path and behind the Cloudflare Worker layer.~~

**Implemented and verified on 2026-03-19.** All auth flows (sign-in, session check, sign-out) now route through `uttervoice.com/api/auth/*`. Zero direct browser-to-Supabase traffic. Publishable key and project ref no longer visible in browser network traffic. Cookie-based auth (httpOnly, Secure, SameSite=Lax) replaces browser-managed Supabase tokens.

- `README.md` — directory overview, scope, execution prompt
- `cloudflare-supabase-proxy-research-verification.md` — verified matrix and evidence for current browser-visible Supabase exposure
- `cloudflare-supabase-auth-proxy-plan.md` — implementation plan for Worker-mediated Auth
- `live-network-audit.md` — pre-fix network audit (baseline)
- `live-network-audit-post-fix.md` — post-fix network audit (verification)

**Depends on:** None strictly, but it complements the grouped surface-hardening work and follows naturally after `01-api-worker-privatization/`.

### 03 Surface Hardening — MOVED to [`../2026-03-20/`](../2026-03-20/README.md)

Revised and moved on 2026-03-20 after completion of the auth proxy work.

## Separate Tracks — MOVED to `../2026-03-22/`

### Billing Research — MOVED to [`../2026-03-22/billing-research/`](../2026-03-22/billing-research/README.md)

Evaluate Polar.sh as an alternative to Stripe, then test the chosen provider. Includes the original Stripe testing plan plus new Polar.sh research.

### OAuth — MOVED to [`../2026-03-22/oauth/`](../2026-03-22/oauth/oauth-follow-up-plan.md)

Add OAuth sign-in (Google first). Plan updated for the Worker auth proxy architecture.
