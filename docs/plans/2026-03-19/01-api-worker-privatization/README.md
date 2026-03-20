# API Worker Privatization

Remove the public `workers.dev` bypass for the API Worker and keep browser API traffic on `uttervoice.com/api/*` through the frontend Worker service binding.

## Context

The 2026-03-19 Cloudflare security hardening on `uttervoice.com` improved the branded-domain path, but direct Worker hostnames remained outside that protection.

That means the app currently has two different ways to reach backend logic:

1. `uttervoice.com/api/*`
2. `utter-api-staging.duncanb013.workers.dev/api/*`

Only the first path goes through the `uttervoice.com` zone-level WAF and rate limiting.

## Goal

Keep the hosted browser/API path as:

`uttervoice.com` -> frontend Worker -> service binding -> API Worker

and remove:

`utter-api-staging.duncanb013.workers.dev/api/*`

## Files

| File | Purpose |
|---|---|
| `api-worker-privatization-plan.md` | End-to-end implementation plan, deployment order, verification, rollback |
| `api-worker-privatization-research-verification.md` | Cloudflare docs verification and repo/runtime evidence |

## Design Decision

For this workstream, the chosen direction is:

- disable the API Worker's public `workers.dev` route
- keep browser traffic on `uttervoice.com/api/*`
- keep internal frontend -> API communication on the existing service binding
- make hosted frontend API proxying fail closed if the binding is missing

We are not adding a new API custom domain in this step.

## Why This Is Worth Doing

This is the cleanest near-term backend hardening move because:

- the service binding already exists
- the frontend Worker already uses it
- the direct public Worker hostname is the current bypass path
- it removes exposed surface without changing auth, billing, queue flow, or provider integrations

## Current Status

Planned on 2026-03-19.

The plan and research files in this directory are ready for execution.

## Execution Prompt

```
Implement the API Worker privatization plan in this directory.

Objective:

- Remove the public `workers.dev` bypass for the API Worker.
- Keep hosted browser API traffic on `uttervoice.com/api/*` through the frontend Worker service binding.
- Make hosted frontend proxying fail closed if the API service binding is missing.

Required reading before changes:

1. `docs/2026-03-19/01-api-worker-privatization/README.md`
2. `docs/2026-03-19/01-api-worker-privatization/api-worker-privatization-plan.md`
3. `docs/2026-03-19/01-api-worker-privatization/api-worker-privatization-research-verification.md`
4. `docs/2026-03-18/cloudflare-security/implementation-audit-2026-03-19.md`

Implementation requirements:

1. Update `workers/api/wrangler.toml` to disable the public `workers.dev` route durably.
2. Review `workers/frontend/src/index.ts` and remove or narrow hosted fallback behavior so hosted `/api/*` requests require the `API` service binding.
3. Preserve local development behavior where reasonable.
4. Do not introduce a new API custom domain in this task.
5. Do not change auth, credits, queue logic, or provider behavior unless strictly necessary for privatization.

Verification requirements:

1. Confirm the repo config reflects private API Worker intent.
2. Confirm hosted traffic still targets the internal service binding path.
3. List the exact dashboard action still required, if any, to disable `workers.dev` on the live Worker.
4. Provide a concrete post-deploy verification checklist:
   - `uttervoice.com/api/health` should work
   - `utter-api-staging.duncanb013.workers.dev/api/health` should no longer expose the API

Constraints:

- Follow repo guidance in `AGENTS.md`.
- Keep error handling explicit; do not add broad silent fallbacks.
- If you find an unexpected dependency on the public API hostname, document it clearly before changing behavior.

Deliverables:

1. Code/config changes
2. Short implementation summary
3. Verification notes
4. Any remaining manual Cloudflare dashboard step
```
