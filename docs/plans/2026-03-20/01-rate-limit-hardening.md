# 01 — Rate-Limit Hardening

Priority: HIGH
Status: Planned
Scope: API abuse-control path in `workers/api`

## Problem

The rate limiter is structurally sound but has gaps:

1. **IP trust order is wrong** — `x-forwarded-for` before `cf-connecting-ip`, allowing IP spoofing
2. **Auth routes under-protected** — sign-in/sign-up/magic-link fall to catch-all tier3 (300/5min)
3. **No coarse limiter** — every request makes a Supabase RPC, including bots
4. **User identity unused** — IP-only even for authenticated routes
5. **No counter cleanup** — 328 rows accumulating, no pg_cron

## Goal

1. Fix IP trust order: `cf-connecting-ip` first
2. Add auth routes to tier1 rate limits
3. Add Worker-native coarse limiter before Supabase RPC
4. Use verified user identity on protected routes
5. Add automatic counter retention (Cloudflare cron trigger)

## Findings (2026-03-20)

### IP trust order (WRONG)

`_shared/rate_limit.ts:84-101` — `readClientIp()` checks `x-forwarded-for` first, then `cf-connecting-ip`. Behind Cloudflare, `cf-connecting-ip` is the trusted header. `x-forwarded-for` can be spoofed to evade limits.

### Auth routes — no explicit rules

`endpointRules` only covers generate/clone/design/billing/tasks routes. Auth routes (`/api/auth/sign-in`, etc.) fall to tier3 at 300 reqs/5min per IP — far too permissive for auth endpoints.

### User identity disabled

`resolveRateLimitIdentity()` hardcodes `userId = null`. The function supports user-based limiting but it's turned off.

### Counter retention

328 rows, 219 older than 7 days. No pg_cron installed. No cleanup mechanism.

### Current tier configuration

| Tier | User limit | IP limit | Window |
|---|---|---|---|
| tier1 | 10 | 30 | 300s (5 min) |
| tier2 | 90 | 180 | 300s (5 min) |
| tier3 | none | 300 | 300s (5 min) |

## Implementation Steps

### Step 1: Fix IP trust order

Update `readClientIp()` in `workers/api/src/_shared/rate_limit.ts`:

```typescript
function readClientIp(req: Request): string {
  // Cloudflare sets this header at the edge — most trusted source
  const cfIp = req.headers.get("cf-connecting-ip")?.trim()
  if (cfIp) return cfIp

  // Fallback for local dev or non-Cloudflare reverse proxies
  const forwardedFor = req.headers.get("x-forwarded-for")
  if (forwardedFor) {
    const candidate = forwardedFor.split(",")[0]?.trim()
    if (candidate) return candidate
  }

  const realIp = req.headers.get("x-real-ip")?.trim()
  if (realIp) return realIp

  return "unknown"
}
```

### Step 2: Add auth routes to explicit rate-limit rules

Add to `endpointRules` in `rate_limit.ts`:

```typescript
// Auth routes — abuse-sensitive, tight limits
{ method: "POST", pattern: /^\/api\/auth\/sign-in$/, tier: "tier1" },
{ method: "POST", pattern: /^\/api\/auth\/sign-up$/, tier: "tier1" },
{ method: "POST", pattern: /^\/api\/auth\/magic-link$/, tier: "tier1" },
{ method: "POST", pattern: /^\/api\/auth\/sign-out$/, tier: "tier2" },
{ method: "POST", pattern: /^\/api\/auth\/refresh$/, tier: "tier2" },
{ method: "GET",  pattern: /^\/api\/auth\/session$/, tier: "tier2" },
{ method: "GET",  pattern: /^\/api\/auth\/callback$/, tier: "tier2" },
```

### Step 3: Add a Worker-native coarse limiter

Add Cloudflare Workers Rate Limiting bindings in `wrangler.toml`:

```toml
[[unsafe.bindings]]
name = "RATE_LIMITER"
type = "ratelimit"
namespace_id = "0"    # account-wide unique ID — confirm with user
simple = { limit = 100, period = 60 }
```

Insert early middleware in `index.ts` before the Supabase RPC limiter. Cover all `/api/*` except OPTIONS and `/api/health`.

Manual interruption: pause to confirm `namespace_id` with user.

### Step 4: Use verified user identity for durable limiting

- Add optional `verifiedUserId` parameter to `resolveRateLimitIdentity`
- Wire from auth middleware on protected routes
- Keep IP-only for unauthenticated routes

### Step 5: Add retention for rate_limit_counters

Recommended: Cloudflare Cron Trigger (pg_cron not available).

```toml
[triggers]
crons = ["0 3 * * *"]  # daily at 3 AM UTC
```

Delete rows older than 7 days.

### Step 6: Expand tests

- `cf-connecting-ip` precedence over `x-forwarded-for`
- Auth routes rate-limited at tier1
- Coarse limiter before Supabase RPC
- 429 responses include `retry_after_seconds`
- Verified user identity used when available

## Verification

- Spoofed `x-forwarded-for` doesn't evade limits when `cf-connecting-ip` is set
- Repeated sign-in attempts hit 429 at tier1 threshold
- Old counter rows cleaned up after cron runs
- Normal API and auth flows still work

## Rollback

- Coarse limiter false positives → reduce threshold or remove middleware
- Auth rate-limit too tight → move auth from tier1 to tier2
- IP trust issues in local dev → `cf-connecting-ip` absent falls through to `x-forwarded-for`

## Manual Steps

- Cloudflare account: confirm rate-limit `namespace_id`
- Optional: review existing WAF rate-limit rules on `uttervoice.com`
- Cron trigger setup approval

## Key Files

- `workers/api/src/_shared/rate_limit.ts` — rate limit logic and IP extraction
- `workers/api/src/index.ts` — middleware ordering
- `workers/api/src/routes/auth.ts` — auth proxy routes
- `workers/api/wrangler.toml` — bindings and cron config
- `workers/api/tests/rate_limits.test.ts` — tests
