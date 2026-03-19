# API Rate-Limit Hardening

Refactor backend abuse control so Supabase remains the durable application/business limiter, but not the first gate every public API request hits.

## Problem

The current API rate limiter is structurally sound, but it sits too early in the request path:

- request hits Worker
- Worker calls Supabase RPC to check/increment the counter
- only then does route logic continue or reject

That means scanner and bot traffic becomes Supabase traffic.

The current implementation also has two known gaps:

- rate-limit identity is IP-only in practice
- `x-forwarded-for` is trusted before `cf-connecting-ip`

## Goal

Shift the architecture to:

1. Cloudflare/domain protections first
2. Worker-native coarse limiter second
3. Supabase-backed durable business limiter third

## Files

| File | Purpose |
|---|---|
| `api-rate-limit-hardening-plan.md` | Implementation plan, sequencing, verification, rollback |
| `execution-prompt.md` | Kickstart prompt for implementation in a fresh chat |

## Current Status

Planned on 2026-03-19.

## Manual Touchpoints

This workstream may need a user pause if:

- Cloudflare rate-limit binding namespace IDs cannot be safely chosen from repo context alone
- the implementer wants dashboard confirmation of current branded-domain rate-limit rules before final tuning

## Read First

1. `../../01-api-worker-privatization/README.md`
2. `../../01-api-worker-privatization/api-worker-privatization-plan.md`
3. `../../2026-03-18/cloudflare-security/implementation-audit-2026-03-19.md`
