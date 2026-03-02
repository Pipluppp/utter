# Deploy Runbook

Last updated: 2026-03-03

Canonical deploy flow for the simplified Cloudflare + Supabase runtime.

## Deploy units

1. Frontend Worker (`workers/frontend`)
2. API Worker (`workers/api`)
3. Cloudflare R2 + Queue bindings used by API Worker
4. Supabase remains system of record (Postgres/Auth/RLS/credits/billing)

## Preconditions

- Wrangler authenticated and targeting the intended Cloudflare account
- Required Worker secrets set for the target environment
- Supabase project and keys correct for the target environment
- Frontend build artifacts generated before frontend Worker deploy

## Staging deploy

1) Build frontend assets

```bash
VITE_SUPABASE_URL=https://<project-ref>.supabase.co \
VITE_SUPABASE_ANON_KEY=<publishable-key> \
npm --prefix frontend run build
```

Note: variable name remains `VITE_SUPABASE_ANON_KEY` for compatibility, but the value should be the current Supabase publishable key.

2) Deploy API Worker

```bash
cd workers/api
npx wrangler deploy --env staging
```

3) Deploy frontend Worker

```bash
cd workers/frontend
npx wrangler deploy --env staging
```

4) Smoke checks

- `GET /api/health` returns 200
- unauthenticated protected routes return 401
- `GET /api/languages` reports `provider: "qwen"`
- clone/design/generate task lifecycle works for a staging test user
- queue-backed routes transition tasks to terminal states via queue consumer
- `GET /api/tasks/:id` is read-only (no provider polling side effects)

## Production cutover checklist

1. Env correctness
- `CORS_ALLOWED_ORIGIN` matches real frontend origins
- qwen config vars set (`DASHSCOPE_REGION`, target model vars)

2. Bindings
- production R2 bindings configured (`R2_REFERENCES`, `R2_GENERATIONS`)
- production queue producer/consumer bindings configured (`TTS_QUEUE` + DLQ)
- remember Wrangler `vars/r2_buckets/queues` are non-inheritable per env

3. Secrets
- set/rotate production values for required secrets
- validate Stripe webhook signing secret and destination

4. Validation
- `npm --prefix workers/api run typecheck`
- `npm --prefix workers/api run check`
- worker-target tests against running local worker
- staging smoke + logs review

## Rollback controls

- API rollback: redeploy previous Worker version
- Frontend rollback: redeploy previous frontend Worker
- Queue incident mode: pause submit traffic and/or operationally drain/replay queue/DLQ
- No Modal or Supabase-Storage runtime rollback switches remain in active architecture

## Reference evidence

- `docs/2026-03-02/remove-modal-supastorage-queue-simplify/`
- `security/audits/2026-03-02/cloudflare-hybrid-phase-01.md`
- `security/audits/2026-03-02/cloudflare-hybrid-phase-02.md`
- `security/audits/2026-03-02/cloudflare-hybrid-phase-03.md`
- `security/audits/2026-03-02/cloudflare-hybrid-phase-04.md`
