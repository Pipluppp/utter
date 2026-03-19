# Cloudflare Supabase Proxy

Document the current split between:

- browser requests that still go directly to Supabase
- browser requests that already go through `uttervoice.com/api/*` and Cloudflare Workers

This workstream exists to prepare a follow-up implementation that moves Supabase Auth off the direct browser path and behind the Cloudflare Worker layer.

## Goal

~~Establish verified ground truth for three questions:~~

~~1. Which current frontend flows expose the Supabase project URL and publishable key?~~
~~2. Which Supabase HTTPS APIs can still be invoked directly with the publishable key, even if RLS blocks data?~~
~~3. What architecture and implementation work is required to move Auth behind Cloudflare so the deployed browser app no longer ships the Supabase project URL and publishable key?~~

**All three questions answered and resolved.** The auth proxy implementation eliminated all direct browser-to-Supabase traffic. The frontend no longer ships the Supabase project URL or publishable key in auth network requests.

## Files

| File | Purpose |
|---|---|
| `cloudflare-supabase-proxy-research-verification.md` | Verified matrix and evidence from repo plus live checks |
| `live-network-audit.md` | Pre-fix Chrome DevTools per-page network audit confirming only Auth calls hit Supabase directly |
| `live-network-audit-post-fix.md` | Post-fix Chrome DevTools per-page network audit confirming zero direct Supabase traffic |
| `cloudflare-supabase-auth-proxy-plan.md` | Implementation plan for moving Auth behind Cloudflare Workers |

## Current Status

**Implemented and verified on 2026-03-19.**

The auth proxy is fully operational. All auth flows (sign-in, session check, sign-out) route through `uttervoice.com/api/auth/*`. Zero direct browser-to-Supabase traffic remains. The publishable key and project ref are no longer visible in any browser network traffic. See `live-network-audit-post-fix.md` for the verification evidence.

## Manual Touchpoints

This workstream is expected to require user-interrupted dashboard checks for:

- Supabase Auth settings and redirect URLs
- CAPTCHA / Turnstile server-side settings
- any cookie, caching, or route behavior that must be verified on deployed Cloudflare infrastructure

## Read First

1. `../01-api-worker-privatization/README.md`
2. `../03-surface-hardening/supabase-direct-surface-hardening/README.md`
3. `../../2026-02-23/security-supabase/README.md`

## Execution Prompt

```
Implement the Cloudflare Supabase Auth proxy plan in this directory.

Objective:

- remove direct browser Supabase Auth usage
- move auth flows behind `uttervoice.com/api/auth/*`
- stop shipping the Supabase project URL and publishable key in the deployed browser app

Required reading before changes:

1. `docs/2026-03-19/02-cloudflare-supabase-proxy/README.md`
2. `docs/2026-03-19/02-cloudflare-supabase-proxy/cloudflare-supabase-proxy-research-verification.md`
3. `docs/2026-03-19/02-cloudflare-supabase-proxy/cloudflare-supabase-auth-proxy-plan.md`
4. `frontend/src/lib/supabase.ts`
5. `frontend/src/pages/Auth.tsx`
6. `frontend/src/app/auth/AuthStateProvider.tsx`
7. `frontend/src/pages/account/accountData.ts`
8. `frontend/src/lib/api.ts`
9. `workers/frontend/src/index.ts`
10. `workers/api/src/_shared/supabase.ts`
11. `workers/api/src/index.ts`

Implementation requirements:

1. Remove direct browser `supabase-js` Auth usage from the frontend bundle.
2. Add Worker-backed auth endpoints under your own domain.
3. Use same-domain cookie-backed auth/session handling.
4. Update protected API access so browser JS no longer needs to inject Supabase bearer tokens.
5. Preserve CAPTCHA / Turnstile and existing auth UX where practical.
6. Ensure auth routes and any `Set-Cookie` responses are `no-store` and not accidentally cached.
7. Verify the deployed browser bundle no longer contains the Supabase project URL or publishable key.

Manual interruption points:

1. Pause before changing Supabase redirect URLs or other dashboard auth settings.
2. Pause if CAPTCHA / Turnstile configuration needs dashboard verification or secret rotation.
3. Pause if the chosen session-cookie design needs an explicit product/security decision.

Deliverables:

1. Code/config changes
2. Summary of the new auth request flow
3. Verification notes showing browser network and bundle no longer expose Supabase project metadata
4. Any remaining manual Cloudflare or Supabase dashboard step
```
