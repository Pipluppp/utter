# Cloudflare Hybrid Migration - Phase 04 Audit

Date: 2026-03-02  
Scope: Queue Q1/Q2 staging hardening for Qwen-first rollout

## 1) Implemented changes

Queue runtime modules:

1. `workers/api/src/queues/messages.ts`
2. `workers/api/src/queues/producer.ts`
3. `workers/api/src/queues/consumer.ts`

Route integration (Qwen-first path):

1. `workers/api/src/routes/generate.ts`
   - qwen branch enqueues `generate.qwen.start` when queue flag/binding is enabled.
2. `workers/api/src/routes/design.ts`
   - qwen design-preview branch enqueues `design_preview.qwen.start` when queue flag/binding is enabled.
3. `workers/api/src/index.ts`
   - queue handler exported alongside `fetch`.

Hardening update:

1. `workers/api/src/queues/consumer.ts`
   - retry classification implemented:
     - transient classes -> `message.retry(...)` with backoff
     - non-retry/config/validation classes -> `message.ack()`
   - reason-coded queue failure logs added.

Config/env:

1. `workers/api/wrangler.toml`
   - `QWEN_MAX_TEXT_CHARS="100"` for staging and production vars
   - staging queue producer/consumer bindings
2. `workers/api/src/env.ts`
3. `workers/api/.dev.vars.example`

Modal note:

1. Modal queue code remains in repo but is out of active rollout scope per current direction.

## 2) Staging queue resources and deployment

Created queues:

1. `tts-jobs-staging`
2. `tts-jobs-dlq-staging`

Deployment:

```bash
cd workers/api
npx wrangler deploy --env staging
```

Current result:

1. URL: `https://utter-api-staging.duncanb013.workers.dev`
2. Version ID: `2724876d-81dc-42cf-87eb-34ce85c8f3c3`
3. Queue topology (`wrangler queues info tts-jobs-staging`):
   - producers: `worker:utter-api-staging` (`1`)
   - consumers: `worker:utter-api-staging` (`1`)

## 3) Smoke transcript (Qwen queue flow)

Authenticated staging smoke (temporary test user):

1. `POST /api/voices/design/preview` -> pending then terminal `completed`.
2. `POST /api/voices/design` with completed preview task -> `200` (voice saved).
3. `POST /api/generate` with `101` chars -> `400` (`Text cannot exceed 100 characters`).
4. `POST /api/generate` with compliant text -> queued then terminal `completed`.

Interpretation:

1. Qwen producer enqueue path is active.
2. Consumer processes qwen design-preview + generate to terminal completion.
3. Char-cap guard is enforced in runtime (`100`).

## 4) Duplicate-delivery and idempotency evidence

Service-role evidence run against staging Supabase project:

1. `credit_apply_event` duplicate idempotency key:
   - first call: `applied=true, duplicate=false`
   - second call: `applied=false, duplicate=true`
   - no second balance mutation.
2. `billing_events` duplicate provider event insert:
   - first insert: `201`
   - second insert: `409` (unique constraint on `provider_event_id`).
3. Billing grant idempotency key simulation (`stripe:event:<id>:grant`) via `credit_apply_event`:
   - first call applied
   - second call duplicate
   - ledger query showed a single row for the idempotency key.

## 5) Latency/error comparison (heavy routes)

Compared baseline Supabase Edge API vs staging Worker API with equivalent authenticated test flows.

Targets:

1. Baseline: `https://jgmivviwockcwjkvpqra.supabase.co/functions/v1/api`
2. Worker: `https://utter-api-staging.duncanb013.workers.dev/api`

Observed timings (ms):

1. Supabase Edge:
   - design preview start: ~1477
   - design preview terminal: ~6846
   - voice save: ~1888
   - generate start: ~1391
   - generate terminal: ~3522
2. Worker API:
   - design preview start: ~1330
   - design preview terminal: ~10742
   - voice save: ~1394
   - generate start: ~1273
   - generate terminal: ~5194

Interpretation:

1. Both targets reached terminal `completed` in observed runs.
2. Worker enqueue start latency was comparable/slightly better in sampled run.
3. Terminal completion latency is dominated by upstream provider runtime and remains variable.

## 6) Validation status

Passed:

1. Queue topology and bindings verified.
2. Qwen queue-backed preview + generate completed in staging.
3. Retry classification hardening implemented in queue consumer.
4. Duplicate-delivery/idempotency evidence captured for credits/billing primitives.
5. Heavy-route latency/error comparison captured.
6. Qwen generate hard cap enforcement validated (`101` chars -> `400`).

## 7) Rollback note

Queue rollback is config-only:

1. Set `QUEUE_GENERATE_ENABLED=false`.
2. Set `QUEUE_DESIGN_PREVIEW_ENABLED=false`.
3. Redeploy worker.

Because route code retains non-queue fallback, disabling queue flags restores in-request behavior.

## 8) Remaining actions

1. Complete production env/secrets sync and production smoke.
2. Keep production cutover gate explicit for queue readiness and monitoring.
