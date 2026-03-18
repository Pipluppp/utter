# Cloudflare Security Hardening Plan (Superseded)

> **This file has been superseded by [cloudflare-security-plan.md](cloudflare-security-plan.md).**
> Kept for historical reference only.
>
> Do not implement directly from this draft. Some assumptions here are now stale:
> - Bot Fight Mode cannot be skipped by WAF Skip rules
> - Security Level / `cf.threat_score` should not be used for new logic
> - Tor traffic uses `ip.src.continent eq "T1"`
> - Zone WAF rules do not cover direct `*.workers.dev` hostnames

**Date:** 2026-03-18
**Context:** After attaching `uttervoice.com` to our Cloudflare Workers, automated vulnerability scanners hit the site within hours (see [vulnerability-scan-event.md](vulnerability-scan-event.md)). This plan covers all security measures available on the **Cloudflare Free plan**, plus code-level hardening in our Workers.

---

## What we have today

| Layer | Status |
|---|---|
| App-level rate limiting | 3-tier system in API Worker (Supabase RPC-backed) |
| JWT auth on sensitive routes | All `/api/*` mutating endpoints require Supabase auth |
| CORS | Origin-locked per environment |
| Bot protection | None |
| WAF custom rules | None configured |
| Security headers | None (no CSP, no X-Frame-Options, etc.) |
| Turnstile | Not integrated |
| Cloudflare Bot Fight Mode | Not enabled |
| Cloudflare Free Managed Ruleset | Deployed by default (verify in dashboard) |

---

## Free plan limits (what we can use)

| Feature | Free Tier | Notes |
|---|---|---|
| **WAF Custom Rules** | 5 rules | Block, Managed Challenge, JS Challenge, Skip, Interactive Challenge |
| **WAF Rate Limiting Rules** | 1 rule | IP-only counting, 10s period, 10s mitigation, Path field only |
| **Bot Fight Mode** | Yes | Toggle on/off, no customization |
| **Block AI Bots** | Yes | Separate toggle |
| **Cloudflare Free Managed Ruleset** | Auto-deployed | Subset of CF Managed Ruleset against known CVEs |
| **IP Access Rules** | Unlimited | Allow/Block/Challenge specific IPs/CIDRs/ASNs/countries |
| **Browser Integrity Check** | Yes | Toggle in Security settings |
| **Security Level** | Configurable | Off / Essentially Off / Low / Medium / High / I'm Under Attack |
| **Workers Rate Limit binding** | Free (per-location) | In-Worker, no dashboard visibility, very fast |
| **Turnstile** | Free (unlimited) | Widget-based, separate from WAF |
| **Custom lists (IP)** | Yes | Reference in rule expressions |

---

## The Plan — 6 Layers of Defense

### Layer 1: Cloudflare Dashboard Settings (Zero code — do today)

These are toggle-and-go settings in the Cloudflare dashboard.

#### 1a. Enable Bot Fight Mode
**Where:** Dashboard → Security → Settings → Bot traffic → Bot Fight Mode → ON

**What it does:** Identifies traffic matching known bot patterns and issues compute-expensive challenges. Covers the entire domain automatically. This is the single biggest free win against automated scanners like the one that hit us.

**Caveat:** Cannot be bypassed per-path via WAF Skip rules (unlike Super Bot Fight Mode on Pro). If it blocks legitimate API traffic from integrations, we'd need to upgrade. For our use case (SPA + authenticated API), this should be fine — real users hit the SPA through a browser, and API calls include auth headers.

#### 1b. Block AI Bots
**Where:** Dashboard → Security → Settings → Bot traffic → Block AI bots → ON

**What it does:** Blocks known AI scrapers/crawlers. Our content isn't public SEO-dependent, so there's no downside.

#### 1c. Verify Browser Integrity Check is ON
**Where:** Dashboard → Security → Settings → Browser Integrity Check → ON (usually on by default)

**What it does:** Evaluates HTTP headers for common patterns of abusive bots (missing User-Agent, spoofed headers, etc.). The scan we saw used a spoofed Chrome/120 UA with mismatched Linux+Windows — BIC may catch this.

#### 1d. Set Security Level to Medium
**Where:** Dashboard → Security → Settings → Security Level → Medium

**What it does:** Challenges visitors from IPs with a moderate threat score. "Low" is too permissive; "High" may annoy real users. Medium is the sweet spot.

#### 1e. Enable Email Address Obfuscation (if applicable)
**Where:** Dashboard → Scrape Shield → Email Address Obfuscation → ON

---

### Layer 2: WAF Custom Rules (5 available on Free)

We have 5 custom rules. Here's how to allocate them for maximum impact.

#### Rule 1: Block known vulnerability scanner paths

This is the direct response to the scan we observed. Block requests to paths that only scanners request — our stack has no PHP, Laravel, Symfony, WordPress, or Apache.

**Name:** `Block PHP/Laravel/WP scanner paths`
**When incoming requests match:**
```
(http.request.uri.path contains ".php") or
(http.request.uri.path contains "/debug") or
(http.request.uri.path contains "/storage/logs") or
(http.request.uri.path contains "/_profiler") or
(http.request.uri.path contains "/server-info") or
(http.request.uri.path contains "/manage/env") or
(http.request.uri.path contains "/horizon/") or
(http.request.uri.path contains "/wp-admin") or
(http.request.uri.path contains "/wp-login") or
(http.request.uri.path contains "/wp-content") or
(http.request.uri.path contains "/xmlrpc.php") or
(http.request.uri.path contains "/.env") or
(http.request.uri.path contains "/vendor/") or
(http.request.uri.path contains "/config.")
```
**Action:** Block

**Why this matters:** Currently our SPA catch-all returns `200 OK` with `index.html` for all these paths. That's functionally harmless but it makes scanners think they *might* have found something, so they come back. A hard `403` tells them conclusively there's nothing here.

#### Rule 2: Block suspicious User-Agents

**Name:** `Block known scanner/attack UAs`
**When incoming requests match:**
```
(http.user_agent contains "sqlmap") or
(http.user_agent contains "nikto") or
(http.user_agent contains "nmap") or
(http.user_agent contains "masscan") or
(http.user_agent contains "zgrab") or
(http.user_agent contains "gobuster") or
(http.user_agent contains "dirbuster") or
(http.user_agent contains "nuclei") or
(http.user_agent contains "Havij") or
(http.user_agent contains "wpscan") or
(http.user_agent eq "")
```
**Action:** Block

**Why:** These are well-known security scanning tools. Empty User-Agent is also a red flag (legitimate browsers always send one). Note: the Browser Integrity Check also catches empty UAs, but an explicit block here stops them before Worker invocations.

#### Rule 3: Challenge non-browser requests to the SPA

**Name:** `Challenge suspicious SPA traffic`
**When incoming requests match:**
```
(not http.request.uri.path contains "/api/") and
(not http.request.uri.path contains "/assets/") and
(not cf.client.bot) and
(http.request.uri.path ne "/favicon.ico") and
(http.request.uri.path ne "/favicon.png") and
(not http.user_agent contains "Mozilla")
```
**Action:** Managed Challenge

**Why:** Real users accessing the SPA will have a browser UA containing "Mozilla". Non-browser traffic hitting SPA routes (not `/api/*`, not static assets) is suspicious. `cf.client.bot` exempts verified good bots (Google, Bing, etc.). Managed Challenge is non-blocking for real users (usually auto-solved).

#### Rule 4: Challenge high-threat-score traffic to API

**Name:** `Challenge threats to API`
**When incoming requests match:**
```
(http.request.uri.path contains "/api/") and
(cf.threat_score gt 14) and
(not cf.client.bot)
```
**Action:** Managed Challenge

**Why:** `cf.threat_score` is Cloudflare's IP reputation score (0 = clean, 100 = worst). Threshold of 14 is recommended for "Medium" security. This adds an extra gate specifically on API traffic from suspicious IPs.

#### Rule 5: (Reserve for emergency / future use)

Keep one rule slot open for rapid response. When a new attack pattern emerges, you can immediately deploy a targeted block rule without removing an existing one.

Alternative use: Block traffic from specific countries if you see persistent abuse from regions with no real users.

---

### Layer 3: WAF Rate Limiting Rule (1 available on Free)

The Free plan allows 1 rate limiting rule with IP-based counting, 10s period, 10s mitigation, and matching on Path only.

#### Rate Limit Rule: Protect API endpoints
**Name:** `API rate limit`
**When incoming requests match:**
```
(http.request.uri.path contains "/api/")
```
**Counting:** IP address
**Rate:** 50 requests per 10 seconds
**Mitigation timeout:** 10 seconds
**Action:** Block

**Why this complements our Worker rate limits:** This fires at the Cloudflare edge *before* the request reaches our Worker. Our in-Worker rate limits (Supabase RPC-backed) are more granular (per-user, per-tier) but they still consume Worker invocations and Supabase calls. The WAF rate limit stops volumetric abuse before it costs us anything.

---

### Layer 4: Workers Rate Limit Binding (code change)

The Workers Rate Limit binding is free, runs at the same Cloudflare location as the Worker (zero added latency), and is perfect for per-IP throttling that complements our existing per-user rate limits.

#### Why add this when we already have Supabase RPC rate limits?

Our current rate limit system calls `rate_limit_check_and_increment()` in Supabase on every request. That means:
- Every scanner hit burns a Supabase call
- The latency of a Supabase round-trip is added to every request
- It's counting against our Supabase connection/request quota

The Workers Rate Limit binding checks locally (in-memory, same machine). We can use it as a **fast first pass** — reject obvious volumetric abuse instantly, before the request even reaches our Hono router or Supabase.

#### Implementation

**wrangler.toml addition:**
```toml
# Top-level (applies to local dev and default)
[[ratelimits]]
name = "API_RATE_LIMITER"
namespace_id = "1001"
simple = { limit = 100, period = 60 }

[[ratelimits]]
name = "FRONTEND_RATE_LIMITER"
namespace_id = "1002"
simple = { limit = 200, period = 60 }
```

**Usage in API Worker (early middleware):**
```typescript
// Before the Hono router, as the very first middleware
app.use('/api/*', async (c, next) => {
  const ip = c.req.header('cf-connecting-ip') || 'unknown';
  const { success } = await c.env.API_RATE_LIMITER.limit({ key: ip });
  if (!success) {
    return c.json({ error: 'rate_limited', message: 'Too many requests' }, 429);
  }
  await next();
});
```

**Usage in Frontend Worker:**
```typescript
// For SPA requests (not API proxy)
const ip = request.headers.get('cf-connecting-ip') || 'unknown';
const { success } = await env.FRONTEND_RATE_LIMITER.limit({ key: ip });
if (!success) {
  return new Response('429 Too Many Requests', { status: 429 });
}
```

**Key best practice from CF docs:** Don't use IP as the *only* key for authenticated endpoints. Our existing Supabase rate limits already handle per-user limiting. The binding is purely for per-IP volumetric defense.

**Locality note:** Rate limit counters are per-Cloudflare location (PoP). A bot spreading across 10 locations gets 100 req/min per location. This is fine — it's a volumetric speed bump, not an accounting system.

---

### Layer 5: Security Headers (code change in Frontend Worker)

Our frontend Worker currently sets no security headers. Adding them is free and prevents several attack classes.

**Add to the Frontend Worker response:**
```typescript
const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(self), geolocation=()',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' https://challenges.cloudflare.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://challenges.cloudflare.com",
    "frame-src https://challenges.cloudflare.com",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "upgrade-insecure-requests"
  ].join('; '),
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};
```

**Header explanations:**
| Header | What it prevents |
|---|---|
| `X-Content-Type-Options: nosniff` | MIME-type sniffing attacks |
| `X-Frame-Options: DENY` | Clickjacking (page can't be embedded in iframes) |
| `Referrer-Policy` | Leaking full URL to third parties |
| `Permissions-Policy` | Restricts browser feature access (camera, geo, etc.) |
| `Content-Security-Policy` | XSS, code injection — only allow scripts/resources from our origin + Supabase + Turnstile |
| `Strict-Transport-Security` | Forces HTTPS for all future visits |

Note: `microphone=(self)` is important because our app does voice recording. If we add Turnstile later, `https://challenges.cloudflare.com` must be in the CSP.

---

### Layer 6: Turnstile on Sensitive Frontend Actions (future)

Turnstile is free and unlimited. It's the modern CAPTCHA replacement — invisible to most users, challenges suspected bots.

**Where to integrate (ordered by priority):**
1. **Sign-up / Sign-in forms** — Prevents credential stuffing and fake account creation
2. **TTS generation submit** — Prevents bot-driven credit burn
3. **Voice clone upload** — Prevents abuse of compute-heavy pipeline

**How it works:**
1. Frontend loads Turnstile widget (invisible mode recommended)
2. User action triggers challenge → Turnstile returns a token
3. Frontend sends token with the API request
4. API Worker validates token server-side via `POST https://challenges.cloudflare.com/turnstile/v0/siteverify`
5. If invalid → reject

**We already have auth-rollout plans that include Turnstile** (see `docs/2026-03-18/auth-rollout/`). This layer integrates naturally with that work.

---

## Implementation Priorities

| Priority | Action | Effort | Impact |
|---|---|---|---|
| **P0** | Enable Bot Fight Mode + Block AI Bots in dashboard | 2 min | High — blocks known bot patterns at edge |
| **P0** | Verify Free Managed Ruleset is active | 1 min | High — auto-blocks known CVE attacks |
| **P0** | Set Security Level to Medium | 1 min | Medium — challenges suspicious IPs |
| **P1** | Deploy WAF Custom Rules 1–4 | 15 min | High — blocks scanners, catches non-browser probes |
| **P1** | Deploy WAF Rate Limit Rule | 5 min | Medium — stops volumetric API abuse at edge |
| **P2** | Add security headers to Frontend Worker | 30 min | Medium — prevents clickjacking, XSS, MIME attacks |
| **P2** | Add Workers Rate Limit binding to API Worker | 1 hr | Medium — fast per-IP throttle before Supabase calls |
| **P3** | Integrate Turnstile on auth + generate | 2-4 hr | High — strongest bot defense for sensitive actions |

---

## What we DON'T need (and why)

| Suggestion from Reddit/guides | Why we skip it |
|---|---|
| "I'm Under Attack" mode | Too aggressive for normal use — forces every visitor through a 5-second interstitial. Only use during active DDoS. |
| IP blacklists at kernel/Nginx level | We don't have Nginx — we're on Cloudflare Workers. Cloudflare's edge handles this. |
| Custom `X-API-Key` header trick | Only works if the frontend can securely derive the key. In a client-side SPA, any header value is extractable from network tab. Use Turnstile instead. |
| Upgrading to Pro/Business for WAF Attack Score | Not needed yet. Our 5 custom rules + rate limits + Bot Fight Mode cover the attack surface. Monitor and revisit if attacks escalate. |
| Blocking entire countries | Premature. We don't know our user base geography yet. The scanner was from France (a legitimate user country). |

---

## Monitoring

After deploying these measures:

1. **Security Events:** Dashboard → Security → Events. Check that scanner traffic is being blocked (should see "Bot Fight Mode", "Custom rule", "Rate limiting rule" as services).
2. **Security Analytics:** Dashboard → Security → Analytics. View all traffic including non-mitigated to spot new patterns.
3. **Worker invocations:** Dashboard → Workers & Pages → utter-frontend-staging → Metrics. Verify invocations drop as WAF blocks scanner traffic before it reaches Workers.
4. **Rate limit decisions:** Our existing structured logs in the API Worker already log rate limit decisions. Grep for `"decision":"denied"` to see what the Worker-level limiter catches.

---

## Summary for the vuln scan we saw

The March 18 vulnerability scan was **harmless** — our stack has no PHP/Laravel attack surface. But it revealed three things we should fix:

1. **SPA catch-all returns 200 for everything** → WAF Rule 1 blocks scanner paths with 403
2. **No edge-level bot filtering** → Bot Fight Mode catches automated probes
3. **Every probe still burns Worker invocations** → WAF rules block before Workers execute
4. **No security headers** → Browsers have no CSP/frame protection → Layer 5 fixes this

After implementing P0 + P1 (about 20 minutes of dashboard work), the same scan would produce zero Worker invocations and all-403 responses.
