# DB and Auth Impact (Supabase Retained)

Date: 2026-03-02

## Core decision

Keep Supabase Postgres/Auth as the source of truth while migrating frontend/API/storage runtime to Cloudflare.

Supabase supports both direct frontend data access and backend-mediated ("three-tier") access patterns. Utter remains on three-tier for app data while retaining frontend Supabase Auth SDK usage.

## What stays unchanged

1. Postgres schema and migrations (`supabase/migrations`).
2. RLS policy model and grants.
3. RPC/SQL function semantics for credits and trials:
   - `credit_apply_event`
   - `trial_or_debit`
   - `trial_restore`
4. Billing event tables and idempotency model.
5. Frontend Supabase Auth session lifecycle.

## What changes

1. API compute host changes (Supabase Edge Function -> Cloudflare Worker).
2. API environment and secret wiring changes.
3. Storage backend changes (Supabase Storage -> R2) for object operations.

## Call-flow model after migration

1. Frontend -> `/api/*` on Worker for app data/actions.
2. Worker -> Supabase PostgREST/RPC for DB operations.
3. Frontend -> Supabase Auth SDK for auth/session flows.
4. Worker -> R2 for object upload/download/delete/signing flows.

## Security implications

1. RLS remains an active defense layer for user-scoped reads.
2. Worker remains authorization and orchestration layer for sensitive writes.
3. Service-role credentials stay server-side only.
4. Keep strict separation of:
   - user-scoped DB client
   - service-role DB client

## Operational implications

1. Existing DB tests and security checks remain valuable with minimal changes.
2. Add integration tests covering Worker runtime differences.
3. Monitor cross-provider latency and retry behavior for Worker -> Supabase calls.

## Deferred work

1. Any D1/DO-ledger redesign.
2. Any Better Auth migration.
3. Any RLS model simplification tied to direct-frontend data access.
