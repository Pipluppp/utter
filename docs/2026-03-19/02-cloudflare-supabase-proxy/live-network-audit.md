# Live Network Audit: Browser-to-Supabase Traffic

Date: 2026-03-19
Method: Chrome DevTools MCP against live authenticated session on `https://uttervoice.com`
Status: Complete

## Summary

Every authenticated page makes direct cross-origin requests from the browser to `jgmivviwockcwjkvpqra.supabase.co`. All of these are Auth session checks (`GET /auth/v1/user`). No page makes direct browser requests to Supabase REST/PostgREST endpoints for data.

All data API calls already route through `uttervoice.com/api/*` (Cloudflare Workers). Only Auth is the remaining direct Supabase surface.

## Per-Page Results

| Page | Supabase requests | Publishable key in `apikey` header | Endpoint(s) hit | Worker-proxied API calls |
|---|---:|---|---|---|
| `/clone` | 3 | Yes | `GET /auth/v1/user` x3 | `/api/languages` |
| `/generate` | 3 | Yes | `GET /auth/v1/user` x3 | `/api/languages`, `/api/voices` |
| `/design` | 3 | Yes | `GET /auth/v1/user` x3 | `/api/languages` |
| `/voices` | 3 | Yes | `GET /auth/v1/user` x3 | `/api/voices?page=1&per_page=20` |
| `/history` | 3 | Yes | `GET /auth/v1/user` x3 | `/api/generations?page=1&per_page=20` |
| `/tasks` | 3 | Yes | `GET /auth/v1/user` x3 | `/api/tasks?status=active&type=all&limit=25` |
| `/account` | 4 | Yes | `GET /auth/v1/user` x4 | `/api/me`, `/api/credits/usage?window_days=90` |
| `/account/credits` | 4 | Yes | `GET /auth/v1/user` x4 | `/api/me`, `/api/credits/usage?window_days=90` |

## What the Browser Exposes Per Auth Request

Every direct Supabase request includes these headers:

```
apikey: sb_publishable_pZYfwTl-Hg1RySVY4xiHwg_plM_4M3S
authorization: Bearer <user JWT>
x-client-info: supabase-js-web/2.95.3
x-supabase-api-version: 2024-01-01
```

Every Supabase response returns:

```
sb-project-ref: jgmivviwockcwjkvpqra
```

The request URL itself contains the project ref: `https://jgmivviwockcwjkvpqra.supabase.co/auth/v1/user`.

## Confirmed: Only Auth Calls Are Direct

The `/api/*` data calls were verified clean on every page. None of them contain `supabase.co` in the URL, and none send `apikey` or `sb_publishable_` headers:

- `/api/languages` — clean
- `/api/voices` — clean
- `/api/voices?page=1&per_page=20` — clean
- `/api/generations?page=1&per_page=20` — clean
- `/api/tasks?status=active&type=all&limit=25` — clean
- `/api/me` — clean
- `/api/credits/usage?window_days=90` — clean

These all route through the Cloudflare frontend Worker to the API Worker via service binding. The browser sees only `uttervoice.com/api/*` URLs with no Supabase identifiers.

## Duplicate Auth Calls

Each page fires `GET /auth/v1/user` 3–4 times on load. The likely sources are:

1. `supabase.auth.getSession()` (initial session hydration)
2. `supabase.auth.onAuthStateChange()` listener (fires on mount)
3. Route-level auth guard re-check
4. On `/account` and `/account/credits`, a fourth call from the account layout or nested data loader

This is both a performance concern (redundant round-trips to Supabase on every navigation) and a fingerprinting concern (repeated cross-origin requests to a known endpoint).

## What This Audit Confirms

1. **The `/api/*` Worker proxy is working correctly.** All data operations go through Cloudflare. The browser never calls Supabase Data APIs directly during normal page loads.

2. **Auth is the only remaining direct Supabase surface.** The `supabase-js` client in the browser bundle makes session check calls directly to `jgmivviwockcwjkvpqra.supabase.co/auth/v1/user` on every page load.

3. **The publishable key and project ref are visible in every authenticated page's network traffic.** This is inherent to how `supabase-js` works when instantiated in the browser.

4. **Proxying Auth through the API Worker would eliminate all browser-visible Supabase traffic.** After that change, no request from the browser would hit `supabase.co` directly, and neither the project ref nor the publishable key would appear in network traffic.

## Implication for the Proxy Plan

The scope of work for `cloudflare-supabase-auth-proxy-plan.md` is confirmed: move the Auth calls (`getUser`, `getSession`, `signIn*`, `signUp`, `signOut`, `onAuthStateChange` session refresh) behind `uttervoice.com/api/auth/*` routes on the API Worker. Once done, the frontend no longer needs `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY`, and the browser bundle ships zero Supabase identifiers.
