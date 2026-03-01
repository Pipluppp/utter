# Cloudflare Hybrid Migration - Phase 03 Audit

Date: 2026-03-02  
Scope: Storage adapter and R2 cutover wiring in Worker API runtime (Phase 03)

## 1) Implementation summary

Implemented Phase 03 storage runtime wiring in `workers/api`:

1. Added storage abstraction with runtime mode switching:
   - `workers/api/src/_shared/storage.ts`
   - modes: `supabase`, `hybrid`, `r2`
2. Added signed storage proxy endpoints:
   - `PUT/POST /api/storage/upload`
   - `GET /api/storage/download`
   - file: `workers/api/src/routes/storage.ts`
3. Mounted storage routes in Worker app:
   - `workers/api/src/index.ts`
4. Switched storage-touching routes to adapter-backed operations:
   - `workers/api/src/routes/clone.ts`
   - `workers/api/src/routes/design.ts`
   - `workers/api/src/routes/generate.ts`
   - `workers/api/src/routes/generations.ts`
   - `workers/api/src/routes/tasks.ts`
   - `workers/api/src/routes/voices.ts`
5. Updated Worker bindings/templates:
   - `workers/api/src/env.ts`
   - `workers/api/wrangler.toml`
   - `workers/api/.dev.vars.example`

## 2) Validation transcript

Worker runtime checks:

```bash
npm --prefix workers/api run types
npm --prefix workers/api run typecheck
npm --prefix workers/api run check
```

Result: all pass.

Contract parity suites:

Baseline (Supabase API):

```bash
cd supabase/functions/tests
deno test --allow-all --config deno.json .
```

Result: `128 passed | 0 failed` (~25s)

Worker target (local Worker API):

```bash
cd workers/api
npm run dev

cd supabase/functions/tests
API_URL=http://127.0.0.1:8787/api deno test --allow-all --config deno.json .
```

Result: `128 passed | 0 failed` (~27s)

## 3) R2 staging deployment status

Current status:

1. Phase 03 execution and validation was completed in true `STORAGE_PROVIDER="r2"` mode.
2. Staging has since been switched to `STORAGE_PROVIDER="hybrid"` to preserve playback parity for legacy Supabase-only objects while continuing R2 writes.

Deployment:

```bash
cd workers/api
npx wrangler deploy --env staging
```

Result:

1. URL: `https://utter-api-staging.duncanb013.workers.dev`
2. Version ID: `3dc0b413-0575-4a73-a8a2-3db1775b1273`
3. Runtime vars/bindings confirmed on deploy:
   - `STORAGE_PROVIDER="r2"`
   - `R2_REFERENCES -> utter-references-staging`
   - `R2_GENERATIONS -> utter-generations-staging`
4. Staging secrets:
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (already present)
   - `STORAGE_SIGNING_SECRET` (set for smoke, then rotated to strong random)

Compatibility follow-up deploy:

```bash
cd workers/api
npx wrangler deploy --env staging
```

Result:

1. URL unchanged: `https://utter-api-staging.duncanb013.workers.dev`
2. Version ID: `c44e96ac-51a9-49e9-a2ec-0621e357df6e`
3. Runtime var now: `STORAGE_PROVIDER="hybrid"`

Latest follow-up deploy (origin hardening + parity fixes):

```bash
cd workers/api
npx wrangler deploy --env staging
```

Result:

1. URL unchanged: `https://utter-api-staging.duncanb013.workers.dev`
2. Version ID: `2724876d-81dc-42cf-87eb-34ce85c8f3c3`
3. Signed storage origin derivation hardened for direct vs service-binding request paths.

## 4) Staging smoke transcript (R2 flows)

Public smoke:

1. `GET /api/health` -> `200` `{ "ok": true }`
2. `GET /api/languages` -> `200`
3. `GET /api/me` (no auth) -> `200` `signed_in:false`
4. `POST /api/clone/upload-url` (no auth) -> `401`
5. `POST /api/generate` (no auth) -> `401`
6. `GET /api/storage/download?token=bad` -> `403`
7. `OPTIONS /api/generate` -> `204` with expected `Authorization` CORS headers

R2 proxy endpoint smoke (signed token path):

1. `PUT /api/storage/upload` (`bucket=references`) -> `200`
2. `GET /api/storage/download` (`bucket=references`) -> `200`, content match
3. `PUT /api/storage/upload` (`bucket=generations`) -> `200`
4. `GET /api/storage/download` (`bucket=generations`) -> `200`, content match
5. Expired signed token -> `403` (`Invalid or expired storage token.`)

Authenticated API smoke on staging (temporary test user):

1. `POST /api/clone/upload-url` -> `200`
2. signed upload URL `PUT` -> `200`
3. `POST /api/clone/finalize` -> `200`
4. `GET /api/voices/:id/preview` -> `302` to `/api/storage/download?...`, fetch -> `200`
5. `POST /api/voices/design` (multipart audio) -> `200` with `preview_url`, fetch -> `200`
6. Seeded generation audio `GET /api/generations/:id/audio` -> `302` to `/api/storage/download?...`, fetch -> `200`
7. `DELETE /api/generations/:id` -> `200`
8. Post-delete signed storage download for same generation key -> `404` (`Object not found.`)

## 5) Error-rate and latency comparison vs baseline

Using the existing parity matrix in `STORAGE_PROVIDER=supabase` mode:

1. Error rate:
   - Baseline: `0/128` failed
   - Worker: `0/128` failed
2. End-to-end suite runtime:
   - Baseline: ~25s
   - Worker: ~27s
3. Interpretation:
   - No API regression observed while introducing the storage adapter layer.
   - Additional staging smoke confirms R2 signed write/read/delete paths are functioning.

## 6) Rollback note

Phase 03 rollback path remains config-only:

1. Set `STORAGE_PROVIDER=supabase`.
2. Keep Worker API code unchanged.
3. Re-run clone/design/generate/history smoke checks.

## 7) Next required actions

1. Finalize production bucket names under `env.production.r2_buckets`.
2. Set production `STORAGE_SIGNING_SECRET`.
3. Keep production cutover blocked on Queue Q1 / Phase 04 gate for long-running Qwen paths on Workers Free.
