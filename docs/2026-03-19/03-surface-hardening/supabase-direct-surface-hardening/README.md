# Supabase Direct Surface Hardening

Harden the parts of the app that still talk directly to `jgmivviwockcwjkvpqra.supabase.co`, especially Auth and any remaining public Data API exposure.

## Context

Cloudflare can protect your own Workers and branded domain, but it does not sit in front of direct browser requests to Supabase-hosted HTTPS APIs.

In this repo:

- browser auth still uses `@supabase/supabase-js` directly
- app data/actions primarily go through your own `/api/*`

That means Supabase Auth must be treated as its own direct surface.

## Goal

Make the direct Supabase path deliberate and hardened:

- Auth rate limits reviewed and tuned
- CAPTCHA/Turnstile verified end-to-end
- direct Data API posture reviewed for unnecessary exposure
- network restrictions documented correctly as database-only, not HTTPS API protection

## Files

| File | Purpose |
|---|---|
| `supabase-direct-surface-hardening-plan.md` | Implementation plan and manual checkpoints |
| `execution-prompt.md` | Kickstart prompt for implementation in a fresh chat |

## Manual Touchpoints

This workstream is expected to require Supabase dashboard or Management API interaction.

Likely manual checkpoints:

- Auth rate-limit settings
- CAPTCHA / Turnstile settings
- any review of exposed schemas or API posture that cannot be confirmed from repo alone
