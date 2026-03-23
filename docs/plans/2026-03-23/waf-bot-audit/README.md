# WAF & Bot Traffic Audit — 2026-03-23

Audit of unwanted bot/scanner traffic hitting uttervoice.com, gap analysis of current Cloudflare WAF rules, and recommendations to close coverage gaps.

**Log period:** 2026-03-20T19:56 → 2026-03-23T14:41 UTC (~67 hours)

**Key finding:** ~78% of frontend Worker log lines are from bots/scanners. Two new WAF rules (block hostile ASNs + block non-API POSTs) would eliminate ~95% of it.

## Documents

| File | Description |
|---|---|
| [log-analysis.md](./log-analysis.md) | Detailed breakdown of all 6 bot/scanner categories — IPs, ASNs, user agents, paths, behavior patterns, and legitimate traffic baseline |
| [waf-analysis.md](./waf-analysis.md) | Rule-by-rule gap analysis explaining why each bot bypasses each of the 4 current WAF rules |
| [waf-recommendations.md](./waf-recommendations.md) | 5 prioritized recommendations with copy-paste-ready Cloudflare rule expressions |

## Implementation

| File | Description |
|---|---|
| [implementation.md](./implementation.md) | Step-by-step Cloudflare dashboard instructions for applying all WAF rule changes |

## Raw logs

| File | Worker | Lines |
|---|---|---|
| [logs/utter-logs-2026-03-23T14_45_28.703Z.csv](./logs/utter-logs-2026-03-23T14_45_28.703Z.csv) | `utter` (frontend) | 1000 |
| [logs/utter-api-staging-logs-2026-03-23T14_46_04.197Z.csv](./logs/utter-api-staging-logs-2026-03-23T14_46_04.197Z.csv) | `utter-api-staging` (API) | 961 |

## Bots identified

1. **FBW NETWORKS** (ASN 211590, FR) — `curl`-based upload/vuln scanner, 61% of log noise
2. **Russian/CIS phishing botnet** (ASN 203020) — probing Sberbank phishing lander paths, 10%
3. **HK/CN POST probes** (ASNs 134365, 152194, 133380) — blind `/admin` and `/api` POSTs, 2%
4. **HeadlessChrome scanners** (ASN 9009, NL) — Puppeteer-based recon, <1%
5. **WordPress fingerprinting** (ASN 139981, ID) — `/wordpress/` probe
6. **DigitalOcean probe** (ASN 14061, NL) — `/main.js` with mismatched OS headers

## Recommendation summary

| Priority | Change | Impact |
|---|---|---|
| 1 | New rule: block non-API POSTs | Structural — no legit non-API POSTs exist |
| 2 | New rule: block 6 hostile ASNs | Eliminates ~75% of bot traffic |
| 3 | Add `curl`, `HeadlessChrome`, bare `Mozilla/5.0` to UA challenge rule | Catches tool-based scanners |
| 4 | Add `/wordpress`, `/.git`, `/lander/`, `/cmd_` to path block rule | Blocks phishing + recon paths |
| 5 | Add DigitalOcean (ASN 14061) to provider challenge rule | Minor improvement |
