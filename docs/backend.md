# Backend: API Worker

Last updated: 2026-03-03

Utter backend is a Cloudflare Worker API runtime backed by Supabase data/auth.

## Runtime shape

- Entrypoint: `workers/api/src/index.ts`
- Router: Hono, base path `/api`
- Bindings/config: `workers/api/src/env.ts`, `workers/api/wrangler.toml`
- Queue consumer: exported from the same Worker (`queue(...)` handler)

## Route surface

All routes are mounted under `/api`.

- Health and metadata
  - `GET /health`
  - `GET /languages`
- Auth/profile
  - `GET /me`
  - `PATCH /profile`
- Voice clone and voices
  - `POST /clone/upload-url`
  - `POST /clone/finalize`
  - `GET /voices`
  - `GET /voices/:id/preview`
  - `DELETE /voices/:id`
- Voice design
  - `POST /voices/design/preview`
  - `POST /voices/design`
- Generation lifecycle
  - `POST /generate`
  - `GET /tasks/:id` (read-only status/result)
  - `POST /tasks/:id/cancel`
  - `DELETE /tasks/:id`
  - `GET /generations`
  - `GET /generations/:id/audio`
  - `DELETE /generations/:id`
  - `POST /generations/:id/regenerate`
- Credits and billing
  - `GET /credits/usage`
  - `POST /billing/checkout`
  - `POST /webhooks/stripe`
- Storage signed proxy (R2 token flow)
  - `PUT /storage/upload`
  - `POST /storage/upload`
  - `GET /storage/download`
- Transcription
  - `POST /transcriptions`

## Auth and data access model

1. Protected routes require `Authorization: Bearer <supabase-access-token>`.
2. User-scoped reads/writes use Supabase anon key + forwarded JWT (RLS enforced).
3. Privileged server-owned operations use Supabase service-role key.
4. Stripe webhook route is signature-authenticated, not user-authenticated.

## Queue model

Queue wiring lives in:
- Producer: `workers/api/src/queues/producer.ts`
- Message contracts: `workers/api/src/queues/messages.ts`
- Consumer: `workers/api/src/queues/consumer.ts`

Active message types:
- `generate.qwen.start`
- `design_preview.qwen.start`

Behavior:
- submit routes enqueue work and return
- queue consumer handles provider execution + finalization
- `GET /tasks/:id` performs no provider polling and no writes

## Storage model

Storage adapter lives in `workers/api/src/_shared/storage.ts`.

- R2-only runtime path
- Explicit failure when `R2_REFERENCES`/`R2_GENERATIONS` bindings are missing
- Signed storage token flow is HMAC-based using `STORAGE_SIGNING_SECRET`

## Key operational files

- `workers/api/wrangler.toml`: env vars + R2 + Queue bindings
- `workers/api/.dev.vars.example`: local var template
- `workers/api/README.md`: package-level deploy notes
- `docs/security/audits/2026-03-02/`: migration audit evidence
