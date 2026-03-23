# WAF Rule Gap Analysis — 2026-03-23

Analysis of why each bot/scanner identified in [log-analysis.md](./log-analysis.md) bypasses the current Cloudflare WAF rules on uttervoice.com. Recommendations in [waf-recommendations.md](./waf-recommendations.md).

## Current WAF rules

### Rule 1: Allow good bots
**Action:** Allow
```
(cf.client.bot) or
(cf.verified_bot_category in {
  "Search Engine Crawler" "Search Engine Optimization"
  "Monitoring & Analytics" "Advertising & Marketing"
  "Page Preview" "Academic Research" "Security"
  "Accessibility" "Webhooks" "Feed Fetcher"
}) or
(http.user_agent contains "letsencrypt" and
 http.request.uri.path contains "acme-challenge")
```
**Assessment:** Working correctly. Googlebot, OAI-SearchBot, facebookexternalhit, and MJ12bot all pass through as intended.

### Rule 2: Aggressive crawlers (challenge)
**Action:** Managed Challenge
```
(http.user_agent contains "yandex") or
(http.user_agent contains "sogou") or
(http.user_agent contains "semrush") or
(http.user_agent contains "ahrefs") or
(http.user_agent contains "baidu") or
(http.user_agent contains "python-requests") or
(http.user_agent contains "neevabot") or
(http.user_agent contains "CF-UC") or
(http.user_agent contains "sitelock") or
(http.user_agent contains "crawl" and not cf.client.bot) or
(http.user_agent contains "bot" and not cf.client.bot) or
(http.user_agent contains "Bot" and not cf.client.bot) or
(http.user_agent contains "Crawl" and not cf.client.bot) or
(http.user_agent contains "spider" and not cf.client.bot) or
(http.user_agent contains "mj12bot") or
(http.user_agent contains "ZoominfoBot") or
(http.user_agent contains "mojeek") or
(http.user_agent contains "sqlmap") or
(http.user_agent contains "nikto") or
(http.user_agent contains "nmap") or
(http.user_agent contains "nuclei") or
(http.user_agent contains "gobuster") or
(http.user_agent contains "dirbuster") or
(http.user_agent contains "zgrab") or
(http.user_agent contains "masscan") or
(http.user_agent contains "wpscan") or
(http.user_agent contains "Havij") or
(http.user_agent contains "scrapy") or
(http.user_agent eq "")
```

### Rule 3: Challenge large providers
**Action:** Managed Challenge
```
(ip.src.asnum in {7224 16509 14618 15169 8075 396982}) and
not cf.client.bot and
not cf.verified_bot_category in {
  "Search Engine Crawler" "Search Engine Optimization"
  "Monitoring & Analytics" "Advertising & Marketing"
  "Page Preview" "Academic Research" "Security"
  "Accessibility" "Webhooks" "Feed Fetcher" "Aggregator"
} and
not http.request.uri.path contains "acme-challenge"
```

### Rule 4: Block scanner paths, Tor, AI crawlers
**Action:** Block
```
(http.request.uri.path contains ".php") or
(http.request.uri.path contains "/.env") or
(http.request.uri.path contains "/debug") or
(http.request.uri.path contains "/storage/logs") or
(http.request.uri.path contains "/_profiler") or
(http.request.uri.path contains "/server-info") or
(http.request.uri.path contains "/manage/env") or
(http.request.uri.path contains "/horizon/") or
(http.request.uri.path contains "/wp-admin") or
(http.request.uri.path contains "/wp-login") or
(http.request.uri.path contains "/wp-content") or
(http.request.uri.path contains "/xmlrpc") or
(http.request.uri.path contains "/wp-config") or
(http.request.uri.path contains "/wlwmanifest") or
(http.request.uri.path contains "/vendor/") or
(http.request.uri.path contains "/config.") or
(cf.verified_bot_category in {"AI Crawler" "Other"}) or
(ip.src.continent eq "T1")
```

---

## Gap analysis per bot

### FBW NETWORKS (ASN 211590) — NOT CAUGHT

**Why it bypasses every rule:**

| Rule | Why it misses |
|---|---|
| Rule 2 (Aggressive crawlers) | UA is `curl/8.7.1` — doesn't contain any of the listed bot/crawler strings. `curl` is not in the list. |
| Rule 3 (Challenge large providers) | ASN 211590 is not in the challenge list `{7224 16509 14618 15169 8075 396982}`. FBW NETWORKS is a small French hosting provider, not a hyperscaler. |
| Rule 4 (Block scanner paths) | None of the probed paths match the block list. The scanner targets `/api/*`, `/form/*`, `/webhook/*`, `/admin/*`, `/upload*` — none of which contain `.php`, `.env`, `/wp-admin`, `/vendor/`, etc. |

**This is the biggest gap.** FBW accounts for ~61% of all frontend log lines.

### Russian/CIS botnet (ASN 203020) — NOT CAUGHT

**Why it bypasses every rule:**

| Rule | Why it misses |
|---|---|
| Rule 2 (Aggressive crawlers) | UA is a standard Chrome/94 string — no bot/crawler keywords. The `(http.user_agent eq "")` check doesn't match because the UA is populated. |
| Rule 3 (Challenge large providers) | ASN 203020 (HostRoyale) is not in the challenge list. |
| Rule 4 (Block scanner paths) | Paths like `/lander/sber/`, `/zxDLJZ`, `/cabinet` don't match any blocked patterns. These are phishing-specific paths, not generic scanner paths. |

**The outdated Chrome/94 UA is a signal** (current Chrome is 146), but there's no rule checking for UA version freshness.

### HK/CN POST probes (ASNs 134365, 152194, 133380) — NOT CAUGHT

**Why it bypasses every rule:**

| Rule | Why it misses |
|---|---|
| Rule 2 (Aggressive crawlers) | UA is standard Chrome/141 — no bot keywords. |
| Rule 3 (Challenge large providers) | These HK datacenter ASNs are not in the challenge list. |
| Rule 4 (Block scanner paths) | `/admin` and `/api` are not in the blocked path list. The rule blocks `/wp-admin` but not bare `/admin`. |

### HeadlessChrome scanners (ASN 9009) — NOT CAUGHT

**Why it bypasses every rule:**

| Rule | Why it misses |
|---|---|
| Rule 2 (Aggressive crawlers) | UA string is standard Chrome — `HeadlessChrome` only appears in the `sec-ch-ua` header, which no rule inspects. The actual `User-Agent` header says `Chrome/120.0.0.0`. |
| Rule 3 (Challenge large providers) | ASN 9009 (M247/VDDC) is not in the challenge list. |
| Rule 4 (Block scanner paths) | Paths hit are `/api/auth/session`, `/cmd_sco`, and malformed Google Fonts URLs — none match blocked patterns. |

### WordPress probe (ASN 139981) — PARTIALLY CAUGHT

The path `/wordpress/` does NOT match any Rule 4 pattern. Rule 4 blocks `/wp-admin`, `/wp-login`, `/wp-content`, `/wp-config`, `/xmlrpc`, `/wlwmanifest` — but not `/wordpress/` itself.

The bare `Mozilla/5.0` user-agent (no browser engine) doesn't match Rule 2 either — it's not empty (`eq ""`), and doesn't contain any bot/crawler keywords.

### DigitalOcean probe (ASN 14061) — NOT CAUGHT

ASN 14061 is not in the Rule 3 challenge list (which only has AWS, GCP, Azure ASNs). The path `/main.js` doesn't match any Rule 4 pattern. The UA is a standard Chrome string.

---

## Summary of gaps

| Gap | Bots affected | Impact |
|---|---|---|
| No `curl` in UA block list | FBW NETWORKS | 61% of log noise |
| No ASN-level blocking for known hostile ASNs | FBW (211590), HostRoyale (203020), HK DCs (134365, 152194, 133380), M247 (9009) | 75% of log noise |
| No `HeadlessChrome` detection in sec-ch-ua | ASN 9009 scanners | Low volume but high-capability recon |
| No path blocks for `/form/*`, `/webhook/*`, `/admin` (bare), `/upload*` | FBW NETWORKS, HK/CN probes | Upload exploit attempts |
| No POST method restriction on non-API paths | FBW, HK/CN probes | All non-API POSTs are illegitimate |
| No `/wordpress` in scanner path list | WordPress probes | Minor |
| DigitalOcean (14061) not in provider challenge list | DO-based scanners | Minor |
