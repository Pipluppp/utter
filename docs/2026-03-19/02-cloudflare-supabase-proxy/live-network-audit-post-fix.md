# Live Network Audit: Post-Fix Verification

Date: 2026-03-19
Method: Chrome DevTools MCP against live authenticated session on `https://uttervoice.com`
Status: Complete - **all auth traffic now routes through the Worker**

## Summary

After implementing the Cloudflare Worker auth proxy, **zero** authenticated pages make direct cross-origin requests to `jgmivviwockcwjkvpqra.supabase.co`. All auth flows (sign-in, session check, sign-out) now route through `uttervoice.com/api/auth/*`. The Supabase project ref and publishable key are no longer visible in any browser network traffic.

This audit confirms the fix against the pre-implementation baseline documented in `live-network-audit.md`.

## Auth Flow Verification

### Sign-in

| Detail | Value |
|---|---|
| Endpoint | `POST https://uttervoice.com/api/auth/sign-in` |
| Direct Supabase call? | No |
| Publishable key in headers? | No |
| Session storage | Worker sets `utter_sb_access_token` and `utter_sb_refresh_token` as httpOnly, Secure, SameSite=Lax cookies |
| Response body | `{"signed_in":true,"user":{"email":"...","id":"..."}}` - no tokens leaked to JS |
| Turnstile/CAPTCHA | Token forwarded in request body, validated server-side |

### Session check

| Detail | Value |
|---|---|
| Endpoint | `GET https://uttervoice.com/api/auth/session` |
| Direct Supabase call? | No |
| Publishable key in headers? | No |
| Auth transport | httpOnly cookies sent automatically by browser |
| Response body | `{"signed_in":true,"user":{...}}` or `{"signed_in":false,"user":null}` |
| Cache headers | `Cache-Control: no-store`, `Pragma: no-cache` |

### Sign-out

| Detail | Value |
|---|---|
| Endpoint | `POST https://uttervoice.com/api/auth/sign-out` |
| Direct Supabase call? | No |
| Publishable key in headers? | No |
| Cookie cleanup | Worker clears both cookies with `Max-Age=0` |
| Response body | `{"signed_in":false,"user":null}` |

## Per-Page Network Audit

Every page was visited via client-side SPA navigation after a fresh sign-in through the Worker auth proxy.

| Page | Supabase requests | Publishable key exposed | Worker-proxied API calls |
|---|---:|---|---|
| `/clone` | 0 | No | `/api/auth/session`, `/api/languages` |
| `/generate` | 0 | No | `/api/voices`, `/api/languages` |
| `/design` | 0 | No | (no new fetches beyond prior pages) |
| `/voices` | 0 | No | `/api/voices?page=1&per_page=20` |
| `/history` | 0 | No | `/api/generations?page=1&per_page=20` |
| `/tasks` | 0 | No | `/api/tasks?status=active&type=all&limit=25` |
| `/account` | 0 | No | `/api/me`, `/api/credits/usage?window_days=90`, `/api/auth/session` |
| `/account/credits` | 0 | No | (same as /account, no new fetches) |

### Comparison to Pre-Fix Baseline

| Page | Before (direct Supabase) | After (Worker proxy) |
|---|---:|---:|
| `/clone` | 3 | 0 |
| `/generate` | 3 | 0 |
| `/design` | 3 | 0 |
| `/voices` | 3 | 0 |
| `/history` | 3 | 0 |
| `/tasks` | 3 | 0 |
| `/account` | 4 | 0 |
| `/account/credits` | 4 | 0 |

## What the Browser No Longer Exposes

Before the fix, every direct Supabase request included:

```
apikey: sb_publishable_pZYfwTl-Hg1RySVY4xiHwg_plM_4M3S
authorization: Bearer <user JWT>
x-client-info: supabase-js-web/2.95.3
```

And every Supabase response returned:

```
sb-project-ref: jgmivviwockcwjkvpqra
```

**None of these appear in any browser network traffic after the fix.** The browser only sees same-origin `uttervoice.com/api/*` URLs. Tokens are stored in httpOnly cookies that JavaScript cannot read.

## Cookie Security Attributes

Both auth cookies use correct security attributes:

| Cookie | Max-Age | Path | HttpOnly | Secure | SameSite |
|---|---|---|---|---|---|
| `utter_sb_access_token` | 3600 (1h) | `/` | Yes | Yes | Lax |
| `utter_sb_refresh_token` | 2592000 (30d) | `/` | Yes | Yes | Lax |

On sign-out, both are cleared with `Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`.

## Console Errors

No Supabase-related console errors or warnings. Only Turnstile widget styling noise (not actionable).

## Caveat: Stale Browser Cache

The very first sign-in attempt (from a tab that was already open with old cached JS) still showed direct Supabase calls with the publishable key. After a full page reload picked up the current deployed frontend build, all subsequent auth flows correctly used the Worker proxy. This is expected browser cache behavior and will resolve as users' caches expire naturally.

## What This Audit Confirms

1. **The auth proxy is fully operational.** Sign-in, session checks, and sign-out all route through `uttervoice.com/api/auth/*`.

2. **Zero direct browser-to-Supabase traffic.** No page makes any request to `*.supabase.co` during normal authenticated use.

3. **The publishable key and project ref are invisible in network traffic.** Neither `sb_publishable_*` nor `jgmivviwockcwjkvpqra` appear in any request or response visible to the browser.

4. **Cookie-based auth is working correctly.** httpOnly, Secure, SameSite=Lax cookies carry the session. No tokens are accessible to JavaScript.

5. **All data API calls remain clean.** The `/api/*` data endpoints (voices, generations, tasks, credits, etc.) continue routing through Cloudflare Workers with no Supabase identifiers.

6. **The duplicate auth call problem is resolved.** The pre-fix baseline showed 3-4 redundant `GET /auth/v1/user` calls per page from `supabase-js`. The Worker proxy consolidates session checks into a single `GET /api/auth/session` call.
