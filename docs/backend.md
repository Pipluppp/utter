# Backend

Read this when you need the API Worker surface and queue model.

## Runtime Shape

- Entrypoint: `workers/api/src/index.ts`
- Framework: Hono
- Base path: `/api`
- Queue consumer: same Worker export via `queue(...)`
- Main config: `workers/api/wrangler.toml`, `workers/api/src/env.ts`

## Route Files

- `clone.ts`
- `generate.ts`
- `design.ts`
- `voices.ts`
- `generations.ts`
- `tasks.ts`
- `storage.ts`
- `credits.ts`
- `billing.ts`
- `transcriptions.ts`
- `languages.ts`
- `me.ts`

## Route Surface

### Health and metadata

- `GET /health`
- `GET /languages`

### Auth and profile

- `GET /me`
- `PATCH /profile`

### Clone and voices

- `POST /clone/upload-url`
- `POST /clone/finalize`
- `GET /voices`
- `GET /voices/:id/preview`
- `DELETE /voices/:id`

### Design

- `POST /voices/design/preview`
- `POST /voices/design`

### Generations and tasks

- `POST /generate`
- `GET /tasks`
- `GET /tasks/:id`
- `POST /tasks/:id/cancel`
- `DELETE /tasks/:id`
- `GET /generations`
- `GET /generations/:id/audio`
- `DELETE /generations/:id`
- `POST /generations/:id/regenerate`

### Credits and billing

- `GET /credits/usage`
- `POST /billing/checkout`
- `POST /webhooks/stripe`

### Storage and transcription

- `PUT /storage/upload`
- `POST /storage/upload`
- `GET /storage/download`
- `POST /transcriptions`

## Auth Model

- Protected routes require `Authorization: Bearer <supabase access token>`.
- User-scoped reads go through the user client and RLS.
- Server-owned writes, queue processing, and RPCs use the service role client.
- Stripe webhook auth is signature-based, not JWT-based.

## Queue Model

Key files:

- `workers/api/src/queues/producer.ts`
- `workers/api/src/queues/messages.ts`
- `workers/api/src/queues/consumer.ts`

Message types:

- `generate.qwen.start`
- `design_preview.qwen.start`

Rules:

- submit routes enqueue and return
- queue consumer performs provider execution and persistence
- task polling routes do not reach out to providers

## Storage Model

- R2 bindings: `R2_REFERENCES`, `R2_GENERATIONS`
- Signed URL logic lives in `workers/api/src/_shared/storage.ts`
- Reference and generation audio are addressed by object key and resolved to signed URLs at read time

## Billing and Credits Touchpoints

- credit charge and refund logic: `workers/api/src/_shared/credits.ts`
- billing routes: `workers/api/src/routes/billing.ts`
- DB ledger and trial RPCs live in Supabase migrations

## Important Runtime Flags

- `VOICE_DESIGN_ENABLED`
- `QWEN_VC_TARGET_MODEL`
- `QWEN_VD_TARGET_MODEL`
- `QWEN_ASR_MODEL`
- `QUEUE_BILLING_ENABLED`

## Invariants

- Frontend contract stays under `/api/*`.
- Queue-backed job routes must be safe to retry.
- Cancellation must not be overwritten by later worker steps.
- Missing bindings should fail clearly, not silently degrade.

## Read Next

- [architecture.md](./architecture.md)
- [database.md](./database.md)
- [workers/api/README.md](../workers/api/README.md)
