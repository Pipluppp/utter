# Cloudflare Security Plan

**Date:** 2026-03-19
**Status:** Validated and ready to implement
**Trigger:** Automated vulnerability scanners hit `uttervoice.com` within hours of domain attachment (see [vulnerability-scan-event.md](vulnerability-scan-event.md))

All steps below work on the **Cloudflare Free plan**. No code changes required. Expressions can be pasted directly into the dashboard via the **Edit expression** link on each rule's edit page.

---

## Background

Our stack (Cloudflare Workers + Supabase) has no PHP, Laravel, WordPress, or Apache, so the scanners that probed us found nothing. However, the frontend Worker currently serves the SPA shell for unknown routes, which encourages repeated probing and still burns Worker invocations.

We already have app-level defenses (3-tier Supabase RPC rate limiting, JWT auth, origin-locked CORS). This plan adds edge-level filtering so bad traffic is blocked or challenged before it reaches the Workers.

References:
- [webagencyhero WAF Rules V3](https://webagencyhero.com/cloudflare-waf-rules-v3/) - structural inspiration only
- [Cloudflare Custom Rules](https://developers.cloudflare.com/waf/custom-rules/)
- [Cloudflare Skip options](https://developers.cloudflare.com/waf/custom-rules/skip/options/)
- [Cloudflare Rate limiting rules](https://developers.cloudflare.com/waf/rate-limiting-rules/)
- [Cloudflare Bot Fight Mode](https://developers.cloudflare.com/bots/get-started/bot-fight-mode/)
- [Cloudflare Block AI Bots](https://developers.cloudflare.com/bots/additional-configurations/block-ai-bots/)
- [Cloudflare Onion Routing](https://developers.cloudflare.com/network/onion-routing/)

When the guide and current Cloudflare docs disagree, **Cloudflare docs win**. The validated differences that matter here:

1. **Bot Fight Mode cannot be skipped** by a WAF Skip rule on Free.
2. **Security Level / threat score should not be used** for new logic. Threat score is now always `0`.
3. **Tor traffic is identified by `ip.src.continent eq "T1"`**, not by country.
4. **Zone WAF rules protect `uttervoice.com`, not direct `*.workers.dev` hostnames**.

---

## Preflight

Before touching the dashboard, keep these scope constraints in mind:

1. This plan protects the **`uttervoice.com` zone**.
2. It **does not protect** direct public Worker hostnames such as `utter-api-staging.duncanb013.workers.dev`.
3. Our frontend Worker proxies `/api/*` to the API Worker, so these rules apply to browser traffic hitting `https://uttervoice.com/api/*`.
4. If any third-party machine client posts to `https://uttervoice.com/api/*` (for example a webhook or external integration), **do not enable Bot Fight Mode** until you confirm that traffic is challenge-safe or move it to a separate hostname.

---

## Step 1: Dashboard Toggles

All in **Dashboard -> Security -> Settings**, except Onion Routing.

**Dashboard UI note validated during implementation (2026-03-19):**
Some zones now surface `Browser Integrity Check` and `Onion Routing` inside an `Activate basic features` modal instead of as separate toggles. If that modal appears, keep `Browser Integrity Check` enabled and uncheck `Onion Routing` before activating.

| Setting | Value | Why |
|---|---|---|
| Bot Fight Mode | **ON, but only if `uttervoice.com/api/*` is browser-only traffic** | Strong free protection, but it protects the whole zone and cannot be skipped with WAF rules. |
| Block AI Bots | **ON** | Blocks verified AI crawlers and similar unverified AI scraping traffic. |
| Browser Integrity Check | **ON** (verify, usually default) | Adds a cheap filter for obviously malformed or abusive clients. |

Also: **Dashboard -> Network -> Onion Routing -> OFF**. This disables Cloudflare's `.onion` alt-svc flow. It does **not** block Tor by itself; Rule 4 below separately blocks Tor traffic using `ip.src.continent eq "T1"`.

**Removed from the old plan:** `Security Level = Medium`. Current Cloudflare docs no longer support using Security Level / threat score the way older guides describe, and threat score is no longer populated for new rule logic.

---

## Step 2: WAF Custom Rules (4 of 5 slots)

Navigate to **Dashboard -> Security -> WAF -> Custom rules**.

Rules are evaluated top-to-bottom. Order matters. Rule 1 still goes first, but its purpose is narrower than older guides suggest because current dashboard Skip behavior does **not** bypass Bot Fight Mode and does **not** currently expose "skip all remaining custom rules".

### Rule 1: Allow Good Bots

| Field | Value |
|---|---|
| **Rule name** | Allow Good Bots |
| **Action** | Skip |
| **Place at** | First |

**WAF components to skip (check all that are present):**
- All rate limiting rules
- All managed rules
- All Super Bot Fight Mode rules
- Under "More components to skip": Zone Lockdown, User Agent Blocking, Browser Integrity Check, Hotlink Protection, Security Level, Rate limiting rules (Previous version), Managed rules (Previous version)

**Dashboard update validated during implementation (2026-03-19):**
- `All remaining custom rules` skip is available in the current dashboard UI and should be enabled for this rule.
- `Bot Fight Mode` skip is still not available.

**Log matching requests:** ON

**Expression:**
```txt
(cf.client.bot) or (cf.verified_bot_category in {"Search Engine Crawler" "Search Engine Optimization" "Monitoring & Analytics" "Advertising & Marketing" "Page Preview" "Academic Research" "Security" "Accessibility" "Webhooks" "Feed Fetcher"}) or (http.user_agent contains "letsencrypt" and http.request.uri.path contains "acme-challenge")
```

**What this does:** Gives verified good bots a free pass around rate limiting, managed rules, Browser Integrity Check, and similar controls.

**What it does not do:**
- It does **not** bypass Bot Fight Mode.
- It does **not** reliably skip later custom rules in the dashboard.

That is why the later rules below still include explicit `not cf.client.bot` guards where appropriate, even though the current dashboard now exposes `All remaining custom rules`.

The ACME clause is belt-and-suspenders only. Cloudflare already auto-bypasses some certificate validation paths, but keeping this clause is harmless.

**Excluded bot categories:** AI Crawler and Other. Those stay blocked later.

---

### Rule 2: Aggressive Crawlers

| Field | Value |
|---|---|
| **Rule name** | Aggressive Crawlers |
| **Action** | Managed Challenge |
| **Place at** | After "Allow Good Bots" |

**Expression:**
```txt
(http.user_agent contains "yandex") or (http.user_agent contains "sogou") or (http.user_agent contains "semrush") or (http.user_agent contains "ahrefs") or (http.user_agent contains "baidu") or (http.user_agent contains "python-requests") or (http.user_agent contains "neevabot") or (http.user_agent contains "CF-UC") or (http.user_agent contains "sitelock") or (http.user_agent contains "crawl" and not cf.client.bot) or (http.user_agent contains "bot" and not cf.client.bot) or (http.user_agent contains "Bot" and not cf.client.bot) or (http.user_agent contains "Crawl" and not cf.client.bot) or (http.user_agent contains "spider" and not cf.client.bot) or (http.user_agent contains "mj12bot") or (http.user_agent contains "ZoominfoBot") or (http.user_agent contains "mojeek") or (http.user_agent contains "sqlmap") or (http.user_agent contains "nikto") or (http.user_agent contains "nmap") or (http.user_agent contains "nuclei") or (http.user_agent contains "gobuster") or (http.user_agent contains "dirbuster") or (http.user_agent contains "zgrab") or (http.user_agent contains "masscan") or (http.user_agent contains "wpscan") or (http.user_agent contains "Havij") or (http.user_agent contains "scrapy") or (http.user_agent eq "")
```

**What this does:** Issues a Managed Challenge to:
1. Named SEO or crawler tools
2. Generic unverified bots
3. Common security scanners
4. Script libraries
5. Empty User-Agent requests

**Why Managed Challenge instead of Block:** The generic bot/crawl/spider matchers are intentionally broad. Challenge is safer than hard block and still effectively stops headless tools.

**Bot safety note:** Because Rule 1 does not skip later custom rules in the dashboard, the `not cf.client.bot` conditions here are doing real work.

---

### Rule 3: Challenge Large Providers

| Field | Value |
|---|---|
| **Rule name** | Challenge Large Providers |
| **Action** | Managed Challenge |
| **Place at** | After "Aggressive Crawlers" |

**Expression:**
```txt
(ip.src.asnum in {7224 16509 14618 15169 8075 396982}) and not cf.client.bot and not cf.verified_bot_category in {"Search Engine Crawler" "Search Engine Optimization" "Monitoring & Analytics" "Advertising & Marketing" "Page Preview" "Academic Research" "Security" "Accessibility" "Webhooks" "Feed Fetcher" "Aggregator"} and not http.request.uri.path contains "acme-challenge"
```

**ASN reference:**

| ASN | Provider |
|---|---|
| 7224 | Amazon AWS |
| 16509 | Amazon EC2 |
| 14618 | Amazon |
| 15169 | Google Cloud |
| 8075 | Microsoft Azure |
| 396982 | Google (additional) |

**What this does:** Issues a Managed Challenge to traffic from major cloud VPS providers, where low-cost scanners and throwaway attack hosts commonly run.

**Validated update:** Use `ip.src.asnum`. `ip.geoip.asnum` still works but is deprecated.

**Why Managed Challenge:** Some legitimate users or proxies may originate from these ASNs. Challenge gives them a path through while blocking simple automation.

**No country filtering:** We still skip country-level gating because we do not yet know the real user distribution.

---

### Rule 4: Block Scanner Paths + Tor + AI Crawlers

| Field | Value |
|---|---|
| **Rule name** | Block Scanner Paths, Tor, AI Crawlers |
| **Action** | Block |
| **Place at** | After "Challenge Large Providers" |

**Expression:**
```txt
(http.request.uri.path contains ".php") or (http.request.uri.path contains "/.env") or (http.request.uri.path contains "/debug") or (http.request.uri.path contains "/storage/logs") or (http.request.uri.path contains "/_profiler") or (http.request.uri.path contains "/server-info") or (http.request.uri.path contains "/manage/env") or (http.request.uri.path contains "/horizon/") or (http.request.uri.path contains "/wp-admin") or (http.request.uri.path contains "/wp-login") or (http.request.uri.path contains "/wp-content") or (http.request.uri.path contains "/xmlrpc") or (http.request.uri.path contains "/wp-config") or (http.request.uri.path contains "/wlwmanifest") or (http.request.uri.path contains "/vendor/") or (http.request.uri.path contains "/config.") or (cf.verified_bot_category in {"AI Crawler" "Other"}) or (ip.src.continent eq "T1")
```

**What this does:** Three things in one rule:

1. **Scanner paths** - Blocks the exact Laravel / PHP / WordPress patterns that have already been probing the branded domain.
2. **AI crawlers** - Blocks verified bots in `AI Crawler` and `Other` categories. This is intentionally stricter than Rule 1.
3. **Tor traffic** - Blocks requests where `ip.src.continent eq "T1"`.

**Validated update:** Tor is exposed by Cloudflare as `ip.src.continent == "T1"`, not by country code.

**Why Block:** These are paths and sources we do not want to challenge through.

---

### Rule 5: Reserved

Keep the 5th slot empty for emergency response.

**Possible future uses:**
- Challenge VPN provider ASNs if Security Events show repeated VPN-sourced abuse
- Block a specific IP or ASN during an active incident
- Challenge or block specific countries once real traffic geography is known
- Add a targeted rule for a newly observed probe pattern

---

## Step 3: WAF Rate Limiting Rule (1 of 1 slot)

Navigate to **Dashboard -> Security -> WAF -> Rate limiting rules**.

| Field | Value |
|---|---|
| **Rule name** | API rate limit |
| **Expression** | `(http.request.uri.path eq "/api") or (http.request.uri.path contains "/api/")` |
| **Characteristics** | IP |
| **Requests** | 50 |
| **Period** | 10 seconds |
| **Mitigation timeout** | 10 seconds |
| **Action** | Block |

**What this does:** If a single IP sends more than 50 requests to the branded `/api` surface in 10 seconds, Cloudflare blocks that IP at the edge for 10 seconds.

**How it complements our Worker rate limits:** Our existing Supabase RPC rate limits are more granular but run after the request reaches the API Worker. This catches floods earlier.

**Free plan constraints:** One rule, IP counting only, 10-second counting period on Free.

**Scope caveat:** This only protects requests sent to `uttervoice.com`. It does not rate-limit direct traffic to public `workers.dev` hostnames.

---

## After Implementation: Verify

1. **Security Events:** In the current dashboard UI, go to **Analytics -> Events**. (Older docs and older navigation may still refer to **Security -> Events**.) Within 24 hours you should see entries from:
   - Custom rules
   - Block AI Bots
   - Bot Fight Mode, if enabled
   - Rate limiting rules

2. **Worker invocations:** Dashboard -> Workers & Pages -> `utter-frontend-staging` -> Metrics. Scanner traffic against `uttervoice.com` should consume fewer frontend Worker invocations.

3. **Test your own access:** Visit `https://uttervoice.com` normally and use the app in a real browser.

4. **Test `/api/*` from the browser:** Sign in and use normal app flows.

5. **If Bot Fight Mode is enabled:** Confirm no trusted machine client is using `https://uttervoice.com/api/*`. If any non-browser integration breaks, disable Bot Fight Mode and revisit hostname separation.

6. **Remember the gap:** Direct requests to `*.workers.dev` remain outside this zone-level protection.

---

## What's NOT in this plan (and why)

| Skipped | Reason |
|---|---|
| Security Level / threat-score tuning | Cloudflare no longer recommends building new rules around threat score. |
| Workers Rate Limit binding | Still useful later, but separate from this dashboard-only pass. |
| Security headers (CSP, HSTS) | Good hygiene, but separate from scanner mitigation. |
| Country blocking | Premature until we know actual user geography. |
| VPN ASN challenge | Lower priority than scanner paths + large cloud providers. |
| Bad hosting ASN mega-blocklist | Too aggressive as a starting point. |
| "I'm Under Attack" mode | Only for active incident response. |
| Full API hostname hardening | Requires hostname / deployment decisions beyond this zone-only dashboard pass. |

---

## Rule evaluation order

When a request hits `uttervoice.com`:

```txt
Request
  ↓
Rule 1: Known good bot? -> Skip selected security components
  ↓
Rule 2: Suspicious UA? -> Managed Challenge
  ↓
Rule 3: From large cloud VPS? -> Managed Challenge
  ↓
Rule 4: Scanner path / Tor / AI crawler? -> Block
  ↓
Rate limit: burst against branded /api surface? -> Block
  ↓
Bot Fight Mode (if enabled), Browser Integrity Check, other enabled features
  ↓
Frontend Worker executes
  ↓
Frontend Worker proxies /api/* to API Worker when applicable
```

---

## Summary

Three steps, all dashboard-only, no code changes:

| Step | What | Time |
|---|---|---|
| 1. Dashboard toggles | Conditional Bot Fight Mode, Block AI Bots ON, Browser Integrity Check ON, Onion Routing OFF | 5 min |
| 2. WAF Custom Rules | 4 rules: Allow Good Bots -> Aggressive Crawlers -> Challenge Large Providers -> Block Paths/Tor/AI | 15 min |
| 3. WAF Rate Limit Rule | 50 req / 10s per IP on branded `/api` surface | 5 min |
