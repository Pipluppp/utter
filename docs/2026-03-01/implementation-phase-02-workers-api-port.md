# Phase 02: API Port to Cloudflare Workers

Date: 2026-03-02  
Status: Implemented in `workers/api` and validated via parity test harness (see audit evidence)

## Goal

Port current Hono API backend from Supabase Edge Functions runtime to Cloudflare Workers runtime while preserving route contracts.

## Production gate (Cloudflare Free CPU risk)

Do not ship Phase 02 to production while Qwen long-running background work still depends on `waitUntil`.

Required for production cutover on free plan:

1. Queue Q1 is enabled for:
   - Qwen generate async processing
   - Qwen design-preview async processing
2. Or, explicitly move to paid Workers and re-validate runtime budget.

## Current code hotspots to adapt

Deno/runtime-specific usage currently exists in:

- `supabase/functions/api/index.ts` (`Deno.serve`)
- `supabase/functions/api/routes/generate.ts` (`EdgeRuntime.waitUntil`)
- `supabase/functions/api/routes/design.ts` (`EdgeRuntime.waitUntil`)
- `supabase/functions/api/routes/tasks.ts` (`EdgeRuntime.waitUntil`)
- `supabase/functions/_shared/*` (`Deno.env.get(...)`)

## New worker scaffold

Create a new API package:

- `workers/api/wrangler.toml`
- `workers/api/src/index.ts`
- `workers/api/src/env.ts`
- `workers/api/src/routes/*` (ported from current API routes)
- `workers/api/src/shared/*` (ported shared helpers)

## Runtime adaptation tasks

1. Replace entrypoint:
   - from `Deno.serve(app.fetch)`
   - to Worker `fetch(request, env, ctx)` export
2. Replace env access:
   - from `Deno.env.get("X")`
   - to Worker env bindings (typed interface in `env.ts`)
3. Replace background execution calls:
   - from `EdgeRuntime.waitUntil(p)`
   - to `ctx.waitUntil(p)` / `c.executionCtx.waitUntil(p)`
4. Keep Hono route paths and payload schemas unchanged.
5. Keep auth model unchanged:
   - frontend sends `Authorization: Bearer <token>` to Worker
   - Worker uses user-scoped Supabase client for RLS reads
   - Worker uses service-role client for privileged writes/RPC

## Required Worker secrets/bindings

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CORS_ALLOWED_ORIGIN`
- Provider secrets already used today (`MODAL_*`, `QWEN_*`, `MISTRAL_*`, `STRIPE_*`, etc.)

## Contract parity tests

Run and compare for the following endpoints:

1. `POST /api/generate`
2. `GET /api/tasks/:id`
3. `POST /api/tasks/:id/cancel`
4. `POST /api/clone/upload-url`
5. `POST /api/clone/finalize`
6. `POST /api/voices/design/preview`
7. `POST /api/voices/design`
8. `POST /api/billing/checkout`
9. `POST /api/webhooks/stripe`
10. `GET /api/credits/usage`

## Validation checklist

- [x] Response shapes match existing frontend expectations.
- [x] Unauthorized flows still return expected 401 details.
- [x] Credits debit/refund semantics unchanged.
- [x] Stripe webhook idempotency unchanged.
- [x] Task orchestration statuses unchanged (`pending/processing/completed/failed/cancelled`).
- [x] Qwen async paths are queue-backed (or paid-plan exception is documented and approved).

## Rollback

1. Switch `/api/*` routing back to Supabase Edge Function endpoint.
2. Verify all critical routes from smoke suite.

## Deliverables

1. Worker API deployed to staging.
2. Route parity report.
3. Runtime adaptation diff list.
