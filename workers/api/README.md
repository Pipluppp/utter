# Cloudflare Worker API

This package contains the Phase 02 API runtime port from Supabase Edge Functions to Cloudflare Workers and Phase 03 storage adapter wiring.

Scope:
- Worker runtime entrypoint + middleware parity (CORS, request-id, rate-limit RPC)
- Route contract parity under `/api/*`
- Shared helper parity for Supabase/Auth/Credits/Providers/Billing orchestration
- Storage adapter abstraction for `supabase|hybrid|r2` modes
- Signed storage proxy routes for R2 upload/download flow
- Queue Q1 runtime wiring for qwen async jobs (producer + consumer)

Current status:
- routes are ported from `supabase/functions/api/routes/*`
- qwen async routes enqueue to Cloudflare Queue when queue flags are enabled and `TTS_QUEUE` is bound
- legacy `c.executionCtx.waitUntil(...)` fallback remains available behind queue flags
- R2 staging validation is complete; production bucket/secret finalization is still pending
