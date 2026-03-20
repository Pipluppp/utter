# Phase 01 + 02 Scaffold Progress

Date: 2026-03-02

## Completed

1. Added frontend Worker package for SPA hosting + API proxy:
   - `workers/frontend/wrangler.toml`
   - `workers/frontend/src/index.ts`
   - `workers/frontend/README.md`
2. Added Worker API package:
   - `workers/api/wrangler.toml`
   - `workers/api/src/index.ts`
   - `workers/api/src/env.ts`
   - `workers/api/src/routes/*` fully ported from Supabase Edge Functions
   - `workers/api/src/_shared/*` runtime/shared helpers ported and adapted
   - middleware parity for CORS + request-id + rate-limit RPC
3. Added runtime env bridge for Worker bindings:
   - `workers/api/src/_shared/runtime_env.ts`
4. Added WSL bootstrap helper:
   - `scripts/cloudflare-migration/bootstrap-auth.sh`
5. Added root npm convenience scripts:
   - `cf:bootstrap:wsl`
   - `cf:pages:build`
   - `cf:worker:install`
   - `cf:worker:dev`
   - `cf:worker:check`
   - `cf:worker:types`
6. Added parity test harness toggle:
   - `supabase/functions/tests/_helpers/setup.ts` now supports `API_URL` override
7. Added Phase 01/02 evidence artifacts:
   - `docs/security/audits/2026-03-02/cloudflare-hybrid-phase-01.md`
   - `docs/security/audits/2026-03-02/cloudflare-hybrid-phase-02.md`

## Remaining for full migration

1. Production binding/secrets finalization:
   - configure `env.production.r2_buckets` in `workers/api/wrangler.toml`
   - set production `STORAGE_SIGNING_SECRET`
2. Phase 04 production queue rollout toggles and post-cutover monitoring.
3. Production smoke/parity rerun with final domain and env settings.

## Current next implementation step

Finish production-readiness gates and rollout notes now that staging queue hardening evidence is captured.

## Phase 03 progress snapshot (2026-03-02)

1. Added storage adapter and mode flagging:
   - `workers/api/src/_shared/storage.ts`
   - `STORAGE_PROVIDER=supabase|hybrid|r2`
2. Added signed storage proxy endpoints:
   - `PUT/POST /api/storage/upload`
   - `GET /api/storage/download`
3. Refactored storage touchpoints to adapter-backed calls:
   - `clone.ts`, `design.ts`, `generate.ts`, `generations.ts`, `tasks.ts`, `voices.ts`
4. Updated Worker env/config templates:
   - `workers/api/src/env.ts`
   - `workers/api/wrangler.toml`
   - `workers/api/.dev.vars.example`
5. Re-ran baseline + Worker parity suites (`128/128` each) with no regressions in `supabase` mode.
6. Deployed staging Worker with `STORAGE_PROVIDER=r2` and staging R2 bindings.
7. Validated staging R2 write/read/delete/signing flows (see `docs/security/audits/2026-03-02/cloudflare-hybrid-phase-03.md`).
8. Switched staging to `STORAGE_PROVIDER=hybrid` for legacy object read parity.
9. Fixed frontend Worker API-proxy redirect passthrough + forwarded-host wiring so protected media URLs resolve on public Worker domain.
