# WAF Rule Recommendations — 2026-03-23

Solutions to close the gaps identified in [waf-analysis.md](./waf-analysis.md), based on traffic documented in [log-analysis.md](./log-analysis.md). Changes are organized as modifications to existing rules or new rules.

## Approach

The recommendations follow a layered strategy:
1. **Block known-hostile ASNs** — highest impact, lowest false-positive risk
2. **Expand scanner path blocks** — catch the path patterns these bots probe
3. **Add UA-based detection** — catch `curl`, `HeadlessChrome`, outdated Chrome versions
4. **Block non-API POST requests** — structural defense (uttervoice.com only accepts POSTs on `/api/*`)
5. **Expand provider challenge list** — catch VPS-hosted scanners

---

## Recommendation 1: New rule — Block hostile ASNs

**Action:** Block
**Priority:** Insert after "Allow good bots", before "Aggressive crawlers"
**Impact:** Eliminates ~75% of bot traffic (FBW, HostRoyale, HK/CN probes, M247 scanners)

```
(ip.src.asnum in {
  211590
  203020
  134365
  152194
  133380
  9009
})
and not cf.client.bot
```

| ASN | Org | Reason |
|---|---|---|
| 211590 | FBW NETWORKS SAS (FR) | Vulnerability scanner, `curl` upload probes |
| 203020 | HostRoyale Technologies (IN) | Russian phishing botnet infrastructure |
| 134365 | 158 Cloud Computing (HK) | Blind POST probes to `/admin`, `/api` |
| 152194 | MEGA-II IDC (HK) | Blind POST probes to `/admin`, `/api` |
| 133380 | HK datacenter | Blind POST probes to `/admin`, `/api` |
| 9009 | M247 / VDDC (NL) | HeadlessChrome scanners, SSRF probes |

**False-positive risk:** Low. These are all hosting/datacenter ASNs with no legitimate residential users. No real uttervoice.com user would originate from these networks. If concerned about ASN 9009 (M247 is large), change action to Managed Challenge instead of Block.

---

## Recommendation 2: Modify Rule 2 — Add `curl` and `HeadlessChrome` to aggressive crawlers

**Action:** Managed Challenge (existing)
**Change:** Add these conditions to the existing OR chain:

```
(http.user_agent contains "curl") or
(http.user_agent contains "HeadlessChrome") or
(http.user_agent contains "headlesschrome") or
(http.user_agent contains "Headless") or
(http.user_agent contains "httpx") or
(http.user_agent contains "Go-http-client") or
(http.user_agent contains "okhttp" and not http.request.uri.path contains "/api/") or
(http.user_agent eq "Mozilla/5.0")
```

**Rationale:**
- `curl` — catches FBW NETWORKS and any other `curl`-based scanners. No legitimate browser sends `curl` as UA.
- `HeadlessChrome` / `Headless` — catches Puppeteer/Playwright scanners. Real browsers never include "Headless" in their UA.
- `httpx`, `Go-http-client` — common scanner/recon tool UAs not currently covered.
- `okhttp` (excluding `/api/*`) — catches automated mobile-client impersonators on non-API paths. The `okhttp` UA on `/api/storage/download` in the logs is legitimate (Alibaba Cloud CDN fetching audio), so we exclude `/api/*`.
- `Mozilla/5.0` (exact match) — bare UA with no browser engine is always a scanner. Different from `eq ""` which catches empty UAs.

**Full updated Rule 2:**
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
(http.user_agent eq "") or
(http.user_agent contains "curl") or
(http.user_agent contains "HeadlessChrome") or
(http.user_agent contains "headlesschrome") or
(http.user_agent contains "Headless") or
(http.user_agent contains "httpx") or
(http.user_agent contains "Go-http-client") or
(http.user_agent contains "okhttp" and not http.request.uri.path contains "/api/") or
(http.user_agent eq "Mozilla/5.0")
```

---

## Recommendation 3: Modify Rule 4 — Expand scanner path blocks

**Action:** Block (existing)
**Change:** Add these path conditions to the existing OR chain:

```
(http.request.uri.path contains "/wordpress") or
(http.request.uri.path contains "/.git") or
(http.request.uri.path contains "/secrets") or
(http.request.uri.path contains "/cmd_") or
(http.request.uri.path contains "/lander/") or
(http.request.uri.path contains "/cabinet") or
(http.request.uri.path contains "/rest/settings")
```

**Rationale:**
- `/wordpress` — WordPress installation probes (currently only `/wp-admin`, `/wp-login` etc. are blocked)
- `/.git` — Git repository exposure probes (`.git/config`, `.git/HEAD`)
- `/secrets` — `secrets.json` and similar secret file probes
- `/cmd_` — Command injection probes (`/cmd_sco` seen in logs)
- `/lander/` — Russian phishing lander path prefix (all `/lander/*` paths are phishing)
- `/cabinet` — Russian-language admin panel probe
- `/rest/settings` — REST API configuration exposure probe

**Full updated Rule 4:**
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
(ip.src.continent eq "T1") or
(http.request.uri.path contains "/wordpress") or
(http.request.uri.path contains "/.git") or
(http.request.uri.path contains "/secrets") or
(http.request.uri.path contains "/cmd_") or
(http.request.uri.path contains "/lander/") or
(http.request.uri.path contains "/cabinet") or
(http.request.uri.path contains "/rest/settings")
```

---

## Recommendation 4: New rule — Block non-API POST requests

**Action:** Block
**Priority:** After "Allow good bots", after "Block hostile ASNs"

**Impact:** Structural defense — eliminates all POST-based probes to non-API paths

```
(http.request.method eq "POST") and
not (http.request.uri.path contains "/api/")
```

**Rationale:**
uttervoice.com is a SPA. The only legitimate POST targets are under `/api/*`, which get proxied to the API Worker. There is no legitimate reason for a POST to `/admin`, `/form/*`, `/webhook/*`, `/upload`, or any other non-API path. Every single non-API POST in the logs is from a scanner.

This single rule would have blocked:
- All FBW NETWORKS upload probes to `/form/*`, `/webhook/*`, `/admin/*`
- All HK/CN POST probes to `/admin`
- Any future POST-based scanner probing non-API paths

**False-positive risk:** None. The frontend Worker serves static assets and the SPA shell — it never needs to accept POSTs outside `/api/*`.

---

## Recommendation 5: Modify Rule 3 — Expand provider challenge list

**Action:** Managed Challenge (existing)
**Change:** Add DigitalOcean ASN to the challenge list:

```
(ip.src.asnum in {7224 16509 14618 15169 8075 396982 14061})
and not cf.client.bot
and not cf.verified_bot_category in {
  "Search Engine Crawler" "Search Engine Optimization"
  "Monitoring & Analytics" "Advertising & Marketing"
  "Page Preview" "Academic Research" "Security"
  "Accessibility" "Webhooks" "Feed Fetcher" "Aggregator"
}
and not http.request.uri.path contains "acme-challenge"
```

**Added:** `14061` (DigitalOcean)

**Rationale:** DigitalOcean is commonly used for hosting scanners and scraping infrastructure. The probe from `134.209.84.192` (GET `/main.js` with OS-mismatched headers) confirms this. Managed Challenge (not block) means legitimate users on DO-hosted VPNs can still pass through by solving the challenge.

---

## Implementation priority

| Priority | Recommendation | Effort | Impact |
|---|---|---|---|
| 1 | **Rec 4: Block non-API POSTs** | New rule, 2 conditions | Eliminates all POST-based scanning to non-API paths |
| 2 | **Rec 1: Block hostile ASNs** | New rule, 6 ASNs | Eliminates ~75% of bot traffic |
| 3 | **Rec 2: Expand UA detection** | Modify existing rule, add 8 conditions | Catches `curl`, HeadlessChrome, bare UA scanners |
| 4 | **Rec 3: Expand path blocks** | Modify existing rule, add 7 paths | Blocks phishing landers, git probes, WP probes |
| 5 | **Rec 5: Add DigitalOcean to providers** | Modify existing rule, add 1 ASN | Minor improvement |

Recommendations 1 and 4 together would eliminate approximately 95% of the unwanted traffic seen in these logs.

---

## Rule evaluation order

After implementing all recommendations, the WAF rule evaluation order should be:

1. **Allow good bots** (existing, unchanged)
2. **Block hostile ASNs** (new — Rec 1)
3. **Block non-API POSTs** (new — Rec 4)
4. **Block scanner paths, Tor, AI crawlers** (modified — Rec 3)
5. **Aggressive crawlers** (modified — Rec 2)
6. **Challenge large providers** (modified — Rec 5)

---

## Side note: ReadableStream bug

The frontend Worker has a code bug where POST requests to non-API paths trigger `ReadableStream is disturbed` or `Can't read from request stream` errors. This is because the Worker reads the request body, then tries to pass it through to the SPA response. This bug generates 2-3 error log lines per bot POST probe, inflating log noise.

Recommendation 4 (block non-API POSTs at WAF level) eliminates this entirely — the requests never reach the Worker. However, the underlying bug should still be fixed independently to handle any edge cases that slip through.
