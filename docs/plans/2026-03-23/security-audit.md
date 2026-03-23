# Security Audit — uttervoice.com (2026-03-23)

Audit performed against the live production deployment at `uttervoice.com` using Chrome DevTools MCP to inspect real network traffic, scan JS bundles, and test abuse vectors. The goal was to verify that API keys cannot be sniffed from network logs, and that the credits system prevents resource abuse before internal testing begins.

## Methodology

1. Signed in via the password flow and captured every network request
2. Inspected request/response headers and bodies for leaked secrets
3. Scanned all 14 frontend JS bundles for hardcoded API keys (Supabase anon/service-role, DashScope `sk-*`, Stripe `sk_live_*`/`sk_test_*`)
4. Checked `document.cookie`, `localStorage`, and `sessionStorage` for exposed tokens
5. Tested all protected endpoints with `credentials: 'omit'` to simulate unauthenticated attackers
6. Tested Bearer token extraction from localStorage against the Worker API and direct Supabase access
7. Verified rate limiting fires on tier1 endpoints

## Passed Checks

### No secrets in network traffic or JS bundles
All API calls between the browser and `uttervoice.com/api/*` use HttpOnly cookies for auth. No request or response contains Supabase keys, DashScope keys, Stripe secrets, or the storage signing secret. All 14 JS bundle files were fetched and regex-scanned for key patterns — zero matches.

### Auth cookies properly secured
```
Set-Cookie: utter_sb_access_token=<JWT>; Max-Age=3600; Path=/; HttpOnly; Secure; SameSite=Lax
Set-Cookie: utter_sb_refresh_token=<token>; Max-Age=2592000; Path=/; HttpOnly; Secure; SameSite=Lax
```
- `HttpOnly` — JavaScript cannot read them (`document.cookie` returns empty string)
- `Secure` — only sent over HTTPS
- `SameSite=Lax` — not sent on cross-origin POST/fetch requests

### All protected endpoints reject unauthenticated requests
Tested with `credentials: 'omit'` (no cookies at all):

| Endpoint | Method | Status | Response |
|---|---|---|---|
| `/api/generate` | POST | 401 | `Authentication required.` |
| `/api/voices` | GET | 401 | `Authentication required.` |
| `/api/credits/usage` | GET | 401 | `Authentication required.` |
| `/api/clone/finalize` | POST | 401 | `Authentication required.` |
| `/api/auth/session` | GET | 200 | `{"signed_in":false,"user":null}` (correct) |
| Supabase direct | GET | 401 | Rejected (anon key not available to client) |

### Credits system enforces balances
- New accounts start at **0 credits** and **0 trials**
- Generate, clone, and design all call credit-debit RPCs before processing
- Idempotency keys prevent duplicate charges
- Failed operations trigger refunds

### Rate limiting active on expensive endpoints
- tier1 (generate, clone, design, transcriptions, billing): **10 req / 300s per IP**
- tier2 (tasks): **90 req / 300s**
- tier3 (other): **300 req / 300s**
- Rate limit enforced via `rate_limit_check_and_increment()` Postgres RPC
- Returns 429 with `retry_after_seconds` when exceeded

### Cloudflare Turnstile protects auth forms
Sign-in and sign-up require a Turnstile captcha token, blocking automated credential stuffing.

---

## Issues Found

### Issue 1 — CORS origin returns `http://localhost:5173` in production

**Severity**: Medium

**What's happening**: Every API response from `uttervoice.com` returns:
```
access-control-allow-origin: http://localhost:5173
```
Even when the request includes `Origin: https://uttervoice.com`, the response still returns `http://localhost:5173`. This was confirmed by sending requests with explicit Origin headers — all three returned `localhost`:
- `Origin: https://uttervoice.com` → `http://localhost:5173`
- `Origin: http://localhost:5173` → `http://localhost:5173`
- `Origin: https://evil.com` → `http://localhost:5173`

**Background**: The CORS middleware in `workers/api/src/shared/cors.ts` resolves the `Access-Control-Allow-Origin` header like this:

```ts
// cors.ts — resolveAllowedOrigin()
if (!requestOrigin) return allowedOrigins[0] ?? "*";
return allowedOrigins.includes(requestOrigin) ? requestOrigin : (allowedOrigins[0] ?? "*");
```

The `CORS_ALLOWED_ORIGIN` values per environment in `wrangler.toml`:

| Section | Value | First item |
|---|---|---|
| `[vars]` (default) | `http://localhost:5173` | `http://localhost:5173` |
| `[env.staging.vars]` | `http://localhost:5173,https://utter.duncanb013.workers.dev,https://uttervoice.com` | `http://localhost:5173` |
| `[env.production.vars]` | `https://uttervoice.com,https://utter.duncanb013.workers.dev,https://utter-wheat.vercel.app` | `https://uttervoice.com` |

Since `https://uttervoice.com` is not matched in the allowlist, the Worker is deployed with the **default** `[vars]` (only `http://localhost:5173`). Neither staging nor production env is active.

**Why it matters**: The CORS header tells browsers which origins may read API responses. Since `https://uttervoice.com` is not in the allowlist, same-origin requests still work (CORS only applies cross-origin), but:
- The response header is technically incorrect
- An attacker at `http://localhost:5173` could read API responses cross-origin (mitigated: `Secure` cookies won't send over HTTP, `SameSite=Lax` blocks cross-site POSTs)
- It signals the wrong deployment environment, meaning other production-specific settings may also be missing

**Fix**: The staging CORS list should put `https://uttervoice.com` first as the primary origin. Then redeploy with the correct env flag (`wrangler deploy --env staging`). If production env is intended, deploy with `--env production` instead.

### Issue 2 — Stale Supabase auth token in localStorage

**Severity**: Low

**What's happening**: The browser's localStorage contains a key `sb-jgmivviwockcwjkvpqra-auth-token` with a full Supabase JWT (access_token + refresh_token) from a previous session.

Observed values:
- **User**: `dan.can.not@proton.me` (user ID `36ed4575-...`) — different from the currently signed-in user
- **Expired**: 2026-03-18 (5 days ago)
- **Contains**: access_token (927 chars), refresh_token, expires_at

**Background**: The current frontend code (`frontend/src/lib/auth.ts`) does not import the Supabase JS client. All auth goes through the Worker API (`/api/auth/*`) which sets HttpOnly cookies. The localStorage token is a leftover from a previous version that used `@supabase/supabase-js` with its default `localStorage` persistence.

**Why it matters**: If an XSS vulnerability existed, an attacker could read this token from `localStorage`. While currently expired, the refresh token could potentially be used against Supabase's auth endpoint to obtain a fresh access token (Supabase refresh tokens have a long validity window). Additionally, having a different user's credentials in localStorage is a data hygiene concern.

**Fix**: Clear this localStorage key. Since the frontend no longer uses the Supabase JS client, no code path should recreate it. A one-time cleanup in the app's initialization would be sufficient:
```ts
localStorage.removeItem('sb-jgmivviwockcwjkvpqra-auth-token');
```

### Issue 3 — Provider-internal voice IDs exposed in API responses

**Severity**: Low / Informational

**What's happening**: The `GET /api/voices` response includes fields that reveal Qwen TTS internals:

```json
{
  "provider_voice_id": "qwen-tts-vc-chynna_better-voice-20260321215456753-2d8d",
  "provider_target_model": "qwen3-tts-vc-2026-01-22",
  "provider_voice_kind": "vc"
}
```

**Background**: These fields are used server-side when constructing TTS API calls to DashScope. The frontend uses only `id` (our UUID) and `name` for display. The `provider_voice_id` encodes the voice name, creation timestamp, and a short hash.

**Why it matters**: Not directly exploitable — an attacker cannot call DashScope without the API key. However, it reveals:
- Which TTS provider is used (Qwen/DashScope)
- Exact model versions in use
- Internal naming conventions and timestamps
- Information useful for social engineering or competitive intelligence

**Fix**: Filter these fields from the API response in the voices route handler, returning only the fields the frontend needs (`id`, `name`, `language`, `source`, `description`, `created_at`).
