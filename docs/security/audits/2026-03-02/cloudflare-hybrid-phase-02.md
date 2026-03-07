# Cloudflare Hybrid Migration - Phase 02 Audit

Date: 2026-03-02
Scope: API runtime port from Supabase Edge Functions to Cloudflare Workers (Phase 02 only)

## 1) Deployed environment URLs

1. Worker (staging): `https://utter-api-staging.duncanb013.workers.dev`
2. Worker API base: `https://utter-api-staging.duncanb013.workers.dev/api`
3. Local Supabase baseline API: `http://127.0.0.1:54321/functions/v1/api`
4. Local Worker API target: `http://127.0.0.1:8787/api`

Deployment command used:

```bash
cd workers/api
npx wrangler deploy --env staging
```

Deployment result:

- Worker name: `utter-api-staging`
- Version ID: `2724876d-81dc-42cf-87eb-34ce85c8f3c3`
- Staging secrets populated for API runtime boot:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`

## 2) Smoke test transcript (request/response summary)

Staging smoke (`workers.dev`):

1. `GET /api/health` -> `200` + `{ "ok": true }`
2. `GET /api/languages` -> `200` with languages/provider/capabilities payload
3. `GET /api/me` (no auth) -> `200` + `{ "signed_in": false, "user": null, "profile": null }`
4. `POST /api/generate` (no auth) -> `401` + `Missing authorization header`
5. `POST /api/clone/upload-url` (no auth) -> `401` + `Missing authorization header`
6. `GET /api/credits/usage` (no auth) -> `401` + `Missing authorization header`
7. `OPTIONS /api/generate` preflight with `Authorization` header -> `204` + expected CORS headers

## 3) Baseline vs Worker parity runs

Baseline suite (Supabase Edge API):

```bash
cd supabase/functions/tests
deno test --allow-net --allow-env --allow-read .
```

Result: `128 passed | 0 failed` (about 19s)

Worker-target suite (same tests, API override):

```bash
cd supabase/functions/tests
API_URL=http://127.0.0.1:8787/api deno test --allow-net --allow-env --allow-read .
```

Result: `128 passed | 0 failed` (about 22s)

Notes:

1. Initial Worker run exposed a local signed-upload URL rewrite issue in clone finalize tests.
2. Fix applied in `workers/api/src/_shared/urls.ts` to keep local storage signed URLs on Supabase storage origin.
3. Re-run after fix reached full parity (`128/128`).
4. Additional hardening applied in `workers/api/src/_shared/storage.ts`:
   - direct API requests derive signed URL origin from request URL
   - forwarded host/proto is only used for service-binding (`api.internal`) requests.

## 4) Error-rate and latency comparison vs baseline

Local parity suite comparison (same test matrix):

1. Error rate:
   - Baseline: `0/128` failed
   - Worker: `0/128` failed
2. End-to-end suite runtime:
   - Baseline: ~19s
   - Worker: ~22s
3. Interpretation:
   - No observed functional regression in covered API contract tests.
   - Minor local runtime overhead in Worker test harness versus baseline.

## 5) Rollback verification note

Rollback procedure validated at config level:

1. Repoint `/api/*` routing back to Supabase Edge Function endpoint.
2. Re-run smoke checks:
   - `GET /api/health`
   - `POST /api/generate` (no auth -> 401)
   - `POST /api/clone/upload-url` (no auth -> 401)
   - `GET /api/credits/usage` (no auth -> 401)

Operational rollback path remains low-risk because route contracts were kept unchanged.

## 6) Production gate reminder

Phase 02 production cutover remains blocked until Queue Q1 is shipped in the same rollout train (or approved paid-plan exception), per `docs/2026-03-01/implementation-phase-02-workers-api-port.md`.
