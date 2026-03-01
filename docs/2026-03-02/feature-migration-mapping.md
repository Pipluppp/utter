# Feature Migration Mapping

Date: 2026-03-02

## Summary

This mapping tracks each user-facing/backend feature from current implementation to hybrid Cloudflare target.

## Feature matrix

| Feature | Current | Target | Migration notes |
|---|---|---|---|
| Frontend SPA hosting | Vercel | Cloudflare Pages/Workers | Keep same build output and route behavior |
| API routing (`/api/*`) | Vercel rewrite to Supabase Edge Function | Cloudflare Worker Hono API | Keep endpoint paths and payload shapes |
| Auth (sign up/in/out, session) | Frontend Supabase Auth SDK | Same | No provider migration in this phase |
| Voices list/delete/preview | Edge routes + PostgREST + Storage signed URL | Worker routes + Supabase PostgREST + R2 signing | Preserve preview URL contract |
| Clone (upload URL + finalize) | Edge + Supabase Storage | Worker + R2 | Replace signed upload + finalize object writes |
| Generate (create task, debit credits, provider submit) | Edge + Supabase RPC + Modal/Qwen | Worker + same Supabase RPC + providers | Keep idempotent debit/refund flow unchanged |
| Task status polling/finalization | Edge `/tasks/:id` route | Worker `/tasks/:id` route | Optional later move of async retries to Queues |
| Design preview/save | Edge + provider + Storage | Worker + provider + R2 | Preserve trial/debit semantics |
| Generations list/delete/regenerate | Edge + PostgREST + Storage | Worker + PostgREST + R2 | Keep pagination and filter behavior |
| Billing checkout + webhook | Edge + Stripe + billing_events + RPC | Worker + Stripe + billing_events + RPC | Keep webhook idempotency constraints |
| Rate limiting | DB RPC based | Initially same | Optional future DO/edge-native limiter |
| Transcription batch | Edge route | Worker route | Runtime/adapter port only |

## Migration emphasis by risk

1. High risk:
   - Credits debit/refund/trial correctness
   - Billing webhook idempotency
2. Medium risk:
   - R2 signed URL parity
   - Async task finalization behavior
3. Low risk:
   - Frontend hosting swap
   - Hono route runtime port

## Test gates by feature

1. Credits:
   - concurrent debit attempts
   - duplicate idempotency key behavior
2. Billing:
   - duplicate webhook replay
   - processed/ignored/failed event transitions
3. Storage:
   - upload URL validity
   - signed download playback
4. Tasks:
   - pending -> processing -> terminal transitions
   - cancel + refund behavior
