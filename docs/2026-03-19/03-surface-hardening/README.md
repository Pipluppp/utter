# 03 Surface Hardening

This parent directory groups the secondary March 19 hardening tracks that should run after the two primary perimeter changes:

1. `../01-api-worker-privatization/`
2. `../02-cloudflare-supabase-proxy/`

These are related cleanup and strengthening tasks, but they are not the first architectural moves.

## Subtracks

### API Rate-Limit Hardening

- `api-rate-limit-hardening/`

Keep the Supabase durable limiter, but move cheap abuse filtering ahead of it and fix identity handling.

### Supabase Direct Surface Hardening

- `supabase-direct-surface-hardening/`

Review and tune the remaining direct `*.supabase.co` surfaces, especially Auth-side settings and any still-exposed Data API posture.

### Signed Surface Hardening

- `signed-surface-hardening/`

Tighten remaining bearer-style public surfaces such as signed storage URLs and Preview URL behavior.

## Mental Model

Think of this directory as:

- "the hardening package after the perimeter changes are in place"

