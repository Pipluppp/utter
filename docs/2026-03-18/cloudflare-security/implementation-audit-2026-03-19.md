# Cloudflare Security Implementation Audit

Date: 2026-03-19
Scope: `uttervoice.com` zone-level Cloudflare security hardening
Status: Completed

## What Was Implemented

- Enabled `Bot Fight Mode` for the `uttervoice.com` zone after confirming branded `/api/*` is intended for browser traffic, not trusted machine-to-machine integrations.
- Enabled `Block AI bots`.
- Enabled `Browser Integrity Check`.
- Disabled `Onion Routing`.

## Custom Rules Deployed

The following WAF custom rules were created in this order:

1. `Allow Good Bots`
2. `Aggressive Crawlers`
3. `Challenge Large Providers`
4. `Block Scanner Paths, Tor, AI Crawlers`

The `Allow Good Bots` rule was configured to skip:

- All remaining custom rules
- All rate limiting rules
- All managed rules
- All Super Bot Fight Mode rules
- Zone Lockdown
- User Agent Blocking
- Browser Integrity Check
- Hotlink Protection
- Security Level
- Rate limiting rules (Previous version)
- Managed rules (Previous version)

## Rate Limiting Deployed

- Created `API rate limit`
- Scope: branded `/api` and `/api/*` traffic on `uttervoice.com`
- Threshold: 50 requests per IP per 10 seconds
- Action: `Block`
- Mitigation timeout: 10 seconds

## Verification Performed

- Confirmed the custom rule order in the dashboard.
- Confirmed the rate limiting rule is present and active.
- Confirmed `Analytics -> Events` is already showing mitigated traffic.
- Observed `Bot fight mode` events challenging automated traffic such as `python-requests` from AWS-hosted IPs.
- Observed `Custom rules` events firing as expected, including `Challenge Large Providers` on AWS ASN `14618`.
- Confirmed the site and normal browser app flows still work after rollout.

## Dashboard Differences Found During Execution

- `Browser Integrity Check` and `Onion Routing` were surfaced inside an `Activate basic features` modal instead of as separate toggles.
- The Skip-rule UI now exposes `All remaining custom rules`, so it was enabled for `Allow Good Bots`.
- Security event review is under `Analytics -> Events` in the current UI rather than `Security -> Events`.

These differences were folded back into the validated plan in `cloudflare-security-plan.md`.

## Remaining Exposure

This setup protects `uttervoice.com` only.

Direct public Worker hostnames remain outside this zone-level WAF setup, including:

- `https://utter.duncanb013.workers.dev`
- `https://utter-api-staging.duncanb013.workers.dev`
