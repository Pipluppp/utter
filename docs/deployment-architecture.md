# Deployment Architecture

Last updated: 2026-03-03

This doc describes the active Cloudflare + Supabase deployment model (simplified stack).

## Environments

## Staging (active)

- Frontend Worker: `utter` (`workers/frontend`)
- API Worker: `utter-api-staging` (`workers/api`)
- API URL: `https://utter-api-staging.duncanb013.workers.dev/api`
- Frontend URL: `https://utter.duncanb013.workers.dev`
- R2 buckets:
  - `utter-references-staging`
  - `utter-generations-staging`
- Queue:
  - `tts-jobs-staging`
  - DLQ: `tts-jobs-dlq-staging`
- Supabase project: `jgmivviwockcwjkvpqra`

## Production (planned/finalizing)

- Same topology as staging with production-named resources.
- Production R2/Queue bindings and secrets are explicit pre-cutover tasks.

## Request routing model

1. Browser requests frontend Worker origin.
2. Frontend Worker serves static assets and SPA routes.
3. `/api/*` requests are forwarded to API Worker via service binding.
4. API Worker talks to Supabase (Auth + Postgres), R2, queues, Stripe, and qwen provider APIs.

## Secrets and bindings

API Worker required secrets:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STORAGE_SIGNING_SECRET`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- provider keys (`DASHSCOPE_API_KEY`, `MISTRAL_API_KEY`)

API Worker variable controls:
- `CORS_ALLOWED_ORIGIN`
- qwen model vars (`DASHSCOPE_REGION`, `QWEN_*`)
- rate-limit tuning envs

## Release gates

1. Contract parity
- `/api/*` route contract and auth/error behavior unchanged for frontend consumers.

2. Security gate
- CORS origin allowlist is explicit for active frontend origins.
- Secrets are set via Wrangler secrets, not committed vars.
- Queue retries/idempotency and billing webhook idempotency verified.

3. Data/storage gate
- R2 object lifecycle tested end-to-end.
- No Supabase Storage runtime fallback paths remain reachable.

4. Queue gate
- async submit routes enqueue only
- queue consumer owns finalization
- `GET /tasks/:id` is read-only

## Evidence links

- Cloudflare migration implementation: `2026-03-01/`
- Phase audit artifacts: `security/audits/2026-03-02/`
- Simplification execution: `2026-03-02/remove-modal-supastorage-queue-simplify/`
