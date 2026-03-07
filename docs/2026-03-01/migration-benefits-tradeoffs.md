# Migration Benefits and Tradeoffs (Concise)

Date: 2026-03-02

## Why this hybrid migration is attractive

1. Consolidates frontend + API runtime on Cloudflare.
2. Keeps strongest existing correctness layer (Supabase Postgres + RLS + RPCs).
3. Gains R2 storage headroom and zero-egress model for audio delivery.
4. Avoids highest-risk rewrites (auth provider swap, ledger transaction redesign).

## Practical improvements expected

1. Simpler edge deployment topology for frontend/API routes.
2. Faster/static asset delivery and flexible edge routing.
3. Cleaner async processing options using Cloudflare Queues (for retries/fanout).
4. Continued use of proven Supabase Auth and DB controls.

## Key tradeoffs

1. Two-vendor architecture remains (Cloudflare + Supabase).
2. Cross-provider network hop persists between Worker and Supabase APIs.
3. Worker free-plan CPU limits can constrain heavy routes.
4. Storage migration still requires careful path/signing parity work.

## Why not full migration now

1. Credits ledger and billing correctness currently depend on Postgres/RPC semantics.
2. Auth replacement adds complexity with little short-term product value.
3. A staged migration captures most infra wins with much lower risk.

## Decision summary

For Utter’s current maturity and risk profile, this hybrid plan is the highest ROI path:

- maximize migration value (frontend/API/storage)
- minimize correctness risk (keep DB/Auth/ledger on Supabase)
