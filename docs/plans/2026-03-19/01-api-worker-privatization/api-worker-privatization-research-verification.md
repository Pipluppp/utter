# API Worker Privatization Research Verification

Date: 2026-03-19
Status: Verified
Scope: Cloudflare docs verification for removing the public `workers.dev` API path while keeping internal Worker-to-Worker communication

## Cloudflare Sources Checked

### 1. `workers.dev`

Source:

- https://developers.cloudflare.com/workers/configuration/routing/workers-dev/

Verified points:

- When enabled, a Worker's `workers.dev` URL is public.
- Cloudflare recommends production Workers run on routes or custom domains instead of `workers.dev`.
- `workers_dev = false` disables the `workers.dev` route on the next deploy.
- If the dashboard disables `workers.dev` but Wrangler config does not set `workers_dev = false`, a later Wrangler deploy can re-enable it.
- Disabling `workers.dev` does not disable Preview URLs.

Why it matters here:

- `utter-api-staging.duncanb013.workers.dev` is currently the bypass path around the `uttervoice.com` zone protections.
- Repo config must carry the disablement so it persists.

### 2. Service bindings

Source:

- https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/

Verified points:

- Service bindings let one Worker call another without a public URL.
- Cloudflare documents service bindings as a way to isolate a Worker from the public Internet.
- Service bindings support forwarding requests from one Worker to another.

Why it matters here:

- This is exactly the topology already used by the frontend Worker for hosted browser API calls.
- It means the API Worker does not need to remain public for the frontend Worker to reach it.

### 3. Custom Domains

Source:

- https://developers.cloudflare.com/workers/configuration/routing/custom-domains/

Verified points:

- On the same zone, service bindings are the way for one Worker to call another Worker running on a route or on `workers.dev`.
- Workers on Custom Domains can also be called by `fetch()` within the same zone.

Why it matters here:

- We do not need to add `api.uttervoice.com` for this first hardening step because the existing service binding already solves internal communication.
- A dedicated API custom domain remains an optional future architecture choice, not a prerequisite for privatization.

## Repo Evidence Checked

### Frontend Worker service binding exists

Files:

- [workers/frontend/wrangler.toml](C:/Users/Duncan/Desktop/utter/workers/frontend/wrangler.toml)
- [workers/frontend/src/index.ts](C:/Users/Duncan/Desktop/utter/workers/frontend/src/index.ts)

Verified points:

- The hosted frontend environment declares a service binding:
  - binding: `API`
  - service: `utter-api-staging`
- `/api/*` requests are forwarded through `env.API.fetch(...)` when the binding exists.

Inference:

- Hosted browser traffic already has an internal Worker-to-Worker path.

### API Worker is still public today

Files:

- [workers/api/wrangler.toml](C:/Users/Duncan/Desktop/utter/workers/api/wrangler.toml)

Verified points:

- `workers_dev = false` is not currently present.

Live checks run on 2026-03-19:

- `https://utter-api-staging.duncanb013.workers.dev/` returned `404`
- `https://utter-api-staging.duncanb013.workers.dev/api/health` returned `200`
- `https://utter-api-staging.duncanb013.workers.dev/api/languages` returned `200`
- `https://uttervoice.com/api/health` returned `200`

Inference:

- The root `404` does not mean the Worker is private.
- The API routes are still publicly reachable on `workers.dev`.

### Existing security docs already identify the gap

File:

- [docs/2026-03-18/cloudflare-security/implementation-audit-2026-03-19.md](C:/Users/Duncan/Desktop/utter/docs/2026-03-18/cloudflare-security/implementation-audit-2026-03-19.md)

Verified point:

- The audit explicitly states that the March 19 Cloudflare security setup protects `uttervoice.com` only and that direct Worker hostnames remain exposed.

## Confirmed Decision

The strongest near-term architecture is:

- keep browser API traffic on `uttervoice.com/api/*`
- keep internal frontend -> API communication on the existing service binding
- disable the API Worker's public `workers.dev` route

This removes the public bypass path without requiring an API custom domain.

## Confirmed Non-Goals

This decision does not yet answer:

- whether Preview URLs should also be disabled
- whether a future `api.uttervoice.com` hostname should exist
- whether machine-to-machine clients will ever need a separate public API surface

Those remain later architecture decisions.
