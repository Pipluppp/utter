# Cleanup Plan Bundle: Remove Modal + Remove Supabase Storage Hybrid + Queue Simplify

Date: 2026-03-03

This folder contains pre-production cleanup plans to simplify the stack to:

1. Qwen-only TTS provider
2. R2-only object storage
3. Queue-first async orchestration (with `GET /tasks/:id` read-only)

## Why now

- Environment is not yet production.
- Existing stored audio is test data; no required legacy migration.
- Current code has significant complexity from dual-provider and hybrid-storage compatibility branches.

## Plan set

1. `01-remove-modal-provider-plan.md`
2. `02-r2-only-storage-plan.md`
3. `03-queue-first-orchestration-plan.md`
4. `04-integrated-validation-and-cutover-plan.md`
5. `05-docs-realignment-for-simplified-stack-plan.md`

## Recommended execution order

1. Remove Modal provider paths (`01`)
2. Switch storage layer to R2-only (`02`)
3. Make queue the single async execution path (`03`)
4. Run integrated verification + staging cutover checks (`04`)
5. Update docs and runbooks to match the simplified architecture (`05`)

## Scope boundaries

- Keep Supabase Postgres/Auth/RLS/credits/billing as system-of-record.
- Do not change frontend route contracts (`/api/*`) unless explicitly called out.
- Keep Stripe billing semantics and idempotency invariants unchanged.

## Verification notes (2026-03-03)

Validated against current code and Cloudflare docs for:

1. Queue producer/consumer configuration and DLQ wiring.
2. Service binding proxy model for frontend -> API Worker.
3. Wrangler environment behavior for non-inheritable binding keys (`vars`, `r2_buckets`, `queues`).

Required plan caveat included in this bundle:

1. Queue-first + R2-only requires an explicit local-dev binding strategy (`wrangler dev` default env vs `wrangler dev --env staging` local simulation), otherwise submit routes can fail due to missing `TTS_QUEUE`/R2 bindings.
