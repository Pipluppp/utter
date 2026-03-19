# 2026-03-19 Follow-up Workstreams

Follow-up tasks moved from [2026-03-18](../2026-03-18/README.md) to keep that folder focused on the auth critical path and Cloudflare security.

Historical note:

- `01-api-worker-privatization/` is now implemented.
- References inside that bundle to `utter-api-staging.duncanb013.workers.dev` describe the pre-disablement exposure, the rollout plan, or the verification target for confirming the public API bypass was removed.

Use [ordered-roadmap.md](./ordered-roadmap.md) as the main sequencing guide.

## Main Sequence

### 01 API Worker Privatization (`01-api-worker-privatization/`)

Remove the public `workers.dev` bypass for the API Worker and keep browser API traffic on `uttervoice.com/api/*` via the frontend Worker service binding.

- `README.md` — directory overview, rationale, file guide, status
- `api-worker-privatization-plan.md` — implementation plan
- `api-worker-privatization-research-verification.md` — Cloudflare docs verification and repo evidence
- `execution-prompt.md` — kickstart prompt for carrying out the rollout

**Depends on:** Existing frontend Worker service binding to `utter-api-staging` remaining intact.

### 02 Cloudflare Supabase Proxy (`02-cloudflare-supabase-proxy/`)

Document and prepare the architectural change needed to move Supabase Auth off the direct browser path and behind the Cloudflare Worker layer.

- `README.md` — directory overview and scope
- `cloudflare-supabase-proxy-research-verification.md` — verified matrix and evidence for current browser-visible Supabase exposure
- `cloudflare-supabase-auth-proxy-plan.md` — implementation plan for Worker-mediated Auth
- `execution-prompt.md` — kickstart prompt for implementation

**Depends on:** None strictly, but it complements the grouped surface-hardening work and follows naturally after `01-api-worker-privatization/`.

### 03 Surface Hardening (`03-surface-hardening/`)

Grouped follow-up hardening package that should run after the two primary perimeter changes.

- `README.md` — parent overview and sequencing
- `api-rate-limit-hardening/` — backend limiter layering and identity fixes
- `supabase-direct-surface-hardening/` — remaining direct Supabase HTTPS surface review
- `signed-surface-hardening/` — residual signed/tokenized public surface review

**Depends on:** `01-api-worker-privatization/` first, and usually `02-cloudflare-supabase-proxy/` before final tuning.

## Surface Hardening Subtracks

### API Rate-Limit Hardening (`03-surface-hardening/api-rate-limit-hardening/`)

Refactor backend abuse control so Supabase remains the durable business limiter, but not the first gate every public request hits.

- `README.md` — directory overview and architecture goal
- `api-rate-limit-hardening-plan.md` — implementation plan
- `execution-prompt.md` — kickstart prompt for implementation

### Supabase Direct Surface Hardening (`03-surface-hardening/supabase-direct-surface-hardening/`)

Harden the parts of the app that still talk directly to `jgmivviwockcwjkvpqra.supabase.co`, especially Auth and any remaining public Data API exposure.

- `README.md` — directory overview and scope
- `supabase-direct-surface-hardening-plan.md` — implementation plan
- `execution-prompt.md` — kickstart prompt for implementation

### Signed Surface Hardening (`03-surface-hardening/signed-surface-hardening/`)

Review and tighten the remaining bearer-style public surfaces after API privatization, especially signed storage URLs and the Preview URL follow-up.

- `README.md` — directory overview and residual-surface map
- `signed-surface-hardening-plan.md` — implementation plan
- `execution-prompt.md` — kickstart prompt for implementation

## Separate Tracks

### Stripe Testing (`stripe-testing/`)

Verify Stripe checkout and webhook credit grants in test mode.

- `stripe-testing-plan.md` — full testing plan
- `stripe-testing-research-verification.md` — research verification notes

### OAuth (`oauth/`)

Add OAuth sign-in (Google first) to the branded app domain.

- `oauth-follow-up-plan.md` — implementation plan
- `oauth-research-verification.md` — research verification notes
