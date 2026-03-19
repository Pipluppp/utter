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
| `execution-prompt.md` | Kickstart prompt for executing the work safely |

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

## Execution

Use `execution-prompt.md` to kick off the implementation and verification work.
