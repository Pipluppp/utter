# Cloudflare + Supabase Integration (Verified Notes)

Date verified: 2026-03-02

This document validates the migration plan against current official Cloudflare and Supabase guidance.

## 1) Official integration paths (Cloudflare docs)

Cloudflare documents two valid ways to use Supabase from Workers:

1. Supabase APIs via `@supabase/supabase-js` (HTTP path)
2. Direct Postgres via Hyperdrive + Postgres driver (SQL/TCP path)

For this migration phase, path (1) is the intended fit.

References:
- https://developers.cloudflare.com/workers/databases/third-party-integrations/supabase/

## 2) Important deprecation to account for

Cloudflare removed the old Workers dashboard "Integrations" tab on 2025-06-03. Setup should now use docs + Wrangler/env configuration, not legacy UI-based integration steps.

Reference:
- https://developers.cloudflare.com/changelog/2025-06-03-workers-integrations/

## 3) Supabase architecture alignment

Supabase supports both:

1. Two-tier: frontend directly calls Supabase
2. Three-tier: frontend -> backend API -> Supabase

Utter intentionally uses three-tier for app data (`/api/*`) while still using frontend Supabase Auth SDK for session lifecycle. This remains a valid and recommended architecture for complex business logic.

References:
- https://supabase.com/docs/guides/api/quickstart
- https://supabase.com/docs/guides/api/api-keys

## 4) What this means for Utter's migration

Validated decisions:

1. Keep frontend app-data calls on `/api/*` (Worker BFF pattern).
2. Keep Supabase Postgres/RLS/Auth and existing credits/billing RPC semantics.
3. Port API runtime from Supabase Edge Functions to Cloudflare Workers.
4. Migrate object storage to R2 behind a storage adapter.
5. Defer Hyperdrive unless direct SQL performance needs justify query-layer rewrite.

## 5) Worker implementation guardrails with Supabase

1. Use environment secrets for:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY` (for user-scoped reads with bearer token)
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only privileged writes/RPC)
2. Never expose `SUPABASE_SERVICE_ROLE_KEY` to frontend code.
3. Preserve user JWT forwarding (`Authorization: Bearer ...`) from frontend -> Worker -> Supabase user-scoped client where RLS should apply.
4. Keep service-role usage limited to explicit server-owned operations (tasks finalization, billing, credits, storage coordination).

Reference:
- https://supabase.com/docs/guides/api/api-keys

## 6) Postgres correctness/performance checks to keep

From Supabase/Postgres best-practice guidance, keep the following constraints unchanged during migration:

1. Keep transactions short; do not hold DB locks while waiting on external APIs.
2. Keep indexes on columns used in RLS and common filters (for Utter: user-scoped access patterns).
3. Keep RLS policy performance pattern `(select auth.uid())` where applicable.

References:
- https://supabase.com/docs/guides/database/postgres/row-level-security#rls-performance-recommendations
- https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler

## 7) Partner page caveat

Supabase's partner/integration page can lag behind Cloudflare platform changes (for example, references to old integration UX). Treat it as a high-level integration pointer and rely on Cloudflare product docs/changelog for current implementation steps.

Reference:
- https://supabase.com/partners/integrations/cloudflare-workers
