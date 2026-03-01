# Cloudflare Migration Plan (Hybrid)

Date: 2026-03-02  
Status: Planning

## Target architecture

- Frontend: Cloudflare Pages/Workers
- API runtime: Cloudflare Workers + Hono
- Storage: Cloudflare R2
- Database/Auth: Supabase Postgres + RLS + Auth + existing RPCs

## Verified guidance references

- Cloudflare Supabase integration:
  https://developers.cloudflare.com/workers/databases/third-party-integrations/supabase/
- Supabase Cloudflare partner page (high-level pointer):
  https://supabase.com/partners/integrations/cloudflare-workers
- Verification notes for this plan:
  [cloudflare-supabase-integration-verified.md](./cloudflare-supabase-integration-verified.md)
- Standalone queues migration plan:
  [cloudflare-queues-migration-plan.md](./cloudflare-queues-migration-plan.md)

## Non-goals

- No D1 migration in this phase
- No Better Auth migration in this phase
- No credits ledger rewrite

## Phase 0: Baseline and safety

1. Capture current API latency/error baseline from production logs.
2. Snapshot critical flows:
   - signup/signin
   - generate + polling + audio playback
   - clone upload-url + finalize
   - design preview + save
   - billing checkout + webhook processing
3. Prepare rollback toggles:
   - frontend host switch
   - API base route switch
   - storage adapter switch (Supabase Storage vs R2)

Acceptance:
- Baseline report exists and can be compared post-cutover.

## Phase 1: Frontend hosting to Cloudflare

1. Deploy existing Vite output to Pages.
2. Preserve SPA fallback behavior for non-asset routes.
3. Route `/api/*` to current Supabase Edge Function backend initially.
4. Update API CORS allowlist + Supabase Auth redirect allowlist for Pages/custom domains.

Acceptance:
- No frontend behavior regression.
- Auth pages and account pages function unchanged.

Rollback:
- Point DNS/app back to Vercel deployment.

## Phase 2: API runtime to Cloudflare Workers

1. Port `supabase/functions/api` Hono app to Workers runtime.
2. Replace Deno-specific runtime usages with Workers equivalents.
3. Keep route paths and response shapes unchanged.
4. Keep Supabase clients:
   - user-scoped client for RLS reads
   - service-role client for privileged writes and RPCs
5. Keep Stripe webhook route behavior and idempotency unchanged.
6. Configure Worker secrets/bindings for:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
7. On Cloudflare Free, do not production-cutover with Qwen long-running `waitUntil` paths still active; ship Queue Q1 in same rollout train.

Acceptance:
- Contract parity for all `/api/*` endpoints.
- Credits/billing tests pass against staging.
- No regression in unauthorized/forbidden behavior.

Rollback:
- Repoint `/api/*` back to Supabase Edge Function endpoint.

## Phase 3: Storage migration to R2

1. Introduce storage abstraction layer in API code.
2. Migrate operations used today:
   - signed upload URL creation
   - server-side object upload
   - signed download URL generation
   - delete/list operations
3. Keep DB object key model unchanged (`<user_id>/...`).
4. For this pre-production stage, use full `r2` mode (no mandatory backfill/dual-read).

Acceptance:
- Upload/download/delete flows work for `references` and `generations`.
- Audio playback paths remain stable for frontend.
- New data paths are fully served from R2.

Rollback:
- Flip storage adapter to Supabase Storage and disable R2 paths.

## Phase 4: Hardening and optimization

1. Add observability and error tagging per route.
2. Move selected async/background operations to Cloudflare Queues where helpful.
3. Evaluate optional DO usage only for real-time coordination needs.

Acceptance:
- Stable error rates and p95/p99 vs baseline.
- Background retries reduce transient provider failures.

## Execution order recommendation

1. Frontend host migration
2. API runtime migration
3. Storage migration
4. Queue/DO optimizations

This order keeps DB/Auth/credits risk low while still moving most infrastructure to Cloudflare.
