# Cloudflare Supabase Proxy

Document the current split between:

- browser requests that still go directly to Supabase
- browser requests that already go through `uttervoice.com/api/*` and Cloudflare Workers

This workstream exists to prepare a follow-up implementation that moves Supabase Auth off the direct browser path and behind the Cloudflare Worker layer.

## Goal

Establish verified ground truth for three questions:

1. Which current frontend flows expose the Supabase project URL and publishable key?
2. Which Supabase HTTPS APIs can still be invoked directly with the publishable key, even if RLS blocks data?
3. What architecture and implementation work is required to move Auth behind Cloudflare so the deployed browser app no longer ships the Supabase project URL and publishable key?

## Files

| File | Purpose |
|---|---|
| `cloudflare-supabase-proxy-research-verification.md` | Verified matrix and evidence from repo plus live checks |
| `live-network-audit.md` | Chrome DevTools per-page network audit confirming only Auth calls hit Supabase directly |
| `cloudflare-supabase-auth-proxy-plan.md` | Implementation plan for moving Auth behind Cloudflare Workers |
| `execution-prompt.md` | Kickstart prompt for implementation in a fresh chat |

## Current Status

Planned and documented on 2026-03-19.

## Manual Touchpoints

This workstream is expected to require user-interrupted dashboard checks for:

- Supabase Auth settings and redirect URLs
- CAPTCHA / Turnstile server-side settings
- any cookie, caching, or route behavior that must be verified on deployed Cloudflare infrastructure

## Read First

1. `../01-api-worker-privatization/README.md`
2. `../03-surface-hardening/supabase-direct-surface-hardening/README.md`
3. `../../2026-02-23/security-supabase/README.md`
