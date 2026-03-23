# Network Log Traffic Analysis — 2026-03-23

Log period: **2026-03-20T19:56 → 2026-03-23T14:41 UTC** (~67 hours)

Sources:
- `utter-logs-2026-03-23T14_45_28.703Z.csv` — frontend Worker ("utter"), 1000 log lines
- `utter-api-staging-logs-2026-03-23T14_46_04.197Z.csv` — API Worker ("utter-api-staging"), 961 log lines

## Traffic summary (frontend Worker)

| Category | Log lines | % of total |
|---|---:|---:|
| Bot/scanner requests | 563 | 56.3% |
| Error lines caused by bot POSTs | 217 | 21.7% |
| Legitimate crawlers (Googlebot, OAI-SearchBot, etc.) | 14 | 1.4% |
| Legitimate user traffic | 204 | 20.4% |
| Error lines from legitimate user activity | 2 | 0.2% |

**~78% of frontend Worker log lines are from unwanted bot/scanner activity.**

The API Worker logs are almost entirely legitimate user traffic (961/961 lines). No bot traffic reached the API Worker because:
1. The frontend Worker acts as a natural filter — most bot probes target non-`/api/*` paths and get served the SPA shell or errors
2. Bot probes that do hit `/api/*` paths get 404s from the API Worker (routes don't exist) and aren't logged in the API Worker's own telemetry for these non-matching routes

---

## Bot/scanner #1: FBW NETWORKS vulnerability scanner

| Field | Value |
|---|---|
| ASN | 211590 (FBW NETWORKS SAS) |
| Country | France |
| IPs | `185.177.72.23`, `185.177.72.49`, `185.177.72.56` |
| User-Agent | `curl/8.7.1` |
| Method | POST (all requests) |
| Log lines | 314 (+ ~298 error lines = ~612 total) |
| % of frontend logs | ~61% |

### What it does

Systematic file-upload and admin-path vulnerability scanner. Fires ~170+ unique paths in rapid bursts, all POSTs with `curl/8.7.1`. Probes three categories:

**Upload endpoint discovery** (`/api/*`, `/form/*`, `/webhook/*`):

```
/api/files, /api/files/upload, /api/media, /api/media/upload
/api/images, /api/images/upload, /api/assets, /api/assets/upload
/api/bulk-upload, /api/multipart, /api/blob, /api/blob/upload
/api/v1/files, /api/v1/upload, /api/v2/files
/api/products/images, /api/products/upload, /api/gallery/upload
/api/s3/upload, /api/storage, /api/storage/local, /api/storage/upload
/api/content/upload, /api/documents, /api/documents/upload
/api/profile/avatar, /api/profile/photo, /api/account/avatar
/api/v1/users/avatar, /api/v1/documents, /api/v1/media
/form/upload, /form/file, /form/files, /form/image, /form/images
/form/dropzone, /form/multipart, /form/batch, /form/bulk
/form/public/upload, /form/shared/upload, /form/internal/upload
/form/internal/import, /form/api/upload, /form/api/files
/form/profile/avatar, /form/profile/photo, /form/account/avatar
/form/admin/upload, /form/admin/files, /form/admin/import
/webhook/upload, /webhook/file, /webhook/files, /webhook/image
/webhook/images, /webhook/media, /webhook/documents
/webhook/admin/upload, /webhook/admin/files, /webhook/admin/import
/webhook/profile/avatar, /webhook/profile/photo
/webhook/public/upload, /webhook/shared/upload
/webhook/v1/upload, /webhook/v2/upload, /webhook/v1/files
/webhook-test/upload, /webhook-test/files, /webhook-test/import
```

**Admin path probes**:
```
/admin/upload, /admin/files, /admin/media
```

**Misc discovery**:
```
/upload, /uploads, /uploadfile, /upload/file, /upload/image
/fileupload, /file-upload, /files/upload
/import, /rest/settings, /v1/upload, /v2/upload
```

### Behavior pattern

- All requests are POST with `curl/8.7.1` user-agent
- Fires all paths within a ~10-second window (rapid burst)
- Two source IPs alternate (`185.177.72.23` for `/api/*` paths, `185.177.72.56` for `/form/*` and `/webhook/*` paths)
- Looking for file upload endpoints to exploit for malware hosting, webshells, or data exfiltration
- Every non-`/api/*` POST triggers the frontend Worker's ReadableStream bug, generating 2-3 error log lines per probe

---

## Bot/scanner #2: Russian/CIS phishing botnet

| Field | Value |
|---|---|
| ASN | 203020 (HostRoyale Technologies Pvt Ltd) |
| Country | India (registration), but IPs geolocate across RU/CIS ranges |
| IPs | 81 unique IPs across `45.92.84.*`, `45.92.85.*`, `45.92.86.*`, `45.92.87.*`, `155.94.203.*` |
| User-Agent | `Mozilla/5.0 (Windows NT 10.0; Win64; x64) ... Chrome/94.0.4606.61` |
| Method | GET (all requests) |
| Log lines | 104 |
| % of frontend logs | ~10.4% |

### What it does

Probes phishing/scam lander paths. Each request comes from a different IP in the same /24 blocks. Two categories of paths:

**Russian bank/fintech phishing landers**:
```
/lander/sber/, /lander/sber-fix/, /lander/rosneft/
/lander/sberquiz-2223-3, /lander/testsberv4-copy--1/
/sberbank-quiz-4, /sberbank-quiz-v2/
/sberchat008-prilca/, /sbr, /tink_chat/, /cabinet
```

**Random short-code redirector probes**:
```
/zxDLJZ, /9XgxmrM3, /28kxhS, /83036323, /nqw80
/p3y69, /9hs69, /5jshCV, /BNp8hDTk, /CMdTKBx3
/dwztdbhG, /fpyB8SZ3, /GJcjXsGY, /j26HRfdD, /Kd67Fq1x
(~50 more random alphanumeric paths)
```

### Behavior pattern

- Classic phishing infrastructure check: botnet verifies whether a domain is hosting their scam landers
- Outdated Chrome/94 user-agent (current is 146) — dead giveaway
- Each IP makes 1-2 requests then rotates — designed to evade per-IP rate limits
- All GET requests, all return 200 (SPA shell served for any path)
- The `/lander/sber*` paths reference Sberbank (Russian state bank) phishing campaigns

---

## Bot/scanner #3: HK/CN POST probes

| Field | Value |
|---|---|
| ASNs | 134365 (158 Cloud Computing), 152194 (MEGA-II IDC), 133380 (HK datacenter) |
| Country | Hong Kong |
| IPs | `45.197.149.104`, `121.127.245.210`, `143.92.35.17`, `103.231.254.121` |
| User-Agent | `Mozilla/5.0 (Windows NT 10.0; Win64; x64) ... Chrome/141.0.0.0` |
| Method | POST (all requests) |
| Log lines | 10 requests + 11 error lines = 21 total |
| % of frontend logs | ~2.1% |

### What it does

Blind POST probes to `/admin` and `/api` root paths. Each IP sends exactly one POST to `/admin` and one POST to `/api`.

```
POST /admin → 500 (ReadableStream bug)
POST /api   → 404 (no route match)
```

### Behavior pattern

- Probing for admin panels and API endpoints that accept unauthenticated POSTs
- Chrome/141 user-agent (outdated — current is 146)
- All from Hong Kong datacenter IPs, not residential
- Coordinated: 4 different IPs from 3 different ASNs hit the same two paths at similar times
- Likely automated recon for command injection or admin takeover

---

## Bot/scanner #4: HeadlessChrome scanners

| Field | Value |
|---|---|
| ASNs | 9009 (M247 / VDDC), 45758 |
| Country | Netherlands (AMS), Thailand |
| IPs | `94.154.142.172` (primary), `146.0.0.0`, `103.4.251.193` |
| User-Agent | `Mozilla/5.0 ... Chrome/120.0.0.0` with `sec-ch-ua: "HeadlessChrome";v="129"` |
| Method | GET |
| Log lines | 7 (4 HeadlessChrome + 3 other ASN 9009) |
| % of frontend logs | ~0.7% |

### What it does

Automated browser (Puppeteer/Playwright) hitting the site to render JavaScript and scrape content or test for client-side vulnerabilities.

```
GET /api/auth/session  (3x from 94.154.142.172, HeadlessChrome)
GET /api/auth/session  (1x from 146.0.0.0, HeadlessChrome)
GET /cmd_sco           (2x from 94.154.142.172, non-headless)
GET /https%3A/fonts.googleapis.com/...  (2x from 103.4.251.193, malformed URL probe)
```

### Behavior pattern

- `sec-ch-ua` header exposes `HeadlessChrome` — real browsers never send this
- Chrome/120 in UA but HeadlessChrome/129 in sec-ch-ua — version mismatch is a fingerprint
- ASN 9009 (M247/VDDC) is a well-known hosting provider used for scraping infrastructure
- `/cmd_sco` path is a command injection probe
- The malformed Google Fonts URL probe tests for SSRF or open redirect vulnerabilities
- Requests to `/api/auth/session` returned `canceled` outcome — the scanner disconnected before response completed

---

## Bot/scanner #5: WordPress fingerprinting

| Field | Value |
|---|---|
| ASN | 139981 (PT. Menaksopal Link Nusantara) |
| Country | Indonesia |
| IP | `103.71.161.54` |
| User-Agent | `Mozilla/5.0` (bare, no browser details) |
| Method | GET |
| Log lines | 2 |

### What it does

```
GET /wordpress/  (with Referer: http://uttervoice.com/wordpress/)
```

Probes for WordPress installations. The bare `Mozilla/5.0` user-agent with no browser engine details is a classic scanner fingerprint.

---

## Bot/scanner #6: DigitalOcean probe

| Field | Value |
|---|---|
| ASN | 14061 (DigitalOcean) |
| Country | Netherlands |
| IP | `134.209.84.192` |
| User-Agent | Chrome/135 (Linux x86_64, claims macOS in sec-ch-ua) |
| Method | GET |
| Log lines | 1 |

### What it does

```
GET /main.js
```

Probes for exposed JavaScript bundles. The OS mismatch (Linux in UA, macOS in sec-ch-ua) indicates a headless browser on a VPS.

---

## Legitimate crawlers (wanted)

| Crawler | Lines | Verified bot category |
|---|---:|---|
| Googlebot | 7 | Search Engine Crawler |
| OAI-SearchBot | 5 | AI Search |
| facebookexternalhit | 1 | Page Preview |
| MJ12bot | 1 | Search Engine Optimization |

All hit `/robots.txt` or standard pages. All have `cf.verified_bot_category` set. These are correctly allowed by the existing "Allow good bots" WAF rule.

---

## Legitimate user traffic

| Metric | Value |
|---|---|
| Log lines | ~204 |
| Unique IPs | ~10 active users |
| Countries | PH (dominant), US, DE, IT, NL, CA |
| Paths | `/api/auth/session`, `/api/voices`, `/api/generate`, `/api/clone/*`, `/api/credits/*`, `/api/me`, `/api/languages`, `/account`, `/generate` |

Two primary active users visible in logs:
- `180.232.133.162` (PH, Eastern Telecom, Chrome/146 + Edge/146) — heavy usage across auth, generate, clone, account
- `61.9.102.108` (PH, Sky Cable, Chrome/146 + Edge/146 + Safari Mobile) — auth, clone, generate flow
