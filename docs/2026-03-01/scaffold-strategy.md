# Scaffold Strategy: Keep Current Shape, Swap Runtime

Date: 2026-03-02

## Principle

Preserve the existing application contract and folder mental model as much as possible.
Migrate platform runtime and adapters, not product behavior.

## Keep unchanged

1. Frontend `/api/*` call contract and response shapes.
2. Supabase Auth on frontend for session/token lifecycle.
3. Supabase DB schema, RLS policies, and credits/billing RPC usage.
4. Route-level business logic in Hono handlers.

## Change with minimal churn

1. Runtime entrypoint:
   - from Supabase Edge Function (`Deno.serve`)
   - to Cloudflare Worker fetch handler
2. Env and bindings:
   - from `Deno.env.get(...)`
   - to Worker `env` bindings
3. Storage adapter:
   - from Supabase Storage SDK calls
   - to R2 operations and signed URL helpers

## Suggested directory approach

1. Keep current API route modules and shared logic.
2. Add a Cloudflare Worker app package (or `workers/` folder) that reuses route logic.
3. Introduce a storage interface (`StorageProvider`) with two implementations:
   - `SupabaseStorageProvider`
   - `R2StorageProvider`
4. Wire provider selection through environment configuration.

## Contract discipline

1. Do not change endpoint paths during migration.
2. Do not change frontend request payloads unless strictly required.
3. Keep existing error message patterns where feasible.
4. Add contract tests around top routes before refactors.

## Why this matters

This scaffold-first strategy keeps migration incremental and reversible, and lowers regression risk in credits, billing, and task orchestration flows.
